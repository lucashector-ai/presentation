import 'server-only'
import { sql } from '@/lib/db/neon'
import { estadoDoLink, hashToken, tokenValido } from '@/lib/share/token'

export interface LinkResolvido {
  id: string
  project_id: string
  password_hash: string | null
  project_name: string
  workspace_id: string
  published_revision: number
}

/**
 * Resolve um token de link de convidado. Devolve null quando o link não existe, foi revogado, expirou, o
 * projeto foi excluído ou nunca foi publicado — o chamador responde igual nos quatro casos (não vaza o motivo).
 * A senha (se houver) NÃO é conferida aqui: cabe ao chamador exigir o grant.
 */
export async function linkAtivo(token: string): Promise<LinkResolvido | null> {
  if (!tokenValido(token)) return null
  const [l] = await sql()`
    select l.id, l.project_id, l.password_hash, l.expires_at, l.revoked_at,
           p.name as project_name, p.workspace_id, p.published_revision, p.deleted_at
    from public.share_links l join public.projects p on p.id = l.project_id
    where l.token_hash = ${await hashToken(token)}`
  if (!l) return null
  if (estadoDoLink({ expiresAt: l.expires_at, revokedAt: l.revoked_at }) !== 'ativo' || l.deleted_at || l.published_revision == null) return null
  return { id: l.id, project_id: l.project_id, password_hash: l.password_hash, project_name: l.project_name, workspace_id: l.workspace_id, published_revision: l.published_revision }
}
