import { UploadUrlReq } from '@/lib/api/contratos'
import { autenticar, lerJson, projetoDoWorkspace, responder, rota, ErroHttp, BUCKET_MIDIAS } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { podeEnviarArquivo } from '@/lib/planos'
import { extensaoPorMime, tipoMidia } from '@/lib/midia/mime'

export const dynamic = 'force-dynamic'

/** POST /api/assets/upload-url — valida cota/permissão, cria o registro (queued) e devolve URL assinada de upload direto. */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  const entrada = await lerJson(req, UploadUrlReq)
  await projetoDoWorkspace(ctx, entrada.projectId)
  const { plano, uso } = await planoEUso(ctx)
  const d = podeEnviarArquivo(plano, uso, entrada.bytes)
  if (!d.ok) throw new ErroHttp(entrada.bytes > 0 && d.motivo.includes('Arquivo acima') ? 'arquivo_grande' : 'limite_do_plano', d.motivo, { upgradePara: d.upgradePara })

  const { data: asset, error } = await ctx.sb
    .from('assets')
    .insert({ workspace_id: ctx.workspaceId, storage_key: 'pendente', media_type: tipoMidia(entrada.mime), mime: entrada.mime, bytes: entrada.bytes, status: 'queued', name: entrada.name, created_by: ctx.userId })
    .select('id')
    .single()
  if (error) throw error
  const storageKey = `${ctx.workspaceId}/${asset.id}/original.${extensaoPorMime(entrada.mime)}`
  await ctx.sb.from('assets').update({ storage_key: storageKey }).eq('id', asset.id)

  const { data: assinada, error: erroUrl } = await ctx.sb.storage.from(BUCKET_MIDIAS).createSignedUploadUrl(storageKey)
  if (erroUrl || !assinada) throw erroUrl ?? new Error('Falha ao assinar upload')
  return responder(
    { assetId: asset.id, uploadUrl: assinada.signedUrl, headers: { 'content-type': entrada.mime, 'x-upsert': 'false' }, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
    requestId,
    201
  )
})
