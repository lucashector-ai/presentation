/**
 * OCR das páginas sem texto extraível (escaneadas, fotografadas, só imagem): reconhecido no próprio navegador
 * pelo tesseract.js (português + inglês), sem API e sem créditos. Quem renderiza a página e roda o Tesseract é
 * `lib/pdf/navegador.ts`; este módulo é puro (sem DOM): converte o resultado do Tesseract (saída "blocks": linhas
 * com caixa, linha de base e altura, palavras com caixa e confiança) em trechos posicionados (`ItemPdf`), em
 * pontos da página. Assim a página reconhecida passa pela mesma normalização do texto extraído do PDF
 * (`estruturarPdf`: ordem de leitura, títulos, listas, tabelas, cabeçalhos e rodapés).
 */
import { estruturarPdf, type ItemPdf, type PaginaPdf, type ResultadoTexto } from './texto'

export const OCR = {
  /** Dados de idioma (tessdata_best em inteiros, só LSTM), servidos como arquivos estáticos do app. */
  idiomas: ['por', 'eng'] as const,
  /** Páginas reconhecidas por leitura (cada uma leva alguns segundos no navegador). */
  maxPaginas: 30,
  /** Lado maior da imagem da página para o OCR (≈ 215 dpi numa A4: letra de corpo de 11 pt com ~33 px). */
  ladoMaxPx: 2500,
  /** Ampliação máxima da página (página pequena não vira uma imagem enorme). */
  escalaMax: 4,
  /** Linhas com confiança média abaixo disto são ruído (foto, textura, carimbo) e ficam de fora. */
  confiancaMinLinha: 45,
  /** Palavra solta com confiança abaixo disto fica de fora. */
  confiancaMinPalavra: 20,
  /** Abaixo disto (confiança média da página) o texto reconhecido é incerto: vale conferir ou ler com a IA. */
  confiancaBoa: 75,
} as const

export interface CaixaOcr { x0: number; y0: number; x1: number; y1: number }
export interface PalavraOcr { text: string; confidence: number; bbox: CaixaOcr }
export interface LinhaOcr {
  text?: string
  confidence: number
  bbox: CaixaOcr
  baseline?: (CaixaOcr & { has_baseline?: boolean }) | null
  rowAttributes?: { rowHeight?: number; ascenders?: number; descenders?: number } | null
  words: PalavraOcr[]
}
export interface ParagrafoOcr { lines: LinhaOcr[] }
export interface BlocoOcr { paragraphs: ParagrafoOcr[] }

export interface PaginaOcr {
  /** Página no formato do texto extraído (`ocr: true`), pronta para `estruturarPdf`. */
  pagina: PaginaPdf
  /** Confiança média do Tesseract nas palavras aproveitadas (0–100), ponderada pelo tamanho; 0 sem palavras. */
  confianca: number
  palavras: number
}

/**
 * `rowHeight` do Tesseract ÷ tamanho da fonte. Medido com fonte sem serifa de 28 e 56 px renderizada em canvas
 * (26 e 52 px de linha): ≈ 0,93. Com isso, o tamanho estimado fica na mesma escala dos títulos e do corpo.
 */
const ALTURA_POR_TAMANHO = 0.93

/** Marcadores de lista que o Tesseract costuma ler como outro símbolo ("•" vira "*", "+", "«", "°"…). */
const MARCADOR_OCR = /^[*+«»°•·■●▪◦¤¢©®~>]$/

const alfanumericos = (s: string) => s.match(/[\p{L}\p{N}]/gu)?.length ?? 0
/** Linha com conteúdo: alguma palavra de 3+ letras ou dígitos, ou 4+ no total (poeira de scanner vira "rd - ~"). */
const temConteudo = (palavras: string[]) => palavras.some((w) => alfanumericos(w) >= 3) || alfanumericos(palavras.join('')) >= 4
const mediana = (v: number[]) => { const o = [...v].sort((a, b) => a - b); return o.length ? o[Math.floor(o.length / 2)]! : 0 }

/** Linha de base da linha na posição `x` (px da imagem). */
function baseEm(l: LinhaOcr, x: number): number {
  const b = l.baseline
  if (b && b.has_baseline !== false && Number.isFinite(b.y0) && Number.isFinite(b.y1) && b.x1 > b.x0) return b.y0 + ((b.y1 - b.y0) * (x - b.x0)) / (b.x1 - b.x0)
  return l.bbox.y1 - Math.max(0, l.rowAttributes?.descenders ?? 0)
}

/** Altura de texto da linha (px da imagem): `rowHeight` do Tesseract ou, sem ele, 80% da caixa. */
const alturaDaLinha = (l: LinhaOcr) => (l.rowAttributes?.rowHeight && l.rowAttributes.rowHeight > 0 ? l.rowAttributes.rowHeight : 0.8 * Math.max(1, l.bbox.y1 - l.bbox.y0))

/**
 * Resultado do Tesseract de uma página → trechos posicionados em pontos da página. `pxPorPt` = escala em que a
 * página foi renderizada para o OCR. Linhas de pouca confiança ou sem letras (ruído de foto ou textura) ficam
 * de fora; o tamanho de cada linha vem da altura medida pelo Tesseract (igualado ao do parágrafo quando é quase o
 * mesmo, para a variação de ascendentes e descendentes não virar título).
 */
export function paginaDoOcr(numero: number, larguraPt: number, alturaPt: number, pxPorPt: number, blocos: BlocoOcr[] | null | undefined): PaginaOcr {
  const k = pxPorPt > 0 ? pxPorPt : 1
  const itens: ItemPdf[] = []
  let soma = 0
  let peso = 0
  let palavras = 0
  for (const bloco of blocos ?? []) {
    for (const par of bloco.paragraphs ?? []) {
      const linhas = (par.lines ?? []).filter((l) => l.words?.length && l.confidence >= OCR.confiancaMinLinha)
      const alturaPar = mediana(linhas.map(alturaDaLinha))
      for (const l of linhas) {
        const ws = l.words.filter((w) => w.text?.trim() && w.confidence >= OCR.confiancaMinPalavra)
        if (!temConteudo(ws.map((w) => w.text))) continue
        const h = alturaDaLinha(l)
        const altura = alturaPar && Math.abs(h - alturaPar) <= 0.12 * alturaPar ? alturaPar : h
        const tamanho = altura / ALTURA_POR_TAMANHO / k
        ws.forEach((w, i) => {
          const texto = i === 0 && ws.length > 1 && MARCADOR_OCR.test(w.text.trim()) ? '•' : w.text.trim()
          const xc = (w.bbox.x0 + w.bbox.x1) / 2
          itens.push({ texto, x: w.bbox.x0 / k, y: baseEm(l, xc) / k, largura: Math.max(0.1, (w.bbox.x1 - w.bbox.x0) / k), tamanho })
          const n = texto.length
          soma += w.confidence * n
          peso += n
          palavras++
        })
      }
    }
  }
  return { pagina: { numero, largura: larguraPt, altura: alturaPt, itens, ocr: true }, confianca: peso ? Math.round(soma / peso) : 0, palavras }
}

/** Páginas que o OCR lê agora: as sem texto, até o limite por leitura. */
export const paginasParaOcr = (semTexto: number[], max: number = OCR.maxPaginas) => semTexto.slice(0, Math.max(0, max))

/** Escala (px por ponto) em que a página é renderizada para o OCR. */
export const escalaOcr = (larguraPt: number, alturaPt: number) => Math.min(OCR.ladoMaxPx / Math.max(1, larguraPt, alturaPt), OCR.escalaMax)

/** Caixa de um trecho (pontos): da linha de base menos o ascendente até um pouco abaixo dela. */
const caixa = (i: ItemPdf) => ({ x0: i.x, x1: i.x + i.largura, y0: i.y - 0.9 * i.tamanho, y1: i.y + 0.3 * i.tamanho })
const sobrepoe = (a: ReturnType<typeof caixa>, b: ReturnType<typeof caixa>) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
  return w > 0 && h > 0 && w * h >= 0.3 * Math.max(1e-6, (a.x1 - a.x0) * (a.y1 - a.y0))
}

/**
 * Página com pouco texto digital (legenda, cabeçalho) e o resto em imagem: o OCR lê a página renderizada, então
 * reconhece também o texto digital. Fica o digital (exato) e, do OCR, só as palavras fora dele.
 */
export function comTextoDigital(digital: PaginaPdf, ocr: PaginaPdf): PaginaPdf {
  if (!digital.itens.length) return ocr
  const caixas = digital.itens.map(caixa)
  return { ...ocr, itens: [...digital.itens, ...ocr.itens.filter((i) => { const c = caixa(i); return !caixas.some((d) => sobrepoe(c, d)) })] }
}

/**
 * Junta o OCR ao texto extraído: as páginas reconhecidas entram no lugar das vazias e o documento inteiro é
 * normalizado de novo (cabeçalhos/rodapés repetidos, parágrafos que continuam na página seguinte). Devolve
 * também quais páginas o OCR leu, quais ficaram incertas e quais continuam sem texto.
 */
export function juntarOcr(paginasPdf: PaginaPdf[], semTextoAntes: number[], ocr: { paginas: PaginaOcr[]; emBranco: number[] }): { resultado: ResultadoTexto; semTexto: number[]; lidasPorOcr: number[]; ocrIncerto: number[]; faltam: number[] } {
  const todas = [...paginasPdf]
  for (const p of ocr.paginas) if (p.pagina.numero >= 1 && p.pagina.numero <= todas.length) todas[p.pagina.numero - 1] = comTextoDigital(todas[p.pagina.numero - 1]!, p.pagina)
  const resultado = estruturarPdf(todas)
  const lidas = new Set(ocr.paginas.map((p) => p.pagina.numero))
  const lidasPorOcr = [...lidas].filter((n) => !resultado.paginasSemTexto.includes(n)).sort((a, b) => a - b)
  return {
    resultado,
    semTexto: resultado.paginasSemTexto.filter((n) => !ocr.emBranco.includes(n)),
    lidasPorOcr,
    ocrIncerto: ocr.paginas.filter((p) => lidasPorOcr.includes(p.pagina.numero) && p.confianca < OCR.confiancaBoa).map((p) => p.pagina.numero),
    faltam: semTextoAntes.filter((n) => !lidas.has(n) && !ocr.emBranco.includes(n)),
  }
}
