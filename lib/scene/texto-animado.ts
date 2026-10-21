/**
 * Lógica pura das animações de texto profissionais: ordem das partes, tempos com intervalo ajustável,
 * contador numérico (mantém prefixo/sufixo e o formato brasileiro) e curvas cúbicas avaliadas em JS
 * (contador e decodificar leem o relógio de uma animação CSS e aplicam a curva da camada).
 */
import type { Animacao } from './schema'

export type OrdemPartes = NonNullable<Animacao['order']>

/** Hash estável de um texto (a ordem "aleatória" é a mesma no editor, no Pré-visualizar e no link público). */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Posição de cada parte na sequência (0 = primeira a animar). Partes empatadas (centro/bordas) entram juntas. */
export function ordemDasPartes(n: number, ordem: OrdemPartes = 'start', semente = ''): number[] {
  const idx = Array.from({ length: n }, (_, i) => i)
  if (ordem === 'end') return idx.map((i) => n - 1 - i)
  if (ordem === 'center' || ordem === 'edges') {
    const meio = (n - 1) / 2
    const dist = idx.map((i) => Math.floor(Math.abs(i - meio)))
    const max = Math.max(0, ...dist)
    return ordem === 'center' ? dist : dist.map((d) => max - d)
  }
  if (ordem === 'random') {
    // Fisher–Yates com gerador determinístico (mulberry32)
    let a = hash(semente) || 1
    const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const perm = [...idx]
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j]!, perm[i]!] }
    const pos = new Array<number>(n)
    perm.forEach((parte, k) => { pos[parte] = k })
    return pos
  }
  return idx
}

/** Número de "passos" de uma ordem (no centro, partes simétricas dividem o passo). */
export function passosDaOrdem(posicoes: number[]): number {
  return posicoes.length ? Math.max(...posicoes) + 1 : 0
}

// ---------- máquina de escrever: cursor único ----------

/** Quanto tempo o cursor pisca no fim (4 piscadas de 1 s, como antes). */
export const PISCADAS_CURSOR = 4

/**
 * Keyframes do cursor da máquina de escrever: UM elemento que salta de letra em letra (transform, na GPU) e
 * pisca no fim. Antes cada letra tinha a sua animação de cursor (box-shadow, fora da GPU): num parágrafo eram
 * ~100 animações esperando o seu atraso, revisadas pelo navegador a cada quadro.
 * `pontos[i]`: canto superior direito da letra i (px, no espaço do cursor); `inicios[i]`: quando a letra i
 * aparece (ms desde o início da animação); `passo`: tempo entre letras (o cursor fica nesse tempo na letra).
 */
export function keyframesCursor(nome: string, pontos: { x: number; y: number }[], inicios: number[], passo: number): { css: string; duracao: number } {
  const n = Math.min(pontos.length, inicios.length)
  const naLetra = Math.max(16, passo)
  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => inicios[a]! - inicios[b]! || a - b)
  const ultimo = n ? inicios[ordem[n - 1]!]! : 0
  const fimDigitacao = ultimo + naLetra
  const duracao = Math.max(1, Math.round(fimDigitacao + PISCADAS_CURSOR * 1000))
  const pct = (t: number) => `${Math.round((Math.min(duracao, Math.max(0, t)) / duracao) * 1e6) / 1e4}%`
  const quadros = new Map<string, string>()
  const quadro = (t: number, x: number, y: number, opacidade: number) => quadros.set(pct(t), `transform: translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px); opacity: ${opacidade}; animation-timing-function: step-end`)
  const p0 = n ? pontos[ordem[0]!]! : { x: 0, y: 0 }
  quadro(0, p0.x, p0.y, n && inicios[ordem[0]!]! <= 0 ? 1 : 0)
  for (const i of ordem) quadro(inicios[i]!, pontos[i]!.x, pontos[i]!.y, 1)
  const pf = n ? pontos[ordem[n - 1]!]! : p0
  for (let k = 0; k < PISCADAS_CURSOR; k++) {
    quadro(fimDigitacao + k * 1000 + 500, pf.x, pf.y, 0)
    if (k < PISCADAS_CURSOR - 1) quadro(fimDigitacao + (k + 1) * 1000, pf.x, pf.y, 1)
  }
  quadro(duracao, pf.x, pf.y, 0)
  return { css: `@keyframes ${nome} { ${[...quadros.entries()].map(([p, d]) => `${p} { ${d} }`).join(' ')} }`, duracao }
}

// ---------- letra por letra leve ----------

/** Um quadro a 60 Hz, em ms. */
export const QUADRO_MS = 1000 / 60
/** Acima disso, letra por letra anima por palavra (cada parte animada é um elemento composto na GPU). */
export const LIMITE_LETRAS = 150
/** Com desfoque, o limite é menor: o desfoque não roda na GPU e é repintado a cada quadro, parte por parte. */
export const LIMITE_LETRAS_DESFOQUE = 40

/**
 * Letra por letra (Letras, Cascata) anima por PALAVRA quando o olho não veria a diferença ou o custo não
 * compensa — o tempo de cada palavra é o da sua primeira letra, então o ritmo do texto não muda:
 * - várias letras começariam no mesmo quadro (intervalo < 1 quadro) e as letras só deslizam (sem giro/escala
 *   próprios, que numa palavra inteira girariam em volta de outro centro) e a ordem não é aleatória;
 * - o texto é longo (mais de LIMITE_LETRAS letras), em qualquer efeito;
 * - cada letra teria desfoque e há mais de LIMITE_LETRAS_DESFOQUE letras.
 * Máquina de escrever e Decodificar continuam por letra (não usam camadas da GPU por letra).
 */
export function agruparLetras({ total, passo, ordem = 'start', giraOuEscala = false, desfoque = false }: { total: number; passo: number; ordem?: OrdemPartes; giraOuEscala?: boolean; desfoque?: boolean }): boolean {
  if (total > LIMITE_LETRAS) return true
  if (desfoque && total > LIMITE_LETRAS_DESFOQUE) return true
  return passo < QUADRO_MS && !giraOuEscala && ordem !== 'random' && total > 1
}

// ---------- contador ----------

export interface NumeroNoTexto {
  prefixo: string
  sufixo: string
  valor: number
  casas: number
  decimal: ',' | '.'
  milhar: '.' | ',' | ' ' | ''
}

/**
 * Acha o primeiro número do texto ("38%", "R$ 2,4 mi", "1.200 lojas", "+12", "3.5x").
 * Convenção brasileira: vírgula decimal, ponto de milhar; "3.5" (um grupo com 1–2 dígitos) vira decimal com ponto.
 */
export function analisarNumero(texto: string): NumeroNoTexto | null {
  const m = /(\d{1,3}(?:([.,\s ])\d{3})+(?:([.,])\d+)?|\d+(?:([.,])\d+)?)/.exec(texto)
  if (!m || m.index === undefined) return null
  const bruto = m[0]
  let milhar: NumeroNoTexto['milhar'] = ''
  let decimal: NumeroNoTexto['decimal'] = ','
  let inteiro = bruto
  let fracao = ''
  if (m[2]) {
    milhar = (m[2] === ' ' ? ' ' : m[2]) as NumeroNoTexto['milhar']
    const sepDec = m[3]
    if (sepDec && sepDec !== m[2]) {
      decimal = sepDec as ',' | '.'
      ;[inteiro, fracao] = [bruto.slice(0, bruto.lastIndexOf(sepDec)), bruto.slice(bruto.lastIndexOf(sepDec) + 1)]
    }
    inteiro = inteiro.split(m[2]).join('')
  } else if (m[4]) {
    decimal = m[4] as ',' | '.'
    ;[inteiro, fracao] = bruto.split(m[4]) as [string, string]
  }
  const valor = Number(`${inteiro}${fracao ? `.${fracao}` : ''}`)
  if (!Number.isFinite(valor)) return null
  return { prefixo: texto.slice(0, m.index), sufixo: texto.slice(m.index + bruto.length), valor, casas: fracao.length, decimal, milhar }
}

/** Texto com o número trocado por `v` no mesmo formato (casas, separadores, prefixo e sufixo). */
export function formatarNumero(n: NumeroNoTexto, v: number): string {
  const fixo = Math.abs(v).toFixed(n.casas)
  const [int, frac] = fixo.split('.') as [string, string | undefined]
  const comMilhar = n.milhar ? int.replace(/\B(?=(\d{3})+(?!\d))/g, n.milhar) : int
  return `${n.prefixo}${v < 0 ? '-' : ''}${comMilhar}${frac ? `${n.decimal}${frac}` : ''}${n.sufixo}`
}

// ---------- curvas ----------

/** y(x) de uma cubic-bezier CSS (x1, y1, x2, y2), por Newton + bisseção. */
export function curvaBezier(x: number, [x1, y1, x2, y2]: readonly [number, number, number, number]): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
  let t = x
  for (let i = 0; i < 8; i++) {
    const d = (bx(t + 1e-4) - bx(t - 1e-4)) / 2e-4
    if (Math.abs(d) < 1e-6) break
    t -= (bx(t) - x) / d
  }
  if (t < 0 || t > 1 || Math.abs(bx(t) - x) > 1e-4) {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t }
  }
  return by(t)
}

// ---------- linhas ----------

/** Agrupa palavras (com o topo medido de cada uma) em linhas renderizadas. Topos a até 2 px contam como a mesma linha. */
export function agruparLinhas(topos: number[]): number[][] {
  const linhas: number[][] = []
  let atual: number | null = null
  topos.forEach((t, i) => {
    if (atual === null || Math.abs(t - atual) > 2) { linhas.push([i]); atual = t }
    else linhas[linhas.length - 1]!.push(i)
  })
  return linhas
}
