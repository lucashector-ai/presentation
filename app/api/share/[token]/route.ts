import { NextResponse } from 'next/server'
import { grantValido, limitar, hashIp, responder, rota, urlsAssinadas, VALIDADE_URL_MIDIA_S } from '@/lib/api/servidor'
import { supabaseServidor } from '@/lib/supabase/servidor'
import { estadoDoLink, hashToken, tokenValido } from '@/lib/share/token'
import { idsDeAssets } from '@/lib/api/projetosServidor'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { PLANOS, type PlanoId } from '@/lib/planos'

export const dynamic = 'force-dynamic'

const CABECALHOS = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer' }

/** GET /api/share/:token — resolve acesso de convidado. Inexistente, expirado e revogado têm a MESMA resposta. */
export const GET = rota<{ token: string }>(async (req, { params }, requestId) => {
  limitar(`share:${await hashIp(req)}`, 120, 60_000)
  const indisponivel = () => NextResponse.json({ data: { state: 'unavailable' }, error: null, requestId }, { headers: CABECALHOS })
  if (!tokenValido(params.token)) return indisponivel()
  const sb = supabaseServidor()
  const { data: link } = await sb.from('share_links').select('id, project_id, password_hash, expires_at, revoked_at, projects!inner(id, name, workspace_id, published_revision, deleted_at)').eq('token_hash', await hashToken(params.token)).maybeSingle()
  if (!link) return indisponivel()
  const projeto = (link as unknown as { projects: { id: string; name: string; workspace_id: string; published_revision: number | null; deleted_at: string | null } }).projects
  if (estadoDoLink({ expiresAt: link.expires_at, revokedAt: link.revoked_at }) !== 'ativo' || projeto.deleted_at || projeto.published_revision == null) return indisponivel()
  if (link.password_hash && !(await grantValido(req, link.id))) return responder({ state: 'locked', projectName: projeto.name }, requestId, 200, { headers: CABECALHOS })

  const { data: snap } = await sb.from('project_snapshots').select('content_json').eq('project_id', projeto.id).eq('revision', projeto.published_revision).maybeSingle()
  if (!snap) return indisponivel()
  const documento = snap.content_json as DocumentoProjeto
  const ids = idsDeAssets(documento)
  const { data: assets } = ids.length ? await sb.from('assets').select('id, storage_key, metadata_json').in('id', ids).eq('workspace_id', projeto.workspace_id).eq('status', 'ready').is('deleted_at', null) : { data: [] }
  const urls = await urlsAssinadas(sb, (assets ?? []) as { id: string; storage_key: string; metadata_json: { thumb_key?: string; poster_key?: string } }[])
  // selo "Feito com Mostra" só nos planos que o exigem (na dúvida, mostra)
  const { data: ws } = await sb.from('workspaces').select('plan_id').eq('id', projeto.workspace_id).maybeSingle()
  const brand = PLANOS[(ws?.plan_id as PlanoId | undefined) ?? 'free']?.capacidades.marcaDaPlataforma ?? true
  await sb.rpc('increment_share_views', { p_link_id: link.id })
  return responder({ state: 'ready', projectName: projeto.name, document: documento, assets: urls, brand, grantExpiresAt: new Date(Date.now() + VALIDADE_URL_MIDIA_S * 1000).toISOString() }, requestId, 200, { headers: CABECALHOS })
})
