#!/usr/bin/env node
/**
 * Aplica as migrações SQL de db/migrations no Postgres (Neon), em ordem, uma transação por arquivo.
 * As aplicadas ficam em public.schema_migrations (nome + sha256); arquivo já aplicado e depois editado é erro.
 *
 *   npm run db:migrar                 aplica as pendentes no branch de DATABASE_URL_UNPOOLED (.env.local)
 *   npm run db:migrar -- --status     só lista aplicadas/pendentes
 *   DATABASE_URL_UNPOOLED=... npm run db:migrar   (ex.: um branch de teste)
 *
 * Usa a conexão DIRETA (sem pooler): migrações precisam de sessão (transação, advisory lock).
 * Nunca imprime a string de conexão.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { neonConfig, Pool } from '@neondatabase/serverless'

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
const soStatus = process.argv.includes('--status')

// .env.local / .env sem sobrescrever o que já veio do ambiente
for (const arquivo of ['.env.local', '.env']) {
  try { process.loadEnvFile(arquivo) } catch { /* arquivo ausente */ }
}

const url = process.env.DATABASE_URL_UNPOOLED
if (!url) {
  console.error('DATABASE_URL_UNPOOLED não definida (rode `neon env pull`). Migrações usam a conexão direta, não a do pooler.')
  process.exit(1)
}
if (/-pooler\./.test(new URL(url).hostname)) {
  console.error('DATABASE_URL_UNPOOLED aponta para o pooler; use a conexão direta para migrar.')
  process.exit(1)
}

// Node 22+ e Workers têm WebSocket global; no Node 20 cai para o pacote `ws`.
neonConfig.webSocketConstructor = globalThis.WebSocket ?? (await import('ws')).default

const sha256 = (texto) => createHash('sha256').update(texto).digest('hex')
const host = new URL(url).hostname.split('.')[0]

const pool = new Pool({ connectionString: url })
const cliente = await pool.connect()
let codigo = 0
try {
  await cliente.query(`create table if not exists public.schema_migrations (
    nome text primary key,
    sha256 text not null,
    aplicada_em timestamptz not null default now()
  )`)
  // um migrador por vez no mesmo banco
  await cliente.query('select pg_advisory_lock(hashtext($1))', ['mostra:migracoes'])

  const arquivos = (await readdir(PASTA)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
  const { rows } = await cliente.query('select nome, sha256 from public.schema_migrations')
  const aplicadas = new Map(rows.map((r) => [r.nome, r.sha256]))

  console.log(`Banco: ${host} — ${arquivos.length} migração(ões) em db/migrations`)
  for (const nome of arquivos) {
    const sqlArquivo = await readFile(path.join(PASTA, nome), 'utf8')
    const hash = sha256(sqlArquivo)
    const anterior = aplicadas.get(nome)
    if (anterior) {
      if (anterior !== hash) {
        console.error(`✘ ${nome} já foi aplicada, mas o arquivo mudou. Nunca edite migração aplicada: crie uma nova.`)
        codigo = 1
        break
      }
      console.log(`· ${nome} (já aplicada)`)
      continue
    }
    if (soStatus) { console.log(`○ ${nome} (pendente)`); continue }
    const inicio = Date.now()
    try {
      await cliente.query('begin')
      await cliente.query(sqlArquivo)
      await cliente.query('insert into public.schema_migrations (nome, sha256) values ($1, $2)', [nome, hash])
      await cliente.query('commit')
      console.log(`✔ ${nome} (${Date.now() - inicio} ms)`)
    } catch (e) {
      await cliente.query('rollback').catch(() => {})
      console.error(`✘ ${nome}: ${e instanceof Error ? e.message : e}`)
      codigo = 1
      break
    }
  }
} finally {
  await cliente.query('select pg_advisory_unlock(hashtext($1))', ['mostra:migracoes']).catch(() => {})
  cliente.release()
  await pool.end()
}
process.exit(codigo)
