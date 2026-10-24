/** Conversões puras do modelo de camada para CSS (compartilhadas por renderer e miniaturas). */
import type { CSSProperties } from 'react'
import type { Camada, Efeitos, Gradiente } from '@/lib/scene/schema'
import { boxShadowCss, desfoqueDe, dropShadowCss, projetadas, sombrasVisiveis } from '@/lib/scene/efeitos'

export function gradienteCss(g: Gradiente): string {
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ')
  return g.type === 'radial' ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})`
}

/** box-shadow com todas as sombras visíveis (projetadas e internas), na ordem do painel. */
export function sombraCss(e: Efeitos | undefined): string | undefined {
  return boxShadowCss(sombrasVisiveis(e))
}

/** Filtro de desfoque + sombras projetadas como drop-shadow (para formas não retangulares, SVG, 3D). */
export function filtroCss(e: Efeitos | undefined, comDropShadow: boolean, extra = ''): string | undefined {
  const partes: string[] = []
  const blur = desfoqueDe(e)
  if (blur) partes.push(`blur(${blur}px)`)
  if (comDropShadow) { const d = dropShadowCss(projetadas(e)); if (d) partes.push(d) }
  if (extra) partes.push(extra)
  return partes.length ? partes.join(' ') : undefined
}

/** border-radius: cantos independentes (`radii`) ou o raio único. */
export function raioCss(c: { radius?: number; radii?: readonly [number, number, number, number] }): number | string | undefined {
  if (c.radii) return c.radii.map((r) => `${r}px`).join(' ')
  return c.radius
}

export function transformCss(c: Pick<Camada, 'rotation' | 'flipX' | 'flipY'> & Partial<Pick<Camada, 'rotateX' | 'rotateY' | 'perspective'>>): string | undefined {
  const p: string[] = []
  // inclinação 3D antes da rotação plana (perspectiva própria da camada, como um cartão virado)
  if (c.rotateX || c.rotateY) p.push(`perspective(${c.perspective ?? 1200}px)`, `rotateX(${c.rotateX ?? 0}deg)`, `rotateY(${c.rotateY ?? 0}deg)`)
  if (c.rotation) p.push(`rotate(${c.rotation}deg)`)
  if (c.flipX) p.push('scaleX(-1)')
  if (c.flipY) p.push('scaleY(-1)')
  return p.length ? p.join(' ') : undefined
}

/** Opacidade padrão de cada textura (a dos documentos antigos, sem `patternOpacity`). */
export const OPACIDADE_PADRAO_TEXTURA: Record<string, number> = { stripes: 0.1, dots: 0.9, grid: 0.18 }

/**
 * Textura (listras, pontos, grade) com escala do passo, espessura e opacidade. Com os três ausentes sai exatamente
 * o padrão antigo (listras brancas a 10% a cada 28 px, pontos pretos a 90% em 36 px, grade preta a 18% em 60 px).
 */
export function padraoCss(c: { pattern?: string; patternScale?: number; patternWeight?: number; patternOpacity?: number }): CSSProperties {
  const p = c.pattern ?? 'none'
  if (p === 'none') return {}
  const esc = c.patternScale ?? 1
  const peso = c.patternWeight ?? 1
  const op = c.patternOpacity ?? OPACIDADE_PADRAO_TEXTURA[p] ?? 1
  const r = (v: number) => Math.round(v * 100) / 100
  if (p === 'stripes') {
    const passo = r(28 * esc)
    const traco = r(Math.min(passo * 0.9, 2 * peso))
    return { backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,${r(op)}) 0 ${traco}px, transparent ${traco}px ${passo}px)` }
  }
  if (p === 'dots') {
    const cel = r(36 * esc)
    const raio = Math.min(48, r(22 * peso))
    return { backgroundImage: `radial-gradient(rgba(0,0,0,${r(op)}) ${raio}%, transparent ${r(raio + 2)}%)`, backgroundSize: `${cel}px ${cel}px` }
  }
  const cel = r(60 * esc)
  const linha = r(Math.min(cel * 0.5, 2 * peso))
  return { backgroundImage: `linear-gradient(rgba(0,0,0,${r(op)}) ${linha}px, transparent ${linha}px), linear-gradient(90deg, rgba(0,0,0,${r(op)}) ${linha}px, transparent ${linha}px)`, backgroundSize: `${cel}px ${cel}px` }
}

export const MASCARAS: Record<string, string | undefined> = {
  none: undefined,
  ellipse: 'ellipse(50% 50% at 50% 50%)',
  arch: 'inset(0 0 0 0 round 50% 50% 0 0 / 30% 30% 0 0)',
  triangle: 'polygon(50% 0, 100% 100%, 0 100%)',
}

/** CSS de fundo para o preenchimento com imagem (cobrir, conter ou esticar), centralizado. */
export function fundoImagemCss(url: string, fit: 'cover' | 'contain' | 'fill' = 'cover'): string {
  return `center / ${fit === 'fill' ? '100% 100%' : fit} no-repeat url("${url}")`
}
