/**
 * Geometria das formas como caminho SVG (`d`), em coordenadas locais da camada (0..w, 0..h). Pura.
 * Usada pelos traços novos (posição dentro/centro/fora sem mudar a geometria) e pelas máscaras.
 */
import type { CamadaForma } from './schema'
import { caminhoCantos, caminhoElipse, raiosDaCamada } from './cantos'
import { vetorParaD } from '@/lib/editor/vetor/geometria'

const n = (v: number) => String(Math.round(v * 1000) / 1000)

/** Estrela de `pontas` pontas com raio interno `razao` × externo (padrão: 5 pontas, 0,4 — a estrela antiga). */
export function pontosEstrela(w: number, h: number, pontas = 5, razao = 0.4): [number, number][] {
  const pts: [number, number][] = []
  const n = Math.max(3, Math.round(pontas))
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.5 * razao
    const a = (Math.PI / n) * i - Math.PI / 2
    pts.push([w / 2 + Math.cos(a) * w * r, h / 2 + Math.sin(a) * h * r])
  }
  return pts
}

/**
 * Polígono regular de `lados` lados com vértice no topo, esticado até ocupar a caixa inteira (como no Figma:
 * o triângulo encosta nos cantos de baixo, o pentágono nas quatro bordas).
 */
export function pontosPoligono(w: number, h: number, lados = 3): [number, number][] {
  const n = Math.max(3, Math.round(lados))
  const crus: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = ((Math.PI * 2) / n) * i - Math.PI / 2
    crus.push([Math.cos(a), Math.sin(a)])
  }
  const xs = crus.map((p) => p[0])
  const ys = crus.map((p) => p[1])
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const lw = Math.max(...xs) - x0 || 1
  const lh = Math.max(...ys) - y0 || 1
  return crus.map(([x, y]) => [((x - x0) / lw) * w, ((y - y0) / lh) * h])
}

/** Pontos da forma poligonal (triângulo, estrela, polígono) ou null. */
export function pontosDaForma(c: Pick<CamadaForma, 'shape' | 'width' | 'height' | 'count' | 'ratio'>): [number, number][] | null {
  const w = c.width
  const h = c.height
  if (c.shape === 'triangle') return [[w / 2, 0], [w, h], [0, h]]
  if (c.shape === 'star') return pontosEstrela(w, h, c.count ?? 5, c.ratio ?? 0.4)
  if (c.shape === 'polygon') return pontosPoligono(w, h, c.count ?? 3)
  return null
}

const poligono = (pts: [number, number][]) => `M ${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')} Z`

/** Caminho fechado da forma (null para linha e seta, que são só traço). */
export function caminhoDaForma(c: Pick<CamadaForma, 'shape' | 'width' | 'height' | 'radius' | 'radii' | 'cornerSmoothing' | 'vetor' | 'count' | 'ratio'>, deslocamento = 0): string | null {
  const w = c.width
  const h = c.height
  switch (c.shape) {
    case 'rect':
      return caminhoCantos(w, h, raiosDaCamada(c), c.cornerSmoothing ?? 0, deslocamento)
    case 'ellipse':
      return caminhoElipse(w, h, deslocamento)
    case 'triangle':
    case 'star':
    case 'polygon':
      return poligono(pontosDaForma(c)!)
    case 'semicircle':
      return `M 0 ${n(h)} A ${n(w / 2)} ${n(h)} 0 0 1 ${n(w)} ${n(h)} Z`
    case 'path':
      return c.vetor ? vetorParaD(c.vetor, w / c.vetor.w, h / c.vetor.h, undefined, c.radius ?? 0) || null : null
    default:
      return null
  }
}
