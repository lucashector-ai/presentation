'use client'
/**
 * Chamada do navegador à rota POST /api/ai/design (etapa de design do "Criar com IA"), pelo mesmo cliente das
 * outras rotas (lib/api/cliente.ts): mesmo envelope, erro tipado e repetição quando o servidor não conseguiu
 * conferir a sessão (503 sessao_indisponivel). A sessão vai no cookie (mesma origem).
 */
import type { z } from 'zod'
import { api } from '@/lib/api/cliente'
import type { PedidoDesignSchema, RespostaDesign } from './design'

export function desenharTelas(b: z.input<typeof PedidoDesignSchema>, sinal?: AbortSignal): Promise<RespostaDesign> {
  return api.ia.design(b, sinal)
}
