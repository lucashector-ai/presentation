'use client'
/**
 * Estado do editor: documento + seleção + histórico (undo/redo) + autosave com revisão.
 * Regras (seção 6.4): autosave com debounce 800 ms e ao sair; cada gravação leva baseRevision;
 * 409 preserva mudanças locais e informa conflito; undo/redo por comandos na sessão.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { FORMATOS, type Camada, type Cena, type DocumentoProjeto } from '@/lib/scene/schema'
import { validarDocumento, type ResultadoValidacao } from '@/lib/scene/validate'
import { moverCena, normalizarZ, novoId, trazerParaFrente, enviarParaTras, avancarUm, recuarUm } from '@/lib/scene/order'
import { alinhar as alinharRects, enquadrarNaCena, type Alinhamento } from '@/lib/scene/transform'
import { ErroDemo, salvarDocumento, obterProjeto, mapaAssets, type ResolucaoLink } from '@/lib/demo/store'
import type { AssetDemo } from '@/lib/demo/tipos'

export type EstadoSalvamento = 'salvo' | 'alterado' | 'salvando' | 'offline' | 'falha' | 'conflito'

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
  zoom: number // 0 = ajustar à tela
  grade: boolean
  snap: boolean
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
  | { tipo: 'zoom'; valor: number }
  | { tipo: 'grade'; valor: boolean }
  | { tipo: 'snap'; valor: boolean }

const LIMITE_HISTORICO = 100

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
      return { ...e, documento: ant, passado: e.passado.slice(0, -1), futuro: [e.documento, ...e.futuro], salvamento: 'alterado', selecao: [] }
    }
    case 'refazer': {
      const prox = e.futuro[0]
      if (!prox) return e
      return { ...e, documento: prox, passado: [...e.passado, e.documento], futuro: e.futuro.slice(1), salvamento: 'alterado', selecao: [] }
    }
    case 'selecionar':
      return { ...e, selecao: a.ids }
    case 'cena':
      return { ...e, cenaId: a.id, selecao: [] }
    case 'salvamento':
      return { ...e, salvamento: a.valor, revisao: a.revisao ?? e.revisao, salvoEm: a.salvoEm ?? e.salvoEm, conflito: a.conflito === undefined ? e.conflito : a.conflito }
    case 'substituir':
      return { ...e, documento: a.documento, revisao: a.revisao, passado: [], futuro: [], salvamento: 'salvo', conflito: null, selecao: [] }
    case 'zoom':
      return { ...e, zoom: a.valor }
    case 'grade':
      return { ...e, grade: a.valor }
    case 'snap':
      return { ...e, snap: a.valor }
  }
}

export function useEditor(projetoId: string) {
  const inicial = useMemo(() => {
    const p = obterProjeto(projetoId)
    if (!p) return null
    return { documento: p.documento, revisao: p.revisaoAtual, cenaId: p.documento.scenes[0]?.id ?? '' }
  }, [projetoId])

  const [e, dispatch] = useReducer(reducer, inicial, (i: typeof inicial): EstadoEditor => ({
    documento: i?.documento ?? { schemaVersion: 1, mode: 'slides', scenes: [] },
    cenaId: i?.cenaId ?? '',
    selecao: [],
    passado: [],
    futuro: [],
    revisao: i?.revisao ?? 0,
    salvamento: 'salvo',
    salvoEm: null,
    conflito: null,
    zoom: 0,
    grade: false,
    snap: true,
  }))

  const ultimoSalvo = useRef<DocumentoProjeto | null>(inicial?.documento ?? null)
  const timer = useRef<number | undefined>(undefined)
  const estadoRef = useRef(e)
  estadoRef.current = e

  // ---------- autosave ----------
  const salvarAgora = useCallback(() => {
    const atual = estadoRef.current
    if (atual.salvamento === 'conflito') return
    if (atual.documento === ultimoSalvo.current) {
      // undo/redo voltou exatamente ao estado já gravado: nada a enviar
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
      if (err instanceof ErroDemo && err.code === 'conflito_revisao') {
        dispatch({ tipo: 'salvamento', valor: 'conflito', conflito: err.details as { currentRevision: number } })
      } else {
        dispatch({ tipo: 'salvamento', valor: 'falha' })
      }
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

  const atualizarCenaAtual = useCallback(
    (fn: (c: Cena) => Cena, historico = true) =>
      aplicar((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === estadoRef.current.cenaId ? fn(s) : s)) }), historico),
    [aplicar]
  )

  const acoes = useMemo(
    () => ({
      selecionar: (ids: string[]) => dispatch({ tipo: 'selecionar', ids }),
      irParaCena: (id: string) => dispatch({ tipo: 'cena', id }),
      desfazer: () => dispatch({ tipo: 'desfazer' }),
      /** Consolida um gesto contínuo (mover/redimensionar) como uma única entrada de undo. */
      registrarHistorico: (anterior: DocumentoProjeto) => dispatch({ tipo: 'marcarHistorico', anterior }),
      documentoAtual: () => estadoRef.current.documento,
      refazer: () => dispatch({ tipo: 'refazer' }),
      setZoom: (v: number) => dispatch({ tipo: 'zoom', valor: v }),
      setGrade: (v: boolean) => dispatch({ tipo: 'grade', valor: v }),
      setSnap: (v: boolean) => dispatch({ tipo: 'snap', valor: v }),
      salvarAgora,

      // ----- conflito -----
      recarregarDoServidor: () => {
        const p = obterProjeto(projetoId)
        if (p) { ultimoSalvo.current = p.documento; dispatch({ tipo: 'substituir', documento: p.documento, revisao: p.revisaoAtual }) }
      },
      manterMinhaVersao: () => {
        // adota a revisão atual do servidor como base e grava por cima (decisão explícita do usuário)
        const p = obterProjeto(projetoId)
        if (!p) return
        dispatch({ tipo: 'salvamento', valor: 'alterado', revisao: p.revisaoAtual, conflito: null })
      },

      // ----- cenas -----
      adicionarCena: (apos?: number) =>
        aplicar((d) => {
          const base = d.scenes[apos ?? d.scenes.length - 1] ?? d.scenes[0]
          const size = base?.size ?? (d.mode === 'story' ? FORMATOS.story : FORMATOS.slides169)
          const nova: Cena = { id: novoId('scene', d.scenes), title: `Cena ${d.scenes.length + 1}`, size, background: base?.background ?? '#101820', backgroundFit: 'cover', layers: [] }
          const scenes = [...d.scenes]
          scenes.splice((apos ?? d.scenes.length - 1) + 1, 0, nova)
          queueMicrotask(() => dispatch({ tipo: 'cena', id: nova.id }))
          return { ...d, scenes }
        }),
      duplicarCena: (id: string) =>
        aplicar((d) => {
          const i = d.scenes.findIndex((s) => s.id === id)
          const orig = d.scenes[i]
          if (!orig) return d
          const copia: Cena = { ...structuredClone(orig), id: novoId('scene', d.scenes), title: `${orig.title || 'Cena'} (cópia)` }
          const scenes = [...d.scenes]
          scenes.splice(i + 1, 0, copia)
          queueMicrotask(() => dispatch({ tipo: 'cena', id: copia.id }))
          return { ...d, scenes }
        }),
      removerCena: (id: string) => aplicar((d) => (d.scenes.length <= 1 ? d : { ...d, scenes: d.scenes.filter((s) => s.id !== id) })),
      moverCena: (de: number, para: number) => aplicar((d) => ({ ...d, scenes: moverCena(d.scenes, de, para) })),
      atualizarCena: (patch: Partial<Cena>) => atualizarCenaAtual((c) => ({ ...c, ...patch })),
      /** Cria uma cena por mídia (Fluxo A, passo 04). */
      cenasDeAssets: (assets: AssetDemo[]) =>
        aplicar((d) => {
          const base = d.scenes[d.scenes.length - 1]
          const size = base?.size ?? FORMATOS.slides169
          const novas: Cena[] = []
          for (const a of assets) {
            const r = enquadrarNaCena({ width: a.width ?? size.width, height: a.height ?? size.height }, size)
            const id = novoId('scene', [...d.scenes, ...novas])
            novas.push({
              id,
              title: a.nome.replace(/\.[^.]+$/, ''),
              size,
              background: base?.background ?? '#101820',
              backgroundFit: 'cover',
              layers: [a.tipo === 'video'
                ? { id: 'midia', type: 'video', assetId: a.id, fit: 'contain', autoplay: false, loop: false, muted: true, controls: true, radius: 0, x: r.x, y: r.y, width: r.width, height: r.height, rotation: 0, opacity: 1, z: 0, locked: false, hidden: false }
                : { id: 'midia', type: 'image', assetId: a.id, fit: 'contain', radius: 0, shadow: false, x: r.x, y: r.y, width: r.width, height: r.height, rotation: 0, opacity: 1, z: 0, locked: false, hidden: false }],
            })
          }
          // se a única cena está vazia, substitui
          const scenes = d.scenes.length === 1 && d.scenes[0]!.layers.length === 0 ? novas : [...d.scenes, ...novas]
          if (novas[0]) queueMicrotask(() => dispatch({ tipo: 'cena', id: novas[0]!.id }))
          return { ...d, scenes }
        }),

      // ----- camadas -----
      adicionarCamada: (parcial: Partial<Camada> & { type: Camada['type'] }, asset?: AssetDemo) => {
        const c = estadoRef.current.documento.scenes.find((s) => s.id === estadoRef.current.cenaId)
        if (!c) return
        const { type: tipo, ...extra } = parcial
        const id = novoId(tipo, c.layers)
        const z = c.layers.length ? Math.max(...c.layers.map((l) => l.z)) + 1 : 0
        const comum = { id, rotation: 0, opacity: 1, z, locked: false, hidden: false }
        const padrao = { x: c.size.width * 0.3, y: c.size.height * 0.3, width: c.size.width * 0.4, height: c.size.height * 0.2 }
        let nova: Camada
        switch (tipo) {
          case 'text':
            nova = { ...comum, ...padrao, type: 'text', text: 'Texto', fontFamily: 'system-ui', fontSize: Math.round(c.size.width / 30), fontWeight: 500, color: '#F3F5F2', align: 'left', lineHeight: 1.2, letterSpacing: 0, ...extra } as Camada
            break
          case 'shape':
            nova = { ...comum, ...padrao, type: 'shape', shape: 'rect', fill: '#D9F99D', strokeWidth: 0, radius: 0, shadow: false, ...extra } as Camada
            break
          case 'hotspot':
            nova = { ...comum, ...padrao, type: 'hotspot', ariaLabel: 'Área clicável', hint: true, ...extra } as Camada
            break
          case 'image': {
            const r = asset ? enquadrarNaCena({ width: asset.width ?? 800, height: asset.height ?? 600 }, c.size, c.size.width * 0.1) : padrao
            nova = { ...comum, ...r, type: 'image', assetId: asset?.id ?? '', fit: 'contain', radius: 0, shadow: false, ...extra } as Camada
            break
          }
          case 'video': {
            const r = asset ? enquadrarNaCena({ width: asset.width ?? 1280, height: asset.height ?? 720 }, c.size, c.size.width * 0.1) : padrao
            nova = { ...comum, ...r, type: 'video', assetId: asset?.id ?? '', fit: 'contain', autoplay: false, loop: false, muted: true, controls: true, radius: 0, ...extra } as Camada
            break
          }
        }
        atualizarCenaAtual((cc) => ({ ...cc, layers: [...cc.layers, nova] }))
        dispatch({ tipo: 'selecionar', ids: [id] })
      },
      atualizarCamadas: (ids: string[], patch: Partial<Camada> | ((l: Camada) => Camada), historico = true) =>
        atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) ? (typeof patch === 'function' ? patch(l) : ({ ...l, ...patch } as Camada)) : l)) }), historico),
      removerCamadas: (ids: string[]) => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.filter((l) => !ids.includes(l.id)) })),
      duplicarCamadas: (ids: string[]) => {
        const novos: string[] = []
        atualizarCenaAtual((c) => {
          const copias: Camada[] = []
          for (const l of c.layers) {
            if (!ids.includes(l.id)) continue
            const id = novoId(l.type, [...c.layers, ...copias])
            novos.push(id)
            copias.push({ ...structuredClone(l), id, x: l.x + 24, y: l.y + 24, z: l.z + copias.length + 1 })
          }
          return { ...c, layers: normalizarZ([...c.layers, ...copias]) }
        })
        dispatch({ tipo: 'selecionar', ids: novos })
      },
      ordem: (id: string, op: 'frente' | 'tras' | 'avancar' | 'recuar') =>
        atualizarCenaAtual((c) => ({ ...c, layers: op === 'frente' ? trazerParaFrente(c.layers, id) : op === 'tras' ? enviarParaTras(c.layers, id) : op === 'avancar' ? avancarUm(c.layers, id) : recuarUm(c.layers, id) })),
      alinhar: (ids: string[], modo: Alinhamento) =>
        atualizarCenaAtual((c) => {
          const alvo = c.layers.filter((l) => ids.includes(l.id))
          const novos = alinharRects(alvo, c.size, modo)
          return { ...c, layers: c.layers.map((l) => novos.find((n) => n.id === l.id) ?? l) }
        }),
      deslocar: (ids: string[], dx: number, dy: number) => atualizarCenaAtual((c) => ({ ...c, layers: c.layers.map((l) => (ids.includes(l.id) && !l.locked ? { ...l, x: l.x + dx, y: l.y + dy } : l)) })),
    }),
    [aplicar, atualizarCenaAtual, projetoId, salvarAgora]
  )

  const validacao: ResultadoValidacao = useMemo(() => validarDocumento(e.documento, { assetsExistentes: new Set(Object.keys(mapaAssets())) }), [e.documento])

  return { estado: e, cena, indiceCena, camadasSelecionadas, acoes, validacao, existe: !!inicial }
}

export type Editor = ReturnType<typeof useEditor>
export type { ResolucaoLink }
