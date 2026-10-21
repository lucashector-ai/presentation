/**
 * Efeitos da camada (puros): lista de sombras (projetadas e internas) com compatibilidade com a sombra única
 * antiga (`effects.shadow`), olho dos desfoques e conversão para CSS. Usado pelo renderizador e pelo inspetor.
 */
import type { Efeitos, Sombra } from './schema'

export const EFEITOS_BASE: Efeitos = { blur: 0, backdropBlur: 0, blend: 'normal' }

/** Sombras da camada, de cima para baixo: a lista nova ou a sombra antiga. */
export function sombrasDe(e: Efeitos | undefined): Sombra[] {
  if (!e) return []
  if (e.shadows) return e.shadows
  return e.shadow ? [e.shadow] : []
}

export const sombrasVisiveis = (e: Efeitos | undefined): Sombra[] => sombrasDe(e).filter((s) => !s.hidden)
export const projetadas = (e: Efeitos | undefined): Sombra[] => sombrasVisiveis(e).filter((s) => !s.inner)
export const internas = (e: Efeitos | undefined): Sombra[] => sombrasVisiveis(e).filter((s) => s.inner)

/** Desfoque da camada efetivo (0 quando oculto pelo olho). */
export const desfoqueDe = (e: Efeitos | undefined): number => (e && !e.blurHidden ? e.blur : 0)
/** Desfoque do fundo efetivo. */
export const vidroDe = (e: Efeitos | undefined): number => (e && !e.backdropBlurHidden ? e.backdropBlur : 0)

/** Grava a lista de sombras (migra a sombra única: `shadow` sai). */
export function comSombras(e: Efeitos | undefined, sombras: Sombra[]): Efeitos {
  const { shadow: _antiga, ...resto } = { ...EFEITOS_BASE, ...e }
  return { ...resto, shadows: sombras }
}

const px = (v: number) => `${Math.round(v * 100) / 100}px`

/** box-shadow com projetadas e internas (inset), na ordem do painel. */
export function boxShadowCss(sombras: readonly Sombra[]): string | undefined {
  const v = sombras.filter((s) => !s.hidden)
  if (!v.length) return undefined
  return v.map((s) => `${s.inner ? 'inset ' : ''}${px(s.x)} ${px(s.y)} ${px(s.blur)} ${px(s.spread)} ${s.color}`).join(', ')
}

/** filter: drop-shadow() das projetadas (formas não retangulares, SVG, 3D). A expansão não existe no filtro. */
export function dropShadowCss(sombras: readonly Sombra[]): string {
  return sombras
    .filter((s) => !s.hidden && !s.inner)
    .map((s) => `drop-shadow(${px(s.x)} ${px(s.y)} ${px(s.blur / 2)} ${s.color})`)
    .join(' ')
}

/** text-shadow das projetadas (texto não tem expansão nem sombra interna). */
export function textShadowCss(sombras: readonly Sombra[]): string | undefined {
  const v = sombras.filter((s) => !s.hidden && !s.inner)
  return v.length ? v.map((s) => `${px(s.x)} ${px(s.y)} ${px(s.blur)} ${s.color}`).join(', ') : undefined
}
