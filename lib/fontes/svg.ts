/**
 * SVG importado/colado com textos (Illustrator, Figma, navegador): os nomes de fonte viram as famílias do catálogo
 * do Google ("PlayfairDisplay-Bold" → 'Playfair Display' peso 700) e as fontes são EMBUTIDAS no próprio SVG,
 * recortadas aos glifos usados (`text=` do Google via /fontes/css; poucos KB). O renderizador mostra SVG como
 * <img src="data:…">, que não carrega nada de fora: sem embutir, o texto sairia na fonte de reserva no editor,
 * na apresentação e na exportação.
 */
import { mapearFonte, varianteReal, type Catalogo } from './catalogo'
import { urlFolha, type PedidoFamilia, type Variante } from './url'

/**
 * Visita cada valor de font-family do SVG nos três lugares em que ele aparece — atributo, style="…" e <style> —
 * sabendo qual aspa delimita o contexto (para a troca não quebrar o atributo). `fn` devolve o valor novo ou null.
 */
export function trocarFamilias(markup: string, fn: (valor: string, aspa: '"' | "'" | null) => string | null): string {
  const css = (texto: string, aspa: '"' | "'" | null) => texto.replace(/(font-family\s*:\s*)([^;}]*)/gi, (todo, pre: string, v: string) => { const n = fn(v.trim(), aspa); return n === null ? todo : `${pre}${n}` })
  return markup
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_t, attrs: string, corpo: string) => `<style${attrs}>${css(corpo, null)}</style>`)
    .replace(/(\sstyle\s*=\s*)(["'])(.*?)\2/gi, (_t, pre: string, q: '"' | "'", corpo: string) => `${pre}${q}${css(corpo, q)}${q}`)
    .replace(/(\sfont-family\s*=\s*)(["'])(.*?)\2/gi, (todo, pre: string, q: '"' | "'", v: string) => { const n = fn(v.trim(), q); return n === null ? todo : `${pre}${q}${n}${q}` })
}
const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** Texto visível dos <text> (para recortar as fontes). */
export function textoDoSvg(markup: string): string {
  const partes = markup.match(/<text\b[\s\S]*?<\/text>/gi) ?? []
  return partes
    .map((t) => t.replace(/<[^>]+>/g, '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (_, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e.toLowerCase()] ?? '')))
    .join('')
}

/** Famílias citadas no SVG → família do catálogo e variantes pedidas (pesos do arquivo + o do nome PostScript). */
export function fontesDoSvg(markup: string, cat: Catalogo): { pedido: PedidoFamilia[]; trocas: Map<string, string> } {
  const pesos = new Set<number>([400])
  for (const m of markup.matchAll(/font-weight\s*(?:=\s*["']|:\s*)\s*(\d{3}|bold|bolder|normal|lighter)/gi)) {
    const v = m[1]!.toLowerCase()
    pesos.add(v === 'bold' || v === 'bolder' ? 700 : v === 'normal' ? 400 : v === 'lighter' ? 300 : Number(v))
  }
  const italico = /font-style\s*(?:=\s*["']|:\s*)\s*(italic|oblique)/i.test(markup)
  const variantes = new Map<string, Variante[]>()
  const trocas = new Map<string, string>()
  const valores: string[] = []
  trocarFamilias(markup, (v) => { valores.push(v); return null })
  for (const bruto of valores) {
    if (!bruto || trocas.has(bruto)) continue
    const r = mapearFonte(cat, bruto)
    const f = r && cat.porNome.get(r.familia)
    if (!r || !f || f.origem !== 'google') continue
    trocas.set(bruto, r.familia)
    const vs = variantes.get(r.familia) ?? []
    const base = r.peso ? [r.peso] : [...pesos]
    for (const p of base) {
      vs.push(varianteReal(f, p, false))
      if (italico || r.italico) vs.push(varianteReal(f, p, true))
    }
    variantes.set(r.familia, vs)
  }
  return { pedido: [...variantes].map(([familia, vs]) => ({ familia, variantes: vs.slice(0, 12) })), trocas }
}

const paraBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Troca os nomes pelos do catálogo (aspas do lado certo) e põe as @font-face embutidas logo depois do <svg>. */
export function aplicarFontesNoSvg(markup: string, trocas: Map<string, string>, faces: string): string {
  let m = trocarFamilias(markup, (valor, aspa) => {
    const familia = trocas.get(valor)
    if (!familia) return null
    const q = aspa === '"' ? "'" : '"'
    // o valor original fica como reserva (sem a aspa que fecharia o contexto)
    const resto = aspa ? valor.split(aspa).join(q) : valor
    return `${q}${familia}${q}, ${resto}`
  })
  if (faces) m = m.replace(/<svg\b[^>]*>/i, (tag) => `${tag}<style>${faces}</style>`)
  return m
}

/**
 * Faz tudo: mapeia, baixa as fontes recortadas pelo proxy do app e embute. Sem texto, sem fontes do catálogo ou
 * sem rede, devolve o SVG como veio (só com os nomes trocados).
 */
export async function embutirFontesNoSvg(markup: string, cat: Catalogo, buscar: (url: string) => Promise<Response> = (u) => fetch(u)): Promise<string> {
  if (!/<text\b/i.test(markup)) return markup
  const { pedido, trocas } = fontesDoSvg(markup, cat)
  if (!pedido.length) return markup
  const texto = [...new Set(textoDoSvg(markup))].join('').slice(0, 380)
  let faces = ''
  try {
    if (texto.trim()) {
      const css = await (await buscar(urlFolha({ familias: pedido, texto }))).text()
      const blocos = css.match(/@font-face\s*{[^}]*}/g) ?? []
      const embutidos = await Promise.all(blocos.map(async (b) => {
        const url = /url\(([^)]+)\)/.exec(b)?.[1]?.replace(/^['"]|['"]$/g, '')
        if (!url) return ''
        const r = await buscar(url)
        if (!r.ok) return ''
        return b.replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${paraBase64(await r.arrayBuffer())}) format('woff2');`).replace(/\s*\n\s*/g, ' ')
      }))
      faces = embutidos.filter(Boolean).join('\n')
    }
  } catch {
    faces = ''
  }
  return aplicarFontesNoSvg(markup, trocas, faces)
}
