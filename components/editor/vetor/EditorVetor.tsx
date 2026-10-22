'use client'
/**
 * Modo "Editar vetor" (duplo clique ou Enter numa forma; P = caneta). Sobreposição do canvas que mostra os nós
 * como círculos, as alças de Bézier e uma barra de ferramentas própria na base:
 *  Mover (V) · Laço (Q) · Caneta (P) · Curvar (B) · Cortar (X) · Apagar (E) · Pintar (⇧B) · Concluir (✕ / Esc / Enter).
 * Cada gesto é um passo de desfazer; ao fim de cada gesto a caixa da camada volta a abraçar o caminho
 * sem mover o desenho. Nós encaixam em outros nós, nas camadas, na tela (e frações) e no pixel; ⌘/Ctrl desliga.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Check, Eraser, Lasso, MousePointer2, PaintBucket, PenTool, Scissors, Spline } from 'lucide-react'
import type { Camada, CamadaForma, DocumentoProjeto, Vetor } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { LIMIAR_TELA, type Guia } from '@/lib/editor/guias'
import type { AlvosExtras } from '@/lib/editor/guias'
import { achatar, areaPoligono, dentroDoPoligono, dist, maisProximoNoSegmento, pontosNoLaco, segmentos, vetorParaD, type P, type Segmento } from '@/lib/editor/vetor/geometria'
import { abrirNoNo, adicionarNo, alternarPreenchimento, alternarTipoNo, apagarSegmento, chaveNo, cortarSegmento, curvarSegmento, definirAlcasDoNo, fecharCaminho, inserirNo, moverAlca, moverNos, novoCaminho, puxarAlcas, removerNos, todosOsNos, type QualAlca, type RefNo } from '@/lib/editor/vetor/operacoes'
import { aplicarVetor, cenaParaLocal, deltaParaLocal, localParaCena, vetorDaCamada } from '@/lib/editor/vetor/camadas'
import { GuiasCanvas } from '../GuiasCanvas'
import { cx } from '@/components/ui'

export type FerramentaVetor = 'mover' | 'laco' | 'caneta' | 'curvar' | 'cortar' | 'apagar' | 'pintar'

const FERRAMENTAS: { id: FerramentaVetor; rotulo: string; tecla: string; dica: string; icone: JSX.Element }[] = [
  { id: 'mover', rotulo: 'Mover', tecla: 'V', dica: 'Arraste nós, alças e segmentos; Shift soma à seleção; duplo clique num segmento cria um nó', icone: <MousePointer2 className="h-4 w-4" /> },
  { id: 'laco', rotulo: 'Laço', tecla: 'Q', dica: 'Desenhe à mão livre em volta dos nós para selecioná-los', icone: <Lasso className="h-4 w-4" /> },
  { id: 'caneta', rotulo: 'Caneta', tecla: 'P', dica: 'Clique = canto, arraste = curva; clique no primeiro nó para fechar; Enter termina', icone: <PenTool className="h-4 w-4" /> },
  { id: 'curvar', rotulo: 'Curvar', tecla: 'B', dica: 'Arraste um segmento para curvá-lo ou um nó para puxar alças (Alt quebra a simetria); clique num nó alterna canto/suave', icone: <Spline className="h-4 w-4" /> },
  { id: 'cortar', rotulo: 'Cortar', tecla: 'X', dica: 'Clique num segmento para cortar o caminho ali, ou num nó para abri-lo', icone: <Scissors className="h-4 w-4" /> },
  { id: 'apagar', rotulo: 'Apagar', tecla: 'E', dica: 'Clique num nó para apagá-lo ou num segmento para removê-lo', icone: <Eraser className="h-4 w-4" /> },
  { id: 'pintar', rotulo: 'Pintar', tecla: 'Shift+B', dica: 'Clique dentro de uma região fechada para ligar/desligar o preenchimento dela', icone: <PaintBucket className="h-4 w-4" /> },
]
const TECLAS: Record<string, FerramentaVetor> = { KeyV: 'mover', KeyQ: 'laco', KeyP: 'caneta', KeyB: 'curvar', KeyX: 'cortar', KeyE: 'apagar' }

// cor da seleção do canvas (azul sólido, ver COR_SELECAO em GuiasCanvas.tsx)
const ACENTO = 'rgb(var(--cor-selecao))'
type Caixa = Pick<Camada, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'>

type Acerto =
  | { tipo: 'alca'; ref: RefNo; qual: QualAlca }
  | { tipo: 'no'; ref: RefNo }
  | { tipo: 'seg'; c: number; i: number; t: number }
  | null

type Gesto =
  | { tipo: 'nos'; inicio: P; refs: RefNo[]; primario: P; base: Vetor; caixa: Caixa; antes: DocumentoProjeto; moveu: boolean }
  | { tipo: 'alca'; ref: RefNo; qual: QualAlca; base: Vetor; caixa: Caixa; antes: DocumentoProjeto; moveu: boolean }
  | { tipo: 'curvarNo'; ref: RefNo; base: Vetor; caixa: Caixa; antes: DocumentoProjeto; moveu: boolean; inicio: P }
  | { tipo: 'curvarSeg'; c: number; i: number; t: number; base: Vetor; caixa: Caixa; antes: DocumentoProjeto; moveu: boolean }
  | { tipo: 'caneta'; ref: RefNo; base: Vetor; caixa: Caixa; antes: DocumentoProjeto; inverter: boolean; inicio: P; moveu: boolean }
  | { tipo: 'area'; inicio: P; atual: P; base: RefNo[]; moveu: boolean }
  | { tipo: 'laco'; pontos: P[]; base: RefNo[] }

interface Props {
  editor: Editor
  /** Camada em edição; null = caneta esperando o primeiro clique (cria a camada). */
  camadaId: string | null
  vp: { s: number; ox: number; oy: number }
  ferramentaInicial?: FerramentaVetor
  /** Camadas visíveis (para o encaixe dos nós). */
  outros: readonly Camada[]
  extras?: AlvosExtras
  modoMao: boolean
  aoCriar: (id: string) => void
  aoSair: (id: string | null) => void
}

export function EditorVetor({ editor, camadaId, vp, ferramentaInicial = 'mover', outros, extras, modoMao, aoCriar, aoSair }: Props) {
  const { acoes, estado, cena } = editor
  const ref = useRef<HTMLDivElement>(null)
  const [ferramenta, setFerramentaLocal] = useState<FerramentaVetor>(ferramentaInicial)
  const [sel, setSel] = useState<RefNo[]>([])
  const [hover, setHover] = useState<Acerto>(null)
  const [cursor, setCursor] = useState<P | null>(null)
  const [guias, setGuias] = useState<Guia[]>([])
  /** Caneta: caminho sendo desenhado e a ponta que cresce. */
  const [desenho, setDesenho] = useState<{ c: number; inicio: boolean } | null>(null)
  const [, forcar] = useState(0)
  const gesto = useRef<Gesto | null>(null)
  /** Documento antes de a caneta criar a camada (o primeiro passo de desfazer cobre a criação). */
  const antesDaCriacao = useRef<DocumentoProjeto | null>(null)
  /** Duplo clique próprio (o `detail` do pointerdown não é confiável em todos os navegadores). */
  const ultimoClique = useRef<{ t: number; p: P } | null>(null)

  const camada = useMemo(() => {
    const l = cena?.layers.find((x) => x.id === camadaId)
    return l?.type === 'shape' ? l : undefined
  }, [cena, camadaId])
  const conv = useMemo(() => (camada ? vetorDaCamada(camada) : null), [camada])
  const v = conv?.vetor ?? null

  const setFerramenta = useCallback((f: FerramentaVetor) => {
    setFerramentaLocal(f)
    if (f !== 'caneta') setDesenho(null)
    acoes.setFerramenta(f === 'caneta' ? 'caneta' : 'mover')
  }, [acoes])

  // ferramenta global (barra superior): caneta entra na caneta; outra ferramenta sai do modo
  const ferramentaGlobal = estado.ferramenta
  useEffect(() => {
    if (ferramentaGlobal === 'caneta') setFerramentaLocal('caneta')
    else if (ferramentaGlobal === 'mover') setFerramentaLocal((f) => (f === 'caneta' ? 'mover' : f))
    else aoSair(camadaId)
  }, [ferramentaGlobal, aoSair, camadaId])

  // nós selecionados que deixaram de existir (desfazer, apagar)
  useEffect(() => {
    if (!v) return
    setSel((s) => { const ok = s.filter((r) => v.caminhos[r.c]?.nos[r.i]); return ok.length === s.length ? s : ok })
    setDesenho((d) => (d && !v.caminhos[d.c] ? null : d))
  }, [v])

  // ---------- coordenadas ----------
  const telaDe = useCallback((p: P): P => ({ x: vp.ox + p.x * vp.s, y: vp.oy + p.y * vp.s }), [vp])
  const cenaDe = useCallback((p: P): P => ({ x: (p.x - vp.ox) / vp.s, y: (p.y - vp.oy) / vp.s }), [vp])
  const localDoEvento = (ev: { clientX: number; clientY: number }): P => {
    const r = ref.current!.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }
  const paraTela = useCallback((r: { x: number; y: number; width: number; height: number }) => ({ x: vp.ox + r.x * vp.s, y: vp.oy + r.y * vp.s, width: r.width * vp.s, height: r.height * vp.s }), [vp])

  /** Ponto local → tela (para desenhar e acertar). */
  const lt = useCallback((c: Caixa, vv: Vetor, p: P) => telaDe(localParaCena(c, vv, p)), [telaDe])

  // ---------- gravar ----------
  const gravar = useCallback((caixa: Caixa, novo: Vetor, normalizarCaixa: boolean) => {
    const patch = conv?.patch ?? {}
    acoes.transformarCena((c) => ({
      ...c,
      layers: c.layers.map((l) => {
        if (l.id !== caixa.id || l.type !== 'shape') return l
        const base: CamadaForma = { ...l, x: caixa.x, y: caixa.y, width: caixa.width, height: caixa.height }
        return normalizarCaixa ? aplicarVetor(base, novo, patch) : { ...base, ...patch, shape: 'path', vetor: novo, radius: 0, radii: undefined, pattern: 'none' }
      }),
    }), false)
  }, [acoes, conv])

  const historico = useCallback((antes: DocumentoProjeto) => {
    acoes.registrarHistorico(antesDaCriacao.current ?? antes)
    antesDaCriacao.current = null
  }, [acoes])

  /** Ação de um clique só: grava normalizado e registra o desfazer. */
  const aplicarJa = useCallback((novo: Vetor | null) => {
    if (!camada) return
    setHover(null)
    const antes = acoes.documentoAtual()
    if (!novo) {
      acoes.removerCamadas([camada.id], false)
      historico(antes)
      aoSair(null)
      return
    }
    gravar(camada, novo, true)
    historico(antes)
  }, [camada, acoes, gravar, historico, aoSair])

  // ---------- encaixe dos nós ----------
  const encaixarPonto = useCallback((p: P, ignorar: ReadonlySet<string>, desligar: boolean): { p: P; guias: Guia[] } => {
    if (desligar || !cena) return { p, guias: [] }
    const grade = estado.grade ? estado.gradePasso : 0
    if (grade) return { p: { x: Math.round(p.x / grade) * grade, y: Math.round(p.y / grade) * grade }, guias: [] }
    const lim = LIMIAR_TELA / vp.s
    type Cand = { v: number; a: number; b: number; rotulo?: string }
    const cx: Cand[] = [], cy: Cand[] = []
    const W = cena.size.width, H = cena.size.height
    for (const x of [0, W / 2, W]) cx.push({ v: x, a: 0, b: H })
    for (const y of [0, H / 2, H]) cy.push({ v: y, a: 0, b: W })
    for (const e of extras?.x ?? []) cx.push({ v: e.v, a: 0, b: H, rotulo: e.rotulo || undefined })
    for (const e of extras?.y ?? []) cy.push({ v: e.v, a: 0, b: W, rotulo: e.rotulo || undefined })
    for (const o of outros) {
      for (const x of [o.x, o.x + o.width / 2, o.x + o.width]) cx.push({ v: x, a: o.y, b: o.y + o.height })
      for (const y of [o.y, o.y + o.height / 2, o.y + o.height]) cy.push({ v: y, a: o.x, b: o.x + o.width })
    }
    if (camada && v) {
      v.caminhos.forEach((cam, c) => cam.nos.forEach((n, i) => {
        if (ignorar.has(chaveNo({ c, i }))) return
        const q = localParaCena(camada, v, n)
        cx.push({ v: q.x, a: q.y, b: q.y })
        cy.push({ v: q.y, a: q.x, b: q.x })
      }))
    }
    const melhor = (lista: Cand[], alvo: number) => lista.reduce<Cand | null>((m, k) => (Math.abs(k.v - alvo) <= lim && (!m || Math.abs(k.v - alvo) < Math.abs(m.v - alvo)) ? k : m), null)
    const bx = melhor(cx, p.x)
    const by = melhor(cy, p.y)
    const r = { x: bx ? bx.v : Math.round(p.x), y: by ? by.v : Math.round(p.y) }
    const g: Guia[] = []
    if (bx) g.push({ eixo: 'v', pos: bx.v, de: Math.min(bx.a, r.y), ate: Math.max(bx.b, r.y), ...(bx.rotulo ? { rotulo: bx.rotulo } : {}) })
    if (by) g.push({ eixo: 'h', pos: by.v, de: Math.min(by.a, r.x), ate: Math.max(by.b, r.x), ...(by.rotulo ? { rotulo: by.rotulo } : {}) })
    return { p: r, guias: g }
  }, [cena, estado.grade, estado.gradePasso, vp.s, extras, outros, camada, v])

  // ---------- acerto ----------
  const alcasVisiveis = useCallback((vv: Vetor): { ref: RefNo; qual: QualAlca }[] => {
    const r: { ref: RefNo; qual: QualAlca }[] = []
    const chaves = new Set(sel.map(chaveNo))
    vv.caminhos.forEach((cam, c) => {
      const n = cam.nos.length
      cam.nos.forEach((no, i) => {
        const selec = chaves.has(chaveNo({ c, i }))
        const ant = i > 0 ? i - 1 : cam.fechado ? n - 1 : -1
        const prox = i < n - 1 ? i + 1 : cam.fechado ? 0 : -1
        if (no.entrada && (selec || (ant >= 0 && chaves.has(chaveNo({ c, i: ant }))))) r.push({ ref: { c, i }, qual: 'entrada' })
        if (no.saida && (selec || (prox >= 0 && chaves.has(chaveNo({ c, i: prox }))))) r.push({ ref: { c, i }, qual: 'saida' })
      })
    })
    return r
  }, [sel])

  const segTela = useCallback((s: Segmento): Segmento => {
    if (!camada || !v) return s
    return { ...s, p0: lt(camada, v, s.p0), p1: lt(camada, v, s.p1), p2: lt(camada, v, s.p2), p3: lt(camada, v, s.p3) }
  }, [camada, v, lt])

  const acertar = useCallback((pt: P): Acerto => {
    if (!camada || !v) return null
    for (const a of alcasVisiveis(v)) {
      const h = v.caminhos[a.ref.c]?.nos[a.ref.i]?.[a.qual]
      if (h && dist(lt(camada, v, h), pt) <= 6) return { tipo: 'alca', ...a }
    }
    let melhor: { ref: RefNo; d: number } | null = null
    v.caminhos.forEach((cam, c) => cam.nos.forEach((n, i) => { const d = dist(lt(camada, v, n), pt); if (d <= 8 && (!melhor || d < melhor.d)) melhor = { ref: { c, i }, d } }))
    if (melhor) return { tipo: 'no', ref: (melhor as { ref: RefNo }).ref }
    let seg: { c: number; i: number; t: number; d: number } | null = null
    for (const s of segmentos(v)) {
      const r = maisProximoNoSegmento(segTela(s), pt)
      if (r.d <= 6 && (!seg || r.d < seg.d)) seg = { c: s.c, i: s.i, t: r.t, d: r.d }
    }
    if (seg) { const { c, i, t } = seg as { c: number; i: number; t: number }; return { tipo: 'seg', c, i, t } }
    return null
  }, [camada, v, lt, alcasVisiveis, segTela])

  /** Região (caminho) sob o ponto para Pintar: a menor que contém o ponto. */
  const regiaoSob = useCallback((pt: P): number | null => {
    if (!camada || !v) return null
    const local = cenaParaLocal(camada, v, cenaDe(pt))
    let melhor: { c: number; a: number } | null = null
    v.caminhos.forEach((cam, c) => {
      if (cam.nos.length < 3 && !cam.nos.some((n) => n.entrada || n.saida)) return
      const pol = achatar(cam)
      if (dentroDoPoligono(pol, local, 'nonzero')) { const a = Math.abs(areaPoligono(pol)); if (!melhor || a < melhor.a) melhor = { c, a } } })
    return melhor ? (melhor as { c: number }).c : null
  }, [camada, v, cenaDe])

  // ---------- caneta ----------
  const caneta = (pt: P, ev: React.PointerEvent) => {
    const pc0 = cenaDe(pt)
    const { p: pc } = encaixarPonto(pc0, new Set(), ev.metaKey || ev.ctrlKey || !estado.snap)
    // primeiro clique da caneta sem camada: cria a camada com um nó
    if (!camada || !v) {
      const antes = acoes.documentoAtual()
      const espessura = Math.max(2, Math.round((cena?.size.width ?? 1920) / 480))
      const vetor: Vetor = { w: 1, h: 1, fillRule: 'nonzero', caminhos: [{ nos: [{ x: 0.5, y: 0.5, tipo: 'canto' }], fechado: false, semPreenchimento: true }] }
      const nova = acoes.criarCamada({ type: 'shape', shape: 'path', name: 'Vetor', fill: '#5965F2', stroke: '#171717', strokeWidth: espessura, vetor }, { x: pc.x - 0.5, y: pc.y - 0.5, width: 1, height: 1 }, { historico: false })
      if (!nova || nova.type !== 'shape') return
      antesDaCriacao.current = antes
      aoCriar(nova.id)
      setDesenho({ c: 0, inicio: false })
      setSel([{ c: 0, i: 0 }])
      gesto.current = { tipo: 'caneta', ref: { c: 0, i: 0 }, base: vetor, caixa: nova, antes, inverter: false, inicio: pc, moveu: false }
      return
    }
    const antes = acoes.documentoAtual()
    const local = cenaParaLocal(camada, v, pc)
    const a = acertar(pt)
    if (desenho) {
      const cam = v.caminhos[desenho.c]
      const outraPonta = cam ? (desenho.inicio ? cam.nos.length - 1 : 0) : -1
      if (cam && a?.tipo === 'no' && a.ref.c === desenho.c && a.ref.i === outraPonta && cam.nos.length >= 2) {
        // clicar no primeiro nó fecha o caminho
        gravar(camada, fecharCaminho(v, desenho.c), true)
        historico(antes)
        setDesenho(null)
        setSel([a.ref])
        return
      }
      const r = adicionarNo(v, desenho.c, local, undefined, desenho.inicio)
      gravar(camada, r.vetor, false)
      setSel([r.ref])
      gesto.current = { tipo: 'caneta', ref: r.ref, base: r.vetor, caixa: camada, antes, inverter: desenho.inicio, inicio: pc, moveu: false }
      return
    }
    // continuar de uma ponta de caminho aberto
    if (a?.tipo === 'no') {
      const cam = v.caminhos[a.ref.c]!
      if (!cam.fechado && (a.ref.i === 0 || a.ref.i === cam.nos.length - 1)) { setDesenho({ c: a.ref.c, inicio: a.ref.i === 0 && cam.nos.length > 1 }); setSel([a.ref]); return }
      setSel([a.ref])
      return
    }
    // clicar num segmento acrescenta um nó nele (como a caneta do Figma)
    if (a?.tipo === 'seg') {
      const r = inserirNo(v, a.c, a.i, a.t)
      if (r) { gravar(camada, r.vetor, true); historico(antes); setSel([r.ref]) }
      return
    }
    const r = novoCaminho(v, local)
    gravar(camada, r.vetor, false)
    setDesenho({ c: r.ref.c, inicio: false })
    setSel([r.ref])
    gesto.current = { tipo: 'caneta', ref: r.ref, base: r.vetor, caixa: camada, antes, inverter: false, inicio: pc, moveu: false }
  }

  // ---------- ponteiro ----------
  const onPointerDown = (ev: React.PointerEvent) => {
    if (ev.button !== 0) return
    ev.stopPropagation()
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    const pt = localDoEvento(ev)
    const agora = performance.now()
    const duplo = !!ultimoClique.current && agora - ultimoClique.current.t < 400 && dist(ultimoClique.current.p, pt) < 6
    ultimoClique.current = duplo ? null : { t: agora, p: pt }
    if (ferramenta === 'caneta') { caneta(pt, ev); forcar((n) => n + 1); return }
    if (!camada || !v) return
    const a = acertar(pt)
    const antes = acoes.documentoAtual()
    const pc = cenaDe(pt)
    switch (ferramenta) {
      case 'mover': {
        if (a?.tipo === 'alca') { gesto.current = { tipo: 'alca', ref: a.ref, qual: a.qual, base: v, caixa: camada, antes, moveu: false }; return }
        if (a?.tipo === 'no') {
          const k = chaveNo(a.ref)
          const ja = sel.some((r) => chaveNo(r) === k)
          const nova = ev.shiftKey ? (ja ? sel.filter((r) => chaveNo(r) !== k) : [...sel, a.ref]) : ja ? sel : [a.ref]
          setSel(nova)
          if (ev.shiftKey && ja) return
          gesto.current = { tipo: 'nos', inicio: pc, refs: nova, primario: v.caminhos[a.ref.c]!.nos[a.ref.i]!, base: v, caixa: camada, antes, moveu: false }
          return
        }
        if (a?.tipo === 'seg') {
          if (duplo) {
            const r = inserirNo(v, a.c, a.i, a.t)
            if (r) { gravar(camada, r.vetor, true); historico(antes); setSel([r.ref]) }
            return
          }
          const cam = v.caminhos[a.c]!
          const j = a.i + 1 < cam.nos.length ? a.i + 1 : 0
          const refs = [{ c: a.c, i: a.i }, { c: a.c, i: j }]
          setSel(ev.shiftKey ? [...sel, ...refs] : refs)
          gesto.current = { tipo: 'nos', inicio: pc, refs, primario: cam.nos[a.i]!, base: v, caixa: camada, antes, moveu: false }
          return
        }
        gesto.current = { tipo: 'area', inicio: pt, atual: pt, base: ev.shiftKey ? sel : [], moveu: false }
        return
      }
      case 'laco':
        gesto.current = { tipo: 'laco', pontos: [pt], base: ev.shiftKey ? sel : [] }
        return
      case 'curvar':
        if (a?.tipo === 'alca') { gesto.current = { tipo: 'alca', ref: a.ref, qual: a.qual, base: v, caixa: camada, antes, moveu: false }; return }
        if (a?.tipo === 'no') { setSel([a.ref]); gesto.current = { tipo: 'curvarNo', ref: a.ref, base: v, caixa: camada, antes, moveu: false, inicio: pt }; return }
        if (a?.tipo === 'seg') {
          const n = v.caminhos[a.c]!.nos.length
          setSel([{ c: a.c, i: a.i }, { c: a.c, i: a.i + 1 < n ? a.i + 1 : 0 }])
          gesto.current = { tipo: 'curvarSeg', c: a.c, i: a.i, t: a.t, base: v, caixa: camada, antes, moveu: false }
          return
        }
        return
      case 'cortar':
        setSel([])
        if (a?.tipo === 'seg') aplicarJa(cortarSegmento(v, a.c, a.i, a.t))
        else if (a?.tipo === 'no') aplicarJa(abrirNoNo(v, a.ref))
        return
      case 'apagar':
        if (a?.tipo === 'no') { setSel([]); aplicarJa(removerNos(v, [a.ref])) }
        else if (a?.tipo === 'seg') { setSel([]); aplicarJa(apagarSegmento(v, a.c, a.i)) }
        return
      case 'pintar': {
        const c = regiaoSob(pt)
        if (c == null) return
        const novo = alternarPreenchimento(v, c)
        // tudo sem preenchimento e sem traço sumiria: liga um traço fino
        const invisivel = novo.caminhos.every((k) => k.semPreenchimento) && !(camada.stroke && camada.strokeWidth)
        if (invisivel) {
          acoes.transformarCena((cc) => ({ ...cc, layers: cc.layers.map((l) => (l.id === camada.id && l.type === 'shape' ? { ...l, stroke: l.fill.slice(0, 7), strokeWidth: Math.max(2, Math.round((cena?.size.width ?? 1920) / 480)) } : l)) }), false)
        }
        gravar(camada, novo, true)
        historico(antes)
        return
      }
    }
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    const pt = localDoEvento(ev)
    const g = gesto.current
    setCursor(pt)
    if (!g) {
      if (ferramenta === 'pintar') { const c = regiaoSob(pt); setHover(c == null ? null : { tipo: 'seg', c, i: -1, t: 0 }) }
      else { const a = acertar(pt); setHover(a) }
      return
    }
    const pc = cenaDe(pt)
    const semEncaixe = ev.metaKey || ev.ctrlKey || !estado.snap
    switch (g.tipo) {
      case 'nos': {
        if (!g.moveu && dist(telaDe(pc), telaDe(g.inicio)) < 3) return
        g.moveu = true
        let dx = pc.x - g.inicio.x
        let dy = pc.y - g.inicio.y
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        const p0 = localParaCena(g.caixa, g.base, g.primario)
        const alvo = { x: p0.x + dx, y: p0.y + dy }
        const enc = encaixarPonto(alvo, new Set(g.refs.map(chaveNo)), semEncaixe)
        const fx = ev.shiftKey && dx === 0 ? p0.x : enc.p.x
        const fy = ev.shiftKey && dy === 0 ? p0.y : enc.p.y
        setGuias(enc.guias)
        const d = deltaParaLocal(g.caixa, g.base, fx - p0.x, fy - p0.y)
        gravar(g.caixa, moverNos(g.base, g.refs, d.x, d.y), false)
        break
      }
      case 'alca': {
        g.moveu = true
        const local = cenaParaLocal(g.caixa, g.base, semEncaixe ? pc : { x: Math.round(pc.x), y: Math.round(pc.y) })
        gravar(g.caixa, moverAlca(g.base, g.ref, g.qual, local, ev.altKey), false)
        break
      }
      case 'curvarNo': {
        if (!g.moveu && dist(pt, g.inicio) < 3) return
        g.moveu = true
        gravar(g.caixa, puxarAlcas(g.base, g.ref, cenaParaLocal(g.caixa, g.base, pc), !ev.altKey), false)
        break
      }
      case 'curvarSeg': {
        g.moveu = true
        gravar(g.caixa, curvarSegmento(g.base, g.c, g.i, g.t, cenaParaLocal(g.caixa, g.base, pc)), false)
        break
      }
      case 'caneta': {
        if (!g.moveu && dist(telaDe(pc), telaDe(g.inicio)) < 3) return
        g.moveu = true
        gravar(g.caixa, definirAlcasDoNo(g.base, g.ref, cenaParaLocal(g.caixa, g.base, pc), g.inverter), false)
        break
      }
      case 'area':
        g.atual = pt
        g.moveu = g.moveu || dist(g.inicio, pt) > 3
        if (camada && v && g.moveu) {
          const x0 = Math.min(g.inicio.x, pt.x), x1 = Math.max(g.inicio.x, pt.x), y0 = Math.min(g.inicio.y, pt.y), y1 = Math.max(g.inicio.y, pt.y)
          const dentro = todosOsNos(v).filter((r) => { const q = lt(camada, v, v.caminhos[r.c]!.nos[r.i]!); return q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1 })
          setSel(unir(g.base, dentro))
        }
        forcar((n) => n + 1)
        break
      case 'laco':
        g.pontos.push(pt)
        if (camada && v) {
          const refs = todosOsNos(v)
          const dentro = pontosNoLaco(g.pontos, refs.map((r) => lt(camada, v, v.caminhos[r.c]!.nos[r.i]!))).map((k) => refs[k]!)
          setSel(unir(g.base, dentro))
        }
        forcar((n) => n + 1)
        break
    }
  }

  const onPointerUp = () => {
    const g = gesto.current
    gesto.current = null
    setGuias([])
    if (!g) return
    const idGesto = 'caixa' in g ? g.caixa.id : camadaId
    const atual = editor.acoes.documentoAtual().scenes.find((s) => s.id === editor.estado.cenaId)?.layers.find((l) => l.id === idGesto)
    const finalizar = (caixa: Caixa, antes: DocumentoProjeto) => {
      if (atual?.type === 'shape' && atual.vetor) gravar(caixa, atual.vetor, true)
      historico(antes)
    }
    switch (g.tipo) {
      case 'nos': case 'alca': case 'curvarSeg':
        if (g.moveu) finalizar(g.caixa, g.antes)
        break
      case 'curvarNo':
        if (g.moveu) finalizar(g.caixa, g.antes)
        else if (camada && v) aplicarJa(alternarTipoNo(v, g.ref))
        break
      case 'caneta': {
        const cam = atual?.type === 'shape' ? atual.vetor?.caminhos[g.ref.c] : undefined
        // camada nova só entra no histórico quando o caminho tiver dois nós
        if (antesDaCriacao.current && (cam?.nos.length ?? 0) < 2) { if (g.moveu) gravar(g.caixa, atual?.type === 'shape' && atual.vetor ? atual.vetor : g.base, true); break }
        finalizar(g.caixa, g.antes)
        break
      }
      case 'area':
        if (!g.moveu) {
          // clique no vazio: limpa a seleção de nós; fora da camada e sem seleção, sai do modo (como no Figma)
          const dentro = camada && v ? (() => { const q = cenaParaLocal(camada, v, cenaDe(g.inicio)); return q.x >= 0 && q.y >= 0 && q.x <= v.w && q.y <= v.h })() : false
          if (sel.length) setSel([])
          else if (!dentro) aoSair(camadaId)
        }
        forcar((n) => n + 1)
        break
      case 'laco':
        forcar((n) => n + 1)
        break
    }
  }

  // ---------- teclado (antes dos atalhos do editor) ----------
  const estadoTeclado = useRef({ sel, v, camada, desenho, ferramenta })
  estadoTeclado.current = { sel, v, camada, desenho, ferramenta }
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)) return
      if (e.code === 'Space' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta' || e.key === 'Control') return
      const mod = e.metaKey || e.ctrlKey
      const { sel: s, v: vv, camada: c, desenho: d } = estadoTeclado.current
      if (mod && e.key.toLowerCase() === 'a' && vv) { e.preventDefault(); e.stopPropagation(); setSel(todosOsNos(vv)); return }
      if (mod) return // ⌘Z, ⌘S etc. continuam com o editor
      e.stopPropagation()
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        if (d) { setDesenho(null); return }
        aoSair(camadaId)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && vv && c && s.length) {
        e.preventDefault()
        setSel([])
        aplicarJa(removerNos(vv, s))
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && vv && c && s.length) {
        e.preventDefault()
        const p = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -p : e.key === 'ArrowRight' ? p : 0
        const dy = e.key === 'ArrowUp' ? -p : e.key === 'ArrowDown' ? p : 0
        const dl = deltaParaLocal(c, vv, dx, dy)
        aplicarJa(moverNos(vv, s, dl.x, dl.y))
        return
      }
      if (e.shiftKey && e.code === 'KeyB') { setFerramenta('pintar'); return }
      const f = !e.shiftKey && !e.altKey ? TECLAS[e.code] : undefined
      if (f) { e.preventDefault(); setFerramenta(f) }
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [aoSair, camadaId, aplicarJa, setFerramenta])

  // ---------- desenho ----------
  const g = gesto.current
  const chaves = new Set(sel.map(chaveNo))
  const caminhoTela = (vv: Vetor, c: Caixa, filtro?: (k: Vetor['caminhos'][number]) => boolean) => {
    const mapa = (p: P) => lt(c, vv, p)
    const m: Vetor = { ...vv, caminhos: vv.caminhos.filter((k) => (filtro ? filtro(k) : true)).map((k) => ({ ...k, nos: k.nos.map((n) => ({ ...n, ...mapa(n), ...(n.entrada ? { entrada: mapa(n.entrada) } : {}), ...(n.saida ? { saida: mapa(n.saida) } : {}) })) })) }
    return vetorParaD(m)
  }
  const hoverSeg = hover?.tipo === 'seg' && hover.i >= 0 && camada && v ? (() => { const cam = v.caminhos[hover.c]; const s = cam ? segmentos({ ...v, caminhos: [cam] }).find((x) => x.i === hover.i) : undefined; return s ? segTela(s) : null })() : null
  const regiaoPintar = ferramenta === 'pintar' && hover?.tipo === 'seg' && hover.i === -1 && camada && v ? caminhoTela({ ...v, caminhos: v.caminhos.filter((_, k) => k === hover.c) }, camada) : null
  const pontaCaneta = ferramenta === 'caneta' && desenho && camada && v && cursor && !g ? (() => { const cam = v.caminhos[desenho.c]; const n = cam ? (desenho.inicio ? cam.nos[0] : cam.nos[cam.nos.length - 1]) : undefined; return n ? lt(camada, v, n) : null })() : null
  const cursorCss = modoMao ? undefined : ferramenta === 'caneta' ? 'crosshair' : ferramenta === 'curvar' ? (hover ? 'pointer' : 'default') : ferramenta === 'cortar' ? (hover ? 'crosshair' : 'default') : ferramenta === 'apagar' ? (hover ? 'pointer' : 'default') : ferramenta === 'pintar' ? (hover ? 'cell' : 'default') : hover?.tipo === 'no' || hover?.tipo === 'alca' ? 'move' : 'default'
  const ativa = FERRAMENTAS.find((f) => f.id === ferramenta)!

  return (
    <div ref={ref} data-testid="editor-vetor" className="absolute inset-0 z-40" style={{ cursor: cursorCss, pointerEvents: modoMao ? 'none' : undefined }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={() => { setHover(null); setCursor(null) }} onDoubleClick={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation() }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        {camada && v && (
          <>
            {regiaoPintar && <path d={regiaoPintar} fill="rgb(var(--cor-selecao) / .18)" fillRule="nonzero" stroke="none" />}
            <path d={caminhoTela(v, camada)} fill="none" stroke={ACENTO} strokeWidth={1.5} data-testid="contorno-vetor" />
            {hoverSeg && ferramenta !== 'pintar' && (
              <path d={`M${hoverSeg.p0.x} ${hoverSeg.p0.y} C${hoverSeg.p1.x} ${hoverSeg.p1.y} ${hoverSeg.p2.x} ${hoverSeg.p2.y} ${hoverSeg.p3.x} ${hoverSeg.p3.y}`} fill="none" stroke={ferramenta === 'apagar' ? 'rgb(var(--cor-guia))' : ACENTO} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={ferramenta === 'cortar' ? '4 3' : undefined} />
            )}
            {alcasVisiveis(v).map(({ ref: r, qual }) => {
              const no = v.caminhos[r.c]!.nos[r.i]!
              const a = lt(camada, v, no)
              const b = lt(camada, v, no[qual]!)
              const sobre = hover?.tipo === 'alca' && chaveNo(hover.ref) === chaveNo(r) && hover.qual === qual
              return (
                <g key={`${chaveNo(r)}${qual}`}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACENTO} strokeWidth={1} />
                  <circle cx={b.x} cy={b.y} r={sobre ? 4.5 : 3.5} fill={ACENTO} stroke="#fff" strokeWidth={1.25} data-alca-vetor={qual} />
                </g>
              )
            })}
            {v.caminhos.map((cam, c) => cam.nos.map((no, i) => {
              const q = lt(camada, v, no)
              const s = chaves.has(chaveNo({ c, i }))
              const sobre = hover?.tipo === 'no' && hover.ref.c === c && hover.ref.i === i
              const apagar = sobre && ferramenta === 'apagar'
              const fechar = ferramenta === 'caneta' && desenho?.c === c && sobre
              return <circle key={`${c}:${i}`} cx={q.x} cy={q.y} r={sobre || fechar ? 5.5 : 4.5} fill={apagar ? 'rgb(var(--cor-guia))' : s ? ACENTO : '#fff'} stroke={apagar ? '#fff' : s ? '#fff' : ACENTO} strokeWidth={1.5} data-no-vetor={`${c}:${i}`} data-selecionado={s || undefined} />
            }))}
          </>
        )}
        {pontaCaneta && cursor && <line x1={pontaCaneta.x} y1={pontaCaneta.y} x2={cursor.x} y2={cursor.y} stroke={ACENTO} strokeWidth={1} strokeDasharray="4 3" />}
        {g?.tipo === 'area' && g.moveu && <rect x={Math.min(g.inicio.x, g.atual.x)} y={Math.min(g.inicio.y, g.atual.y)} width={Math.abs(g.atual.x - g.inicio.x)} height={Math.abs(g.atual.y - g.inicio.y)} fill="rgb(var(--cor-selecao) / .08)" stroke={ACENTO} strokeWidth={1} />}
        {g?.tipo === 'laco' && g.pontos.length > 1 && <polygon points={g.pontos.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgb(var(--cor-selecao) / .08)" stroke={ACENTO} strokeWidth={1} strokeDasharray="4 3" />}
      </svg>
      <GuiasCanvas s={{ guias, espacos: [], medidas: [] }} paraTela={paraTela} />

      {/* barra contextual do modo vetor */}
      <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-3 lg:bottom-4">
        <div role="toolbar" aria-label="Editar vetor" data-testid="barra-vetor" className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-borda bg-superficie p-1 shadow-painel" onPointerDown={(e) => e.stopPropagation()}>
          <span className="rotulo-mono hidden px-2 !text-[10px] sm:inline">Editar vetor</span>
          {FERRAMENTAS.map((f) => (
            <button key={f.id} type="button" aria-label={f.rotulo} aria-pressed={ferramenta === f.id} title={`${f.rotulo} (${f.tecla}) — ${f.dica}`} onClick={() => setFerramenta(f.id)} className={cx('inline-flex h-8 w-8 items-center justify-center rounded-md text-texto2 hover:bg-hover hover:text-texto', ferramenta === f.id && 'bg-grafite/90 text-white hover:bg-grafite hover:text-white')}>
              {f.icone}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-borda" />
          <button type="button" aria-label="Concluir edição do vetor" title="Concluir (Esc ou Enter)" onClick={() => aoSair(camadaId)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-acento px-2.5 text-[12px] font-medium text-white hover:bg-acento/90">
            <Check className="h-3.5 w-3.5" /> Concluir
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[6.5rem] hidden justify-center lg:bottom-16 lg:flex">
        <span className="rounded-md bg-grafite/85 px-2 py-1 text-[11px] text-white">{ativa.rotulo}: {ativa.dica}</span>
      </div>
    </div>
  )
}

function unir(a: readonly RefNo[], b: readonly RefNo[]): RefNo[] {
  const m = new Map([...a, ...b].map((r) => [chaveNo(r), r]))
  return [...m.values()]
}
