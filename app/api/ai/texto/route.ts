import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { cobrarIaComUso, type CobrancaIa } from '@/lib/api/creditosServidor'
import { custoDoErro, iaConfigurada, RecusaModelo, reescreverTextoClaude } from '@/lib/ia/claude'
import { custoReescreverUsd } from '@/lib/ia/economia'
import { MODELO_POR_ETAPA } from '@/lib/ia/modelos'
import { PedidoTextoSchema, reescreverLocal, type RespostaTexto } from '@/lib/ia/texto'
import { custoDe } from '@/lib/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'

/**
 * POST /api/ai/texto — reescreve (ou traduz) os textos de uma tela: mais curto, impactante, formal, simples, corrigir.
 * Com ANTHROPIC_API_KEY usa o Claude; sem chave (ou se a API estiver fora do ar) usa as regras locais.
 * Fora do modo demo exige sessão e debita "Reescrever o texto de uma tela" antes de chamar o modelo.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia-editor:${await hashIp(req)}`, 60, 10 * 60_000)
  const pedido = await lerJson(req, PedidoTextoSchema)
  const custo = custoDe({ reescrever: 1 })

  // créditos só são cobrados quando o modelo de fato escreve; se falhar, estorna
  let cobranca: CobrancaIa | null = null
  if (!DEMO) {
    const ctx = await autenticar(req, requestId)
    if (iaConfigurada()) {
      cobranca = await cobrarIaComUso(ctx, custo, { debito: 'Reescrever texto com IA', estorno: 'Estorno: texto com IA não gerado', semSaldo: 'Créditos insuficientes para reescrever este texto.' }, { acao: 'texto', modelo: MODELO_POR_ETAPA.texto.id, custoUsd: custoReescreverUsd().usd })
    }
  }

  if (!iaConfigurada()) {
    return responder<RespostaTexto>({ ...reescreverLocal(pedido), gerador: 'local', modelo: null }, requestId)
  }
  try {
    const { textos, modelo, custo: gasto } = await reescreverTextoClaude(pedido, req.signal)
    await cobranca?.registrar({ modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    return responder<RespostaTexto>({ textos, gerador: 'claude', modelo }, requestId)
  } catch (e) {
    const gasto = custoDoErro(e)
    if (gasto) await cobranca?.registrar({ modelo: gasto.modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    await cobranca?.estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde reescrever esse texto. Ajuste o conteúdo e tente de novo.')
    // indisponibilidade da API não deve travar o usuário: entrega a reescrita local
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem: `IA indisponível: ${e.message}` }))
      return responder<RespostaTexto>({ ...reescreverLocal(pedido), gerador: 'local', modelo: null }, requestId)
    }
    throw e
  }
})
