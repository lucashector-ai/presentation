'use client'
/**
 * Renderizador de cena — ÚNICO para editor (canvas), miniaturas, preview e visualizador.
 * Contêiner interno no tamanho de referência com `transform: scale(escala)`: tipografia, raios e sombras
 * ficam idênticos em qualquer tamanho (reprodutibilidade).
 *
 * Morph: quando `morphDe` é passado, camadas com o mesmo nome (ou ID) na tela anterior começam com a
 * geometria/cor antiga e animam até a nova.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Animacao, Camada, Cena, Interacao, CamadaTexto } from '@/lib/scene/schema'
import { EASING_CSS, camadaVisivel, interacoesDe, type EstadoRuntime } from '@/lib/scene/motor'
import { ordenarParaRender } from '@/lib/scene/order'
import { calcularLayout } from '@/lib/editor/autolayout'
import { sangrar, type Sangria } from '@/lib/scene/sangria'
import { costurar } from '@/lib/scene/costura'
import { ancestrais, mapaDe } from '@/lib/scene/arvore'
import { recolorirSvg, svgParaDataUrl } from '@/lib/importar/svg'
import { MASCARAS, filtroCss, gradienteCss, raioCss, sombraCss, transformCss } from './estilos'
import { boxShadowCss, desfoqueDe, internas, projetadas, textShadowCss, vidroDe } from '@/lib/scene/efeitos'
import { caminhoCantos, raiosDaCamada, temSuavizacao } from '@/lib/scene/cantos'
import { estiloMascara, herdarAnimacoesDaMascara } from '@/lib/scene/mascara'
import { useRecursosMascara } from './useRecursosMascara'
import { Tracos, estiloTracoTexto } from './camadas/Tracos'
import { Desenho, TextoSegmentado, planoAnimacao, usePreviaAnimacao, varsAnimacao, type PedidoPrevia } from './animacao'
import { atrasosEfetivos, esperaGatilho, interacoesDosGatilhos } from '@/lib/scene/animacoes'
import { CamadaReativa, rolagemPorCss } from './reativos'
import { temInterativo } from '@/lib/scene/reativos'
import { Forma } from './camadas/Forma'
import { Modelo3d } from './camadas/Modelo3d'
import { Lottie } from './camadas/Lottie'
import { CorpoTexto, CorteTexto } from './camadas/CorpoTexto'
import { estiloCaixaTexto, folgaTinta, linhasVisiveis } from '@/lib/scene/tipografia'
import { useFontesDaCena } from './fontes'

export interface AssetResolvido {
  url: string
  thumbUrl?: string | null
  posterUrl?: string | null
}
export type AssetsResolvidos = Record<string, AssetResolvido>

export type ModoRender = 'editor' | 'viewer' | 'miniatura'

export interface SceneRendererProps {
  cena: Cena
  assets: AssetsResolvidos
  escala: number
  modo: ModoRender
  runtime?: EstadoRuntime
  reduzirMovimento?: boolean
  /** Dispositivo sem hover (toque): interações hover viram toque. */
  semHover?: boolean
  mobile?: boolean
  aoInteragir?: (camada: Camada, inter: Interacao[], origem: 'click' | 'hoverEnter' | 'hoverLeave') => void
  registrarVideo?: (id: string, el: HTMLVideoElement | null) => void
  /** Sobreposições do editor (seleção, alças) — em coordenadas da cena. */
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Chave que força re-executar animações de entrada (ex.: id da cena). */
  chaveEntrada?: string
  /** Transição morph: tela de origem e duração. */
  morphDe?: Cena
  morphDuracao?: number
  morphEasing?: string
  /** No editor: camadas 3D e embeds ficam interativos (botão "interagir"). */
  interativoNoEditor?: boolean
  /** IDs a ocultar (ex.: camadas que estão sendo editadas inline). */
  ocultar?: ReadonlySet<string>
  /** Tela saindo: as camadas tocam a animação de saída (exitAnimation). */
  saida?: boolean
  /** Apresentação: área extra em volta da cena; camadas que encostam na borda se estendem até ela. */
  sangria?: Sangria
  /** Visualizador: false = camadas paradas no estado final, sem entradas nem loops (ex.: telas de contexto no Explorar). */
  animar?: boolean
  /** Story: entradas "ao rolar" e o parallax acompanham a rolagem. */
  rolagem?: boolean
}

/** Props internas: prévia de animação pedida pelo inspetor (só no modo editor). */
type PropsInternas = SceneRendererProps & { previa?: PedidoPrevia | null; classeTransicao?: string }

/** Chave usada para casar camadas entre telas no morph. */
export function chaveMorph(c: Camada): string {
  return c.name?.trim() ? `n:${c.name.trim().toLowerCase()}` : `i:${c.id}`
}

/**
 * Memorizado: quem o usa re-renderiza por outros motivos (o visualizador ao tirar a tela que saiu do DOM, ao
 * trocar o estado dos controles) e a tela com as entradas tocando não precisa ser reconciliada de novo — com
 * texto dividido isso eram centenas de partes no meio da animação.
 */
export const SceneRenderer = memo(function SceneRenderer(props: SceneRendererProps) {
  // fontes do Google usadas pelos textos desta tela (editor, visualizador, miniaturas, exportação…)
  useFontesDaCena(props.cena)
  // prévia do inspetor: no editor, toca entradas/saídas/transição sem sair do modo de edição
  const previa = usePreviaAnimacao(props.modo === 'editor')
  const tr = previa?.transicao
  if (previa && tr && tr.type !== 'none') {
    const morph = tr.type === 'morph' && !!previa.morphDe
    return <CenaRender key={`pv-${previa.nonce}`} {...props} previa={previa} morphDe={morph ? previa.morphDe : undefined} morphDuracao={tr.duration} morphEasing={EASING_CSS[tr.easing]} classeTransicao={morph ? undefined : `cena-transicao-${tr.type === 'morph' ? 'fade' : tr.type}`} />
  }
  return <CenaRender {...props} previa={previa} />
})

function CenaRender(props: PropsInternas) {
  const { cena, assets, escala, modo, children, className, style, morphDe, classeTransicao, sangria } = props
  const fundo = cena.backgroundAssetId ? assets[cena.backgroundAssetId] : undefined
  // auto layout resolvido também aqui: visualizador e miniaturas mostram o mesmo que o editor
  const dpr = useDensidade()
  const passo = escala > 0 ? 1 / (escala * dpr) : undefined
  // (a camada recortada sem animação própria anima com a sua máscara)
  const camadas = useMemo(() => herdarAnimacoesDaMascara(costurar(ordenarParaRender(sangrar(calcularLayout(cena.layers), cena.size, sangria)), passo)), [cena.layers, cena.size, sangria, passo])
  const herdado = useMemo(() => herancaDeFrames(camadas), [camadas])
  // "quando" das entradas: atrasos em cadeia (depois de outra camada) e cliques/hovers que tocam animações
  const gatilhos = useMemo(() => ({ atrasos: atrasosEfetivos(camadas), inter: interacoesDosGatilhos(camadas) }), [camadas])
  // máscaras: cada camada recortada recebe a mask-image da sua máscara (forma, texto, imagem ou SVG; fontes e
  // imagens embutidas carregadas sob demanda)
  const recursosMascara = useRecursosMascara(camadas, assets)
  const mascaras = useMemo(() => {
    if (!camadas.some((c) => c.maskId)) return null
    const m = mapaDe(camadas)
    return new Map(camadas.filter((c) => c.maskId).map((c) => [c.id, estiloMascara(c, m, recursosMascara, assets)]))
  }, [camadas, recursosMascara, assets])
  const mapaMorph = useMemo(() => (morphDe ? new Map(morphDe.layers.map((l) => [chaveMorph(l), l])) : null), [morphDe])
  const fundoCss = cena.backgroundGradient ? gradienteCss(cena.backgroundGradient) : cena.background
  const [fundoAtual, setFundoAtual] = useState(morphDe ? (morphDe.backgroundGradient ? gradienteCss(morphDe.backgroundGradient) : morphDe.background) : fundoCss)
  useEffect(() => {
    const r = requestAnimationFrame(() => setFundoAtual(fundoCss))
    return () => cancelAnimationFrame(r)
  }, [fundoCss])

  // prévia de transição no editor (fade/deslizar/zoom): a tela só se move e uma cortina da cor do canvas some por
  // cima — a mesma mistura de cores; a tela inteira com opacidade animada (e as entradas tocando dentro) pedia uma
  // superfície de composição a mais e o canvas era desenhado duas vezes por quadro
  const cortina = !!classeTransicao && /-(fade|slide|scale)$/.test(classeTransicao)
  return (
    // colorScheme/forcedColorAdjust: a tela é o documento — não segue o tema do app nem o "escuro forçado"/alto contraste do navegador
    <div className={[className, classeTransicao, cortina ? 'sob-a-anterior' : ''].filter(Boolean).join(' ') || undefined} style={{ colorScheme: 'light', forcedColorAdjust: 'none', width: cena.size.width * escala, height: cena.size.height * escala, position: 'relative', overflow: sangria ? 'visible' : 'hidden', background: morphDe ? fundoAtual : fundoCss, transition: morphDe ? `background ${props.morphDuracao ?? 600}ms ${props.morphEasing ?? 'ease'}` : undefined, ...(classeTransicao ? { ['--dur' as string]: `${props.morphDuracao ?? 500}ms` } : {}), ...style }}>
      <div style={{ width: cena.size.width, height: cena.size.height, transform: `scale(${escala})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
        {fundo && <img src={modo === 'miniatura' ? fundo.thumbUrl || fundo.url : fundo.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: cena.backgroundFit, pointerEvents: 'none' }} />}
        {camadas.map((c) => (props.ocultar?.has(c.id) ? null : <LayerView key={c.id} camada={c} props={props} origemMorph={mapaMorph?.get(chaveMorph(c))} heranca={herdado.get(c.id)} gatilhos={gatilhos} mascara={mascaras?.get(c.id)} />))}
        {children}
      </div>
      {cortina && <div aria-hidden className="cena-cortina" />}
    </div>
  )
}

/** O que um filho herda dos frames ancestrais: ocultação, opacidade e recorte (clip). */
interface Heranca { oculta: boolean; opacidade: number; clip?: string }
function herancaDeFrames(camadas: readonly Camada[]): Map<string, Heranca> {
  const r = new Map<string, Heranca>()
  if (!camadas.some((c) => c.parentId)) return r
  const mapa = mapaDe(camadas)
  for (const c of camadas) {
    const anc = ancestrais(c, mapa)
    if (!anc.length) continue
    const clips = anc.filter((a) => a.clip)
    let clip: string | undefined
    if (clips.length) {
      // interseção dos frames com clip, em coordenadas locais da camada
      const x0 = Math.max(...clips.map((a) => a.x))
      const y0 = Math.max(...clips.map((a) => a.y))
      const x1 = Math.min(...clips.map((a) => a.x + a.width))
      const y1 = Math.min(...clips.map((a) => a.y + a.height))
      const f = clips[0]!
      const raio = f.radii ? f.radii.map((x) => `${x}px`).join(' ') : f.radius ? `${f.radius}px` : ''
      // com sinal: o lado em que o frame fica fora da camada recorta lá na borda do frame (inset negativo), e não na
      // borda da camada — senão um texto que passa do frame só embaixo perdia os acentos em cima
      const t = y0 - c.y
      const l = x0 - c.x
      const b = c.y + c.height - y1
      const d = c.x + c.width - x1
      if (t > 0 || l > 0 || b > 0 || d > 0) clip = `inset(${t}px ${d}px ${b}px ${l}px${raio && clips.length === 1 ? ` round ${raio}` : ''})`
    }
    r.set(c.id, { oculta: anc.some((a) => a.hidden), opacidade: anc.reduce((o, a) => o * a.opacity, 1), clip })
  }
  return r
}

function geometria(c: Camada): CSSProperties {
  return { left: c.x, top: c.y, width: c.width, height: c.height, opacity: c.opacity, transform: transformCss(c) }
}

/**
 * Loop "até sair da tela": vira true (uma vez) quando a camada, depois de ter aparecido, sai da janela. Um
 * IntersectionObserver por camada com esse loop; nada por quadro.
 */
function useSaiuDaJanela(ativo: boolean): [(el: HTMLDivElement | null) => void, boolean] {
  const [saiu, setSaiu] = useState(false)
  const io = useRef<IntersectionObserver | null>(null)
  const ref = useCallback((el: HTMLDivElement | null) => {
    io.current?.disconnect()
    io.current = null
    if (!el || !ativo || saiu || typeof IntersectionObserver === 'undefined') return
    let viu = false
    const obs = new IntersectionObserver(([e]) => {
      if (!e) return
      if (e.isIntersecting) viu = true
      else if (viu) { obs.disconnect(); setSaiu(true) }
    })
    obs.observe(el)
    io.current = obs
  }, [ativo, saiu])
  useEffect(() => () => io.current?.disconnect(), [])
  return [ref, saiu]
}

/** Densidade de pixels do monitor; 1 no servidor e no primeiro render (evita diferença de hidratação). */
function useDensidade(): number {
  const [dpr, setDpr] = useState(1)
  useEffect(() => {
    const atualizar = () => setDpr(window.devicePixelRatio || 1)
    atualizar()
    window.addEventListener('resize', atualizar)
    return () => window.removeEventListener('resize', atualizar)
  }, [])
  return dpr
}

type PropsCamada = { camada: Camada; props: PropsInternas; origemMorph?: Camada; heranca?: Heranca; gatilhos: { atrasos: Map<string, number>; inter: ReturnType<typeof interacoesDosGatilhos> }; mascara?: CSSProperties }

/**
 * Props da tela que só a própria tela usa (a camada não lê): mudar a cena não muda a camada que não mudou, e o
 * zoom do editor (escala) também não.
 */
const SO_DA_TELA = new Set<string>(['cena', 'children', 'className', 'style', 'ocultar', 'escala'])

function rasoIgual(a: object | undefined, b: object | undefined, ignorar?: Set<string>): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  for (const k in ra) if (!ignorar?.has(k) && ra[k] !== rb[k]) return false
  for (const k in rb) if (!ignorar?.has(k) && !(k in ra)) return false
  return true
}

/**
 * Camada memorizada: arrastar, redimensionar ou girar uma camada no editor gera uma cena nova a cada quadro, mas
 * as outras camadas continuam o mesmo objeto — só a que mudou re-renderiza. Os mapas da tela (atrasos, gatilhos,
 * herança dos frames, máscaras) são refeitos junto com a cena; compara-se só o que vale para esta camada.
 */
function camadaIgual(a: PropsCamada, b: PropsCamada): boolean {
  const id = a.camada.id
  if (a.camada !== b.camada || a.origemMorph !== b.origemMorph) return false
  if (!rasoIgual(a.heranca, b.heranca) || !rasoIgual(a.mascara, b.mascara)) return false
  if (a.gatilhos !== b.gatilhos) {
    if (a.gatilhos.atrasos.get(id) !== b.gatilhos.atrasos.get(id)) return false
    const ia = a.gatilhos.inter.get(id)
    const ib = b.gatilhos.inter.get(id)
    if ((ia || ib) && JSON.stringify(ia) !== JSON.stringify(ib)) return false
  }
  return rasoIgual(a.props, b.props, SO_DA_TELA)
}

const LayerView = memo(function LayerView({ camada: c, props, origemMorph, heranca, gatilhos, mascara }: PropsCamada) {
  const { modo, runtime, reduzirMovimento = false, semHover = false, mobile = false, aoInteragir, chaveEntrada, morphDe, morphDuracao = 600, morphEasing = 'ease' } = props
  const viewer = modo === 'viewer'
  const visivel = (runtime ? camadaVisivel(c, runtime) : !c.hidden) && !heranca?.oculta
  const [morphFim, setMorphFim] = useState(!origemMorph)
  // entrada terminada (por chave de animação): sai do estilo para a camada deixar de ser composta
  const [concluida, setConcluida] = useState<string | null>(null)
  // loop "até sair da tela": para quando a camada sai da janela (no Story, ao rolar para longe)
  const [refLoop, loopSaiu] = useSaiuDaJanela(viewer && c.loopAnimation?.until === 'offscreen')
  useEffect(() => {
    if (!origemMorph) return
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setMorphFim(true)))
    return () => cancelAnimationFrame(r)
  }, [origemMorph])

  if (!visivel && modo !== 'editor') return null
  if (viewer && mobile && c.mobile?.hidden) return null

  const virtuais = gatilhos.inter.get(c.id)
  const cliques = viewer ? [...interacoesDe(c, 'click'), ...(virtuais?.click ?? []), ...(semHover ? [...interacoesDe(c, 'hover'), ...(virtuais?.hover ?? [])] : [])] : []
  const hovers = viewer && !semHover ? [...interacoesDe(c, 'hover'), ...(virtuais?.hover ?? [])] : []
  const clicavel = cliques.length > 0
  const animRuntime = runtime?.animacoes[c.id]
  // no morph, camadas casadas não fazem animação de entrada; as novas tocam a própria entrada depois que o
  // morph engrena (30% da duração) — ou um fade, se não tiverem entrada
  const atrasoMorph = Math.round(morphDuracao * 0.3)
  const entradaBase = c.enterAnimation ? { ...c.enterAnimation, delay: gatilhos.atrasos.get(c.id) ?? c.enterAnimation.delay } : undefined
  const animEntrada = morphDe
    ? origemMorph
      ? undefined
      : entradaBase && entradaBase.type !== 'none'
        ? { ...entradaBase, delay: entradaBase.delay + atrasoMorph }
        : ({ type: 'fadeIn', duration: Math.round(morphDuracao * 0.8), delay: Math.round(morphDuracao * 0.2), easing: 'easeOut' } as Animacao)
    : entradaBase
  // prévia no editor (inspetor): toca como no visualizador, só nas camadas pedidas
  const previa = props.previa
  const previaAqui = !!previa && !c.hidden && (!previa.ids || previa.ids.includes(c.id))
  // a prévia dos efeitos interativos (ponteiro simulado) não toca a entrada junto
  const tocar = (viewer && props.animar !== false) || (previaAqui && !previa?.interativo)
  const saindo = !animRuntime && (props.saida || (previaAqui && !!previa?.saida))
  const entrada = previaAqui && previa?.semAtraso && animEntrada ? { ...animEntrada, delay: 0 } : animEntrada
  const anim = animRuntime ? animRuntime.animacao : tocar ? (saindo ? c.exitAnimation : entrada) : undefined
  const chaveAnim = animRuntime ? `rt-${animRuntime.nonce}` : previaAqui ? `pv-${previa?.nonce}` : `in-${chaveEntrada ?? ''}`
  // entrada por clique/hover: parada no 1º quadro até o público agir (a prévia do editor toca direto)
  const aguardar = viewer && !animRuntime && !saindo && !previaAqui && esperaGatilho(c.enterAnimation)
  const plano = planoAnimacao({ entrada: saindo ? undefined : anim, saida: saindo ? anim : undefined, loop: tocar && !animRuntime && !loopSaiu ? c.loopAnimation : undefined, reduzir: reduzirMovimento, ehTexto: c.type === 'text', desenhavel: c.type === 'shape' && c.shape !== 'rect' && c.shape !== 'ellipse', aguardar, concluida: concluida === chaveAnim, rolagem: viewer && !!props.rolagem && rolagemPorCss() })
  const geoAtual = origemMorph && !morphFim ? geometria(origemMorph) : geometria(c)
  const e = c.effects

  const base: CSSProperties = {
    position: 'absolute',
    ...geoAtual,
    opacity: (visivel ? (geoAtual.opacity as number) : 0.3) * (heranca?.opacidade ?? 1),
    clipPath: heranca?.clip,
    ['--clip-final' as string]: heranca?.clip ?? 'none',
    zIndex: c.z,
    ...varsAnimacao(c),
    // texto: as animações que recortam (revelar, máscara) param um pouco fora da caixa (acentos e descendentes)
    ...(c.type === 'text' ? { ['--clip-folga' as string]: `${folgaTinta(c)}px` } : {}),
    // a entrada termina na opacidade parada da camada (com a dos frames pais): ao soltar a animação no fim,
    // nada muda de lugar nem de opacidade
    ['--op' as string]: (visivel ? c.opacity : 0.3) * (heranca?.opacidade ?? 1),
    cursor: clicavel ? 'pointer' : undefined,
    mixBlendMode: e?.blend && e.blend !== 'normal' ? e.blend : undefined,
    backdropFilter: vidroDe(e) ? `blur(${vidroDe(e)}px)` : undefined,
    WebkitBackdropFilter: vidroDe(e) ? `blur(${vidroDe(e)}px)` : undefined,
    ...mascara,
    transition: origemMorph ? `left ${morphDuracao}ms ${morphEasing}, top ${morphDuracao}ms ${morphEasing}, width ${morphDuracao}ms ${morphEasing}, height ${morphDuracao}ms ${morphEasing}, opacity ${morphDuracao}ms ${morphEasing}, transform ${morphDuracao}ms ${morphEasing}` : undefined,
    ...plano.estilo,
  }
  const classes = [plano.classe ?? '', c.type === 'hotspot' && viewer && c.hint ? 'hotspot-dica' : ''].filter(Boolean).join(' ')
  const rotulo = c.ariaLabel || (c.type === 'text' ? c.text : undefined)

  const eventos =
    clicavel || hovers.length
      ? {
          role: clicavel ? 'button' : undefined,
          tabIndex: clicavel ? 0 : undefined,
          'aria-label': rotulo,
          onClick: clicavel ? (ev: React.MouseEvent) => { ev.stopPropagation(); aoInteragir?.(c, cliques, 'click') } : undefined,
          onKeyDown: clicavel ? (ev: React.KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); aoInteragir?.(c, cliques, 'click') } } : undefined,
          onPointerEnter: hovers.length ? () => aoInteragir?.(c, hovers, 'hoverEnter') : undefined,
          onPointerLeave: hovers.length ? () => aoInteragir?.(c, hovers, 'hoverLeave') : undefined,
          onFocus: hovers.length ? () => aoInteragir?.(c, hovers, 'hoverEnter') : undefined,
          onBlur: hovers.length ? () => aoInteragir?.(c, hovers, 'hoverLeave') : undefined,
        }
      : c.ariaLabel && viewer
        ? { role: 'img', 'aria-label': c.ariaLabel }
        : {}

  return (
    <div key={chaveAnim} ref={refLoop} data-layer-id={c.id} data-layer-type={c.type} data-parent-id={c.parentId} className={classes || undefined} style={base} onAnimationEnd={plano.soltavel ? (ev) => { if (ev.target === ev.currentTarget && !ev.animationName.startsWith('loop-')) setConcluida(chaveAnim) } : undefined} {...eventos}>
      {c.isMask ? (
        // máscara não é desenhada; o texto-máscara fica invisível no lugar (o clique duplo põe o cursor onde clicou)
        c.type === 'text' ? <div style={{ visibility: 'hidden', width: '100%', height: '100%' }}><Conteudo camada={c} props={props} morphDuracao={morphDuracao} morphEasing={morphEasing} /></div> : null
      ) : temInterativo(c) && c.interactiveEffects ? (
        // parallax, tilt e luz: invólucros próprios dentro da camada (ver components/renderer/reativos.tsx)
        <CamadaReativa efeitos={c.interactiveEffects} modo={props.animar === false ? 'miniatura' : modo} reduzir={reduzirMovimento} semHover={semHover} rolagem={!!props.rolagem} largura={c.width} altura={c.height} raio={'radius' in c ? raioCss(c) : undefined} simular={previaAqui && previa?.interativo ? previa.nonce : undefined}>
          <Conteudo camada={c} props={props} origemMorph={morphFim ? undefined : origemMorph} morphDuracao={morphDuracao} morphEasing={morphEasing} animTexto={plano.texto} rolagemTexto={plano.rolagem} desenhar={plano.desenho} />
          {c.strokes && <Tracos camada={c} />}
        </CamadaReativa>
      ) : (
        <>
          <Conteudo camada={c} props={props} origemMorph={morphFim ? undefined : origemMorph} morphDuracao={morphDuracao} morphEasing={morphEasing} animTexto={plano.texto} rolagemTexto={plano.rolagem} desenhar={plano.desenho} />
          {c.strokes && <Tracos camada={c} />}
        </>
      )}
    </div>
  )
}, camadaIgual)

function Conteudo({ camada: c, props, origemMorph, morphDuracao, morphEasing, animTexto, rolagemTexto, desenhar }: { camada: Camada; props: SceneRendererProps; origemMorph?: Camada; morphDuracao: number; morphEasing: string; animTexto?: Animacao; rolagemTexto?: string; desenhar?: boolean }) {
  const { assets, modo, mobile = false, registrarVideo, interativoNoEditor } = props
  const e = c.effects
  const interativo = modo === 'viewer' || !!interativoNoEditor
  switch (c.type) {
    case 'text':
      return <Texto c={c} origem={origemMorph?.type === 'text' ? origemMorph : undefined} modo={modo} duracao={morphDuracao} easing={morphEasing} animTexto={animTexto} rolagem={rolagemTexto} />
    case 'shape':
      return (
        <Desenho ativo={!!desenhar} style={{ width: '100%', height: '100%', filter: filtroCss(e, (c.shape !== 'rect' && c.shape !== 'ellipse') || (c.shape === 'rect' && temSuavizacao(c))) }}>
          <Forma camada={origemMorph?.type === 'shape' ? { ...c, fill: origemMorph.fill } : c} />
        </Desenho>
      )
    case 'frame': {
      const suave = temSuavizacao(c)
      const caixa = (
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            background: c.gradient ? gradienteCss(c.gradient) : c.fill,
            border: !c.strokes && c.stroke && c.strokeWidth ? `${c.strokeWidth}px solid ${c.stroke}` : undefined,
            borderRadius: suave ? undefined : raioCss(c),
            clipPath: suave ? recorteSuave(c) : undefined,
            boxShadow: suave ? boxShadowCss(internas(e)) : sombraCss(e),
            filter: suave ? undefined : filtroCss(e, false),
          }}
        />
      )
      return suave ? <div style={{ width: '100%', height: '100%', filter: filtroCss(e, true) }}>{caixa}</div> : caixa
    }
    case 'hotspot':
      return modo === 'editor' ? <div style={{ width: '100%', height: '100%', border: '2px dashed rgba(89,101,242,.9)', background: 'rgba(89,101,242,.08)', borderRadius: 6 }} aria-hidden /> : null
    case 'image': {
      const a = assets[c.assetId]
      const fit = mobile && c.mobile?.fit ? c.mobile.fit : c.fit
      const adj = c.adjust
      const filtroAjuste = adj ? `brightness(${adj.brightness}) contrast(${adj.contrast}) saturate(${adj.saturate}) grayscale(${adj.grayscale})${adj.invert ? ` invert(${adj.invert})` : ''}` : ''
      const suave = c.mask === 'none' && temSuavizacao(c)
      const dentro = c.mask === 'none' ? boxShadowCss(internas(e)) : undefined
      const imagem = (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: suave ? undefined : raioCss(c), overflow: 'hidden', clipPath: suave ? recorteSuave(c) : MASCARAS[c.mask], boxShadow: c.mask === 'none' && !suave ? boxShadowCss(projetadas(e)) : undefined, filter: filtroCss(e, c.mask !== 'none', filtroAjuste) }}>
          <Midia src={a ? (modo === 'miniatura' ? a.thumbUrl || a.url : a.url) : undefined} fit={fit} crop={c.crop} />
          {dentro && <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: suave ? undefined : raioCss(c), boxShadow: dentro, pointerEvents: 'none' }} />}
        </div>
      )
      return suave ? <div style={{ width: '100%', height: '100%', filter: filtroCss(e, true) }}>{imagem}</div> : imagem
    }
    case 'video': {
      const a = assets[c.assetId]
      const poster = c.posterAssetId ? assets[c.posterAssetId]?.url : a?.posterUrl ?? undefined
      const fit = mobile && c.mobile?.fit ? c.mobile.fit : c.fit
      if (modo !== 'viewer') return <div style={{ width: '100%', height: '100%', borderRadius: raioCss(c), overflow: 'hidden', background: '#000', boxShadow: sombraCss(e), filter: filtroCss(e, false) }}>{poster ? <Midia src={poster} fit={fit} /> : <video src={a?.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: fit }} />}</div>
      return (
        <video
          ref={(el) => registrarVideo?.(c.id, el)}
          src={a?.url}
          poster={poster}
          autoPlay={c.autoplay}
          muted={c.muted || c.autoplay}
          loop={c.loop}
          controls={c.controls}
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: fit, borderRadius: raioCss(c), background: '#000', boxShadow: sombraCss(e), filter: filtroCss(e, false) }}
        />
      )
    }
    case 'svg': {
      const src = c.markup ? svgParaDataUrl(recolorirSvg(c.markup, c.recolor)) : c.assetId ? assets[c.assetId]?.url : undefined
      return <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: c.fit === 'fill' ? 'fill' : 'contain', display: 'block', pointerEvents: 'none', filter: filtroCss(e, true) }} />
    }
    case 'model3d': {
      const a = assets[c.assetId]
      const poster = c.posterAssetId ? assets[c.posterAssetId]?.url : undefined
      return (
        <div style={{ width: '100%', height: '100%', filter: filtroCss(e, true), borderRadius: raioCss(c) || undefined, overflow: c.radius ? 'hidden' : undefined }}>
          <Modelo3d camada={c} src={a?.url} poster={poster} interativo={interativo} estatico={modo === 'miniatura'} />
        </div>
      )
    }
    case 'lottie':
      return (
        <div style={{ width: '100%', height: '100%', borderRadius: raioCss(c) || undefined, overflow: c.radius ? 'hidden' : undefined, filter: filtroCss(e, true) }}>
          <Lottie camada={c} src={c.assetId ? assets[c.assetId]?.url : undefined} estatico={modo === 'miniatura'} />
        </div>
      )
    case 'embed':
      if (modo !== 'viewer' && !interativo) {
        return (
          <div style={{ width: '100%', height: '100%', borderRadius: raioCss(c), background: '#171717', color: '#A3A3A3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'var(--font-geist-mono), monospace', fontSize: Math.max(14, c.width * 0.025), textAlign: 'center', padding: 24 }}>
            <span style={{ color: '#FAFAF9', fontSize: '1.4em' }}>▶ Incorporado</span>
            <span style={{ wordBreak: 'break-all' }}>{new URL(c.url).hostname}</span>
          </div>
        )
      }
      return (
        <iframe
          src={c.url}
          title={c.ariaLabel || 'Conteúdo incorporado'}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ width: '100%', height: '100%', border: 0, borderRadius: raioCss(c), background: '#000', pointerEvents: interativo ? 'auto' : 'none' }}
        />
      )
  }
}

function Texto({ c, origem, modo, duracao, easing, animTexto, rolagem }: { c: CamadaTexto; origem?: CamadaTexto; modo: ModoRender; duracao: number; easing: string; animTexto?: Animacao; rolagem?: string }) {
  const fonte = origem ?? c
  const gradiente = c.gradient ? gradienteCss(c.gradient) : undefined
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        // alinhamento vertical, padding, fonte, decoração, caixa e quebra: lib/scene/tipografia.ts (igual à medição)
        ...estiloCaixaTexto(c),
        background: fonte.background,
        borderRadius: raioCss(c),
        transition: origem || modo === 'viewer' ? `color ${duracao}ms ${easing}, font-size ${duracao}ms ${easing}, background ${duracao}ms ${easing}, letter-spacing ${duracao}ms ${easing}` : undefined,
        fontSize: fonte.fontSize,
        color: fonte.color,
        letterSpacing: fonte.letterSpacing,
        // texto invisível sobre a imagem de uma página de PDF importada: selecionável ao apresentar
        userSelect: modo === 'editor' ? 'none' : /^#[0-9a-f]{6}00$/i.test(c.color) && !c.background ? 'text' : undefined,
        textShadow: textShadowCss(projetadas(c.effects)),
        filter: desfoqueDe(c.effects) ? `blur(${desfoqueDe(c.effects)}px)` : undefined,
        ...estiloTracoTexto(c),
        // texto animado por partes: o que muda dentro dele (letras aparecendo, sorteio, contador) não refaz o
        // layout nem o estilo do resto da tela — a caixa tem o tamanho da camada (definido), então a contenção de
        // tamanho não muda nada e faz dela um limite de layout. Sem contenção de pintura: as partes sobem de fora.
        // As partes que entram de fora aparecem a partir da borda da caixa (como antes), mas com folga em cima e
        // embaixo (e um pouco dos lados): acentos, descendentes e itálico nunca são cortados.
        ...(animTexto ? { contain: 'size layout style', ...(c.leadingTrim !== 'cap' && linhasVisiveis(c) === undefined ? { clipPath: `inset(-${folgaTinta(c)}px -${Math.ceil(c.fontSize * 0.2)}px)` } : {}) } : {}),
      }}
    >
      {animTexto ? (
        <CorteTexto c={c}><TextoSegmentado texto={c.text} animacao={animTexto} gradiente={gradiente} cor={c.gradient?.stops[0]?.color ?? c.color} caixa={c} rolagem={rolagem} /></CorteTexto>
      ) : (
        <CorpoTexto c={c} gradiente={gradiente} />
      )}
    </div>
  )
}

/** clip-path dos cantos suavizados (squircle) de uma caixa. */
function recorteSuave(c: { width: number; height: number; radius?: number; radii?: [number, number, number, number]; cornerSmoothing?: number }): string {
  return `path("${caminhoCantos(c.width, c.height, raiosDaCamada(c), c.cornerSmoothing ?? 0)}")`
}

function Midia({ src, fit, crop }: { src?: string; fit: 'contain' | 'cover' | 'fill'; crop?: { x: number; y: number; w: number; h: number } }) {
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => setErro(false), [src, tentativa])
  if (!src || erro) {
    return (
      <div className="listras" style={{ width: '100%', height: '100%', background: 'rgba(163,163,163,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#737373', fontFamily: 'var(--font-geist-mono), monospace', fontSize: 22 }}>
        <span>{!src ? 'mídia indisponível' : 'Não foi possível carregar este arquivo.'}</span>
        {src && (
          <button onClick={(e) => { e.stopPropagation(); setTentativa((t) => t + 1) }} style={{ fontSize: 20, padding: '8px 20px', borderRadius: 99, border: '2px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        )}
      </div>
    )
  }
  const url = tentativa ? `${src}${src.includes('?') ? '&' : '?'}r=${tentativa}` : src
  if (crop) {
    return (
      <img src={url} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setErro(true)}
        style={{ position: 'absolute', width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%`, maxWidth: 'none', pointerEvents: 'none' }} />
    )
  }
  return <img src={url} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block', pointerEvents: 'none' }} />
}
