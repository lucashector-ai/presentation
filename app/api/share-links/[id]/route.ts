import { auditar, autenticar, ehUuid, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** DELETE /api/share-links/:id — revoga (owner autorizado via projeto → workspace). Idempotente. */
export const DELETE = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Link não encontrado')
  const [link] = await sql()`
    select l.id, l.project_id, l.revoked_at
    from public.share_links l join public.projects p on p.id = l.project_id
    where l.id = ${params.id} and p.workspace_id = ${ctx.workspaceId}`
  if (!link) throw new ErroHttp('nao_encontrado', 'Link não encontrado')
  if (!link.revoked_at) {
    await sql()`update public.share_links set revoked_at = now() where id = ${link.id} and revoked_at is null`
    await auditar(ctx, 'share_link.revoked', link.project_id as string)
  }
  return responder({ revoked: true }, requestId)
})
