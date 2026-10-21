/**
 * Geometria de caminhos vetoriais (Bézier cúbicas) — pura e testável.
 * Um segmento vai do nó i ao nó i+1 (ou do último ao primeiro, se o caminho for fechado):
 * P0 = nó i, P1 = saída do nó i (ou o próprio nó), P2 = entrada do nó i+1 (ou o próprio nó), P3 = nó i+1.
 */
import type { CaminhoVetor, NoVetor, Vetor } from '@/lib/scene/schema'

export interface P { x: number; y: number }
export interface Segmento {
  /** índice do caminho */
  c: number
  /** índice do nó inicial (o final é `j`) */
  i: number
  j: number
  p0: P
  p1: P
  p2: P
  p3: P
  /** sem alças: reta */
  reta: boolean
}
export interface Caixa { x: number; y: number; width: number; height: number }

const pt = (p: P): P => ({ x: p.x, y: p.y })
export const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

export function segmento(cam: CaminhoVetor, c: number, i: number): Segmento | null {
  const n = cam.nos.length
  const j = i + 1 < n ? i + 1 : cam.fechado && n > 1 ? 0 : -1
  if (j < 0 || i < 0 || i >= n) return null
  const a = cam.nos[i]!
  const b = cam.nos[j]!
  return { c, i, j, p0: pt(a), p1: pt(a.saida ?? a), p2: pt(b.entrada ?? b), p3: pt(b), reta: !a.saida && !b.entrada }
}

/** Todos os segmentos de um caminho. */
export function segmentosDe(cam: CaminhoVetor, c: number): Segmento[] {
  const r: Segmento[] = []
  const total = cam.fechado ? cam.nos.length : cam.nos.length - 1
  for (let i = 0; i < total; i++) {
    const s = segmento(cam, c, i)
    if (s) r.push(s)
  }
  return r
}

export function segmentos(v: Vetor): Segmento[] {
  return v.caminhos.flatMap((cam, c) => segmentosDe(cam, c))
}

/** Ponto da cúbica em t. */
export function pontoEm(s: Pick<Segmento, 'p0' | 'p1' | 'p2' | 'p3'> & { reta?: boolean }, t: number): P {
  // retas: parâmetro linear (t = fração do comprimento), igual ao usado para inserir nós
  if (s.reta) return lerp(s.p0, s.p3, t)
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x, y: a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y }
}

/** De Casteljau: divide a cúbica em t em duas cúbicas. */
export function dividirCubica(s: Pick<Segmento, 'p0' | 'p1' | 'p2' | 'p3'>, t: number): [[P, P, P, P], [P, P, P, P]] {
  const a = lerp(s.p0, s.p1, t)
  const b = lerp(s.p1, s.p2, t)
  const c = lerp(s.p2, s.p3, t)
  const d = lerp(a, b, t)
  const e = lerp(b, c, t)
  const f = lerp(d, e, t)
  return [[pt(s.p0), a, d, f], [f, e, c, pt(s.p3)]]
}

/** Raízes de a t² + b t + c em (0, 1). */
function raizes01(a: number, b: number, c: number): number[] {
  const r: number[] = []
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) r.push(-c / b)
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const q = Math.sqrt(disc)
      r.push((-b + q) / (2 * a), (-b - q) / (2 * a))
    }
  }
  return r.filter((t) => t > 1e-9 && t < 1 - 1e-9)
}

/** Caixa exata de uma cúbica (extremos pela derivada). */
export function caixaSegmento(s: Pick<Segmento, 'p0' | 'p1' | 'p2' | 'p3'>): Caixa {
  const ts = [0, 1]
  for (const k of ['x', 'y'] as const) {
    const p0 = s.p0[k], p1 = s.p1[k], p2 = s.p2[k], p3 = s.p3[k]
    // B'(t)/3 = a t² + b t + c
    const a = -p0 + 3 * p1 - 3 * p2 + p3
    const b = 2 * (p0 - 2 * p1 + p2)
    const c = p1 - p0
    ts.push(...raizes01(a, b, c))
  }
  const pts = ts.map((t) => pontoEm(s, t))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/** Caixa do vetor inteiro (geometria, sem a espessura do traço). */
export function caixaVetor(v: Vetor): Caixa {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const somar = (c: Caixa) => { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.width); y1 = Math.max(y1, c.y + c.height) }
  for (const cam of v.caminhos) for (const n of cam.nos) somar({ x: n.x, y: n.y, width: 0, height: 0 })
  for (const s of segmentos(v)) somar(caixaSegmento(s))
  if (!Number.isFinite(x0)) return { x: 0, y: 0, width: 0, height: 0 }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/** Ponto mais próximo de `p` no segmento: amostragem + refinamento por bisseção local. */
export function maisProximoNoSegmento(s: Segmento, p: P): { t: number; ponto: P; d: number } {
  const N = 32
  let melhorT = 0
  let melhorD = Infinity
  for (let k = 0; k <= N; k++) {
    const t = k / N
    const d = dist(pontoEm(s, t), p)
    if (d < melhorD) { melhorD = d; melhorT = t }
  }
  let passo = 1 / N
  for (let it = 0; it < 20; it++) {
    passo /= 2
    for (const t of [melhorT - passo, melhorT + passo]) {
      if (t < 0 || t > 1) continue
      const d = dist(pontoEm(s, t), p)
      if (d < melhorD) { melhorD = d; melhorT = t }
    }
  }
  const ponto = pontoEm(s, melhorT)
  return { t: melhorT, ponto, d: melhorD }
}

/** Polilinha que aproxima o caminho (para preenchimento, laço e área). */
export function achatar(cam: CaminhoVetor, passos = 16): P[] {
  const r: P[] = cam.nos[0] ? [pt(cam.nos[0])] : []
  for (const s of segmentosDe(cam, 0)) {
    if (s.reta) { r.push(pt(s.p3)); continue }
    for (let k = 1; k <= passos; k++) r.push(pontoEm(s, k / passos))
  }
  return r
}

/** Ponto dentro do polígono (regra nonzero ou evenodd). */
export function dentroDoPoligono(pol: readonly P[], p: P, regra: 'nonzero' | 'evenodd' = 'evenodd'): boolean {
  let voltas = 0
  let cruzamentos = 0
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const a = pol[j]!
    const b = pol[i]!
    if ((a.y > p.y) !== (b.y > p.y)) {
      const x = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)
      if (p.x < x) { cruzamentos++; voltas += b.y > a.y ? 1 : -1 }
    }
  }
  return regra === 'evenodd' ? cruzamentos % 2 === 1 : voltas !== 0
}

/** Índices dos pontos dentro de um laço livre (polígono do arrasto). */
export function pontosNoLaco(laco: readonly P[], pontos: readonly P[]): number[] {
  if (laco.length < 3) return []
  return pontos.flatMap((p, i) => (dentroDoPoligono(laco, p, 'evenodd') ? [i] : []))
}

/** Área (com sinal) de um polígono. */
export function areaPoligono(pol: readonly P[]): number {
  let a = 0
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) a += (pol[j]!.x * pol[i]!.y - pol[i]!.x * pol[j]!.y)
  return a / 2
}

// ---------- SVG `d` ----------

const f = (n: number) => {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/** Serializa um caminho em `d` (M, L, C, Z), com escala opcional. */
export function caminhoParaD(cam: CaminhoVetor, sx = 1, sy = 1): string {
  const n0 = cam.nos[0]
  if (!n0) return ''
  const P = (p: P) => `${f(p.x * sx)} ${f(p.y * sy)}`
  let d = `M${P(n0)}`
  for (const s of segmentosDe(cam, 0)) {
    // o segmento de fechamento reto é o próprio Z
    if (s.reta && cam.fechado && s.j === 0) continue
    d += s.reta ? ` L${P(s.p3)}` : ` C${P(s.p1)} ${P(s.p2)} ${P(s.p3)}`
  }
  if (cam.fechado) d += ' Z'
  return d
}

export function vetorParaD(v: Vetor, sx = 1, sy = 1, filtro?: (c: CaminhoVetor) => boolean): string {
  return v.caminhos.filter((c) => (filtro ? filtro(c) : true)).map((c) => caminhoParaD(c, sx, sy)).filter(Boolean).join(' ')
}

/** Alças colineares e opostas → nó suave. */
export function tipoPelasAlcas(n: Pick<NoVetor, 'x' | 'y' | 'entrada' | 'saida'>): NoVetor['tipo'] {
  if (!n.entrada || !n.saida) return 'canto'
  const ax = n.entrada.x - n.x, ay = n.entrada.y - n.y
  const bx = n.saida.x - n.x, by = n.saida.y - n.y
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
  if (la < 1e-6 || lb < 1e-6) return 'canto'
  const cos = (ax * bx + ay * by) / (la * lb)
  return cos < -0.999 ? 'suave' : 'canto'
}

/** Arco SVG (endpoint) → cúbicas (de no máximo 90° cada). */
function arcoParaCubicas(x1: number, y1: number, rx: number, ry: number, rotGraus: number, grande: boolean, horario: boolean, x2: number, y2: number): [P, P, P][] {
  if (rx === 0 || ry === 0) return [[{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x2, y: y2 }]]
  const phi = (rotGraus * Math.PI) / 180
  const cos = Math.cos(phi), sin = Math.sin(phi)
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy
  rx = Math.abs(rx); ry = Math.abs(ry)
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  let coef = Math.sqrt(Math.max(0, num / den))
  if (grande === horario) coef = -coef
  const cxp = (coef * rx * y1p) / ry
  const cyp = (-coef * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return a
  }
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!horario && dt > 0) dt -= 2 * Math.PI
  else if (horario && dt < 0) dt += 2 * Math.PI
  const partes = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9))
  const passo = dt / partes
  const k = (4 / 3) * Math.tan(passo / 4)
  const r: [P, P, P][] = []
  const mapa = (x: number, y: number): P => ({ x: cos * rx * x - sin * ry * y + cx, y: sin * rx * x + cos * ry * y + cy })
  let a = t1
  for (let i = 0; i < partes; i++) {
    const b = a + passo
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b)
    r.push([mapa(ca - k * sa, sa + k * ca), mapa(cb + k * sb, sb - k * cb), mapa(cb, sb)])
    a = b
  }
  // o último ponto é exatamente o final pedido
  const ult = r[r.length - 1]
  if (ult) ult[2] = { x: x2, y: y2 }
  return r
}

/**
 * Lê um `d` do SVG (M L H V C S Q T A Z, absolutos e relativos) e devolve caminhos com nós e alças
 * absolutos. Quadráticas e arcos viram cúbicas.
 */
export function dParaCaminhos(d: string): CaminhoVetor[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []
  const caminhos: CaminhoVetor[] = []
  const st: { atual: CaminhoVetor | null } = { atual: null }
  let cmd = ''
  let k = 0
  let cx = 0, cy = 0 // ponto atual
  let sx = 0, sy = 0 // início do subcaminho
  let ultimoC: P | null = null // segunda alça da última cúbica (para S)
  let ultimoQ: P | null = null // controle da última quadrática (para T)
  const num = () => Number(tokens[k++])
  const temNum = () => k < tokens.length && !/^[a-zA-Z]$/.test(tokens[k]!)
  const ultimoNo = () => st.atual?.nos[st.atual.nos.length - 1]
  const iniciar = (x: number, y: number) => {
    st.atual = { nos: [{ x, y, tipo: 'canto' }], fechado: false }
    caminhos.push(st.atual)
    sx = x; sy = y
  }
  const garantir = () => { if (!st.atual) iniciar(cx, cy) }
  const linha = (x: number, y: number) => { garantir(); st.atual!.nos.push({ x, y, tipo: 'canto' }); cx = x; cy = y }
  const cubica = (c1: P, c2: P, x: number, y: number) => {
    garantir()
    const u = ultimoNo()!
    u.saida = c1
    st.atual!.nos.push({ x, y, entrada: c2, tipo: 'canto' })
    cx = x; cy = y
  }
  while (k < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[k]!)) cmd = tokens[k++]!
    else if (!cmd) { k++; continue }
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const ox = rel ? cx : 0
    const oy = rel ? cy : 0
    if (C === 'Z') {
      if (st.atual) {
        const a: CaminhoVetor = st.atual
        const u = a.nos[a.nos.length - 1]
        const p0 = a.nos[0]!
        // último nó sobre o primeiro: funde (a entrada do último vira a entrada do primeiro)
        if (u && a.nos.length > 1 && Math.abs(u.x - p0.x) < 1e-6 && Math.abs(u.y - p0.y) < 1e-6) {
          if (u.entrada) p0.entrada = u.entrada
          a.nos.pop()
        }
        a.fechado = true
      }
      st.atual = null
      cx = sx; cy = sy
      ultimoC = ultimoQ = null
      continue
    }
    if (!temNum()) { k++; continue }
    switch (C) {
      case 'M': {
        const x = num() + ox, y = num() + oy
        iniciar(x, y)
        cx = x; cy = y
        cmd = rel ? 'l' : 'L'
        ultimoC = ultimoQ = null
        break
      }
      case 'L': linha(num() + ox, num() + oy); ultimoC = ultimoQ = null; break
      case 'H': linha(num() + ox, cy); ultimoC = ultimoQ = null; break
      case 'V': linha(cx, num() + oy); ultimoC = ultimoQ = null; break
      case 'C': {
        const c1 = { x: num() + ox, y: num() + oy }
        const c2 = { x: num() + ox, y: num() + oy }
        const x = num() + ox, y = num() + oy
        cubica(c1, c2, x, y)
        ultimoC = c2; ultimoQ = null
        break
      }
      case 'S': {
        const c1 = ultimoC ? { x: 2 * cx - ultimoC.x, y: 2 * cy - ultimoC.y } : { x: cx, y: cy }
        const c2 = { x: num() + ox, y: num() + oy }
        const x = num() + ox, y = num() + oy
        cubica(c1, c2, x, y)
        ultimoC = c2; ultimoQ = null
        break
      }
      case 'Q':
      case 'T': {
        const q: P = C === 'Q' ? { x: num() + ox, y: num() + oy } : ultimoQ ? { x: 2 * cx - ultimoQ.x, y: 2 * cy - ultimoQ.y } : { x: cx, y: cy }
        const x = num() + ox, y = num() + oy
        cubica({ x: cx + (2 / 3) * (q.x - cx), y: cy + (2 / 3) * (q.y - cy) }, { x: x + (2 / 3) * (q.x - x), y: y + (2 / 3) * (q.y - y) }, x, y)
        ultimoQ = q; ultimoC = null
        break
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), grande = num() !== 0, horario = num() !== 0
        const x = num() + ox, y = num() + oy
        for (const [c1, c2, p] of arcoParaCubicas(cx, cy, rx, ry, rot, grande, horario, x, y)) cubica(c1, c2, p.x, p.y)
        ultimoC = ultimoQ = null
        break
      }
      default:
        k++
    }
  }
  // alças degeneradas (sobre o próprio nó) somem; tipo pelo alinhamento das alças
  for (const cam of caminhos) {
    for (const n of cam.nos) {
      if (n.entrada && dist(n.entrada, n) < 1e-6) delete n.entrada
      if (n.saida && dist(n.saida, n) < 1e-6) delete n.saida
      n.tipo = tipoPelasAlcas(n)
    }
  }
  return caminhos.filter((c) => c.nos.length > 0)
}
