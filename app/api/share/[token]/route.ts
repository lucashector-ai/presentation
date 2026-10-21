import { NextResponse } from 'next/server'
import { ehUuid, grantValido, limitar, hashIp, responder, rota, urlsDeMidia, VALIDADE_GRANT_S } from '@/lib/api/servidor'
import { linkAtivo } from '@/lib/api/compartilhamentoServidor'
import { idsDeAssets } from '@/lib/api/projetosServidor'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { PLANOS, type PlanoId } from '@/lib/planos'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

const CABECALHOS = { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer' }

/** GET /api/share/:token — resolve acesso de convidado. Inexistente, expirado e revogado têm a MESMA resposta. */
export const GET = rota<{ token: string }>(async (req, { params }, requestId) => {
  limitar(`share:${await hashIp(req)}`, 120, 60_000)
  const indisponivel = () => NextResponse.json({ data: { state: 'unavailable' }, error: null, requestId }, { headers: CABECALHOS })
  const link = await linkAtivo(params.token)
  if (!link) return indisponivel()
  if (link.password_hash && !(await grantValido(req, link.id))) return responder({ state: 'locked', projectName: link.project_name }, requestId, 200, { headers: CABECALHOS })

  const db = sql()
  const [snap] = await db`
    select s.content_json, w.plan_id
    from public.project_snapshots s join public.workspaces w on w.id = ${link.workspace_id}
    where s.project_id = ${link.project_id} and s.revision = ${link.published_revision}`
  if (!snap) return indisponivel()
  const documento = snap.content_json as DocumentoProjeto
  const ids = idsDeAssets(documento).filter(ehUuid)
  // só mídias do workspace dono do projeto, prontas e não excluídas
  const assets = ids.length ? await db`select id, metadata_json from public.assets where id = any(${ids}::uuid[]) and workspace_id = ${link.workspace_id} and status = 'ready' and deleted_at is null` : []
  const urls = urlsDeMidia(assets as { id: string; metadata_json: { thumb_key?: string; poster_key?: string } }[], `/api/share/${params.token}/midias`)
  // selo "Feito com Mostra" só nos planos que o exigem (na dúvida, mostra)
  const brand = PLANOS[(snap.plan_id as PlanoId | undefined) ?? 'free']?.capacidades.marcaDaPlataforma ?? true
  await db`select public.increment_share_views(${link.id}::uuid)`
  return responder({ state: 'ready', projectName: link.project_name, document: documento, assets: urls, brand, grantExpiresAt: new Date(Date.now() + VALIDADE_GRANT_S * 1000).toISOString() }, requestId, 200, { headers: CABECALHOS })
})
