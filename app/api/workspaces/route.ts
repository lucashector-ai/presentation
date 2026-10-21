import type { WorkspaceItem } from '@/lib/api/contratos'
import { autenticar, responder, rota } from '@/lib/api/servidor'
import { nomeDoWorkspace } from '@/lib/api/equipeServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** GET /api/workspaces — os workspaces de que o usuário participa (o próprio e os aceitos por convite). */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const linhas = await sql()`
    select w.id, w.name, m.role, w.owner_user_id = ${ctx.userId}::uuid as proprio,
           (select coalesce(nullif(o.name, ''), split_part(o.email, '@', 1)) from public.users o where o.id = w.owner_user_id) as dono
    from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
    where m.user_id = ${ctx.userId}::uuid
    order by m.created_at`
  const itens: WorkspaceItem[] = linhas.map((l) => ({ id: String(l.id), nome: nomeDoWorkspace(String(l.name), String(l.dono ?? ''), !!l.proprio), dono: String(l.dono ?? ''), papel: l.role, proprio: !!l.proprio, ativo: l.id === ctx.workspaceId }))
  return responder(itens, requestId)
})
