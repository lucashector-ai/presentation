/**
 * Leitura do texto de um documento já aberto pelo pdf.js (no navegador: `lib/pdf/navegador.ts`; nos testes: o
 * build "legacy" no Node). Só usa a API de documento (`getPage`, `getTextContent`); nada de camada de anotações,
 * formulários ou scripts: o JavaScript embutido num PDF nunca é executado.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ItemPdf, PaginaPdf } from './texto'

/** `Util.transform` do pdf.js (multiplica matrizes 2D). */
export type Transformar = (a: number[], b: number[]) => number[]

export interface OpcoesExtracao {
  /** Lê só as primeiras N páginas. */
  maxPaginas?: number
  aoProgredir?: (lidas: number, total: number) => void
  sinal?: AbortSignal
}

/**
 * Texto posicionado de cada página, em pontos, com a rotação da página aplicada (origem no canto superior
 * esquerdo; `y` é a linha de base). Trechos vazios (o pdf.js insere espaços para preencher vãos) ficam de fora.
 */
export async function extrairPaginas(doc: PDFDocumentProxy, transformar: Transformar, op: OpcoesExtracao = {}): Promise<PaginaPdf[]> {
  const total = Math.min(doc.numPages, op.maxPaginas ?? doc.numPages)
  const paginas: PaginaPdf[] = []
  for (let n = 1; n <= total; n++) {
    if (op.sinal?.aborted) throw new DOMException('Leitura cancelada', 'AbortError')
    const pagina = await doc.getPage(n)
    const vp = pagina.getViewport({ scale: 1 })
    const conteudo = await pagina.getTextContent()
    const itens: ItemPdf[] = []
    for (const it of conteudo.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const m = transformar(vp.transform, it.transform)
      const tamanho = Math.hypot(m[2]!, m[3]!) || it.height
      // texto girado 90°: a largura corre no eixo vertical; fica com a posição e uma largura aproximada
      const largura = Math.abs(m[1]!) > Math.abs(m[0]!) ? it.str.length * tamanho * 0.5 : it.width
      itens.push({ texto: it.str, x: m[4]!, y: m[5]!, largura, tamanho })
    }
    paginas.push({ numero: n, largura: vp.width, altura: vp.height, itens })
    pagina.cleanup()
    op.aoProgredir?.(n, total)
  }
  return paginas
}
