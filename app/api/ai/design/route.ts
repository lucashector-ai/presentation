import Anthropic from '@anthropic-ai/sdk'
import { autenticar, ErroHttp, hashIp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { cobrarIaComUso, type CobrancaIa } from '@/lib/api/creditosServidor'
import { desenharTelasClaude, iaConfigurada } from '@/lib/ia/claude'
import { PedidoDesignSchema, type RespostaDesign } from '@/lib/ia/design'
import { resolverTema } from '@/lib/ia/designSystem'
import { desenharLocal } from '@/lib/ia/desenhoLocal'
import { custoDesenhoUsd } from '@/lib/ia/economia'
import { modeloDoDesenho } from '@/lib/ia/modelos'
import { custoDesenho, DIVISAO_TELA, podeGerarTelas } from '@/lib/planos'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1'
const aviso = (requestId: string, mensagem: string) => console.error(JSON.stringify({ nivel: 'aviso', requestId, mensagem }))

/**
 * POST /api/ai/design — etapa 2 do "Criar com IA": desenha as telas pedidas do roteiro (até 6 por pedido)
 * com o design system: componente, variante, fundo, ênfase e texto ajustado ao layout.
 * Com ANTHROPIC_API_KEY usa o Claude (Opus, uma chamada por tela, catálogo e roteiro em cache); sem chave usa o
 * desenho local. Fora do modo demo exige sessão e debita o desenho de cada tela pedida; tela que falhar volta
 * com o desenho local e o crédito dela é estornado.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  limitar(`ia-design:${await hashIp(req)}`, 120, 10 * 60_000)
  const pedido = await lerJson(req, PedidoDesignSchema)
  const n = pedido.indices.length
  const custo = custoDesenho(n)
  const locais = () => desenharLocal(pedido.roteiro, { story: pedido.formato === 'story', estilo: pedido.estilo, tema: resolverTema(pedido.tema, pedido.marca), direcoes: pedido.direcoes })
  const local = () => {
    const d = locais()
    return responder<RespostaDesign>({ telas: pedido.indices.map((i) => ({ indice: i, desenho: d[i]!, gerador: 'local' })), gerador: 'local', modelo: null, creditos: 0 }, requestId)
  }

  let cobranca: CobrancaIa | null = null
  if (!DEMO) {
    const ctx = await autenticar(req, requestId)
    // telas acrescentadas no roteiro também respeitam o limite de telas por apresentação do plano
    const { plano } = await planoEUso(ctx)
    const limite = podeGerarTelas(plano.planoId, pedido.roteiro.telas.length)
    if (!limite.ok) throw new ErroHttp('limite_do_plano', limite.motivo, { upgradePara: limite.upgradePara })
    if (iaConfigurada()) {
      cobranca = await cobrarIaComUso(ctx, custo, { debito: `Design com IA · ${n} ${n === 1 ? 'tela' : 'telas'}`, estorno: 'Estorno: design com IA não gerado', semSaldo: 'Créditos insuficientes para desenhar estas telas.' }, { acao: 'design', modelo: modeloDoDesenho(pedido.qualidade).id, custoUsd: custoDesenhoUsd(n, pedido.roteiro.telas.length).usd })
    }
  }

  if (!iaConfigurada()) return local()
  try {
    const r = await desenharTelasClaude(pedido, req.signal)
    if (r.custo) await cobranca?.registrar({ modelo: r.modelo, custoUsd: r.custo.usd, uso: r.custo.uso }).catch((e) => aviso(requestId, `registro de uso: ${e instanceof Error ? e.message : e}`))
    const falhas = r.telas.filter((t) => !t.desenho)
    for (const f of falhas) aviso(requestId, `design da tela ${f.indice + 1} falhou: ${f.erro instanceof Error ? f.erro.message : String(f.erro)}`)
    if (falhas.length) await cobranca?.estornar(falhas.length * DIVISAO_TELA.desenho).catch(() => {})
    const d = falhas.length ? locais() : []
    return responder<RespostaDesign>({
      telas: r.telas.map((t) => (t.desenho ? { indice: t.indice, desenho: t.desenho, gerador: 'claude' as const } : { indice: t.indice, desenho: d[t.indice]!, gerador: 'local' as const })),
      gerador: falhas.length === n ? 'local' : 'claude',
      modelo: falhas.length === n ? null : r.modelo,
      creditos: cobranca ? custo - falhas.length * DIVISAO_TELA.desenho : 0,
    }, requestId)
  } catch (e) {
    await cobranca?.estornar().catch(() => {})
    // indisponibilidade da API não deve travar o usuário: entrega o desenho local
    if (e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError) {
      aviso(requestId, `IA indisponível: ${e.message}`)
      return local()
    }
    throw e
  }
})
