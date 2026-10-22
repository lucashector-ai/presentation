/**
 * Recursos embutidos nas máscaras (só no navegador). Uma máscara é uma imagem SVG (data URL) e imagens SVG não
 * carregam nada de fora: as fontes dos textos-máscara e os arquivos das imagens-máscara entram como data URL.
 *
 * - Fontes: as regras @font-face da família (folhas da página — Geist do @fontsource — ou a do proxy de fontes),
 *   filtradas pelo estilo, pelo peso e pelos subconjuntos que o texto usa; cada arquivo vira data URL.
 * - Imagens: o arquivo do asset; fotos grandes são reduzidas (lado maior ≤ 1600 px, PNG para manter o alfa).
 *
 * Cache por chave (mesma fonte/imagem em várias máscaras, telas e miniaturas é carregada uma vez).
 */
import { precisaCarregar } from '@/components/renderer/fontes'
import { urlFolha } from '@/lib/fontes/url'
import type { Camada } from './schema'
import { recursosDasMascaras, type PedidoRecurso } from './mascara'

const prontos = new Map<string, string | null>()
const pendentes = new Map<string, Promise<string | null>>()
const ouvintes = new Set<() => void>()

/** Recursos já carregados (a mesma instância; muda de conteúdo quando algo termina de carregar). */
export const recursosProntos = (): ReadonlyMap<string, string | null> => prontos

export function aoCarregarRecurso(f: () => void): () => void {
  ouvintes.add(f)
  return () => ouvintes.delete(f)
}

export function carregarRecurso(p: PedidoRecurso): Promise<string | null> {
  if (prontos.has(p.chave)) return Promise.resolve(prontos.get(p.chave) ?? null)
  let pr = pendentes.get(p.chave)
  if (!pr) {
    pr = (p.tipo === 'fonte' ? cssDaFonte(p.familia, p.peso, p.italico, p.todos) : dataUrlDaImagem(p.url))
      .catch(() => null)
      .then((v) => {
        prontos.set(p.chave, v)
        pendentes.delete(p.chave)
        for (const f of ouvintes) f()
        return v
      })
    pendentes.set(p.chave, pr)
  }
  return pr
}

/** Exportação: espera as fontes e imagens das máscaras da cena (com tempo-limite). */
export async function prepararMascaras(camadas: readonly Camada[], assets: Readonly<Record<string, { url: string } | undefined>>, limiteMs = 8000): Promise<void> {
  const pedidos = recursosDasMascaras(camadas, assets)
  if (!pedidos.length) return
  await Promise.race([Promise.all(pedidos.map(carregarRecurso)), new Promise((r) => setTimeout(r, limiteMs))])
}

// ---------- fontes ----------

interface RegraFonte { familia: string; estilo: string; peso: [number, number]; faixa?: string; src: string; base: string }

const tirarAspas = (s: string) => s.trim().replace(/^["']|["']$/g, '')

function lerRegras(css: string, base: string): RegraFonte[] {
  const r: RegraFonte[] = []
  for (const bloco of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const prop = (nome: string) => new RegExp(`(?:^|[;{\\s])${nome}\\s*:\\s*([^;}]+)`, 'i').exec(bloco)?.[1]?.trim()
    const familia = prop('font-family')
    const src = /url\(\s*(["']?)([^"')]+)\1\s*\)/.exec(prop('src') ?? '')?.[2]
    if (!familia || !src) continue
    const pesos = (prop('font-weight') ?? '400').split(/\s+/).map((x) => (x === 'normal' ? 400 : x === 'bold' ? 700 : Number(x))).filter((x) => Number.isFinite(x))
    r.push({ familia: tirarAspas(familia), estilo: (prop('font-style') ?? 'normal').split(/\s+/)[0]!, peso: [pesos[0] ?? 400, pesos[1] ?? pesos[0] ?? 400], faixa: prop('unicode-range'), src, base })
  }
  return r
}

/** Faixa unicode toca o latim (U+0000–024F)? Sem faixa = cobre tudo. */
function tocaLatim(faixa?: string): boolean {
  if (!faixa) return true
  return faixa.split(',').some((f) => {
    const [a, b] = f.trim().replace(/^U\+/i, '').split('-')
    const ini = parseInt((a ?? '').replace(/\?/g, '0'), 16)
    const fim = b ? parseInt(b, 16) : parseInt((a ?? '').replace(/\?/g, 'f'), 16)
    return Number.isFinite(ini) && ini <= 0x24f && (Number.isFinite(fim) ? fim : ini) >= 0
  })
}

async function regrasDaPagina(familia: string, peso: number, italico: boolean): Promise<RegraFonte[]> {
  const r: RegraFonte[] = []
  const externas: string[] = []
  for (const folha of Array.from(document.styleSheets)) {
    try {
      const base = folha.href ?? location.href
      for (const regra of Array.from(folha.cssRules)) if (regra instanceof CSSFontFaceRule) r.push(...lerRegras(regra.cssText, base))
    } catch {
      if (folha.href) externas.push(folha.href)
    }
  }
  const daFamilia = (l: RegraFonte[]) => l.filter((x) => x.familia === familia)
  if (daFamilia(r).length) return daFamilia(r)
  // folha de outra origem (sem acesso às regras) ou família ainda não pedida: busca o CSS pelo proxy de fontes
  const proxy = precisaCarregar(familia) ? new URL(urlFolha({ familias: [{ familia, variantes: [{ peso, italico }] }] }), location.href).href : null
  for (const url of [...externas.filter((u) => u.includes('fonts.googleapis.com') && u.includes(encodeURIComponent(familia).replace(/%20/g, '+'))), ...(proxy ? [proxy] : [])]) {
    try {
      const css = await (await fetch(url)).text()
      const l = daFamilia(lerRegras(css, url))
      if (l.length) return l
    } catch { /* tenta a próxima */ }
  }
  return []
}

const paraDataUrl = (b: Blob) => new Promise<string>((ok, falha) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.onerror = () => falha(f.error); f.readAsDataURL(b) })

async function cssDaFonte(familia: string, peso: number, italico: boolean, todos: boolean): Promise<string | null> {
  if (typeof document === 'undefined') return null
  const regras = (await regrasDaPagina(familia, peso, italico)).filter((r) => (todos || tocaLatim(r.faixa)))
  if (!regras.length) return null
  const estilo = italico ? 'italic' : 'normal'
  const doEstilo = regras.filter((r) => r.estilo === estilo).length ? regras.filter((r) => r.estilo === estilo) : regras
  // peso exato (ou faixa variável que o contém); senão o mais próximo, como o navegador escolheria
  const dist = (r: RegraFonte) => (peso < r.peso[0] ? r.peso[0] - peso : peso > r.peso[1] ? peso - r.peso[1] : 0)
  const melhor = Math.min(...doEstilo.map(dist))
  const escolhidas = doEstilo.filter((r) => dist(r) === melhor)
  const partes = await Promise.all(escolhidas.map(async (r) => {
    const url = new URL(r.src, r.base).href
    const dado = url.startsWith('data:') ? url : await paraDataUrl(await (await fetch(url)).blob())
    return `@font-face{font-family:"${familia}";font-style:${r.estilo};font-weight:${r.peso[0]} ${r.peso[1]};${r.faixa ? `unicode-range:${r.faixa};` : ''}src:url(${dado})}`
  }))
  return partes.join('')
}

// ---------- imagens ----------

const LADO_MAXIMO = 1600

async function dataUrlDaImagem(url: string): Promise<string | null> {
  if (typeof document === 'undefined') return null
  if (url.startsWith('data:')) return url
  const blob = await (await fetch(url)).blob()
  if (blob.type.includes('svg') || blob.size < 400_000) return await paraDataUrl(blob)
  const bmp = await createImageBitmap(blob)
  const k = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height))
  if (k === 1 && blob.size < 1_500_000) { bmp.close(); return await paraDataUrl(blob) }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * k))
  canvas.height = Math.max(1, Math.round(bmp.height * k))
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  // JPEG não tem alfa: só fotos sem transparência (JPEG de origem) continuam JPEG
  return blob.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png')
}
