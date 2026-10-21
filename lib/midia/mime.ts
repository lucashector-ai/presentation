/**
 * Detecção de MIME real por bytes mágicos (seção 10.2: "verificar MIME real"). Não confia na extensão nem no cabeçalho do cliente.
 */
export type MimeBinario = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'video/mp4' | 'video/webm' | 'model/gltf-binary'
/** Formatos de texto: não têm bytes mágicos e são validados pelo conteúdo inteiro (sanitização/parse). */
export const MIMES_TEXTO = ['image/svg+xml', 'model/gltf+json', 'application/json'] as const
export type MimeTexto = (typeof MIMES_TEXTO)[number]
export type MimeAceito = MimeBinario | MimeTexto
/** Teto para arquivos de texto lidos inteiros no servidor. */
export const MAX_BYTES_TEXTO = 10 * 1024 * 1024

export const ehMimeTexto = (mime: string): mime is MimeTexto => (MIMES_TEXTO as readonly string[]).includes(mime)

export function detectarMime(bytes: Uint8Array): MimeBinario | null {
  const b = bytes
  const asc = (i: number, s: string) => s.split('').every((ch, k) => b[i + k] === ch.charCodeAt(0))
  if (b.length >= 8 && b[0] === 0x89 && asc(1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && asc(0, 'RIFF') && asc(8, 'WEBP')) return 'image/webp'
  if (b.length >= 6 && (asc(0, 'GIF87a') || asc(0, 'GIF89a'))) return 'image/gif'
  if (b.length >= 12 && asc(4, 'ftyp')) return 'video/mp4'
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  if (b.length >= 4 && asc(0, 'glTF')) return 'model/gltf-binary'
  return null
}

export function extensaoPorMime(mime: string): string {
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'image/svg+xml': 'svg', 'model/gltf-binary': 'glb', 'model/gltf+json': 'gltf', 'application/json': 'json' }[mime] ?? 'bin'
}

export function tipoMidia(mime: string): 'image' | 'video' | 'gif' | 'svg' | 'model3d' | 'lottie' {
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/svg+xml') return 'svg'
  if (mime.startsWith('model/')) return 'model3d'
  if (mime === 'application/json') return 'lottie'
  return 'image'
}
