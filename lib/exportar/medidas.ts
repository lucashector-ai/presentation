/**
 * Exportar (lógica pura): tamanho das páginas do PDF, limite de escala do canvas, recorte da seleção numa
 * cena própria e nomes de arquivo. Testado em medidas.test.ts; a rasterização fica em rasterizar.tsx.
 */
import type { Camada, Cena } from '@/lib/scene/schema'
import { comDescendentes, raizesDaSelecao } from '@/lib/scene/arvore'
import { tintaAlemDaCaixa } from '@/lib/scene/tipografia'

export type FormatoImagem = 'png' | 'jpg'
export const ESCALAS = [1, 2, 3] as const

/** px de tela (96 dpi) → pt do PDF (72 dpi). Uma tela 1920×1080 vira uma página 1440×810 pt (20×11,25 pol). */
export const PT_POR_PX = 0.75

export interface PaginaPdf { largura: number; altura: number; orientacao: 'landscape' | 'portrait' }

/** Página do PDF no tamanho da tela (uma página por tela, sem margem). */
export function paginaPdf(tamanho: { width: number; height: number }): PaginaPdf {
  const largura = Math.round(tamanho.width * PT_POR_PX * 100) / 100
  const altura = Math.round(tamanho.height * PT_POR_PX * 100) / 100
  return { largura, altura, orientacao: largura >= altura ? 'landscape' : 'portrait' }
}

/** Limites de canvas dos navegadores (lado e área); a escala pedida é reduzida se passar deles. */
export const LADO_MAXIMO = 16_384
export const AREA_MAXIMA = 120_000_000

export function escalaSegura(tamanho: { width: number; height: number }, escala: number): number {
  const porLado = LADO_MAXIMO / Math.max(tamanho.width, tamanho.height)
  const porArea = Math.sqrt(AREA_MAXIMA / Math.max(1, tamanho.width * tamanho.height))
  return Math.max(0.1, Math.min(escala, porLado, porArea))
}

/** Caixa de uma camada considerando a rotação (para não cortar cantos ao exportar). */
export function caixaVisivel(l: Pick<Camada, 'x' | 'y' | 'width' | 'height' | 'rotation'>) {
  if (!l.rotation) return { x: l.x, y: l.y, width: l.width, height: l.height }
  const r = (l.rotation * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const w = l.width * c + l.height * s
  const h = l.width * s + l.height * c
  return { x: l.x + l.width / 2 - w / 2, y: l.y + l.height / 2 - h / 2, width: w, height: h }
}

/**
 * Cena só com as camadas selecionadas (e o conteúdo dos frames), recortada na caixa delas e com fundo
 * transparente — como exportar camadas no Figma. Devolve null se nada for exportável.
 */
export function cenaDaSelecao(cena: Cena, ids: readonly string[]): Cena | null {
  const raizes = raizesDaSelecao(ids, cena.layers)
  const r = new Set(raizes)
  const camadasRaiz = cena.layers.filter((l) => r.has(l.id) && !l.hidden)
  if (!camadasRaiz.length) return null
  const todos = new Set(comDescendentes(camadasRaiz.map((l) => l.id), cena.layers))
  // a máscara de uma camada exportada vai junto (não é desenhada, só recorta)
  for (const l of cena.layers) if (todos.has(l.id) && l.maskId) todos.add(l.maskId)
  // texto: as letras passam da caixa (acentos, descendentes; entrelinha justa ou corte vertical) e a exportação
  // inclui a tinta toda, como no Figma
  const caixas = camadasRaiz.map((l) => { if (l.type !== 'text') return caixaVisivel(l); const k = tintaAlemDaCaixa(l); return caixaVisivel({ ...l, y: l.y - k.topo, height: l.height + k.topo + k.base }) })
  const x0 = Math.floor(Math.min(...caixas.map((c) => c.x)))
  const y0 = Math.floor(Math.min(...caixas.map((c) => c.y)))
  const x1 = Math.ceil(Math.max(...caixas.map((c) => c.x + c.width)))
  const y1 = Math.ceil(Math.max(...caixas.map((c) => c.y + c.height)))
  return {
    ...cena,
    size: { width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) },
    background: '#00000000',
    backgroundGradient: undefined,
    backgroundAssetId: undefined,
    layers: cena.layers
      .filter((l) => todos.has(l.id))
      .map((l) => ({ ...l, x: l.x - x0, y: l.y - y0, ...(r.has(l.id) ? { parentId: undefined, absolute: undefined } : {}) }) as Camada),
  }
}

/**
 * Nome de arquivo seguro e portátil: "Atlas Ceramica - 03 Capa@2x.png". Sem acentos: alguns navegadores
 * descartam nomes de download fora do ASCII e salvam como "download".
 */
export function nomeArquivo(partes: (string | undefined)[], escala: number, formato: FormatoImagem | 'pdf'): string {
  const base = partes
    .map((p) =>
      (p ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[–—]/g, '-')
        .replace(/[^ -~]/g, '')
        .replace(/[\\/:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join(' - ')
    .slice(0, 120) || 'mostra'
  return `${base}${formato !== 'pdf' && escala !== 1 ? `@${escala}x` : ''}.${formato}`
}
