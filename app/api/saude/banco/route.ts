import { bancoConfigurado, sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/**
 * GET /api/saude/banco — prova de vida do Postgres (Neon): faz uma consulta real e uma escrita/leitura
 * numa tabela temporária da própria transação. Não expõe dados nem a string de conexão.
 */
export async function GET() {
  if (!bancoConfigurado()) {
    return Response.json({ ok: false, erro: 'DATABASE_URL não configurada (rode `neon env pull`)' }, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  const inicio = Date.now()
  try {
    const db = sql()
    const [info] = await db`select version() as versao, now() as agora, current_database() as banco`
    // escrita + leitura sem deixar rastro: tabela temporária dentro de uma única transação HTTP
    const [, , lido] = await db.transaction([
      db`create temp table saude_mostra (id int primary key, valor text) on commit drop`,
      db`insert into saude_mostra (id, valor) values (1, 'ok')`,
      db`select valor from saude_mostra where id = 1`,
    ])
    return Response.json(
      { ok: true, banco: info?.banco, versao: String(info?.versao ?? '').split(' ').slice(0, 2).join(' '), agora: info?.agora, escritaLeitura: (lido as { valor: string }[])[0]?.valor === 'ok', ms: Date.now() - inicio },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch (e) {
    console.error(JSON.stringify({ nivel: 'erro', rota: 'saude/banco', mensagem: e instanceof Error ? e.message : 'erro' }))
    return Response.json({ ok: false, erro: 'Falha ao consultar o banco' }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
