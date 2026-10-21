/**
 * Camada SVG (colada do Figma/Illustrator ou enviada) → caminhos editáveis.
 * Lê path/rect/circle/ellipse/line/polyline/polygon com `transform` (inclusive dos grupos), agrupa por
 * pintura (preenchimento + traço) e devolve um vetor por pintura, já no espaço da camada.
 * Gradientes viram a cor da primeira parada; máscaras, filtros, textos e imagens são ignorados.
 */
import type { CaminhoVetor, Vetor } from '@/lib/scene/schema'
import { normalizarCor } from '@/lib/importar/svg'
import { dParaCaminhos } from './geometria'

type M = [number, number, number, number, number, number]
const ID: M = [1, 0, 0, 1, 0, 0]
const mult = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]

/** Atributo `transform` do SVG → matriz. */
export function lerTransform(s: string | null | undefined): M {
  if (!s) return ID
  let m: M = ID
  for (const [, nome, args] of s.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const n = (args ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
    let t: M = ID
    switch (nome) {
      case 'matrix': if (n.length >= 6) t = [n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!]; break
      case 'translate': t = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0]; break
      case 'scale': t = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0]; break
      case 'rotate': {
        const a = ((n[0] ?? 0) * Math.PI) / 180
        const r: M = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]
        const cx = n[1] ?? 0, cy = n[2] ?? 0
        t = cx || cy ? mult(mult([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]) : r
        break
      }
      case 'skewX': t = [1, 0, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break
      case 'skewY': t = [1, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break
    }
    m = mult(m, t)
  }
  return m
}

function aplicarM(cams: CaminhoVetor[], m: M): CaminhoVetor[] {
  const ap = (p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] })
  return cams.map((c) => ({ ...c, nos: c.nos.map((n) => ({ ...n, ...ap(n), ...(n.entrada ? { entrada: ap(n.entrada) } : {}), ...(n.saida ? { saida: ap(n.saida) } : {}) })) }))
}

const num = (el: Element, a: string, padrao = 0) => { const v = parseFloat(el.getAttribute(a) ?? ''); return Number.isFinite(v) ? v : padrao }

/** `d` equivalente a um elemento básico do SVG. */
export function dDoElemento(el: Element): string | null {
  const tag = el.tagName.toLowerCase().replace(/^svg:/, '')
  switch (tag) {
    case 'path': return el.getAttribute('d')
    case 'rect': {
      const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height')
      if (w <= 0 || h <= 0) return null
      let rx = num(el, 'rx', NaN), ry = num(el, 'ry', NaN)
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry
      if (Number.isNaN(ry)) ry = rx
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2)
      if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`
      return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(el, 'cx'), cy = num(el, 'cy')
      const rx = tag === 'circle' ? num(el, 'r') : num(el, 'rx'), ry = tag === 'circle' ? rx : num(el, 'ry')
      if (rx <= 0 || ry <= 0) return null
      return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
    }
    case 'line': return `M${num(el, 'x1')} ${num(el, 'y1')}L${num(el, 'x2')} ${num(el, 'y2')}`
    case 'polyline':
    case 'polygon': {
      const n = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number)
      if (n.length < 4) return null
      let d = `M${n[0]} ${n[1]}`
      for (let i = 2; i + 1 < n.length; i += 2) d += `L${n[i]} ${n[i + 1]}`
      return tag === 'polygon' ? d + 'Z' : d
    }
  }
  return null
}

export interface GrupoVetor {
  /** Preenchimento (#rrggbb) ou null (sem preenchimento). */
  fill: string | null
  stroke: string | null
  strokeWidth: number
  fillRule: 'nonzero' | 'evenodd'
  caminhos: CaminhoVetor[]
}

/** Regras simples de <style> (`.cls-1{fill:#f00}`), como o Illustrator exporta. */
function regrasDeClasse(doc: Document): Map<string, Record<string, string>> {
  const m = new Map<string, Record<string, string>>()
  for (const st of Array.from(doc.getElementsByTagName('style'))) {
    for (const [, sels, corpo] of (st.textContent ?? '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const decl = Object.fromEntries((corpo ?? '').split(';').map((d) => d.split(':').map((x) => x.trim())).filter((p) => p.length === 2 && p[0]) as [string, string][])
      for (const s of (sels ?? '').split(',')) {
        const cl = s.trim().match(/^\.([\w-]+)$/)?.[1]
        if (cl) m.set(cl, { ...m.get(cl), ...decl })
      }
    }
  }
  return m
}

function estiloDe(el: Element, classes: Map<string, Record<string, string>>): Record<string, string> {
  const r: Record<string, string> = {}
  for (const cl of (el.getAttribute('class') ?? '').split(/\s+/)) Object.assign(r, classes.get(cl))
  for (const a of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'display', 'visibility']) { const v = el.getAttribute(a); if (v != null) r[a] = v }
  for (const d of (el.getAttribute('style') ?? '').split(';')) { const [k, v] = d.split(':').map((x) => x.trim()); if (k && v) r[k] = v }
  return r
}

function corDaPintura(v: string | undefined, doc: Document): string | null | undefined {
  if (v == null || v === 'inherit') return undefined
  if (v === 'none' || v === 'transparent') return null
  const url = v.match(/url\(\s*['"]?#([^'")]+)/)?.[1]
  if (url) {
    const g = doc.getElementById(url)
    const stop = g?.getElementsByTagName('stop')[0]
    const c = stop ? (stop.getAttribute('stop-color') ?? stop.getAttribute('style')?.match(/stop-color\s*:\s*([^;]+)/)?.[1]) : null
    return (c && normalizarCor(c)) ?? '#000000'
  }
  return normalizarCor(v) ?? (v === 'currentColor' ? '#000000' : '#000000')
}

/**
 * SVG → grupos de caminhos no espaço da camada (`largura × altura`), como o renderizador o mostra
 * (`fit` contain = centrado sem distorcer; fill = esticado). Devolve null se não houver nada desenhável.
 */
export function svgParaGrupos(markup: string, largura: number, altura: number, fit: 'contain' | 'fill', parser: { parseFromString(s: string, tipo: string): Document }): GrupoVetor[] | null {
  const doc = parser.parseFromString(markup, 'image/svg+xml')
  const raiz = doc.getElementsByTagName('svg')[0]
  if (!raiz) return null
  const vb = (raiz.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const [vx, vy, vw, vh] = vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0 ? (vb as [number, number, number, number]) : [0, 0, num(raiz, 'width', largura), num(raiz, 'height', altura)]
  let sx = largura / vw
  let sy = altura / vh
  let ox = 0, oy = 0
  if (fit === 'contain') {
    const s = Math.min(sx, sy)
    ox = (largura - vw * s) / 2
    oy = (altura - vh * s) / 2
    sx = sy = s
  }
  const base: M = [sx, 0, 0, sy, ox - vx * sx, oy - vy * sy]
  const classes = regrasDeClasse(doc)
  const grupos = new Map<string, GrupoVetor>()
  const IGNORAR = new Set(['defs', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'filter', 'symbol', 'style', 'title', 'desc', 'metadata', 'text', 'image', 'foreignobject'])
  const visitar = (el: Element, m: M, herdado: Record<string, string>) => {
    const tag = el.tagName.toLowerCase().replace(/^svg:/, '')
    if (IGNORAR.has(tag)) return
    const proprio = estiloDe(el, classes)
    if (proprio.display === 'none' || proprio.visibility === 'hidden') return
    const est = { ...herdado, ...proprio }
    const mm = el === raiz ? m : mult(m, lerTransform(el.getAttribute('transform')))
    const d = dDoElemento(el)
    if (d) {
      const cams = aplicarM(dParaCaminhos(d), mm)
      if (cams.length) {
        const fill = corDaPintura(est.fill, doc)
        const stroke = corDaPintura(est.stroke, doc) ?? null
        const escala = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2]))
        const sw = stroke ? Math.min(100, Math.round(parseFloat(est['stroke-width'] ?? '1') * escala * 100) / 100 || 1) : 0
        const f = fill === undefined ? '#000000' : fill
        const regra = est['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero'
        const chave = `${f}|${stroke}|${sw}|${regra}`
        const g = grupos.get(chave) ?? { fill: f, stroke, strokeWidth: sw, fillRule: regra, caminhos: [] }
        // aberto sem traço não aparece; aberto com preenchimento continua preenchido (SVG fecha implicitamente)
        g.caminhos.push(...cams.map((c) => (f ? c : { ...c, semPreenchimento: true })))
        grupos.set(chave, g)
      }
    }
    for (const filho of Array.from(el.children)) visitar(filho, mm, est)
  }
  visitar(raiz, base, {})
  const r = [...grupos.values()].filter((g) => g.caminhos.length && (g.fill || g.stroke))
  return r.length ? r : null
}

/** Vetor (quadro = camada) de um grupo. */
export function vetorDoGrupo(g: GrupoVetor, largura: number, altura: number): Vetor {
  return { w: largura, h: altura, caminhos: g.caminhos, fillRule: g.fillRule }
}
