'use client'
/**
 * Canvas do editor (camadas DOM + Pointer Events, sem canvas raster).
 * - Seleção: clique (frame/grupo externo), Shift+clique, ⌘/Ctrl+clique seleciona direto a camada funda,
 *   duplo clique entra no frame/grupo ou edita texto, arrastar no vazio = área
 * - Mover com encaixe estilo Figma (bordas, centros, tela, espaçamento igual, grade); limiar de 5 px de tela;
 *   Shift trava o eixo; ⌘/Ctrl desliga o encaixe; Alt mostra distâncias até a camada sob o cursor;
 *   Alt ao começar a arrastar duplica (a cópia é arrastada, o original fica; um único desfazer)
 * - Redimensionar (8 alças) com encaixe; Shift proporcional, Alt a partir do centro
 * - Auto layout: arrastar um filho reordena (linha azul); soltar fora tira do frame; soltar sobre um frame coloca dentro
 * - Ferramenta Texto: clique cria texto com largura automática já em edição; arrastar cria largura fixa
 * - Ferramentas Frame/Retângulo/Elipse/Hotspot: arraste para desenhar (ou clique para tamanho padrão);
 *   Linha/Seta: arraste do início ao fim (Shift = passos de 45°)
 * - Zoom no cursor (Ctrl/⌘ + roda, pinça), pan (roda, espaço+arrastar, botão do meio, ferramenta Mão)
 * - Soltar arquivos/SVG/links na posição do cursor
 * - Frações da tela (1/2, 1/3, 2/3, 1/4, 3/4) e grade de layout de 12 colunas como alvos de encaixe (com rótulo)
 * - Editar vetor: duplo clique (ou Enter) numa forma/SVG selecionada, ou caneta (P) — ver vetor/EditorVetor.tsx
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Camada, CamadaFrame, CamadaTexto, DocumentoProjeto } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { encaixar, guiasDaCaixa, intersecta, anguloRotacao, limiarEmCena, medirDistancias, redimensionarComEncaixe, LIMIAR_TELA } from '@/lib/editor/guias'
import { areasDeEspaco, indiceDeInsercao, type Insercao, type TipoEspaco } from '@/lib/editor/autolayout'
import { alvoDoClique, ancestrais, comDescendentes, mapaDe, ocultasEfetivas, paiDe, raizDe, raizesDaSelecao, temAutoLayout } from '@/lib/scene/arvore'
import { camadaNoPonto, contemPonto, envolvente, type Alca, type Retangulo } from '@/lib/scene/transform'
import { indiceNoPonto, medirTexto, textoAutomatico } from '@/lib/editor/medirTexto'
import { FERRAMENTAS_DESENHO, FORMA_DA_FERRAMENTA, caixaDeLinha } from '@/lib/editor/atalhos'
import { pilhaFonte } from '@/lib/design-tokens'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { useTamanho } from '@/components/renderer/useTamanho'
import { MiniaturaCena } from './MiniaturaCena'
import { ColunasCanvas, GuiasCanvas, LinhaInsercao, PreviaRegiao, SEM_SOBREPOSICAO, type Sobreposicao } from './GuiasCanvas'
import { CamadaPresenca } from './Presenca'
import { alvosDeFracao, colunasDaGrade, gradeLayoutPadrao } from '@/lib/editor/preencher'
import { EVENTO_PREVIA } from './PreencherGrade'
import { EditorVetor, type FerramentaVetor } from './vetor/EditorVetor'
import { editavelComoVetor, formasDoSvg } from '@/lib/editor/vetor/camadas'
import { normalizarZ } from '@/lib/scene/order'
import { lerDataTransfer } from '@/lib/importar/clipboard'
import { importarConteudo, type Avisar } from '@/lib/editor/importar'
import type { AssetDemo } from '@/lib/demo/tipos'

/** Cursor de duplicar (seta com uma segunda seta menor), preta com contorno branco; ponta em (3, 2). */
const SVG_DUPLICAR = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M3 2v15l4-3.5 2.6 5.8 2.4-1-2.5-5.7h5Z" fill="#171717" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/><path d="M14.5 12.5v8l2.2-1.9 1.4 3.1 1.3-.55-1.35-3.1h2.75Z" fill="#171717" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>'
const CURSOR_DUPLICAR = `url("data:image/svg+xml,${encodeURIComponent(SVG_DUPLICAR)}") 3 2, copy`

const ALCAS: Alca[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CURSORES: Record<Alca, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }
const ZOOM_MIN = 0.05
const ZOOM_MAX = 8

type Gesto =
  | { tipo: 'mover'; inicio: { x: number; y: number }; iniciais: Map<string, Retangulo>; raizes: string[]; caixa: Retangulo; moveu: boolean; antes: DocumentoProjeto; fluxo: boolean; delta: { x: number; y: number }; ponteiro: { x: number; y: number }; duplicar: boolean }
  | { tipo: 'redimensionar'; alca: Alca; inicio: { x: number; y: number }; caixa: Retangulo; iniciais: Map<string, Retangulo>; antes: DocumentoProjeto; moveu?: boolean }
  | { tipo: 'rotacionar'; centro: { x: number; y: number }; id: string; antes: DocumentoProjeto }
  | { tipo: 'area'; inicio: { x: number; y: number }; atual: { x: number; y: number }; base: string[] }
  | { tipo: 'desenhar'; inicio: { x: number; y: number }; atual: { x: number; y: number }; manterFerramenta: boolean }
  | { tipo: 'pan'; inicio: { x: number; y: number }; panInicial: { x: number; y: number } }

interface EdicaoTexto {
  id: string
  /** Documento antes da sessão de edição (um passo de desfazer por sessão). */
  antes: DocumentoProjeto
  nova: boolean
  /** Onde pôr o cursor: índice, 'fim' ou 'tudo' (Enter seleciona tudo, como no Figma). */
  cursor: number | 'fim' | 'tudo'
}

type EstiloTexto = Partial<Pick<CamadaTexto, 'fontFamily' | 'fontSize' | 'fontWeight' | 'color' | 'lineHeight' | 'letterSpacing' | 'italic' | 'transform'>>

export function Canvas({ editor, assets, avisar, interagir3d = false, aoEscala }: { editor: Editor; assets: Record<string, AssetDemo>; avisar: Avisar; interagir3d?: boolean; aoEscala?: (s: number) => void }) {
  const { estado, cena, acoes, indiceCena } = editor
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const gesto = useRef<Gesto | null>(null)
  const [, forcar] = useState(0)
  const [sobre, setSobre] = useState<Sobreposicao>(SEM_SOBREPOSICAO)
  const [insercao, setInsercao] = useState<(Insercao & { frameId: string }) | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<EdicaoTexto | null>(null)
  const editandoTexto = edicao?.id ?? null
  const [espaco, setEspaco] = useState(false)
  const [alt, setAlt] = useState(false)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
  const [previaAtiva, setPreviaAtiva] = useState(false)
  const [guiasTemporarias, setGuiasTemporarias] = useState(0)
  const [fontesProntas, setFontesProntas] = useState(0)
  // inspetor: mouse sobre gap/padding do auto layout destaca a área (rosa, como no Figma)
  const [espacoRealce, setEspacoRealce] = useState<{ frameId: string; tipo: TipoEspaco } | null>(null)
  useEffect(() => {
    const f = (e: Event) => setEspacoRealce((e as CustomEvent<{ frameId: string; tipo: TipoEspaco } | null>).detail)
    window.addEventListener('mostra:destacar-espaco', f)
    return () => window.removeEventListener('mostra:destacar-espaco', f)
  }, [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const estiloTexto = useRef<EstiloTexto>({})
  /** Modo "Editar vetor": camada em edição (null = caneta antes do primeiro clique). */
  const [modoVetor, setModoVetor] = useState<{ id: string | null; ferramenta: FerramentaVetor } | null>(null)
  const [previaPreencher, setPreviaPreencher] = useState<Retangulo | null>(null)
  const estadoRef = useRef(estado)
  estadoRef.current = estado

  // prévia de animação: o canvas renderiza em modo apresentação por alguns segundos e volta ao modo edição
  useEffect(() => {
    if (!estado.previa) return
    setPreviaAtiva(true)
    const t = window.setTimeout(() => setPreviaAtiva(false), 2600)
    return () => window.clearTimeout(t)
  }, [estado.previa])

  // ---------- viewport ----------
  const vp = useMemo(() => {
    if (!cena || !tamanho.width) return null
    const padX = tamanho.width < 700 ? 48 : 128
    const ajuste = Math.max(ZOOM_MIN, Math.min((tamanho.width - padX) / cena.size.width, (tamanho.height - 160) / cena.size.height))
    const s = estado.zoom || ajuste
    // origem da tela em pixels inteiros do dispositivo: bordas encostadas não deixam fresta (o renderizador
    // arredonda as bordas das camadas relativas a esta origem)
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const px = (v: number) => Math.round(v * dpr) / dpr
    const ox = px((tamanho.width - cena.size.width * s) / 2 + estado.pan.x)
    const oy = px((tamanho.height - cena.size.height * s) / 2 + estado.pan.y)
    return { s, ox, oy, ajuste }
  }, [cena, tamanho, estado.zoom, estado.pan])

  useEffect(() => { if (vp) aoEscala?.(vp.s) }, [vp, aoEscala])

  const local = useCallback((ev: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }, [ref])
  const paraCena = useCallback((p: { x: number; y: number }) => (vp ? { x: (p.x - vp.ox) / vp.s, y: (p.y - vp.oy) / vp.s } : p), [vp])
  const paraTela = useCallback((r: Retangulo) => (vp ? { x: vp.ox + r.x * vp.s, y: vp.oy + r.y * vp.s, width: r.width * vp.s, height: r.height * vp.s } : r), [vp])

  // presença: o cursor desta pessoa (em coordenadas da tela) vai para a sala, para as outras verem
  const sala = editor.sala
  useEffect(() => {
    const el = ref.current
    if (!el || !sala) return
    const mover = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') return
      const p = paraCena(local(ev))
      sala.presenca({ cursor: { x: Math.round(p.x), y: Math.round(p.y) } })
    }
    const sair = () => sala.presenca({ cursor: null })
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerleave', sair)
    return () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerleave', sair) }
  }, [ref, sala, paraCena, local])

  const zoomEm = useCallback(
    (novo: number, p: { x: number; y: number }) => {
      if (!vp || !cena) return
      const s2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, novo))
      const ox2 = p.x - (p.x - vp.ox) * (s2 / vp.s)
      const oy2 = p.y - (p.y - vp.oy) * (s2 / vp.s)
      acoes.ui({ zoom: s2, pan: { x: ox2 - (tamanho.width - cena.size.width * s2) / 2, y: oy2 - (tamanho.height - cena.size.height * s2) / 2 } })
    },
    [vp, cena, acoes, tamanho]
  )

  // espaço segurado = mão temporária; Alt segurado = medir distâncias
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable
      if (e.code === 'Space' && !digitando) { e.preventDefault(); setEspaco(true) }
      if (e.key === 'Alt' && !digitando) { e.preventDefault(); setAlt(true) }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setEspaco(false); if (e.key === 'Alt') setAlt(false) }
    const sair = () => { setAlt(false); setEspaco(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', sair)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', sair) }
  }, [])

  // roda: pan; Ctrl/⌘ (e pinça do trackpad): zoom no cursor
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      if (!vp) return
      if (e.ctrlKey || e.metaKey) zoomEm(vp.s * Math.exp(-e.deltaY * 0.0022), local(e))
      else acoes.ui({ pan: { x: estado.pan.x - e.deltaX, y: estado.pan.y - e.deltaY }, zoom: estado.zoom || vp.s })
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [ref, vp, zoomEm, local, acoes, estado.pan, estado.zoom])

  // Enter num texto selecionado (EditorShell) entra em edição com tudo selecionado
  useEffect(() => {
    const f = (e: Event) => { const id = (e as CustomEvent<{ id: string }>).detail.id; setEdicao({ id, antes: acoes.documentoAtual(), nova: false, cursor: 'tudo' }) }
    const g = () => setGuiasTemporarias(Date.now() + 700)
    window.addEventListener('mostra:editar-texto', f)
    window.addEventListener('mostra:empurrou', g)
    return () => { window.removeEventListener('mostra:editar-texto', f); window.removeEventListener('mostra:empurrou', g) }
  }, [acoes])

  // ⇧2: zoom na seleção (centraliza e ajusta com margem), como no Figma
  useEffect(() => {
    const z = () => {
      const est = editor.estado
      const c = est.documento.scenes.find((x) => x.id === est.cenaId)
      const sel = c?.layers.filter((l) => est.selecao.includes(l.id)) ?? []
      if (!c || !sel.length || !tamanho.width) return
      const caixa = envolvente(sel)
      const s2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min((tamanho.width - 160) / Math.max(1, caixa.width), (tamanho.height - 160) / Math.max(1, caixa.height))))
      const ox = tamanho.width / 2 - (caixa.x + caixa.width / 2) * s2
      const oy = tamanho.height / 2 - (caixa.y + caixa.height / 2) * s2
      acoes.ui({ zoom: s2, pan: { x: ox - (tamanho.width - c.size.width * s2) / 2, y: oy - (tamanho.height - c.size.height * s2) / 2 } })
    }
    window.addEventListener('mostra:zoom-selecao', z)
    return () => window.removeEventListener('mostra:zoom-selecao', z)
  }, [editor.estado, acoes, tamanho])
  useEffect(() => {
    if (!guiasTemporarias) return
    const t = window.setTimeout(() => setGuiasTemporarias(0), Math.max(0, guiasTemporarias - Date.now()))
    return () => window.clearTimeout(t)
  }, [guiasTemporarias])

  // fontes web mudam a medida dos textos automáticos
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    const f = () => setFontesProntas((n) => n + 1)
    document.fonts.addEventListener('loadingdone', f)
    void document.fonts.ready.then(f)
    return () => document.fonts.removeEventListener('loadingdone', f)
  }, [])

  // textos com largura/altura automática: mede no DOM e grava no documento (sem passo de desfazer)
  useLayoutEffect(() => {
    if (!cena) return
    const mudancas = new Map<string, { width: number; height: number; x: number }>()
    const mapa = mapaDe(cena.layers)
    for (const l of cena.layers) {
      if (!textoAutomatico(l)) continue
      const m = medirTexto(l)
      if (Math.abs(m.width - l.width) < 0.5 && Math.abs(m.height - l.height) < 0.5) continue
      // largura automática cresce conforme o alinhamento (centro: para os dois lados; direita: para a esquerda)
      const dw = m.width - l.width
      const livre = !temAutoLayout(paiDe(l, mapa))
      const x = livre && l.sizingW === 'hug' ? (l.align === 'center' ? Math.round(l.x - dw / 2) : l.align === 'right' ? l.x - dw : l.x) : l.x
      mudancas.set(l.id, { ...m, x })
    }
    if (!mudancas.size) return
    acoes.atualizarCamadas([...mudancas.keys()], (l) => ({ ...l, ...mudancas.get(l.id)! }), false, { manterDimensionamento: true })
  }, [cena, acoes, fontesProntas])

  // lembra o estilo do último texto selecionado (o próximo texto criado com T usa o mesmo)
  const unicaId = estado.selecao.length === 1 ? estado.selecao[0] : undefined
  useEffect(() => {
    const t = cena?.layers.find((l) => l.id === unicaId)
    if (t?.type === 'text') estiloTexto.current = { fontFamily: t.fontFamily, fontSize: t.fontSize, fontWeight: t.fontWeight, color: t.color, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, italic: t.italic, transform: t.transform }
  }, [unicaId, cena])

  // foco do editor de texto sem rolar a área (antes o autoFocus "pulava" a tela para o topo)
  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!edicao || !ta) return
    ta.focus({ preventScroll: true })
    const n = ta.value.length
    if (edicao.cursor === 'tudo') ta.setSelectionRange(0, n)
    else if (edicao.cursor === 'fim') ta.setSelectionRange(n, n)
    else ta.setSelectionRange(Math.min(edicao.cursor, n), Math.min(edicao.cursor, n))
    ref.current?.scrollTo?.(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicao?.id])

  // ---------- editar vetor ----------
  const entrarVetor = useCallback(async (l: Camada | undefined) => {
    if (!editavelComoVetor(l)) return
    setHover(null)
    if (l.type === 'shape') { setModoVetor({ id: l.id, ferramenta: 'mover' }); return }
    // SVG: vira formas editáveis (uma por cor), num passo de desfazer
    const markup = l.markup ?? (l.assetId && assets[l.assetId]?.url ? await fetch(assets[l.assetId]!.url).then((r) => r.text()).catch(() => '') : '')
    const c = editor.acoes.documentoAtual().scenes.find((x) => x.id === estadoRef.current.cenaId)
    const formas = markup && c ? formasDoSvg(l, markup, c.layers, new DOMParser()) : null
    if (!formas) { avisar('Este SVG não tem caminhos editáveis (só imagem ou texto).', 'info'); return }
    acoes.transformarCena((cc) => {
      const i = cc.layers.findIndex((x) => x.id === l.id)
      if (i < 0) return cc
      const layers = [...cc.layers]
      layers.splice(i, 1, ...formas)
      return { ...cc, layers: normalizarZ(layers) }
    })
    if (formas.length > 1) avisar(`SVG convertido em ${formas.length} vetores agrupados (um por cor).`, 'info')
    acoes.selecionarExato([formas[0]!.id])
    setModoVetor({ id: formas[0]!.id, ferramenta: 'mover' })
  }, [acoes, assets, avisar, editor.acoes])

  const sairVetor = useCallback((id: string | null) => {
    setModoVetor(null)
    const c = editor.acoes.documentoAtual().scenes.find((x) => x.id === estadoRef.current.cenaId)
    const l = id ? c?.layers.find((x) => x.id === id) : undefined
    // caminho da caneta com um nó só não fica
    if (l?.type === 'shape' && l.vetor && l.vetor.caminhos.every((k) => k.nos.length < 2)) acoes.removerCamadas([l.id], false)
    else if (l) acoes.selecionarExato([l.id])
    if (estadoRef.current.ferramenta === 'caneta') acoes.setFerramenta('mover')
  }, [acoes, editor.acoes])
  const criouVetor = useCallback((id: string) => setModoVetor({ id, ferramenta: 'caneta' }), [])

  useEffect(() => {
    const f = (e: Event) => { const id = (e as CustomEvent<{ id: string }>).detail.id; void entrarVetor(editor.acoes.documentoAtual().scenes.find((x) => x.id === estadoRef.current.cenaId)?.layers.find((l) => l.id === id)) }
    const p = (e: Event) => setPreviaPreencher((e as CustomEvent<Retangulo | null>).detail)
    window.addEventListener('mostra:editar-vetor', f)
    window.addEventListener(EVENTO_PREVIA, p)
    return () => { window.removeEventListener('mostra:editar-vetor', f); window.removeEventListener(EVENTO_PREVIA, p) }
  }, [entrarVetor, editor.acoes])

  // trocar de tela, desfazer a conversão ou apagar a camada encerra o modo; desfazer não tira a seleção da camada
  useEffect(() => {
    if (!modoVetor?.id) return
    if (!cena?.layers.some((l) => l.id === modoVetor.id && l.type === 'shape')) setModoVetor(null)
    else if (!estado.selecao.length) acoes.selecionarExato([modoVetor.id])
    // escolheu outra camada (painel de camadas): sai do modo
    else if (!estado.selecao.includes(modoVetor.id)) setModoVetor(null)
  }, [cena, modoVetor, estado.selecao, acoes])

  if (!cena) return null
  const camadas = cena.layers
  const mapa = mapaDe(camadas)
  const ocultas = ocultasEfetivas(camadas)
  const selecionadas = camadas.filter((l) => estado.selecao.includes(l.id))
  const caixaSel = selecionadas.length ? envolvente(selecionadas) : null
  const unica = selecionadas.length === 1 ? selecionadas[0]! : null
  const ehDesenho = FERRAMENTAS_DESENHO.includes(estado.ferramenta)
  const linear = estado.ferramenta === 'linha' || estado.ferramenta === 'seta'
  const modoMao = estado.ferramenta === 'mao' || espaco
  const grade = estado.grade ? estado.gradePasso : 0
  const naGrade = (v: number) => (grade ? Math.round(v / grade) * grade : Math.round(v))
  const interacoesVisiveis = estado.abaDireita === 'interacoes' && estado.mostrarHotspots
  const comInteracao = camadas.filter((l) => l.interactions.length > 0)
  const limiar = vp ? limiarEmCena(LIMIAR_TELA, vp.s) : LIMIAR_TELA
  const gradeLayout = estado.colunas ? gradeLayoutPadrao(cena.size) : null
  const extras = alvosDeFracao(cena.size, { fracoes: estado.fracoes, grade: gradeLayout })
  const vetorAtivo = !!modoVetor || estado.ferramenta === 'caneta'
  const visiveisExceto = (excluir: ReadonlySet<string>) => camadas.filter((l) => !excluir.has(l.id) && !ocultas.has(l.id))

  /** Frame sob o ponteiro para soltar (o mais fundo), fora do conjunto que está sendo movido. */
  const frameSob = (p: { x: number; y: number }, excluir: ReadonlySet<string>): CamadaFrame | undefined =>
    camadas
      .filter((l): l is CamadaFrame => l.type === 'frame' && !excluir.has(l.id) && !ocultas.has(l.id) && !l.locked && contemPonto(l, p))
      .sort((a, b) => b.z - a.z)[0]

  // ---------- texto ----------
  const editarTexto = (id: string, cursor: EdicaoTexto['cursor'], nova = false, antes?: DocumentoProjeto) => {
    setHover(null)
    setEdicao({ id, antes: antes ?? acoes.documentoAtual(), nova, cursor })
  }
  const finalizarTexto = () => {
    const ed = edicao
    if (!ed) return
    setEdicao(null)
    const t = editor.acoes.documentoAtual().scenes.flatMap((s) => s.layers).find((l) => l.id === ed.id)
    if (!t || t.type !== 'text') return
    if (!t.text.trim()) {
      // texto vazio é removido ao sair (como no Figma); se era novo, não deixa rastro no histórico
      acoes.removerCamadas([t.id], false)
      if (!ed.nova) acoes.registrarHistorico(ed.antes)
      acoes.selecionarExato([])
      return
    }
    acoes.registrarHistorico(ed.antes)
    acoes.selecionarExato([t.id])
  }
  const criarTextoEm = (r: Retangulo, larguraFixa: boolean) => {
    const antes = acoes.documentoAtual()
    const est = estiloTexto.current
    const fonte = estado.documento.theme?.fontBody
    const fontSize = est.fontSize ?? Math.round(cena.size.width / 26)
    const alturaLinha = Math.ceil(fontSize * (est.lineHeight ?? 1.15))
    // dentro da tela: clicar perto da base cria ali mesmo (nunca pula para o topo)
    const x = Math.round(Math.min(Math.max(0, r.x), cena.size.width - Math.max(1, larguraFixa ? r.width : fontSize)))
    const y = Math.round(Math.min(Math.max(0, r.y), cena.size.height - alturaLinha))
    const nova = acoes.criarCamada(
      { type: 'text', text: '', color: '#171717', ...(fonte ? { fontFamily: fonte } : {}), ...est, fontSize, ...(larguraFixa ? { sizingW: 'fixed', sizingH: 'hug' } : { sizingW: 'hug', sizingH: 'hug' }) },
      { x, y, width: larguraFixa ? Math.max(1, Math.round(r.width)) : 1, height: alturaLinha },
      { historico: false }
    )
    if (nova) editarTexto(nova.id, 'fim', true, antes)
  }

  // ---------- ponteiro ----------
  const onPointerDown = (ev: React.PointerEvent) => {
    if (editandoTexto || !vp) return
    // modo "interagir": o 3D/embed recebe o ponteiro (girar o modelo, dar play no vídeo)
    if (interagir3d && (ev.target as HTMLElement).closest('model-viewer, iframe')) return
    const p = local(ev)
    const pc = paraCena(p)
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    if (ev.button === 1 || modoMao) {
      gesto.current = { tipo: 'pan', inicio: p, panInicial: estado.pan }
      if (!estado.zoom) acoes.ui({ zoom: vp.s })
      return
    }
    if (ev.button !== 0) return
    const alvo = ev.target as HTMLElement
    const alca = alvo.dataset.alca as Alca | 'rot' | undefined
    if (alca === 'rot' && unica) {
      gesto.current = { tipo: 'rotacionar', centro: { x: unica.x + unica.width / 2, y: unica.y + unica.height / 2 }, id: unica.id, antes: acoes.documentoAtual() }
      return
    }
    if (alca && alca !== 'rot' && caixaSel) {
      const moviveis = selecionadas.filter((l) => !l.locked)
      gesto.current = { tipo: 'redimensionar', alca, inicio: pc, caixa: caixaSel, iniciais: new Map(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }])), antes: acoes.documentoAtual() }
      return
    }
    if (ehDesenho) {
      // T sobre um texto existente: edita no ponto clicado
      if (estado.ferramenta === 'texto') {
        const t = camadaNoPonto(cena, pc, { ignorarTravadas: true })
        if (t?.type === 'text') {
          ev.preventDefault()
          editarTexto(t.id, indiceNoPonto(ev.clientX, ev.clientY, ref.current?.querySelector(`[data-layer-id="${t.id}"]`) ?? null) ?? 'fim')
          if (!ev.shiftKey) acoes.setFerramenta('mover')
          return
        }
      }
      gesto.current = { tipo: 'desenhar', inicio: pc, atual: pc, manterFerramenta: ev.shiftKey }
      return
    }
    const atingida = camadaNoPonto(cena, pc, { ignorarTravadas: true })
    const camada = atingida ? alvoDoClique(atingida, camadas, estado.selecao, ev.metaKey || ev.ctrlKey) : undefined
    let ids = estado.selecao
    if (camada) {
      if (ev.shiftKey) ids = ids.includes(camada.id) ? ids.filter((i) => i !== camada.id) : [...ids, camada.id]
      else if (!ids.includes(camada.id)) ids = [camada.id]
      acoes.selecionar(ids)
    } else if (caixaSel && selecionadas.length > 1 && contemPonto(caixaSel, pc)) {
      // clique dentro da caixa de seleção múltipla move tudo
    } else {
      gesto.current = { tipo: 'area', inicio: pc, atual: pc, base: ev.shiftKey ? estado.selecao : [] }
      if (!ev.shiftKey) acoes.selecionar([])
      return
    }
    const idsFinais = camada ? expandir(ids) : estado.selecao
    const raizes = raizesDaSelecao(idsFinais, camadas).filter((id) => !mapa.get(id)?.locked)
    const todos = comDescendentes(raizes, camadas)
    const moviveis = camadas.filter((l) => todos.includes(l.id))
    if (moviveis.length) {
      const raizCamadas = moviveis.filter((l) => raizes.includes(l.id))
      const so = raizCamadas.length === 1 ? raizCamadas[0]! : undefined
      const fluxo = !!so && !so.absolute && temAutoLayout(paiDe(so, mapa))
      gesto.current = { tipo: 'mover', inicio: pc, iniciais: new Map(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }])), raizes, caixa: envolvente(raizCamadas), moveu: false, antes: acoes.documentoAtual(), fluxo, delta: { x: 0, y: 0 }, ponteiro: pc, duplicar: ev.altKey && !fluxo }
    }
  }

  const expandir = (ids: string[]) => {
    const grupos = new Set(camadas.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId))
    return [...new Set([...ids, ...camadas.filter((l) => l.groupId && grupos.has(l.groupId)).map((l) => l.id)])]
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    if (!vp) return
    const p = local(ev)
    const pc = paraCena(p)
    const g = gesto.current
    if (!g) {
      const h = !ehDesenho && !modoMao ? camadaNoPonto(cena, pc, { ignorarTravadas: true }) : undefined
      // com Alt, mede até a camada sob o cursor; sem Alt, destaca o que o clique selecionaria
      const alvoH = h ? (alt ? h : alvoDoClique(h, camadas, estado.selecao, ev.metaKey || ev.ctrlKey)) : undefined
      if ((alvoH?.id ?? null) !== hover) setHover(alvoH?.id ?? null)
      return
    }
    const semEncaixe = !estado.snap || ev.metaKey || ev.ctrlKey
    switch (g.tipo) {
      case 'pan':
        acoes.ui({ pan: { x: g.panInicial.x + (p.x - g.inicio.x), y: g.panInicial.y + (p.y - g.inicio.y) } })
        break
      case 'mover': {
        let dx = pc.x - g.inicio.x
        let dy = pc.y - g.inicio.y
        if (!g.moveu && Math.hypot(dx, dy) * vp.s < 3) return
        if (!g.moveu && g.duplicar) {
          // ⌥+arrastar: deixa o original no lugar e passa a arrastar a cópia (o gesto inteiro é um desfazer)
          const ids = acoes.duplicarParaArrastar([...g.iniciais.keys()])
          if (ids) {
            g.iniciais = new Map([...g.iniciais].map(([id, r]) => [ids.get(id) ?? id, r]))
            g.raizes = g.raizes.map((id) => ids.get(id) ?? id)
            acoes.selecionarExato(g.raizes)
          }
        }
        g.moveu = true
        g.ponteiro = pc
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        const proposta = { ...g.caixa, x: g.caixa.x + dx, y: g.caixa.y + dy }
        const movidos = new Set(g.iniciais.keys())
        let final = { x: naGrade(proposta.x), y: naGrade(proposta.y) }
        if (g.fluxo) final = { x: Math.round(proposta.x), y: Math.round(proposta.y) } // reordenar: só a linha azul, sem guias
        else if (!semEncaixe) {
          const r = encaixar(proposta, visiveisExceto(movidos), cena.size, limiar, { grade, extras })
          final = { x: r.x, y: r.y }
          setSobre({ guias: r.guias, espacos: r.espacos, medidas: r.medidas })
        } else setSobre(SEM_SOBREPOSICAO)
        const fx = final.x - g.caixa.x
        const fy = final.y - g.caixa.y
        g.delta = { x: fx, y: fy }
        // auto layout: alvo de inserção sob o ponteiro (linha azul)
        const f = frameSob(pc, movidos)
        if (f && temAutoLayout(f)) setInsercao({ ...indiceDeInsercao(f, camadas, pc, movidos), frameId: f.id })
        else if (insercao) setInsercao(null)
        if (g.fluxo) { forcar((n) => n + 1); break } // o filho do auto layout só se move ao soltar (fantasma segue o cursor)
        acoes.atualizarCamadas([...g.iniciais.keys()], (l) => { const i = g.iniciais.get(l.id)!; return { ...l, x: Math.round(i.x + fx), y: Math.round(i.y + fy) } }, false)
        break
      }
      case 'redimensionar': {
        // clique sem arrastar não mexe em nada (nem no modo de tamanho do texto): só depois de 3 px de tela
        if (!g.moveu) {
          if (Math.hypot(pc.x - g.inicio.x, pc.y - g.inicio.y) * (vp?.s ?? 1) < 3) break
          g.moveu = true
        }
        const svgUnico = g.iniciais.size === 1 && camadas.find((l) => g.iniciais.has(l.id))?.type === 'svg'
        const movidos = new Set(comDescendentes([...g.iniciais.keys()], camadas))
        const res = redimensionarComEncaixe(g.caixa, g.alca, pc.x - g.inicio.x, pc.y - g.inicio.y, visiveisExceto(movidos), cena.size, limiar, { proporcional: ev.shiftKey || svgUnico, doCentro: ev.altKey, semEncaixe, grade, extras })
        setSobre({ guias: res.guias, espacos: [], medidas: res.medidas })
        const nova = res.caixa
        const sx = nova.width / g.caixa.width
        const sy = nova.height / g.caixa.height
        const proporcional = ev.shiftKey || svgUnico
        acoes.atualizarCamadas([...g.iniciais.keys()], (l) => {
          const i = g.iniciais.get(l.id)!
          if (g.iniciais.size === 1) {
            // alça lateral só mexe no eixo dela (a altura automática do texto continua valendo)
            const soX = !proporcional && !/[ns]/.test(g.alca)
            const soY = !proporcional && !/[ew]/.test(g.alca)
            return { ...l, ...nova, ...(soX ? { y: l.y, height: l.height } : {}), ...(soY ? { x: l.x, width: l.width } : {}) }
          }
          const x = Math.round(nova.x + (i.x - g.caixa.x) * sx)
          const y = Math.round(nova.y + (i.y - g.caixa.y) * sy)
          return { ...l, x, y, width: Math.max(1, Math.round(nova.x + (i.x + i.width - g.caixa.x) * sx) - x), height: Math.max(1, Math.round(nova.y + (i.y + i.height - g.caixa.y) * sy) - y) }
        }, false)
        break
      }
      case 'rotacionar':
        acoes.atualizarCamadas([g.id], { rotation: anguloRotacao(g.centro, pc, ev.shiftKey) } as Partial<Camada>, false)
        break
      case 'area': {
        g.atual = pc
        const area = retDe(g.inicio, g.atual)
        // como no Figma: a área pega o item externo (frame), não os filhos
        const dentro = camadas.filter((l) => !ocultas.has(l.id) && !l.locked && intersecta(area, l)).map((l) => raizDe(l, mapa).id)
        acoes.selecionar([...new Set([...g.base, ...dentro])])
        forcar((n) => n + 1)
        break
      }
      case 'desenhar': {
        const alvo = linear ? (ev.shiftKey ? caixaDeLinha(g.inicio, pc, 1, true).fim : pc) : ev.shiftKey && estado.ferramenta !== 'texto' ? quadrado(g.inicio, pc) : pc
        g.atual = { x: naGrade(alvo.x), y: naGrade(alvo.y) }
        forcar((n) => n + 1)
        break
      }
    }
  }

  const onPointerUp = (ev: React.PointerEvent) => {
    const g = gesto.current
    gesto.current = null
    setSobre(SEM_SOBREPOSICAO)
    const ins = insercao
    setInsercao(null)
    if (!g) return
    if (g.tipo === 'mover' && g.moveu) {
      const movidos = new Set(g.iniciais.keys())
      const raiz = g.raizes.length === 1 ? mapa.get(g.raizes[0]!) : undefined
      const pc = g.ponteiro
      if (g.fluxo && raiz) {
        // filho de auto layout: reordena, entra em outro frame ou sai para onde foi solto
        if (ins) acoes.inserirNoFrame(raiz.id, ins.frameId, ins.indice)
        else {
          const destino = frameSob(pc, movidos)
          acoes.inserirNoFrame(raiz.id, destino?.id, undefined, { x: raiz.x + g.delta.x, y: raiz.y + g.delta.y })
        }
      } else {
        if (ins) g.raizes.forEach((id, k) => acoes.inserirNoFrame(id, ins.frameId, ins.indice + k, undefined, false))
        else if (raiz) {
          // soltar dentro de um frame livre coloca a camada nele; fora, devolve à tela
          const destino = frameSob(pc, movidos)
          const atual = paiDe(raiz, mapa)
          if ((destino?.id ?? undefined) !== (atual?.id ?? undefined) && !(atual && contemPonto(atual, pc) && !destino)) acoes.inserirNoFrame(raiz.id, destino?.id, undefined, undefined, false)
        }
        acoes.registrarHistorico(g.antes)
      }
    } else if ((g.tipo === 'redimensionar' && g.moveu) || g.tipo === 'rotacionar') acoes.registrarHistorico(g.antes)
    if (g.tipo === 'desenhar') {
      const r = retDe(g.inicio, g.atual)
      const pequeno = r.width < 8 && r.height < 8
      if (estado.ferramenta === 'texto') {
        // clique = largura automática no ponto exato; arrastar = largura fixa (quebra linha, altura automática)
        criarTextoEm(pequeno ? { x: g.inicio.x, y: g.inicio.y, width: 1, height: 1 } : r, !pequeno)
      } else if (linear) {
        const seta = estado.ferramenta === 'seta'
        const espessura = seta ? Math.max(16, Math.round(cena.size.width / 50)) : Math.max(2, Math.round(cena.size.width / 480))
        const curto = Math.hypot(g.atual.x - g.inicio.x, g.atual.y - g.inicio.y) < 8
        const fim = curto ? { x: g.inicio.x + cena.size.width * 0.18, y: g.inicio.y } : g.atual
        const { x, y, width, height, rotation } = caixaDeLinha(g.inicio, fim, espessura, ev.shiftKey)
        acoes.criarCamada({ type: 'shape', shape: seta ? 'arrow' : 'line', fill: '#171717', rotation, name: seta ? 'Seta' : 'Linha' }, { x, y, width, height })
      } else {
        const padrao = { width: cena.size.width * 0.18, height: cena.size.width * 0.18 }
        const rect = pequeno ? { x: g.inicio.x, y: g.inicio.y, ...padrao } : r
        const caixa = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) }
        if (estado.ferramenta === 'hotspot') acoes.criarCamada({ type: 'hotspot' }, caixa)
        else if (estado.ferramenta === 'frame') acoes.criarCamada({ type: 'frame', name: 'Frame' }, caixa)
        else acoes.criarCamada({ type: 'shape', shape: FORMA_DA_FERRAMENTA[estado.ferramenta] ?? 'rect' }, caixa)
      }
      if (!g.manterFerramenta && !ev.shiftKey) acoes.setFerramenta('mover')
    }
    forcar((n) => n + 1)
  }

  const onDoubleClick = (ev: React.MouseEvent) => {
    if (editandoTexto) return
    // como no Figma: duplo clique numa alça de texto ajusta a caixa ao texto naquele eixo
    const alcaClicada = (ev.target as HTMLElement).dataset.alca as Alca | 'rot' | undefined
    if (alcaClicada && alcaClicada !== 'rot') {
      if (unica?.type === 'text') {
        const lateral = alcaClicada === 'e' || alcaClicada === 'w'
        const vertical = alcaClicada === 'n' || alcaClicada === 's'
        const patch: Partial<Camada> = lateral ? { sizingW: 'hug', sizingH: 'hug' } : vertical ? { sizingH: 'hug' } : { sizingW: 'hug', sizingH: 'hug' }
        acoes.atualizarCamadas([unica.id], patch)
      }
      return
    }
    const pc = paraCena(local(ev))
    const atingida = camadaNoPonto(cena, pc, { ignorarTravadas: true })
    if (!atingida) return
    // duplo clique numa forma/SVG já selecionada: editar vetor (como no Figma)
    if (unica && unica.id === atingida.id && editavelComoVetor(atingida)) { void entrarVetor(atingida); return }
    // cadeia do frame externo até a camada atingida: o duplo clique desce um nível
    const cadeia: Camada[] = [...ancestrais(atingida, mapa)].reverse()
    cadeia.push(atingida)
    const i = cadeia.reduce((acc, c, k) => (estado.selecao.includes(c.id) ? k : acc), -1)
    const proxima = cadeia[Math.min(cadeia.length - 1, i + 1)]!
    if (proxima.type === 'text' && (proxima.id === atingida.id || i === cadeia.length - 1)) {
      editarTexto(proxima.id, indiceNoPonto(ev.clientX, ev.clientY, ref.current?.querySelector(`[data-layer-id="${proxima.id}"]`) ?? null) ?? 'fim')
      return
    }
    if (cadeia.length > 1) acoes.selecionarExato([proxima.id])
    else if (atingida.groupId) acoes.selecionarExato([atingida.id])
  }

  // ---------- soltar arquivos ----------
  const onDrop = async (ev: React.DragEvent) => {
    ev.preventDefault()
    setArrastandoArquivo(false)
    const assetId = ev.dataTransfer.getData('application/x-mostra-asset')
    const ponto = paraCena(local(ev))
    if (assetId) {
      const a = assets[assetId]
      if (a) acoes.adicionarAsset(a, ponto)
      return
    }
    const bloco = ev.dataTransfer.getData('application/x-mostra-bloco')
    if (bloco) {
      window.dispatchEvent(new CustomEvent('mostra:bloco', { detail: { bloco, ponto } }))
      return
    }
    await importarConteudo(editor, lerDataTransfer(ev.dataTransfer), { ponto, avisar })
  }

  if (!vp) return <div ref={ref} className="h-full w-full bg-canvas" />
  const telaCena = { x: vp.ox, y: vp.oy, width: cena.size.width * vp.s, height: cena.size.height * vp.s }
  const g = gesto.current
  const textoEmEdicao = editandoTexto ? (camadas.find((l) => l.id === editandoTexto) as CamadaTexto | undefined) : undefined
  // ⌥ sobre uma camada (ou arrastando a cópia): cursor de duplicar, como no Figma
  const duplicando = g?.tipo === 'mover' && g.duplicar
  const cursorDuplicar = !g && alt && !ehDesenho && !modoMao && !editandoTexto && !!hover && !mapa.get(hover)?.locked
  const cursor = modoMao ? (g?.tipo === 'pan' ? 'grabbing' : 'grab') : duplicando || cursorDuplicar ? CURSOR_DUPLICAR : estado.ferramenta === 'texto' ? 'text' : ehDesenho ? 'crosshair' : 'default'
  // grade visível: passo configurado, dobrado até ficar legível na tela
  let passoTela = estado.gradePasso * vp.s
  while (passoTela < 6) passoTela *= 2

  // Alt: distâncias da seleção até a camada sob o cursor (ou até o frame pai / a tela)
  const medidasAlt = (() => {
    // só parado (arrastando com ⌥ = duplicar; aí valem as guias de encaixe)
    if (!alt || !caixaSel || editandoTexto || g) return []
    const caixaAtual = caixaSel
    const h = hover && !estado.selecao.includes(hover) ? mapa.get(hover) : undefined
    const pai = unica ? paiDe(unica, mapa) : undefined
    const ref2 = h ?? pai ?? { x: 0, y: 0, width: cena.size.width, height: cena.size.height }
    return medirDistancias(caixaAtual, ref2)
  })()
  const sobreposicao: Sobreposicao = medidasAlt.length
    ? { guias: [], espacos: [], medidas: medidasAlt }
    : !g && guiasTemporarias && caixaSel
      ? guiasDaCaixa(caixaSel, visiveisExceto(new Set(comDescendentes(estado.selecao, camadas))), cena.size)
      : sobre

  return (
    <div
      ref={ref}
      data-testid="canvas-area"
      className={`relative h-full w-full select-none overflow-hidden bg-canvas ${arrastandoArquivo ? 'ring-2 ring-inset ring-acento' : ''}`}
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => { e.preventDefault(); if (!arrastandoArquivo) setArrastandoArquivo(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastandoArquivo(false) }}
      onDrop={onDrop}
      onContextMenu={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('mostra:menu', { detail: { x: e.clientX, y: e.clientY } })) }}
    >
      {/* rótulo da tela */}
      <div className="mono pointer-events-none absolute text-[11px] text-texto2" style={{ left: telaCena.x, top: telaCena.y - 22 }}>
        {String(indiceCena + 1).padStart(2, '0')} — {cena.title || 'Sem título'}
      </div>

      <div data-testid="canvas" className="absolute shadow-[0_1px_3px_rgba(0,0,0,.06),0_20px_50px_-30px_rgba(0,0,0,.35)]" style={{ left: telaCena.x, top: telaCena.y, width: telaCena.width, height: telaCena.height }}>
        <SceneRenderer key={`${cena.id}-${previaAtiva ? estado.previa : 0}`} cena={cena} assets={assets} escala={vp.s} modo={previaAtiva ? 'viewer' : 'editor'} interativoNoEditor={interagir3d} chaveEntrada={`${estado.previa}`} ocultar={editandoTexto ? new Set([editandoTexto]) : undefined} />
        {estado.grade && <div aria-hidden data-testid="grade" className="grade-editor pointer-events-none absolute inset-0 z-[1]" style={{ backgroundSize: `${passoTela}px ${passoTela}px` }} />}
        {estado.documento.mode === 'story' && <div aria-hidden className="pointer-events-none absolute border border-dashed border-texto3/60" style={{ left: '6%', right: '6%', top: '8%', bottom: '10%' }} />}
      </div>

      {/* hover */}
      {hover && !vetorAtivo && !estado.selecao.includes(hover) && (!g || g.tipo === 'mover') && !editandoTexto && (() => { const l = mapa.get(hover); return l ? <Contorno r={paraTela(l)} rot={l.rotation} cor={alt && caixaSel ? 'rgb(var(--cor-guia))' : 'rgb(89 101 242 / .55)'} /> : null })()}

      {/* frames: contorno discreto do frame pai da seleção (contexto) */}
      {unica && !editandoTexto && (() => { const p = paiDe(unica, mapa); return p ? <Contorno r={paraTela(p)} rot={p.rotation} cor="rgb(89 101 242 / .35)" tracejado /> : null })()}

      {/* interações: marcadores numerados e fluxo */}
      {interacoesVisiveis && comInteracao.map((l, i) => {
        const r = paraTela(l)
        return (
          <div key={`h-${l.id}`} className="pointer-events-none absolute" style={{ left: r.x - 6, top: r.y - 6, width: r.width + 12, height: r.height + 12, border: '1px dashed rgb(89 101 242 / .7)', borderRadius: 8, background: 'rgb(89 101 242 / .04)' }}>
            <span className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-acento text-[11px] font-medium text-white">{i + 1}</span>
          </div>
        )
      })}
      {interacoesVisiveis && unica && <FluxoInteracao camada={unica} editor={editor} assets={assets} r={paraTela(unica)} />}

      {/* seleção */}
      {!editandoTexto && !vetorAtivo && selecionadas.map((l) => <Contorno key={l.id} r={paraTela(l)} rot={l.rotation} cor="rgb(89 101 242)" largura={1.5} />)}
      {caixaSel && !editandoTexto && !vetorAtivo && !interacoesVisiveis && !(g?.tipo === 'mover' && g.fluxo && g.moveu) && (() => {
        const r = paraTela(caixaSel)
        const travada = selecionadas.every((l) => l.locked)
        return (
          <>
            {selecionadas.length > 1 && <Contorno r={r} rot={0} cor="rgb(89 101 242)" tracejado />}
            {!travada && (unica ? !unica.rotation : true) && ALCAS.map((a) => {
              const cx = a.includes('w') ? r.x : a.includes('e') ? r.x + r.width : r.x + r.width / 2
              const cy = a.includes('n') ? r.y : a.includes('s') ? r.y + r.height : r.y + r.height / 2
              return <div key={a} data-alca={a} className="absolute z-10 h-2 w-2 border-[1.5px] border-acento bg-white" style={{ left: cx - 4, top: cy - 4, cursor: CURSORES[a] }} />
            })}
            {unica && !travada && <div data-alca="rot" title="Girar (Shift = 15°)" className="absolute z-10 h-3 w-3 rounded-full border-[1.5px] border-acento bg-white" style={{ left: r.x + r.width / 2 - 6, top: r.y - 28, cursor: 'grab' }} />}
            {unica && !travada && <div className="pointer-events-none absolute w-px bg-acento" style={{ left: r.x + r.width / 2, top: r.y - 16, height: 16 }} />}
            <div className="mono pointer-events-none absolute whitespace-nowrap rounded-[4px] bg-acento px-1.5 py-[3px] text-[11px] leading-none text-white" style={{ left: r.x + r.width / 2, top: r.y + r.height + 8, transform: 'translateX(-50%)' }}>
              {rotuloTamanho(caixaSel.width, unica?.sizingW)} × {rotuloTamanho(caixaSel.height, unica?.sizingH)}{unica?.rotation ? ` · ${unica.rotation}°` : ''}
            </div>
          </>
        )
      })()}

      {/* auto layout: fantasma do item arrastado e linha azul de inserção */}
      {g?.tipo === 'mover' && g.fluxo && g.moveu && (() => { const r = paraTela({ ...g.caixa, x: g.caixa.x + g.delta.x, y: g.caixa.y + g.delta.y }); return <div data-testid="fantasma" className="pointer-events-none absolute z-20 border-[1.5px] border-acento bg-acento/15" style={{ left: r.x, top: r.y, width: r.width, height: r.height }} /> })()}
      {insercao && g?.tipo === 'mover' && g.moveu && <LinhaInsercao linha={insercao.linha} paraTela={paraTela} />}

      {/* grade de layout (12 colunas) e prévia de "Preencher" */}
      {espacoRealce && (() => {
        const f = mapa.get(espacoRealce.frameId)
        if (f?.type !== 'frame' || !f.layout) return null
        return areasDeEspaco(f, cena.layers, espacoRealce.tipo).map((r, i) => { const t = paraTela(r); return <div key={i} data-testid="realce-espaco" className="pointer-events-none absolute z-20" style={{ left: t.x, top: t.y, width: t.width, height: t.height, background: 'repeating-linear-gradient(135deg, rgb(242 72 160 / .28) 0 3px, rgb(242 72 160 / .14) 3px 6px)', outline: '1px solid rgb(242 72 160 / .6)' }} /> })
      })()}
      {gradeLayout && <ColunasCanvas colunas={colunasDaGrade(cena.size, gradeLayout)} paraTela={paraTela} />}
      {previaPreencher && <PreviaRegiao r={previaPreencher} paraTela={paraTela} />}

      {/* guias inteligentes, vãos iguais e medidas */}
      <GuiasCanvas s={sobreposicao} paraTela={paraTela} />

      {/* colaboração: seleções e cursores das outras pessoas nesta tela */}
      <CamadaPresenca sala={sala} cenaId={cena.id} camadas={cena.layers} paraTela={paraTela} />

      {/* editar vetor (nós, alças, barra própria) */}
      {vetorAtivo && !editandoTexto && (
        <EditorVetor
          editor={editor}
          camadaId={modoVetor?.id ?? null}
          vp={vp}
          ferramentaInicial={modoVetor?.ferramenta ?? 'caneta'}
          outros={camadas.filter((l) => l.id !== modoVetor?.id && !ocultas.has(l.id))}
          extras={extras}
          modoMao={modoMao}
          aoCriar={criouVetor}
          aoSair={sairVetor}
        />
      )}

      {/* área e desenho */}
      {g?.tipo === 'area' && (() => { const r = paraTela(retDe(g.inicio, g.atual)); return <div className="pointer-events-none absolute border border-acento bg-acento/10" style={{ left: r.x, top: r.y, width: r.width, height: r.height }} /> })()}
      {g?.tipo === 'desenhar' && linear && (() => { const a = paraTela({ ...g.inicio, width: 0, height: 0 }); const b = paraTela({ ...g.atual, width: 0, height: 0 }); return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgb(89 101 242)" strokeWidth={1.5} /></svg> })()}
      {g?.tipo === 'desenhar' && !linear && (() => { const r = paraTela(retDe(g.inicio, g.atual)); return <div className="pointer-events-none absolute border-[1.5px] border-acento bg-acento/10" style={{ left: r.x, top: r.y, width: r.width, height: r.height, borderRadius: estado.ferramenta === 'hotspot' ? 6 : estado.ferramenta === 'elipse' ? '50%' : 0, borderStyle: estado.ferramenta === 'hotspot' ? 'dashed' : 'solid' }} /> })()}

      {/* edição de texto no lugar: o documento muda a cada tecla (sem histórico); um passo de desfazer por sessão */}
      {textoEmEdicao && (() => {
        const r = paraTela(textoEmEdicao)
        const hug = textoEmEdicao.sizingW === 'hug'
        return (
          <textarea
            ref={textareaRef}
            aria-label="Editar texto"
            spellCheck={false}
            defaultValue={textoEmEdicao.text}
            onChange={(e) => { acoes.atualizarCamadas([textoEmEdicao.id], { text: e.target.value } as Partial<Camada>, false); e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0 }}
            onBlur={finalizarTexto}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            wrap={hug ? 'off' : 'soft'}
            className="absolute z-20 resize-none overflow-hidden bg-transparent caret-acento selection:bg-acento/20"
            // um contorno só, fino, exatamente na caixa do texto (o estilo global de foco desenharia outro por fora)
            style={{ outline: '1px solid rgb(89 101 242)', outlineOffset: 0, borderRadius: textoEmEdicao.radius * vp.s, left: r.x, top: r.y, width: r.width + (hug ? 2 : 0), height: r.height, whiteSpace: hug ? 'pre' : 'pre-wrap', wordBreak: 'break-word', fontFamily: pilhaFonte(textoEmEdicao.fontFamily), fontSize: textoEmEdicao.fontSize * vp.s, fontWeight: textoEmEdicao.fontWeight, fontStyle: textoEmEdicao.italic ? 'italic' : undefined, textDecoration: textoEmEdicao.underline ? 'underline' : undefined, color: textoEmEdicao.color, textAlign: textoEmEdicao.align === 'justify' ? 'justify' : textoEmEdicao.align, lineHeight: textoEmEdicao.lineHeight, letterSpacing: textoEmEdicao.letterSpacing * vp.s, padding: textoEmEdicao.padding * vp.s, textTransform: textoEmEdicao.transform === 'none' ? undefined : textoEmEdicao.transform, background: textoEmEdicao.background, transform: textoEmEdicao.rotation ? `rotate(${textoEmEdicao.rotation}deg)` : undefined, transformOrigin: 'center' }}
          />
        )
      })()}

      {arrastandoArquivo && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <span className="rounded-full bg-acento px-4 py-2 text-sm font-medium text-white shadow-suave">Solte para importar: imagens, SVG, vídeo, GLB do Blender, Lottie</span>
        </div>
      )}
    </div>
  )
}

/** "240 Hug" / "Fill" como no rótulo de tamanho do Figma. */
function rotuloTamanho(v: number, d: Camada['sizingW']) {
  return d === 'hug' ? `${Math.round(v)} Hug` : d === 'fill' ? `${Math.round(v)} Fill` : `${Math.round(v)}`
}

function Contorno({ r, rot, cor, largura = 1, tracejado }: { r: Retangulo; rot: number; cor: string; largura?: number; tracejado?: boolean }) {
  return <div className="pointer-events-none absolute" style={{ left: r.x, top: r.y, width: r.width, height: r.height, outline: `${largura}px ${tracejado ? 'dashed' : 'solid'} ${cor}`, transform: rot ? `rotate(${rot}deg)` : undefined }} />
}

/** Cartão "Clique → 05 Aplicações · Morph · 600ms" ligado à camada selecionada (aba Interações). */
function FluxoInteracao({ camada, editor, assets, r }: { camada: Camada; editor: Editor; assets: AssetsResolvidos; r: Retangulo }) {
  const it = camada.interactions.find((i) => i.do.action === 'goToScene')
  if (!it || it.do.action !== 'goToScene') return null
  const alvoId = it.do.targetSceneId
  const idx = editor.estado.documento.scenes.findIndex((s) => s.id === alvoId)
  const alvo = editor.estado.documento.scenes[idx]
  if (!alvo) return null
  const gatilho = { click: 'Clique', hover: 'Hover', sceneEnter: 'Automático', scrollThreshold: 'Scroll' }[it.trigger]
  const tr = it.transition ?? alvo.transition
  const curva = { easeOut: 'Ease out', easeInOut: 'In-out', spring: 'Spring', linear: 'Linear', ease: 'Ease', easeIn: 'Ease in' }[tr?.easing ?? 'easeInOut']
  const topo = r.y + r.height + 6
  return (
    <>
      <div className="pointer-events-none absolute w-px bg-acento" style={{ left: r.x + Math.min(84, r.width / 2), top: topo, height: 64 }} />
      <div className="pointer-events-none absolute flex items-center gap-3 rounded-[10px] border-[1.5px] border-acento bg-white p-2 pr-3 shadow-[0_12px_30px_-12px_rgba(89,101,242,.45)]" style={{ left: r.x + 16, top: topo + 64 }}>
        <MiniaturaCena cena={alvo} assets={assets} largura={78} className="border-0" />
        <div className="whitespace-nowrap">
          <div className="text-[13px] font-medium text-acento">{gatilho} → {String(idx + 1).padStart(2, '0')} {alvo.title}</div>
          <div className="text-[11px] text-texto2">{tr ? `${{ none: 'Instantânea', fade: 'Fade', slide: 'Slide', scale: 'Scale', morph: 'Morph' }[tr.type]} · ${tr.duration}ms · ${curva}` : 'Fade · 400ms'}</div>
        </div>
      </div>
    </>
  )
}

function retDe(a: { x: number; y: number }, b: { x: number; y: number }): Retangulo {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}
function quadrado(a: { x: number; y: number }, b: { x: number; y: number }) {
  const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  return { x: a.x + Math.sign(b.x - a.x || 1) * d, y: a.y + Math.sign(b.y - a.y || 1) * d }
}
