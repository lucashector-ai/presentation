'use client'
/**
 * Renderizador de cena — usado pelo editor (canvas e miniaturas), pelo preview e pelo visualizador.
 * Estratégia: contêiner interno no tamanho de referência da cena com `transform: scale(escala)`;
 * assim texto, bordas e sombras ficam idênticos em qualquer tamanho (reprodutibilidade).
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { Animacao, Camada, Cena, Interacao } from '@/lib/scene/schema'
import { EASING_CSS, adaptarAnimacao, camadaVisivel, type EstadoRuntime } from '@/lib/scene/motor'
import { ordenarParaRender } from '@/lib/scene/order'

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
  aoInteragir?: (camada: Camada, inter: Interacao, origem: 'click' | 'hoverEnter' | 'hoverLeave') => void
  registrarVideo?: (id: string, el: HTMLVideoElement | null) => void
  /** Sobreposições do editor (seleção, alças) — já em coordenadas da cena. */
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** Chave que força re-executar animações de entrada (ex.: id da cena). */
  chaveEntrada?: string
}

export function SceneRenderer({ cena, assets, escala, modo, runtime, reduzirMovimento, semHover, mobile, aoInteragir, registrarVideo, children, className, style, chaveEntrada }: SceneRendererProps) {
  const fundo = cena.backgroundAssetId ? assets[cena.backgroundAssetId] : undefined
  const camadas = useMemo(() => ordenarParaRender(cena.layers), [cena.layers])
  return (
    <div className={className} style={{ width: cena.size.width * escala, height: cena.size.height * escala, position: 'relative', overflow: 'hidden', background: cena.background, ...style }}>
      <div style={{ width: cena.size.width, height: cena.size.height, transform: `scale(${escala})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
        {fundo && (
          <img src={modo === 'miniatura' ? fundo.thumbUrl || fundo.url : fundo.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: cena.backgroundFit, pointerEvents: 'none' }} />
        )}
        {camadas.map((c) => (
          <LayerView key={c.id} camada={c} assets={assets} modo={modo} runtime={runtime} reduzirMovimento={!!reduzirMovimento} semHover={!!semHover} mobile={!!mobile} aoInteragir={aoInteragir} registrarVideo={registrarVideo} chaveEntrada={chaveEntrada} />
        ))}
        {children}
      </div>
    </div>
  )
}

interface LayerViewProps {
  camada: Camada
  assets: AssetsResolvidos
  modo: ModoRender
  runtime?: EstadoRuntime
  reduzirMovimento: boolean
  semHover: boolean
  mobile: boolean
  aoInteragir?: SceneRendererProps['aoInteragir']
  registrarVideo?: SceneRendererProps['registrarVideo']
  chaveEntrada?: string
}

function estiloAnimacao(a: Animacao | undefined, reduzir: boolean): CSSProperties | undefined {
  if (!a || a.type === 'none') return undefined
  const ad = adaptarAnimacao(a, reduzir)
  return { animationName: `anim-${ad.type}`, animationDuration: `${ad.duration}ms`, animationDelay: `${ad.delay}ms`, animationTimingFunction: EASING_CSS[ad.easing] }
}

export function LayerView({ camada: c, assets, modo, runtime, reduzirMovimento, semHover, mobile, aoInteragir, registrarVideo, chaveEntrada }: LayerViewProps) {
  const viewer = modo === 'viewer'
  const visivel = runtime ? camadaVisivel(c, runtime) : !c.hidden
  const ocultaNoMobile = viewer && mobile && c.mobile?.hidden
  const inter = viewer ? c.interaction : undefined
  const animRuntime = runtime?.animacoes[c.id]
  const anim = animRuntime ? animRuntime.animacao : viewer ? c.enterAnimation : undefined
  const chaveAnim = animRuntime ? `rt-${animRuntime.nonce}` : `in-${chaveEntrada ?? ''}`

  if (!visivel && viewer) return null
  if (ocultaNoMobile) return null
  if (!visivel && modo === 'miniatura') return null

  const clicavel = !!inter && (inter.trigger === 'click' || (inter.trigger === 'hover' && semHover))
  const hover = !!inter && inter.trigger === 'hover' && !semHover

  const base: CSSProperties = {
    position: 'absolute',
    left: c.x,
    top: c.y,
    width: c.width,
    height: c.height,
    transform: c.rotation ? `rotate(${c.rotation}deg)` : undefined,
    opacity: visivel ? c.opacity : 0.25,
    zIndex: c.z,
    ['--op' as string]: c.opacity,
    ['--rot' as string]: `${c.rotation}deg`,
    cursor: clicavel ? 'pointer' : undefined,
    ...estiloAnimacao(anim, reduzirMovimento),
  }
  const classes = [anim && anim.type !== 'none' ? 'camada-animada' : '', c.type === 'hotspot' && viewer && c.hint ? 'hotspot-dica' : ''].filter(Boolean).join(' ')

  const props = clicavel || hover
    ? {
        role: clicavel ? 'button' : undefined,
        tabIndex: clicavel ? 0 : undefined,
        'aria-label': c.ariaLabel || (c.type === 'text' ? c.text : undefined),
        onClick: clicavel ? (e: React.MouseEvent) => { e.stopPropagation(); if (inter) aoInteragir?.(c, inter, 'click') } : undefined,
        onKeyDown: clicavel ? (e: React.KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && inter) { e.preventDefault(); e.stopPropagation(); aoInteragir?.(c, inter, 'click') } } : undefined,
        onPointerEnter: hover ? () => inter && aoInteragir?.(c, inter, 'hoverEnter') : undefined,
        onPointerLeave: hover ? () => inter && aoInteragir?.(c, inter, 'hoverLeave') : undefined,
        onFocus: hover ? () => inter && aoInteragir?.(c, inter, 'hoverEnter') : undefined,
        onBlur: hover ? () => inter && aoInteragir?.(c, inter, 'hoverLeave') : undefined,
      }
    : {}

  return (
    <div key={chaveAnim} data-layer-id={c.id} className={classes || undefined} style={base} {...props}>
      <Conteudo camada={c} assets={assets} modo={modo} mobile={mobile} registrarVideo={registrarVideo} />
    </div>
  )
}

function Conteudo({ camada: c, assets, modo, mobile, registrarVideo }: { camada: Camada; assets: AssetsResolvidos; modo: ModoRender; mobile: boolean; registrarVideo?: SceneRendererProps['registrarVideo'] }) {
  switch (c.type) {
    case 'text':
      return (
        <div style={{ width: '100%', height: '100%', fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, color: c.color, textAlign: c.align, lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden', userSelect: modo === 'editor' ? 'none' : undefined }}>
          {c.text}
        </div>
      )
    case 'shape':
      return <div style={{ width: '100%', height: '100%', background: c.fill, borderRadius: c.shape === 'ellipse' ? '50%' : c.radius, border: c.stroke && c.strokeWidth ? `${c.strokeWidth}px solid ${c.stroke}` : undefined, boxShadow: c.shadow ? '0 20px 50px -20px rgba(0,0,0,.45)' : undefined }} />
    case 'hotspot':
      return modo === 'editor' ? <div style={{ width: '100%', height: '100%', border: '2px dashed rgba(217,249,157,.95)', background: 'rgba(217,249,157,.12)', borderRadius: 8 }} aria-hidden /> : null
    case 'image': {
      const a = assets[c.assetId]
      const fit = mobile && c.mobile?.fit ? c.mobile.fit : c.fit
      return <Midia key={c.assetId} tipo="image" src={a ? (modo === 'miniatura' ? a.thumbUrl || a.url : a.url) : undefined} fit={fit} radius={c.radius} shadow={c.shadow} />
    }
    case 'video': {
      const a = assets[c.assetId]
      const poster = c.posterAssetId ? assets[c.posterAssetId]?.url : a?.posterUrl ?? undefined
      const fit = mobile && c.mobile?.fit ? c.mobile.fit : c.fit
      if (modo !== 'viewer') return <Midia tipo="image" src={poster ?? undefined} fit={fit} radius={c.radius} shadow={false} rotuloVazio="Vídeo" />
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
          style={{ width: '100%', height: '100%', objectFit: fit, borderRadius: c.radius, background: '#000' }}
        />
      )
    }
  }
}

function Midia({ tipo, src, fit, radius, shadow, rotuloVazio }: { tipo: 'image'; src?: string; fit: 'contain' | 'cover'; radius: number; shadow: boolean; rotuloVazio?: string }) {
  const [erro, setErro] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => setErro(false), [src, tentativa])
  if (!src || erro) {
    return (
      <div style={{ width: '100%', height: '100%', borderRadius: radius, background: 'rgba(127,147,166,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#5B6670', fontFamily: 'system-ui', fontSize: 28 }}>
        <span>{!src ? rotuloVazio ?? 'Mídia indisponível' : 'Não foi possível carregar este arquivo.'}</span>
        {src && (
          <button onClick={(e) => { e.stopPropagation(); setTentativa((t) => t + 1) }} style={{ fontSize: 24, padding: '8px 20px', borderRadius: 999, border: '2px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
            Tentar novamente
          </button>
        )}
      </div>
    )
  }
  void tipo
  return <img src={tentativa ? `${src}${src.includes('?') ? '&' : '?'}r=${tentativa}` : src} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: fit, borderRadius: radius, boxShadow: shadow ? '0 24px 60px -24px rgba(0,0,0,.5)' : undefined, display: 'block', pointerEvents: 'none' }} />
}
