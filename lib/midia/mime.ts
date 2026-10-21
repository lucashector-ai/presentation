/**
 * Detecção de MIME real por bytes mágicos (seção 10.2: "verificar MIME real"). Não confia na extensão nem no cabeçalho do cliente.
 */
export type MimeAceito = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'video/mp4' | 'video/webm'

export function detectarMime(bytes: Uint8Array): MimeAceito | null {
  const b = bytes
  const asc = (i: number, s: string) => s.split('').every((ch, k) => b[i + k] === ch.charCodeAt(0))
  if (b.length >= 8 && b[0] === 0x89 && asc(1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && asc(0, 'RIFF') && asc(8, 'WEBP')) return 'image/webp'
  if (b.length >= 6 && (asc(0, 'GIF87a') || asc(0, 'GIF89a'))) return 'image/gif'
  if (b.length >= 12 && asc(4, 'ftyp')) return 'video/mp4'
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  return null
}

export function extensaoPorMime(mime: string): string {
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' }[mime] ?? 'bin'
}

export function tipoMidia(mime: string): 'image' | 'video' | 'gif' {
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'image/gif') return 'gif'
  return 'image'
}
