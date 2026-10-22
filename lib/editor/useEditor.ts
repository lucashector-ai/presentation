'use client'
/**
 * Estado do editor: documento + seleção + histórico (desfazer/refazer) + gravação + ferramentas.
 *
 * Toda mudança do documento passa pelo motor de sincronização (lib/colab/motor.ts), que a transforma em
 * operações por propriedade. O desfazer/refazer guarda essas operações (e as inversas) — não cópias do documento —
 * e as aplica sobre o documento ATUAL: cada pessoa desfaz só o que ela mesma fez, mesmo com outras editando junto.
 *
 * Gravação:
 *  - modo real: colaboração em tempo real pela sala do projeto (lib/colab/cliente.ts → Durable Object). A sala
 *    consolida as edições de todos e grava no Neon com a revisão; sem rede, o editor segue editando localmente e
 *    sincroniza ao voltar.
 *  - modo demonstração: autosave com debounce de 800 ms e ao sair, pela camada de dados (store local), com
 *    baseRevision; 409 preserva mudanças locais e mostra conflito. Uma gravação de cada vez, em fila.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { FORMATOS, novaCena, parseCamada, type AutoLayout, type Camada, type CamadaFrame, type Cena, type DocumentoProjeto, type Interacao } from '@/lib/scene/schema'
import { validarDocumento, type ResultadoValidacao } from '@/lib/scene/validate'
import { moverCena, normalizarZ, novoId, trazerParaFrente, enviarParaTras, avancarUm, recuarUm } from '@/lib/scene/order'
import { alinhar as alinharRects, envolvente, enquadrarNaCena, type Alinhamento } from '@/lib/scene/transform'
import { comDescendentes, ehFrame, filhosDe, mapaDe, paiDe, raizesDaSelecao } from '@/lib/scene/arvore'
import { LAYOUT_PADRAO, inferirLayout, inserirNoFrame as inserirNoFrameFn, moverNaLista as moverNaListaFn, resolverCamadas, type OpcoesResolver } from './autolayout'
import { distribuir as distribuirRects } from './guias'
import { criarMascara, ehMascara, removerMascara } from '@/lib/scene/mascara'
import { dados, ehErroDados, useDados, type AssetDemo } from '@/lib/dados'
import { aplicarOps, compactar, diferenca, type Op } from '@/lib/colab/ops'
import { MotorDocumento } from '@/lib/colab/motor'
import { ConexaoSala, type EstadoConexao } from '@/lib/colab/cliente'

export type EstadoSalvamento = 'salvo' | 'alterado' | 'salvando' | 'offline' | 'falha' | 'conflito'
import type { Ferramenta } from './atalhos'
export type { Ferramenta } from './atalhos'
export type AbaEsquerda = 'telas' | 'camadas' | 'arquivos' | 'blocos'
export type AbaDireita = 'design' | 'animacao' | 'interacoes'

/** Um passo de desfazer: as operações da ação e as inversas (aplicadas sobre o documento atual). */
export interface PassoHistorico { fwd: Op[]; inv: Op[] }

export interface EstadoEditor {
  documento: DocumentoProjeto
  cenaId: string
  selecao: string[]
  passado: PassoHistorico[]
  futuro: PassoHistorico[]
  revisao: number
  /** Modo real: estado da conexão com a sala (null = sem sala, modo demonstração). */
  conexao: EstadoConexao | null
  /** Visualizador na sala: o editor só mostra (não altera o documento). */
  somenteLeitura: boolean
  /** Falha de gravação informada pela sala. */
  falhaSala: string | null
  salvamento: EstadoSalvamento
  salvoEm: string | null
  conflito: { currentRevision: number } | null
  /** 0 = ajustar à tela */
  zoom: number
  pan: { x: number; y: number }
  grade: boolean
  /** Passo da grade em px da cena (com a grade ligada, posição e tamanho arredondam para ela). */
  gradePasso: number
  snap: boolean
  /** Encaixe nas frações da tela (1/2, 1/3, 2/3, 1/4, 3/4) ao mover e redimensionar. */
  fracoes: boolean
  /** Guias de layout (grade, colunas e linhas das telas e frames) visíveis e com encaixe (⌃⇧4). Preferência da sessão. */
  guiasLayout: boolean
  reguas: boolean
  ferramenta: Ferramenta
  abaEsquerda: AbaEsquerda
  abaDireita: AbaDireita
  /** Mostrar marcadores de hotspot/fluxo no canvas (aba Interações). */
  mostrarHotspots: boolean
  /** Contador para reexecutar a prévia de animação no canvas. */
  previa: number
}

type Acao =
  /** Mudança local já calculada (o motor guarda as operações); `desfeito` = desfazer/refazer. */
  | { tipo: 'documento'; documento: DocumentoProjeto; desfeito?: boolean }
  /** O documento mudou por causa da sala (outra pessoa, reconexão). */
  | { tipo: 'remoto'; documento: DocumentoProjeto }
  | { tipo: 'historico'; passado: PassoHistorico[]; futuro: PassoHistorico[] }
  | { tipo: 'sala'; patch: Partial<Pick<EstadoEditor, 'conexao' | 'salvamento' | 'revisao' | 'salvoEm' | 'somenteLeitura' | 'falhaSala'>> }
  | { tipo: 'selecionar'; ids: string[] }
  | { tipo: 'cena'; id: string }
  | { tipo: 'salvamento'; valor: EstadoSalvamento; revisao?: number; salvoEm?: string; conflito?: { currentRevision: number } | null }
  | { tipo: 'substituir'; documento: DocumentoProjeto; revisao: number }
  | { tipo: 'ui'; patch: Partial<Pick<EstadoEditor, 'zoom' | 'pan' | 'grade' | 'gradePasso' | 'snap' | 'fracoes' | 'guiasLayout' | 'reguas' | 'ferramenta' | 'abaEsquerda' | 'abaDireita' | 'mostrarHotspots' | 'previa'>> }

const LIMITE_HISTORICO = 150

function comDocumento(e: EstadoEditor, novo: DocumentoProjeto, limparSelecao: boolean): EstadoEditor {
  const cenaExiste = novo.scenes.some((s) => s.id === e.cenaId)
  const filtrada = limparSelecao ? [] : e.selecao.filter((id) => novo.scenes.some((s) => s.layers.some((l) => l.id === id)))
  return {
    ...e,
    documento: novo,
    cenaId: cenaExiste ? e.cenaId : (novo.scenes[0]?.id ?? e.cenaId),
    // mesma seleção = mesmo array: editar o documento não conta como "a seleção mudou" (presença, painéis)
    selecao: filtrada.length === e.selecao.length && !(limparSelecao && e.selecao.length) ? e.selecao : filtrada,
  }
}

function reducer(e: EstadoEditor, a: Acao): EstadoEditor {
  switch (a.tipo) {
    case 'documento': {
      if (a.documento === e.documento) return e
      const n = comDocumento(e, a.documento, !!a.desfeito)
      // com a sala, o estado de gravação vem dela (ver useEditor); sem sala, o autosave olha "alterado"
      return e.conexao ? n : { ...n, salvamento: e.salvamento === 'conflito' ? 'conflito' : 'alterado' }
    }
    case 'remoto':
      return a.documento === e.documento ? e : comDocumento(e, a.documento, false)
    case 'historico':
      return { ...e, passado: a.passado, futuro: a.futuro }
    case 'sala':
      return { ...e, ...a.patch }
    case 'selecionar':
      // clicar de novo no que já está selecionado (começo de um arraste) não re-renderiza o editor
      return a.ids.length === e.selecao.length && a.ids.every((id, i) => id === e.selecao[i]) ? e : { ...e, selecao: a.ids }
    case 'cena':
      return { ...e, cenaId: a.id, selecao: [] }
    case 'salvamento':
      return { ...e, salvamento: a.valor, revisao: a.revisao ?? e.revisao, salvoEm: a.salvoEm ?? e.salvoEm, conflito: a.conflito === undefined ? e.conflito : a.conflito }
    case 'substituir':
      return { ...e, documento: a.documento, revisao: a.revisao, passado: [], futuro: [], salvamento: 'salvo', conflito: null, selecao: [] }
    default:
      return e
    case 'ui':
      return { ...e, ...a.patch }
  }
}

/** Clona camadas com IDs novos, preservando referências internas (grupos e interações entre elas). */
export function clonarCamadas(camadas: Camada[], existentes: { id: string }[], deslocamento = 0): Camada[] {
  const mapa = new Map<string, string>()
  const usados = [...existentes]
  for (const c of camadas) {
    const id = novoId(c.type, usados)
    usados.push({ id })
    mapa.set(c.id, id)
  }
  const grupos = new Map<string, string>()
  return camadas.map((c, i) => {
    const groupId = c.groupId ? (grupos.get(c.groupId) ?? (grupos.set(c.groupId, novoId('grupo', usados)), grupos.get(c.groupId))) : undefined
    const interactions = c.interactions.map((it) => (it.do.action === 'toggleLayer' || it.do.action === 'animate' || it.do.action === 'toggleVideo') && mapa.has(it.do.targetLayerId) ? ({ ...it, do: { ...it.do, targetLayerId: mapa.get(it.do.targetLayerId)! } } as Interacao) : it)
    const parentId = c.parentId ? (mapa.get(c.parentId) ?? c.parentId) : undefined
    // máscara copiada junto: as cópias recortadas apontam para a cópia da máscara
    const maskId = c.maskId ? (mapa.get(c.maskId) ?? c.maskId) : undefined
    return { ...structuredClone(c), id: mapa.get(c.id)!, groupId, parentId, maskId, interactions, x: c.x + deslocamento, y: c.y + deslocamento, z: 100_000 + i }
  })
}

/** Expande a seleção para incluir todos os membros dos grupos tocados. */
export function expandirGrupos(cena: Cena | undefined, ids: string[]): string[] {
  if (!cena) return ids
  const grupos = new Set(cena.layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId))
  if (!grupos.size) return ids
  return [...new Set([...ids, ...cena.layers.filter((l) => l.groupId && grupos.has(l.groupId)).map((l) => l.id)])]
}

/** Documento e revisão com que o editor abre (EditorShell busca com `dados.abrirProjeto`). */
export interface AberturaEditor { documento: DocumentoProjeto; revisao: number }

/** Com o backend real, o editor entra na sala do projeto (colaboração em tempo real). */
const colaborativo = dados.modo === 'real'

export function useEditor(projetoId: string, abertura: AberturaEditor | null) {
  const inicial = useMemo(() => (abertura ? { documento: abertura.documento, revisao: abertura.revisao, cenaId: abertura.documento.scenes[0]?.id ?? '' } : null), [abertura])

  const [e, dispatch] = useReducer(reducer, inicial, (i: typeof inicial): EstadoEditor => ({
    documento: i?.documento ?? { schemaVersion: 2, mode: 'slides', scenes: [] },
    cenaId: i?.cenaId ?? '',
    selecao: [],
    passado: [],
    futuro: [],
    revisao: i?.revisao ?? 0,
    conexao: colaborativo && i ? 'conectando' : null,
    somenteLeitura: false,
    falhaSala: null,
    salvamento: 'salvo',
    salvoEm: null,
    conflito: null,
    zoom: 0,
    pan: { x: 0, y: 0 },
    grade: false,
    gradePasso: 8,
    snap: true,
    fracoes: true,
    guiasLayout: true,
    reguas: false,
    ferramenta: 'mover',
    abaEsquerda: 'telas',
    abaDireita: 'design',
    mostrarHotspots: true,
    previa: 0,
  }))

  /** Documento local + operações pendentes (a fonte do documento; o estado do React é o espelho). */
  const motorRef = useRef<MotorDocumento | null>(null)
  motorRef.current ??= new MotorDocumento(inicial?.documento ?? e.documento)
  const motor = motorRef.current
  const [sala, setSala] = useState<ConexaoSala | null>(null)
  const salaRef = useRef<ConexaoSala | null>(null)
  const historico = useRef<{ passado: PassoHistorico[]; futuro: PassoHistorico[]; acumulado: PassoHistorico | null }>({ passado: [], futuro: [], acumulado: null })
  const somenteLeituraRef = useRef(false)
  const ultimoSalvo = useRef<DocumentoProjeto | null>(inicial?.documento ?? null)
  const timer = useRef<number | undefined>(undefined)
  const estadoRef = useRef(e)
  estadoRef.current = e
  /** Revisão do servidor para a PRÓXIMA gravação (atualizada na hora, sem esperar o render). */
  const revisaoRef = useRef(inicial?.revisao ?? 0)
  const emConflito = useRef(false)
  /** Fila: gravações nunca correm em paralelo (duas com a mesma base dariam 409 uma na outra). */
  const fila = useRef<Promise<unknown>>(Promise.resolve())
  const areaTransferencia = useRef<Camada[]>([])
  const estiloCopiado = useRef<Partial<Camada> | null>(null)

  // ---------- autosave ----------
  /** true = tudo gravado; false = ficou pendente (sem conexão, falha ou conflito). */
  const salvarUmaVez = useCallback(async (): Promise<boolean> => {
    const atual = estadoRef.current
    if (emConflito.current) return false
    const documento = atual.documento
    if (documento === ultimoSalvo.current) {
      if (atual.salvamento !== 'salvo' && atual.salvamento !== 'conflito') dispatch({ tipo: 'salvamento', valor: 'salvo' })
      return true
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      dispatch({ tipo: 'salvamento', valor: 'offline' })
      return false
    }
    dispatch({ tipo: 'salvamento', valor: 'salvando' })
    try {
      const r = await dados.salvarDocumento(projetoId, documento, revisaoRef.current)
      ultimoSalvo.current = documento
      revisaoRef.current = r.revision
      // editou enquanto gravava: continua "alterado" e o autosave grava de novo
      const mudouDepois = estadoRef.current.documento !== documento
      dispatch({ tipo: 'salvamento', valor: mudouDepois ? 'alterado' : 'salvo', revisao: r.revision, salvoEm: r.savedAt })
      if (mudouDepois) window.setTimeout(() => { void salvarRef.current() }, 0)
      return true
    } catch (err) {
      if (ehErroDados(err, 'conflito_revisao')) {
        emConflito.current = true
        dispatch({ tipo: 'salvamento', valor: 'conflito', conflito: { currentRevision: Number((err.details as { currentRevision?: number } | undefined)?.currentRevision ?? revisaoRef.current) } })
      } else if (ehErroDados(err, 'sem_conexao') || (typeof navigator !== 'undefined' && !navigator.onLine)) dispatch({ tipo: 'salvamento', valor: 'offline' })
      else dispatch({ tipo: 'salvamento', valor: 'falha' })
      return false
    }
  }, [projetoId])
  /** Grava agora (entra na fila); resolve quando esta gravação terminar (true = tudo gravado). */
  const salvarAgora = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current)
    const proxima = fila.current.then(salvarUmaVez, salvarUmaVez)
    fila.current = proxima.then(() => undefined)
    return proxima
  }, [salvarUmaVez])
  const salvarRef = useRef(salvarAgora)
  salvarRef.current = salvarAgora

  useEffect(() => {
    if (colaborativo || e.salvamento !== 'alterado') return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void salvarAgora() }, 800)
    return () => window.clearTimeout(timer.current)
  }, [e.documento, e.salvamento, salvarAgora])

  useEffect(() => {
    if (colaborativo) return
    const online = () => { if (estadoRef.current.salvamento === 'offline' || estadoRef.current.salvamento === 'falha') void salvarAgora() }
    const offline = () => { if (estadoRef.current.salvamento === 'alterado' || estadoRef.current.salvamento === 'salvando') dispatch({ tipo: 'salvamento', valor: 'offline' }) }
    const antesDeSair = (ev: BeforeUnloadEvent) => {
      // a gravação é assíncrona: se ainda há algo por gravar, o navegador pergunta antes de fechar
      void salvarAgora()
      if (estadoRef.current.documento !== ultimoSalvo.current) { ev.preventDefault(); ev.returnValue = '' }
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('beforeunload', antesDeSair)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('beforeunload', antesDeSair); void salvarAgora() }
  }, [salvarAgora])

  // ---------- sala (modo real) ----------
  useEffect(() => {
    if (!colaborativo || !inicial) return
    const s = new ConexaoSala(projetoId, motor, {
      aoDocumento: (documento) => dispatch({ tipo: 'remoto', documento }),
      aoAviso: (texto, tipo) => window.dispatchEvent(new CustomEvent('mostra:aviso-sala', { detail: { texto, tipo } })),
      aoSemSessao: () => { window.location.assign(`/login?${new URLSearchParams({ proximo: `${window.location.pathname}${window.location.search}` })}`) },
    })
    let chave = ''
    const refletir = () => {
      const i = s.instantaneo()
      const conexao = i.conexao
      const salvamento: EstadoSalvamento = conexao === 'online' ? (i.falha ? 'falha' : i.pendente ? 'salvando' : 'salvo') : conexao === 'conectando' ? (i.pendente ? 'salvando' : 'salvo') : 'offline'
      const somenteLeitura = i.papel === 'viewer'
      somenteLeituraRef.current = somenteLeitura
      const nova = [conexao, salvamento, i.revisao, i.salvoEm, somenteLeitura, i.falha].join('|')
      if (nova === chave) return
      chave = nova
      dispatch({ tipo: 'sala', patch: { conexao, salvamento, somenteLeitura, falhaSala: i.falha, ...(i.revisao ? { revisao: i.revisao } : {}), ...(i.salvoEm ? { salvoEm: i.salvoEm } : {}) } })
    }
    const parar = s.assinar(refletir)
    salaRef.current = s
    setSala(s)
    s.conectar()
    // fechar a aba com mudanças ainda não confirmadas pela sala: o navegador pergunta
    const antesDeSair = (ev: BeforeUnloadEvent) => { if (motor.enviados.length || motor.fila.length) { ev.preventDefault(); ev.returnValue = '' } }
    window.addEventListener('beforeunload', antesDeSair)
    return () => {
      window.removeEventListener('beforeunload', antesDeSair)
      parar()
      s.fechar()
      salaRef.current = null
      setSala(null)
    }
  }, [projetoId, inicial, motor])

  // presença: tela e seleção desta aba
  useEffect(() => { sala?.presenca({ cenaId: e.cenaId || null, selecao: e.selecao }) }, [sala, e.cenaId, e.selecao])

  // ---------- helpers ----------
  const publicarHistorico = useCallback(() => {
    const h = historico.current
    dispatch({ tipo: 'historico', passado: h.passado, futuro: h.futuro })
  }, [])

  /** Mudança local: calcula o documento novo, registra as operações (e o desfazer) e avisa a sala. */
  const aplicar = useCallback((fn: (d: DocumentoProjeto) => DocumentoProjeto, comHistorico = true) => {
    if (somenteLeituraRef.current) return
    const antes = motor.local
    const depois = fn(antes)
    if (depois === antes) return
    const fwd = motor.editar(depois)
    if (!colaborativo) motor.substituir(depois)
    const h = historico.current
    if (fwd.length) {
      const inv = diferenca(depois, antes)
      if (comHistorico) {
        h.passado = [...h.passado.slice(-LIMITE_HISTORICO), { fwd, inv }]
        h.futuro = []
        h.acumulado = null
      } else {
        // gesto contínuo (arrastar, digitar): acumula até registrarHistorico
        h.acumulado = h.acumulado ? { fwd: [...h.acumulado.fwd, ...fwd], inv: [...inv, ...h.acumulado.inv] } : { fwd, inv }
      }
    }
    dispatch({ tipo: 'documento', documento: depois })
    if (comHistorico && fwd.length) publicarHistorico()
    salaRef.current?.notificarEdicao()
  }, [motor, publicarHistorico])

  /** Desfazer/refazer: aplica as operações do passo sobre o documento atual (só o que esta pessoa fez). */
  const passoHistorico = useCallback((direcao: 'desfazer' | 'refazer') => {
    if (somenteLeituraRef.current) return
    const h = historico.current
    h.acumulado = null
    const passo = direcao === 'desfazer' ? h.passado[h.passado.length - 1] : h.futuro[0]
    if (!passo) return
    if (direcao === 'desfazer') { h.passado = h.passado.slice(0, -1); h.futuro = [passo, ...h.futuro] }
    else { h.futuro = h.futuro.slice(1); h.passado = [...h.passado, passo] }
    const antes = motor.local
    const depois = aplicarOps(antes, direcao === 'desfazer' ? passo.inv : passo.fwd)
    if (depois !== antes) {
      motor.editar(depois)
      if (!colaborativo) motor.substituir(depois)
      dispatch({ tipo: 'documento', documento: depois, desfeito: true })
      salaRef.current?.notificarEdicao()
    }
    publicarHistorico()
  }, [motor, publicarHistorico])
  const cena = e.documento.scenes.find((s) => s.id === e.cenaId) ?? e.documento.scenes[0]
  const indiceCena = cena ? e.documento.scenes.indexOf(cena) : -1
  const camadasSelecionadas = useMemo(() => (cena ? cena.layers.filter((l) => e.selecao.includes(l.id)) : []), [cena, e.selecao])
  const cenaAtualRef = useCallback(() => motor.local.scenes.find((s) => s.id === estadoRef.current.cenaId), [motor])

  /** Toda edição da tela passa pelo resolvedor de frames/auto layout (lib/editor/autolayout.ts). */
  const atualizarCenaAtual = useCallback(
    (fn: (c: Cena) => Cena, historico = true, opcoes?: OpcoesResolver) =>
      aplicar((d) => ({
        ...d,
        scenes: d.scenes.map((s) => {
          if (s.id !== estadoRef.current.cenaId) return s
          const n = fn(s)
          if (n === s) return s
          const layers = resolverCamadas(s.layers, n.layers, opcoes)
          return layers === n.layers ? n : { ...n, layers }
        }),
      }), historico),
    [aplicar]
  )

  const acoes = useMemo(() => {
    const ui = (patch: Extract<Acao, { tipo: 'ui' }>['patch']) => dispatch({ tipo: 'ui', patch })

    const inserirCamadas = (novas: Camada[]) => {
      atualizarCenaAtual((c) => ({ ...c, layers: normalizarZ([...c.layers, ...novas]) }))
      dispatch({ tipo: 'selecionar', ids: novas.map((n) => n.id) })
    }

    /** Cria uma camada com defaults do schema no centro da tela (ou no retângulo dado). */
    const criarCamada = (parcial: Record<string, unknown> & { type: Camada['type'] }, rect?: { x: number; y: number; width: number; height: number }, opcoes: { historico?: boolean } = {}) => {
      const c = cenaAtualRef()
      if (!c) return null
      const id = novoId(parcial.type, c.layers)
      const z = c.layers.length ? Math.max(...c.layers.map((l) => l.z)) + 1 : 0
      const padrao = rect ?? { x: c.size.width * 0.3, y: c.size.height * 0.35, width: c.size.width * 0.4, height: c.size.height * 0.2 }
      const extras: Record<string, unknown> = {
        text: { text: 'Digite seu texto', fontSize: Math.round(c.size.width / 26), color: '#171717' },
        shape: { fill: '#5965F2' },
        hotspot: { ariaLabel: 'Área clicável', hint: true },
        image: {},
        video: {},
        svg: {},
        model3d: {},
        lottie: {},
        embed: { radius: 12 },
        frame: { fill: '#FFFFFF' },
      }[parcial.type] as Record<string, unknown>
      try {
        const camada = parseCamada({ id, z, ...padrao, ...extras, ...parcial })
        if (opcoes.historico === false) {
          atualizarCenaAtual((cc) => ({ ...cc, layers: normalizarZ([...cc.layers, camada]) }), false)
          dispatch({ tipo: 'selecionar', ids: [camada.id] })
        } else inserirCamadas([camada])
        return camada
      } catch {
        return null
      }
    }

    /** Envolve a seleção num frame (com ou sem auto layout) ou liga o auto layout num frame existente. */
    const emoldurar = (ids: string[], comLayout: boolean) => {
      const c = cenaAtualRef()
      if (!c || !ids.length) return
      const raizes = raizesDaSelecao(ids, c.layers)
      const sel = c.layers.filter((l) => raizes.includes(l.id))
      const unico = sel.length === 1 ? sel[0]! : undefined
      if (comLayout && unico && ehFrame(unico) && !unico.layout) {
        const filhos = filhosDe(unico.id, c.layers)
        const { layout, ordem } = inferirLayout(filhos)
        const caixa = filhos.length ? envolvente(filhos) : null
        const padding = caixa
          ? { top: Math.max(0, Math.round(caixa.y - unico.y)), left: Math.max(0, Math.round(caixa.x - unico.x)), right: Math.max(0, Math.round(unico.x + unico.width - caixa.x - caixa.width)), bottom: Math.max(0, Math.round(unico.y + unico.height - caixa.y - caixa.height)) }
          : layout.padding
        const zOrdem = new Map(ordem.map((i, k) => [filhos[i]!.id, k]))
        atualizarCenaAtual((cc) => ({ ...cc, layers: cc.layers.map((l) => (l.id === unico.id ? ({ ...l, layout: { ...layout, padding }, sizingW: 'hug', sizingH: 'hug' } as Camada) : zOrdem.has(l.id) ? ({ ...l, z: zOrdem.get(l.id)! } as Camada) : l)) }))
        return
      }
      const mapa = mapaDe(c.layers)
      const paiPrimeiro = sel[0] ? paiDe(sel[0], mapa)?.id : undefined
      const paiId = sel.every((l) => paiDe(l, mapa)?.id === paiPrimeiro) ? paiPrimeiro : undefined
      const caixa = envolvente(sel)
      const id = novoId('frame', c.layers)
      const { layout, ordem } = inferirLayout(sel)
      const minZ = Math.min(...sel.map((l) => l.z))
      const frame = parseCamada({
        id, type: 'frame', name: comLayout ? 'Auto layout' : 'Frame', z: Math.floor(minZ),
        x: Math.round(caixa.x), y: Math.round(caixa.y), width: Math.max(1, Math.round(caixa.width)), height: Math.max(1, Math.round(caixa.height)),
        ...(paiId ? { parentId: paiId } : {}),
        ...(comLayout ? { layout, sizingW: 'hug', sizingH: 'hug' } : {}),
      }) as CamadaFrame
      const posicao = new Map(ordem.map((i, k) => [sel[i]!.id, k]))
      atualizarCenaAtual((cc) => ({
        ...cc,
        layers: [...cc.layers.map((l) => (posicao.has(l.id) ? ({ ...l, parentId: id, z: comLayout ? posicao.get(l.id)! : l.z } as Camada) : l)), frame],
      }))
      dispatch({ tipo: 'selecionar', ids: [id] })
    }

    return {
      selecionar: (ids: string[]) => dispatch({ tipo: 'selecionar', ids: expandirGrupos(cenaAtualRef(), ids) }),
      selecionarExato: (ids: string[]) => dispatch({ tipo: 'selecionar', ids }),
      irParaCena: (id: string) => dispatch({ tipo: 'cena', id }),
      desfazer: () => passoHistorico('desfazer'),
      refazer: () => passoHistorico('refazer'),
      /** Fim de um gesto contínuo (feito com historico=false): vira um passo de desfazer. */
      registrarHistorico: (anterior: DocumentoProjeto) => {
        const h = historico.current
        if (!h.acumulado || anterior === motor.local) { h.acumulado = null; return }
        h.passado = [...h.passado.slice(-LIMITE_HISTORICO), { fwd: compactar(h.acumulado.fwd), inv: compactar(h.acumulado.inv) }]
        h.futuro = []
        h.acumulado = null
        publicarHistorico()
      },
      documentoAtual: () => motor.local,
      ui,
      setZoom: (zoom: number) => ui({ zoom }),
      ajustar: () => ui({ zoom: 0, pan: { x: 0, y: 0 } }),
      setFerramenta: (ferramenta: Ferramenta) => ui({ ferramenta }),
      reproduzirPrevia: () => ui({ previa: estadoRef.current.previa + 1 }),
      /** Grava agora (modo real: a sala confirma e grava no banco). true = tudo gravado. */
      salvarAgora: (): Promise<boolean> => (salaRef.current ? salaRef.current.salvarAgora() : salvarAgora()),
      /** Revisão que o servidor tem agora (a base da próxima gravação/publicação). */
      revisaoAtual: () => (salaRef.current ? salaRef.current.instantaneo().revisao || revisaoRef.current : revisaoRef.current),

      // ----- conflito -----
      /** Descarta as mudanças desta sessão e abre a versão mais recente do servidor. */
      recarregarDoServidor: async () => {
        const p = await dados.abrirProjeto(projetoId, { forcar: true })
        if (!p) return false
        ultimoSalvo.current = p.documento
        revisaoRef.current = p.revisaoAtual
        emConflito.current = false
        motor.substituir(p.documento)
        historico.current = { passado: [], futuro: [], acumulado: null }
        dispatch({ tipo: 'substituir', documento: p.documento, revisao: p.revisaoAtual })
        return true
      },
      /** Grava a versão desta sessão por cima da mais recente (passa a valer a revisão atual do servidor). */
      manterMinhaVersao: () => {
        const r = estadoRef.current.conflito?.currentRevision ?? revisaoRef.current
        revisaoRef.current = r
        emConflito.current = false
        dispatch({ tipo: 'salvamento', valor: 'alterado', revisao: r, conflito: null })
      },

      // ----- telas -----
      adicionarCena: (apos?: number) =>
        aplicar((d) => {
          const idx = apos ?? d.scenes.length - 1
          const base = d.scenes[idx] ?? d.scenes[0]
          const size = base?.size ?? (d.mode === 'story' ? FORMATOS.story : FORMATOS.slides169)
          const nova = novaCena({ id: novoId('tela', d.scenes), title: `Tela ${d.scenes.length + 1}`, size, background: base?.background ?? '#FAFAF9', ...(d.mode === 'explorar' && base?.map ? { map: { x: base.map.x + size.width + 360, y: base.map.y } } : {}) })
          const scenes = [...d.scenes]
          scenes.splice(idx + 1, 0, nova)
          queueMicrotask(() => dispatch({ tipo: 'cena', id: nova.id }))
          return { ...d, scenes }
        }),
      duplicarCena: (id: string) =>
        aplicar((d) => {
          const i = d.scenes.findIndex((s) => s.id === id)
          const orig = d.scenes[i]
          if (!orig) return d
          const copia: Cena = { ...structuredClone(orig), id: novoId('tela', d.scenes), title: `${orig.title || 'Tela'} (cópia)`, ...(orig.map ? { map: { x: orig.map.x + 200, y: orig.map.y + 200 } } : {}) }
          const scenes = [...d.scenes]
          scenes.splice(i + 1, 0, copia)
          queueMicrotask(() => dispatch({ tipo: 'cena', id: copia.id }))
          return { ...d, scenes }
        }),
      removerCena: (id: string) => aplicar((d) => (d.scenes.length <= 1 ? d : { ...d, scenes: d.scenes.filter((s) => s.id !== id) })),
      moverCena: (de: number, para: number) => aplicar((d) => ({ ...d, scenes: moverCena(d.scenes, de, para) })),
      atualizarCena: (patch: Partial<Cena>, historico = true) => atualizarCenaAtual((c) => ({ ...c, ...patch }), historico),
      /** Transformação livre da tela atual num único passo de desfazer (preencher em grade, dividir, vetores). */
      transformarCena: (fn: (c: Cena) => Cena, historico = true, opcoes?: OpcoesResolver) => atualizarCenaAtual(fn, historico, opcoes),
      atualizarDocumento: (patch: Partial<Pick<DocumentoProjeto, 'theme' | 'mode'>>) => aplicar((d) => ({ ...d, ...patch })),
      /** Transformação do documento inteiro (ex.: estilos de cor que atualizam camadas de várias telas). */
      transformarDocumento: (fn: (d: DocumentoProjeto) => DocumentoProjeto, historico = true) => aplicar(fn, historico),
      /** Uma tela por mídia (importação em lote). */
      cenasDeAssets: (assets: AssetDemo[]) =>
        aplicar((d) => {
          const base = d.scenes[d.scenes.length - 1]
          const size = base?.size ?? FORMATOS.slides169
          const novas: Cena[] = []
          for (const a of assets) {
            const r = enquadrarNaCena({ width: a.width ?? size.width, height: a.height ?? size.height }, size)
            const tipo = a.tipo === 'video' ? 'video' : a.tipo === 'model3d' ? 'model3d' : a.tipo === 'lottie' ? 'lottie' : a.tipo === 'svg' ? 'svg' : 'image'
            const camada = parseCamada({ id: 'midia', type: tipo, assetId: a.id, x: r.x, y: r.y, width: r.width, height: r.height, ...(tipo === 'image' ? { fit: 'contain' } : {}) })
            novas.push(novaCena({ id: novoId('tela', [...d.scenes, ...novas]), title: a.nome.replace(/\.[^.]+$/, ''), size, background: base?.background ?? '#FAFAF9', layers: [camada] }))
          }
          const scenes = d.scenes.length === 1 && d.scenes[0]!.layers.length === 0 ? novas : [...d.scenes, ...novas]
          if (novas[0]) queueMicrotask(() => dispatch({ tipo: 'cena', id: novas[0]!.id }))
          return { ...d, scenes }
        }),

      // ----- camadas -----
      criarCamada,
      inserirCamadas,
      adicionarAsset: (asset: AssetDemo, ponto?: { x: number; y: number }) => {
        const c = cenaAtualRef()
        if (!c) return
        const tipo = asset.tipo === 'video' ? 'video' : asset.tipo === 'model3d' ? 'model3d' : asset.tipo === 'lottie' ? 'lottie' : asset.tipo === 'svg' ? 'svg' : 'image'
        const tam = tipo === 'model3d' ? { width: c.size.height * 0.7, height: c.size.height * 0.7 } : { width: asset.width ?? c.size.width * 0.4, height: asset.height ?? c.size.height * 0.4 }
        const r = enquadrarNaCena(tam, c.size, Math.min(c.size.width, c.size.height) * 0.15)
        const rect = ponto ? { ...r, x: ponto.x - r.width / 2, y: ponto.y - r.height / 2 } : r
        return criarCamada({ type: tipo, assetId: asset.id, name: asset.nome.replace(/\.[^.]+$/, '').slice(0, 80) }, rect)
      },
      atualizarCamadas: (ids: string[], patch: Partial<Camada> | ((l: Camada) => Camada), historico = true, opcoes?: OpcoesResolver) =>
        atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (typeof patch === 'function' ? patch(l) : ({ ...l, ...patch } as Camada)) : l)) }), historico, opcoes),
      /** Excluir um frame exclui o conteúdo (como no Figma). */
      removerCamadas: (ids: string[], historico = true) => atualizarCenaAtual((c) => { const todos = new Set(comDescendentes(ids, c.layers)); return { ...c, layers: c.layers.filter((l) => !todos.has(l.id)) } }, historico),
      duplicarCamadas: (ids: string[]) => {
        const c = cenaAtualRef()
        if (!c) return
        const raizes = raizesDaSelecao(ids, c.layers)
        const todos = new Set(comDescendentes(raizes, c.layers))
        const originais = c.layers.filter((l) => todos.has(l.id))
        const copias = clonarCamadas(originais, c.layers, 24)
        atualizarCenaAtual((cc) => ({ ...cc, layers: normalizarZ([...cc.layers, ...copias]) }))
        dispatch({ tipo: 'selecionar', ids: originais.map((l, i) => (raizes.includes(l.id) ? copias[i]!.id : '')).filter(Boolean) })
      },
      /**
       * ⌥+arrastar: insere cópias (sem histórico — o gesto registra um único desfazer ao soltar) no mesmo lugar
       * e devolve o mapa id original → id da cópia. `ids` deve incluir os descendentes dos frames.
       */
      duplicarParaArrastar: (ids: string[]): Map<string, string> | null => {
        const c = cenaAtualRef()
        if (!c) return null
        const originais = c.layers.filter((l) => ids.includes(l.id))
        if (!originais.length) return null
        const copias = clonarCamadas(originais, c.layers, 0)
        atualizarCenaAtual((cc) => ({ ...cc, layers: normalizarZ([...cc.layers, ...copias]) }), false)
        return new Map(originais.map((l, i) => [l.id, copias[i]!.id]))
      },
      ordem: (id: string, op: 'frente' | 'tras' | 'avancar' | 'recuar') =>
        atualizarCenaAtual((c) => ({ ...c, layers: op === 'frente' ? trazerParaFrente(c.layers, id) : op === 'tras' ? enviarParaTras(c.layers, id) : op === 'avancar' ? avancarUm(c.layers, id) : recuarUm(c.layers, id) })),
      /** Reordena pelo painel de camadas (lista de cima para baixo = maior z primeiro). */
      reordenarCamadas: (idsDeCimaParaBaixo: string[]) =>
        atualizarCenaAtual((c) => {
          const n = idsDeCimaParaBaixo.length
          const z = new Map(idsDeCimaParaBaixo.map((id, i) => [id, n - 1 - i]))
          return { ...c, layers: c.layers.map((l) => ({ ...l, z: z.get(l.id) ?? l.z })) }
        }),
      alinhar: (ids: string[], modo: Alinhamento) =>
        atualizarCenaAtual((c) => {
          const novos = alinharRects(c.layers.filter((l) => ids.includes(l.id)), c.size, modo)
          return { ...c, layers: c.layers.map((l) => novos.find((n) => n.id === l.id) ?? l) }
        }),
      distribuir: (ids: string[], eixo: 'h' | 'v') =>
        atualizarCenaAtual((c) => {
          const novos = distribuirRects(c.layers.filter((l) => ids.includes(l.id)), eixo)
          return { ...c, layers: c.layers.map((l) => novos.find((n) => n.id === l.id) ?? l) }
        }),
      deslocar: (ids: string[], dx: number, dy: number) => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) && !l.locked ? { ...l, x: Math.round(l.x + dx), y: Math.round(l.y + dy) } : l)) })),
      agrupar: (ids: string[]) => {
        if (ids.length < 2) return
        const c = cenaAtualRef()
        const groupId = novoId('grupo', c?.layers ?? [])
        atualizarCenaAtual((cc) => ({ ...cc, layers: cc.layers.map((l) => (ids.includes(l.id) ? { ...l, groupId } : l)) }))
      },
      /** Desagrupa grupos e desfaz frames selecionados (filhos sobem para o pai do frame), como ⇧⌘G no Figma. */
      desagrupar: (ids: string[]) => {
        const c = cenaAtualRef()
        if (!c) return
        const frames = new Map(c.layers.filter((l) => ids.includes(l.id) && l.type === 'frame').map((f) => [f.id, f]))
        atualizarCenaAtual((cc) => ({
          ...cc,
          layers: normalizarZ(
            cc.layers
              .filter((l) => !frames.has(l.id))
              .map((l) => {
                let n = ids.includes(l.id) ? ({ ...l, groupId: undefined } as Camada) : l
                const f = l.parentId ? frames.get(l.parentId) : undefined
                if (f) n = { ...n, parentId: f.parentId, absolute: undefined, sizingW: n.sizingW === 'fill' ? 'fixed' : n.sizingW, sizingH: n.sizingH === 'fill' ? 'fixed' : n.sizingH, z: f.z + (n.z - f.z) / 10_000 } as Camada
                return n
              })
          ),
        }))
        if (frames.size) dispatch({ tipo: 'selecionar', ids: c.layers.filter((l) => l.parentId && frames.has(l.parentId)).map((l) => l.id) })
      },

      // ----- frames e auto layout -----
      /**
       * ⇧A: num frame sem auto layout, liga o auto layout; senão envolve a seleção num frame novo
       * com auto layout (direção, gap e alinhamento inferidos do arranjo), abraçando o conteúdo.
       */
      adicionarAutoLayout: (ids: string[]) => emoldurar(ids, true),
      /** ⌥⌘G: envolve a seleção num frame (sem auto layout). */
      emoldurar: (ids: string[]) => emoldurar(ids, false),
      removerAutoLayout: (id: string) =>
        atualizarCenaAtual((c) => ({
          ...c,
          layers: c.layers.map((l) =>
            l.id === id && l.type === 'frame'
              ? ({ ...l, layout: undefined, sizingW: l.sizingW === 'hug' ? 'fixed' : l.sizingW, sizingH: l.sizingH === 'hug' ? 'fixed' : l.sizingH } as Camada)
              : l.parentId === id
                ? ({ ...l, absolute: undefined, sizingW: l.sizingW === 'fill' ? 'fixed' : l.sizingW, sizingH: l.sizingH === 'fill' ? 'fixed' : l.sizingH } as Camada)
                : l
          ),
        })),
      atualizarLayout: (id: string, patch: Partial<AutoLayout>, historico = true) =>
        atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (l.id === id && l.type === 'frame' ? ({ ...l, layout: { ...LAYOUT_PADRAO, ...l.layout, ...patch } } as Camada) : l)) }), historico),
      /** Coloca a camada dentro de um frame (na posição `indice` do fluxo) ou na raiz da tela (frameId undefined); `posicao` move junto com os descendentes. */
      inserirNoFrame: (id: string, frameId: string | undefined, indice?: number, posicao?: { x: number; y: number }, historico = true) =>
        atualizarCenaAtual((c) => {
          const original = c.layers.find((l) => l.id === id)
          if (!original) return c
          const dx = posicao ? Math.round(posicao.x) - original.x : 0
          const dy = posicao ? Math.round(posicao.y) - original.y : 0
          const mover = new Set(dx || dy ? comDescendentes([id], c.layers) : [])
          const base = mover.size ? c.layers.map((l) => (mover.has(l.id) ? ({ ...l, x: l.x + dx, y: l.y + dy } as Camada) : l)) : c.layers
          const r = inserirNoFrameFn(base, id, frameId, indice)
          if (r === base) return mover.size ? { ...c, layers: base } : c
          const alvo = frameId ? c.layers.find((l) => l.id === frameId) : undefined
          const semLayout = !(alvo?.type === 'frame' && alvo.layout)
          return { ...c, layers: r.map((l) => (l.id === id && semLayout ? ({ ...l, absolute: undefined, sizingW: l.sizingW === 'fill' ? 'fixed' : l.sizingW, sizingH: l.sizingH === 'fill' ? 'fixed' : l.sizingH } as Camada) : l)) }
        }, historico),
      /** Painel de camadas: soltar acima/abaixo de outra camada (mesmo pai) ou dentro de um frame. */
      moverNaLista: (id: string, alvoId: string, onde: 'acima' | 'abaixo' | 'dentro') => atualizarCenaAtual((c) => ({ ...c, layers: moverNaListaFn(c.layers, id, alvoId, onde) })),
      /** Enter: seleciona os filhos do frame; Shift+Enter: seleciona o pai. */
      selecionarFilhos: (id: string) => {
        const c = cenaAtualRef()
        const f = c ? filhosDe(id, c.layers) : []
        if (f.length) dispatch({ tipo: 'selecionar', ids: f.map((x) => x.id) })
      },
      selecionarPai: (id: string) => {
        const c = cenaAtualRef()
        const l = c?.layers.find((x) => x.id === id)
        const p = c && l ? paiDe(l, mapaDe(c.layers)) : undefined
        if (p) dispatch({ tipo: 'selecionar', ids: [p.id] })
      },
      /**
       * ⌃⌘M (como no Figma): a camada de baixo da seleção vira máscara das demais; se a seleção já tem
       * máscara, remove. Devolve 'criada' | 'removida' | null (seleção sem forma que sirva de máscara).
       */
      alternarMascara: (ids: string[]): 'criada' | 'removida' | null => {
        const c = cenaAtualRef()
        if (!c || !ids.length) return null
        const sel = c.layers.filter((l) => ids.includes(l.id))
        if (sel.some((l) => ehMascara(l) || l.maskId)) {
          atualizarCenaAtual((cc) => ({ ...cc, layers: removerMascara(cc.layers, ids) }))
          return 'removida'
        }
        const raizes = raizesDaSelecao(ids, c.layers)
        const r = criarMascara(c.layers, raizes, comDescendentes(raizes, c.layers), novoId('grupo', c.layers))
        if (!r) return null
        atualizarCenaAtual((cc) => ({ ...cc, layers: r }))
        return 'criada'
      },
      inverter: (ids: string[], eixo: 'x' | 'y') => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (eixo === 'x' ? { ...l, flipX: !l.flipX } : { ...l, flipY: !l.flipY }) : l)) })),

      // ----- área de transferência -----
      copiar: (ids: string[]) => {
        const c = cenaAtualRef()
        if (!c) return []
        const todos = new Set(comDescendentes(ids, c.layers)) // frame copiado leva o conteúdo
        const camadas = c.layers.filter((l) => todos.has(l.id))
        areaTransferencia.current = structuredClone(camadas)
        return camadas
      },
      /** Cola camadas (da Mostra) na tela atual; desloca se ainda estiverem sobrepostas às originais. */
      colarCamadas: (brutas?: unknown[]) => {
        const c = cenaAtualRef()
        if (!c) return
        const origem = brutas ?? areaTransferencia.current
        const validas: Camada[] = []
        for (const b of origem) {
          try { validas.push(parseCamada(b)) } catch { /* ignora camada inválida */ }
        }
        if (!validas.length) return
        const sobrepoe = validas.some((v) => c.layers.some((l) => l.x === v.x && l.y === v.y && l.width === v.width))
        inserirCamadas(clonarCamadas(validas, c.layers, sobrepoe ? 24 : 0))
      },
      copiarEstilo: (camada: Camada) => {
        const { id: _i, x: _x, y: _y, width: _w, height: _h, z: _z, name: _n, interactions: _it, groupId: _g, parentId: _p, absolute: _a, ...estilo } = camada as Camada & Record<string, unknown>
        estiloCopiado.current = estilo as Partial<Camada>
      },
      colarEstilo: (ids: string[]) => {
        const est = estiloCopiado.current
        if (!est) return
        atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (() => { try { return parseCamada({ ...l, ...est, type: l.type, ...(l.type === 'image' || l.type === 'video' || l.type === 'model3d' ? { assetId: (l as { assetId: string }).assetId } : {}), ...(l.type === 'text' ? { text: l.text } : {}) }) } catch { return l } })() : l)) }))
      },
      temEstiloCopiado: () => !!estiloCopiado.current,
    }
  }, [aplicar, atualizarCenaAtual, projetoId, salvarAgora, passoHistorico, publicarHistorico, motor, cenaAtualRef])

  // mídias do workspace (no modo real chegam do servidor; antes disso não acusa mídia "inexistente")
  const assetsLista = useDados((s) => s.assets)
  const assetsProntos = useDados((s) => s.situacao.assets.estado === 'pronto')
  /** Validação completa (schema + referências) do documento atual, na hora (ex.: antes de publicar). */
  const validarAgora = useCallback((): ResultadoValidacao => validarDocumento(motor.local, assetsProntos ? { assetsExistentes: new Set(assetsLista.map((a) => a.id)) } : {}), [motor, assetsLista, assetsProntos])
  // a validação percorre o documento inteiro (schema): roda quando a edição para, não a cada quadro de um arraste
  const [validacao, setValidacao] = useState<ResultadoValidacao>(() => validarAgora())
  useEffect(() => {
    const t = window.setTimeout(() => setValidacao(validarAgora()), 250)
    return () => window.clearTimeout(t)
  }, [e.documento, validarAgora])

  // objeto estável entre renders sem mudança (menus, modais e o zoom do rodapé não re-renderizam os painéis)
  const existe = !!inicial
  return useMemo(() => ({ estado: e, cena, indiceCena, camadasSelecionadas, acoes, validacao, validarAgora, existe, projetoId, sala }), [e, cena, indiceCena, camadasSelecionadas, acoes, validacao, validarAgora, existe, projetoId, sala])
}

/**
 * Para `memo` dos painéis: o editor mudou em algo além do enquadramento do canvas (zoom e pan, que só o canvas
 * usa)? Assim rolar e dar zoom não re-renderiza telas, camadas e inspetor.
 */
export function mesmoEditorForaDoCanvas(a: Editor, b: Editor): boolean {
  if (a === b) return true
  if (a.cena !== b.cena || a.indiceCena !== b.indiceCena || a.camadasSelecionadas !== b.camadasSelecionadas || a.acoes !== b.acoes || a.validacao !== b.validacao || a.sala !== b.sala || a.existe !== b.existe || a.projetoId !== b.projetoId || a.validarAgora !== b.validarAgora) return false
  for (const k of Object.keys(a.estado) as (keyof EstadoEditor)[]) if (k !== 'zoom' && k !== 'pan' && a.estado[k] !== b.estado[k]) return false
  return true
}

export type Editor = ReturnType<typeof useEditor>
