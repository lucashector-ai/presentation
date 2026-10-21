/**
 * Matemática de cor do seletor (puro, sem DOM): hex ↔ RGB ↔ HSL ↔ HSV, alfa, leitura de texto colado
 * e coleta das cores usadas no documento ("Nesta página").
 *
 * Convenções: r, g, b em 0–255; h em 0–360; s, l, v em 0–100; a (alfa) em 0–1.
 * O documento grava cores como #RRGGBB ou #RRGGBBAA (CorSchema), sempre em maiúsculas aqui.
 */

export interface Rgba { r: number; g: number; b: number; a: number }
export interface Hsv { h: number; s: number; v: number }
export interface Hsl { h: number; s: number; l: number }

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const arred = (v: number, casas = 0) => Math.round(v * 10 ** casas) / 10 ** casas
const hex2 = (n: number) => Math.round(limitar(n, 0, 255)).toString(16).padStart(2, '0').toUpperCase()

/** Lê #RGB, #RGBA, #RRGGBB ou #RRGGBBAA (com ou sem #). */
export function hexParaRgba(hex: string): Rgba | null {
  const t = hex.trim().replace(/^#/, '')
  if (!/^(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return null
  const cheio = t.length <= 4 ? t.split('').map((c) => c + c).join('') : t
  const n = (i: number) => parseInt(cheio.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: cheio.length === 8 ? arred(n(6) / 255, 3) : 1 }
}

/** #RRGGBB quando opaco; #RRGGBBAA quando há transparência (ou `sempreAlfa`). */
export function rgbaParaHex({ r, g, b, a }: Rgba, sempreAlfa = false): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  const aa = limitar(a, 0, 1)
  return aa >= 1 && !sempreAlfa ? base : `${base}${hex2(aa * 255)}`
}

/** Só a parte RGB, sem #: "D9D9D9" (como o campo do Figma). */
export function hex6(cor: string): string {
  const c = hexParaRgba(cor)
  return c ? rgbaParaHex({ ...c, a: 1 }).slice(1) : '000000'
}

export function alfaDe(cor: string): number {
  return hexParaRgba(cor)?.a ?? 1
}

/** Troca o alfa de uma cor hex mantendo o RGB. */
export function comAlfa(cor: string, a: number): string {
  const c = hexParaRgba(cor) ?? { r: 0, g: 0, b: 0, a: 1 }
  return rgbaParaHex({ ...c, a: limitar(a, 0, 1) })
}

export function normalizarHex(cor: string): string | null {
  const c = hexParaRgba(cor)
  return c ? rgbaParaHex(c) : null
}

/** Mesma cor visível (ignora caixa e formato curto/longo). */
export function mesmaCor(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return normalizarHex(a) === normalizarHex(b)
}

// ---------- HSV (área saturação × brilho) ----------

export function rgbParaHsv({ r, g, b }: Pick<Rgba, 'r' | 'g' | 'b'>): Hsv {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
  let h = 0
  if (d) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? (d / max) * 100 : 0, v: max * 100 }
}

export function hsvParaRgb({ h, s, v }: Hsv): Pick<Rgba, 'r' | 'g' | 'b'> {
  const S = limitar(s, 0, 100) / 100, V = limitar(v, 0, 100) / 100
  const H = (((h % 360) + 360) % 360) / 60
  const c = V * S
  const x = c * (1 - Math.abs((H % 2) - 1))
  const m = V - c
  const [r1, g1, b1] = H < 1 ? [c, x, 0] : H < 2 ? [x, c, 0] : H < 3 ? [0, c, x] : H < 4 ? [0, x, c] : H < 5 ? [x, 0, c] : [c, 0, x]
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) }
}

// ---------- HSL ----------

export function rgbParaHsl({ r, g, b }: Pick<Rgba, 'r' | 'g' | 'b'>): Hsl {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h: rgbParaHsv({ r, g, b }).h, s: s * 100, l: l * 100 }
}

export function hslParaRgb({ h, s, l }: Hsl): Pick<Rgba, 'r' | 'g' | 'b'> {
  const L = limitar(l, 0, 100) / 100
  const S = limitar(s, 0, 100) / 100
  const v = L + S * Math.min(L, 1 - L)
  const sv = v === 0 ? 0 : 2 * (1 - L / v)
  return hsvParaRgb({ h, s: sv * 100, v: v * 100 })
}

export function hsvParaHsl({ h, s, v }: Hsv): Hsl {
  const S = s / 100, V = v / 100
  const l = V * (1 - S / 2)
  const sl = l === 0 || l === 1 ? 0 : (V - l) / Math.min(l, 1 - l)
  return { h, s: sl * 100, l: l * 100 }
}

export function hslParaHsv({ h, s, l }: Hsl): Hsv {
  const L = l / 100, S = s / 100
  const v = L + S * Math.min(L, 1 - L)
  return { h, s: v === 0 ? 0 : 2 * (1 - L / v) * 100, v: v * 100 }
}

// ---------- texto colado ----------

/**
 * Interpreta o que a pessoa digita/cola num campo de cor: "#5965F2", "5965f2", "fff", "rgb(89 101 242)",
 * "rgba(89,101,242,.5)", "hsl(235 86% 65%)". Retorna null se não entender.
 */
export function lerCor(texto: string): Rgba | null {
  const t = texto.trim().toLowerCase()
  const hex = hexParaRgba(t)
  if (hex) return hex
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(t)
  if (!fn) return null
  const partes = fn[2]!.split(/[\s,/]+/).filter(Boolean)
  if (partes.length < 3 || partes.length > 4) return null
  const num = (p: string, escala: number) => (p.endsWith('%') ? (parseFloat(p) / 100) * escala : parseFloat(p))
  const alfa = partes[3] === undefined ? 1 : limitar(num(partes[3], 1), 0, 1)
  if (fn[1]!.startsWith('rgb')) {
    const [r, g, b] = partes.slice(0, 3).map((p) => limitar(num(p, 255), 0, 255))
    if ([r, g, b].some((x) => x === undefined || Number.isNaN(x))) return null
    return { r: Math.round(r!), g: Math.round(g!), b: Math.round(b!), a: arred(alfa, 3) }
  }
  const h = parseFloat(partes[0]!), s = parseFloat(partes[1]!), l = parseFloat(partes[2]!)
  if ([h, s, l].some(Number.isNaN)) return null
  return { ...hslParaRgb({ h, s, l }), a: arred(alfa, 3) }
}

// ---------- gradiente ----------

export interface Parada { color: string; pos: number }

/** Cor (interpolada em RGB + alfa) num ponto 0–100 de um gradiente — usada ao clicar na barra para criar uma parada. */
export function corNoGradiente(paradas: Parada[], pos: number): string {
  const ord = [...paradas].sort((a, b) => a.pos - b.pos)
  if (!ord.length) return '#000000'
  if (pos <= ord[0]!.pos) return normalizarHex(ord[0]!.color) ?? '#000000'
  const ultima = ord[ord.length - 1]!
  if (pos >= ultima.pos) return normalizarHex(ultima.color) ?? '#000000'
  const i = ord.findIndex((p) => p.pos >= pos)
  const a = ord[i - 1]!, b = ord[i]!
  const t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos)
  const ca = hexParaRgba(a.color) ?? { r: 0, g: 0, b: 0, a: 1 }
  const cb = hexParaRgba(b.color) ?? { r: 0, g: 0, b: 0, a: 1 }
  const mix = (x: number, y: number) => x + (y - x) * t
  return rgbaParaHex({ r: mix(ca.r, cb.r), g: mix(ca.g, cb.g), b: mix(ca.b, cb.b), a: arred(mix(ca.a, cb.a), 3) })
}

/** CSS de prévia horizontal de um gradiente (barra de paradas, miniatura do preenchimento). */
export function cssBarraGradiente(paradas: Parada[]): string {
  const ord = [...paradas].sort((a, b) => a.pos - b.pos)
  return `linear-gradient(90deg, ${ord.map((p) => `${p.color} ${p.pos}%`).join(', ')})`
}

// ---------- cores do documento ----------

type ComCores = { background?: string; backgroundGradient?: { stops: Parada[] }; layers: Array<Record<string, unknown>> }

/** Cores usadas nas telas (preenchimentos, textos, traços, sombras, gradientes, trocas de cor do SVG), sem repetir, na ordem em que aparecem. */
export function coresUsadas(cenas: ComCores[], limite = 24): string[] {
  const vistas = new Set<string>()
  const lista: string[] = []
  const add = (v: unknown) => {
    if (typeof v !== 'string') return
    const c = hexParaRgba(v)
    if (!c || c.a === 0) return
    const chave = rgbaParaHex(c)
    if (vistas.has(chave)) return
    vistas.add(chave)
    lista.push(chave)
  }
  const grad = (g: unknown) => {
    const stops = (g as { stops?: Parada[] } | undefined)?.stops
    if (Array.isArray(stops)) stops.forEach((s) => add(s.color))
  }
  for (const c of cenas) {
    add(c.background)
    grad(c.backgroundGradient)
    for (const l of c.layers) {
      add(l.fill); add(l.color); add(l.stroke); add(l.background)
      grad(l.gradient)
      const ef = l.effects as { shadow?: { color?: string }; shadows?: { color?: string; realistic?: boolean }[] } | undefined
      add(ef?.shadow?.color)
      ef?.shadows?.forEach((s) => { if (!s.realistic) add(s.color) })
      ;(l.strokes as { color?: string; gradient?: unknown }[] | undefined)?.forEach((t) => { add(t.color); grad(t.gradient) })
      const recolor = l.recolor as Record<string, string> | undefined
      if (recolor) Object.values(recolor).forEach(add)
    }
  }
  return lista.slice(0, limite)
}

/** Texto legível sobre a cor (para marcas sobre amostras). */
export function claro(cor: string): boolean {
  const c = hexParaRgba(cor)
  if (!c) return true
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 150 || c.a < 0.4
}
