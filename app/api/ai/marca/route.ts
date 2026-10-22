import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { cobrarIaComUso, type CobrancaIa } from '@/lib/api/creditosServidor'
import { custoDoErro, iaConfigurada, RecusaModelo } from '@/lib/ia/claude'
import { custoResumoManualUsd } from '@/lib/ia/economia'
import { MODELO_POR_ETAPA } from '@/lib/ia/modelos'
import { resumirManualClaude } from '@/lib/marca/claude'
import { PedidoResumoManualSchema, perfilLocal, type RespostaResumoManual } from '@/lib/marca/resumo'
import { custoResumoManual } from '@/lib/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'
const aviso = (requestId: string, mensagem: string) => console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem }))

/**
 * POST /api/ai/marca — resumo do manual da marca pela IA (opcional; a leitura sem IA é feita no navegador):
 * recebe os trechos do manual que falam de marca (até 24 mil caracteres, filtrados no navegador) e o perfil já
 * reconhecido sem IA, e devolve o perfil estruturado. Fora do modo demo exige sessão e debita antes de chamar o
 * modelo (1 crédito a cada 12 mil caracteres, mínimo 1), com estorno se falhar. No demo (ou sem chave da API) o
 * resumo é simulado de forma determinística, sem rede. O texto só existe nesta requisição: não é guardado.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia:${await hashIp(req)}`, 20, 10 * 60_000)
  const pedido = await lerJson(req, PedidoResumoManualSchema)
  const custo = custoResumoManual(pedido.texto.length)
  const local = () => responder<RespostaResumoManual>({ perfil: perfilLocal(pedido), gerador: 'local', modelo: null, creditos: 0 }, requestId)
  if (DEMO) return local()

  const ctx = await autenticar(req, requestId)
  if (!iaConfigurada()) throw new ErroHttp('indisponivel', 'O resumo com IA não está ligado neste ambiente. O que foi lido do manual sem IA continua valendo: revise e aplique.')
  const cobranca: CobrancaIa = await cobrarIaComUso(ctx, custo, { debito: 'Resumo do manual da marca com IA', estorno: 'Estorno: resumo do manual não concluído', semSaldo: 'Créditos insuficientes para resumir o manual.' }, { acao: 'marca', modelo: MODELO_POR_ETAPA.marca.id, custoUsd: custoResumoManualUsd(pedido.texto.length).usd })
  try {
    const r = await resumirManualClaude(pedido, req.signal)
    await cobranca.registrar({ modelo: r.modelo, custoUsd: r.custo.usd, uso: r.custo.uso }).catch((e) => aviso(requestId, `registro de uso: ${e instanceof Error ? e.message : e}`))
    return responder<RespostaResumoManual>({ perfil: r.perfil, gerador: 'claude', modelo: r.modelo, creditos: custo }, requestId)
  } catch (e) {
    const gasto = custoDoErro(e)
    if (gasto) await cobranca.registrar({ modelo: gasto.modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    await cobranca.estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde resumir este manual.')
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      aviso(requestId, `IA indisponível: ${e.message}`)
      throw new ErroHttp('indisponivel', 'A IA está indisponível agora. Nenhum crédito foi cobrado; tente de novo em instantes.')
    }
    throw e
  }
})
