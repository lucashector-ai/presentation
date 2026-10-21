import 'server-only'
/**
 * Postgres no Neon. Driver `@neondatabase/serverless` (recomendado pelo Neon para serverless/edge — rotas da
 * Vercel hoje, Cloudflare Workers no plano): HTTP para consultas avulsas e `Pool` (WebSocket) quando precisar
 * de transação interativa. A conexão vem de `DATABASE_URL` (pooled), injetada pelo `neon env pull` / `neon deploy`
 * e validada pelo `parseEnv` contra a política em `neon.ts`. Migrations usam `DATABASE_URL_UNPOOLED` (direta).
 */
import { neon, Pool, type NeonQueryFunction } from '@neondatabase/serverless'
import { parseEnv } from '@neon/env'
import config from '@/neon'

let sqlCache: NeonQueryFunction<false, false> | null = null

/** Há banco configurado neste ambiente? (sem lançar erro) */
export const bancoConfigurado = () => !!process.env.DATABASE_URL

function urlDoBanco(): string {
  // lança PlatformError(EnvNotInjected) dizendo qual variável falta
  return parseEnv(config, ['DATABASE_URL']).postgres.databaseUrl
}

/** Consultas avulsas por HTTP: sql`select * from projects where id = ${id}` */
export function sql(): NeonQueryFunction<false, false> {
  sqlCache ??= neon(urlDoBanco())
  return sqlCache
}

/** Pool por WebSocket para transações interativas (BEGIN … COMMIT). Feche com `await pool.end()` ao terminar. */
export function novoPool(): Pool {
  return new Pool({ connectionString: urlDoBanco() })
}
