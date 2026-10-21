/**
 * PDF no navegador (pdf.js com worker): abrir, ler o texto, renderizar páginas e montar o PDF de páginas
 * escaneadas que vai para a IA. Carregado sob demanda (`await import('@/lib/pdf/navegador')`), então o pdf.js
 * não pesa no bundle das telas; no servidor (RSC/SSR) este módulo vira um stub (vite.config.ts), então o
 * Worker não leva o pdf.js.
 *
 * Segurança: só a API de documento e a renderização em canvas; sem camada de anotações, formulários, XFA ou
 * scripts (o pdf.js não executa o JavaScript de um PDF fora do visualizador com `enableScripting`). Arquivos
 * acima de `MAX_BYTES_PDF` são recusados antes de abrir.
 */
import { AnnotationMode, getDocument, GlobalWorkerOptions, InvalidPDFException, PasswordException, Util, version, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
// build "legacy": inclui os polyfills de recursos recentes (ex.: Map.getOrInsertComputed) que o build moderno exige do navegador
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { LEITURA_PDF } from '@/lib/ia/pdf'
import { extrairPaginas } from './ler'
import { montarPdfDeImagens, type ImagemPagina } from './montar'
import { estruturarPdf, type PaginaPdf, type ResultadoTexto } from './texto'

/** Maior PDF que o navegador abre (memória). */
export const MAX_BYTES_PDF = 100 * 1024 * 1024

/** Erro com mensagem pronta para o usuário. */
export class ErroPdf extends Error {
  override name = 'ErroLeitura'
}

GlobalWorkerOptions.workerSrc = workerUrl
/** wasm (JPEG 2000, JBIG2, cores) e fontes padrão servidos pelo build (plugin em vite.config.ts). */
const RECURSOS = `/_next/static/pdfjs/${version}/`

export interface DocumentoPdf { doc: PDFDocumentProxy; paginas: number; fechar: () => Promise<void> }

export async function abrirPdf(arquivo: Blob): Promise<DocumentoPdf> {
  if (arquivo.size > MAX_BYTES_PDF) throw new ErroPdf(`O PDF tem mais de ${MAX_BYTES_PDF / 1024 / 1024} MB.`)
  const dados = new Uint8Array(await arquivo.arrayBuffer())
  const tarefa = getDocument({
    data: dados,
    enableXfa: false,
    verbosity: 0,
    stopAtErrors: false,
    useSystemFonts: true,
    wasmUrl: `${RECURSOS}wasm/`,
    standardFontDataUrl: `${RECURSOS}standard_fonts/`,
    // imagem embutida absurda (bomba de pixels) não é decodificada
    maxImageSize: 100_000_000,
  })
  try {
    const doc = await tarefa.promise
    return { doc, paginas: doc.numPages, fechar: () => tarefa.destroy() }
  } catch (e) {
    await tarefa.destroy().catch(() => {})
    if (e instanceof PasswordException) throw new ErroPdf('Este PDF tem senha. Abra-o, salve uma cópia sem senha e tente de novo.')
    if (e instanceof InvalidPDFException) throw new ErroPdf('Este arquivo não é um PDF válido.')
    throw new ErroPdf('Não foi possível abrir este PDF.')
  }
}

export interface LeituraPdf extends ResultadoTexto { paginasPdf: PaginaPdf[] }

/** Texto estruturado de todas as páginas (até `maxPaginas`). */
export async function lerTextoPdf(d: DocumentoPdf, op: { maxPaginas?: number; aoProgredir?: (lidas: number, total: number) => void; sinal?: AbortSignal } = {}): Promise<LeituraPdf> {
  const paginasPdf = await extrairPaginas(d.doc, (a, b) => Util.transform(a, b) as number[], op)
  return { ...estruturarPdf(paginasPdf), paginasPdf }
}

export interface PaginaRenderizada { blob: Blob; largura: number; altura: number; larguraPt: number; alturaPt: number; emBranco: boolean }

const paraBlob = (c: HTMLCanvasElement, tipo: string, q: number) => new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q))

/** Página quase toda branca (amostra 64×64): não vale a pena mandar para a IA. */
function quaseBranca(c: HTMLCanvasElement): boolean {
  const a = document.createElement('canvas')
  a.width = 64
  a.height = 64
  const g = a.getContext('2d', { willReadFrequently: true })
  if (!g) return false
  g.drawImage(c, 0, 0, 64, 64)
  const px = g.getImageData(0, 0, 64, 64).data
  let escuros = 0
  for (let i = 0; i < px.length; i += 4) if (0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]! < 235) escuros++
  return escuros / (64 * 64) < 0.002
}

/**
 * Renderiza a página `n` (1…) num canvas com o lado maior em `ladoMax` px e devolve a imagem.
 * `tipo` WebP quando o navegador codifica (menor para o mesmo detalhe); senão JPEG.
 */
export async function renderizarPagina(d: DocumentoPdf, n: number, op: { ladoMax: number; tipo?: 'image/webp' | 'image/jpeg'; qualidade?: number; detectarBranco?: boolean }): Promise<PaginaRenderizada> {
  const pagina = await d.doc.getPage(n)
  try {
    const base = pagina.getViewport({ scale: 1 })
    const escala = Math.min(op.ladoMax / Math.max(base.width, base.height), 8)
    const vp = pagina.getViewport({ scale: escala })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(vp.width))
    canvas.height = Math.max(1, Math.round(vp.height))
    await pagina.render({ canvas, viewport: vp, background: '#ffffff', annotationMode: AnnotationMode.ENABLE }).promise
    const emBranco = op.detectarBranco ? quaseBranca(canvas) : false
    const tipo = op.tipo ?? 'image/jpeg'
    let blob = await paraBlob(canvas, tipo, op.qualidade ?? 0.9)
    if (!blob || blob.type !== tipo) blob = await paraBlob(canvas, 'image/jpeg', op.qualidade ?? 0.9)
    const r = { blob: blob!, largura: canvas.width, altura: canvas.height, larguraPt: base.width, alturaPt: base.height, emBranco }
    canvas.width = 0
    canvas.height = 0
    if (!r.blob) throw new ErroPdf(`Não foi possível desenhar a página ${n}.`)
    return r
  } finally {
    pagina.cleanup()
  }
}

/**
 * PDF só com as páginas escaneadas, para a IA ler: cada página vira um JPEG (lado maior 2.000 px) num PDF novo.
 * Páginas em branco ficam de fora. Se passar do teto de bytes, refaz com imagens menores.
 */
export async function montarPdfParaIa(d: DocumentoPdf, paginas: number[], aoProgredir?: (feitas: number, total: number) => void): Promise<{ bytes: Uint8Array; paginas: number[]; emBranco: number[] }> {
  const { jsPDF } = await import('jspdf')
  const tentativas = [{ ladoMax: LEITURA_PDF.ladoMaxPx, qualidade: LEITURA_PDF.qualidadeJpeg }, { ladoMax: 1500, qualidade: 0.7 }, { ladoMax: 1200, qualidade: 0.6 }]
  let emBranco: number[] = []
  for (const t of tentativas) {
    const imagens: ImagemPagina[] = []
    const usadas: number[] = []
    emBranco = []
    for (const [k, n] of paginas.entries()) {
      const r = await renderizarPagina(d, n, { ladoMax: t.ladoMax, tipo: 'image/jpeg', qualidade: t.qualidade, detectarBranco: true })
      aoProgredir?.(k + 1, paginas.length)
      if (r.emBranco) { emBranco.push(n); continue }
      imagens.push({ jpeg: new Uint8Array(await r.blob.arrayBuffer()), larguraPt: r.larguraPt, alturaPt: r.alturaPt })
      usadas.push(n)
    }
    if (!imagens.length) return { bytes: new Uint8Array(), paginas: [], emBranco }
    const bytes = montarPdfDeImagens(jsPDF, imagens)
    if (bytes.byteLength <= LEITURA_PDF.maxBytes) return { bytes, paginas: usadas, emBranco }
  }
  throw new ErroPdf('As páginas escaneadas são grandes demais para a IA ler de uma vez. Envie menos páginas.')
}
