/**
 * PDF no navegador (pdf.js com worker): abrir, ler o texto, reconhecer o texto das páginas escaneadas (OCR com
 * tesseract.js, grátis), renderizar páginas e montar o PDF de páginas escaneadas que vai para a IA (opcional,
 * pago). Carregado sob demanda (`await import('@/lib/pdf/navegador')`), então o pdf.js não pesa no bundle das
 * telas; o tesseract.js é carregado só quando há página para reconhecer. No servidor (RSC/SSR) este módulo vira
 * um stub (vite.config.ts), então o Worker não leva nem um nem outro.
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
import { escalaOcr, OCR, paginaDoOcr, type BlocoOcr, type PaginaOcr } from './ocr'
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
type TipoImagem = 'image/webp' | 'image/jpeg' | 'image/png'

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
export async function renderizarPagina(d: DocumentoPdf, n: number, op: { ladoMax: number; tipo?: TipoImagem; qualidade?: number; detectarBranco?: boolean }): Promise<PaginaRenderizada> {
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

// ---------- OCR (tesseract.js) ----------

/**
 * Worker, núcleo wasm e dados de idioma do tesseract.js, servidos pelo próprio app (vite.config.ts copia de
 * node_modules para `/_next/static/ocr/<hash>/`; nada vem de CDN). O worker fica na mesma pasta do núcleo: o
 * núcleo acha o `.wasm` pelo endereço do worker.
 */
const RECURSOS_OCR = __BASE_OCR__

/** SIMD do WebAssembly (o núcleo com SIMD é bem mais rápido); mesmo teste do pacote wasm-feature-detect. */
const temSimd = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])) } catch { return false } }

export interface ProgressoOcr {
  /** `preparando`: baixando o leitor (só na primeira vez; depois vem do cache) · `lendo`: reconhecendo uma página. */
  etapa: 'preparando' | 'lendo'
  /** Página do PDF sendo lida (1…). */
  pagina: number
  /** Páginas já lidas e total desta leitura. */
  feitas: number
  total: number
  /** Progresso total, 0–1. */
  progresso: number
}

export interface LeituraOcr {
  /** Páginas reconhecidas, na ordem (inclusive as que não renderam texto). */
  paginas: PaginaOcr[]
  /** Páginas quase brancas: nem passam pelo OCR. */
  emBranco: number[]
  /** O usuário cancelou: `paginas` tem só as lidas até ali. */
  cancelado: boolean
}

const cancelada = () => new DOMException('Leitura cancelada', 'AbortError')
/** Espera `p`, mas desiste se `sinal` for abortado (o Tesseract não para no meio de uma página). */
function ouCancelar<T>(p: Promise<T>, sinal?: AbortSignal): Promise<T> {
  if (!sinal) return p
  if (sinal.aborted) return Promise.reject(cancelada())
  return new Promise<T>((ok, erro) => {
    const parar = () => erro(cancelada())
    sinal.addEventListener('abort', parar, { once: true })
    p.then(ok, erro).finally(() => sinal.removeEventListener('abort', parar))
  })
}

/**
 * Reconhece o texto das páginas `paginas` (1…) no navegador, uma por vez, com o tesseract.js (português +
 * inglês): renderiza a página (PNG, lado maior `OCR.ladoMaxPx`), passa ao Tesseract num Web Worker e converte o
 * resultado em trechos posicionados (`paginaDoOcr`). Sem rede além dos arquivos do próprio app e sem custo.
 * Cancelar (`sinal`) para na hora e devolve as páginas já lidas; o worker é encerrado no fim.
 */
export async function lerPaginasComOcr(d: DocumentoPdf, paginas: number[], op: { sinal?: AbortSignal; aoProgredir?: (p: ProgressoOcr) => void } = {}): Promise<LeituraOcr> {
  const lista = paginas.slice(0, OCR.maxPaginas)
  const saida: LeituraOcr = { paginas: [], emBranco: [], cancelado: false }
  if (!lista.length) return saida
  const total = lista.length
  // 15% para preparar o leitor; o resto dividido entre as páginas
  const avisar = (etapa: ProgressoOcr['etapa'], pagina: number, feitas: number, fracao: number) =>
    op.aoProgredir?.({ etapa, pagina, feitas, total, progresso: etapa === 'preparando' ? 0.15 * fracao : 0.15 + (0.85 * (feitas + fracao)) / total })
  let atual = { pagina: lista[0]!, feitas: 0 }
  let lendo = false
  avisar('preparando', atual.pagina, 0, 0)
  const tesseract = await ouCancelar(import('tesseract.js'), op.sinal).catch((e: unknown) => { if (op.sinal?.aborted) throw e; throw new ErroPdf('Não foi possível carregar o leitor de texto (OCR). Verifique a conexão e tente de novo.') })
  const { createWorker } = (tesseract as unknown as { default?: typeof tesseract }).default ?? tesseract
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null
  try {
    worker = await ouCancelar(
      createWorker([...OCR.idiomas], 1 /* OEM.LSTM_ONLY */, {
        workerPath: `${RECURSOS_OCR}worker.min.js`,
        corePath: `${RECURSOS_OCR}${temSimd() ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'}`,
        langPath: RECURSOS_OCR.replace(/\/$/, ''),
        gzip: true,
        // o cache HTTP (arquivos imutáveis) já guarda os dados de idioma; nada vai para o IndexedDB
        cacheMethod: 'none',
        workerBlobURL: false,
        logger: (m) => {
          const p = Number.isFinite(m.progress) ? Math.min(1, Math.max(0, m.progress)) : 0
          if (lendo && m.status === 'recognizing text') avisar('lendo', atual.pagina, atual.feitas, p)
          else if (!lendo) avisar('preparando', atual.pagina, 0, /core/.test(m.status) ? 0.3 * p : /traineddata/.test(m.status) ? 0.3 + 0.6 * p : 0.95)
        },
        errorHandler: () => {},
      }),
      op.sinal
    ).catch((e: unknown) => { if (op.sinal?.aborted) throw e; throw new ErroPdf('Não foi possível iniciar o leitor de texto (OCR) neste navegador.') })
    lendo = true
    for (const [feitas, n] of lista.entries()) {
      if (op.sinal?.aborted) throw cancelada()
      atual = { pagina: n, feitas }
      avisar('lendo', n, feitas, 0)
      const base = (await d.doc.getPage(n)).getViewport({ scale: 1 })
      const escala = escalaOcr(base.width, base.height)
      const r = await renderizarPagina(d, n, { ladoMax: escala * Math.max(base.width, base.height), tipo: 'image/png', detectarBranco: true })
      if (r.emBranco) { saida.emBranco.push(n); continue }
      await worker.setParameters({ user_defined_dpi: String(Math.round(72 * escala)) })
      const res = await ouCancelar(worker.recognize(r.blob, { rotateAuto: true }, { blocks: true, text: false }), op.sinal)
      saida.paginas.push(paginaDoOcr(n, r.larguraPt, r.alturaPt, r.largura / Math.max(1, r.larguraPt), res.data.blocks as unknown as BlocoOcr[] | null))
    }
    avisar('lendo', lista[lista.length - 1]!, total, 0)
  } catch (e) {
    if (!(op.sinal?.aborted)) throw e
    saida.cancelado = true
  } finally {
    await worker?.terminate().catch(() => {})
  }
  return saida
}
