/**
 * Endereços das fontes do Google servidas pelo próprio app (proxy do Worker, lib/fontes/proxy.ts).
 *
 *   navegador → /fontes/css?f=Playfair Display:400,700,i400[&t=texto]   (pedido simples, sem catálogo no cliente)
 *   Worker    → https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap
 *               (variantes ajustadas ao que a família tem; sem isso o Google responde 400 e nada carrega)
 *   CSS       → url(https://fonts.gstatic.com/s/…) vira url(/fontes/arquivo/s/…)  (mesma origem)
 *
 * Funções puras, usadas no cliente (montar o pedido) e no Worker (ler, validar, montar a URL do Google, reescrever).
 */
export const PREFIXO_FONTES = '/fontes'
export const ROTA_CSS = `${PREFIXO_FONTES}/css`
export const ROTA_ARQUIVO = `${PREFIXO_FONTES}/arquivo/`
export const ORIGEM_CSS_GOOGLE = 'https://fonts.googleapis.com'
export const ORIGEM_ARQUIVOS_GOOGLE = 'https://fonts.gstatic.com'

export interface Variante { peso: number; italico: boolean }
export interface PedidoFamilia { familia: string; variantes: Variante[] }
export interface PedidoFontes { familias: PedidoFamilia[]; texto?: string }

/** Limites do pedido (o Worker recusa o que passar disso). */
export const MAX_FAMILIAS = 40
export const MAX_VARIANTES = 18
export const MAX_TEXTO = 400

export const chaveVariante = (v: Variante) => `${v.italico ? 'i' : ''}${v.peso}`
export function lerVariante(s: string): Variante | null {
  const m = /^(i?)(\d{3})$/.exec(s.trim())
  if (!m) return null
  const peso = Number(m[2])
  if (peso < 100 || peso > 900) return null
  return { peso, italico: m[1] === 'i' }
}

const ordenar = (vs: Variante[]) => {
  const vistos = new Map<string, Variante>()
  for (const v of vs) vistos.set(chaveVariante(v), v)
  return [...vistos.values()].sort((a, b) => Number(a.italico) - Number(b.italico) || a.peso - b.peso)
}

/** URL relativa da folha de estilos (estável: mesmas famílias/variantes → mesma URL, para o cache). */
export function urlFolha(pedido: PedidoFontes): string {
  const p = new URLSearchParams()
  for (const f of [...pedido.familias].sort((a, b) => a.familia.localeCompare(b.familia))) {
    p.append('f', `${f.familia}:${ordenar(f.variantes).map(chaveVariante).join(',')}`)
  }
  if (pedido.texto) p.set('t', [...new Set(pedido.texto)].sort().join(''))
  return `${ROTA_CSS}?${p.toString()}`
}

const NOME_VALIDO = /^[\p{L}\p{N} .'&+-]{1,80}$/u

/** Lê e valida o pedido do navegador (null = inválido). */
export function lerPedido(busca: URLSearchParams): PedidoFontes | null {
  const fs = busca.getAll('f')
  if (!fs.length || fs.length > MAX_FAMILIAS) return null
  const familias: PedidoFamilia[] = []
  for (const f of fs) {
    const i = f.lastIndexOf(':')
    const familia = (i >= 0 ? f.slice(0, i) : f).trim()
    if (!NOME_VALIDO.test(familia)) return null
    const brutas = i >= 0 ? f.slice(i + 1).split(',').filter(Boolean) : ['400']
    if (brutas.length > MAX_VARIANTES) return null
    const variantes = brutas.map(lerVariante)
    if (variantes.some((v) => !v)) return null
    familias.push({ familia, variantes: ordenar(variantes as Variante[]) })
  }
  const texto = busca.get('t') ?? undefined
  if (texto !== undefined && (texto.length === 0 || [...texto].length > MAX_TEXTO)) return null
  return { familias, ...(texto ? { texto } : {}) }
}

/** O que o Worker sabe de cada família (do catálogo). */
export interface InfoFamilia {
  pesos: { tipo: 'faixa'; min: number; max: number } | { tipo: 'lista'; valores: number[] }
  italico: InfoFamilia['pesos'] | null
}

function maisProximo(p: InfoFamilia['pesos'], alvo: number): number {
  if (p.tipo === 'faixa') return Math.min(p.max, Math.max(p.min, alvo))
  let m = p.valores[0] ?? 400
  for (const v of p.valores) {
    const d = Math.abs(v - alvo)
    const dm = Math.abs(m - alvo)
    if (d < dm || (d === dm && (alvo >= 400 ? v > m : v < m))) m = v
  }
  return m
}

/** Ajusta as variantes pedidas às que a família tem (itálico inexistente vira normal; peso, o mais próximo). */
export function ajustarVariantes(info: InfoFamilia, vs: Variante[]): Variante[] {
  return ordenar(vs.map((v) => (v.italico && info.italico ? { peso: maisProximo(info.italico, v.peso), italico: true } : { peso: maisProximo(info.pesos, v.peso), italico: false })))
}

/**
 * URL do css2 do Google para o pedido (famílias fora do catálogo ficam de fora; null = nenhuma sobrou).
 * Formato do css2: `family=Nome:ital,wght@0,400;1,700` (tuplas em ordem crescente) ou `family=Nome:wght@400;700`.
 */
export function urlGoogle(pedido: PedidoFontes, info: (familia: string) => InfoFamilia | undefined): string | null {
  const partes: string[] = []
  for (const f of [...pedido.familias].sort((a, b) => a.familia.localeCompare(b.familia))) {
    const i = info(f.familia)
    if (!i) continue
    const vs = ajustarVariantes(i, f.variantes)
    const nome = encodeURIComponent(f.familia).replace(/%20/g, '+')
    const temItalico = vs.some((v) => v.italico)
    const eixo = temItalico ? `ital,wght@${vs.map((v) => `${v.italico ? 1 : 0},${v.peso}`).join(';')}` : `wght@${vs.map((v) => v.peso).join(';')}`
    partes.push(`family=${nome}:${eixo}`)
  }
  if (!partes.length) return null
  const texto = pedido.texto ? `&text=${encodeURIComponent(pedido.texto)}` : ''
  return `${ORIGEM_CSS_GOOGLE}/css2?${partes.join('&')}${texto}&display=swap`
}

/** Subconjuntos mantidos na folha: português (e o resto do latim). Os outros alfabetos ficam de fora. */
export const SUBCONJUNTOS_MANTIDOS = new Set(['latin', 'latin-ext'])

/**
 * Reescreve a folha do Google: arquivos passam a vir de /fontes/arquivo/… (mesma origem) e só ficam os blocos dos
 * subconjuntos latinos (o Google marca cada @font-face com um comentário `/* latin-ext *\/`; blocos sem marca —
 * pedidos com `text=` — ficam todos).
 */
export function reescreverCss(css: string, manter: ReadonlySet<string> = SUBCONJUNTOS_MANTIDOS): string {
  const blocos = css.split(/(?=\/\*\s*[\w\s[\]-]+\s*\*\/\s*@font-face)/)
  const filtrados = blocos.filter((b) => {
    const m = /^\/\*\s*([\w\s[\]-]+?)\s*\*\//.exec(b)
    return !m || manter.has(m[1]!)
  })
  // nenhum bloco latino (fonte só com outros alfabetos marcados): melhor tudo que nada
  const usar = filtrados.some((b) => b.includes('@font-face')) ? filtrados : blocos
  return usar.join('').replace(/url\((['"]?)https:\/\/fonts\.gstatic\.com\//g, `url($1${ROTA_ARQUIVO}`).trim() + '\n'
}

/**
 * Caminho de arquivo pedido ao proxy → URL no gstatic (null = recusado). Só os dois formatos que o Google usa:
 *   s/<família>/v<n>/<arquivo>.woff2|woff|ttf|otf     e     l/font?kit=…&skey=…&v=v<n>  (pedidos com text=)
 */
export function urlArquivoGoogle(caminho: string, busca: string): string | null {
  if (!caminho.startsWith(ROTA_ARQUIVO)) return null
  const resto = caminho.slice(ROTA_ARQUIVO.length)
  if (/^s\/[a-z0-9]+\/v\d+\/[A-Za-z0-9_.-]+\.(woff2|woff|ttf|otf)$/.test(resto)) return busca ? null : `${ORIGEM_ARQUIVOS_GOOGLE}/${resto}`
  if (resto === 'l/font') {
    const p = new URLSearchParams(busca)
    const kit = p.get('kit')
    const skey = p.get('skey')
    const v = p.get('v')
    if (!kit || !/^[A-Za-z0-9_-]{8,512}$/.test(kit) || (skey && !/^[a-f0-9]{8,64}$/.test(skey)) || (v && !/^v\d+$/.test(v))) return null
    const limpa = new URLSearchParams({ kit, ...(skey ? { skey } : {}), ...(v ? { v } : {}) })
    return `${ORIGEM_ARQUIVOS_GOOGLE}/l/font?${limpa.toString()}`
  }
  return null
}
