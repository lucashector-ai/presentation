'use client'
/**
 * Importar um PDF como apresentação (Novo projeto → Traga seu material): cada página é renderizada no navegador
 * (pdf.js, carregado só agora) e enviada como imagem pelo fluxo normal de mídias (`dados.enviarArquivo`: rota
 * POST /api/assets/upload no modo real, armazenamento local no demo); o texto da página vira camadas de texto
 * invisíveis e selecionáveis (opcional). O PDF em si não é enviado a lugar nenhum.
 *
 * Páginas sem texto digital (escaneadas, fotografadas) passam pelo OCR do navegador (`lerPaginasComOcr`, o mesmo
 * do "Criar com IA": tesseract.js carregado sob demanda, sem créditos e sem a IA), até `OCR.maxPaginas` por
 * importação; as posições das linhas reconhecidas montam a camada de texto sobre a imagem (`blocosDoOcr`).
 * Cancelar o OCR fica com as páginas já lidas e segue a importação.
 */
import { dados } from '@/lib/dados'
import { blocosDoOcr } from '@/lib/pdf/camadaOcr'
import type { LeituraOcr } from '@/lib/pdf/navegador'
import { comTextoDigital, juntarOcr, OCR, paginasParaOcr } from '@/lib/pdf/ocr'
import { MAX_BLOCOS_TEXTO, type PaginaImportada } from '@/lib/pdf/paginas'
import { blocosPosicionados, limitarBlocos, type BlocoPosicionado } from '@/lib/pdf/texto'
import { PLANOS, type PlanoId } from '@/lib/planos'
import { faseOcr } from './LeituraPdf'

/** Etapa da importação; `cancelar` (só durante o OCR) para o reconhecimento e fica com o que já foi lido. */
export interface ProgressoImportacao { fase: string; progresso: number; cancelar?: () => void }

export interface ResumoOcr {
  /** Páginas importadas sem texto digital. */
  semTexto: number
  /** Páginas em que o OCR reconheceu texto. */
  reconhecidas: number[]
  /** A pessoa parou o OCR no meio. */
  cancelado: boolean
  /** Páginas sem texto além do limite do OCR por importação (ficam só com a imagem). */
  foraDoLimite: number
  /** O OCR não rodou (navegador sem suporte, falha ao carregar o leitor). */
  erro: string | null
}

export interface ResultadoImportacaoPdf {
  paginas: PaginaImportada[]
  /** Páginas do PDF que ficaram de fora pelo limite do plano. */
  deFora: number
  totalPdf: number
  /** Leitura das páginas escaneadas (null = nenhuma página sem texto, ou texto desligado). */
  ocr: ResumoOcr | null
}

/** Markdown leve do texto da página → texto para as notas do apresentador. */
const paraNotas = (md: string) => md.replace(/^#{1,3} /gm, '').trim()

export async function importarPaginasPdf(arquivo: File, opcoes: { planoId: PlanoId; textoSelecionavel: boolean; notasOcr?: boolean; aoProgredir?: (p: ProgressoImportacao) => void }): Promise<ResultadoImportacaoPdf> {
  const pdf = await import('@/lib/pdf/navegador')
  const d = await pdf.abrirPdf(arquivo)
  try {
    const limite = PLANOS[opcoes.planoId].limites.paginasPdfImportar
    const total = Math.min(d.paginas, limite)
    const notasOcr = !!opcoes.notasOcr
    const texto = opcoes.textoSelecionavel || notasOcr ? await pdf.lerTextoPdf(d, { maxPaginas: total, aoProgredir: (n, t) => opcoes.aoProgredir?.({ fase: `lendo o texto da página ${n} de ${t}`, progresso: n / t }) }) : null

    // páginas escaneadas: OCR no navegador (grátis), até o limite por leitura
    const doOcr = new Map<number, { blocos: BlocoPosicionado[]; notas: string }>()
    let ocr: ResumoOcr | null = null
    const alvo = texto ? paginasParaOcr(texto.paginasSemTexto) : []
    if (texto && alvo.length) {
      ocr = { semTexto: texto.paginasSemTexto.length, reconhecidas: [], cancelado: false, foraDoLimite: texto.paginasSemTexto.length - alvo.length, erro: null }
      const ctrl = new AbortController()
      const cancelar = () => ctrl.abort()
      let leitura: LeituraOcr | null = null
      try {
        leitura = await pdf.lerPaginasComOcr(d, alvo, { sinal: ctrl.signal, aoProgredir: (p) => opcoes.aoProgredir?.({ fase: faseOcr(p).replace(/^\p{Lu}/u, (c) => c.toLowerCase()).replace(/…$/, ''), progresso: p.progresso, cancelar }) })
      } catch (e) {
        ocr.erro = e instanceof Error && e.name === 'ErroLeitura' ? e.message : 'O reconhecimento de texto (OCR) falhou neste navegador.'
      }
      if (leitura) {
        const { resultado, lidasPorOcr } = juntarOcr(texto.paginasPdf, texto.paginasSemTexto, leitura)
        ocr.cancelado = leitura.cancelado
        ocr.reconhecidas = lidasPorOcr
        for (const p of leitura.paginas) {
          const n = p.pagina.numero
          if (!lidasPorOcr.includes(n)) continue
          const digital = texto.paginasPdf[n - 1]!
          // o pouco texto digital da página fica como está (exato); do OCR, só o que está fora dele
          const reconhecido = comTextoDigital(digital, p.pagina).itens.slice(digital.itens.length)
          const deTexto = blocosPosicionados(digital.itens)
          doOcr.set(n, { blocos: limitarBlocos([...deTexto, ...blocosDoOcr(reconhecido, Math.max(1, MAX_BLOCOS_TEXTO - deTexto.length))], MAX_BLOCOS_TEXTO), notas: paraNotas(resultado.porPagina[n - 1] ?? '') })
        }
      }
    }

    // alta resolução: o lado maior com 2× o da tela (1.920 px) no modo real; no demo 1× (as mídias ficam no navegador)
    const ladoMax = 1920 * (dados.modo === 'demo' ? 1 : 2)
    const base = arquivo.name.replace(/\.pdf$/i, '').slice(0, 60) || 'pdf'
    const paginas: PaginaImportada[] = []
    for (let n = 1; n <= total; n++) {
      opcoes.aoProgredir?.({ fase: `página ${n} de ${total}`, progresso: (n - 1) / total })
      const r = await pdf.renderizarPagina(d, n, { ladoMax, tipo: 'image/webp', qualidade: 0.92 })
      const ext = r.blob.type === 'image/webp' ? 'webp' : 'jpg'
      const asset = await dados.enviarArquivo(new File([r.blob], `${base} · página ${n}.${ext}`, { type: r.blob.type }), () => undefined)
      const lida = doOcr.get(n)
      const blocos = !opcoes.textoSelecionavel ? [] : lida ? lida.blocos : blocosPosicionados(texto?.paginasPdf[n - 1]?.itens ?? [])
      paginas.push({ numero: n, assetId: asset.id, larguraPt: r.larguraPt, alturaPt: r.alturaPt, blocos, ...(notasOcr && lida?.notas ? { notas: lida.notas } : {}) })
    }
    return { paginas, deFora: d.paginas - total, totalPdf: d.paginas, ocr }
  } finally {
    await d.fechar().catch(() => {})
  }
}

const pl = (n: number, um: string, varios: string) => (n === 1 ? um : varios)

/** Aviso ao fim da importação: quantas páginas escaneadas tiveram texto reconhecido. */
export function avisoDoOcr(nome: string, o: ResumoOcr): { texto: string; tipo: 'sucesso' | 'info' | 'erro' } {
  if (o.erro) return { texto: `${nome}: ${o.erro} As páginas escaneadas ficaram só com a imagem.`, tipo: 'erro' }
  const n = o.reconhecidas.length
  const partes = [`${nome}: texto reconhecido em ${n} de ${o.semTexto} ${pl(o.semTexto, 'página escaneada', 'páginas escaneadas')}, no seu navegador e sem gastar créditos.`]
  if (o.cancelado) partes.push('Leitura interrompida: as demais ficaram só com a imagem.')
  else if (o.foraDoLimite > 0) partes.push(`O OCR lê até ${OCR.maxPaginas} páginas por importação; ${o.foraDoLimite} ${pl(o.foraDoLimite, 'ficou', 'ficaram')} só com a imagem.`)
  return { texto: partes.join(' '), tipo: n > 0 ? 'sucesso' : 'info' }
}
