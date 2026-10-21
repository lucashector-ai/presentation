import 'server-only'
/**
 * Bindings do Cloudflare Worker. VERSÃO MÍNIMA para compilar: a frente da hospedagem (vinext) entrega a
 * implementação real, que devolve o binding R2 `MIDIAS` dentro do Worker e null fora dele.
 */
import type { BucketR2 } from '@/lib/armazenamento'

export function obterBucketMidias(): BucketR2 | null {
  return null
}
