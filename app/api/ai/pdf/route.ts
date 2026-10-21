import { Buffer } from 'node:buffer'
import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, limitar, responder, rota } from '@/lib/api/servidor'
import { cobrarIaComUso, type CobrancaIa } from '@/lib/api/creditosServidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { custoDoErro, iaConfigurada, lerPdfClaude, RecusaModelo } from '@/lib/ia/claude'
import { custoLeituraPdfUsd } from '@/lib/ia/economia'
import { MODELO_POR_ETAPA } from '@/lib/ia/modelos'
import { inspecionarPdf, LEITURA_PDF, lerListaPaginas, type RespostaPdf } from '@/lib/ia/pdf'
import { ErroCorpo, lerTudo } from '@/lib/midia/upload'
import { custoLeituraPdf, podeLerPdfComIa } from '@/lib/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'
const aviso = (requestId: string, mensagem: string) => console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem }))

/**
 * POST /api/ai/pdf?paginas=3,4,7 — corpo = PDF (application/pdf) com SÓ as páginas sem texto, montado no
 * navegador (lib/pdf/navegador.ts); `paginas` = os números delas no arquivo original.
 * Confere tamanho, estrutura (sem script/anexo/formulário) e o número de páginas (é por ele que se cobra),
 * debita a leitura (parte fixa + por página) antes de chamar o Claude e grava o custo medido depois; se falhar,
 * estorna. O PDF só existe na memória desta requisição: não vai para o armazenamento, o banco ou os logs.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia:${await hashIp(req)}`, 20, 10 * 60_000)
  const paginas = lerListaPaginas(new URL(req.url).searchParams.get('paginas'))
  if (!paginas) throw new ErroHttp('entrada_invalida', `Informe as páginas a ler (até ${LEITURA_PDF.maxPaginas} por vez).`)
  const mime = (req.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase()
  if (mime !== 'application/pdf') throw new ErroHttp('entrada_invalida', 'Envie o PDF (application/pdf).')
  const declarado = Number(req.headers.get('content-length') ?? 0)
  if (!declarado) throw new ErroHttp('entrada_invalida', 'Envie o tamanho do arquivo (Content-Length).')
  if (declarado > LEITURA_PDF.maxBytes) throw new ErroHttp('arquivo_grande', 'O PDF passou do tamanho que a IA lê de uma vez. Envie menos páginas.')

  const ctx = DEMO ? null : await autenticar(req, requestId)
  if (ctx) {
    const { plano } = await planoEUso(ctx)
    const d = podeLerPdfComIa(plano.planoId, paginas.length)
    if (!d.ok) throw new ErroHttp('limite_do_plano', d.motivo, { upgradePara: d.upgradePara })
  }
  if (!iaConfigurada()) throw new ErroHttp('indisponivel', 'A leitura de PDF escaneado usa a IA, que não está ligada neste ambiente. Use um PDF com texto ou cole o conteúdo em "Colar texto".')
  if (!req.body) throw new ErroHttp('entrada_invalida', 'PDF vazio.')

  let bytes: Uint8Array
  try {
    bytes = await lerTudo(req.body, Math.min(declarado, LEITURA_PDF.maxBytes))
  } catch (e) {
    if (e instanceof ErroCorpo) throw new ErroHttp('entrada_invalida', 'O PDF chegou com tamanho diferente do informado.')
    throw e
  }
  if (bytes.byteLength !== declarado) throw new ErroHttp('entrada_invalida', 'O PDF chegou com tamanho diferente do informado.')
  const insp = inspecionarPdf(bytes)
  if (!insp.ok) throw new ErroHttp('entrada_invalida', insp.motivo)
  if (insp.paginas !== paginas.length) throw new ErroHttp('entrada_invalida', 'O PDF não corresponde às páginas informadas.')

  const custo = custoLeituraPdf(paginas.length)
  let cobranca: CobrancaIa | null = null
  if (ctx) {
    cobranca = await cobrarIaComUso(ctx, custo, { debito: `Leitura de PDF com IA · ${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}`, estorno: 'Estorno: leitura de PDF não concluída', semSaldo: 'Créditos insuficientes para a IA ler estas páginas.' }, { acao: 'pdf', modelo: MODELO_POR_ETAPA.pdf.id, custoUsd: custoLeituraPdfUsd(paginas.length).usd })
  }
  try {
    const r = await lerPdfClaude(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64'), paginas, req.signal)
    await cobranca?.registrar({ modelo: r.modelo, custoUsd: r.custo.usd, uso: r.custo.uso }).catch((e) => aviso(requestId, `registro de uso: ${e instanceof Error ? e.message : e}`))
    return responder<RespostaPdf>({ paginas: r.paginas, caracteres: r.paginas.reduce((s, p) => s + p.texto.length, 0), creditos: cobranca ? custo : 0, modelo: r.modelo, gerador: 'claude' }, requestId)
  } catch (e) {
    const gasto = custoDoErro(e)
    if (gasto) await cobranca?.registrar({ modelo: gasto.modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    await cobranca?.estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde ler este PDF.')
    if (e instanceof Anthropic.BadRequestError) throw new ErroHttp('entrada_invalida', 'A IA não conseguiu abrir este PDF. Tente com menos páginas.')
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      aviso(requestId, `IA indisponível: ${e.message}`)
      throw new ErroHttp('indisponivel', 'A IA está indisponível agora. Nenhum crédito foi cobrado; tente de novo em instantes.')
    }
    throw e
  }
})
