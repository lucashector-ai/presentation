/**
 * Material do "Criar com IA" lido de arquivo: o que foi lido (para o resumo mostrado antes de gerar) e como
 * juntar o texto das páginas lidas pela IA ao texto extraído no navegador, na ordem das páginas. Puro.
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
  /** Páginas sem texto extraível (escaneadas, só imagem), ainda não lidas pela IA. */
  semTexto: number[]
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

/** Páginas que a IA vai ler: as sem texto, até o limite do plano. */
export const paginasParaIa = (semTexto: number[], limite: number) => semTexto.slice(0, Math.max(0, limite))

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
