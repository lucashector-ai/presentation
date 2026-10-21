import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { cobrarIaComUso, type CobrancaIa } from '@/lib/api/creditosServidor'
import { custoDoErro, iaConfigurada, RecusaModelo, refazerTelaClaude } from '@/lib/ia/claude'
import { custoRefazerTelaUsd } from '@/lib/ia/economia'
import { MODELO_POR_ETAPA } from '@/lib/ia/modelos'
import { PedidoTelaSchema, refazerTelaLocal, type RespostaTela } from '@/lib/ia/tela'
import { custoDe } from '@/lib/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'

/**
 * POST /api/ai/tela — refaz o conteúdo de uma tela (título, texto, itens, notas) no mesmo layout,
 * considerando os títulos das outras telas e uma instrução opcional ("deixe mais direto").
 * Com ANTHROPIC_API_KEY usa o Claude; sem chave (ou se a API estiver fora do ar) usa as regras locais.
 * Fora do modo demo exige sessão e debita "Refazer uma tela" antes de chamar o modelo.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia-editor:${await hashIp(req)}`, 60, 10 * 60_000)
  const pedido = await lerJson(req, PedidoTelaSchema)
  const custo = custoDe({ refazerTela: 1 })

  // créditos só são cobrados quando o modelo de fato escreve; se falhar, estorna
  let cobranca: CobrancaIa | null = null
  if (!DEMO) {
    const ctx = await autenticar(req, requestId)
    if (iaConfigurada()) {
      cobranca = await cobrarIaComUso(ctx, custo, { debito: 'Refazer tela com IA', estorno: 'Estorno: tela com IA não gerada', semSaldo: 'Créditos insuficientes para refazer esta tela.' }, { acao: 'tela', modelo: MODELO_POR_ETAPA.tela.id, custoUsd: custoRefazerTelaUsd().usd })
    }
  }

  if (!iaConfigurada()) {
    return responder<RespostaTela>({ ...refazerTelaLocal(pedido), gerador: 'local', modelo: null }, requestId)
  }
  try {
    const { tela, modelo, custo: gasto } = await refazerTelaClaude(pedido, req.signal)
    await cobranca?.registrar({ modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    return responder<RespostaTela>({ tela, gerador: 'claude', modelo }, requestId)
  } catch (e) {
    const gasto = custoDoErro(e)
    if (gasto) await cobranca?.registrar({ modelo: gasto.modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    await cobranca?.estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde refazer essa tela. Mude a instrução e tente de novo.')
    // indisponibilidade da API não deve travar o usuário: entrega a versão local
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem: `IA indisponível: ${e.message}` }))
      return responder<RespostaTela>({ ...refazerTelaLocal(pedido), gerador: 'local', modelo: null }, requestId)
    }
    throw e
  }
})
