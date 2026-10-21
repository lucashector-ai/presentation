/**
 * Cantos arredondados e suavizados (squircle, o "corner smoothing" do Figma), puros e sem DOM.
 * O renderizador usa o caminho em `clip-path: path()` (preenchimento) e em SVG (traços), então editor,
 * visualizador, miniaturas e exportação desenham a mesma curva.
 *
 * Algoritmo: o mesmo do Figma descrito em "Desperately seeking squircles" (figma.com/blog) — cada canto
 * troca o arco de 90° por arco menor + duas curvas de Bézier, ocupando até (1 + suavização) × raio do lado.
 * Quando o lado não comporta, a suavização do canto é reduzida (o raio vem primeiro, como no Figma).
 */
import type { Raios } from './schema'

const rad = (g: number) => (g * Math.PI) / 180
const n = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

interface ParametrosCanto { a: number; b: number; c: number; d: number; p: number; arco: number; raio: number }

function parametrosDoCanto(raio: number, suavizacao: number, orcamento: number): ParametrosCanto {
  if (raio <= 0) return { a: 0, b: 0, c: 0, d: 0, p: 0, arco: 0, raio: 0 }
  let s = suavizacao
  let p = (1 + s) * raio
  const maxS = orcamento / raio - 1
  s = Math.max(0, Math.min(s, maxS))
  p = Math.min(p, orcamento)
  const medidaArco = 90 * (1 - s)
  const arco = Math.sin(rad(medidaArco / 2)) * raio * Math.SQRT2
  const alfa = (90 - medidaArco) / 2
  const p3p4 = raio * Math.tan(rad(alfa / 2))
  const beta = 45 * s
  const c = p3p4 * Math.cos(rad(beta))
  const d = c * Math.tan(rad(beta))
  const b = (p - arco - c - d) / 3
  const a = 2 * b
  return { a, b, c, d, p, arco, raio }
}

type Canto = 'tl' | 'tr' | 'br' | 'bl'
const VIZINHOS: Record<Canto, { canto: Canto; lado: 'h' | 'v' }[]> = {
  tl: [{ canto: 'tr', lado: 'h' }, { canto: 'bl', lado: 'v' }],
  tr: [{ canto: 'tl', lado: 'h' }, { canto: 'br', lado: 'v' }],
  br: [{ canto: 'bl', lado: 'h' }, { canto: 'tr', lado: 'v' }],
  bl: [{ canto: 'br', lado: 'h' }, { canto: 'tl', lado: 'v' }],
}

/**
 * Distribui o comprimento dos lados entre os cantos (o maior raio escolhe primeiro).
 * Devolve o raio efetivo e o orçamento (espaço para raio + suavização) de cada canto.
 */
export function orcamentoDosCantos(w: number, h: number, raios: Raios): Record<Canto, { raio: number; orcamento: number }> {
  const raio: Record<Canto, number> = { tl: Math.max(0, raios[0]), tr: Math.max(0, raios[1]), br: Math.max(0, raios[2]), bl: Math.max(0, raios[3]) }
  const orc: Record<Canto, number> = { tl: -1, tr: -1, br: -1, bl: -1 }
  const ordem = (Object.keys(raio) as Canto[]).sort((x, y) => raio[y] - raio[x])
  for (const k of ordem) {
    const r = raio[k]
    const b = Math.min(
      ...VIZINHOS[k].map(({ canto, lado }) => {
        const rv = raio[canto]
        if (r === 0 && rv === 0) return 0
        const comprimento = lado === 'h' ? w : h
        if (orc[canto] >= 0) return comprimento - orc[canto]
        return (r / (r + rv)) * comprimento
      })
    )
    orc[k] = Math.max(0, b)
    raio[k] = Math.min(r, orc[k])
  }
  return { tl: { raio: raio.tl, orcamento: orc.tl }, tr: { raio: raio.tr, orcamento: orc.tr }, br: { raio: raio.br, orcamento: orc.br }, bl: { raio: raio.bl, orcamento: orc.bl } }
}

/**
 * Caminho SVG (`d`) de um retângulo w × h com cantos [sup. esq., sup. dir., inf. dir., inf. esq.] e suavização
 * 0–1. `deslocamento` > 0 expande para fora (traço externo), < 0 contrai (traço interno): o retângulo cresce
 * `deslocamento` de cada lado e os raios arredondados acompanham (cantos vivos continuam vivos).
 */
export function caminhoCantos(w: number, h: number, raios: Raios, suavizacao = 0, deslocamento = 0): string {
  const o = deslocamento
  const W = Math.max(0, w + 2 * o)
  const H = Math.max(0, h + 2 * o)
  const r = raios.map((x) => (x > 0 ? Math.max(0, x + o) : 0)) as unknown as Raios
  const s = Math.max(0, Math.min(1, suavizacao))
  const orc = orcamentoDosCantos(W, H, r)
  const P = (k: Canto) => parametrosDoCanto(orc[k].raio, s, orc[k].orcamento)
  const tl = P('tl')
  const tr = P('tr')
  const br = P('br')
  const bl = P('bl')
  const x0 = -o
  const y0 = -o
  const partes: string[] = [`M ${n(x0 + W - tr.p)} ${n(y0)}`]
  // superior direito
  if (tr.raio) partes.push(`c ${n(tr.a)} 0 ${n(tr.a + tr.b)} 0 ${n(tr.a + tr.b + tr.c)} ${n(tr.d)}`, `a ${n(tr.raio)} ${n(tr.raio)} 0 0 1 ${n(tr.arco)} ${n(tr.arco)}`, `c ${n(tr.d)} ${n(tr.c)} ${n(tr.d)} ${n(tr.b + tr.c)} ${n(tr.d)} ${n(tr.a + tr.b + tr.c)}`)
  else partes.push(`l ${n(tr.p)} 0`)
  partes.push(`L ${n(x0 + W)} ${n(y0 + H - br.p)}`)
  // inferior direito
  if (br.raio) partes.push(`c 0 ${n(br.a)} 0 ${n(br.a + br.b)} ${n(-br.d)} ${n(br.a + br.b + br.c)}`, `a ${n(br.raio)} ${n(br.raio)} 0 0 1 ${n(-br.arco)} ${n(br.arco)}`, `c ${n(-br.c)} ${n(br.d)} ${n(-(br.b + br.c))} ${n(br.d)} ${n(-(br.a + br.b + br.c))} ${n(br.d)}`)
  else partes.push(`l 0 ${n(br.p)}`)
  partes.push(`L ${n(x0 + bl.p)} ${n(y0 + H)}`)
  // inferior esquerdo
  if (bl.raio) partes.push(`c ${n(-bl.a)} 0 ${n(-(bl.a + bl.b))} 0 ${n(-(bl.a + bl.b + bl.c))} ${n(-bl.d)}`, `a ${n(bl.raio)} ${n(bl.raio)} 0 0 1 ${n(-bl.arco)} ${n(-bl.arco)}`, `c ${n(-bl.d)} ${n(-bl.c)} ${n(-bl.d)} ${n(-(bl.b + bl.c))} ${n(-bl.d)} ${n(-(bl.a + bl.b + bl.c))}`)
  else partes.push(`l ${n(-bl.p)} 0`)
  partes.push(`L ${n(x0)} ${n(y0 + tl.p)}`)
  // superior esquerdo
  if (tl.raio) partes.push(`c 0 ${n(-tl.a)} 0 ${n(-(tl.a + tl.b))} ${n(tl.d)} ${n(-(tl.a + tl.b + tl.c))}`, `a ${n(tl.raio)} ${n(tl.raio)} 0 0 1 ${n(tl.arco)} ${n(-tl.arco)}`, `c ${n(tl.c)} ${n(-tl.d)} ${n(tl.b + tl.c)} ${n(-tl.d)} ${n(tl.a + tl.b + tl.c)} ${n(-tl.d)}`)
  else partes.push(`l 0 ${n(-tl.p)}`)
  partes.push('Z')
  return partes.join(' ')
}

/** Elipse inscrita em w × h (com deslocamento para fora/dentro). */
export function caminhoElipse(w: number, h: number, deslocamento = 0): string {
  const rx = Math.max(0, w / 2 + deslocamento)
  const ry = Math.max(0, h / 2 + deslocamento)
  const cx = w / 2
  const cy = h / 2
  return `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)} Z`
}

/** Raios efetivos de uma camada retangular (cantos independentes ou raio único). */
export function raiosDaCamada(c: { radius?: number; radii?: Raios }): Raios {
  if (c.radii) return [...c.radii] as unknown as Raios
  const r = c.radius ?? 0
  return [r, r, r, r]
}

/** Há suavização visível? (raio > 0 e suavização > 0) */
export function temSuavizacao(c: { radius?: number; radii?: Raios; cornerSmoothing?: number }): boolean {
  return !!c.cornerSmoothing && raiosDaCamada(c).some((r) => r > 0)
}
