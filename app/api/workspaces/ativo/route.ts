import { AtivarWorkspaceReq } from '@/lib/api/contratos'
import { autenticar, cookieWorkspace, ehUuid, ErroHttp, lerJson, responder, rota } from '@/lib/api/servidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** POST /api/workspaces/ativo — troca o workspace ativo (só para um de que o usuário é membro). */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId, { permitirVisualizador: true })
  const { workspaceId } = await lerJson(req, AtivarWorkspaceReq)
  if (!ehUuid(workspaceId)) throw new ErroHttp('nao_encontrado', 'Espaço não encontrado')
  const [m] = await sql()`select role from public.workspace_members where workspace_id = ${workspaceId} and user_id = ${ctx.userId}::uuid`
  if (!m) throw new ErroHttp('nao_encontrado', 'Espaço não encontrado')
  return responder({ workspaceId, papel: m.role }, requestId, 200, { headers: { 'set-cookie': cookieWorkspace(workspaceId === ctx.workspacePadrao ? null : workspaceId) } })
})
