import { auditar, autenticar, cookieWorkspace, ErroHttp, limitar, responder, rota } from '@/lib/api/servidor'
import { traduzirErroConvite } from '@/lib/api/equipeServidor'
import { PLANOS, type PlanoId } from '@/lib/planos'
import { hashToken, tokenValido } from '@/lib/share/token'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

interface Aceite { ws_id: string; papel: 'owner' | 'editor' | 'viewer'; projeto_id: string | null; ja_membro: boolean }

/**
 * POST /api/convites/:token/aceitar — entra no workspace do convite (com o papel dele) e o torna o workspace ativo.
 * O limite de membros do plano é conferido no banco, com o workspace travado (aceitar_convite).
 */
export const POST = rota<{ token: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId, { permitirVisualizador: true })
  limitar(`convite-aceitar:${ctx.userId}`, 20, 10 * 60 * 1000)
  if (!tokenValido(params.token)) throw new ErroHttp('nao_encontrado', 'Convite inválido')
  const hash = await hashToken(params.token)
  const [[ws], [eu]] = await Promise.all([
    sql()`select w.plan_id from public.workspace_invites i join public.workspaces w on w.id = i.workspace_id where i.token_hash = ${hash}`,
    sql()`select lower(coalesce(nu.email, u.email)) as email from public.users u left join neon_auth."user" nu on nu.id = u.id where u.id = ${ctx.userId}::uuid`,
  ])
  const limite = PLANOS[(ws?.plan_id as PlanoId | undefined) ?? 'free']?.limites.membros ?? 1
  let r: Aceite | undefined
  try {
    ;[r] = (await sql()`select * from public.aceitar_convite(${hash}, ${ctx.userId}::uuid, ${String(eu?.email ?? '')}, ${limite}::int)`) as Aceite[]
  } catch (e) {
    traduzirErroConvite(e)
  }
  if (!r) throw new ErroHttp('nao_encontrado', 'Convite inválido')
  if (!r.ja_membro) await auditar({ userId: ctx.userId, workspaceId: r.ws_id }, 'workspace.member_added', null, { papel: r.papel })
  return responder({ workspaceId: r.ws_id, papel: r.papel, projetoId: r.projeto_id }, requestId, 200, { headers: { 'set-cookie': cookieWorkspace(r.ws_id) } })
})
