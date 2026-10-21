import 'server-only'
/**
 * Entrega de mídia a partir do armazenamento privado (R2). Só é chamada DEPOIS da autorização (dono pela
 * sessão ou convidado pelo link). Suporta Range (vídeo), ETag/If-None-Match e cabeçalhos defensivos: o
 * arquivo nunca é interpretado como página (SVG vai com CSP sandbox, mesmo já sanitizado no upload).
 */
import { armazenamento, ErroIntervalo, type Intervalo } from '@/lib/armazenamento'
import type { Asset } from './contratos'
import { iso, urlsDeMidia } from './servidor'

export interface LinhaAsset { id: string; workspace_id: string; storage_key: string; media_type: Asset['mediaType']; mime: string; bytes: string | number; width: number | null; height: number | null; duration: string | number | null; status: Asset['status']; name: string; metadata_json: { thumb_key?: string; poster_key?: string } | null; created_at: Date | string }

/** Linha do banco → contrato da API (URLs só para mídias prontas). */
export function paraAsset(a: LinhaAsset): Asset {
  const urls = a.status === 'ready' ? urlsDeMidia([a], '/api/midias')[a.id] : undefined
  return {
    id: a.id, workspaceId: a.workspace_id, mediaType: a.media_type, mime: a.mime, bytes: Number(a.bytes), width: a.width, height: a.height, duration: a.duration == null ? null : Number(a.duration), status: a.status, name: a.name,
    url: urls?.url ?? null, thumbUrl: urls?.thumbUrl ?? null, createdAt: iso(a.created_at) ?? '',
  }
}

export interface MidiaParaServir {
  chave: string
  /** MIME conferido no upload; null para variantes (usa o tipo gravado no objeto). */
  mime: string | null
  nome: string
}

/** "bytes=inicio-fim" | "bytes=inicio-" | "bytes=-sufixo" (um intervalo só). */
export function lerRange(cabecalho: string | null, tamanho?: number): Intervalo | 'invalido' | null {
  if (!cabecalho) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim())
  if (!m) return 'invalido'
  const [, a, b] = m
  if (!a && !b) return 'invalido'
  if (!a) {
    if (tamanho == null) return 'invalido'
    const sufixo = Number(b)
    if (!sufixo) return 'invalido'
    return { inicio: Math.max(0, tamanho - sufixo) }
  }
  const inicio = Number(a)
  const fim = b ? Number(b) : undefined
  if (fim != null && fim < inicio) return 'invalido'
  return { inicio, fim }
}

const nomeSeguro = (nome: string) => encodeURIComponent(nome.replace(/[\r\n"]/g, '').slice(0, 120) || 'arquivo')

export async function servirMidia(req: Request, midia: MidiaParaServir, cacheControl: string): Promise<Response> {
  const arm = armazenamento()
  const base: Record<string, string> = {
    'cache-control': cacheControl,
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    'content-disposition': `inline; filename*=UTF-8''${nomeSeguro(midia.nome)}`,
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    'x-robots-tag': 'noindex, nofollow, noarchive',
  }
  const pedidoRange = req.headers.get('range')
  const info = pedidoRange || req.headers.get('if-none-match') ? await arm.info(midia.chave) : null
  if ((pedidoRange || req.headers.get('if-none-match')) && !info) return new Response('Não encontrado', { status: 404, headers: { 'cache-control': 'no-store' } })

  if (info && req.headers.get('if-none-match') === info.etag && !pedidoRange) {
    return new Response(null, { status: 304, headers: { etag: info.etag, 'cache-control': cacheControl } })
  }

  let intervalo: Intervalo | undefined
  if (pedidoRange) {
    const r = lerRange(pedidoRange, info?.tamanho)
    if (r === 'invalido') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${info?.tamanho ?? 0}` } })
    if (r) intervalo = r
  }
  try {
    const obj = await arm.ler(midia.chave, intervalo ? { intervalo } : undefined)
    if (!obj) return new Response('Não encontrado', { status: 404, headers: { 'cache-control': 'no-store' } })
    const headers = new Headers({ ...base, etag: obj.etag, 'content-type': midia.mime ?? obj.tipo ?? 'application/octet-stream' })
    if (obj.intervalo) {
      headers.set('content-range', `bytes ${obj.intervalo.inicio}-${obj.intervalo.fim}/${obj.tamanho}`)
      headers.set('content-length', String(obj.intervalo.fim - obj.intervalo.inicio + 1))
      return new Response(obj.corpo, { status: 206, headers })
    }
    headers.set('content-length', String(obj.tamanho))
    return new Response(obj.corpo, { status: 200, headers })
  } catch (e) {
    if (e instanceof ErroIntervalo) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${e.tamanho}` } })
    throw e
  }
}

/** Chave da variante pedida (?variante=thumb|poster) ou do original. */
export function chaveDaVariante(req: Request, a: { storage_key: string; metadata_json?: { thumb_key?: string; poster_key?: string } | null }): string | null {
  const v = new URL(req.url).searchParams.get('variante')
  if (!v) return a.storage_key
  if (v === 'thumb') return a.metadata_json?.thumb_key ?? null
  if (v === 'poster') return a.metadata_json?.poster_key ?? null
  return null
}
