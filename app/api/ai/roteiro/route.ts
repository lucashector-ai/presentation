import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { cobrarIa } from '@/lib/api/creditosServidor'
import { gerarRoteiroClaude, iaConfigurada, RecusaModelo } from '@/lib/ia/claude'
import { gerarRoteiroLocal } from '@/lib/ia/local'
import { PedidoRoteiroSchema, type RespostaRoteiro } from '@/lib/ia/pedido'
import { custoDe } from '@/lib/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'

/**
 * POST /api/ai/roteiro — escreve o roteiro de uma apresentação.
 * Com ANTHROPIC_API_KEY usa o Claude; sem chave (ou se a API estiver fora do ar) usa o gerador local.
 * Fora do modo demo exige sessão e debita créditos do workspace antes de chamar o modelo.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia:${await hashIp(req)}`, 20, 10 * 60_000)
  const pedido = await lerJson(req, PedidoRoteiroSchema)
  const custo = custoDe({ roteiro: 1, tela: pedido.telas })

  // créditos só são cobrados quando o modelo de fato escreve o roteiro; se falhar, estorna
  let estornar = async () => {}
  if (!DEMO) {
    const ctx = await autenticar(req, requestId)
    if (iaConfigurada()) {
      estornar = await cobrarIa(ctx, custo, { debito: 'Roteiro com IA', estorno: 'Estorno: roteiro com IA não gerado', semSaldo: 'Créditos insuficientes para gerar este roteiro.' })
    }
  }

  if (!iaConfigurada()) {
    return responder<RespostaRoteiro>({ roteiro: gerarRoteiroLocal(pedido), gerador: 'local', modelo: null }, requestId)
  }
  try {
    const { roteiro, modelo } = await gerarRoteiroClaude(pedido, req.signal)
    return responder<RespostaRoteiro>({ roteiro, gerador: 'claude', modelo }, requestId)
  } catch (e) {
    await estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde escrever esse roteiro. Reformule o pedido.')
    // indisponibilidade da API não deve travar o usuário: entrega a estrutura local
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem: `IA indisponível: ${e.message}` }))
      return responder<RespostaRoteiro>({ roteiro: gerarRoteiroLocal(pedido), gerador: 'local', modelo: null }, requestId)
    }
    throw e
  }
})
