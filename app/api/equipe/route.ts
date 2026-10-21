import type { EquipeRes } from '@/lib/api/contratos'
import { autenticar, responder, rota } from '@/lib/api/servidor'
import { convitesPendentes, membrosDo, nomeDoWorkspace } from '@/lib/api/equipeServidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { PLANOS } from '@/lib/planos'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** GET /api/equipe — membros do workspace ativo (e os convites pendentes, para quem administra). */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const [[ws], membros, convites, { plano }] = await Promise.all([
    sql()`select w.name, w.owner_user_id = ${ctx.userId}::uuid as proprio, (select coalesce(nullif(o.name, ''), split_part(o.email, '@', 1)) from public.users o where o.id = w.owner_user_id) as dono from public.workspaces w where w.id = ${ctx.workspaceId}`,
    membrosDo(ctx.workspaceId, ctx.userId),
    ctx.papel === 'owner' ? convitesPendentes(ctx.workspaceId) : Promise.resolve([]),
    planoEUso(ctx),
  ])
  const res: EquipeRes = {
    workspace: { id: ctx.workspaceId, nome: nomeDoWorkspace(String(ws?.name ?? 'Meu espaço'), String(ws?.dono ?? ''), ws?.proprio !== false) },
    meuPapel: ctx.papel,
    limite: PLANOS[plano.planoId].limites.membros,
    membros,
    convites,
  }
  return responder(res, requestId)
})
