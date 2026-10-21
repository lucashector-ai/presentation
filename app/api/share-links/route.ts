import type { ShareLink } from '@/lib/api/contratos'
import { autenticar, iso, responder, rota } from '@/lib/api/servidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

interface LinhaLink { id: string; project_id: string; token_preview: string; tem_senha: boolean; expires_at: Date | null; revoked_at: Date | null; view_count: number; created_at: Date }

/** GET /api/share-links — todos os links dos projetos do workspace (painel e Enviados). Sem token nem hash de senha. */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const linhas = await sql()`
    select l.id, l.project_id, l.token_preview, l.password_hash is not null as tem_senha, l.expires_at, l.revoked_at, l.view_count, l.created_at
    from public.share_links l join public.projects p on p.id = l.project_id
    where p.workspace_id = ${ctx.workspaceId}
    order by l.created_at desc
    limit 1000`
  const lista: ShareLink[] = (linhas as LinhaLink[]).map((l) => ({ id: l.id, projectId: l.project_id, tokenPreview: l.token_preview, hasPassword: l.tem_senha, expiresAt: iso(l.expires_at), revokedAt: iso(l.revoked_at), views: l.view_count, createdAt: iso(l.created_at) ?? '' }))
  return responder(lista, requestId)
})
