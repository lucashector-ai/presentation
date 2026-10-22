'use client'
/**
 * PDF como material do "Criar com IA", lido no navegador e sem créditos: o texto digital vem do pdf.js e as
 * páginas escaneadas (só imagem) são reconhecidas por OCR (tesseract.js, português + inglês), com progresso por
 * página e cancelamento. O texto reconhecido passa pela mesma normalização do texto extraído (ordem de leitura,
 * títulos, listas, tabelas). A leitura pela IA (Claude, paga) fica como opção secundária e explícita, para o
 * que o OCR não resolve bem: gráficos, tabelas complexas e manuscrito.
 *
 * Fica separado do CriarComIA.tsx (que só chama `lerPdfParaMaterial` e mostra `ProgressoLeitura` e
 * `AvisoPaginasPdf`).
 */
import { ScanText, Sparkles, X } from 'lucide-react'
import { listaDePaginas, type MaterialLido } from '@/lib/pdf/material'
import type { DocumentoPdf, ProgressoOcr } from '@/lib/pdf/navegador'
import { juntarOcr, OCR, paginasParaOcr } from '@/lib/pdf/ocr'

/** Etapa da leitura mostrada na barra de progresso; `cancelar` aparece como botão (OCR). */
export interface FaseLeitura { fase: string; progresso: number; cancelar?: () => void }

export interface PdfLido {
  texto: string
  /** Texto de cada página (índice = página − 1), para a IA substituir depois as que ler. */
  porPagina: string[]
  material: Pick<MaterialLido, 'paginas' | 'caracteres' | 'titulos' | 'itensLista' | 'tabelas' | 'semTexto' | 'lidasPorOcr' | 'ocrIncerto' | 'emBranco'>
  /** Aviso para o usuário (OCR cancelado, com erro ou acima do limite de páginas). */
  aviso: string | null
}

const pl = (n: number, um: string, varios: string) => (n === 1 ? um : varios)
/** Texto da etapa do OCR (também na importação do PDF como apresentação). */
export const faseOcr = (p: ProgressoOcr) =>
  p.etapa === 'preparando'
    ? 'Preparando o leitor de texto (OCR) no navegador…'
    : p.feitas >= p.total
      ? 'Organizando o texto reconhecido…'
      : `Reconhecendo o texto da página ${p.pagina} (${p.feitas + 1} de ${p.total})…`

/**
 * Lê o PDF aberto: texto digital de todas as páginas e, nas que não têm (as primeiras `OCR.maxPaginas`), OCR no
 * navegador. `sinal` aborta tudo (trocar de arquivo); o botão "Cancelar" da fase de OCR para só o OCR e fica
 * com o que já foi lido.
 */
export async function lerPdfParaMaterial(d: DocumentoPdf, op: { sinal: AbortSignal; aoProgredir: (f: FaseLeitura) => void; /** Lê só as primeiras N páginas (manual da marca: limite do plano). */ maxPaginas?: number }): Promise<PdfLido> {
  const pdf = await import('@/lib/pdf/navegador')
  const r = await pdf.lerTextoPdf(d, { sinal: op.sinal, maxPaginas: op.maxPaginas, aoProgredir: (n, total) => op.aoProgredir({ fase: `Lendo a página ${n} de ${total}…`, progresso: n / total }) })
  const base = { paginas: r.paginas, caracteres: r.caracteres, titulos: r.titulos, itensLista: r.itensLista, tabelas: r.tabelas, semTexto: r.paginasSemTexto, lidasPorOcr: [], ocrIncerto: [], emBranco: [] }
  const alvo = paginasParaOcr(r.paginasSemTexto)
  if (!alvo.length) return { texto: r.texto, porPagina: r.porPagina, material: base, aviso: null }

  const ctrlOcr = new AbortController()
  const pararOcr = () => ctrlOcr.abort()
  op.sinal.addEventListener('abort', pararOcr, { once: true })
  let leitura: Awaited<ReturnType<typeof pdf.lerPaginasComOcr>> | null = null
  let aviso: string | null = null
  try {
    leitura = await pdf.lerPaginasComOcr(d, alvo, { sinal: ctrlOcr.signal, aoProgredir: (p) => op.aoProgredir({ fase: faseOcr(p), progresso: p.progresso, cancelar: pararOcr }) })
  } catch (e) {
    if (op.sinal.aborted) throw e
    aviso = e instanceof Error && e.name === 'ErroLeitura' ? e.message : 'O reconhecimento de texto (OCR) falhou neste navegador.'
  } finally {
    op.sinal.removeEventListener('abort', pararOcr)
  }
  if (op.sinal.aborted) throw new DOMException('Leitura cancelada', 'AbortError')
  const l = leitura
  if (!l) return { texto: r.texto, porPagina: r.porPagina, material: base, aviso }

  const { resultado: f, semTexto, lidasPorOcr, ocrIncerto, faltam } = juntarOcr(r.paginasPdf, r.paginasSemTexto, l)
  const emBranco = l.emBranco
  if (l.cancelado) aviso = `Reconhecimento cancelado: ${lidasPorOcr.length} ${pl(lidasPorOcr.length, 'página lida', 'páginas lidas')} por OCR.`
  else if (faltam.length && alvo.length < r.paginasSemTexto.length) aviso = `O OCR lê as primeiras ${OCR.maxPaginas} páginas sem texto; ${pl(faltam.length, 'a página', 'as páginas')} ${listaDePaginas(faltam)} ${pl(faltam.length, 'ficou', 'ficaram')} sem texto.`
  return {
    texto: f.texto,
    porPagina: f.porPagina,
    material: { paginas: f.paginas, caracteres: f.caracteres, titulos: f.titulos, itensLista: f.itensLista, tabelas: f.tabelas, semTexto, lidasPorOcr, ocrIncerto, emBranco },
    aviso,
  }
}

/** Barra de progresso da leitura do arquivo, com "Cancelar" durante o OCR. */
export function ProgressoLeitura({ lendo }: { lendo: FaseLeitura }) {
  return (
    <div className="mt-2.5 flex items-center gap-3 text-[13px] text-texto3" role="status" aria-live="polite">
      <span aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#E7E5E4] border-t-violeta" />
      <span className="min-w-0 shrink truncate">{lendo.fase}</span>
      <span className="h-1 min-w-[48px] flex-1 overflow-hidden rounded-sm bg-[#EDECEA]"><span className="block h-1 bg-violeta transition-[width]" style={{ width: `${Math.round(lendo.progresso * 100)}%` }} /></span>
      {lendo.cancelar && (
        <button type="button" onClick={lendo.cancelar} className="flex h-7 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-bordaForte px-2.5 text-[12px] font-medium text-texto hover:border-grafite">
          <X className="h-3 w-3" />Cancelar
        </button>
      )}
    </div>
  )
}

/**
 * Páginas escaneadas: o que o OCR leu (grátis) e o que continua sem texto, mais a leitura pela IA como opção
 * secundária (nunca automática), com o custo à vista.
 */
export function AvisoPaginasPdf({ material, paraIa, custo, limite, plano, onLerComIa }: { material: MaterialLido; paraIa: number[]; custo: number; limite: number; plano: string; onLerComIa: () => void }) {
  const ocr = material.lidasPorOcr ?? []
  const incerto = material.ocrIncerto ?? []
  const sem = material.semTexto
  if (!ocr.length && !sem.length) return null
  const candidatas = new Set([...sem, ...ocr]).size
  return (
    <div className="flex flex-col gap-2" data-testid="paginas-escaneadas">
      {ocr.length > 0 && (
        <div className="flex items-start gap-2 rounded-[10px] bg-[#EEF5EC] px-3 py-2.5 text-[#28502A]" data-testid="aviso-ocr">
          <ScanText className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {ocr.length === material.paginas ? 'O PDF é escaneado: ' : `${pl(ocr.length, 'Página', 'Páginas')} ${listaDePaginas(ocr)} sem texto digital: `}
            {pl(ocr.length, 'lida', 'lidas')} no seu navegador por reconhecimento de texto (OCR), sem gastar créditos.
            {incerto.length > 0 ? ` A leitura ${pl(incerto.length, 'da página', 'das páginas')} ${listaDePaginas(incerto)} ficou incerta: confira o texto.` : ' Confira o texto abaixo.'}
          </span>
        </div>
      )}
      {sem.length > 0 && (
        <div className="rounded-[10px] bg-[#FFF7E8] px-3 py-2.5 text-[#6B4E16]">
          {sem.length === material.paginas ? 'Nenhuma página tem texto legível' : `${sem.length} ${pl(sem.length, 'página continua', 'páginas continuam')} sem texto (${pl(sem.length, 'página', 'páginas')} ${listaDePaginas(sem)})`}: pode ser foto, gráfico ou manuscrito.
        </div>
      )}
      {paraIa.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-texto3">
          <button type="button" onClick={onLerComIa} className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-bordaForte bg-white px-3 py-1 text-left text-[13px] font-medium text-texto hover:border-grafite">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-acento" />
            <span>Ler com IA (melhor para gráficos, tabelas complexas e manuscrito) · <span className="mono">{custo}</span> créditos</span>
          </button>
          <span className="min-w-0 flex-1 text-[12px]">
            Opcional: a IA lê a imagem {pl(paraIa.length, 'da página', 'das páginas')} {listaDePaginas(paraIa)}
            {paraIa.length < candidatas ? ` (até ${limite} por vez no plano ${plano})` : ''}. O PDF não fica guardado.
          </span>
        </div>
      )}
    </div>
  )
}
