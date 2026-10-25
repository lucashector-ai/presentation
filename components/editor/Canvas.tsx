'use client'
/**
 * Canvas do editor (camadas DOM + Pointer Events, sem canvas raster).
 * - Seleção: clique (frame/grupo externo), Shift+clique, ⌘/Ctrl+clique seleciona direto a camada funda,
 *   duplo clique entra no frame/grupo ou edita texto, arrastar no vazio = área
 * - Mover com encaixe estilo Figma (bordas, centros, tela, espaçamento igual, grade); limiar de 5 px de tela;
 *   Shift trava o eixo; ⌘/Ctrl desliga o encaixe; Alt mostra distâncias até a camada sob o cursor;
 *   Alt ao começar a arrastar duplica (a cópia é arrastada, o original fica; um único desfazer)
 * - Redimensionar: 4 alças nos cantos + bordas (faixa invisível) com encaixe; Shift proporcional, Alt a partir do centro;
 *   girar pela zona logo fora de cada canto (cursor curvo), ⇧ = 15°; camadas giradas redimensionam no próprio eixo
 * - Auto layout: arrastar um filho reordena (linha azul); soltar fora tira do frame; soltar sobre um frame coloca dentro
 * - Ferramenta Texto: clique cria texto com largura automática já em edição; arrastar cria largura fixa
 * - Ferramentas Frame/Retângulo/Elipse/Hotspot: arraste para desenhar (ou clique para tamanho padrão);
 *   Linha/Seta: arraste do início ao fim (Shift = passos de 45°)
 * - Zoom no cursor (Ctrl/⌘ + roda, pinça), pan (roda, espaço+arrastar, botão do meio, ferramenta Mão)
 * - Soltar arquivos/SVG/links na posição do cursor
 * - Frações da tela (1/2, 1/3, 2/3, 1/4, 3/4) como alvos de encaixe (com rótulo)
 * - Guias de layout da tela e dos frames (grade, colunas, linhas): desenhadas num canvas só (guias/CamadaGuias.tsx);
 *   mover e redimensionar encaixam nas bordas das colunas/linhas e na grade (do frame pai da seleção e da tela)
 * - Editar vetor: duplo clique (ou Enter) numa forma/SVG selecionada, ou caneta (P) — ver vetor/EditorVetor.tsx
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Camada, CamadaFrame, CamadaTexto, DocumentoProjeto } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { encaixar, guiasDaCaixa, intersecta, limiarEmCena, medirDistancias, redimensionarComEncaixe, LIMIAR_TELA } from '@/lib/editor/guias'
import { areasDeEspaco, indiceDeInsercao, type Insercao, type TipoEspaco } from '@/lib/editor/autolayout'
import { alvoDoClique, ancestrais, comDescendentes, mapaDe, ocultasEfetivas, paiDe, raizDe, raizesDaSelecao, temAutoLayout } from '@/lib/scene/arvore'
import { camadaNoPonto, contemPonto, envolvente, redimensionar, type Alca, type Retangulo } from '@/lib/scene/transform'
import { comDimensionamento, indiceNoPonto, medirTexto, textoAutomatico } from '@/lib/editor/medirTexto'
import { caixaCss, corteVertical, decoracaoCss, folgaTinta, recuoLista } from '@/lib/scene/tipografia'
import { FERRAMENTAS_DESENHO, FORMA_DA_FERRAMENTA, caixaDeLinha } from '@/lib/editor/atalhos'
import { pilhaFonte } from '@/lib/design-tokens'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { useTamanho } from '@/components/renderer/useTamanho'
import { MiniaturaCena } from './MiniaturaCena'
import { COR_SELECAO, GuiasCanvas, HALO_SELECAO, LinhaInsercao, PreviaRegiao, SEM_SOBREPOSICAO, haloDe, type Sobreposicao } from './GuiasCanvas'
import { CamadaPresenca } from './Presenca'
import { alvosDeFracao } from '@/lib/editor/preencher'
import { alvosDasGuias, areasComGuias, type AreaGuias } from '@/lib/scene/guias'
import { CamadaGuias } from './guias/CamadaGuias'
import { EVENTO_PREVIA } from './PreencherGrade'
import { EditorVetor, type FerramentaVetor } from './vetor/EditorVetor'
import { editavelComoVetor, formasDoSvg } from '@/lib/editor/vetor/camadas'
import { normalizarZ } from '@/lib/scene/order'
import { lerDataTransfer } from '@/lib/importar/clipboard'
import { importarConteudo, type Avisar } from '@/lib/editor/importar'
import type { AssetDemo } from '@/lib/demo/tipos'
import { cursorMostra } from '@/lib/editor/cursores'
import { useEnviosEmCurso } from '@/lib/editor/enviosEmCurso'
import { definirSelecaoTexto, lerSelecaoTexto, useSelecaoTexto } from '@/lib/editor/selecaoTexto'
import { RealceTrecho } from './RealceTrecho'
import { ajustarTrechos } from '@/lib/scene/trechos'

/** Cursor de duplicar (seta com uma segunda seta menor), preta com contorno branco; ponta em (3, 2). */

/** Cena do canvas (memo): pan, hover e guias não re-renderizam as camadas. */
const CenaCanvas = memo(SceneRenderer)

/** Caixa de seleção como no Figma: só 4 alças nos cantos; as bordas redimensionam por uma faixa invisível. */
const CANTOS: Alca[] = ['nw', 'ne', 'se', 'sw']
const BORDAS: Alca[] = ['n', 'e', 's', 'w']
/** Ângulo (em graus, sentido horário na tela) do eixo de cada alça com a camada sem rotação. */
const ANGULO_ALCA: Record<Alca, number> = { e: 0, w: 0, se: 45, nw: 45, n: 90, s: 90, ne: 135, sw: 135 }
/** Cursor de redimensionar da alça (seta do Mostra), girado exatamente junto com a camada, como no Figma. */
function cursorDaAlca(a: Alca, rot: number): string {
  return cursorMostra('seta', ANGULO_ALCA[a] + rot)
}
/** Zona de girar fora de cada canto (px de tela além da alça) e lado dela. */
const ZONA_GIRAR = 16
const FOLGA_GIRAR = 3
/** Cursor de girar (do sistema de cursores do Mostra) orientado pelo canto e pela rotação da camada. */
function cursorGirar(canto: Alca, rot: number): string {
  const base = { ne: 0, se: 90, sw: 180, nw: 270 }[canto as 'ne' | 'se' | 'sw' | 'nw'] ?? 0
  return cursorMostra('girar', base + rot)
}
function normalizarAngulo(a: number): number {
  let n = ((a + 540) % 360) - 180
  if (n === -180) n = 180
  return Math.round(n * 10) / 10
}
const ZOOM_MIN = 0.05
const ZOOM_MAX = 8

type Gesto =
  | { tipo: 'mover'; inicio: { x: number; y: number }; iniciais: Map<string, Retangulo>; raizes: string[]; caixa: Retangulo; moveu: boolean; antes: DocumentoProjeto; fluxo: boolean; delta: { x: number; y: number }; ponteiro: { x: number; y: number }; duplicar: boolean }
  | { tipo: 'redimensionar'; alca: Alca; inicio: { x: number; y: number }; caixa: Retangulo; iniciais: Map<string, Retangulo>; antes: DocumentoProjeto; moveu?: boolean; /** camada única já girada: o arraste é lido no eixo dela */ rot?: number }
  | { tipo: 'rotacionar'; centro: { x: number; y: number }; iniciais: Map<string, Retangulo & { rotation: number }>; ang0: number; delta: number; cursor: string; antes: DocumentoProjeto }
  | { tipo: 'linha'; id: string; ponta: 'w' | 'e'; fixo: { x: number; y: number }; inicio: { x: number; y: number }; espessura: number; antes: DocumentoProjeto; moveu: boolean }
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

/**
 * `aoGesto(true)` no começo de um gesto contínuo (mover, redimensionar, girar, área, desenhar, pan, editar texto) e
 * `aoGesto(false)` no fim: o EditorShell adia os painéis enquanto isso (só o canvas precisa de cada quadro).
 */
export function Canvas({ editor, assets, avisar, interagir3d = false, aoEscala, aoGesto }: { editor: Editor; assets: Record<string, AssetDemo>; avisar: Avisar; interagir3d?: boolean; aoEscala?: (s: number) => void; aoGesto?: (ativo: boolean) => void }) {
  const { estado, cena, acoes, indiceCena } = editor
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const gesto = useRef<Gesto | null>(null)
  const alcaPressionada = useRef<{ alca: Alca; t: number } | null>(null)
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
  const gestoAvisado = useRef(false)
  /** Pinça na tela de toque: dois dedos dão zoom no ponto médio (trackpad já chega como roda com Ctrl). */
  const toques = useRef(new Map<number, { x: number; y: number }>())
  const pinca = useRef<{ dist0: number; s0: number } | null>(null)
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

  const escalaVp = vp?.s
  // zoom contínuo (roda, pinça, botões, teclado): durante o gesto só a transform da cena muda — as camadas ficam
  // desenhadas na escala de antes e acompanham por `scale()`; param de chegar passos de zoom por 160 ms e elas
  // re-renderizam uma única vez na escala final (re-renderizar a cada passo custava um quadro inteiro por camada)
  const escalaCena = useEscalaAssentada(escalaVp ?? 0)
  /** Div da tela (para aplicar a transform do zoom no próprio evento, antes do React). */
  const telaRef = useRef<HTMLDivElement>(null)
  const escalaDesenhoRef = useRef(0)
  const zoomEmCurso = !!escalaCena && !!escalaVp && escalaCena !== escalaVp
  const ocultarTexto = useMemo(() => (editandoTexto ? new Set([editandoTexto]) : undefined), [editandoTexto])
  useEffect(() => { if (escalaVp) aoEscala?.(escalaVp) }, [escalaVp, aoEscala])

  /** Retângulo da área durante um gesto (lido no pointerdown): mover o ponteiro não força layout a cada evento. */
  const retGesto = useRef<DOMRect | null>(null)
  const local = useCallback((ev: { clientX: number; clientY: number }) => {
    const r = retGesto.current ?? ref.current!.getBoundingClientRect()
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

  // roda: pan; Ctrl/⌘ (e pinça do trackpad): zoom no cursor. Os eventos da roda chegam mais rápido que os
  // quadros: ficam acumulados e viram um único estado por quadro (rAF), em vez de um render por evento
  /** Pan arrastando: um estado por quadro (a tela já anda no evento, por estilo direto). */
  const panPendente = useRef<{ x: number; y: number } | null>(null)
  const quadroPan = useRef(0)
  const envios = useEnviosEmCurso()
  const selTexto = useSelecaoTexto()
  // trecho selecionado no texto em edição (mouse, Shift+setas, Ctrl+A): guardado para o painel
  const guardarSelecao = (t: HTMLTextAreaElement, id: string) => definirSelecaoTexto({ id, inicio: t.selectionStart, fim: t.selectionEnd })
  // trecho de texto guardado: vale só enquanto a camada dele continua selecionada
  useEffect(() => {
    const t = lerSelecaoTexto()
    if (t && !estado.selecao.includes(t.id)) definirSelecaoTexto(null)
  }, [estado.selecao])
  const vpRef = useRef(vp)
  vpRef.current = vp
  const zoomEmRef = useRef(zoomEm)
  zoomEmRef.current = zoomEm
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let quadro = 0
    let fator = 1
    let dx = 0
    let dy = 0
    let ponto = { x: 0, y: 0 }
    let ultimoTick = 0
    const aplicar = () => {
      const v = vpRef.current
      if (!v) return
      const est = estadoRef.current
      if (fator !== 1) {
        const s2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.s * fator))
        // a transform da tela muda já neste evento (mesmo quadro), o React confirma logo depois
        const el = telaRef.current
        if (el && escalaDesenhoRef.current) {
          const ox2 = ponto.x - (ponto.x - v.ox) * (s2 / v.s)
          const oy2 = ponto.y - (ponto.y - v.oy) * (s2 / v.s)
          el.style.left = `${ox2}px`
          el.style.top = `${oy2}px`
          el.style.transformOrigin = '0 0'
          el.style.willChange = 'transform'
          el.style.transform = `scale(${s2 / escalaDesenhoRef.current})`
        }
        zoomEmRef.current(s2, ponto)
      } else if (dx || dy) {
        // a tela anda já neste evento; o React confirma o pan logo depois (as camadas não re-renderizam)
        const el = telaRef.current
        if (el) { el.style.left = `${v.ox - dx}px`; el.style.top = `${v.oy - dy}px` }
        acoes.ui({ pan: { x: est.pan.x - dx, y: est.pan.y - dy }, zoom: est.zoom || v.s })
      }
      fator = 1
      dx = 0
      dy = 0
    }
    // o primeiro evento do quadro vale na hora (sem esperar o rAF); os seguintes se acumulam até o próximo quadro
    const noQuadro = () => { quadro = 0; aplicar() }
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      if (!vpRef.current) return
      if (e.ctrlKey || e.metaKey) {
        // pinça do trackpad: deltas pequenos e fracionários, 1:1 com os dedos (k = 0,01); roda do mouse: ticks de
        // ~100 → ×1,42 por tick (100 → 400% em 4 ticks), com aceleração suave quando os ticks vêm seguidos
        const agora = performance.now()
        const pinca = Math.abs(e.deltaY) < 40
        let k = pinca ? 0.01 : 0.0035
        if (!pinca && ultimoTick) { const dt = agora - ultimoTick; if (dt < 120) k *= 1 + 0.6 * (1 - dt / 120) }
        ultimoTick = agora
        fator *= Math.exp(-e.deltaY * k)
        ponto = local(e)
      } else {
        dx += e.deltaX
        dy += e.deltaY
      }
      if (quadro) return
      aplicar()
      quadro = requestAnimationFrame(noQuadro)
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => { el.removeEventListener('wheel', roda); if (quadro) cancelAnimationFrame(quadro) }
  }, [ref, local, acoes])

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

  // textos com largura/altura automática: mede no DOM e grava no documento (sem passo de desfazer).
  // A medida só depende do texto e do estilo: mover/girar a camada (ou outra camada) não mede de novo.
  const medidas = useRef(new Map<string, { chave: string; m: { width: number; height: number } }>())
  useLayoutEffect(() => {
    if (!cena) return
    const mudancas = new Map<string, { width: number; height: number; x: number }>()
    const mapa = mapaDe(cena.layers)
    for (const l of cena.layers) {
      if (!textoAutomatico(l)) continue
      const { x: _x, y: _y, z: _z, rotation: _r, opacity: _o, interactions: _i, enterAnimation: _e, exitAnimation: _s, loopAnimation: _l, ...estilo } = l
      const chave = `${fontesProntas}|${JSON.stringify(estilo)}`
      const guardada = medidas.current.get(l.id)
      const m = guardada?.chave === chave ? guardada.m : medirTexto(l)
      medidas.current.set(l.id, { chave, m })
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

  // digitar no canvas também é um gesto contínuo (painéis adiados até sair da edição)
  useEffect(() => {
    if (!editandoTexto) return
    aoGesto?.(true)
    return () => aoGesto?.(false)
  }, [editandoTexto, aoGesto])

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

  // guias de layout: a mesma lista enquanto nada nelas muda (arrastar uma camada não redesenha o canvas das guias)
  const areasGuias = useAreasGuias(cena, estado.guiasLayout)

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
  // guias de layout como alvos: as da tela e as do frame pai da seleção (as de outros frames não puxam)
  const paisSel = new Set(selecionadas.map((l) => l.parentId).filter(Boolean))
  const alvosGuias = alvosDasGuias(areasGuias.filter((a) => a.id === cena.id || paisSel.has(a.id)), vp?.s ?? 1)
  const fracoes = alvosDeFracao(cena.size, { fracoes: estado.fracoes })
  const extras = alvosGuias.x.length || alvosGuias.y.length ? { x: [...fracoes.x, ...alvosGuias.x], y: [...fracoes.y, ...alvosGuias.y] } : fracoes
  const grades = alvosGuias.grades
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
    if (ev.pointerType === 'touch') {
      toques.current.set(ev.pointerId, p)
      if (toques.current.size === 2) {
        // segundo dedo: o gesto de um dedo que estava em curso vira pinça (zoom), sem mover nada
        const [a, b] = [...toques.current.values()]
        if (gesto.current?.tipo === 'mover' && gesto.current.moveu) acoes.registrarHistorico(gesto.current.antes)
        gesto.current = null
        pinca.current = { dist0: Math.max(1, Math.hypot(b!.x - a!.x, b!.y - a!.y)), s0: vp.s }
        if (!estado.zoom) acoes.ui({ zoom: vp.s })
        return
      }
    }
    if (ev.button === 1 || modoMao) {
      gesto.current = { tipo: 'pan', inicio: p, panInicial: estado.pan }
      if (!estado.zoom) acoes.ui({ zoom: vp.s })
      return
    }
    if (ev.button !== 0) return
    const alvo = ev.target as HTMLElement
    const alca = alvo.dataset.alca as Alca | 'rot' | undefined
    // o ponteiro é capturado pelo canvas: o dblclick chega com o canvas como alvo, então a borda fica guardada aqui
    alcaPressionada.current = alca && alca !== 'rot' ? { alca, t: ev.timeStamp } : null
    if (alca === 'rot' && caixaSel) {
      // girar em volta do centro da seleção (uma camada ou várias), pelo ângulo que o ponteiro percorre
      const centro = { x: caixaSel.x + caixaSel.width / 2, y: caixaSel.y + caixaSel.height / 2 }
      const moviveis = selecionadas.filter((l) => !l.locked)
      gesto.current = { tipo: 'rotacionar', centro, iniciais: new Map(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height, rotation: l.rotation }])), ang0: (Math.atan2(pc.y - centro.y, pc.x - centro.x) * 180) / Math.PI, delta: 0, cursor: alvo.style.cursor || 'grabbing', antes: acoes.documentoAtual() }
      return
    }
    if (alca && alca !== 'rot' && unica && ehLinha(unica) && !unica.locked) {
      // linha: a alça de cada ponta estica/encolhe o comprimento e gira em volta da outra ponta (como no Figma)
      const { a, b } = pontasDaLinha(unica)
      const ponta = alca.includes('w') ? 'w' : 'e'
      gesto.current = { tipo: 'linha', id: unica.id, ponta, fixo: ponta === 'w' ? b : a, inicio: pc, espessura: unica.height, antes: acoes.documentoAtual(), moveu: false }
      return
    }
    if (alca && alca !== 'rot' && caixaSel) {
      const moviveis = selecionadas.filter((l) => !l.locked)
      gesto.current = { tipo: 'redimensionar', alca, inicio: pc, caixa: caixaSel, iniciais: new Map(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }])), antes: acoes.documentoAtual(), rot: unica && unica.rotation ? unica.rotation : undefined }
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
    if (pinca.current && toques.current.has(ev.pointerId)) {
      toques.current.set(ev.pointerId, local(ev))
      if (toques.current.size === 2) {
        const [a, b] = [...toques.current.values()]
        const dist = Math.max(1, Math.hypot(b!.x - a!.x, b!.y - a!.y))
        zoomEm(pinca.current.s0 * (dist / pinca.current.dist0), { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 })
      }
      return
    }
    const g = gesto.current
    if (g && !retGesto.current) retGesto.current = ref.current!.getBoundingClientRect()
    const p = local(ev)
    const pc = paraCena(p)
    if (!g) {
      const h = !ehDesenho && !modoMao ? camadaNoPonto(cena, pc, { ignorarTravadas: true }) : undefined
      // com Alt, mede até a camada sob o cursor; sem Alt, destaca o que o clique selecionaria
      const alvoH = h ? (alt ? h : alvoDoClique(h, camadas, estado.selecao, ev.metaKey || ev.ctrlKey)) : undefined
      if ((alvoH?.id ?? null) !== hover) setHover(alvoH?.id ?? null)
      return
    }
    const semEncaixe = !estado.snap || ev.metaKey || ev.ctrlKey
    if (!gestoAvisado.current) { gestoAvisado.current = true; aoGesto?.(true) }
    switch (g.tipo) {
      case 'pan': {
        const pan = { x: g.panInicial.x + (p.x - g.inicio.x), y: g.panInicial.y + (p.y - g.inicio.y) }
        const el = telaRef.current
        if (el) { el.style.left = `${vp.ox + pan.x - estado.pan.x}px`; el.style.top = `${vp.oy + pan.y - estado.pan.y}px` }
        panPendente.current = pan
        if (!quadroPan.current) quadroPan.current = requestAnimationFrame(() => { quadroPan.current = 0; if (panPendente.current) acoes.ui({ pan: panPendente.current }) })
        break
      }
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
          const r = encaixar(proposta, visiveisExceto(movidos), cena.size, limiar, { grade, extras, grades })
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
        if (g.rot) {
          // camada girada: o arraste é lido no eixo da camada; a caixa cresce como se não girasse e depois é
          // deslocada para o canto oposto (âncora) ficar parado na tela — sem encaixe
          const th = (g.rot * Math.PI) / 180
          const dx = pc.x - g.inicio.x, dy = pc.y - g.inicio.y
          const dl = { x: dx * Math.cos(th) + dy * Math.sin(th), y: -dx * Math.sin(th) + dy * Math.cos(th) }
          const nova = redimensionar(g.caixa, g.alca, dl.x, dl.y, ev.shiftKey || svgUnico, ev.altKey)
          const D = { x: nova.x + nova.width / 2 - (g.caixa.x + g.caixa.width / 2), y: nova.y + nova.height / 2 - (g.caixa.y + g.caixa.height / 2) }
          const t = { x: D.x * Math.cos(th) - D.y * Math.sin(th) - D.x, y: D.x * Math.sin(th) + D.y * Math.cos(th) - D.y }
          const soX = !(ev.shiftKey || svgUnico) && !/[ns]/.test(g.alca)
          const soY = !(ev.shiftKey || svgUnico) && !/[ew]/.test(g.alca)
          acoes.atualizarCamadas([...g.iniciais.keys()], (l) => ({ ...l, x: Math.round(nova.x + t.x), y: Math.round(nova.y + t.y), width: Math.max(1, Math.round(nova.width)), height: Math.max(1, Math.round(nova.height)), ...(soX ? { height: l.height } : {}), ...(soY ? { width: l.width } : {}) }), false)
          break
        }
        const movidos = new Set(comDescendentes([...g.iniciais.keys()], camadas))
        const res = redimensionarComEncaixe(g.caixa, g.alca, pc.x - g.inicio.x, pc.y - g.inicio.y, visiveisExceto(movidos), cena.size, limiar, { proporcional: ev.shiftKey || svgUnico, doCentro: ev.altKey, semEncaixe, grade, extras, grades })
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
      case 'rotacionar': {
        const ang = (Math.atan2(pc.y - g.centro.y, pc.x - g.centro.x) * 180) / Math.PI
        const unico = g.iniciais.size === 1
        // uma camada: ⇧ prende o ângulo final em 15°; várias: prende o giro aplicado ao conjunto
        let delta = ang - g.ang0
        if (ev.shiftKey && !unico) delta = Math.round(delta / 15) * 15
        g.delta = delta
        acoes.atualizarCamadas([...g.iniciais.keys()], (l) => {
          const i = g.iniciais.get(l.id)!
          let rot = i.rotation + delta
          if (ev.shiftKey && unico) rot = Math.round(rot / 15) * 15
          const dd = ((rot - i.rotation) * Math.PI) / 180
          const cx0 = i.x + i.width / 2 - g.centro.x
          const cy0 = i.y + i.height / 2 - g.centro.y
          const cx = g.centro.x + cx0 * Math.cos(dd) - cy0 * Math.sin(dd)
          const cy = g.centro.y + cx0 * Math.sin(dd) + cy0 * Math.cos(dd)
          return { ...l, x: unico ? i.x : Math.round(cx - i.width / 2), y: unico ? i.y : Math.round(cy - i.height / 2), rotation: normalizarAngulo(rot) }
        }, false)
        break
      }
      case 'linha': {
        if (!g.moveu) {
          if (Math.hypot(pc.x - g.inicio.x, pc.y - g.inicio.y) * vp.s < 3) break
          g.moveu = true
        }
        const p = { x: naGrade(pc.x), y: naGrade(pc.y) }
        const r = g.ponta === 'e' ? caixaDeLinha(g.fixo, p, g.espessura, ev.shiftKey) : caixaDeLinha(p, g.fixo, g.espessura, ev.shiftKey)
        acoes.atualizarCamadas([g.id], { x: r.x, y: r.y, width: r.width, height: r.height, rotation: r.rotation } as Partial<Camada>, false)
        break
      }
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
    if (ev.pointerType === 'touch') {
      toques.current.delete(ev.pointerId)
      if (pinca.current) { if (toques.current.size < 2) pinca.current = null; return }
    }
    const g = gesto.current
    gesto.current = null
    retGesto.current = null
    if (gestoAvisado.current) { gestoAvisado.current = false; aoGesto?.(false) }
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
    } else if ((g.tipo === 'redimensionar' && g.moveu) || (g.tipo === 'linha' && g.moveu) || g.tipo === 'rotacionar') acoes.registrarHistorico(g.antes)
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

  /**
   * Como no Figma: duplo clique na borda (ou alça) ajusta a caixa ao conteúdo naquele eixo.
   * Texto: borda de cima/baixo = altura automática (mantém a largura); esquerda/direita ou canto = largura
   * automática (abraça as duas). Frame com auto layout: abraçar no eixo da borda; canto = nos dois.
   * Um único passo de desfazer (o tamanho medido entra junto com o modo novo).
   */
  const abracarPelaBorda = (alca: Alca) => {
    const eixoW = /[ew]/.test(alca)
    const eixoH = /[ns]/.test(alca)
    const novas = new Map<string, Camada>()
    for (const l of selecionadas) {
      if (l.locked) continue
      if (l.type === 'text') {
        const d: Pick<Camada, 'sizingW' | 'sizingH'> = eixoW ? { sizingW: 'hug', sizingH: 'hug' } : { sizingW: l.sizingW, sizingH: 'hug' }
        if (l.sizingW === d.sizingW && l.sizingH === 'hug') continue
        novas.set(l.id, comDimensionamento(l, d, !temAutoLayout(paiDe(l, mapa))))
      } else if (l.type === 'frame' && l.layout) {
        const w = eixoW && l.sizingW !== 'hug'
        const h = eixoH && l.sizingH !== 'hug'
        if (!w && !h) continue
        // espaço automático não combina com abraçar no eixo principal (como no painel)
        const principalW = l.layout.direction !== 'vertical'
        const tiraAuto = l.layout.gapAuto && ((principalW && w) || (!principalW && h))
        novas.set(l.id, { ...l, ...(w ? { sizingW: 'hug' } : {}), ...(h ? { sizingH: 'hug' } : {}), ...(tiraAuto ? { layout: { ...l.layout, gapAuto: false } } : {}) })
      }
    }
    if (novas.size) acoes.atualizarCamadas([...novas.keys()], (l) => novas.get(l.id) ?? l, true, { manterDimensionamento: true })
  }

  const onDoubleClick = (ev: React.MouseEvent) => {
    if (editandoTexto) return
    const pressionada = alcaPressionada.current
    const alcaClicada = ((ev.target as HTMLElement).dataset.alca as Alca | 'rot' | undefined) ?? (pressionada && ev.timeStamp - pressionada.t < 800 ? pressionada.alca : undefined)
    if (alcaClicada && alcaClicada !== 'rot') {
      abracarPelaBorda(alcaClicada)
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
  const cursor = modoMao ? cursorMostra(g?.tipo === 'pan' ? 'grabbing' : 'grab') : g?.tipo === 'rotacionar' ? g.cursor : duplicando || cursorDuplicar ? cursorMostra('duplicate') : estado.ferramenta === 'texto' ? cursorMostra('text') : estado.ferramenta === 'caneta' ? cursorMostra('pen') : ehDesenho ? cursorMostra('crosshair') : cursorMostra('pointer')
  // a tela (fundo, sombra, grade e camadas) fica desenhada na escala assentada; durante o zoom só a transform muda
  const escalaDesenho = escalaCena || vp.s
  escalaDesenhoRef.current = escalaDesenho
  const telaDesenho = { width: cena.size.width * escalaDesenho, height: cena.size.height * escalaDesenho }
  // grade visível: passo configurado, dobrado até ficar legível na tela
  let passoTela = estado.gradePasso * escalaDesenho
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
      <div data-rotulo-tela="" className="mono pointer-events-none absolute text-[11px] text-texto2" style={{ left: telaCena.x, top: telaCena.y - 22 }}>
        {String(indiceCena + 1).padStart(2, '0')} — {cena.title || 'Sem título'}
      </div>

      <div ref={telaRef} data-testid="canvas" className="absolute shadow-[0_1px_3px_rgba(0,0,0,.06),0_20px_50px_-30px_rgba(0,0,0,.35)]" style={{ left: telaCena.x, top: telaCena.y, width: telaDesenho.width, height: telaDesenho.height, transform: zoomEmCurso ? `scale(${vp.s / escalaDesenho})` : undefined, transformOrigin: '0 0', willChange: 'transform' }}>
        <CenaCanvas key={`${cena.id}-${previaAtiva ? estado.previa : 0}`} cena={cena} assets={assets} escala={escalaDesenho} modo={previaAtiva ? 'viewer' : 'editor'} interativoNoEditor={interagir3d} chaveEntrada={`${estado.previa}`} ocultar={ocultarTexto} />
        {estado.grade && <div aria-hidden data-testid="grade" className="grade-editor pointer-events-none absolute inset-0 z-[1]" style={{ backgroundSize: `${passoTela}px ${passoTela}px` }} />}
        {estado.documento.mode === 'story' && <div aria-hidden className="pointer-events-none absolute border border-dashed border-texto3/60" style={{ left: '6%', right: '6%', top: '8%', bottom: '10%' }} />}
      </div>

      {/* guias de layout (grade, colunas, linhas) da tela e dos frames */}
      {areasGuias.length > 0 && <CamadaGuias areas={areasGuias} vp={vp} largura={tamanho.width} altura={tamanho.height} />}

      {/* trecho de texto guardado (rich text): continua marcado enquanto a pessoa usa o painel */}
      {selTexto && editandoTexto !== selTexto.id && <RealceTrecho id={selTexto.id} inicio={selTexto.inicio} fim={selTexto.fim} versao={`${vp.s}:${vp.ox}:${vp.oy}:${JSON.stringify(camadas.find((l) => l.id === selTexto.id) ?? null)}`} />}
      {/* imagens sendo enviadas: prévia local no lugar onde a camada vai entrar, com o progresso */}
      {envios.filter((e) => e.cenaId === cena.id).map((e) => (
        <div key={e.id} data-testid="envio-em-curso" className="pointer-events-none absolute overflow-hidden" style={{ left: vp.ox + e.x * vp.s, top: vp.oy + e.y * vp.s, width: e.width * vp.s, height: e.height * vp.s }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={e.url} alt="" className="h-full w-full object-cover opacity-80" draggable={false} />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20"><div className="h-full bg-selecao transition-[width] duration-200" style={{ width: `${Math.max(8, e.progresso)}%` }} /></div>
        </div>
      ))}
      {/* hover: UM contorno de 1 px na cor da seleção, sem halo, só na camada sob o cursor (como no Figma); nada
          por cima da seleção — camadas já selecionadas ou dentro da caixa da seleção não ganham hover */}
      {hover && !vetorAtivo && !estado.selecao.includes(hover) && (!g || g.tipo === 'mover') && !editandoTexto && (() => {
        const l = mapa.get(hover)
        if (!l) return null
        const medindo = alt && !!caixaSel
        if (!medindo && caixaSel) {
          // dentro da caixa da seleção, ou pai/filho de algo selecionado (o pai já tem o contorno tracejado): sem hover
          if (l.x >= caixaSel.x && l.y >= caixaSel.y && l.x + l.width <= caixaSel.x + caixaSel.width && l.y + l.height <= caixaSel.y + caixaSel.height) return null
          const parentes = new Set(selecionadas.flatMap((c) => [...ancestrais(c, mapa).map((a) => a.id), ...comDescendentes([c.id], camadas)]))
          if (parentes.has(l.id)) return null
        }
        return <Contorno r={paraTela(l)} rot={l.rotation} cor={medindo ? 'rgb(var(--cor-guia))' : COR_SELECAO} semHalo testid="contorno-hover" />
      })()}

      {/* frames: contorno tracejado do frame pai da seleção (contexto) */}
      {unica && !editandoTexto && (() => { const p = paiDe(unica, mapa); return p ? <Contorno r={paraTela(p)} rot={p.rotation} cor={COR_SELECAO} tracejado testid="contorno-pai" /> : null })()}

      {/* interações: marcadores numerados e fluxo */}
      {interacoesVisiveis && comInteracao.map((l, i) => {
        const r = paraTela(l)
        return (
          <div key={`h-${l.id}`} className="pointer-events-none absolute" style={{ left: r.x - 6, top: r.y - 6, width: r.width + 12, height: r.height + 12, border: `1px dashed ${COR_SELECAO}`, borderRadius: 8, background: 'rgb(var(--cor-selecao) / .06)', boxShadow: haloDe(1) }}>
            <span className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-selecao text-[11px] font-medium text-white">{i + 1}</span>
          </div>
        )
      })}
      {interacoesVisiveis && unica && <FluxoInteracao camada={unica} editor={editor} assets={assets} r={paraTela(unica)} />}

      {/* seleção */}
      {!editandoTexto && !vetorAtivo && selecionadas.map((l) => <Contorno key={l.id} r={paraTela(l)} rot={l.rotation} cor={COR_SELECAO} testid="contorno-selecao" />)}
      {caixaSel && !editandoTexto && !vetorAtivo && !interacoesVisiveis && !(g?.tipo === 'mover' && g.fluxo && g.moveu) && (() => {
        const r = paraTela(caixaSel)
        const travada = selecionadas.every((l) => l.locked)
        if (unica && ehLinha(unica)) {
          // linha (ou camada fininha): contorno rente, uma alça quadrada em cada ponta e só o comprimento na etiqueta
          const { a, b } = pontasDaLinha(unica)
          const ta = paraTela({ ...a, width: 0, height: 0 })
          const tb = paraTela({ ...b, width: 0, height: 0 })
          const c = { x: (ta.x + tb.x) / 2, y: (ta.y + tb.y) / 2 }
          const cursor = cursorDaPonta(unica.rotation)
          return (
            <>
              {!travada && <div data-alca="w" data-testid="alca-linha-w" className="absolute z-10 h-2 w-2 border border-selecao bg-white" style={{ left: ta.x - 4, top: ta.y - 4, cursor }} />}
              {!travada && <div data-alca="e" data-testid="alca-linha-e" className="absolute z-10 h-2 w-2 border border-selecao bg-white" style={{ left: tb.x - 4, top: tb.y - 4, cursor }} />}
              <div data-testid="etiqueta-medidas" className="mono pointer-events-none absolute whitespace-nowrap rounded-[4px] bg-selecao px-1.5 py-[3px] text-[11px] font-medium leading-none text-white" style={{ left: c.x, top: c.y + 10, transform: 'translateX(-50%)', boxShadow: `0 0 0 1px ${HALO_SELECAO}` }}>
                {Math.round(unica.width)}{unica.rotation ? ` · ${unica.rotation}°` : ''}
              </div>
            </>
          )
        }
        return (
          <>
            {/* seleção múltipla: caixa inteira sólida, como no Figma (cada camada já tem o próprio contorno) */}
            {selecionadas.length > 1 && <Contorno r={r} rot={0} cor={COR_SELECAO} testid="caixa-selecao" />}
            {/* alças, bordas e zonas de girar num invólucro que gira junto com a camada (como no Figma) */}
            {(() => {
              const rot = unica ? unica.rotation : 0
              const dentroX = Math.min(4, r.width / 4)
              const dentroY = Math.min(4, r.height / 4)
              const girando = g?.tipo === 'rotacionar'
              // etiqueta abaixo da caixa girada (ponto mais baixo dos cantos)
              const th = (rot * Math.PI) / 180
              const cx = r.x + r.width / 2, cy = r.y + r.height / 2
              const baixo = rot ? Math.max(...[[-r.width / 2, -r.height / 2], [r.width / 2, -r.height / 2], [r.width / 2, r.height / 2], [-r.width / 2, r.height / 2]].map(([px, py]) => cy + px! * Math.sin(th) + py! * Math.cos(th))) : r.y + r.height
              const anguloEtiqueta = girando ? (unica ? unica.rotation : Math.round(g.delta * 10) / 10) : unica?.rotation
              // alvo pequeno (< 24 px na tela): alças e zonas de girar vão para fora, a camada continua à vista
              const folgaX = r.width < 24 ? (24 - r.width) / 2 : 0
              const folgaY = r.height < 24 ? (24 - r.height) / 2 : 0
              return (
                <>
                  <div className="pointer-events-none absolute" style={{ left: r.x, top: r.y, width: r.width, height: r.height, transform: rot ? `rotate(${rot}deg)` : undefined, transformOrigin: 'center' }}>
                    {/* bordas inteiras: faixa invisível de ~8 px; arrastar redimensiona naquele eixo; duplo clique abraça o conteúdo */}
                    {!travada && !girando && BORDAS.map((a) => {
                      const s = a === 'n' || a === 's'
                        ? { left: 4, width: Math.max(0, r.width - 8), top: a === 'n' ? -4 : r.height - dentroY, height: 4 + dentroY }
                        : { top: 4, height: Math.max(0, r.height - 8), left: a === 'w' ? -4 : r.width - dentroX, width: 4 + dentroX }
                      return <div key={`b-${a}`} data-alca={a} data-testid={`borda-${a}`} className="pointer-events-auto absolute z-10" style={{ ...s, cursor: cursorDaAlca(a, rot) }} />
                    })}
                    {/* zonas de girar: logo fora de cada canto, com o cursor curvo daquele canto */}
                    {!travada && CANTOS.map((a) => (
                      <div key={`g-${a}`} data-alca="rot" data-testid={`zona-girar-${a}`} className="pointer-events-auto absolute z-[9]" style={{ width: ZONA_GIRAR, height: ZONA_GIRAR, left: a.includes('w') ? -ZONA_GIRAR - FOLGA_GIRAR - folgaX : r.width + FOLGA_GIRAR + folgaX, top: a.includes('n') ? -ZONA_GIRAR - FOLGA_GIRAR - folgaY : r.height + FOLGA_GIRAR + folgaY, cursor: girando ? g.cursor : cursorGirar(a, rot) }} />
                    ))}
                    {/* 4 alças quadradas brancas com borda de 1 px na cor da seleção */}
                    {!travada && !girando && CANTOS.map((a) => (
                      <div key={a} data-alca={a} className="pointer-events-auto absolute z-10 h-2 w-2 border border-selecao bg-white" style={{ left: (a.includes('w') ? -folgaX : r.width + folgaX) - 4, top: (a.includes('n') ? -folgaY : r.height + folgaY) - 4, cursor: cursorDaAlca(a, rot) }} />
                    ))}
                  </div>
                  {/* etiqueta de medidas: pílula sólida com texto branco; durante o giro mostra o ângulo */}
                  <div data-testid="etiqueta-medidas" className="mono pointer-events-none absolute whitespace-nowrap rounded-[4px] bg-selecao px-1.5 py-[3px] text-[11px] font-medium leading-none text-white" style={{ left: cx, top: baixo + 8, transform: 'translateX(-50%)', boxShadow: `0 0 0 1px ${HALO_SELECAO}` }}>
                    {girando ? `${anguloEtiqueta}°` : `${rotuloTamanho(caixaSel.width, unica?.sizingW)} × ${rotuloTamanho(caixaSel.height, unica?.sizingH)}${anguloEtiqueta ? ` · ${anguloEtiqueta}°` : ''}`}
                  </div>
                  {/* barra rápida embaixo da seleção: o modo do painel e o menu, sem atravessar a tela até o painel */}
                  {!g && (
                    <div role="toolbar" aria-label="Ações da seleção" data-testid="barra-selecao" className="pointer-events-auto absolute z-20 flex items-center gap-0.5 whitespace-nowrap rounded-lg border border-borda bg-superficie p-0.5 text-[11px] shadow-[0_8px_24px_-12px_rgba(0,0,0,.3)]" style={{ left: cx, top: baixo + 34, transform: 'translateX(-50%)' }} onPointerDown={(e) => e.stopPropagation()}>
                      {([['design', 'Estilo', 'bg-acento'], ['animacao', 'Animar', 'bg-[#AEB4FA]'], ['interacoes', 'Ação', 'bg-lima']] as const).map(([id, rotulo, cor]) => (
                        <button key={id} type="button" onClick={() => acoes.ui({ abaDireita: id })} className={`flex h-6 items-center gap-1.5 rounded-md px-2 transition-colors ${estado.abaDireita === id ? 'bg-hover text-texto' : 'text-texto2 hover:bg-hover hover:text-texto'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cor}`} aria-hidden />{rotulo}
                        </button>
                      ))}
                      <span className="mx-0.5 h-4 w-px bg-borda" aria-hidden />
                      <button type="button" aria-label="Mais ações" title="Mais ações (botão direito)" onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); window.dispatchEvent(new CustomEvent('mostra:menu', { detail: { x: b.left, y: b.bottom + 4 } })) }} className="flex h-6 w-6 items-center justify-center rounded-md text-texto2 hover:bg-hover hover:text-texto">⋯</button>
                    </div>
                  )}
                </>
              )
            })()}
          </>
        )
      })()}

      {/* auto layout: fantasma do item arrastado e linha azul de inserção */}
      {g?.tipo === 'mover' && g.fluxo && g.moveu && (() => { const r = paraTela({ ...g.caixa, x: g.caixa.x + g.delta.x, y: g.caixa.y + g.delta.y }); return <div data-testid="fantasma" className="pointer-events-none absolute z-20 border border-selecao bg-selecao/15" style={{ left: r.x, top: r.y, width: r.width, height: r.height }} /> })()}
      {insercao && g?.tipo === 'mover' && g.moveu && <LinhaInsercao linha={insercao.linha} paraTela={paraTela} />}

      {/* realce do gap/padding do auto layout e prévia de "Preencher" */}
      {espacoRealce && (() => {
        const f = mapa.get(espacoRealce.frameId)
        if (f?.type !== 'frame' || !f.layout) return null
        return areasDeEspaco(f, cena.layers, espacoRealce.tipo).map((r, i) => { const t = paraTela(r); return <div key={i} data-testid="realce-espaco" className="pointer-events-none absolute z-20" style={{ left: t.x, top: t.y, width: t.width, height: t.height, background: 'repeating-linear-gradient(135deg, rgb(242 72 160 / .28) 0 3px, rgb(242 72 160 / .14) 3px 6px)', outline: '1px solid rgb(242 72 160 / .6)' }} /> })
      })()}
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
      {g?.tipo === 'area' && (() => { const r = paraTela(retDe(g.inicio, g.atual)); return <div data-testid="area-selecao" className="pointer-events-none absolute border border-selecao bg-selecao/10" style={{ left: r.x, top: r.y, width: r.width, height: r.height }} /> })()}
      {g?.tipo === 'desenhar' && linear && (() => { const a = paraTela({ ...g.inicio, width: 0, height: 0 }); const b = paraTela({ ...g.atual, width: 0, height: 0 }); return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COR_SELECAO} strokeWidth={1} /></svg> })()}
      {g?.tipo === 'desenhar' && !linear && (() => { const r = paraTela(retDe(g.inicio, g.atual)); return <div className="pointer-events-none absolute border border-selecao bg-selecao/10" style={{ left: r.x, top: r.y, width: r.width, height: r.height, borderRadius: estado.ferramenta === 'hotspot' ? 6 : estado.ferramenta === 'elipse' ? '50%' : 0, borderStyle: estado.ferramenta === 'hotspot' ? 'dashed' : 'solid' }} /> })()}

      {/* edição de texto no lugar: o documento muda a cada tecla (sem histórico); um passo de desfazer por sessão */}
      {textoEmEdicao && (() => {
        const r0 = paraTela(textoEmEdicao)
        const hug = textoEmEdicao.sizingW === 'hug'
        // corte vertical: a área de edição volta a ter a entrelinha inteira, para as letras ficarem no mesmo lugar
        const corte = corteVertical(textoEmEdicao)
        const r = { ...r0, y: r0.y - corte.topo * vp.s, height: r0.height + (corte.topo + corte.base) * vp.s }
        const recuo = recuoLista(textoEmEdicao)
        const deco = decoracaoCss(textoEmEdicao)
        // a área de edição recorta o que passa dela (textarea sempre rola): cresce uma folga em volta, com o mesmo
        // tanto de respiro por dentro, para acentos e descendentes aparecerem enquanto se digita (as letras ficam
        // no mesmo lugar); contorno e fundo ficam na caixa de verdade, atrás
        const f = folgaTinta(textoEmEdicao) * vp.s
        const pad = textoEmEdicao.padding * vp.s + f
        return (
          <>
          <div aria-hidden data-testid="caixa-edicao-texto" className="pointer-events-none absolute z-20" style={{ left: r.x, top: r.y, width: r.width, height: r.height, outline: `1px solid ${COR_SELECAO}`, borderRadius: textoEmEdicao.radius * vp.s, background: textoEmEdicao.background, transform: textoEmEdicao.rotation ? `rotate(${textoEmEdicao.rotation}deg)` : undefined, transformOrigin: 'center' }} />
          <textarea
            ref={textareaRef}
            aria-label="Editar texto"
            spellCheck={false}
            defaultValue={textoEmEdicao.text}
            onChange={(e) => { const v = e.target.value; acoes.atualizarCamadas([textoEmEdicao.id], (l) => (l.type === 'text' ? { ...l, text: v, trechos: ajustarTrechos(l.trechos, l.text, v) } : l), false); e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0 }}
            // trecho selecionado: o painel aplica cor, peso e fonte só nele (fica guardado ao sair da edição)
            onSelect={(e) => guardarSelecao(e.currentTarget, textoEmEdicao.id)}
            onMouseUp={(e) => guardarSelecao(e.currentTarget, textoEmEdicao.id)}
            onKeyUp={(e) => guardarSelecao(e.currentTarget, textoEmEdicao.id)}
            onBlur={finalizarTexto}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            wrap={hug ? 'off' : 'soft'}
            className="absolute z-20 resize-none overflow-hidden bg-transparent caret-selecao selection:bg-selecao/25"
            // sem contorno próprio (o estilo global de foco desenharia outro por fora): o da caixa, logo acima
            style={{ outline: 'none', left: r.x - f, top: r.y - f, width: r.width + (hug ? 2 : 0) + 2 * f, height: r.height + 2 * f, whiteSpace: hug ? 'pre' : 'pre-wrap', wordBreak: 'break-word', fontFamily: pilhaFonte(textoEmEdicao.fontFamily), fontSize: textoEmEdicao.fontSize * vp.s, fontWeight: textoEmEdicao.fontWeight, fontStyle: textoEmEdicao.italic ? 'italic' : undefined, ...deco, textDecorationThickness: typeof deco.textDecorationThickness === 'number' ? deco.textDecorationThickness * vp.s : undefined, textUnderlineOffset: typeof deco.textUnderlineOffset === 'number' ? deco.textUnderlineOffset * vp.s : undefined, color: textoEmEdicao.color, textAlign: textoEmEdicao.align === 'justify' ? 'justify' : textoEmEdicao.align, lineHeight: textoEmEdicao.lineHeight, letterSpacing: textoEmEdicao.letterSpacing * vp.s, padding: pad, paddingLeft: recuo ? `calc(${pad}px + ${recuo})` : pad, ...caixaCss(textoEmEdicao.transform), fontVariantNumeric: textoEmEdicao.tabularNums ? 'tabular-nums' : undefined, fontVariantLigatures: textoEmEdicao.ligatures === false ? 'none' : undefined, transform: textoEmEdicao.rotation ? `rotate(${textoEmEdicao.rotation}deg)` : undefined, transformOrigin: 'center' }}
          />
          </>
        )
      })()}

      {arrastandoArquivo && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <span className="rounded-full bg-acento px-4 py-2 text-sm font-medium text-acentoTexto shadow-suave">Solte para importar: imagens, SVG, vídeo, GLB do Blender, Lottie</span>
        </div>
      )}
    </div>
  )
}

/** Tempo sem mudar de escala para as camadas serem re-renderizadas na escala nova (um gesto de zoom "assentou"). */
const ASSENTAR_ZOOM_MS = 160

/**
 * Escala em que as camadas da cena estão desenhadas: segue a escala da viewport com atraso — a cada passo de zoom
 * (roda, pinça, +/−, atalhos) a tela responde na hora só pela transform e as camadas re-renderizam uma vez,
 * 160 ms depois do último passo (o re-render de uma cena grande custava mais que um quadro).
 */
function useEscalaAssentada(escala: number): number {
  const [assentada, setAssentada] = useState(escala)
  useEffect(() => {
    if (!escala || escala === assentada) return
    // primeira escala (ou a cena acabou de aparecer): desenha já na escala certa
    if (!assentada) { setAssentada(escala); return }
    const t = window.setTimeout(() => setAssentada(escala), ASSENTAR_ZOOM_MS)
    return () => window.clearTimeout(t)
  }, [escala, assentada])
  return assentada || escala
}

/**
 * Telas e frames com guias de layout, com a mesma identidade enquanto nada muda nelas (memo do CamadaGuias):
 * mover outras camadas recria a tela, mas não a lista. `visiveis` = ⌃⇧4.
 */
function useAreasGuias(cena: Editor['cena'], visiveis: boolean): readonly AreaGuias[] {
  const anterior = useRef<readonly AreaGuias[]>([])
  if (!cena || !visiveis) return (anterior.current = SEM_AREAS)
  const novas = cena.guias?.length || cena.layers.some((l) => l.type === 'frame' && l.guias?.length) ? areasComGuias(cena, cena.layers, ocultasEfetivas(cena.layers)) : SEM_AREAS
  const a = anterior.current
  const iguais = a.length === novas.length && a.every((x, i) => { const y = novas[i]!; return x.id === y.id && x.guias === y.guias && x.area.x === y.area.x && x.area.y === y.area.y && x.area.width === y.area.width && x.area.height === y.area.height })
  if (!iguais) anterior.current = novas
  return anterior.current
}
const SEM_AREAS: readonly AreaGuias[] = []

/** "240 Hug" / "Fill" como no rótulo de tamanho do Figma. */
function rotuloTamanho(v: number, d: Camada['sizingW']) {
  return d === 'hug' ? `${Math.round(v)} Hug` : d === 'fill' ? `${Math.round(v)} Fill` : `${Math.round(v)}`
}

/** Contorno sólido (ou tracejado) em px de tela, com o halo claro por fora (ver HALO_SELECAO). */
function Contorno({ r, rot, cor, largura = 1, tracejado, semHalo, testid }: { r: Retangulo; rot: number; cor: string; largura?: number; tracejado?: boolean; semHalo?: boolean; testid?: string }) {
  // sem transição nenhuma: seleção e hover aparecem no mesmo quadro do clique/movimento (como no Figma)
  return <div data-testid={testid} className="pointer-events-none absolute" style={{ left: r.x, top: r.y, width: r.width, height: r.height, outline: `${largura}px ${tracejado ? 'dashed' : 'solid'} ${cor}`, boxShadow: semHalo ? undefined : haloDe(largura), transform: rot ? `rotate(${rot}deg)` : undefined, transition: 'none' }} />
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
      <div className="pointer-events-none absolute w-px bg-selecao" style={{ left: r.x + Math.min(84, r.width / 2), top: topo, height: 64, boxShadow: `0 0 0 1px ${HALO_SELECAO}` }} />
      <div className="pointer-events-none absolute flex items-center gap-3 rounded-[10px] border border-selecao bg-superficie p-2 pr-3 shadow-[0_12px_30px_-12px_rgba(13,153,255,.45)]" style={{ left: r.x + 16, top: topo + 64 }}>
        <MiniaturaCena cena={alvo} assets={assets} largura={78} className="border-0" />
        <div className="whitespace-nowrap">
          <div className="text-[12px] font-medium text-acento">{gatilho} → {String(idx + 1).padStart(2, '0')} {alvo.title}</div>
          <div className="text-[11px] text-texto2">{tr ? `${{ none: 'Instantânea', fade: 'Fade', slide: 'Slide', scale: 'Scale', morph: 'Morph', push: 'Empurrar', auto: 'Automática' }[tr.type]} · ${tr.duration}ms · ${curva}` : 'Fade · 400ms'}</div>
        </div>
      </div>
    </>
  )
}

/** Linha, seta ou qualquer camada fininha (≤ 4 px de altura): seleção com alças só nas pontas, como no Figma. */
export function ehLinha(l: Camada): boolean {
  return (l.type === 'shape' && (l.shape === 'line' || l.shape === 'arrow')) || l.height <= 4
}

/** Pontas (centro das bordas esquerda e direita) de uma camada girada em volta do próprio centro, em coordenadas da cena. */
export function pontasDaLinha(l: Retangulo & { rotation: number }): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const cx = l.x + l.width / 2
  const cy = l.y + l.height / 2
  const ang = (l.rotation * Math.PI) / 180
  const dx = (Math.cos(ang) * l.width) / 2
  const dy = (Math.sin(ang) * l.width) / 2
  return { a: { x: cx - dx, y: cy - dy }, b: { x: cx + dx, y: cy + dy } }
}

/** Cursor de redimensionar no ângulo da linha. */
function cursorDaPonta(rotation: number): string {
  return cursorMostra('seta', rotation)
}

function retDe(a: { x: number; y: number }, b: { x: number; y: number }): Retangulo {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}
function quadrado(a: { x: number; y: number }, b: { x: number; y: number }) {
  const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  return { x: a.x + Math.sign(b.x - a.x || 1) * d, y: a.y + Math.sign(b.y - a.y || 1) * d }
}
