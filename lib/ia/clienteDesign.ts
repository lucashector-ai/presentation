'use client'
/**
 * Chamada do navegador à rota POST /api/ai/design (etapa de design do "Criar com IA"), no mesmo envelope e
 * com o mesmo erro tipado das outras rotas (lib/api/cliente.ts). A sessão vai no cookie (mesma origem).
 */
import type { z } from 'zod'
import { ErroApiCliente } from '@/lib/api/cliente'
import type { Envelope } from '@/lib/api/contratos'
import type { PedidoDesignSchema, RespostaDesign } from './design'

export async function desenharTelas(b: z.input<typeof PedidoDesignSchema>, sinal?: AbortSignal): Promise<RespostaDesign> {
  const resp = await fetch('/api/ai/design', { method: 'POST', body: JSON.stringify(b), signal: sinal, credentials: 'same-origin', headers: { 'content-type': 'application/json' } })
  const env = (await resp.json().catch(() => null)) as Envelope<RespostaDesign> | null
  if (!env) throw new ErroApiCliente('erro_interno', 'Resposta inválida do servidor', undefined, resp.status)
  if (env.error) throw new ErroApiCliente(env.error.code, env.error.message, env.error.details, resp.status)
  return env.data as RespostaDesign
}
