import { ehUuid, grantValido, hashIp, limitar, rota, ErroHttp } from '@/lib/api/servidor'
import { linkAtivo } from '@/lib/api/compartilhamentoServidor'
import { chaveDaVariante, servirMidia } from '@/lib/api/midiaServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/**
 * GET /api/share/:token/midias/:id — mídia para convidado, sem login. Vale só enquanto o link estiver ativo
 * (revogar corta na hora), com grant quando o link tem senha, e só para mídias que aparecem na versão
 * PUBLICADA do projeto do link. Qualquer falha responde 404 igual.
 */
export const GET = rota<{ token: string; id: string }>(async (req, { params }) => {
  limitar(`share-midia:${await hashIp(req)}`, 600, 60_000)
  const nada = new ErroHttp('nao_encontrado', 'Mídia indisponível')
  if (!ehUuid(params.id)) throw nada
  const link = await linkAtivo(params.token)
  if (!link) throw nada
  if (link.password_hash && !(await grantValido(req, link.id))) throw nada
  const [a] = await sql()`
    select a.storage_key, a.mime, a.name, a.metadata_json
    from public.assets a
    join public.project_snapshots s on s.project_id = ${link.project_id} and s.revision = ${link.published_revision}
    where a.id = ${params.id} and a.workspace_id = ${link.workspace_id} and a.status = 'ready' and a.deleted_at is null
      and position(${`"${params.id}"`} in s.content_json::text) > 0`
  if (!a) throw nada
  const chave = chaveDaVariante(req, a as { storage_key: string; metadata_json: { thumb_key?: string; poster_key?: string } })
  if (!chave) throw nada
  // cache curto e privado: revogar o link precisa valer logo também para quem já abriu
  return servirMidia(req, { chave, mime: chave === a.storage_key ? (a.mime as string) : null, nome: a.name as string }, 'private, max-age=300')
})
