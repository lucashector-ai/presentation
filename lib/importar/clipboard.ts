/**
 * Interpreta o conteúdo colado/solto no editor. Puro sobre um objeto simples (não depende de DataTransfer),
 * para ser testável; o editor converte o evento com `lerDataTransfer`.
 *
 * Ordem de prioridade:
 *  1. Camadas copiadas da própria Mostra (marcador JSON)
 *  2. Arquivos (PNG do "Copiar como PNG" do Figma, imagens do sistema, arquivos soltos)
 *  3. SVG em texto (Figma "Copiar como SVG", Illustrator com Clipboard SVG)
 *  4. HTML com <svg> ou <img>
 *  5. URL (imagem, embed permitido) ou texto simples
 */
import { ehSvg, extrairSvgDeHtml } from './svg'
import { HOSTS_EMBED } from '@/lib/scene/schema'

export const MARCADOR_MOSTRA = 'mostra/camadas@1'

export interface ConteudoColado {
  arquivos: File[]
  texto: string
  html: string
}

export type ItemImportado =
  | { tipo: 'camadas'; camadas: unknown[] }
  | { tipo: 'arquivos'; arquivos: File[] }
  | { tipo: 'svg'; markup: string; origem: 'figma' | 'illustrator' | 'svg' }
  | { tipo: 'imagemUrl'; url: string }
  | { tipo: 'embed'; url: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'aviso'; mensagem: string }
  | { tipo: 'vazio' }

export function serializarCamadas(camadas: unknown[]): string {
  return JSON.stringify({ [MARCADOR_MOSTRA]: true, camadas })
}

function lerCamadasMostra(texto: string): unknown[] | null {
  if (!texto.startsWith('{') || !texto.includes(MARCADOR_MOSTRA)) return null
  try {
    const j = JSON.parse(texto) as Record<string, unknown>
    return j[MARCADOR_MOSTRA] === true && Array.isArray(j.camadas) ? j.camadas : null
  } catch {
    return null
  }
}

function origemSvg(markup: string): 'figma' | 'illustrator' | 'svg' {
  if (/Adobe Illustrator|<!-- Generator: Adobe/i.test(markup) || /class="cls-\d+"/.test(markup)) return 'illustrator'
  if (/figma/i.test(markup) || /<svg[^>]*fill="none"/.test(markup)) return 'figma'
  return 'svg'
}

export function ehUrl(t: string): boolean {
  if (/\s/.test(t)) return false
  try {
    const u = new URL(t)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function ehUrlImagem(t: string): boolean {
  return ehUrl(t) && /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(t)
}

export function ehUrlEmbed(t: string): boolean {
  if (!ehUrl(t)) return false
  return (HOSTS_EMBED as readonly string[]).includes(new URL(t).hostname)
}

/** Converte links comuns (youtube watch, vimeo, figma file) para a URL de incorporação. */
export function urlParaEmbed(t: string): string {
  const u = new URL(t)
  if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
  if (u.hostname.endsWith('youtube.com') && u.searchParams.get('v')) return `https://www.youtube.com/embed/${u.searchParams.get('v')}`
  if (u.hostname === 'vimeo.com') return `https://player.vimeo.com/video${u.pathname}`
  if (u.hostname.endsWith('figma.com') && !u.pathname.startsWith('/embed')) return `https://www.figma.com/embed?embed_host=mostra&url=${encodeURIComponent(t)}`
  if (u.hostname === 'www.loom.com') return t.replace('/share/', '/embed/')
  return t
}

export function interpretar(c: ConteudoColado): ItemImportado {
  const texto = c.texto.trim()
  const camadas = lerCamadasMostra(texto)
  if (camadas) return { tipo: 'camadas', camadas }
  if (c.arquivos.length) return { tipo: 'arquivos', arquivos: c.arquivos }
  if (texto && ehSvg(texto)) return { tipo: 'svg', markup: texto, origem: origemSvg(texto) }
  if (c.html) {
    // cópia normal do Figma: buffer proprietário que o navegador não consegue ler
    if (c.html.includes('(figmeta)') || c.html.includes('data-metadata="<!--(figma')) {
      return { tipo: 'aviso', mensagem: 'O Figma copia num formato fechado. No Figma, clique com o botão direito > Copiar como > Copiar como SVG (ou PNG, ⇧⌘C) e cole de novo.' }
    }
    const svg = extrairSvgDeHtml(c.html)
    if (svg) return { tipo: 'svg', markup: svg, origem: origemSvg(svg) }
    const img = c.html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i)?.[1]
    if (img && (img.startsWith('data:image/') || ehUrl(img))) return { tipo: 'imagemUrl', url: img }
  }
  if (texto) {
    if (ehUrlEmbed(texto)) return { tipo: 'embed', url: urlParaEmbed(texto) }
    if (ehUrlImagem(texto)) return { tipo: 'imagemUrl', url: texto }
    return { tipo: 'texto', texto: c.texto.replace(/\r\n/g, '\n').slice(0, 5000) }
  }
  return { tipo: 'vazio' }
}

/** Converte um DataTransfer (paste/drop) para ConteudoColado. */
export function lerDataTransfer(dt: DataTransfer): ConteudoColado {
  const arquivos: File[] = []
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file') {
      const f = item.getAsFile()
      if (f) arquivos.push(f)
    }
  }
  if (!arquivos.length) arquivos.push(...Array.from(dt.files ?? []))
  return { arquivos, texto: dt.getData('text/plain') ?? '', html: dt.getData('text/html') ?? '' }
}
