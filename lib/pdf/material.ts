/**
 * Material do "Criar com IA" lido de arquivo: o que foi lido (para o resumo mostrado antes de gerar) e como
 * juntar o texto das páginas lidas pela IA ao texto lido no navegador (extraído do PDF ou reconhecido por OCR),
 * na ordem das páginas. Puro.
 */
export interface MaterialLido {
  arquivo: string
  tipo: 'pdf' | 'docx' | 'texto'
  /** Páginas do PDF (lidas no navegador). */
  paginas: number
  caracteres: number
  titulos: number
  itensLista: number
  tabelas: number
  /** Páginas sem texto: nem o PDF nem o OCR do navegador acharam texto (foto, gráfico, manuscrito) ou o OCR não chegou nelas. */
  semTexto: number[]
  /** Páginas escaneadas lidas no navegador por OCR (grátis). */
  lidasPorOcr?: number[]
  /** Das lidas por OCR, as de leitura incerta (confiança baixa): vale conferir ou ler com a IA. */
  ocrIncerto?: number[]
  /** Páginas lidas pela IA. */
  lidasPelaIa: number[]
  /** Páginas sem texto que estavam em branco (não foram cobradas). */
  emBranco: number[]
  /** O texto passou do teto do material e foi cortado. */
  cortado: boolean
}

/** Junta o texto de cada página (do navegador ou da IA), na ordem, e corta no teto do material. */
export function juntarPaginas(porPagina: string[], max: number): { texto: string; cortado: boolean } {
  const texto = porPagina.map((t) => t.trim()).filter(Boolean).join('\n\n')
  return texto.length > max ? { texto: texto.slice(0, max), cortado: true } : { texto, cortado: false }
}

/**
 * Páginas que a IA pode ler (só quando o usuário pede): primeiro as que continuam sem texto, depois as lidas por
 * OCR (a IA lê melhor gráficos, tabelas complexas e manuscrito), até o limite do plano; em ordem crescente.
 */
export function paginasParaIa(m: Pick<MaterialLido, 'semTexto' | 'lidasPorOcr'>, limite: number): number[] {
  const candidatas = [...new Set([...m.semTexto, ...(m.lidasPorOcr ?? [])])]
  return candidatas.slice(0, Math.max(0, limite)).sort((a, b) => a - b)
}

/**
 * Material depois da leitura pela IA: as páginas `pedidas` saem de "sem texto" e de "lidas por OCR" (as em
 * branco, que nem foram enviadas, também), e as `lidas` passam a contar como lidas pela IA.
 */
export function aposLeituraIa(m: MaterialLido, pedidas: number[], lidas: number[], emBranco: number[]): MaterialLido {
  const fora = (p: number[] = []) => p.filter((n) => !pedidas.includes(n))
  return { ...m, semTexto: fora(m.semTexto), lidasPorOcr: fora(m.lidasPorOcr), ocrIncerto: fora(m.ocrIncerto), lidasPelaIa: [...new Set([...m.lidasPelaIa, ...lidas])].sort((a, b) => a - b), emBranco: [...new Set(emBranco)].sort((a, b) => a - b) }
}

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`

/** "3 páginas · 4.218 caracteres · 2 títulos · 5 itens de lista · 1 tabela". */
export function resumoMaterial(m: Pick<MaterialLido, 'tipo' | 'paginas' | 'caracteres' | 'titulos' | 'itensLista' | 'tabelas'>): string {
  const partes = [
    ...(m.tipo === 'pdf' ? [plural(m.paginas, 'página', 'páginas')] : []),
    `${plural(m.caracteres, 'caractere lido', 'caracteres lidos')}`,
    ...(m.titulos ? [plural(m.titulos, 'título', 'títulos')] : []),
    ...(m.itensLista ? [plural(m.itensLista, 'item de lista', 'itens de lista')] : []),
    ...(m.tabelas ? [plural(m.tabelas, 'tabela', 'tabelas')] : []),
  ]
  return partes.join(' · ')
}

/** "4, 5 e 9" / "4 a 12" (sequência). */
export function listaDePaginas(p: number[]): string {
  if (!p.length) return ''
  if (p.length > 3 && p.every((n, i) => i === 0 || n === p[i - 1]! + 1)) return `${p[0]} a ${p[p.length - 1]}`
  return p.length === 1 ? String(p[0]) : `${p.slice(0, -1).join(', ')} e ${p[p.length - 1]}`
}
