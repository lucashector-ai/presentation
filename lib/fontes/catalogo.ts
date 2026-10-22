/**
 * Catálogo de fontes do Mostra: as famílias do Google Fonts (lib/fontes/catalogo-google.json, gerado por
 * scripts/gerar-catalogo-fontes.mjs) + as locais do app (Geist, Geist Mono — empacotadas — e as do sistema).
 * Funções puras: busca, filtro por categoria, variantes (pesos/itálico) e o peso disponível mais próximo.
 * O JSON é grande (~85 KB): quem só carrega fontes (visualizador, página pública) NÃO importa este módulo.
 */
export const CATEGORIAS_FONTE = ['sans', 'serif', 'display', 'manuscrita', 'mono'] as const
export type CategoriaFonte = (typeof CATEGORIAS_FONTE)[number]
export const NOMES_CATEGORIA: Record<CategoriaFonte, string> = { sans: 'Sem serifa', serif: 'Serifa', display: 'Display', manuscrita: 'Manuscrita', mono: 'Mono' }

/** Formato do arquivo gerado (ver o script). */
export interface CatalogoBruto {
  versao: number
  origem: string
  subconjuntos: string[]
  familias: [nome: string, categoria: number, pesos: string, pesosItalico: string, subconjuntos: number[]][]
}

export interface FonteCatalogo {
  familia: string
  categoria: CategoriaFonte
  /** google = carregada sob demanda pelo proxy /fontes; local = já está no app ou no sistema. */
  origem: 'google' | 'local'
  /** Pesos disponíveis (estáticos) ou a faixa da fonte variável. */
  pesos: Pesos
  /** Pesos com itálico verdadeiro (null = sem itálico; o navegador inclina sozinho). */
  italico: Pesos | null
  subconjuntos: string[]
}
export type Pesos = { tipo: 'faixa'; min: number; max: number } | { tipo: 'lista'; valores: number[] }

export interface Catalogo {
  fontes: FonteCatalogo[]
  porNome: Map<string, FonteCatalogo>
  /** Nome normalizado (sem espaços, hífens e caixa) → fonte; para mapear nomes vindos do Figma/SVG. */
  porChave: Map<string, FonteCatalogo>
}

/** Fontes que o app já tem (não passam pelo Google). */
export const FONTES_LOCAIS: FonteCatalogo[] = [
  { familia: 'Geist', categoria: 'sans', origem: 'local', pesos: { tipo: 'faixa', min: 100, max: 900 }, italico: null, subconjuntos: ['latin', 'latin-ext'] },
  { familia: 'Geist Mono', categoria: 'mono', origem: 'local', pesos: { tipo: 'faixa', min: 100, max: 900 }, italico: null, subconjuntos: ['latin', 'latin-ext'] },
  { familia: 'Georgia', categoria: 'serif', origem: 'local', pesos: { tipo: 'lista', valores: [400, 700] }, italico: { tipo: 'lista', valores: [400, 700] }, subconjuntos: ['latin'] },
  { familia: 'system-ui', categoria: 'sans', origem: 'local', pesos: { tipo: 'faixa', min: 100, max: 900 }, italico: { tipo: 'faixa', min: 100, max: 900 }, subconjuntos: ['latin'] },
]
export const NOMES_LOCAIS = new Set(FONTES_LOCAIS.map((f) => f.familia))

function lerPesos(s: string): Pesos | null {
  if (!s) return null
  const faixa = /^(\d+)\.\.(\d+)$/.exec(s)
  if (faixa) return { tipo: 'faixa', min: Number(faixa[1]), max: Number(faixa[2]) }
  return { tipo: 'lista', valores: s.split(',').map(Number) }
}

export const chaveFonte = (nome: string) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function montarCatalogo(bruto: CatalogoBruto): Catalogo {
  const google = bruto.familias.filter(([nome]) => !NOMES_LOCAIS.has(nome)).map(([familia, cat, p, pi, subs]): FonteCatalogo => ({
    familia,
    categoria: CATEGORIAS_FONTE[cat] ?? 'sans',
    origem: 'google',
    pesos: lerPesos(p) ?? { tipo: 'lista', valores: [400] },
    italico: lerPesos(pi),
    subconjuntos: subs.map((i) => bruto.subconjuntos[i]!).filter(Boolean),
  }))
  const fontes = [...FONTES_LOCAIS, ...google].sort((a, b) => a.familia.localeCompare(b.familia, 'pt-BR'))
  const porNome = new Map(fontes.map((f) => [f.familia, f]))
  const porChave = new Map(fontes.map((f) => [chaveFonte(f.familia), f]))
  return { fontes, porNome, porChave }
}

let promessa: Promise<Catalogo> | null = null
let pronto: Catalogo | null = null
/** Carrega o catálogo sob demanda (chunk separado). */
export function carregarCatalogo(): Promise<Catalogo> {
  promessa ??= import('./catalogo-google.json').then((m) => (pronto = montarCatalogo((m.default ?? m) as unknown as CatalogoBruto)))
  return promessa
}
/** O catálogo, se já carregado (síncrono; null antes). */
export const catalogoPronto = () => pronto

// ---------- busca e filtro

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Busca por nome (sem acento e sem caixa; "playfair disp", "playfairdisplay" e "pfd" não — só subsequência de
 * palavras) e filtro por categoria. Ordem: nome exato, começa com a busca, palavra que começa com a busca, contém.
 */
export function buscarFontes(fontes: readonly FonteCatalogo[], busca: string, categoria?: CategoriaFonte | null): FonteCatalogo[] {
  const lista = categoria ? fontes.filter((f) => f.categoria === categoria) : fontes
  const q = semAcento(busca.trim()).replace(/\s+/g, ' ')
  if (!q) return [...lista]
  const qJunto = q.replace(/ /g, '')
  const pontuadas: [FonteCatalogo, number][] = []
  for (const f of lista) {
    const n = semAcento(f.familia)
    let p = -1
    if (n === q) p = 0
    else if (n.startsWith(q)) p = 1
    else if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) p = 2
    else if (n.includes(q)) p = 3
    else if (qJunto.length >= 3 && n.replace(/[\s-]+/g, '').includes(qJunto)) p = 4
    if (p >= 0) pontuadas.push([f, p])
  }
  return pontuadas.sort((a, b) => a[1] - b[1] || a[0].familia.length - b[0].familia.length || a[0].familia.localeCompare(b[0].familia)).map(([f]) => f)
}

// ---------- variantes

export const PESOS_PADRAO = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/** Pesos oferecidos no seletor de peso (de 100 em 100 dentro da faixa variável). */
export function pesosDisponiveis(p: Pesos): number[] {
  if (p.tipo === 'lista') return p.valores
  return PESOS_PADRAO.filter((v) => v >= p.min && v <= p.max)
}

/** Peso mais próximo disponível (regra do CSS: empate vai para o mais pesado acima de 400, mais leve abaixo). */
export function pesoMaisProximo(p: Pesos, desejado: number): number {
  if (p.tipo === 'faixa') return Math.min(p.max, Math.max(p.min, desejado))
  let melhor = p.valores[0] ?? 400
  for (const v of p.valores) {
    const d = Math.abs(v - desejado)
    const dm = Math.abs(melhor - desejado)
    if (d < dm || (d === dm && (desejado >= 400 ? v > melhor : v < melhor))) melhor = v
  }
  return melhor
}

/** A variante que existe de verdade para (peso, itálico) pedidos: itálico só se a família tiver. */
export function varianteReal(f: Pick<FonteCatalogo, 'pesos' | 'italico'>, peso: number, italico: boolean): { peso: number; italico: boolean } {
  if (italico && f.italico) return { peso: pesoMaisProximo(f.italico, peso), italico: true }
  return { peso: pesoMaisProximo(f.pesos, peso), italico: false }
}

/** Peso inicial bom para a família (400 se houver; senão o mais próximo). */
export const pesoPadrao = (f: Pick<FonteCatalogo, 'pesos'>) => pesoMaisProximo(f.pesos, 400)

export const suportaPortugues = (f: Pick<FonteCatalogo, 'subconjuntos'>) => f.subconjuntos.includes('latin')

// ---------- nomes vindos de fora (Figma, SVG)

const SUFIXOS = /(thin|hairline|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf|roman)+$/
const PESO_DO_ESTILO: [RegExp, number][] = [[/thin|hairline/, 100], [/extralight|ultralight/, 200], [/semibold|demibold/, 600], [/extrabold|ultrabold/, 800], [/black|heavy/, 900], [/light/, 300], [/medium/, 500], [/bold/, 700]]

/**
 * Mapeia um nome de fonte de fora para uma família do catálogo: "Playfair Display", "PlayfairDisplay-BoldItalic",
 * "playfair display" ou uma pilha CSS ("'Inter Variable', Inter, sans-serif"). Devolve a família do catálogo e o
 * peso/itálico lidos do sufixo do nome PostScript (se houver), ou null.
 */
export function mapearFonte(cat: Catalogo, nome: string): { familia: string; peso?: number; italico?: boolean } | null {
  for (const parte of nome.split(',')) {
    const limpo = parte.trim().replace(/^['"]|['"]$/g, '').trim()
    if (!limpo) continue
    const exato = cat.porNome.get(limpo)
    if (exato) return { familia: exato.familia }
    const chave = chaveFonte(limpo)
    const direto = cat.porChave.get(chave)
    if (direto) return { familia: direto.familia }
    // "PlayfairDisplay-BoldItalic", "Inter Variable", "Roboto Black"
    const [base, estilo = ''] = limpo.includes('-') ? [limpo.slice(0, limpo.lastIndexOf('-')), limpo.slice(limpo.lastIndexOf('-') + 1)] : [limpo, '']
    let cb = chaveFonte(base)
    let ce = chaveFonte(estilo)
    if (!cat.porChave.has(cb)) {
      const m = SUFIXOS.exec(cb)
      if (m && m.index > 0) { ce = m[0] + ce; cb = cb.slice(0, m.index) }
    }
    const f = cat.porChave.get(cb)
    if (f) {
      const peso = PESO_DO_ESTILO.find(([re]) => re.test(ce))?.[1] ?? (/regular|normal|book|roman/.test(ce) ? 400 : undefined)
      return { familia: f.familia, ...(peso !== undefined ? { peso } : {}), ...(/italic|oblique/.test(ce) ? { italico: true } : {}) }
    }
  }
  return null
}
