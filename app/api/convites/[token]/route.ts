import type { ConviteInfoRes } from '@/lib/api/contratos'
import { autenticar, limitar, responder, rota } from '@/lib/api/servidor'
import { nomeDoWorkspace } from '@/lib/api/equipeServidor'
import { hashToken, tokenValido } from '@/lib/share/token'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** Mostra só o começo do e-mail convidado ("an•••@exemplo.com"). */
function mascarar(email: string) {
  const [u = '', d = ''] = email.split('@')
  return `${u.slice(0, 2)}•••@${d}`
}

/** GET /api/convites/:token — o que a pessoa logada está prestes a aceitar (sem vazar quem mais está no espaço). */
export const GET = rota<{ token: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  limitar(`convite-ver:${ctx.userId}`, 60, 10 * 60 * 1000)
  const invalido: ConviteInfoRes = { estado: 'invalido' }
  if (!tokenValido(params.token)) return responder(invalido, requestId)
  const [c] = await sql()`
    select i.email, i.role, w.name as ws_nome,
           (select coalesce(nullif(o.name, ''), split_part(o.email, '@', 1)) from public.users o where o.id = w.owner_user_id) as dono,
           (select coalesce(nullif(o.name, ''), split_part(o.email, '@', 1)) from public.users o where o.id = i.created_by) as autor,
           exists (select 1 from public.workspace_members m where m.workspace_id = i.workspace_id and m.user_id = ${ctx.userId}::uuid) as ja_membro,
           (select lower(coalesce(nu.email, u.email)) from public.users u left join neon_auth."user" nu on nu.id = u.id where u.id = ${ctx.userId}::uuid) as meu_email
    from public.workspace_invites i join public.workspaces w on w.id = i.workspace_id
    where i.token_hash = ${await hashToken(params.token)} and i.revoked_at is null and i.expires_at > now() and (i.email is null or i.accepted_at is null)`
  if (!c) return responder(invalido, requestId)
  if (c.email && c.email !== c.meu_email) return responder({ estado: 'outro_email', emailConvidado: mascarar(String(c.email)) } satisfies ConviteInfoRes, requestId)
  const res: ConviteInfoRes = { estado: 'valido', workspaceNome: nomeDoWorkspace(String(c.ws_nome), String(c.dono ?? ''), false), convidadoPor: String(c.autor ?? c.dono ?? ''), papel: c.role, jaMembro: !!c.ja_membro }
  return responder(res, requestId)
})
