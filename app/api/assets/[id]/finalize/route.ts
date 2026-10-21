import { FinalizarUploadReq } from '@/lib/api/contratos'
import { autenticar, lerJson, responder, rota, ErroHttp, BUCKET_MIDIAS } from '@/lib/api/servidor'
import { detectarMime } from '@/lib/midia/mime'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assets/:id/finalize — confirma que o objeto existe, confere tamanho e MIME REAL (bytes mágicos)
 * e marca como ready. Thumbnails/variantes e transcodificação ficam com o worker (seção 10.2); até lá, o
 * visualizador usa o original com lazy loading.
 */
export const POST = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const entrada = await lerJson(req, FinalizarUploadReq)
  const { data: asset } = await ctx.sb.from('assets').select('*').eq('id', params.id).eq('workspace_id', ctx.workspaceId).maybeSingle()
  if (!asset) throw new ErroHttp('nao_encontrado', 'Mídia não encontrada')
  if (asset.status === 'ready') return responder({ status: 'ready' }, requestId)

  const falhar = async (motivo: string) => {
    await ctx.sb.from('assets').update({ status: 'failed', metadata_json: { erro: motivo } }).eq('id', asset.id)
    await ctx.sb.storage.from(BUCKET_MIDIAS).remove([asset.storage_key])
    throw new ErroHttp('entrada_invalida', motivo)
  }

  const pasta = asset.storage_key.split('/').slice(0, -1).join('/')
  const nome = asset.storage_key.split('/').pop()!
  const { data: objetos } = await ctx.sb.storage.from(BUCKET_MIDIAS).list(pasta, { search: nome })
  const objeto = objetos?.find((o) => o.name === nome)
  if (!objeto) throw new ErroHttp('entrada_invalida', 'Upload não encontrado. Envie o arquivo novamente.')
  const tamanho = Number((objeto.metadata as { size?: number } | null)?.size ?? 0)
  if (tamanho && Math.abs(tamanho - asset.bytes) > 1024) await falhar('Tamanho do arquivo não corresponde ao declarado')

  const { data: urlAssinada } = await ctx.sb.storage.from(BUCKET_MIDIAS).createSignedUrl(asset.storage_key, 60)
  if (!urlAssinada) throw new Error('Falha ao ler o objeto')
  const resp = await fetch(urlAssinada.signedUrl, { headers: { Range: 'bytes=0-31' } })
  const cabeca = new Uint8Array(await resp.arrayBuffer())
  const mimeReal = detectarMime(cabeca)
  if (!mimeReal || mimeReal !== asset.mime) await falhar('O conteúdo do arquivo não corresponde ao formato declarado')

  const { error } = await ctx.sb.from('assets').update({ status: 'ready', bytes: tamanho || asset.bytes, width: entrada.width ?? null, height: entrada.height ?? null, duration: entrada.duration ?? null }).eq('id', asset.id)
  if (error) throw error
  return responder({ status: 'ready' }, requestId)
})
