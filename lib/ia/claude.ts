import 'server-only'
/**
 * Chamada ao Claude para escrever o roteiro. Saída estruturada validada pelo Zod
 * (`RoteiroModeloSchema`) e normalizada aos limites do schema antes de virar documento.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { normalizarRoteiro, RoteiroModeloSchema, type PedidoRoteiro } from './pedido'
import { INSTRUCOES_SISTEMA, mensagemUsuario } from './prompt'
import type { Roteiro } from './roteiro'

export const MODELO_ROTEIRO = 'claude-opus-5-5'

export class RecusaModelo extends Error {}

let cliente: Anthropic | null = null
export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY

export async function gerarRoteiroClaude(p: PedidoRoteiro, sinal?: AbortSignal): Promise<{ roteiro: Roteiro; modelo: string }> {
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 120_000 })
  const resposta = await cliente.beta.messages.parse(
    {
      model: MODELO_ROTEIRO,
      max_tokens: 16000,
      // se o modelo recusar por política, a API tenta o modelo reserva recomendado na mesma chamada
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: INSTRUCOES_SISTEMA,
      messages: [{ role: 'user', content: mensagemUsuario(p) }],
      output_config: { format: betaZodOutputFormat(RoteiroModeloSchema), effort: 'medium' },
    },
    { signal: sinal }
  )
  if (resposta.stop_reason === 'refusal') throw new RecusaModelo('O modelo não aceitou este pedido.')
  if (!resposta.parsed_output) throw new Error(`Roteiro sem saída estruturada (stop_reason: ${resposta.stop_reason})`)
  return { roteiro: normalizarRoteiro(resposta.parsed_output, p.telas), modelo: resposta.model }
}
