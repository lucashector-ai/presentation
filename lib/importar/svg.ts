/**
 * SVG vindo do Figma ("Copiar como SVG"), do Illustrator (copiar com "Clipboard: SVG") ou de arquivos .svg.
 * SVG pode carregar scripts e referências externas, então TUDO passa por `sanitizarSvg` antes de virar camada
 * ou asset. Além disso o renderizador exibe SVG como <img src="data:..."> (scripts nunca executam nesse contexto).
 *
 * Funções puras sobre string; a sanitização recebe a instância do DOMPurify (navegador: dompurify; servidor/testes:
 * isomorphic-dompurify) para este módulo não depender do ambiente.
 */

export interface Purificador {
  sanitize(dirty: string, cfg: Record<string, unknown>): string | unknown
}

const RE_SVG = /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i

/** O texto é um documento SVG? */
export function ehSvg(texto: string): boolean {
  return RE_SVG.test(texto) && /<\/svg>\s*$/i.test(texto.trim())
}

/** Extrai o primeiro <svg>…</svg> de um HTML (alguns apps colam SVG embrulhado em HTML). */
export function extrairSvgDeHtml(html: string): string | null {
  const m = html.match(/<svg[\s\S]*?<\/svg>/i)
  return m ? m[0] : null
}

const HREF_SEGURO = /^(#|data:image\/(png|jpe?g|gif|webp);base64,)/i

const ELEMENTO_PROIBIDO = /<\s*(?:[\w-]+:)?(script|foreignObject|iframe|object|embed|audio|video|animate|set|animateMotion|animateTransform|a|handler|listener|base|meta|link)\b/i

/**
 * Conferência ESTRITA, sem DOM (para ambientes onde o DOMPurify não roda, como o workerd): não limpa nada, só
 * aceita SVG que já está limpo (o editor sanitiza no navegador antes de enviar) e recusa qualquer coisa duvidosa.
 * Devolve o motivo da recusa, ou null se o SVG pode ser gravado como está.
 */
export function motivoSvgInseguro(markup: string): string | null {
  if (/<!ENTITY|<!DOCTYPE[^>]*\[|<\?xml-stylesheet/i.test(markup)) return 'O SVG declara entidades ou folhas de estilo externas.'
  if (ELEMENTO_PROIBIDO.test(markup)) return 'O SVG tem scripts, links ou elementos incorporados.'
  if (/\son[a-z]+\s*=/i.test(markup)) return 'O SVG tem atributos de evento (on…).'
  if (/javascript\s*:|vbscript\s*:|expression\s*\(|@import/i.test(markup)) return 'O SVG tem código embutido.'
  // referências e estilos não podem esconder nada atrás de entidades numéricas
  if (/(?:href|style|src)\s*=\s*(["'])[^"']*&#/i.test(markup)) return 'O SVG tem referências codificadas.'
  for (const m of markup.matchAll(/\s(?:[\w-]+:)?(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) if (!HREF_SEGURO.test((m[2] ?? '').trim())) return 'O SVG aponta para arquivos externos.'
  for (const m of markup.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) if (!/^(#|data:image\/(png|jpe?g|gif|webp);base64,)/i.test((m[2] ?? '').trim())) return 'O SVG usa imagens externas no estilo.'
  return null
}

/**
 * Remove scripts, handlers on*, foreignObject, <use>/<image> externos, javascript:, @import e url() externos.
 * Mantém <style> (Illustrator usa classes .cls-1) com o CSS filtrado.
 */
export function sanitizarSvg(markup: string, purify: Purificador): string {
  const limpo = String(
    purify.sanitize(markup, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['style', 'use'],
      FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'animate', 'set', 'animateMotion', 'animateTransform', 'a'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onbegin', 'onend', 'onmouseover', 'onfocus'],
      ALLOW_DATA_ATTR: false,
      WHOLE_DOCUMENT: false,
    })
  )
  return (
    limpo
      // href/xlink:href só locais (#id) ou imagens embutidas
      .replace(/\s(xlink:href|href)\s*=\s*(["'])(.*?)\2/gi, (_m, attr: string, q: string, v: string) => (HREF_SEGURO.test(v.trim()) ? ` ${attr}=${q}${v}${q}` : ''))
      // CSS: sem @import, sem url() externo, sem expression()
      .replace(/@import[^;]+;?/gi, '')
      .replace(/url\(\s*(['"]?)(?!#|data:image\/(?:png|jpe?g|gif|webp);base64,)[^)]*\1\s*\)/gi, 'none')
      .replace(/expression\s*\(/gi, '(')
      .replace(/javascript:/gi, '')
      .trim()
  )
}

/** Dimensões intrínsecas (viewBox tem prioridade; depois width/height). */
export function dimensoesSvg(markup: string): { width: number; height: number } {
  const tag = markup.match(/<svg[^>]*>/i)?.[0] ?? ''
  const vb = tag.match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (vb) {
    const w = Number(vb[3])
    const h = Number(vb[4])
    if (w > 0 && h > 0) return { width: w, height: h }
  }
  const w = parseFloat(tag.match(/\swidth\s*=\s*["']([\d.]+)/i)?.[1] ?? '')
  const h = parseFloat(tag.match(/\sheight\s*=\s*["']([\d.]+)/i)?.[1] ?? '')
  return { width: w > 0 ? w : 300, height: h > 0 ? h : 150 }
}

/** Garante viewBox (para escalar sem distorcer) e remove width/height fixos do elemento raiz. */
export function normalizarSvg(markup: string): string {
  const { width, height } = dimensoesSvg(markup)
  return markup.replace(/<svg([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs.replace(/\s(width|height)\s*=\s*(["'])[^"']*\2/gi, '')
    if (!/viewBox/i.test(a)) a += ` viewBox="0 0 ${width} ${height}"`
    if (!/xmlns=/i.test(a)) a += ' xmlns="http://www.w3.org/2000/svg"'
    return `<svg${a}>`
  })
}

// ---------- cores ----------

const NOMES: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', blue: '#0000ff', green: '#008000', gray: '#808080', grey: '#808080', yellow: '#ffff00', orange: '#ffa500' }
const RE_COR = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)/g
const RE_NOME = /((?:fill|stroke|stop-color|color)\s*[:=]\s*["']?)(black|white|red|blue|green|gr[ae]y|yellow|orange)\b/gi

export function normalizarCor(c: string): string | null {
  const s = c.trim().toLowerCase()
  if (NOMES[s]) return NOMES[s]
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{8}$/.test(s)) return s.slice(0, 7)
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/)
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')
  return null
}

/** Cores usadas no SVG (para o painel "Cores do vetor"), em ordem de frequência. */
export function coresDoSvg(markup: string): string[] {
  const contagem = new Map<string, number>()
  const somar = (c: string | null) => c && contagem.set(c, (contagem.get(c) ?? 0) + 1)
  for (const m of markup.matchAll(RE_COR)) somar(normalizarCor(m[0]))
  for (const m of markup.matchAll(RE_NOME)) somar(normalizarCor(m[2] as string))
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
}

/** Aplica o mapa de troca de cores (chaves normalizadas #rrggbb). */
export function recolorirSvg(markup: string, mapa: Record<string, string>): string {
  if (!Object.keys(mapa).length) return markup
  const trocar = (orig: string) => {
    const n = normalizarCor(orig)
    return n && mapa[n] ? mapa[n] : orig
  }
  return markup.replace(RE_COR, trocar).replace(RE_NOME, (_m, pre: string, nome: string) => pre + trocar(nome))
}

export function svgParaDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
}
