/**
 * Números escritos como gente escreve ("R$ 12.400.000", "R$ 12,4 mi", "91,9%", "+28%", "5.200"): leitura com a
 * escala ("mi", "milhões", "mil"), formatação no mesmo jeito de um valor de referência (prefixo, unidade e casas)
 * e percentuais em pt-BR. Usado pela montagem dos componentes de dados (contas conferidas na tela: gap, % da meta,
 * participação, taxas de passagem, variação) e pelo gerador local. Puro: sem rede, sem DOM.
 */

const ESCALAS: [RegExp, number, string][] = [
  [/^(?:bi|bilh(?:ão|ao|ões|oes))\b/i, 1e9, ' bi'],
  [/^(?:mi|mm|milh(?:ão|ao|ões|oes))\b/i, 1e6, ' mi'],
  [/^(?:mil|k)\b/i, 1e3, ' mil'],
]

export interface Leitura {
  /** Valor em unidades (escala aplicada: "R$ 12,4 mi" → 12.400.000). */
  valor: number
  /** Número como escrito, sem escala ("12,4"). */
  base: number
  prefixo: string
  /** Escala (1, 1e3, 1e6, 1e9) e como ela foi escrita (" mi"). */
  escala: number
  rotuloEscala: string
  /** Sufixo depois da escala ("%", " clientes"). */
  sufixo: string
  casas: number
  sinal: boolean
}

/** Lê o primeiro número de um texto, com prefixo, escala e unidade; null se não houver número. */
export function lerNumero(s: string): Leitura | null {
  const m = /^(.*?)([+\-−]?)(\d[\d.,]*)(.*)$/s.exec(s.trim())
  if (!m) return null
  const [, prefixo0 = '', sinal = '', bruto = '', resto0 = ''] = m
  let n = bruto.replace(/[.,]$/, '')
  // "1.200" (milhar) e "12,4" (decimal) no padrão brasileiro; "3.5" sem milhar é decimal
  if (n.includes(',')) n = n.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{3}(?!\d)/.test(n)) n = n.replace(/\./g, '')
  const base = Number.parseFloat(n)
  if (!Number.isFinite(base)) return null
  const casas = /[,]/.test(bruto) ? (bruto.split(',')[1]?.replace(/\D/g, '').length ?? 0) : /\.\d{1,2}$/.test(bruto) ? bruto.split('.').pop()!.length : 0
  const resto = resto0.replace(/^\s+/, '')
  let escala = 1
  let rotuloEscala = ''
  let sufixo = resto0
  for (const [re, k, rot] of ESCALAS) {
    const e = re.exec(resto)
    if (e) { escala = k; rotuloEscala = rot; sufixo = resto.slice(e[0].length); break }
  }
  const neg = sinal === '-' || sinal === '−'
  return { valor: (neg ? -1 : 1) * base * escala, base: (neg ? -1 : 1) * base, prefixo: prefixo0, escala, rotuloEscala, sufixo, casas, sinal: !!sinal }
}

/** Valor numérico em unidades (null se não houver número). */
export const valorDe = (s: string): number | null => lerNumero(s)?.valor ?? null

const fmt = (n: number, casas: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/**
 * Formata `n` (em unidades) no jeito de `modelo`: mesmo prefixo ("R$ "), escala (" mi") e unidade ("%"), com as
 * casas do modelo (+ `extra`). Sem modelo, número inteiro em pt-BR.
 */
export function formatarComo(n: number, modelo: string, extra = 0): string {
  const l = lerNumero(modelo)
  if (!l) return fmt(n, 0)
  const base = n / l.escala
  const casas = Math.min(3, l.casas + extra)
  // só unidades curtas acompanham o número ("%", "×", "p.p."); palavras ("de receita") ficam com a legenda
  const u = l.sufixo.trim()
  const sufixo = u.startsWith('%') ? '%' : /^(x|×)(?![a-z])/i.test(u) ? '×' : /^p\.?p\b/i.test(u) ? ' p.p.' : ''
  return `${n < 0 ? '−' : ''}${l.prefixo.replace(/[+\-−]\s*$/, '')}${fmt(Math.abs(base), casas)}${l.rotuloEscala}${sufixo}`
}

/** Percentual em pt-BR com uma casa, sem ",0" ("41,1%", "28%"); `sinal` põe "+" nos positivos. */
export function formatarPct(p: number, sinal = false): string {
  const r = Math.round(p * 10) / 10
  const s = fmt(Math.abs(r), Number.isInteger(r) ? 0 : 1)
  return `${r < 0 ? '−' : sinal && r > 0 ? '+' : ''}${s}%`
}

/**
 * Forma compacta sem perder informação: "R$ 12.400.000" → "R$ 12,4 mi", "R$ 1.820.000" → "R$ 1,82 mi"; valores
 * abaixo de 1 milhão (ou que perderiam dígitos) ficam como estão.
 */
export function compactar(s: string): string {
  const l = lerNumero(s)
  if (!l || l.escala !== 1 || Math.abs(l.valor) < 1e6) return s.trim()
  const escala = Math.abs(l.valor) >= 1e9 ? 1e9 : 1e6
  const base = l.valor / escala
  const casas = [0, 1, 2, 3].find((c) => Math.abs(Number(base.toFixed(c)) - base) < 1e-9)
  if (casas === undefined) return s.trim()
  const sufixo = l.sufixo.replace(/[.,;:]+$/, '').trimEnd()
  return `${l.prefixo}${fmt(base, casas)}${escala === 1e9 ? ' bi' : ' mi'}${sufixo}`
}
