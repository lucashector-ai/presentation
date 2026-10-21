/**
 * Formas primitivas → caminho editável (na primeira edição do vetor). Mantém a geometria que o renderizador
 * desenha (`components/renderer/camadas/Forma.tsx`), inclusive os recuos do traço em triângulo/estrela.
 */
import type { CamadaForma, CaminhoVetor, NoVetor, Vetor } from '@/lib/scene/schema'
import { raiosDe } from '@/lib/editor/raios'

/** Constante da aproximação de um quarto de círculo por uma cúbica. */
export const KAPPA = 0.5522847498307936

const no = (x: number, y: number, extra: Partial<NoVetor> = {}): NoVetor => ({ x, y, tipo: 'canto', ...extra })
const poligono = (pts: [number, number][]): CaminhoVetor => ({ nos: pts.map(([x, y]) => no(x, y)), fechado: true })

export function elipseVetor(w: number, h: number, x0 = 0, y0 = 0): CaminhoVetor {
  const rx = w / 2, ry = h / 2, cx = x0 + rx, cy = y0 + ry
  const kx = rx * KAPPA, ky = ry * KAPPA
  return {
    fechado: true,
    nos: [
      no(cx, y0, { entrada: { x: cx - kx, y: y0 }, saida: { x: cx + kx, y: y0 }, tipo: 'suave' }),
      no(x0 + w, cy, { entrada: { x: x0 + w, y: cy - ky }, saida: { x: x0 + w, y: cy + ky }, tipo: 'suave' }),
      no(cx, y0 + h, { entrada: { x: cx + kx, y: y0 + h }, saida: { x: cx - kx, y: y0 + h }, tipo: 'suave' }),
      no(x0, cy, { entrada: { x: x0, y: cy + ky }, saida: { x: x0, y: cy - ky }, tipo: 'suave' }),
    ],
  }
}

/** Retângulo com cantos independentes [se, sd, id, ie]: cada canto arredondado vira dois nós com alças. */
export function retanguloVetor(w: number, h: number, raios: readonly [number, number, number, number] = [0, 0, 0, 0]): CaminhoVetor {
  // como no CSS: raios grandes demais são reduzidos proporcionalmente
  const f = Math.min(1, ...[[0, 1, w], [3, 2, w], [0, 3, h], [1, 2, h]].map(([a, b, lado]) => { const s = raios[a!]! + raios[b!]!; return s > 0 ? lado! / s : 1 }))
  const [a, b, c, d] = raios.map((r) => Math.max(0, r * f)) as [number, number, number, number]
  const nos: NoVetor[] = []
  const canto = (r: number, px: number, py: number, ent: [number, number], sai: [number, number]) => {
    // (px, py) = vértice; ent/sai = direções unitárias de chegada e saída do canto
    if (r <= 0) { nos.push(no(px, py)); return }
    const p1 = { x: px - ent[0] * r, y: py - ent[1] * r }
    const p2 = { x: px + sai[0] * r, y: py + sai[1] * r }
    const k = r * (1 - KAPPA)
    nos.push(no(p1.x, p1.y, { saida: { x: p1.x + ent[0] * (r - k), y: p1.y + ent[1] * (r - k) } }))
    nos.push(no(p2.x, p2.y, { entrada: { x: p2.x - sai[0] * (r - k), y: p2.y - sai[1] * (r - k) } }))
  }
  canto(a, 0, 0, [0, -1], [1, 0])
  canto(b, w, 0, [1, 0], [0, 1])
  canto(c, w, h, [0, 1], [-1, 0])
  canto(d, 0, h, [-1, 0], [0, -1])
  return { nos, fechado: true }
}

function estrela(w: number, h: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.2
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push([w / 2 + Math.cos(a) * w * r, h / 2 + Math.sin(a) * h * r])
  }
  return pts
}

/**
 * Caminho equivalente à forma e o que muda no estilo para continuar igual
 * (linha e seta são traços: o preenchimento vira traço).
 */
export function vetorDaForma(c: CamadaForma): { vetor: Vetor; patch: Partial<CamadaForma> } {
  const w = c.width
  const h = c.height
  const sw = c.strokeWidth
  const base = (caminhos: CaminhoVetor[]): Vetor => ({ w, h, caminhos, fillRule: 'nonzero' })
  switch (c.shape) {
    case 'path':
      if (c.vetor) return { vetor: c.vetor, patch: {} }
      return { vetor: base([retanguloVetor(w, h)]), patch: {} }
    case 'ellipse':
      return { vetor: base([elipseVetor(w, h)]), patch: {} }
    case 'triangle':
      return { vetor: base([poligono([[w / 2, sw], [w - sw, h - sw], [sw, h - sw]])]), patch: {} }
    case 'star':
      return { vetor: base([poligono(estrela(w, h))]), patch: {} }
    case 'semicircle': {
      const rx = w / 2 - sw, ry = h - sw * 2, cx = w / 2, cy = h - sw
      const kx = rx * KAPPA, ky = ry * KAPPA
      return {
        vetor: base([{
          fechado: true,
          nos: [
            no(cx - rx, cy, { saida: { x: cx - rx, y: cy - ky } }),
            no(cx, cy - ry, { entrada: { x: cx - kx, y: cy - ry }, saida: { x: cx + kx, y: cy - ry }, tipo: 'suave' }),
            no(cx + rx, cy, { entrada: { x: cx + rx, y: cy - ky } }),
          ],
        }]),
        patch: {},
      }
    }
    case 'line': {
      const t = Math.max(1, sw || h)
      return { vetor: base([{ nos: [no(0, h / 2), no(w, h / 2)], fechado: false, semPreenchimento: true }]), patch: { stroke: c.stroke ?? c.fill, strokeWidth: Math.min(100, t) } }
    }
    case 'arrow': {
      const t = Math.max(2, sw || h * 0.12)
      return {
        vetor: base([
          { nos: [no(t, h / 2), no(w - t, h / 2)], fechado: false, semPreenchimento: true },
          { nos: [no(w - h * 0.4, h * 0.1 + t), no(w - t, h / 2), no(w - h * 0.4, h * 0.9 - t)], fechado: false, semPreenchimento: true },
        ]),
        patch: { stroke: c.stroke ?? c.fill, strokeWidth: Math.min(100, t) },
      }
    }
    default:
      return { vetor: base([retanguloVetor(w, h, raiosDe(c))]), patch: {} }
  }
}
