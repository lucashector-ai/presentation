import { auditar, autenticar, responder, rota, ErroHttp } from '@/lib/api/servidor'

export const dynamic = 'force-dynamic'

/** DELETE /api/share-links/:id — revoga (owner autorizado via projeto → workspace). Idempotente. */
export const DELETE = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const { data: link } = await ctx.sb.from('share_links').select('id, project_id, revoked_at, projects!inner(workspace_id)').eq('id', params.id).maybeSingle()
  const ws = (link as { projects?: { workspace_id: string } } | null)?.projects?.workspace_id
  if (!link || ws !== ctx.workspaceId) throw new ErroHttp('nao_encontrado', 'Link não encontrado')
  if (!link.revoked_at) {
    const { error } = await ctx.sb.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', link.id)
    if (error) throw error
    await auditar(ctx, 'share_link.revoked', link.project_id)
  }
  return responder({ revoked: true }, requestId)
})
