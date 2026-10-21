import { autenticar, ehUuid, rota, ErroHttp } from '@/lib/api/servidor'
import { chaveDaVariante, servirMidia } from '@/lib/api/midiaServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/**
 * GET /api/midias/:id[?variante=thumb|poster] — arquivo de uma mídia do PRÓPRIO workspace (sessão por cookie,
 * então funciona em <img>/<video>). Outro workspace, excluída ou não pronta: 404, sem vazar existência.
 * Cache privado longo: o conteúdo de um id nunca muda (SVG é sanitizado uma vez, no upload).
 */
export const GET = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Mídia não encontrada')
  const [a] = await sql()`select storage_key, mime, name, metadata_json from public.assets where id = ${params.id} and workspace_id = ${ctx.workspaceId} and status = 'ready' and deleted_at is null`
  if (!a) throw new ErroHttp('nao_encontrado', 'Mídia não encontrada')
  const chave = chaveDaVariante(req, a as { storage_key: string; metadata_json: { thumb_key?: string; poster_key?: string } })
  if (!chave) throw new ErroHttp('nao_encontrado', 'Variante não encontrada')
  return servirMidia(req, { chave, mime: chave === a.storage_key ? (a.mime as string) : null, nome: a.name as string }, 'private, max-age=31536000, immutable')
})
