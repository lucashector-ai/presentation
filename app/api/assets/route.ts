import { autenticar, responder, rota } from '@/lib/api/servidor'
import { paraAsset, type LinhaAsset } from '@/lib/api/midiaServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** GET /api/assets — biblioteca do workspace; as URLs apontam para /api/midias/:id (confere a sessão). */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const linhas = await sql()`select * from public.assets where workspace_id = ${ctx.workspaceId} and deleted_at is null order by created_at desc limit 500`
  return responder((linhas as LinhaAsset[]).map(paraAsset), requestId)
})
