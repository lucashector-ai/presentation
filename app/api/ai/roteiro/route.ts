import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { cobrarIaComUso, type CobrancaIa } from '@/lib/api/creditosServidor'
import { custoDoErro, gerarRoteiroClaude, iaConfigurada, RecusaModelo } from '@/lib/ia/claude'
import { custoRoteiroUsd } from '@/lib/ia/economia'
import { gerarRoteiroLocal, temaSugerido } from '@/lib/ia/local'
import { MODELO_POR_ETAPA } from '@/lib/ia/modelos'
import { PedidoRoteiroSchema, caracteresMaterial, tipoEfetivo, type RespostaRoteiro } from '@/lib/ia/pedido'
import { custoRoteiro, podeGerarTelas } from '@/lib/planos'
import { planoEUso } from '@/lib/api/planoServidor'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'
const aviso = (requestId: string, mensagem: string) => console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem }))

/**
 * POST /api/ai/roteiro — etapa 1 do "Criar com IA": escreve o roteiro (estrutura e texto de cada tela).
 * Com ANTHROPIC_API_KEY usa o Claude (Sonnet); sem chave (ou se a API estiver fora do ar) usa o gerador local.
 * Fora do modo demo exige sessão. O roteiro é grátis (1 crédito = 1 tela, cobrado no design); só material colado
 * acima de 20 mil caracteres é debitado antes de chamar o modelo. O custo medido é gravado sempre (débito ou
 * ai_usos), e roteiros grátis têm um teto diário por espaço contra abuso.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia:${await hashIp(req)}`, 20, 10 * 60_000)
  const pedido = await lerJson(req, PedidoRoteiroSchema)
  const caracteres = caracteresMaterial(pedido)
  const custo = custoRoteiro(pedido.telas, caracteres)
  const tipo = tipoEfetivo(pedido)
  const local = () => responder<RespostaRoteiro>({ roteiro: gerarRoteiroLocal(pedido), gerador: 'local', modelo: null, tipo, tema: pedido.tema ?? temaSugerido(tipo), creditos: 0 }, requestId)

  // créditos só são cobrados quando o modelo de fato escreve o roteiro; se falhar, estorna
  let cobranca: CobrancaIa | null = null
  if (!DEMO) {
    const ctx = await autenticar(req, requestId)
    // teto de roteiros grátis por espaço (≈ ROTEIROS_GRATIS por apresentação × apresentações de um dia intenso)
    limitar(`roteiro-gratis:${ctx.workspaceId}`, 40, 24 * 60 * 60_000)
    // limite de telas por apresentação do plano (a interface já limita; o servidor confere)
    const { plano } = await planoEUso(ctx)
    const limite = podeGerarTelas(plano.planoId, pedido.telas)
    if (!limite.ok) throw new ErroHttp('limite_do_plano', limite.motivo, { upgradePara: limite.upgradePara })
    if (iaConfigurada()) {
      cobranca = await cobrarIaComUso(ctx, custo, { debito: `Roteiro com IA · ${pedido.telas} telas`, estorno: 'Estorno: roteiro com IA não gerado', semSaldo: 'Créditos insuficientes para gerar este roteiro.' }, { acao: 'roteiro', modelo: MODELO_POR_ETAPA.roteiro.id, custoUsd: custoRoteiroUsd(pedido.telas, caracteres).usd })
    }
  }

  if (!iaConfigurada()) return local()
  try {
    const r = await gerarRoteiroClaude(pedido, req.signal)
    await cobranca?.registrar({ modelo: r.modelo, custoUsd: r.custo.usd, uso: r.custo.uso }).catch((e) => aviso(requestId, `registro de uso: ${e instanceof Error ? e.message : e}`))
    return responder<RespostaRoteiro>({ roteiro: r.roteiro, gerador: 'claude', modelo: r.modelo, tipo, tema: pedido.tema ?? r.tema, creditos: cobranca ? custo : 0 }, requestId)
  } catch (e) {
    const gasto = custoDoErro(e)
    if (gasto) await cobranca?.registrar({ modelo: gasto.modelo, custoUsd: gasto.usd, uso: gasto.uso }).catch(() => {})
    await cobranca?.estornar().catch(() => {})
    if (e instanceof RecusaModelo) throw new ErroHttp('entrada_invalida', 'A IA não pôde escrever esse roteiro. Reformule o pedido.')
    // indisponibilidade da API não deve travar o usuário: entrega a estrutura local
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      aviso(requestId, `IA indisponível: ${e.message}`)
      return local()
    }
    throw e
  }
})
