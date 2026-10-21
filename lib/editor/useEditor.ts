'use client'
/**
 * Estado do editor: documento + seleção + histórico (desfazer/refazer) + autosave com revisão + ferramentas.
 * Regras: autosave com debounce de 800 ms e ao sair; cada gravação leva baseRevision; 409 preserva mudanças
 * locais e mostra conflito; desfazer/refazer por comandos na sessão (gestos contínuos viram uma entrada).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { FORMATOS, novaCena, parseCamada, type Camada, type Cena, type DocumentoProjeto, type Interacao } from '@/lib/scene/schema'
import { validarDocumento, type ResultadoValidacao } from '@/lib/scene/validate'
import { moverCena, normalizarZ, novoId, trazerParaFrente, enviarParaTras, avancarUm, recuarUm } from '@/lib/scene/order'
import { alinhar as alinharRects, enquadrarNaCena, type Alinhamento } from '@/lib/scene/transform'
import { distribuir as distribuirRects } from './guias'
import { ErroDemo, salvarDocumento, obterProjeto, mapaAssets } from '@/lib/demo/store'
import type { AssetDemo } from '@/lib/demo/tipos'

export type EstadoSalvamento = 'salvo' | 'alterado' | 'salvando' | 'offline' | 'falha' | 'conflito'
export type Ferramenta = 'mover' | 'mao' | 'texto' | 'forma' | 'hotspot'
export type AbaEsquerda = 'telas' | 'camadas' | 'arquivos' | 'blocos'
export type AbaDireita = 'design' | 'animacao' | 'interacoes'

export interface EstadoEditor {
  documento: DocumentoProjeto
  cenaId: string
  selecao: string[]
  passado: DocumentoProjeto[]
  futuro: DocumentoProjeto[]
  revisao: number
  salvamento: EstadoSalvamento
  salvoEm: string | null
  conflito: { currentRevision: number } | null
  /** 0 = ajustar à tela */
  zoom: number
  pan: { x: number; y: number }
  grade: boolean
  snap: boolean
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
  | { tipo: 'documento'; fn: (d: DocumentoProjeto) => DocumentoProjeto; historico: boolean }
  | { tipo: 'marcarHistorico'; anterior: DocumentoProjeto }
  | { tipo: 'desfazer' }
  | { tipo: 'refazer' }
  | { tipo: 'selecionar'; ids: string[] }
  | { tipo: 'cena'; id: string }
  | { tipo: 'salvamento'; valor: EstadoSalvamento; revisao?: number; salvoEm?: string; conflito?: { currentRevision: number } | null }
  | { tipo: 'substituir'; documento: DocumentoProjeto; revisao: number }
  | { tipo: 'ui'; patch: Partial<Pick<EstadoEditor, 'zoom' | 'pan' | 'grade' | 'snap' | 'reguas' | 'ferramenta' | 'abaEsquerda' | 'abaDireita' | 'mostrarHotspots' | 'previa'>> }

const LIMITE_HISTORICO = 150

function reducer(e: EstadoEditor, a: Acao): EstadoEditor {
  switch (a.tipo) {
    case 'documento': {
      const novo = a.fn(e.documento)
      if (novo === e.documento) return e
      const cenaExiste = novo.scenes.some((s) => s.id === e.cenaId)
      return {
        ...e,
        documento: novo,
        cenaId: cenaExiste ? e.cenaId : (novo.scenes[0]?.id ?? e.cenaId),
        passado: a.historico ? [...e.passado.slice(-LIMITE_HISTORICO), e.documento] : e.passado,
        futuro: a.historico ? [] : e.futuro,
        salvamento: e.salvamento === 'conflito' ? 'conflito' : 'alterado',
        selecao: e.selecao.filter((id) => novo.scenes.some((s) => s.layers.some((l) => l.id === id))),
      }
    }
    case 'marcarHistorico':
      if (a.anterior === e.documento) return e
      return { ...e, passado: [...e.passado.slice(-LIMITE_HISTORICO), a.anterior], futuro: [] }
    case 'desfazer': {
      const ant = e.passado[e.passado.length - 1]
      if (!ant) return e
      return { ...e, documento: ant, passado: e.passado.slice(0, -1), futuro: [e.documento, ...e.futuro], salvamento: 'alterado', selecao: [], cenaId: ant.scenes.some((s) => s.id === e.cenaId) ? e.cenaId : (ant.scenes[0]?.id ?? '') }
    }
    case 'refazer': {
      const prox = e.futuro[0]
      if (!prox) return e
      return { ...e, documento: prox, passado: [...e.passado, e.documento], futuro: e.futuro.slice(1), salvamento: 'alterado', selecao: [], cenaId: prox.scenes.some((s) => s.id === e.cenaId) ? e.cenaId : (prox.scenes[0]?.id ?? '') }
    }
    case 'selecionar':
      return { ...e, selecao: a.ids }
    case 'cena':
      return { ...e, cenaId: a.id, selecao: [] }
    case 'salvamento':
      return { ...e, salvamento: a.valor, revisao: a.revisao ?? e.revisao, salvoEm: a.salvoEm ?? e.salvoEm, conflito: a.conflito === undefined ? e.conflito : a.conflito }
    case 'substituir':
      return { ...e, documento: a.documento, revisao: a.revisao, passado: [], futuro: [], salvamento: 'salvo', conflito: null, selecao: [] }
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
    return { ...structuredClone(c), id: mapa.get(c.id)!, groupId, interactions, x: c.x + deslocamento, y: c.y + deslocamento, z: 100_000 + i }
  })
}

/** Expande a seleção para incluir todos os membros dos grupos tocados. */
export function expandirGrupos(cena: Cena | undefined, ids: string[]): string[] {
  if (!cena) return ids
  const grupos = new Set(cena.layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId))
  if (!grupos.size) return ids
  return [...new Set([...ids, ...cena.layers.filter((l) => l.groupId && grupos.has(l.groupId)).map((l) => l.id)])]
}

export function useEditor(projetoId: string) {
  const inicial = useMemo(() => {
    const p = obterProjeto(projetoId)
    if (!p) return null
    return { documento: p.documento, revisao: p.revisaoAtual, cenaId: p.documento.scenes[0]?.id ?? '' }
  }, [projetoId])

  const [e, dispatch] = useReducer(reducer, inicial, (i: typeof inicial): EstadoEditor => ({
    documento: i?.documento ?? { schemaVersion: 2, mode: 'slides', scenes: [] },
    cenaId: i?.cenaId ?? '',
    selecao: [],
    passado: [],
    futuro: [],
    revisao: i?.revisao ?? 0,
    salvamento: 'salvo',
    salvoEm: null,
    conflito: null,
    zoom: 0,
    pan: { x: 0, y: 0 },
    grade: false,
    snap: true,
    reguas: false,
    ferramenta: 'mover',
    abaEsquerda: 'telas',
    abaDireita: 'design',
    mostrarHotspots: true,
    previa: 0,
  }))

  const ultimoSalvo = useRef<DocumentoProjeto | null>(inicial?.documento ?? null)
  const timer = useRef<number | undefined>(undefined)
  const estadoRef = useRef(e)
  estadoRef.current = e
  const areaTransferencia = useRef<Camada[]>([])
  const estiloCopiado = useRef<Partial<Camada> | null>(null)

  // ---------- autosave ----------
  const salvarAgora = useCallback(() => {
    const atual = estadoRef.current
    if (atual.salvamento === 'conflito') return
    if (atual.documento === ultimoSalvo.current) {
      if (atual.salvamento !== 'salvo') dispatch({ tipo: 'salvamento', valor: 'salvo' })
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      dispatch({ tipo: 'salvamento', valor: 'offline' })
      return
    }
    dispatch({ tipo: 'salvamento', valor: 'salvando' })
    try {
      const r = salvarDocumento(projetoId, atual.documento, atual.revisao)
      ultimoSalvo.current = atual.documento
      dispatch({ tipo: 'salvamento', valor: 'salvo', revisao: r.revision, salvoEm: r.savedAt })
    } catch (err) {
      if (err instanceof ErroDemo && err.code === 'conflito_revisao') dispatch({ tipo: 'salvamento', valor: 'conflito', conflito: err.details as { currentRevision: number } })
      else dispatch({ tipo: 'salvamento', valor: 'falha' })
    }
  }, [projetoId])

  useEffect(() => {
    if (e.salvamento !== 'alterado') return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(salvarAgora, 800)
    return () => window.clearTimeout(timer.current)
  }, [e.documento, e.salvamento, salvarAgora])

  useEffect(() => {
    const online = () => { if (estadoRef.current.salvamento === 'offline' || estadoRef.current.salvamento === 'falha') salvarAgora() }
    const antesDeSair = (ev: BeforeUnloadEvent) => {
      salvarAgora()
      if (estadoRef.current.documento !== ultimoSalvo.current) { ev.preventDefault(); ev.returnValue = '' }
    }
    window.addEventListener('online', online)
    window.addEventListener('beforeunload', antesDeSair)
    return () => { window.removeEventListener('online', online); window.removeEventListener('beforeunload', antesDeSair); salvarAgora() }
  }, [salvarAgora])

  // ---------- helpers ----------
  const aplicar = useCallback((fn: (d: DocumentoProjeto) => DocumentoProjeto, historico = true) => dispatch({ tipo: 'documento', fn, historico }), [])
  const cena = e.documento.scenes.find((s) => s.id === e.cenaId) ?? e.documento.scenes[0]
  const indiceCena = cena ? e.documento.scenes.indexOf(cena) : -1
  const camadasSelecionadas = cena ? cena.layers.filter((l) => e.selecao.includes(l.id)) : []
  const cenaAtualRef = () => estadoRef.current.documento.scenes.find((s) => s.id === estadoRef.current.cenaId)

  const atualizarCenaAtual = useCallback(
    (fn: (c: Cena) => Cena, historico = true) => aplicar((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === estadoRef.current.cenaId ? fn(s) : s)) }), historico),
    [aplicar]
  )

  const acoes = useMemo(() => {
    const ui = (patch: Extract<Acao, { tipo: 'ui' }>['patch']) => dispatch({ tipo: 'ui', patch })

    const inserirCamadas = (novas: Camada[]) => {
      atualizarCenaAtual((c) => ({ ...c, layers: normalizarZ([...c.layers, ...novas]) }))
      dispatch({ tipo: 'selecionar', ids: novas.map((n) => n.id) })
    }

    /** Cria uma camada com defaults do schema no centro da tela (ou no retângulo dado). */
    const criarCamada = (parcial: Record<string, unknown> & { type: Camada['type'] }, rect?: { x: number; y: number; width: number; height: number }) => {
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
      }[parcial.type] as Record<string, unknown>
      try {
        const camada = parseCamada({ id, z, ...padrao, ...extras, ...parcial })
        inserirCamadas([camada])
        return camada
      } catch {
        return null
      }
    }

    return {
      selecionar: (ids: string[]) => dispatch({ tipo: 'selecionar', ids: expandirGrupos(cenaAtualRef(), ids) }),
      selecionarExato: (ids: string[]) => dispatch({ tipo: 'selecionar', ids }),
      irParaCena: (id: string) => dispatch({ tipo: 'cena', id }),
      desfazer: () => dispatch({ tipo: 'desfazer' }),
      refazer: () => dispatch({ tipo: 'refazer' }),
      registrarHistorico: (anterior: DocumentoProjeto) => dispatch({ tipo: 'marcarHistorico', anterior }),
      documentoAtual: () => estadoRef.current.documento,
      ui,
      setZoom: (zoom: number) => ui({ zoom }),
      ajustar: () => ui({ zoom: 0, pan: { x: 0, y: 0 } }),
      setFerramenta: (ferramenta: Ferramenta) => ui({ ferramenta }),
      reproduzirPrevia: () => ui({ previa: estadoRef.current.previa + 1 }),
      salvarAgora,

      // ----- conflito -----
      recarregarDoServidor: () => {
        const p = obterProjeto(projetoId)
        if (p) { ultimoSalvo.current = p.documento; dispatch({ tipo: 'substituir', documento: p.documento, revisao: p.revisaoAtual }) }
      },
      manterMinhaVersao: () => {
        const p = obterProjeto(projetoId)
        if (p) dispatch({ tipo: 'salvamento', valor: 'alterado', revisao: p.revisaoAtual, conflito: null })
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
      atualizarDocumento: (patch: Partial<Pick<DocumentoProjeto, 'theme' | 'mode'>>) => aplicar((d) => ({ ...d, ...patch })),
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
      atualizarCamadas: (ids: string[], patch: Partial<Camada> | ((l: Camada) => Camada), historico = true) =>
        atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (typeof patch === 'function' ? patch(l) : ({ ...l, ...patch } as Camada)) : l)) }), historico),
      removerCamadas: (ids: string[]) => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.filter((l) => !ids.includes(l.id)) })),
      duplicarCamadas: (ids: string[]) => {
        const c = cenaAtualRef()
        if (!c) return
        const copias = clonarCamadas(c.layers.filter((l) => ids.includes(l.id)), c.layers, 24)
        inserirCamadas(copias)
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
      deslocar: (ids: string[], dx: number, dy: number) => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) && !l.locked ? { ...l, x: l.x + dx, y: l.y + dy } : l)) })),
      agrupar: (ids: string[]) => {
        if (ids.length < 2) return
        const c = cenaAtualRef()
        const groupId = novoId('grupo', c?.layers ?? [])
        atualizarCenaAtual((cc) => ({ ...cc, layers: cc.layers.map((l) => (ids.includes(l.id) ? { ...l, groupId } : l)) }))
      },
      desagrupar: (ids: string[]) => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? { ...l, groupId: undefined } : l)) })),
      inverter: (ids: string[], eixo: 'x' | 'y') => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (eixo === 'x' ? { ...l, flipX: !l.flipX } : { ...l, flipY: !l.flipY }) : l)) })),

      // ----- área de transferência -----
      copiar: (ids: string[]) => {
        const c = cenaAtualRef()
        if (!c) return []
        const camadas = c.layers.filter((l) => ids.includes(l.id))
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
        const { id: _i, x: _x, y: _y, width: _w, height: _h, z: _z, name: _n, interactions: _it, groupId: _g, ...estilo } = camada as Camada & Record<string, unknown>
        estiloCopiado.current = estilo as Partial<Camada>
      },
      colarEstilo: (ids: string[]) => {
        const est = estiloCopiado.current
        if (!est) return
        atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (() => { try { return parseCamada({ ...l, ...est, type: l.type, ...(l.type === 'image' || l.type === 'video' || l.type === 'model3d' ? { assetId: (l as { assetId: string }).assetId } : {}), ...(l.type === 'text' ? { text: l.text } : {}) }) } catch { return l } })() : l)) }))
      },
      temEstiloCopiado: () => !!estiloCopiado.current,
    }
  }, [aplicar, atualizarCenaAtual, projetoId, salvarAgora])

  const validacao: ResultadoValidacao = useMemo(() => validarDocumento(e.documento, { assetsExistentes: new Set(Object.keys(mapaAssets())) }), [e.documento])

  return { estado: e, cena, indiceCena, camadasSelecionadas, acoes, validacao, existe: !!inicial }
}

export type Editor = ReturnType<typeof useEditor>
