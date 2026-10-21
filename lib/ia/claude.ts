import 'server-only'
/**
 * Chamadas ao Claude: roteiro da apresentação (Criar com IA) e as ações dentro do editor (reescrever
 * o texto de uma tela, refazer uma tela). Saída estruturada validada pelo Zod e normalizada aos limites
 * do schema antes de voltar ao cliente.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { normalizarRoteiro, RoteiroModeloSchema, type PedidoRoteiro } from './pedido'
import { INSTRUCOES_SISTEMA, mensagemUsuario } from './prompt'
import type { Roteiro } from './roteiro'
import { INSTRUCOES_TEXTO, mensagemTexto, normalizarTextos, TextosModeloSchema, type PedidoTexto, type TextoReescrito } from './texto'
import { INSTRUCOES_TELA, mensagemTela, normalizarTela, TelaModeloSchema, type ConteudoTela, type PedidoTela } from './tela'

import { MODELO_POR_ETAPA, type ModeloIA } from './modelos'

/** @deprecated use MODELO_POR_ETAPA (lib/ia/modelos.ts) */
export const MODELO_ROTEIRO = MODELO_POR_ETAPA.roteiro.id

/** Reserva no servidor (se o modelo recusar por política, a API tenta o recomendado na mesma chamada). */
const reserva = (m: ModeloIA) => (m.aceitaReserva ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})

export class RecusaModelo extends Error {}

let cliente: Anthropic | null = null
export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY

export async function gerarRoteiroClaude(p: PedidoRoteiro, sinal?: AbortSignal): Promise<{ roteiro: Roteiro; modelo: string }> {
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 120_000 })
  const resposta = await cliente.beta.messages.parse(
    {
      model: MODELO_POR_ETAPA.roteiro.id,
      max_tokens: 16000,
      ...reserva(MODELO_POR_ETAPA.roteiro),
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

/** "Reescrever o texto de uma tela": devolve os mesmos ids, com o texto reescrito. */
export async function reescreverTextoClaude(p: PedidoTexto, sinal?: AbortSignal): Promise<{ textos: TextoReescrito[]; modelo: string }> {
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 120_000 })
  const resposta = await cliente.beta.messages.parse(
    {
      model: MODELO_POR_ETAPA.texto.id,
      max_tokens: 8000,
      ...reserva(MODELO_POR_ETAPA.texto),
      system: INSTRUCOES_TEXTO,
      messages: [{ role: 'user', content: mensagemTexto(p) }],
      output_config: { format: betaZodOutputFormat(TextosModeloSchema), effort: 'low' },
    },
    { signal: sinal }
  )
  if (resposta.stop_reason === 'refusal') throw new RecusaModelo('O modelo não aceitou este pedido.')
  if (!resposta.parsed_output) throw new Error(`Texto sem saída estruturada (stop_reason: ${resposta.stop_reason})`)
  return { textos: normalizarTextos(resposta.parsed_output, p), modelo: resposta.model }
}

/** "Refazer uma tela": novo título, texto, itens e notas para as caixas que a tela já tem. */
export async function refazerTelaClaude(p: PedidoTela, sinal?: AbortSignal): Promise<{ tela: ConteudoTela; modelo: string }> {
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 120_000 })
  const resposta = await cliente.beta.messages.parse(
    {
      model: MODELO_POR_ETAPA.tela.id,
      max_tokens: 4000,
      ...reserva(MODELO_POR_ETAPA.tela),
      system: INSTRUCOES_TELA,
      messages: [{ role: 'user', content: mensagemTela(p) }],
      output_config: { format: betaZodOutputFormat(TelaModeloSchema), effort: 'medium' },
    },
    { signal: sinal }
  )
  if (resposta.stop_reason === 'refusal') throw new RecusaModelo('O modelo não aceitou este pedido.')
  if (!resposta.parsed_output) throw new Error(`Tela sem saída estruturada (stop_reason: ${resposta.stop_reason})`)
  return { tela: normalizarTela(resposta.parsed_output, p), modelo: resposta.model }
}
