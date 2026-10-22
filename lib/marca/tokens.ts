/**
 * Design system em formato técnico → perfil de marca, sem IA (grátis):
 * - tokens JSON: W3C Design Tokens (`$value`/`$type`), Tokens Studio (`value`/`type`, inclusive tokens de
 *   tipografia e `fontFamilies`) e Style Dictionary (`value` em grupos aninhados), com referências `{a.b.c}`;
 * - CSS: variáveis (`--cor-primaria: #1F3B4D`, `var(--x)`), `font-family` de títulos e do corpo e o `@import`
 *   do Google Fonts.
 * O papel de cada cor vem do nome do token ("primary", "brand", "background", "text", "success"…).
 * Puro: sem rede, sem DOM (o catálogo de fontes chega por parâmetro).
 */
import type { Catalogo } from '@/lib/fontes/catalogo'
import { paraHex } from '@/lib/ia/designSystem'
import { distancia } from '@/lib/ia/marca'
import { atribuirPapeis, cmykParaHex } from './extrair'
import { reconhecerFonte, type FonteReconhecida } from './fontes'
import { PerfilMarcaSchema, type NivelFonte, type PapelCor, type PerfilMarca } from './perfil'

/** Maior arquivo de tokens/CSS lido (texto). */
export const MAX_BYTES_TOKENS = 2 * 1024 * 1024

/** Cor CSS (hex, rgb(), hsl()) → #RRGGBB; transparente demais ou desconhecida = null. */
export function corCss(v: string): string | null {
  const s = v.trim().toLowerCase()
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    const h = m[1]!
    if (h.length === 3 || h.length === 4) return `#${h.slice(0, 3).split('').map((c) => c + c).join('')}`.toUpperCase()
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`.toUpperCase()
    return null
  }
  m = /^rgba?\(\s*([\d.]+)%?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s)
  if (m) {
    const a = m[4] ? (m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])) : 1
    if (a < 0.5) return null
    return paraHex(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(s)
  if (m) {
    const h = Number(m[1]) / 360
    const sat = Number(m[2]) / 100
    const l = Number(m[3]) / 100
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat
    const p = 2 * l - q
    const c = (t0: number) => { let t = t0; if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
    return paraHex(c(h + 1 / 3) * 255, c(h) * 255, c(h - 1 / 3) * 255)
  }
  m = /^cmyk\(\s*([\d.]+)%?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?\s*\)$/.exec(s)
  if (m) return cmykParaHex(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]))
  return null
}

/** Papel pelo nome do token/variável ("color.brand.primary", "--cor-fundo-escuro", "bg-dark"). */
export function papelDoNome(nome: string): PapelCor | null {
  const n = nome.toLowerCase().replace(/[_.\-/\s]+/g, ' ')
  // estados de interação e escalas claras/escuras não definem papel
  if (/\b(hover|active|pressed|focus|disabled)\b/.test(n)) return null
  if (/\b(bg|background|fundo|surface|superficie)\b.*\b(dark|escuro|inverse|inverso)\b|\b(dark|escuro)\b.*\b(bg|background|fundo)\b/.test(n)) return 'fundoEscuro'
  if (/\b(card|cartao|panel|painel)\b/.test(n)) return 'cartao'
  if (/\b(success|sucesso|positive|positivo)\b/.test(n)) return 'positivo'
  if (/\b(error|erro|danger|perigo|negative|negativo|critical)\b/.test(n)) return 'negativo'
  if (/\b(text|texto|foreground|fg|ink|tinta|on surface|body)\b/.test(n)) return 'texto'
  if (/\b(bg|background|fundo|surface|superficie|canvas|base)\b/.test(n)) return 'fundoClaro'
  // "brand.secondary" é a secundária da marca: o nível vence o grupo
  if (/\b(secondary|secundaria)\b/.test(n)) return 'secundaria'
  if (/\b(accent|acento|destaque|highlight|tertiary|terciaria)\b/.test(n)) return 'destaque'
  if (/\b(primary|primaria|principal|brand|marca)\b/.test(n)) return 'principal'
  if (/\b(neutral|neutro|gray|grey|cinza)\b/.test(n)) return 'apoio'
  return null
}

/** Nível tipográfico pelo nome do token ("font.heading", "--fonte-corpo", "typography.display.lg"). */
export function nivelDoNome(nome: string): NivelFonte | null {
  const n = nome.toLowerCase()
  if (/num|figure|data|mono|tabular|code/.test(n)) return 'numeros'
  if (/head|title|titulo|display|h1|h2|h3|hero|destaque/.test(n)) return 'titulos'
  if (/body|text|texto|corpo|base|paragraph|paragrafo|copy|sans|default|regular/.test(n)) return 'textos'
  return null
}

interface Achado { cores: { nome: string; hex: string }[]; fontes: { nome: string; familia: string }[] }

/** Primeira família de uma pilha CSS ou de um token ("'Montserrat', sans-serif" → Montserrat). */
const primeiraFamilia = (v: string) => v.split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).find((x) => x && !/^(sans-serif|serif|monospace|system-ui|cursive|inherit|initial|-apple-system|BlinkMacSystemFont|ui-sans-serif|ui-serif|ui-monospace)$/i.test(x)) ?? ''

/** Junta cores e fontes achadas num perfil (papéis pelo nome, fontes pelo catálogo). */
function perfilDeAchados(a: Achado, cat: Catalogo, arquivo: string): PerfilMarca {
  const cores: { hex: string; papel: PapelCor | null; nome: string }[] = []
  // tokens de escala ("blue.100 … blue.900") pesam menos: ficam os com papel e, depois, os primeiros
  const comPapel = a.cores.map((c) => ({ ...c, papel: papelDoNome(c.nome) }))
  const ordenadas = [...comPapel.filter((c) => c.papel), ...comPapel.filter((c) => !c.papel)]
  for (const c of ordenadas) {
    if (cores.some((x) => distancia(x.hex, c.hex) < 10)) continue
    cores.push({ hex: c.hex, papel: c.papel, nome: c.nome.slice(0, 80) })
    if (cores.length >= 12) break
  }
  const fontes: Partial<Record<NivelFonte, FonteReconhecida>> = {}
  const soltas: FonteReconhecida[] = []
  for (const f of a.fontes) {
    const r = reconhecerFonte(cat, f.familia, true) ?? (f.familia ? { familia: 'Inter', original: f.familia, substituta: true } : null)
    if (!r) continue
    const nivel = nivelDoNome(f.nome)
    if (nivel && !fontes[nivel]) fontes[nivel] = r
    else if (!soltas.some((x) => x.familia === r.familia)) soltas.push(r)
  }
  for (const r of soltas) {
    if (Object.values(fontes).some((x) => x?.familia === r.familia)) continue
    if (!fontes.titulos) fontes.titulos = r
    else if (!fontes.textos) fontes.textos = r
  }
  return PerfilMarcaSchema.parse({
    origem: { arquivos: arquivo ? [arquivo.slice(0, 120)] : [], resumidoPorIa: false },
    cores: atribuirPapeis(cores),
    fontes: { titulos: fontes.titulos ?? null, textos: fontes.textos ?? null, numeros: fontes.numeros ?? null },
  })
}

// ---------------------------------------------------------------- JSON

type No = Record<string, unknown>
const ehObjeto = (v: unknown): v is No => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Tokens JSON (W3C, Tokens Studio, Style Dictionary) → perfil. Percorre os grupos; folha = objeto com
 * `$value`/`value`. Referências `{grupo.token}` são resolvidas (até 8 saltos). Tipo pelo `$type`/`type` ou
 * pelo valor (cor) e pelo caminho (fonte).
 */
export function perfilDeTokens(json: unknown, cat: Catalogo, arquivo = ''): PerfilMarca {
  const folhas = new Map<string, { valor: unknown; tipo: string }>()
  const andar = (no: unknown, caminho: string[], tipoHerdado: string, profundidade: number) => {
    if (!ehObjeto(no) || profundidade > 12 || folhas.size > 5000) return
    const tipo = String(no.$type ?? no.type ?? tipoHerdado ?? '')
    if ('$value' in no || ('value' in no && (typeof no.value !== 'object' || ehObjeto(no.value)))) {
      folhas.set(caminho.join('.'), { valor: no.$value ?? no.value, tipo })
      return
    }
    for (const [k, v] of Object.entries(no)) if (!k.startsWith('$')) andar(v, [...caminho, k], tipo, profundidade + 1)
  }
  andar(json, [], '', 0)
  // Tokens Studio exporta conjuntos ("global", "light"): o caminho sem o nome do conjunto também resolve
  const resolver = (v: unknown, saltos = 0): unknown => {
    if (typeof v !== 'string' || saltos > 8) return v
    const ref = /^\{([^}]+)\}$/.exec(v.trim())
    if (!ref) return v
    const alvo = folhas.get(ref[1]!) ?? [...folhas.entries()].find(([k]) => k.endsWith(`.${ref[1]!}`))?.[1]
    return alvo ? resolver(alvo.valor, saltos + 1) : v
  }
  const a: Achado = { cores: [], fontes: [] }
  for (const [nome, { valor: v0, tipo }] of folhas) {
    const v = resolver(v0)
    const t = tipo.toLowerCase()
    if (typeof v === 'string') {
      const cor = t === 'color' || !t || /colou?r|cor/.test(nome.toLowerCase()) ? corCss(v) : null
      if (cor) { a.cores.push({ nome, hex: cor }); continue }
      if (/fontfamil|font-famil|fontfamily/.test(t) || /font.?famil|typeface|fonte/i.test(nome)) a.fontes.push({ nome, familia: primeiraFamilia(v) })
    } else if (Array.isArray(v) && (/fontfamil/.test(t) || /font.?famil/i.test(nome))) {
      a.fontes.push({ nome, familia: primeiraFamilia(v.map(String).join(',')) })
    } else if (ehObjeto(v) && (t === 'typography' || 'fontFamily' in v)) {
      const fam = resolver(v.fontFamily)
      if (typeof fam === 'string') a.fontes.push({ nome, familia: primeiraFamilia(fam) })
      else if (Array.isArray(fam)) a.fontes.push({ nome, familia: primeiraFamilia(fam.map(String).join(',')) })
    }
  }
  return perfilDeAchados(a, cat, arquivo)
}

// ---------------------------------------------------------------- CSS

/**
 * CSS → perfil: variáveis com cor (resolvendo `var(--x)`), variáveis e regras de `font-family` (h1–h3 e
 * títulos → títulos; body/p → textos) e famílias do `@import`/`<link>` do Google Fonts.
 */
export function perfilDeCss(css: string, cat: Catalogo, arquivo = ''): PerfilMarca {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const vars = new Map<string, string>()
  for (const m of semComentarios.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(m[1]!)) vars.set(m[1]!, m[2]!.trim())
  const resolver = (v: string, saltos = 0): string => {
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v.trim())
    if (!m || saltos > 8) return v
    return resolver(vars.get(m[1]!) ?? m[2] ?? '', saltos + 1)
  }
  const a: Achado = { cores: [], fontes: [] }
  for (const [nome, bruto] of vars) {
    const v = resolver(bruto)
    const cor = corCss(v)
    if (cor) a.cores.push({ nome, hex: cor })
    else if (/font|fonte|typeface|family|familia/i.test(nome) && !/size|weight|peso|tamanho|leading|height/i.test(nome)) a.fontes.push({ nome, familia: primeiraFamilia(v) })
  }
  for (const m of semComentarios.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const seletor = m[1]!.trim()
    const ff = /font-family\s*:\s*([^;}]+)/i.exec(m[2]!)
    if (!ff || seletor.startsWith('@')) continue
    const v = resolver(ff[1]!.trim())
    const nome = /\bh[1-3]\b|title|titulo|heading|display/i.test(seletor) ? 'heading' : /\bbody\b|\bp\b|html|:root/i.test(seletor) ? 'body' : seletor
    a.fontes.push({ nome, familia: primeiraFamilia(v) })
  }
  for (const m of semComentarios.matchAll(/fonts\.googleapis\.com\/css2?\?([^"')\s;]+)/g)) {
    for (const fam of m[1]!.matchAll(/family=([^:&]+)/g)) a.fontes.push({ nome: 'google', familia: decodeURIComponent(fam[1]!.replace(/\+/g, ' ')) })
  }
  return perfilDeAchados(a, cat, arquivo)
}
