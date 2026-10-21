/**
 * Operações do modo "Editar vetor" (puras: recebem um vetor e devolvem outro).
 * Nós são referenciados por { c: caminho, i: índice do nó }.
 */
import type { CaminhoVetor, NoVetor, Vetor } from '@/lib/scene/schema'
import { caixaVetor, dist, dividirCubica, segmento, tipoPelasAlcas, type Caixa, type P } from './geometria'

export interface RefNo { c: number; i: number }
export type QualAlca = 'entrada' | 'saida'

const clonar = (v: Vetor): Vetor => structuredClone(v)
export const chaveNo = (r: RefNo) => `${r.c}:${r.i}`
const somar = (p: P, dx: number, dy: number): P => ({ x: p.x + dx, y: p.y + dy })

/** Move nós (com as alças). */
export function moverNos(v: Vetor, refs: readonly RefNo[], dx: number, dy: number): Vetor {
  const n = clonar(v)
  const feitos = new Set<string>()
  for (const r of refs) {
    const no = n.caminhos[r.c]?.nos[r.i]
    if (!no || feitos.has(chaveNo(r))) continue
    feitos.add(chaveNo(r))
    no.x += dx
    no.y += dy
    if (no.entrada) no.entrada = somar(no.entrada, dx, dy)
    if (no.saida) no.saida = somar(no.saida, dx, dy)
  }
  return n
}

/**
 * Move uma alça. Em nó suave, a alça oposta acompanha o ângulo (mantém o comprimento; cria espelhada se
 * não existir). `quebrar` (Alt) solta a simetria: o nó vira canto.
 */
export function moverAlca(v: Vetor, r: RefNo, qual: QualAlca, p: P, quebrar = false): Vetor {
  const n = clonar(v)
  const no = n.caminhos[r.c]?.nos[r.i]
  if (!no) return v
  no[qual] = { x: p.x, y: p.y }
  const outra: QualAlca = qual === 'entrada' ? 'saida' : 'entrada'
  if (quebrar) no.tipo = 'canto'
  else if (no.tipo === 'suave') {
    const dx = p.x - no.x
    const dy = p.y - no.y
    const l = Math.hypot(dx, dy)
    const o = no[outra]
    const lo = o ? dist(o, no) : l
    if (l > 1e-9) no[outra] = { x: no.x - (dx / l) * lo, y: no.y - (dy / l) * lo }
  }
  if (dist(no[qual]!, no) < 1e-6) delete no[qual]
  return n
}

/** Curvar a partir do nó: puxa alças simétricas (Alt: só a de saída, nó vira canto). */
export function puxarAlcas(v: Vetor, r: RefNo, p: P, simetrico = true): Vetor {
  const n = clonar(v)
  const no = n.caminhos[r.c]?.nos[r.i]
  if (!no) return v
  no.saida = { x: p.x, y: p.y }
  if (simetrico) { no.entrada = { x: 2 * no.x - p.x, y: 2 * no.y - p.y }; no.tipo = 'suave' }
  else no.tipo = 'canto'
  if (dist(p, no) < 1e-6) { delete no.saida; if (simetrico) delete no.entrada }
  return n
}

/**
 * Curvar um segmento arrastando o ponto em `t` até `alvo`: desloca as duas alças igualmente para que a curva
 * passe pelo ponteiro (B(t) muda 3t(1−t)·D). Retas ganham alças nos terços. Nós suaves mantêm a tangente.
 */
export function curvarSegmento(v: Vetor, c: number, i: number, t: number, alvo: P, base?: Vetor): Vetor {
  const origem = base ?? v
  const cam = origem.caminhos[c]
  const s = cam ? segmento(cam, c, i) : null
  if (!s) return v
  const tt = Math.min(0.85, Math.max(0.15, t))
  const p1 = s.reta ? { x: s.p0.x + (s.p3.x - s.p0.x) / 3, y: s.p0.y + (s.p3.y - s.p0.y) / 3 } : s.p1
  const p2 = s.reta ? { x: s.p0.x + ((s.p3.x - s.p0.x) * 2) / 3, y: s.p0.y + ((s.p3.y - s.p0.y) * 2) / 3 } : s.p2
  const u = 1 - tt
  const atual = {
    x: u * u * u * s.p0.x + 3 * u * u * tt * p1.x + 3 * u * tt * tt * p2.x + tt * tt * tt * s.p3.x,
    y: u * u * u * s.p0.y + 3 * u * u * tt * p1.y + 3 * u * tt * tt * p2.y + tt * tt * tt * s.p3.y,
  }
  const k = 3 * tt * u
  const D = { x: (alvo.x - atual.x) / k, y: (alvo.y - atual.y) / k }
  let n = clonar(origem)
  const a = n.caminhos[c]!.nos[s.i]!
  const b = n.caminhos[c]!.nos[s.j]!
  a.saida = { x: p1.x + D.x, y: p1.y + D.y }
  b.entrada = { x: p2.x + D.x, y: p2.y + D.y }
  // nós suaves: a alça do outro lado acompanha
  if (a.tipo === 'suave') n = moverAlca(n, { c, i: s.i }, 'saida', a.saida)
  if (b.tipo === 'suave') n = moverAlca(n, { c, i: s.j }, 'entrada', b.entrada)
  return n
}

/** Insere um nó no segmento (i → próximo) em t, dividindo a curva com de Casteljau. Devolve o índice novo. */
export function inserirNo(v: Vetor, c: number, i: number, t: number): { vetor: Vetor; ref: RefNo } | null {
  const cam = v.caminhos[c]
  const s = cam ? segmento(cam, c, i) : null
  if (!s) return null
  const n = clonar(v)
  const nos = n.caminhos[c]!.nos
  const a = nos[s.i]!
  const b = nos[s.j]!
  let novo: NoVetor
  if (s.reta) {
    novo = { x: s.p0.x + (s.p3.x - s.p0.x) * t, y: s.p0.y + (s.p3.y - s.p0.y) * t, tipo: 'canto' }
  } else {
    const [e, d] = dividirCubica(s, t)
    a.saida = e[1]
    b.entrada = d[2]
    novo = { x: e[3].x, y: e[3].y, entrada: e[2], saida: d[1], tipo: 'suave' }
    if (dist(a.saida, a) < 1e-6) delete a.saida
    if (dist(b.entrada, b) < 1e-6) delete b.entrada
    if (dist(novo.entrada!, novo) < 1e-6) delete novo.entrada
    if (dist(novo.saida!, novo) < 1e-6) delete novo.saida
    novo.tipo = tipoPelasAlcas(novo)
  }
  nos.splice(s.i + 1, 0, novo)
  return { vetor: n, ref: { c, i: s.i + 1 } }
}

/** Remove caminhos com menos de 2 nós (invisíveis). Devolve null se nada sobrar. */
function limpar(v: Vetor): Vetor | null {
  const caminhos = v.caminhos.filter((c) => c.nos.length >= 2)
  if (!caminhos.length) return null
  return { ...v, caminhos: caminhos.map((c) => (c.nos.length < 3 && c.fechado ? { ...c, fechado: c.nos.length === 2 && c.nos.some((n) => n.entrada || n.saida) } : c)) }
}

/** Apaga nós ligando os vizinhos (o caminho continua inteiro). null = não sobrou nada. */
export function removerNos(v: Vetor, refs: readonly RefNo[]): Vetor | null {
  const tirar = new Set(refs.map(chaveNo))
  const n: Vetor = { ...v, caminhos: v.caminhos.map((cam, c) => ({ ...cam, nos: cam.nos.filter((_, i) => !tirar.has(chaveNo({ c, i }))) })) }
  return limpar(structuredClone(n))
}

/** Gira um caminho fechado para começar no nó i (sem duplicar). */
function rotacionar(nos: NoVetor[], i: number): NoVetor[] {
  return [...nos.slice(i), ...nos.slice(0, i)]
}

/**
 * Abre o caminho no nó (Cortar num nó): fechado → aberto começando e terminando nesse nó (duplicado);
 * aberto → dois caminhos separados no nó. Pontas não mudam nada.
 */
export function abrirNoNo(v: Vetor, r: RefNo): Vetor {
  const cam = v.caminhos[r.c]
  const no = cam?.nos[r.i]
  if (!cam || !no) return v
  const n = clonar(v)
  const nos = structuredClone(cam.nos)
  const { entrada, saida, ...base } = structuredClone(no)
  const inicio: NoVetor = { ...base, ...(saida ? { saida } : {}), tipo: 'canto' }
  const fim: NoVetor = { ...base, ...(entrada ? { entrada } : {}), tipo: 'canto' }
  if (cam.fechado) {
    const g = rotacionar(nos, r.i)
    n.caminhos[r.c] = { ...cam, nos: [inicio, ...g.slice(1), fim], fechado: false }
    return n
  }
  if (r.i === 0 || r.i === nos.length - 1) return v
  const a: CaminhoVetor = { ...cam, nos: [...nos.slice(0, r.i), fim], fechado: false }
  const b: CaminhoVetor = { ...cam, nos: [inicio, ...nos.slice(r.i + 1)], fechado: false }
  n.caminhos.splice(r.c, 1, a, b)
  return n
}

/** Cortar num segmento: insere um nó em t e abre o caminho ali. */
export function cortarSegmento(v: Vetor, c: number, i: number, t: number): Vetor {
  const ins = inserirNo(v, c, i, t)
  return ins ? abrirNoNo(ins.vetor, ins.ref) : v
}

/** Apagar um segmento: fechado vira aberto sem ele; aberto se divide em dois. */
export function apagarSegmento(v: Vetor, c: number, i: number): Vetor | null {
  const cam = v.caminhos[c]
  const s = cam ? segmento(cam, c, i) : null
  if (!cam || !s) return v
  const n = clonar(v)
  const nos = structuredClone(cam.nos)
  delete nos[s.i]!.saida
  delete nos[s.j]!.entrada
  for (const k of [s.i, s.j]) nos[k]!.tipo = 'canto'
  if (cam.fechado) {
    n.caminhos[c] = { ...cam, nos: rotacionar(nos, s.j), fechado: false }
    return limpar(n)
  }
  const a: CaminhoVetor = { ...cam, nos: nos.slice(0, s.i + 1), fechado: false }
  const b: CaminhoVetor = { ...cam, nos: nos.slice(s.j), fechado: false }
  n.caminhos.splice(c, 1, a, b)
  return limpar(n)
}

/** Duplo clique / Curvar com clique: canto ↔ suave (alças pela tangente dos vizinhos). */
export function alternarTipoNo(v: Vetor, r: RefNo): Vetor {
  const cam = v.caminhos[r.c]
  const no = cam?.nos[r.i]
  if (!cam || !no) return v
  const n = clonar(v)
  const alvo = n.caminhos[r.c]!.nos[r.i]!
  if (alvo.entrada || alvo.saida) {
    delete alvo.entrada
    delete alvo.saida
    alvo.tipo = 'canto'
    return n
  }
  const k = cam.nos.length
  const ant = r.i > 0 ? cam.nos[r.i - 1] : cam.fechado ? cam.nos[k - 1] : undefined
  const prox = r.i < k - 1 ? cam.nos[r.i + 1] : cam.fechado ? cam.nos[0] : undefined
  const a = ant ?? no
  const b = prox ?? no
  let tx = b.x - a.x
  let ty = b.y - a.y
  const l = Math.hypot(tx, ty)
  if (l < 1e-9) return v
  tx /= l; ty /= l
  const la = ant ? dist(ant, no) / 3 : 0
  const lb = prox ? dist(prox, no) / 3 : 0
  if (la) alvo.entrada = { x: no.x - tx * la, y: no.y - ty * la }
  if (lb) alvo.saida = { x: no.x + tx * lb, y: no.y + ty * lb }
  alvo.tipo = 'suave'
  return n
}

/** Pintar: liga/desliga o preenchimento de um caminho. */
export function alternarPreenchimento(v: Vetor, c: number): Vetor {
  const n = clonar(v)
  const cam = n.caminhos[c]
  if (!cam) return v
  if (cam.semPreenchimento) delete cam.semPreenchimento
  else cam.semPreenchimento = true
  return n
}

/** Caneta: acrescenta um nó no fim (ou no começo) de um caminho aberto. */
export function adicionarNo(v: Vetor, c: number, p: P, saida?: P, noInicio = false): { vetor: Vetor; ref: RefNo } {
  const n = clonar(v)
  const cam = n.caminhos[c]
  if (!cam) return { vetor: v, ref: { c, i: 0 } }
  const no: NoVetor = { x: p.x, y: p.y, tipo: saida ? 'suave' : 'canto' }
  if (saida) {
    // a alça de saída é o arrasto; a de entrada, espelhada (no começo, inverte o sentido)
    const espelho = { x: 2 * p.x - saida.x, y: 2 * p.y - saida.y }
    no.saida = noInicio ? espelho : saida
    no.entrada = noInicio ? saida : espelho
  }
  if (noInicio) { cam.nos.unshift(no); return { vetor: n, ref: { c, i: 0 } } }
  cam.nos.push(no)
  return { vetor: n, ref: { c, i: cam.nos.length - 1 } }
}

/** Caneta: alças do último nó enquanto arrasta (suave, espelhadas). */
export function definirAlcasDoNo(v: Vetor, r: RefNo, saida: P, inverter = false): Vetor {
  const n = clonar(v)
  const no = n.caminhos[r.c]?.nos[r.i]
  if (!no) return v
  const espelho = { x: 2 * no.x - saida.x, y: 2 * no.y - saida.y }
  if (dist(saida, no) < 1e-6) { delete no.entrada; delete no.saida; no.tipo = 'canto'; return n }
  no.saida = inverter ? espelho : saida
  no.entrada = inverter ? saida : espelho
  no.tipo = 'suave'
  return n
}

export function fecharCaminho(v: Vetor, c: number): Vetor {
  const n = clonar(v)
  const cam = n.caminhos[c]
  if (cam && cam.nos.length >= 2) cam.fechado = true
  return n
}

export function novoCaminho(v: Vetor, p: P, semPreenchimento = true): { vetor: Vetor; ref: RefNo } {
  const n = clonar(v)
  n.caminhos.push({ nos: [{ x: p.x, y: p.y, tipo: 'canto' }], fechado: false, ...(semPreenchimento ? { semPreenchimento: true } : {}) })
  return { vetor: n, ref: { c: n.caminhos.length - 1, i: 0 } }
}

/**
 * Recalcula o quadro do vetor pela caixa da geometria: devolve o vetor transladado para começar em (0, 0),
 * com w/h = tamanho da caixa (mín. 1), e a caixa nova nas coordenadas locais ANTIGAS.
 */
export function normalizar(v: Vetor): { vetor: Vetor; caixa: Caixa } {
  const c = caixaVetor(v)
  const w = Math.max(1, c.width)
  const h = Math.max(1, c.height)
  const x0 = c.x - (w - c.width) / 2
  const y0 = c.y - (h - c.height) / 2
  const n = clonar(v)
  for (const cam of n.caminhos) for (const no of cam.nos) {
    no.x -= x0; no.y -= y0
    if (no.entrada) no.entrada = somar(no.entrada, -x0, -y0)
    if (no.saida) no.saida = somar(no.saida, -x0, -y0)
  }
  n.w = w
  n.h = h
  return { vetor: n, caixa: { x: x0, y: y0, width: w, height: h } }
}

/** Escala o vetor para outro quadro (ex.: entrar no modo com a camada já redimensionada). */
export function escalarVetor(v: Vetor, w: number, h: number): Vetor {
  if (Math.abs(v.w - w) < 1e-9 && Math.abs(v.h - h) < 1e-9) return v
  const sx = w / v.w
  const sy = h / v.h
  const n = clonar(v)
  const e = (p: P): P => ({ x: p.x * sx, y: p.y * sy })
  for (const cam of n.caminhos) for (const no of cam.nos) {
    no.x *= sx; no.y *= sy
    if (no.entrada) no.entrada = e(no.entrada)
    if (no.saida) no.saida = e(no.saida)
  }
  n.w = w
  n.h = h
  return n
}

/** Todas as referências de nós (para selecionar tudo, laço etc.). */
export function todosOsNos(v: Vetor): RefNo[] {
  return v.caminhos.flatMap((cam, c) => cam.nos.map((_, i) => ({ c, i })))
}
