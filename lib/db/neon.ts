import 'server-only'
/**
 * Conexão com o Neon Postgres. `sql()` usa o driver HTTP (uma consulta por requisição, ideal para
 * serverless e Workers); `novoPool()` usa WebSocket, para transações interativas.
 * A URL vem de `neon deploy` / `neon env pull` (.env.local). Não importamos `neon.ts` aqui: ele é
 * configuração do CLI e levaria o carregador de config para o bundle do servidor.
 */
import { neon, Pool, type NeonQueryFunction } from '@neondatabase/serverless'

let sqlCache: NeonQueryFunction<false, false> | null = null

export const bancoConfigurado = () => !!process.env.DATABASE_URL

function urlDoBanco(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não definida (rode `neon env pull`).')
  return url
}

export function sql(): NeonQueryFunction<false, false> {
  // no-store: o Next 14 guarda em cache até fetch POST, e o driver HTTP consulta via fetch
  sqlCache ??= neon(urlDoBanco(), { fetchOptions: { cache: 'no-store' } })
  return sqlCache
}

export function novoPool(): Pool {
  return new Pool({ connectionString: urlDoBanco() })
}
