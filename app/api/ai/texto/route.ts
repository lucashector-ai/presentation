import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { iaConfigurada, RecusaModelo, reescreverTextoClaude } from '@/lib/ia/claude'
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
  let estornar = async () => {}
  if (!DEMO) {
    const ctx = await autenticar(req, requestId)
    if (iaConfigurada()) {
      const { error } = await ctx.sb.rpc('debitar_creditos', { p_workspace: ctx.workspaceId, p_custo: custo, p_motivo: 'Reescrever texto com IA' })
      if (error) throw error.message.includes('saldo_insuficiente') ? new ErroHttp('limite_do_plano', 'Créditos insuficientes para reescrever este texto.', { custo }) : error
      estornar = async () => {
        await ctx.sb.rpc('debitar_creditos', { p_workspace: ctx.workspaceId, p_custo: -custo, p_motivo: 'Estorno: texto com IA não gerado' })
      }
    }
  }

  if (!iaConfigurada()) {
    return responder<RespostaTexto>({ ...reescreverLocal(pedido), gerador: 'local', modelo: null }, requestId)
  }
  try {
    const { textos, modelo } = await reescreverTextoClaude(pedido, req.signal)
    return responder<RespostaTexto>({ textos, gerador: 'claude', modelo }, requestId)
  } catch (e) {
    await estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde reescrever esse texto. Ajuste o conteúdo e tente de novo.')
    // indisponibilidade da API não deve travar o usuário: entrega a reescrita local
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem: `IA indisponível: ${e.message}` }))
      return responder<RespostaTexto>({ ...reescreverLocal(pedido), gerador: 'local', modelo: null }, requestId)
    }
    throw e
  }
})
