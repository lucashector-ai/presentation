import { AtualizarProjetoReq } from '@/lib/api/contratos'
import { auditar, autenticar, ehUuid, iso, lerJson, projetoDoWorkspace, responder, rota, ErroHttp, urlsDeMidia } from '@/lib/api/servidor'
import { documentoDoProjeto, resumo, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/projects/:id — detalhes + cenas do rascunho. */
export const GET = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto & { description: string }
  const doc = await documentoDoProjeto(p)
  const [extras] = await sql()`
    select (select count(*) from public.share_links l where l.project_id = ${p.id} and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())) as active_links,
           (select a.metadata_json from public.assets a where a.id = ${p.cover_asset_id} and a.workspace_id = ${ctx.workspaceId} and a.deleted_at is null and a.status = 'ready') as cover_metadata`
  const capa = p.cover_asset_id && extras?.cover_metadata ? urlsDeMidia([{ id: p.cover_asset_id, metadata_json: extras.cover_metadata }], '/api/midias')[p.cover_asset_id] : undefined
  return responder(
    {
      ...resumo(p, { sceneCount: doc.scenes.length, activeLinks: Number(extras?.active_links ?? 0), coverUrl: capa?.url ?? null }),
      description: p.description,
      scenes: doc.scenes,
    },
    requestId
  )
})

/** PATCH /api/projects/:id — metadados com revisão/ETag. */
export const PATCH = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto
  const entrada = await lerJson(req, AtualizarProjetoReq)
  if (entrada.baseRevision !== p.current_revision) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente.', { currentRevision: p.current_revision, updatedAt: iso(p.updated_at) })
  if (entrada.coverAssetId) {
    if (!ehUuid(entrada.coverAssetId)) throw new ErroHttp('entrada_invalida', 'Mídia de capa inválida')
    const [asset] = await sql()`select id from public.assets where id = ${entrada.coverAssetId} and workspace_id = ${ctx.workspaceId} and deleted_at is null`
    if (!asset) throw new ErroHttp('entrada_invalida', 'Mídia de capa inválida')
  }
  const status = entrada.status === undefined ? null : entrada.status === 'draft' && p.published_revision != null ? 'published' : entrada.status
  // campos ausentes ficam como estão; coverAssetId: null remove a capa
  const [data] = await sql()`
    update public.projects set
      name = coalesce(${entrada.name ?? null}::text, name),
      description = coalesce(${entrada.description ?? null}::text, description),
      cover_asset_id = case when ${entrada.coverAssetId !== undefined} then ${entrada.coverAssetId ?? null}::uuid else cover_asset_id end,
      status = coalesce(${status}::project_status, status)
    where id = ${p.id} and workspace_id = ${ctx.workspaceId} and current_revision = ${p.current_revision}
    returning *`
  if (!data) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente.', { currentRevision: p.current_revision + 1 })
  if (entrada.status === 'archived') await auditar(ctx, 'project.archived', p.id)
  return responder(resumo(data as LinhaProjeto, { sceneCount: 0, activeLinks: 0, coverUrl: null }), requestId)
})

/** DELETE /api/projects/:id — soft delete + revoga links. Exclusão definitiva fica para a rotina de retenção. */
export const DELETE = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = await projetoDoWorkspace(ctx, params.id)
  const db = sql()
  await db.transaction([
    db`update public.share_links set revoked_at = now() where project_id = ${p.id} and revoked_at is null`,
    db`update public.projects set deleted_at = now() where id = ${p.id} and workspace_id = ${ctx.workspaceId}`,
  ])
  await auditar(ctx, 'project.deleted', p.id)
  return responder({ deleted: true }, requestId)
})
