/**
 * Classificação de arquivos soltos/colados no editor (Figma PNG, Illustrator SVG, Blender GLB, After Effects Lottie...).
 * Puro: recebe nome, MIME declarado e os primeiros bytes (ou o texto, para formatos textuais).
 */

export type TipoImportacao = 'image' | 'gif' | 'video' | 'svg' | 'model3d' | 'lottie' | 'nao_suportado'

export interface Classificacao {
  tipo: TipoImportacao
  /** MIME normalizado a usar no upload. */
  mime: string
  /** Mensagem acionável quando não suportado. */
  dica?: string
}

const ext = (nome: string) => nome.toLowerCase().split('.').pop() ?? ''

/** Lottie: JSON com versão, frame rate, dimensões e camadas. */
export function ehLottie(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false
  const j = json as Record<string, unknown>
  return typeof j.v === 'string' && typeof j.fr === 'number' && typeof j.w === 'number' && typeof j.h === 'number' && Array.isArray(j.layers)
}

/** GLTF em JSON só é aceito com buffers embutidos (data:), porque não há como resolver arquivos externos .bin/.png. */
export function gltfAutocontido(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false
  const j = json as { asset?: { version?: string }; buffers?: { uri?: string }[]; images?: { uri?: string }[] }
  if (!j.asset?.version) return false
  const externos = [...(j.buffers ?? []), ...(j.images ?? [])].some((b) => b.uri && !b.uri.startsWith('data:'))
  return !externos
}

export function ehGlb(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46 // "glTF"
}

const DICAS: Record<string, string> = {
  ai: 'Arquivo do Illustrator: selecione a arte e copie (Ctrl/⌘+C) com "Clipboard: SVG" ativado, ou exporte como SVG.',
  psd: 'Arquivo do Photoshop: exporte como PNG ou JPG (Arquivo > Exportar > Exportação rápida).',
  fig: 'Arquivo do Figma: selecione o frame e use Copiar como SVG ou Copiar como PNG (⇧⌘C), depois cole aqui.',
  sketch: 'Arquivo do Sketch: exporte as pranchetas como SVG ou PNG.',
  blend: 'Arquivo do Blender: exporte em Arquivo > Exportar > glTF 2.0 (.glb).',
  fbx: 'Modelo FBX: converta para .glb (no Blender: importe e exporte como glTF 2.0).',
  obj: 'Modelo OBJ: converta para .glb (no Blender: importe e exporte como glTF 2.0).',
  usdz: 'USDZ é só para AR no iPhone; envie o .glb do mesmo modelo.',
  lottie: 'Arquivo .lottie (compactado): exporte como JSON no LottieFiles ou no After Effects (Bodymovin).',
  pdf: 'PDF ainda não é importado. Exporte as páginas como PNG ou use Criar com IA > Importar arquivo.',
  pptx: 'PowerPoint ainda não é importado direto. Use Criar com IA > Importar arquivo.',
  key: 'Keynote ainda não é importado. Exporte as telas como PNG.',
  heic: 'HEIC não roda em todos os navegadores. Exporte como JPG.',
}

export function classificar(nome: string, mimeDeclarado: string, inicio: Uint8Array, texto?: string): Classificacao {
  const e = ext(nome)
  const m = mimeDeclarado.toLowerCase()
  if (ehGlb(inicio)) return { tipo: 'model3d', mime: 'model/gltf-binary' }
  if (m === 'image/png' || e === 'png') return { tipo: 'image', mime: 'image/png' }
  if (m === 'image/jpeg' || e === 'jpg' || e === 'jpeg') return { tipo: 'image', mime: 'image/jpeg' }
  if (m === 'image/webp' || e === 'webp') return { tipo: 'image', mime: 'image/webp' }
  if (m === 'image/avif' || e === 'avif') return { tipo: 'image', mime: 'image/avif' }
  if (m === 'image/gif' || e === 'gif') return { tipo: 'gif', mime: 'image/gif' }
  if (m === 'video/mp4' || e === 'mp4' || e === 'm4v') return { tipo: 'video', mime: 'video/mp4' }
  if (m === 'video/webm' || e === 'webm') return { tipo: 'video', mime: 'video/webm' }
  if (m === 'video/quicktime' || e === 'mov') return { tipo: 'video', mime: 'video/quicktime', dica: 'MOV pode não tocar no Chrome/Android. Prefira MP4 (H.264).' }
  if (m === 'image/svg+xml' || e === 'svg') return { tipo: 'svg', mime: 'image/svg+xml' }
  if (texto !== undefined && (e === 'json' || e === 'gltf' || m === 'application/json' || m === 'model/gltf+json')) {
    try {
      const j = JSON.parse(texto)
      if (ehLottie(j)) return { tipo: 'lottie', mime: 'application/json' }
      if (gltfAutocontido(j)) return { tipo: 'model3d', mime: 'model/gltf+json' }
      if ((j as { asset?: unknown }).asset) return { tipo: 'nao_suportado', mime: m, dica: 'Este .gltf aponta para arquivos externos (.bin/.png). Exporte como .glb (binário) no Blender.' }
    } catch {
      /* não é JSON */
    }
    return { tipo: 'nao_suportado', mime: m, dica: 'JSON não reconhecido. Aceitamos animações Lottie (Bodymovin) e modelos glTF.' }
  }
  if (e === 'glb') return { tipo: 'model3d', mime: 'model/gltf-binary' }
  return { tipo: 'nao_suportado', mime: m, dica: DICAS[e] ?? `Formato .${e || '?'} não suportado. Aceitamos PNG, JPG, WebP, GIF, SVG, MP4, WebM, GLB/GLTF e Lottie (JSON).` }
}

/** Formatos que precisam ser lidos como texto para classificar. */
export function precisaTexto(nome: string, mime: string): boolean {
  const e = ext(nome)
  return ['svg', 'json', 'gltf'].includes(e) || mime === 'image/svg+xml' || mime === 'application/json' || mime === 'model/gltf+json'
}

export const EXTENSOES_ACEITAS = '.png,.jpg,.jpeg,.webp,.avif,.gif,.svg,.mp4,.webm,.mov,.glb,.gltf,.json'
