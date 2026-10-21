/**
 * Traços (puros): lista nova `strokes` com compatibilidade com o traço antigo (`stroke/strokeWidth/dash` em
 * formas e frames), derivado na leitura. Editar no painel grava a lista e limpa os campos antigos.
 */
import type { Camada, CamadaForma, Traco } from './schema'

export const TRACO_PADRAO: Traco = { color: '#171717', weight: 1, position: 'inside', style: 'solid', dash: 8, gap: 8, cap: 'none', join: 'miter' }

/** Linhas e setas: o traço é o próprio desenho (sem preenchimento). */
export const ehLinear = (c: Camada): boolean => c.type === 'shape' && (c.shape === 'line' || c.shape === 'arrow')

/** Formas desenhadas por contorno SVG (não retangulares). */
export const ehFormaSvg = (c: Camada): boolean => c.type === 'shape' && c.shape !== 'rect' && c.shape !== 'ellipse'

/**
 * Traços da camada, de cima para baixo: a lista nova ou o traço antigo derivado.
 * Linha/seta sem lista: o traço é a própria linha (cor = stroke ?? fill, espessura = strokeWidth ?? altura).
 */
export function tracosDe(c: Camada): Traco[] {
  if (c.strokes) return c.strokes
  if (c.type === 'shape' && (c.shape === 'line' || c.shape === 'arrow')) {
    const espessura = c.shape === 'arrow' ? Math.max(2, c.strokeWidth || c.height * 0.12) : Math.max(1, c.strokeWidth || c.height)
    return [{ ...TRACO_PADRAO, color: c.stroke ?? c.fill, weight: Math.round(espessura * 100) / 100, position: 'center', cap: 'round', join: 'round', ...(c.dash ? { style: 'dashed' as const, dash: c.dash, gap: c.dash } : {}) }]
  }
  if ((c.type === 'shape' || c.type === 'frame') && c.stroke && c.strokeWidth > 0) {
    // CSS border com box-sizing: border-box = dentro; primitivas SVG antigas eram centradas
    const centro = c.type === 'shape' && c.shape !== 'rect' && c.shape !== 'ellipse'
    const dash = c.type === 'shape' ? c.dash : 0
    return [{ ...TRACO_PADRAO, color: c.stroke, weight: c.strokeWidth, position: centro ? 'center' : 'inside', ...(centro ? { join: 'round' as const, cap: 'round' as const } : {}), ...(dash ? { style: 'dashed' as const, dash, gap: dash } : {}) }]
  }
  return []
}

export const tracosVisiveis = (c: Camada): Traco[] => tracosDe(c).filter((t) => !t.hidden && espessuraMax(t) > 0)
export const temTraco = (c: Camada): boolean => tracosVisiveis(c).length > 0

/** Maior espessura do traço (por lado, se houver). */
export function espessuraMax(t: Traco): number {
  return t.sides ? Math.max(t.sides.top, t.sides.right, t.sides.bottom, t.sides.left) : t.weight
}

/** Grava a lista de traços e limpa o traço antigo (a camada passa a usar só a lista). */
export function comTracos(c: Camada, tracos: Traco[]): Camada {
  const n = { ...c, strokes: tracos } as Camada & { stroke?: string; strokeWidth?: number; dash?: number }
  if (c.type === 'shape') return { ...n, stroke: undefined, strokeWidth: 0, dash: 0 } as Camada
  if (c.type === 'frame') return { ...n, stroke: undefined, strokeWidth: 0 } as Camada
  return n
}

/** Deslocamento do eixo do traço em relação à borda (dentro: −w/2, centro: 0, fora: +w/2). */
export function deslocamentoDoTraco(t: Pick<Traco, 'position'>, w: number): number {
  return t.position === 'inside' ? -w / 2 : t.position === 'outside' ? w / 2 : 0
}

/** stroke-dasharray do estilo (pontilhado usa ponta redonda com traço 0). */
export function tracejadoSvg(t: Traco, w: number): string | undefined {
  if (t.style === 'dashed') return `${Math.max(0.01, t.dash)} ${Math.max(0, t.gap)}`
  if (t.style === 'dotted') return `0 ${Math.max(0.01, t.gap + w)}`
  return undefined
}

/** stroke-linecap do SVG (pontilhado precisa de ponta redonda para virar pontos). */
export function pontaSvg(t: Traco): 'butt' | 'round' | 'square' {
  if (t.style === 'dotted') return 'round'
  return t.cap === 'none' ? 'butt' : t.cap
}

/** Quanto o traço avança para fora da caixa da camada (para não cortar em recortes e na sangria). */
export function alcanceExterno(c: Camada): number {
  return Math.max(0, ...tracosVisiveis(c).map((t) => (t.position === 'outside' ? espessuraMax(t) : t.position === 'center' ? espessuraMax(t) / 2 : 0)))
}
