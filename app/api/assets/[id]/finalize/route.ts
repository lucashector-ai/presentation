import { FinalizarUploadReq } from '@/lib/api/contratos'
import { autenticar, lerJson, responder, rota, ErroHttp, BUCKET_MIDIAS } from '@/lib/api/servidor'
import DOMPurify from 'isomorphic-dompurify'
import { detectarMime, ehMimeTexto, MAX_BYTES_TEXTO } from '@/lib/midia/mime'
import { ehSvg, sanitizarSvg } from '@/lib/importar/svg'
import { ehLottie, gltfAutocontido } from '@/lib/importar/arquivos'

export const dynamic = 'force-dynamic'

/**
 * POST /api/assets/:id/finalize — confirma que o objeto existe, confere tamanho e MIME REAL (bytes mágicos)
 * e marca como ready. Thumbnails/variantes e transcodificação ficam com o worker (seção 10.2); até lá, o
 * visualizador usa o original com lazy loading.
 * Formatos de texto são lidos inteiros: SVG é sanitizado e regravado; glTF precisa ser autocontido; JSON precisa ser Lottie.
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
  if (ehMimeTexto(asset.mime)) {
    if ((tamanho || asset.bytes) > MAX_BYTES_TEXTO) await falhar('Arquivo de texto acima de 10 MB')
    const texto = await (await fetch(urlAssinada.signedUrl)).text()
    if (asset.mime === 'image/svg+xml') {
      if (!ehSvg(texto)) await falhar('O arquivo não é um SVG válido')
      const limpo = sanitizarSvg(texto, DOMPurify)
      if (!ehSvg(limpo)) await falhar('O SVG ficou vazio depois da limpeza de segurança')
      // grava a versão sanitizada por cima do original: o bucket nunca serve SVG com script
      const { error: erroUpload } = await ctx.sb.storage.from(BUCKET_MIDIAS).upload(asset.storage_key, new Blob([limpo], { type: 'image/svg+xml' }), { upsert: true, contentType: 'image/svg+xml' })
      if (erroUpload) throw erroUpload
    } else {
      let json: unknown = null
      try { json = JSON.parse(texto) } catch { await falhar('JSON inválido') }
      if (asset.mime === 'model/gltf+json' && !gltfAutocontido(json)) await falhar('O glTF precisa ser autocontido (texturas embutidas). Exporte como .glb no Blender.')
      if (asset.mime === 'application/json' && !ehLottie(json)) await falhar('O JSON não é uma animação Lottie')
    }
  } else {
    const resp = await fetch(urlAssinada.signedUrl, { headers: { Range: 'bytes=0-31' } })
    const cabeca = new Uint8Array(await resp.arrayBuffer())
    const mimeReal = detectarMime(cabeca)
    if (!mimeReal || mimeReal !== asset.mime) await falhar('O conteúdo do arquivo não corresponde ao formato declarado')
  }

  const { error } = await ctx.sb.from('assets').update({ status: 'ready', bytes: tamanho || asset.bytes, width: entrada.width ?? null, height: entrada.height ?? null, duration: entrada.duration ?? null }).eq('id', asset.id)
  if (error) throw error
  return responder({ status: 'ready' }, requestId)
})
