/** Conversões puras do modelo de camada para CSS (compartilhadas por renderer e miniaturas). */
import type { CSSProperties } from 'react'
import type { Camada, Efeitos, Gradiente } from '@/lib/scene/schema'

export function gradienteCss(g: Gradiente): string {
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ')
  return g.type === 'radial' ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})`
}

export function sombraCss(e: Efeitos | undefined): string | undefined {
  const s = e?.shadow
  return s ? `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}` : undefined
}

/** Filtro de desfoque + sombra como drop-shadow (para formas não retangulares, SVG, 3D). */
export function filtroCss(e: Efeitos | undefined, comDropShadow: boolean, extra = ''): string | undefined {
  const partes: string[] = []
  if (e?.blur) partes.push(`blur(${e.blur}px)`)
  if (comDropShadow && e?.shadow) partes.push(`drop-shadow(${e.shadow.x}px ${e.shadow.y}px ${e.shadow.blur / 2}px ${e.shadow.color})`)
  if (extra) partes.push(extra)
  return partes.length ? partes.join(' ') : undefined
}

export function transformCss(c: Pick<Camada, 'rotation' | 'flipX' | 'flipY'>): string | undefined {
  const p: string[] = []
  if (c.rotation) p.push(`rotate(${c.rotation}deg)`)
  if (c.flipX) p.push('scaleX(-1)')
  if (c.flipY) p.push('scaleY(-1)')
  return p.length ? p.join(' ') : undefined
}

export const PADROES: Record<string, CSSProperties> = {
  stripes: { backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.10) 0 2px, transparent 2px 28px)' },
  dots: { backgroundImage: 'radial-gradient(rgba(0,0,0,.9) 22%, transparent 24%)', backgroundSize: '36px 36px' },
  grid: { backgroundImage: 'linear-gradient(rgba(0,0,0,.18) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,.18) 2px, transparent 2px)', backgroundSize: '60px 60px' },
}

export const MASCARAS: Record<string, string | undefined> = {
  none: undefined,
  ellipse: 'ellipse(50% 50% at 50% 50%)',
  arch: 'inset(0 0 0 0 round 50% 50% 0 0 / 30% 30% 0 0)',
  triangle: 'polygon(50% 0, 100% 100%, 0 100%)',
}
