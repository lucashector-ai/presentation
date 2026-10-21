import type { ContaRes } from '@/lib/api/contratos'
import { autenticar, iso, responder, rota } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/**
 * GET /api/conta — quem está logado, workspace, plano, uso e créditos (saldo + extrato recente).
 * O nome e o e-mail vêm do Neon Auth (neon_auth."user"), que é onde o perfil é editado.
 */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const db = sql()
  const [[linha], movimentos, { plano, uso }] = await Promise.all([
    db`
      select coalesce(nu.name, u.name, '') as nome, coalesce(nu.email, u.email, '') as email, w.name as ws_nome,
             (select count(*) from public.workspace_members m where m.workspace_id = w.id) as membros,
             coalesce((select b.balance from public.credit_balances b where b.workspace_id = w.id), 0) as saldo
      from public.workspaces w
      join public.users u on u.id = ${ctx.userId}
      left join neon_auth."user" nu on nu.id = u.id
      where w.id = ${ctx.workspaceId}`,
    db`select id, amount, reason, created_at from public.credit_transactions where workspace_id = ${ctx.workspaceId} order by created_at desc, id desc limit 50`,
    planoEUso(ctx),
  ])
  const conta: ContaRes = {
    usuario: { id: ctx.userId, nome: String(linha?.nome ?? ''), email: String(linha?.email ?? '') },
    workspace: { id: ctx.workspaceId, nome: String(linha?.ws_nome ?? 'Meu espaço'), planoId: plano.planoId, estadoAssinatura: plano.estado, membros: Number(linha?.membros ?? 1) },
    creditos: { saldo: Number(linha?.saldo ?? 0), movimentos: movimentos.map((m) => ({ id: String(m.id), quantidade: Number(m.amount), motivo: String(m.reason ?? ''), criadoEm: iso(m.created_at as Date) ?? '' })) },
    uso,
  }
  return responder(conta, requestId)
})
