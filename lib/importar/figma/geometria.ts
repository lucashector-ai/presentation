/**
 * Geometria do Figma → caminhos SVG (`d`) e matrizes.
 *
 * - `commandsBlob` (fillGeometry/strokeGeometry/glifos): bytes LE; comando u8 (0 Z, 1 M, 2 L, 3 Q, 4 C)
 *   seguido de pares float32 x,y.
 * - `vectorNetworkBlob`: u32 vértices/segmentos/regiões; vértice [estilo u32, x f32, y f32];
 *   segmento [estilo, início u32, dx, dy, fim u32, dx, dy]; região [estilo<<1 | nonzero, nLaços, laços[n, idx...]].
 * - Retângulo, elipse (com arco/anel), estrela, polígono e linha são gerados aqui quando a cópia não traz
 *   geometria pronta (o Figma só manda geometria assada para vetores).
 */

// ---------- matrizes 2×3 ----------

export interface M {
  a: number // m00
  b: number // m10
  c: number // m01
  d: number // m11
  e: number // m02
  f: number // m12
}

export const IDENTIDADE: M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

export function deFigma(t: { m00?: number; m01?: number; m02?: number; m10?: number; m11?: number; m12?: number } | undefined): M {
  if (!t) return IDENTIDADE
  return { a: t.m00 ?? 1, b: t.m10 ?? 0, c: t.m01 ?? 0, d: t.m11 ?? 1, e: t.m02 ?? 0, f: t.m12 ?? 0 }
}

/** p ↦ m1(m2(p)) */
export function multiplicar(m1: M, m2: M): M {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  }
}

export function inverter(m: M): M {
  const det = m.a * m.d - m.b * m.c || 1e-12
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  }
}

export function aplicar(m: M, x: number, y: number): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

export function ehIdentidade(m: M): boolean {
  return Math.abs(m.a - 1) < 1e-6 && Math.abs(m.d - 1) < 1e-6 && Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && Math.abs(m.e) < 1e-6 && Math.abs(m.f) < 1e-6
}

export function svgMatriz(m: M): string {
  return `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(num).join(' ')})`
}

/** Decompõe a parte linear em rotação (graus, sentido horário em y para baixo), espelho e escalas. */
export function decompor(m: M): { rotacao: number; espelhoX: boolean; sx: number; sy: number; ortogonal: boolean } {
  const det = m.a * m.d - m.b * m.c
  const espelhoX = det < 0
  // com espelho, desfaz o espelho em x local: L·Fx
  const a = espelhoX ? -m.a : m.a
  const b = espelhoX ? -m.b : m.b
  const rot = Math.atan2(b, a)
  const sx = Math.hypot(m.a, m.b)
  const sy = Math.hypot(m.c, m.d)
  const ortogonal = Math.abs(m.a * m.c + m.b * m.d) < 1e-4 * Math.max(1, sx * sy)
  return { rotacao: (rot * 180) / Math.PI, espelhoX, sx, sy, ortogonal }
}

// ---------- caixas ----------

export interface Caixa {
  x: number
  y: number
  w: number
  h: number
}

export function uniao(a: Caixa | null, b: Caixa | null): Caixa | null {
  if (!a) return b
  if (!b) return a
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

export function intersecao(a: Caixa, b: Caixa): Caixa | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null
}

export function expandir(c: Caixa, m: number): Caixa {
  return { x: c.x - m, y: c.y - m, w: c.w + 2 * m, h: c.h + 2 * m }
}

/** Caixa alinhada aos eixos de uma caixa transformada. */
export function transformarCaixa(m: M, c: Caixa): Caixa {
  const pts = [aplicar(m, c.x, c.y), aplicar(m, c.x + c.w, c.y), aplicar(m, c.x, c.y + c.h), aplicar(m, c.x + c.w, c.y + c.h)]
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

// ---------- números ----------

export function num(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

// ---------- commandsBlob ----------

export interface Caminho {
  d: string
  caixa: Caixa | null
}

/** Converte o blob de comandos do Figma em `d` de SVG e calcula a caixa (pontos de controle incluídos). */
export function comandosParaPath(bytes: Uint8Array): Caminho | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const partes: string[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let o = 0
  const f = () => {
    const v = dv.getFloat32(o, true)
    o += 4
    return v
  }
  const pts = (n: number) => {
    if (o + n * 8 > bytes.length) return null
    const r: number[] = []
    for (let i = 0; i < n; i++) {
      const x = f()
      const y = f()
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      r.push(x, y)
    }
    return r.map(num).join(' ')
  }
  while (o < bytes.length) {
    const cmd = bytes[o++]
    let p: string | null
    switch (cmd) {
      case 0:
        partes.push('Z')
        continue
      case 1:
        p = pts(1)
        if (p === null) return null
        partes.push(`M${p}`)
        break
      case 2:
        p = pts(1)
        if (p === null) return null
        partes.push(`L${p}`)
        break
      case 3:
        p = pts(2)
        if (p === null) return null
        partes.push(`Q${p}`)
        break
      case 4:
        p = pts(3)
        if (p === null) return null
        partes.push(`C${p}`)
        break
      default:
        return null
    }
  }
  if (!partes.length) return null
  return { d: partes.join(''), caixa: Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null }
}

// ---------- vector network (quando não há geometria assada) ----------

export interface RedeVetorial {
  vertices: { x: number; y: number }[]
  segmentos: { ini: number; idx: number; idy: number; fim: number; fdx: number; fdy: number }[]
  regioes: { nonzero: boolean; lacos: number[][] }[]
}

export function lerRedeVetorial(bytes: Uint8Array): RedeVetorial | null {
  if (bytes.length < 12) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let o = 0
  const u = () => {
    const v = dv.getUint32(o, true)
    o += 4
    return v
  }
  const f = () => {
    const v = dv.getFloat32(o, true)
    o += 4
    return v
  }
  try {
    const nv = u()
    const ns = u()
    const nr = u()
    const vertices: RedeVetorial['vertices'] = []
    for (let i = 0; i < nv; i++) {
      u()
      vertices.push({ x: f(), y: f() })
    }
    const segmentos: RedeVetorial['segmentos'] = []
    for (let i = 0; i < ns; i++) {
      u()
      const ini = u()
      const idx = f()
      const idy = f()
      const fim = u()
      const fdx = f()
      const fdy = f()
      if (ini >= nv || fim >= nv) return null
      segmentos.push({ ini, idx, idy, fim, fdx, fdy })
    }
    const regioes: RedeVetorial['regioes'] = []
    for (let i = 0; i < nr; i++) {
      const er = u()
      const nl = u()
      const lacos: number[][] = []
      for (let j = 0; j < nl; j++) {
        const n = u()
        const l: number[] = []
        for (let k = 0; k < n; k++) {
          const s = u()
          if (s >= ns) return null
          l.push(s)
        }
        lacos.push(l)
      }
      regioes.push({ nonzero: (er & 1) !== 0, lacos })
    }
    return { vertices, segmentos, regioes }
  } catch {
    return null
  }
}

/** Caminhos de uma rede vetorial: regiões (preenchíveis) e o traço com todos os segmentos. */
export function redeParaPaths(rede: RedeVetorial, escalaX = 1, escalaY = 1): { regioes: { d: string; nonzero: boolean }[]; traco: string } {
  const P = (i: number) => {
    const v = rede.vertices[i]!
    return { x: v.x * escalaX, y: v.y * escalaY }
  }
  const curva = (s: RedeVetorial['segmentos'][number], invertido: boolean) => {
    const a = P(invertido ? s.fim : s.ini)
    const b = P(invertido ? s.ini : s.fim)
    const t1 = invertido ? { dx: s.fdx, dy: s.fdy } : { dx: s.idx, dy: s.idy }
    const t2 = invertido ? { dx: s.idx, dy: s.idy } : { dx: s.fdx, dy: s.fdy }
    const reta = !t1.dx && !t1.dy && !t2.dx && !t2.dy
    return { a, b, cmd: reta ? `L${num(b.x)} ${num(b.y)}` : `C${num(a.x + t1.dx * escalaX)} ${num(a.y + t1.dy * escalaY)} ${num(b.x + t2.dx * escalaX)} ${num(b.y + t2.dy * escalaY)} ${num(b.x)} ${num(b.y)}` }
  }
  const regioes = rede.regioes.map((r) => {
    const partes: string[] = []
    for (const laco of r.lacos) {
      let ultimo = -1
      laco.forEach((si, i) => {
        const s = rede.segmentos[si]!
        // orienta o segmento para continuar do último vértice (o primeiro, para encostar no próximo)
        let inv: boolean
        if (ultimo !== -1) inv = s.ini !== ultimo && s.fim === ultimo
        else {
          const prox = laco.length > 1 ? rede.segmentos[laco[1]!] : undefined
          inv = !!prox && s.fim !== prox.ini && s.fim !== prox.fim && (s.ini === prox.ini || s.ini === prox.fim)
        }
        const c = curva(s, inv)
        if (i === 0 || ultimo !== (inv ? s.fim : s.ini)) partes.push(`M${num(c.a.x)} ${num(c.a.y)}`)
        partes.push(c.cmd)
        ultimo = inv ? s.ini : s.fim
      })
      partes.push('Z')
    }
    return { d: partes.join(''), nonzero: r.nonzero }
  })
  const traco: string[] = []
  let fimAnterior = -1
  for (const s of rede.segmentos) {
    const c = curva(s, false)
    if (s.ini !== fimAnterior) traco.push(`M${num(c.a.x)} ${num(c.a.y)}`)
    traco.push(c.cmd)
    fimAnterior = s.fim
  }
  return { regioes, traco: traco.join('') }
}

// ---------- formas geradas ----------

/** Retângulo com raios [sup.esq, sup.dir, inf.dir, inf.esq] (limitados como no Figma). */
export function retanguloPath(w: number, h: number, raios: [number, number, number, number] = [0, 0, 0, 0]): string {
  const lim = Math.min(w, h) / 2
  const [tl, tr, br, bl] = raios.map((r) => Math.max(0, Math.min(r, lim))) as [number, number, number, number]
  if (!tl && !tr && !br && !bl) return `M0 0H${num(w)}V${num(h)}H0Z`
  const k = 0.5522847498
  const p: string[] = [`M${num(tl)} 0`, `H${num(w - tr)}`]
  if (tr) p.push(`C${num(w - tr + tr * k)} 0 ${num(w)} ${num(tr - tr * k)} ${num(w)} ${num(tr)}`)
  p.push(`V${num(h - br)}`)
  if (br) p.push(`C${num(w)} ${num(h - br + br * k)} ${num(w - br + br * k)} ${num(h)} ${num(w - br)} ${num(h)}`)
  p.push(`H${num(bl)}`)
  if (bl) p.push(`C${num(bl - bl * k)} ${num(h)} 0 ${num(h - bl + bl * k)} 0 ${num(h - bl)}`)
  p.push(`V${num(tl)}`)
  if (tl) p.push(`C0 ${num(tl - tl * k)} ${num(tl - tl * k)} 0 ${num(tl)} 0`)
  p.push('Z')
  return p.join('')
}

/** Elipse inscrita em w×h, com arco (ângulos em radianos, horário) e anel interno opcionais. */
export function elipsePath(w: number, h: number, arco?: { startingAngle?: number; endingAngle?: number; innerRadius?: number }): string {
  const rx = w / 2
  const ry = h / 2
  const ini = arco?.startingAngle ?? 0
  const fim = arco?.endingAngle ?? Math.PI * 2
  const interno = Math.max(0, Math.min(1, arco?.innerRadius ?? 0))
  const varredura = fim - ini
  const completo = Math.abs(varredura) >= Math.PI * 2 - 1e-4
  const ponto = (ang: number, f: number) => ({ x: rx + Math.cos(ang) * rx * f, y: ry + Math.sin(ang) * ry * f })
  const circ = (f: number, sentido: 0 | 1) =>
    `M${num(rx + rx * f)} ${num(ry)}A${num(rx * f)} ${num(ry * f)} 0 1 ${sentido} ${num(rx - rx * f)} ${num(ry)}A${num(rx * f)} ${num(ry * f)} 0 1 ${sentido} ${num(rx + rx * f)} ${num(ry)}Z`
  if (completo) return interno > 0 ? circ(1, 1) + circ(interno, 0) : circ(1, 1)
  const grande = Math.abs(varredura) > Math.PI ? 1 : 0
  const a = ponto(ini, 1)
  const b = ponto(fim, 1)
  let d = `M${num(a.x)} ${num(a.y)}A${num(rx)} ${num(ry)} 0 ${grande} 1 ${num(b.x)} ${num(b.y)}`
  if (interno > 0) {
    const c = ponto(fim, interno)
    const e = ponto(ini, interno)
    d += `L${num(c.x)} ${num(c.y)}A${num(rx * interno)} ${num(ry * interno)} 0 ${grande} 0 ${num(e.x)} ${num(e.y)}Z`
  } else d += `L${num(rx)} ${num(ry)}Z`
  return d
}

/** Pontos num círculo unitário, primeiro vértice no topo, esticados para preencher w×h (como o Figma faz). */
function poligonoEsticado(pontos: { x: number; y: number }[], w: number, h: number): string {
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const sx = w / (Math.max(...xs) - minX || 1)
  const sy = h / (Math.max(...ys) - minY || 1)
  return pontos.map((p, i) => `${i ? 'L' : 'M'}${num((p.x - minX) * sx)} ${num((p.y - minY) * sy)}`).join('') + 'Z'
}

export function estrelaPath(w: number, h: number, pontas = 5, interno = 0.382): string {
  const n = Math.max(3, Math.round(pontas))
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 1 : interno
    const ang = (Math.PI / n) * i - Math.PI / 2
    pts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r })
  }
  return poligonoEsticado(pts, w, h)
}

export function poligonoPath(w: number, h: number, lados = 3): string {
  const n = Math.max(3, Math.round(lados))
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const ang = ((Math.PI * 2) / n) * i - Math.PI / 2
    pts.push({ x: Math.cos(ang), y: Math.sin(ang) })
  }
  return poligonoEsticado(pts, w, h)
}

export function linhaPath(w: number): string {
  return `M0 0L${num(w)} 0`
}
