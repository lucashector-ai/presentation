/**
 * Guias inteligentes (smart guides), encaixe e medidas — modelo do Figma. Puro e testável.
 *
 * - Encaixe de bordas e centros na tela (bordas + linhas centrais) e nas outras camadas visíveis
 * - Espaçamento igual (indicadores rosa "=" quando os vãos batem)
 * - X e Y independentes; limiar em pixels de TELA (converta com `limiarEmCena`)
 * - Grade opcional: com grade ligada, posição e tamanho arredondam para a grade
 * - Resultado sempre em pixels inteiros
 * - Medidas (linhas vermelhas com números): distâncias entre caixas (Alt) e ao longo das guias
 */
import { redimensionar, type Alca, type Retangulo, type Tamanho } from '@/lib/scene/transform'
import type { GradeEncaixe } from '@/lib/scene/guias'

export interface Guia {
  /** 'v' = linha vertical em x; 'h' = linha horizontal em y. */
  eixo: 'v' | 'h'
  pos: number
  /** extensão da linha (de/até no outro eixo) */
  de: number
  ate: number
  /** Fração da tela ("1/2", "1/3"…) ou coluna da grade de layout, mostrada numa etiqueta na guia. */
  rotulo?: string
}

/** Alvos extras por eixo (frações da tela, colunas da grade de layout), com rótulo. */
export interface AlvosExtras { x: readonly { v: number; rotulo: string }[]; y: readonly { v: number; rotulo: string }[] }

/** Segmento medido. eixo 'h' = segmento horizontal (mede distância em x) na altura `pos`. */
export interface Medida {
  eixo: 'v' | 'h'
  pos: number
  de: number
  ate: number
  valor: number
}

export interface ResultadoEncaixe {
  x: number
  y: number
  guias: Guia[]
  /** Vãos iguais (rosa). */
  espacos: Medida[]
  /** Distâncias ao longo das guias (vermelho). */
  medidas: Medida[]
}

export interface OpcoesEncaixe {
  /** Passo da grade (px da cena). 0/ausente = sem grade. */
  grade?: number
  /** Desliga o encaixe de espaçamento igual. */
  semEspacamento?: boolean
  /** Frações da tela e bordas das colunas/linhas das guias de layout (lib/editor/preencher.ts, lib/scene/guias.ts). */
  extras?: AlvosExtras
  /**
   * Grades das guias de layout visíveis: as bordas da caixa encaixam na linha mais próxima (dentro do limiar),
   * sem desenhar guia; guias inteligentes empatadas ganham. Diferente de `grade`, não arredonda tudo.
   */
  grades?: readonly GradeEncaixe[]
}

/** Limiar padrão de encaixe, em pixels de tela (independe do zoom). */
export const LIMIAR_TELA = 5

/** Converte um limiar em px de tela para px da cena no zoom atual. */
export function limiarEmCena(pxTela: number, escala: number): number {
  return pxTela / Math.max(escala, 1e-6)
}

const pontosX = (r: Retangulo) => [r.x, r.x + r.width / 2, r.x + r.width]
const pontosY = (r: Retangulo) => [r.y, r.y + r.height / 2, r.y + r.height]
const dir = (r: Retangulo) => r.x + r.width
const base = (r: Retangulo) => r.y + r.height
const EPS = 0.5

interface Alvo { v: number; ref: Retangulo | null; rotulo?: string }

function alvos(outros: readonly Retangulo[], cena: Tamanho, eixo: 'x' | 'y', extras?: AlvosExtras): Alvo[] {
  const tela = { x: 0, y: 0, width: cena.width, height: cena.height }
  const pts = eixo === 'x' ? pontosX : pontosY
  // frações vêm por último: em empate, bordas de camadas e da tela ganham
  return [...pts(tela).map((v) => ({ v, ref: null })), ...outros.flatMap((o) => pts(o).map((v) => ({ v, ref: o }))), ...(extras?.[eixo] ?? []).map((a) => ({ v: a.v, ref: null, rotulo: a.rotulo }))]
}

/** Linha de grade mais próxima das bordas `pontos` no eixo, entre as grades cuja área contém `centro`. */
function naGradeGuia(pontos: number[], grades: readonly GradeEncaixe[] | undefined, eixo: 'x' | 'y', centro: { x: number; y: number }, limiar: number): { d: number; ajuste: number } | null {
  let melhor: { d: number; ajuste: number } | null = null
  for (const g of grades ?? []) {
    const a = g.area
    if (centro.x < a.x || centro.x > a.x + a.width || centro.y < a.y || centro.y > a.y + a.height) continue
    const o = eixo === 'x' ? g.x0 : g.y0
    for (const p of pontos) {
      const v = o + Math.round((p - o) / g.passo) * g.passo
      const d = Math.abs(v - p)
      if (d <= limiar && (!melhor || d < melhor.d - 1e-9)) melhor = { d, ajuste: v - p }
    }
  }
  return melhor
}

function maisProximo(pontos: number[], lista: Alvo[], limiar: number): { d: number; ajuste: number } | null {
  let melhor: { d: number; ajuste: number } | null = null
  for (const p of pontos) for (const a of lista) {
    const d = Math.abs(a.v - p)
    if (d <= limiar && (!melhor || d < melhor.d - 1e-9)) melhor = { d, ajuste: a.v - p }
  }
  return melhor
}

const sobrepoeY = (a: Retangulo, b: Retangulo) => Math.min(base(a), base(b)) - Math.max(a.y, b.y) > 0
const sobrepoeX = (a: Retangulo, b: Retangulo) => Math.min(dir(a), dir(b)) - Math.max(a.x, b.x) > 0

/** Candidatos de espaçamento igual num eixo (posição da borda inicial da caixa). */
function candidatosEspaco(m: Retangulo, outros: readonly Retangulo[], eixo: 'x' | 'y'): number[] {
  const H = eixo === 'x'
  const ini = (r: Retangulo) => (H ? r.x : r.y)
  const fim = (r: Retangulo) => (H ? dir(r) : base(r))
  const tam = H ? m.width : m.height
  const linha = outros.filter((o) => (H ? sobrepoeY(o, m) : sobrepoeX(o, m))).sort((a, b) => ini(a) - ini(b))
  const centro = ini(m) + tam / 2
  const esq = linha.filter((o) => fim(o) <= centro && ini(o) + (fim(o) - ini(o)) / 2 < centro).sort((a, b) => fim(b) - fim(a))[0]
  const dirV = linha.filter((o) => ini(o) >= centro).sort((a, b) => ini(a) - ini(b))[0]
  const vaos: number[] = []
  for (let i = 1; i < linha.length; i++) {
    const g = ini(linha[i]!) - fim(linha[i - 1]!)
    if (g > 0) vaos.push(g)
  }
  const c: number[] = []
  if (esq && dirV && ini(dirV) - fim(esq) >= tam) c.push((fim(esq) + ini(dirV) - tam) / 2)
  for (const g of vaos) {
    if (esq) c.push(fim(esq) + g)
    if (dirV) c.push(ini(dirV) - g - tam)
  }
  return c
}

/**
 * Encaixa uma caixa em movimento.
 * @param movendo caixa na posição proposta
 * @param outros caixas de referência (outras camadas visíveis)
 * @param cena tamanho da tela (bordas e centro também são alvos)
 * @param limiar distância máxima de encaixe em px da CENA (use `limiarEmCena(LIMIAR_TELA, zoom)`)
 */
export function encaixar(movendo: Retangulo, outros: readonly Retangulo[], cena: Tamanho, limiar: number, opcoes: OpcoesEncaixe = {}): ResultadoEncaixe {
  const grade = opcoes.grade && opcoes.grade > 0 ? opcoes.grade : 0
  const ajusteEixo = (eixo: 'x' | 'y'): number => {
    const p0 = eixo === 'x' ? movendo.x : movendo.y
    if (grade) return Math.round(p0 / grade) * grade - p0
    const borda = maisProximo(eixo === 'x' ? pontosX(movendo) : pontosY(movendo), alvos(outros, cena, eixo, opcoes.extras), limiar)
    let melhor = borda ? { d: borda.d, ajuste: borda.ajuste } : null
    if (!opcoes.semEspacamento) {
      for (const v of candidatosEspaco(movendo, outros, eixo)) {
        const d = Math.abs(v - p0)
        if (d <= limiar && (!melhor || d < melhor.d - 1e-9)) melhor = { d, ajuste: v - p0 }
      }
    }
    // grade das guias de layout: só as bordas (como no Figma), e perde para guias e vãos empatados
    const centro = { x: movendo.x + movendo.width / 2, y: movendo.y + movendo.height / 2 }
    const naGrade = naGradeGuia(eixo === 'x' ? [movendo.x, dir(movendo)] : [movendo.y, base(movendo)], opcoes.grades, eixo, centro, limiar)
    if (naGrade && (!melhor || naGrade.d < melhor.d - 1e-9)) melhor = naGrade
    return melhor?.ajuste ?? 0
  }
  const x = Math.round(movendo.x + ajusteEixo('x'))
  const y = Math.round(movendo.y + ajusteEixo('y'))
  const final = { ...movendo, x, y }
  return { x, y, ...guiasDaCaixa(final, outros, cena, opcoes.extras) }
}

/**
 * Guias, vãos iguais e medidas para uma caixa já posicionada (sem mover).
 * Usado depois do encaixe e ao deslocar com as setas.
 */
export function guiasDaCaixa(final: Retangulo, outros: readonly Retangulo[], cena: Tamanho, extras?: AlvosExtras): Omit<ResultadoEncaixe, 'x' | 'y'> {
  const guias: Guia[] = []
  const medidas: Medida[] = []
  for (const eixo of ['x', 'y'] as const) {
    const pts = eixo === 'x' ? pontosX(final) : pontosY(final)
    const lista = alvos(outros, cena, eixo, extras)
    const feitos = new Set<number>()
    for (const p of pts) {
      const iguais = lista.filter((a) => Math.abs(a.v - p) < EPS)
      if (!iguais.length || feitos.has(Math.round(p * 2))) continue
      feitos.add(Math.round(p * 2))
      const refs = [...new Set(iguais.map((a) => a.ref).filter((r): r is Retangulo => !!r))]
      const rotulo = iguais.find((a) => a.rotulo)?.rotulo || undefined
      // fração da tela: a guia atravessa a tela inteira e leva a etiqueta (1/2, 1/3…)
      const soTela = refs.length === 0 || !!rotulo
      if (eixo === 'x') {
        const ys = [final.y, base(final), ...refs.flatMap((r) => [r.y, base(r)])]
        guias.push({ eixo: 'v', pos: p, de: soTela ? 0 : Math.min(...ys), ate: soTela ? cena.height : Math.max(...ys), ...(rotulo ? { rotulo } : {}) })
      } else {
        const xs = [final.x, dir(final), ...refs.flatMap((r) => [r.x, dir(r)])]
        guias.push({ eixo: 'h', pos: p, de: soTela ? 0 : Math.min(...xs), ate: soTela ? cena.width : Math.max(...xs), ...(rotulo ? { rotulo } : {}) })
      }
      // distância até a camada alinhada mais próxima, ao longo da guia
      const m = medidaAoLongo(final, refs, eixo, p)
      if (m && !medidas.some((x) => x.eixo === m.eixo && Math.abs(x.de - m.de) < EPS && Math.abs(x.ate - m.ate) < EPS)) medidas.push(m)
    }
  }
  const espacos = [...vaosIguais(final, outros, 'x'), ...vaosIguais(final, outros, 'y')]
  // com vãos iguais no eixo, o rosa já mostra a distância (como no Figma)
  return { guias, espacos, medidas: medidas.filter((m) => !espacos.some((e) => e.eixo === m.eixo)) }
}

function medidaAoLongo(m: Retangulo, refs: Retangulo[], eixo: 'x' | 'y', pos: number): Medida | null {
  let melhor: Medida | null = null
  for (const r of refs) {
    if (eixo === 'x') {
      // guia vertical: mede a distância vertical
      const [de, ate] = base(r) <= m.y ? [base(r), m.y] : base(m) <= r.y ? [base(m), r.y] : [0, 0]
      if (ate - de > 0 && (!melhor || ate - de < melhor.valor)) melhor = { eixo: 'v', pos, de, ate, valor: Math.round(ate - de) }
    } else {
      const [de, ate] = dir(r) <= m.x ? [dir(r), m.x] : dir(m) <= r.x ? [dir(m), r.x] : [0, 0]
      if (ate - de > 0 && (!melhor || ate - de < melhor.valor)) melhor = { eixo: 'h', pos, de, ate, valor: Math.round(ate - de) }
    }
  }
  return melhor
}

/** Vãos iguais aos vizinhos imediatos da caixa (indicadores rosa). */
export function vaosIguais(m: Retangulo, outros: readonly Retangulo[], eixo: 'x' | 'y'): Medida[] {
  const H = eixo === 'x'
  const ini = (r: Retangulo) => (H ? r.x : r.y)
  const fim = (r: Retangulo) => (H ? dir(r) : base(r))
  const linha = [...outros.filter((o) => (H ? sobrepoeY(o, m) : sobrepoeX(o, m))), m].sort((a, b) => ini(a) - ini(b))
  const pares: { a: Retangulo; b: Retangulo; g: number }[] = []
  for (let i = 1; i < linha.length; i++) {
    const a = linha[i - 1]!
    const b = linha[i]!
    const g = ini(b) - fim(a)
    if (g > 0) pares.push({ a, b, g })
  }
  const vizinhos = pares.filter((p) => p.a === m || p.b === m)
  const r: Medida[] = []
  for (const v of vizinhos) {
    const iguais = pares.filter((p) => Math.abs(p.g - v.g) < EPS)
    if (iguais.length < 2) continue
    for (const p of iguais) {
      if (r.some((x) => Math.abs(x.de - fim(p.a)) < EPS && Math.abs(x.ate - ini(p.b)) < EPS)) continue
      const sob0 = H ? Math.max(p.a.y, p.b.y) : Math.max(p.a.x, p.b.x)
      const sob1 = H ? Math.min(base(p.a), base(p.b)) : Math.min(dir(p.a), dir(p.b))
      r.push({ eixo: H ? 'h' : 'v', pos: (sob0 + sob1) / 2, de: fim(p.a), ate: ini(p.b), valor: Math.round(p.g) })
    }
  }
  return r
}

export interface OpcoesRedimensionar extends OpcoesEncaixe {
  /** Shift: mantém a proporção. */
  proporcional?: boolean
  /** Alt: redimensiona a partir do centro. */
  doCentro?: boolean
  /** Ctrl/⌘: sem encaixe (a grade continua valendo). */
  semEncaixe?: boolean
}

/**
 * Redimensiona pela alça com encaixe das bordas que se movem (todas as 8 alças),
 * respeitando Shift (proporção) e Alt (a partir do centro). Resultado em pixels inteiros.
 */
export function redimensionarComEncaixe(
  inicial: Retangulo, alca: Alca, dx: number, dy: number,
  outros: readonly Retangulo[], cena: Tamanho, limiar: number, opcoes: OpcoesRedimensionar = {}
): { caixa: Retangulo } & Omit<ResultadoEncaixe, 'x' | 'y'> {
  const prop = !!opcoes.proporcional
  const centro = !!opcoes.doCentro
  const grade = opcoes.grade && opcoes.grade > 0 ? opcoes.grade : 0
  const r0 = redimensionar(inicial, alca, dx, dy, prop, centro)
  const moveX = alca.includes('e') || alca.includes('w')
  const moveY = alca.includes('n') || alca.includes('s')
  const borda = (r: Retangulo, eixo: 'x' | 'y') => (eixo === 'x' ? (alca.includes('e') ? dir(r) : r.x) : alca.includes('s') ? base(r) : r.y)
  const encaixeDe = (eixo: 'x' | 'y'): { d: number; v: number } | null => {
    const b = borda(r0, eixo)
    if (grade) { const v = Math.round(b / grade) * grade; return { d: Math.abs(v - b), v } }
    if (opcoes.semEncaixe) return null
    const m = maisProximo([b], alvos(outros, cena, eixo, opcoes.extras), limiar)
    const naGrade = naGradeGuia([b], opcoes.grades, eixo, { x: r0.x + r0.width / 2, y: r0.y + r0.height / 2 }, limiar)
    const melhor = naGrade && (!m || naGrade.d < m.d - 1e-9) ? naGrade : m
    return melhor ? { d: melhor.d, v: b + melhor.ajuste } : null
  }
  const sx = moveX ? encaixeDe('x') : null
  const sy = moveY ? encaixeDe('y') : null
  let r = r0
  if (prop) {
    const escolha = sx && (!sy || sx.d <= sy.d) ? ({ eixo: 'x', v: sx.v } as const) : sy ? ({ eixo: 'y', v: sy.v } as const) : null
    if (escolha) r = aplicarBorda(inicial, alca, r0, escolha.eixo, escolha.v, true, centro)
  } else {
    if (sx) r = aplicarBorda(inicial, alca, r, 'x', sx.v, false, centro)
    if (sy) r = aplicarBorda(inicial, alca, r, 'y', sy.v, false, centro)
  }
  const x = Math.round(r.x)
  const y = Math.round(r.y)
  const caixa = { x, y, width: Math.max(1, Math.round(r.x + r.width) - x), height: Math.max(1, Math.round(r.y + r.height) - y) }
  return { caixa, ...(opcoes.semEncaixe ? { guias: [], espacos: [], medidas: [] } : guiasDaCaixa(caixa, outros, cena, opcoes.extras)) }
}

/** Reposiciona a borda arrastada num eixo (e deriva o outro eixo se proporcional). */
function aplicarBorda(ini: Retangulo, alca: Alca, r: Retangulo, eixo: 'x' | 'y', v: number, prop: boolean, centro: boolean): Retangulo {
  const razao = ini.width / ini.height
  const cx = ini.x + ini.width / 2
  const cy = ini.y + ini.height / 2
  if (eixo === 'x') {
    const e = alca.includes('e')
    let a = e ? (centro ? 2 * cx - v : ini.x) : v
    let b = e ? v : centro ? 2 * cx - v : dir(ini)
    if (a > b) [a, b] = [b, a]
    const w = Math.max(1, b - a)
    if (!prop) return { ...r, x: a, width: w }
    const h = w / razao
    const y = centro ? cy - h / 2 : alca.includes('n') ? base(ini) - h : alca.includes('s') ? ini.y : r.y
    return { x: a, y, width: w, height: h }
  }
  const s = alca.includes('s')
  let a = s ? (centro ? 2 * cy - v : ini.y) : v
  let b = s ? v : centro ? 2 * cy - v : base(ini)
  if (a > b) [a, b] = [b, a]
  const h = Math.max(1, b - a)
  if (!prop) return { ...r, y: a, height: h }
  const w = h * razao
  const x = centro ? cx - w / 2 : alca.includes('w') ? dir(ini) - w : alca.includes('e') ? ini.x : r.x
  return { x, y: a, width: w, height: h }
}

/**
 * Distâncias entre a seleção `a` e a camada `b` sob o cursor (Alt), como no Figma:
 * uma dentro da outra → 4 distâncias até as bordas; separadas → vãos horizontal/vertical.
 */
export function medirDistancias(a: Retangulo, b: Retangulo): Medida[] {
  const r: Medida[] = []
  const dentro = (i: Retangulo, o: Retangulo) => i.x >= o.x && i.y >= o.y && dir(i) <= dir(o) && base(i) <= base(o)
  const quatro = (i: Retangulo, o: Retangulo) => {
    const cy = i.y + i.height / 2
    const cx = i.x + i.width / 2
    if (i.x - o.x > 0) r.push({ eixo: 'h', pos: cy, de: o.x, ate: i.x, valor: Math.round(i.x - o.x) })
    if (dir(o) - dir(i) > 0) r.push({ eixo: 'h', pos: cy, de: dir(i), ate: dir(o), valor: Math.round(dir(o) - dir(i)) })
    if (i.y - o.y > 0) r.push({ eixo: 'v', pos: cx, de: o.y, ate: i.y, valor: Math.round(i.y - o.y) })
    if (base(o) - base(i) > 0) r.push({ eixo: 'v', pos: cx, de: base(i), ate: base(o), valor: Math.round(base(o) - base(i)) })
  }
  if (dentro(a, b)) { quatro(a, b); return r }
  if (dentro(b, a)) { quatro(b, a); return r }
  // horizontal
  const meioY = sobrepoeY(a, b) ? (Math.max(a.y, b.y) + Math.min(base(a), base(b))) / 2 : a.y + a.height / 2
  if (dir(a) <= b.x) r.push({ eixo: 'h', pos: meioY, de: dir(a), ate: b.x, valor: Math.round(b.x - dir(a)) })
  else if (dir(b) <= a.x) r.push({ eixo: 'h', pos: meioY, de: dir(b), ate: a.x, valor: Math.round(a.x - dir(b)) })
  // vertical
  const meioX = sobrepoeX(a, b) ? (Math.max(a.x, b.x) + Math.min(dir(a), dir(b))) / 2 : a.x + a.width / 2
  if (base(a) <= b.y) r.push({ eixo: 'v', pos: meioX, de: base(a), ate: b.y, valor: Math.round(b.y - base(a)) })
  else if (base(b) <= a.y) r.push({ eixo: 'v', pos: meioX, de: base(b), ate: a.y, valor: Math.round(a.y - base(b)) })
  // sobrepostas: diferença entre bordas equivalentes
  if (!r.length) {
    if (a.x !== b.x) r.push({ eixo: 'h', pos: meioY, de: Math.min(a.x, b.x), ate: Math.max(a.x, b.x), valor: Math.round(Math.abs(a.x - b.x)) })
    if (a.y !== b.y) r.push({ eixo: 'v', pos: meioX, de: Math.min(a.y, b.y), ate: Math.max(a.y, b.y), valor: Math.round(Math.abs(a.y - b.y)) })
  }
  return r
}

/** Passo das setas com Shift (regra do 8: um passo da grade de 8). */
export const PASSO_GRANDE = 8

/** Próxima posição ao deslocar com as setas: 1 px (Shift = 8), ou a próxima linha da grade. */
export function deslocarComGrade(v: number, sentido: -1 | 1, passo: number, grade: number): number {
  if (!grade) return Math.round(v) + sentido * passo
  const linhas = passo > 1 ? Math.max(1, Math.round(passo / grade)) : 1
  const alvo = sentido > 0 ? Math.floor(v / grade + 1e-9) + linhas : Math.ceil(v / grade - 1e-9) - linhas
  return alvo * grade
}

/** Distribui caixas com espaçamento igual no eixo (precisa de 3+). Mantém as extremidades. */
export function distribuir<T extends Retangulo & { id: string }>(caixas: T[], eixo: 'h' | 'v'): T[] {
  if (caixas.length < 3) return caixas
  const ord = [...caixas].sort((a, b) => (eixo === 'h' ? a.x - b.x : a.y - b.y))
  const primeiro = ord[0]!
  const ultimo = ord[ord.length - 1]!
  const inicio = eixo === 'h' ? primeiro.x : primeiro.y
  const fim = eixo === 'h' ? ultimo.x + ultimo.width : ultimo.y + ultimo.height
  const ocupado = ord.reduce((s, c) => s + (eixo === 'h' ? c.width : c.height), 0)
  const espaco = (fim - inicio - ocupado) / (ord.length - 1)
  let cursor = inicio
  const pos = new Map<string, number>()
  for (const c of ord) {
    pos.set(c.id, cursor)
    cursor += (eixo === 'h' ? c.width : c.height) + espaco
  }
  return caixas.map((c) => (eixo === 'h' ? { ...c, x: pos.get(c.id)! } : { ...c, y: pos.get(c.id)! }))
}

/** Retângulos que intersectam a seleção por área (marquee). */
export function intersecta(a: Retangulo, b: Retangulo): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Ângulo (graus) do centro ao ponteiro, com encaixe opcional a cada 15°. */
export function anguloRotacao(centro: { x: number; y: number }, ponteiro: { x: number; y: number }, encaixe15: boolean): number {
  const a = (Math.atan2(ponteiro.y - centro.y, ponteiro.x - centro.x) * 180) / Math.PI + 90
  let n = ((a + 540) % 360) - 180
  if (encaixe15) n = Math.round(n / 15) * 15
  return Math.round(n * 10) / 10
}
