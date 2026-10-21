import { auditar, autenticar, ehUuid, ErroHttp, responder, rota } from '@/lib/api/servidor'
import { exigirDono } from '@/lib/api/equipeServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** DELETE /api/equipe/convites/:id — revoga um convite pendente do workspace ativo. */
export const DELETE = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  exigirDono(ctx)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Convite não encontrado')
  const r = await sql()`update public.workspace_invites set revoked_at = now() where id = ${params.id} and workspace_id = ${ctx.workspaceId} and revoked_at is null returning id`
  if (!r.length) throw new ErroHttp('nao_encontrado', 'Convite não encontrado')
  await auditar(ctx, 'workspace.invite_revoked', null)
  return responder({ revoked: true }, requestId)
})
