import { AtualizarProjetoReq } from '@/lib/api/contratos'
import { auditar, autenticar, lerJson, projetoDoWorkspace, responder, rota, ErroHttp, urlsAssinadas } from '@/lib/api/servidor'
import { documentoDoProjeto, resumo, type LinhaProjeto } from '@/lib/api/projetosServidor'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** GET /api/projects/:id — detalhes + cenas do rascunho. */
export const GET = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto & { description: string }
  const doc = await documentoDoProjeto(ctx.sb, p)
  const { data: links } = await ctx.sb.from('share_links').select('expires_at').eq('project_id', p.id).is('revoked_at', null)
  const agora = Date.now()
  const capa = p.cover_asset_id ? await ctx.sb.from('assets').select('id, storage_key, metadata_json').eq('id', p.cover_asset_id).maybeSingle() : null
  const urls = capa?.data ? await urlsAssinadas(ctx.sb, [capa.data as { id: string; storage_key: string; metadata_json: { thumb_key?: string } }]) : {}
  return responder(
    {
      ...resumo(p, { sceneCount: doc.scenes.length, activeLinks: (links ?? []).filter((l) => !l.expires_at || new Date(l.expires_at).getTime() > agora).length, coverUrl: p.cover_asset_id ? urls[p.cover_asset_id]?.url ?? null : null }),
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
  if (entrada.baseRevision !== p.current_revision) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente.', { currentRevision: p.current_revision, updatedAt: p.updated_at })
  if (entrada.coverAssetId) {
    const { data: asset } = await ctx.sb.from('assets').select('id').eq('id', entrada.coverAssetId).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!asset) throw new ErroHttp('entrada_invalida', 'Mídia de capa inválida')
  }
  const patch: Record<string, unknown> = {}
  if (entrada.name !== undefined) patch.name = entrada.name
  if (entrada.description !== undefined) patch.description = entrada.description
  if (entrada.coverAssetId !== undefined) patch.cover_asset_id = entrada.coverAssetId
  if (entrada.status !== undefined) patch.status = entrada.status === 'draft' && p.published_revision != null ? 'published' : entrada.status
  const { data, error } = await ctx.sb.from('projects').update(patch).eq('id', p.id).eq('current_revision', p.current_revision).select('*').maybeSingle()
  if (error) throw error
  if (!data) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente.', { currentRevision: p.current_revision + 1 })
  if (entrada.status === 'archived') await auditar(ctx, 'project.archived', p.id)
  return responder(resumo(data as LinhaProjeto, { sceneCount: 0, activeLinks: 0, coverUrl: null }), requestId)
})

/** DELETE /api/projects/:id — soft delete + revoga links. Exclusão definitiva fica para a rotina de retenção. */
export const DELETE = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = await projetoDoWorkspace(ctx, params.id)
  const agora = new Date().toISOString()
  await ctx.sb.from('share_links').update({ revoked_at: agora }).eq('project_id', p.id).is('revoked_at', null)
  const { error } = await ctx.sb.from('projects').update({ deleted_at: agora }).eq('id', p.id)
  if (error) throw error
  await auditar(ctx, 'project.deleted', p.id)
  return responder({ deleted: true }, requestId)
})
