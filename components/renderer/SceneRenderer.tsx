'use client'
/**
 * Renderizador de cena — ÚNICO para editor (canvas), miniaturas, preview e visualizador.
 * Contêiner interno no tamanho de referência com `transform: scale(escala)`: tipografia, raios e sombras
 * ficam idênticos em qualquer tamanho (reprodutibilidade).
 *
 * Morph: quando `morphDe` é passado, camadas com o mesmo nome (ou ID) na tela anterior começam com a
 * geometria/cor antiga e animam até a nova.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Animacao, Camada, Cena, Interacao, CamadaTexto } from '@/lib/scene/schema'
import { EASING_CSS, camadaVisivel, interacoesDe, type EstadoRuntime } from '@/lib/scene/motor'
import { ordenarParaRender } from '@/lib/scene/order'
import { calcularLayout } from '@/lib/editor/autolayout'
import { ancestrais, mapaDe } from '@/lib/scene/arvore'
import { recolorirSvg, svgParaDataUrl } from '@/lib/importar/svg'
import { pilhaFonte } from '@/lib/design-tokens'
import { MASCARAS, filtroCss, gradienteCss, sombraCss, transformCss } from './estilos'
import { TextoSegmentado, planoAnimacao, usePreviaAnimacao, varsAnimacao, type PedidoPrevia } from './animacao'
import { Forma } from './camadas/Forma'
import { Modelo3d } from './camadas/Modelo3d'
import { Lottie } from './camadas/Lottie'

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
}

/** Props internas: prévia de animação pedida pelo inspetor (só no modo editor). */
type PropsInternas = SceneRendererProps & { previa?: PedidoPrevia | null; classeTransicao?: string }

/** Chave usada para casar camadas entre telas no morph. */
export function chaveMorph(c: Camada): string {
  return c.name?.trim() ? `n:${c.name.trim().toLowerCase()}` : `i:${c.id}`
}

export function SceneRenderer(props: SceneRendererProps) {
  // prévia do inspetor: no editor, toca entradas/saídas/transição sem sair do modo de edição
  const previa = usePreviaAnimacao(props.modo === 'editor')
  const tr = previa?.transicao
  if (previa && tr && tr.type !== 'none') {
    const morph = tr.type === 'morph' && !!previa.morphDe
    return <CenaRender key={`pv-${previa.nonce}`} {...props} previa={previa} morphDe={morph ? previa.morphDe : undefined} morphDuracao={tr.duration} morphEasing={EASING_CSS[tr.easing]} classeTransicao={morph ? undefined : `cena-transicao-${tr.type === 'morph' ? 'fade' : tr.type}`} />
  }
  return <CenaRender {...props} previa={previa} />
}

function CenaRender(props: PropsInternas) {
  const { cena, assets, escala, modo, children, className, style, morphDe, classeTransicao } = props
  const fundo = cena.backgroundAssetId ? assets[cena.backgroundAssetId] : undefined
  // auto layout resolvido também aqui: visualizador e miniaturas mostram o mesmo que o editor
  const camadas = useMemo(() => ordenarParaRender(calcularLayout(cena.layers)), [cena.layers])
  const herdado = useMemo(() => herancaDeFrames(camadas), [camadas])
  const mapaMorph = useMemo(() => (morphDe ? new Map(morphDe.layers.map((l) => [chaveMorph(l), l])) : null), [morphDe])
  const fundoCss = cena.backgroundGradient ? gradienteCss(cena.backgroundGradient) : cena.background
  const [fundoAtual, setFundoAtual] = useState(morphDe ? (morphDe.backgroundGradient ? gradienteCss(morphDe.backgroundGradient) : morphDe.background) : fundoCss)
  useEffect(() => {
    const r = requestAnimationFrame(() => setFundoAtual(fundoCss))
    return () => cancelAnimationFrame(r)
  }, [fundoCss])

  return (
    <div className={[className, classeTransicao].filter(Boolean).join(' ') || undefined} style={{ width: cena.size.width * escala, height: cena.size.height * escala, position: 'relative', overflow: 'hidden', background: morphDe ? fundoAtual : fundoCss, transition: morphDe ? `background ${props.morphDuracao ?? 600}ms ${props.morphEasing ?? 'ease'}` : undefined, ...(classeTransicao ? { ['--dur' as string]: `${props.morphDuracao ?? 500}ms` } : {}), ...style }}>
      <div style={{ width: cena.size.width, height: cena.size.height, transform: `scale(${escala})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
        {fundo && <img src={modo === 'miniatura' ? fundo.thumbUrl || fundo.url : fundo.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: cena.backgroundFit, pointerEvents: 'none' }} />}
        {camadas.map((c) => (props.ocultar?.has(c.id) ? null : <LayerView key={c.id} camada={c} props={props} origemMorph={mapaMorph?.get(chaveMorph(c))} heranca={herdado.get(c.id)} />))}
        {children}
      </div>
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
      const raio = clips[0]!.radius
      const t = Math.max(0, y0 - c.y)
      const l = Math.max(0, x0 - c.x)
      const b = Math.max(0, c.y + c.height - y1)
      const d = Math.max(0, c.x + c.width - x1)
      if (t || l || b || d) clip = `inset(${t}px ${d}px ${b}px ${l}px${raio && clips.length === 1 ? ` round ${raio}px` : ''})`
    }
    r.set(c.id, { oculta: anc.some((a) => a.hidden), opacidade: anc.reduce((o, a) => o * a.opacity, 1), clip })
  }
  return r
}

function geometria(c: Camada): CSSProperties {
  return { left: c.x, top: c.y, width: c.width, height: c.height, opacity: c.opacity, transform: transformCss(c) }
}

function LayerView({ camada: c, props, origemMorph, heranca }: { camada: Camada; props: PropsInternas; origemMorph?: Camada; heranca?: Heranca }) {
  const { modo, runtime, reduzirMovimento = false, semHover = false, mobile = false, aoInteragir, chaveEntrada, morphDe, morphDuracao = 600, morphEasing = 'ease' } = props
  const viewer = modo === 'viewer'
  const visivel = (runtime ? camadaVisivel(c, runtime) : !c.hidden) && !heranca?.oculta
  const [morphFim, setMorphFim] = useState(!origemMorph)
  useEffect(() => {
    if (!origemMorph) return
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setMorphFim(true)))
    return () => cancelAnimationFrame(r)
  }, [origemMorph])

  if (!visivel && modo !== 'editor') return null
  if (viewer && mobile && c.mobile?.hidden) return null

  const cliques = viewer ? [...interacoesDe(c, 'click'), ...(semHover ? interacoesDe(c, 'hover') : [])] : []
  const hovers = viewer && !semHover ? interacoesDe(c, 'hover') : []
  const clicavel = cliques.length > 0
  const animRuntime = runtime?.animacoes[c.id]
  // no morph, camadas casadas não fazem animação de entrada; as novas entram com fade
  const animEntrada = morphDe ? (origemMorph ? undefined : ({ type: 'fadeIn', duration: Math.round(morphDuracao * 0.8), delay: Math.round(morphDuracao * 0.2), easing: 'easeOut' } as Animacao)) : c.enterAnimation
  // prévia no editor (inspetor): toca como no visualizador, só nas camadas pedidas
  const previa = props.previa
  const previaAqui = !!previa && !c.hidden && (!previa.ids || previa.ids.includes(c.id))
  const tocar = viewer || previaAqui
  const saindo = !animRuntime && (props.saida || (previaAqui && !!previa?.saida))
  const entrada = previaAqui && previa?.semAtraso && animEntrada ? { ...animEntrada, delay: 0 } : animEntrada
  const anim = animRuntime ? animRuntime.animacao : tocar ? (saindo ? c.exitAnimation : entrada) : undefined
  const chaveAnim = animRuntime ? `rt-${animRuntime.nonce}` : previaAqui ? `pv-${previa?.nonce}` : `in-${chaveEntrada ?? ''}`
  const plano = planoAnimacao({ entrada: saindo ? undefined : anim, saida: saindo ? anim : undefined, loop: tocar && !animRuntime ? c.loopAnimation : undefined, reduzir: reduzirMovimento, ehTexto: c.type === 'text' })
  const geoAtual = origemMorph && !morphFim ? geometria(origemMorph) : geometria(c)
  const e = c.effects

  const base: CSSProperties = {
    position: 'absolute',
    ...geoAtual,
    opacity: (visivel ? (geoAtual.opacity as number) : 0.3) * (heranca?.opacidade ?? 1),
    clipPath: heranca?.clip,
    zIndex: c.z,
    ...varsAnimacao(c),
    cursor: clicavel ? 'pointer' : undefined,
    mixBlendMode: e?.blend && e.blend !== 'normal' ? e.blend : undefined,
    backdropFilter: e?.backdropBlur ? `blur(${e.backdropBlur}px)` : undefined,
    WebkitBackdropFilter: e?.backdropBlur ? `blur(${e.backdropBlur}px)` : undefined,
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
    <div key={chaveAnim} data-layer-id={c.id} className={classes || undefined} style={base} {...eventos}>
      <Conteudo camada={c} props={props} origemMorph={morphFim ? undefined : origemMorph} morphDuracao={morphDuracao} morphEasing={morphEasing} animTexto={plano.texto} />
    </div>
  )
}

function Conteudo({ camada: c, props, origemMorph, morphDuracao, morphEasing, animTexto }: { camada: Camada; props: SceneRendererProps; origemMorph?: Camada; morphDuracao: number; morphEasing: string; animTexto?: Animacao }) {
  const { assets, modo, mobile = false, registrarVideo, interativoNoEditor } = props
  const e = c.effects
  const interativo = modo === 'viewer' || !!interativoNoEditor
  switch (c.type) {
    case 'text':
      return <Texto c={c} origem={origemMorph?.type === 'text' ? origemMorph : undefined} modo={modo} duracao={morphDuracao} easing={morphEasing} animTexto={animTexto} />
    case 'shape':
      return (
        <div style={{ width: '100%', height: '100%', filter: filtroCss(e, c.shape !== 'rect' && c.shape !== 'ellipse') }}>
          <Forma camada={origemMorph?.type === 'shape' ? { ...c, fill: origemMorph.fill } : c} />
        </div>
      )
    case 'frame':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            background: c.gradient ? gradienteCss(c.gradient) : c.fill,
            border: c.stroke && c.strokeWidth ? `${c.strokeWidth}px solid ${c.stroke}` : undefined,
            borderRadius: c.radius,
            boxShadow: sombraCss(e),
            filter: filtroCss(e, false),
          }}
        />
      )
    case 'hotspot':
      return modo === 'editor' ? <div style={{ width: '100%', height: '100%', border: '2px dashed rgba(89,101,242,.9)', background: 'rgba(89,101,242,.08)', borderRadius: 6 }} aria-hidden /> : null
    case 'image': {
      const a = assets[c.assetId]
      const fit = mobile && c.mobile?.fit ? c.mobile.fit : c.fit
      const adj = c.adjust
      const filtroAjuste = adj ? `brightness(${adj.brightness}) contrast(${adj.contrast}) saturate(${adj.saturate}) grayscale(${adj.grayscale})` : ''
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: c.radius, overflow: 'hidden', clipPath: MASCARAS[c.mask], boxShadow: c.mask === 'none' ? sombraCss(e) : undefined, filter: filtroCss(e, c.mask !== 'none', filtroAjuste) }}>
          <Midia src={a ? (modo === 'miniatura' ? a.thumbUrl || a.url : a.url) : undefined} fit={fit} crop={c.crop} />
        </div>
      )
    }
    case 'video': {
      const a = assets[c.assetId]
      const poster = c.posterAssetId ? assets[c.posterAssetId]?.url : a?.posterUrl ?? undefined
      const fit = mobile && c.mobile?.fit ? c.mobile.fit : c.fit
      if (modo !== 'viewer') return <div style={{ width: '100%', height: '100%', borderRadius: c.radius, overflow: 'hidden', background: '#000' }}>{poster ? <Midia src={poster} fit={fit} /> : <video src={a?.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: fit }} />}</div>
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
          style={{ width: '100%', height: '100%', objectFit: fit, borderRadius: c.radius, background: '#000', boxShadow: sombraCss(e), filter: filtroCss(e, false) }}
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
        <div style={{ width: '100%', height: '100%', filter: filtroCss(e, true) }}>
          <Modelo3d camada={c} src={a?.url} poster={poster} interativo={interativo} estatico={modo === 'miniatura'} />
        </div>
      )
    }
    case 'lottie':
      return <Lottie camada={c} src={c.assetId ? assets[c.assetId]?.url : undefined} estatico={modo === 'miniatura'} />
    case 'embed':
      if (modo !== 'viewer' && !interativo) {
        return (
          <div style={{ width: '100%', height: '100%', borderRadius: c.radius, background: '#171717', color: '#A3A3A3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'var(--font-geist-mono), monospace', fontSize: Math.max(14, c.width * 0.025), textAlign: 'center', padding: 24 }}>
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
          style={{ width: '100%', height: '100%', border: 0, borderRadius: c.radius, background: '#000', pointerEvents: interativo ? 'auto' : 'none' }}
        />
      )
  }
}

function Texto({ c, origem, modo, duracao, easing, animTexto }: { c: CamadaTexto; origem?: CamadaTexto; modo: ModoRender; duracao: number; easing: string; animTexto?: Animacao }) {
  const fonte = origem ?? c
  const gradiente = c.gradient ? gradienteCss(c.gradient) : undefined
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: c.valign === 'middle' ? 'center' : c.valign === 'bottom' ? 'flex-end' : 'flex-start',
        background: fonte.background,
        borderRadius: c.radius,
        padding: c.padding,
        overflow: 'hidden',
        transition: origem || modo === 'viewer' ? `color ${duracao}ms ${easing}, font-size ${duracao}ms ${easing}, background ${duracao}ms ${easing}, letter-spacing ${duracao}ms ${easing}` : undefined,
        fontFamily: pilhaFonte(c.fontFamily),
        fontSize: fonte.fontSize,
        fontWeight: c.fontWeight,
        fontStyle: c.italic ? 'italic' : undefined,
        textDecoration: c.underline ? 'underline' : undefined,
        textTransform: c.transform === 'none' ? undefined : c.transform,
        color: fonte.color,
        textAlign: c.align,
        lineHeight: c.lineHeight,
        letterSpacing: fonte.letterSpacing,
        // largura automática (hug) não quebra linha; senão quebra na largura da caixa
        whiteSpace: c.sizingW === 'hug' ? 'pre' : 'pre-wrap',
        wordBreak: 'break-word',
        userSelect: modo === 'editor' ? 'none' : undefined,
        textShadow: c.effects?.shadow ? `${c.effects.shadow.x}px ${c.effects.shadow.y}px ${c.effects.shadow.blur}px ${c.effects.shadow.color}` : undefined,
        filter: c.effects?.blur ? `blur(${c.effects.blur}px)` : undefined,
      }}
    >
      {animTexto ? (
        <TextoSegmentado texto={c.text} animacao={animTexto} estiloParte={gradiente ? { backgroundImage: gradiente, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined} />
      ) : (
        <span style={gradiente ? { backgroundImage: gradiente, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined}>{c.text}</span>
      )}
    </div>
  )
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
