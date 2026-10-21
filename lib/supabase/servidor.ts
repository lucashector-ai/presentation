import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de servidor (rotas /api e server actions). Usa a service role: toda autorização
 * por workspace é feita no código do servidor ANTES de qualquer consulta (ver lib/api/autorizacao.ts).
 * Nunca importar este arquivo em componentes de cliente.
 */
export function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error('Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}
