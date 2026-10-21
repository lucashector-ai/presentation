import { autenticar, responder, rota, urlsAssinadas } from '@/lib/api/servidor'
import type { Asset } from '@/lib/api/contratos'

export const dynamic = 'force-dynamic'

interface LinhaAsset { id: string; workspace_id: string; storage_key: string; media_type: Asset['mediaType']; mime: string; bytes: number; width: number | null; height: number | null; duration: number | null; status: Asset['status']; name: string; metadata_json: { thumb_key?: string; poster_key?: string }; created_at: string }

/** GET /api/assets — biblioteca do workspace com URLs assinadas curtas. */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const { data, error } = await ctx.sb.from('assets').select('*').eq('workspace_id', ctx.workspaceId).is('deleted_at', null).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  const linhas = (data ?? []) as LinhaAsset[]
  const urls = await urlsAssinadas(ctx.sb, linhas.filter((a) => a.status === 'ready'))
  const lista: Asset[] = linhas.map((a) => ({
    id: a.id, workspaceId: a.workspace_id, mediaType: a.media_type, mime: a.mime, bytes: a.bytes, width: a.width, height: a.height, duration: a.duration, status: a.status, name: a.name,
    url: urls[a.id]?.url ?? null, thumbUrl: urls[a.id]?.thumbUrl ?? null, createdAt: a.created_at,
  }))
  return responder(lista, requestId)
})
