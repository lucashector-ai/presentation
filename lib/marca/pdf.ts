/**
 * O que o manual da marca em PDF tem além do texto, lido pela lista de operações do pdf.js (sem renderizar, sem
 * IA): as imagens embutidas (candidatas a logo) e as cores das amostras (retângulos cheios grandes, como os
 * quadrados de cor de uma página de paleta). Funciona no navegador e no Node (build "legacy", nos testes); só usa
 * a API de documento, como lib/pdf/ler.ts. Nada do PDF é executado.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { coresDoLogo } from '@/lib/ia/marca'
import { paraHex } from '@/lib/ia/designSystem'

/** Os códigos de operação do pdf.js usados aqui (vêm do módulo carregado: `pdfjs.OPS`). */
export interface OpsPdf { fill: number; eoFill: number; fillStroke: number; eoFillStroke: number; constructPath: number; setFillRGBColor: number; paintImageXObject: number; paintInlineImageXObject: number }

/**
 * Imagem embutida: tamanho original e os pixels RGBA (`rgba`, com `w` × `h`; o bitmap que o pdf.js entrega no
 * navegador é reduzido a no máximo 800 px de lado e copiado na hora, antes de a página liberar a memória).
 */
export interface ImagemPdf { pagina: number; largura: number; altura: number; rgba: Uint8ClampedArray; w: number; h: number }

/** Copia um ImageBitmap do pdf.js para RGBA (OffscreenCanvas; null sem ele). */
function rgbaDoBitmap(b: CanvasImageSource & { width: number; height: number }): { rgba: Uint8ClampedArray; w: number; h: number } | null {
  if (typeof OffscreenCanvas === 'undefined') return null
  const escala = Math.min(1, 800 / Math.max(b.width, b.height))
  const w = Math.max(1, Math.round(b.width * escala))
  const h = Math.max(1, Math.round(b.height * escala))
  const g = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.drawImage(b, 0, 0, w, h)
  return { rgba: g.getImageData(0, 0, w, h).data, w, h }
}
export interface AmostraPdf { hex: string; vezes: number; paginas: number[] }

export const LIMITES_PDF_MARCA = {
  /** Páginas varridas atrás de imagens e amostras (o logo e a paleta ficam no começo do manual). */
  paginas: 16,
  /** Imagens guardadas no total (as maiores e mais "de logo" ganham). */
  imagens: 24,
  /** Imagem menor que isto (px) é ícone ou textura; maior que isto, foto inteira de página. */
  ladoMin: 24,
  ladoMax: 4096,
  /** Lado mínimo, em pontos, de um retângulo cheio para contar como amostra de cor. */
  amostraMin: 18,
} as const

/** Converte o objeto de imagem do pdf.js (GRAYSCALE_1BPP = 1, RGB_24BPP = 2, RGBA_32BPP = 3) em RGBA. */
function paraRgba(o: { width: number; height: number; kind?: number; data?: Uint8ClampedArray | Uint8Array }): Uint8ClampedArray | null {
  const { width: w, height: h, data, kind } = o
  if (!data || !w || !h) return null
  const n = w * h
  if (kind === 3 && data.length >= n * 4) return new Uint8ClampedArray(data.buffer, data.byteOffset, n * 4)
  const saida = new Uint8ClampedArray(n * 4)
  if (kind === 2 && data.length >= n * 3) {
    for (let i = 0; i < n; i++) { saida[i * 4] = data[i * 3]!; saida[i * 4 + 1] = data[i * 3 + 1]!; saida[i * 4 + 2] = data[i * 3 + 2]!; saida[i * 4 + 3] = 255 }
    return saida
  }
  if (kind === 1) {
    const porLinha = (w + 7) >> 3
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = (data[y * porLinha + (x >> 3)]! >> (7 - (x & 7))) & 1 ? 255 : 0
      const i = (y * w + x) * 4
      saida[i] = v; saida[i + 1] = v; saida[i + 2] = v; saida[i + 3] = 255
    }
    return saida
  }
  return null
}

const obter = (objs: { get: (id: string, cb: (v: unknown) => void) => void }, id: string, ms = 3000) =>
  new Promise<unknown>((ok) => {
    const t = setTimeout(() => ok(null), ms)
    try { objs.get(id, (v) => { clearTimeout(t); ok(v) }) } catch { clearTimeout(t); ok(null) }
  })

/**
 * Imagens e amostras de cor das primeiras páginas. Imagens repetidas (mesmo tamanho na mesma posição de várias
 * páginas, como um logo de cabeçalho) entram uma vez.
 */
export async function imagensEAmostrasDoPdf(doc: PDFDocumentProxy, OPS: OpsPdf, op: { maxPaginas?: number; sinal?: AbortSignal } = {}): Promise<{ imagens: ImagemPdf[]; amostras: AmostraPdf[] }> {
  const total = Math.min(doc.numPages, op.maxPaginas ?? LIMITES_PDF_MARCA.paginas)
  const imagens: ImagemPdf[] = []
  const vistas = new Set<string>()
  const amostras = new Map<string, AmostraPdf>()
  const preenche = new Set([OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke])
  for (let n = 1; n <= total; n++) {
    if (op.sinal?.aborted) throw new DOMException('Leitura cancelada', 'AbortError')
    const pagina = await doc.getPage(n)
    try {
      const lista = await pagina.getOperatorList()
      let cor = '#000000'
      for (let i = 0; i < lista.fnArray.length; i++) {
        const f = lista.fnArray[i]!
        const args = lista.argsArray[i] as unknown[]
        if (f === OPS.setFillRGBColor) {
          const v = args[0]
          cor = typeof v === 'string' ? v.toUpperCase() : Array.isArray(args) && args.length >= 3 ? paraHex(Number(args[0]), Number(args[1]), Number(args[2])) : cor
        } else if (f === OPS.constructPath && preenche.has(Number(args[0]))) {
          const caixa = args[2] as ArrayLike<number> | undefined
          if (caixa && caixa.length >= 4 && Math.abs(caixa[2]! - caixa[0]!) >= LIMITES_PDF_MARCA.amostraMin && Math.abs(caixa[3]! - caixa[1]!) >= LIMITES_PDF_MARCA.amostraMin && /^#[0-9A-F]{6}$/.test(cor)) {
            const a = amostras.get(cor) ?? { hex: cor, vezes: 0, paginas: [] }
            a.vezes++
            if (!a.paginas.includes(n)) a.paginas.push(n)
            amostras.set(cor, a)
          }
        } else if ((f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject) && imagens.length < LIMITES_PDF_MARCA.imagens) {
          const bruto = (f === OPS.paintInlineImageXObject ? args[0] : await obter(String(args[0]).startsWith('g_') ? pagina.commonObjs : pagina.objs, String(args[0]))) as { width: number; height: number; kind?: number; data?: Uint8ClampedArray; bitmap?: CanvasImageSource & { width: number; height: number } } | null
          if (!bruto?.width || !bruto.height) continue
          const { width: w, height: h } = bruto
          if (Math.min(w, h) < LIMITES_PDF_MARCA.ladoMin || Math.max(w, h) > LIMITES_PDF_MARCA.ladoMax) continue
          const chave = `${w}x${h}:${String(args[0])}`
          if (vistas.has(chave)) continue
          vistas.add(chave)
          if (bruto.bitmap) {
            const r = rgbaDoBitmap(bruto.bitmap)
            if (r) imagens.push({ pagina: n, largura: w, altura: h, ...r })
          } else {
            const rgba = paraRgba(bruto)
            if (rgba) imagens.push({ pagina: n, largura: w, altura: h, rgba, w, h })
          }
        }
      }
    } finally {
      pagina.cleanup()
    }
  }
  return { imagens, amostras: [...amostras.values()].sort((a, b) => b.vezes - a.vezes) }
}

export interface AnaliseImagem {
  /** Fração de pixels transparentes (logo em PNG costuma ter fundo transparente). */
  transparencia: number
  /** Tons diferentes (4 bits por canal) na amostra: foto tem centenas; logo, poucos. */
  tons: number
  cores: string[]
  media: string
}

/** Transparência, número de tons e cores marcantes de uma imagem RGBA (amostra de no máximo ~40 mil pixels). */
export function analisarImagem(rgba: ArrayLike<number>): AnaliseImagem {
  const passo = Math.max(1, Math.floor(rgba.length / 4 / 40000)) * 4
  let transparentes = 0
  let total = 0
  const tons = new Set<number>()
  const amostra: number[] = []
  for (let i = 0; i + 3 < rgba.length; i += passo) {
    total++
    if (rgba[i + 3]! < 128) { transparentes++; continue }
    tons.add(((rgba[i]! >> 4) << 8) | ((rgba[i + 1]! >> 4) << 4) | (rgba[i + 2]! >> 4))
    amostra.push(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!)
  }
  const { cores, media } = coresDoLogo(amostra)
  return { transparencia: total ? transparentes / total : 0, tons: tons.size, cores, media }
}

/**
 * Nota de "parece logo" (maior = mais provável): transparência, poucos tons, proporção de assinatura (mais larga
 * que alta ou quadrada), nas primeiras páginas ou numa página que fala de logo. Foto de página inteira perde.
 */
export function notaDeLogo(c: { pagina: number; largura: number; altura: number; analise: AnaliseImagem; paginaFalaDeLogo?: boolean }): number {
  const prop = c.largura / Math.max(1, c.altura)
  let nota = 0
  if (c.analise.transparencia > 0.05) nota += 3
  if (c.analise.tons <= 48) nota += 3
  else if (c.analise.tons <= 160) nota += 1
  else nota -= 2
  if (prop >= 0.6 && prop <= 6) nota += 1
  if (c.pagina <= 3) nota += 1
  if (c.paginaFalaDeLogo) nota += 2
  if (Math.max(c.largura, c.altura) > 2400) nota -= 1
  return nota
}
