import 'server-only'
/**
 * Resumo do manual da marca pelo Claude (modelo da etapa "marca" em lib/ia/modelos.ts, saída estruturada): o
 * mesmo cliente e padrão de lib/ia/claude.ts (custo medido por resposta, recusa vira RecusaModelo, custo anexado
 * ao erro). Fica neste módulo para não crescer o claude.ts das etapas da apresentação.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { RecusaModelo, type CustoIa } from '@/lib/ia/claude'
import { CONFIG_ETAPA, MODELO_POR_ETAPA, custoDaResposta } from '@/lib/ia/modelos'
import { INSTRUCOES_MANUAL, mensagemManual, normalizarResumo, ResumoModeloSchema, type PedidoResumoManual } from './resumo'
import type { PerfilMarca } from './perfil'

let cliente: Anthropic | null = null
const obterCliente = () => (cliente ??= new Anthropic({ maxRetries: 2, timeout: 120_000 }))

export async function resumirManualClaude(p: PedidoResumoManual, sinal?: AbortSignal): Promise<{ perfil: PerfilMarca; modelo: string; custo: CustoIa }> {
  const m = MODELO_POR_ETAPA.marca
  const resposta = await obterCliente().beta.messages.parse(
    {
      model: m.id,
      max_tokens: CONFIG_ETAPA.marca.maxTokens,
      ...(m.aceitaReserva ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      system: INSTRUCOES_MANUAL,
      messages: [{ role: 'user', content: mensagemManual(p) }],
      output_config: { format: betaZodOutputFormat(ResumoModeloSchema), effort: CONFIG_ETAPA.marca.esforco },
    },
    { signal: sinal }
  )
  const custo: CustoIa = { ...custoDaResposta(resposta.usage, m), modelo: resposta.model }
  if (resposta.stop_reason === 'refusal') throw Object.assign(new RecusaModelo('O modelo não aceitou resumir este manual.'), { custo })
  if (!resposta.parsed_output) throw Object.assign(new Error(`Resumo do manual sem saída estruturada (stop_reason: ${resposta.stop_reason})`), { custo })
  return { perfil: normalizarResumo(resposta.parsed_output, p), modelo: resposta.model, custo }
}
