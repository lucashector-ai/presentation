/**
 * Guias de layout (grade, colunas e linhas) de telas e frames: padrões, resumo, geometria e alvos de encaixe.
 * Puro e testável (guias.test.ts). O schema fica em schema.ts (`GuiaLayoutSchema`); quem desenha é
 * components/editor/guias/CamadaGuias.tsx e quem encaixa é lib/editor/guias.ts (`extras` e `grades`).
 *
 * Geometria como no Figma:
 *  - Esticar: as faixas ocupam o espaço entre as margens (largura = (total − 2·margem − calhas) / quantidade);
 *  - Início/fim: faixas de largura fixa a partir da borda, deslocadas pela margem;
 *  - Centro: faixas de largura fixa centralizadas (a margem não vale).
 */
import { COR_GUIA_PADRAO, type Camada, type Cena, type GuiaFaixas, type GuiaLayout } from './schema'
import type { Retangulo } from './transform'

type TipoGuia = GuiaLayout['type']

/** Arredonda para a grade de 8 (mínimo 8). */
const em8 = (v: number) => Math.max(8, Math.round(v / 8) * 8)

/** Margem e calha da regra do 8 para a largura da área: 64 e 24 numa tela de 1920, proporcionais nas demais. */
export function medidasPadrao(area: { width: number }): { margem: number; calha: number } {
  const k = area.width / 1920
  return { margem: em8(64 * k), calha: em8(24 * k) }
}

/** Guia nova com os padrões da regra do 8: grade de 8; 12 colunas e 6 linhas com a margem e a calha da área. */
export function novaGuia(tipo: TipoGuia, area: { width: number; height: number }, parcial: { count?: number; size?: number } = {}): GuiaLayout {
  if (tipo === 'grid') return { type: 'grid', size: parcial.size ?? 8, color: COR_GUIA_PADRAO, visible: true }
  const { margem, calha } = medidasPadrao(area)
  return { type: tipo, count: parcial.count ?? (tipo === 'columns' ? 12 : 6), alignment: 'stretch', margin: margem, gutter: calha, color: COR_GUIA_PADRAO, visible: true }
}

/** Troca o tipo mantendo cor e visibilidade (como o seletor no topo do popover do Figma). */
export function trocarTipo(g: GuiaLayout, tipo: TipoGuia, area: { width: number; height: number }): GuiaLayout {
  if (g.type === tipo) return g
  const base = novaGuia(tipo, area)
  // colunas ↔ linhas: mantém quantidade, margem e calha
  if (g.type !== 'grid' && base.type !== 'grid') return { ...g, type: base.type } as GuiaLayout
  return { ...base, color: g.color, visible: g.visible }
}

export interface Predefinicao { id: string; rotulo: string; criar: (area: { width: number; height: number }) => GuiaLayout }

/** Atalhos do menu da seção: as grades mais usadas em apresentações. */
export const PREDEFINICOES_GUIA: Predefinicao[] = [
  { id: 'colunas12', rotulo: '12 colunas', criar: (a) => novaGuia('columns', a, { count: 12 }) },
  { id: 'colunas8', rotulo: '8 colunas', criar: (a) => novaGuia('columns', a, { count: 8 }) },
  { id: 'colunas4', rotulo: '4 colunas', criar: (a) => novaGuia('columns', a, { count: 4 }) },
  { id: 'grade8', rotulo: 'Grade 8px', criar: (a) => novaGuia('grid', a, { size: 8 }) },
]

export const NOMES_TIPO_GUIA: Record<TipoGuia, string> = { grid: 'Grade', columns: 'Colunas', rows: 'Linhas' }

/** "Grade 8px", "12 colunas", "1 linha". */
export function resumoGuia(g: GuiaLayout): string {
  if (g.type === 'grid') return `Grade ${g.size}px`
  const [um, varios] = g.type === 'columns' ? ['coluna', 'colunas'] : ['linha', 'linhas']
  return `${g.count} ${g.count === 1 ? um : varios}`
}

/** Comprimento da área no eixo das faixas (largura para colunas, altura para linhas). */
const totalDe = (g: GuiaFaixas, area: { width: number; height: number }) => (g.type === 'columns' ? area.width : area.height)

/** Largura (colunas) ou altura (linhas) que cada faixa teria esticada entre as margens. */
export function larguraEsticada(g: GuiaFaixas, area: { width: number; height: number }): number {
  return (totalDe(g, area) - 2 * g.margin - (g.count - 1) * g.gutter) / g.count
}

/** Largura de cada faixa no alinhamento atual (a fixa, ou a esticada). */
export function larguraFaixa(g: GuiaFaixas, area: { width: number; height: number }): number {
  return g.alignment === 'stretch' ? larguraEsticada(g, area) : (g.width ?? larguraEsticada(g, area))
}

/** Retângulos (px da cena) das colunas ou linhas dentro da área. Faixas sem espaço = nenhuma. */
export function faixasDaGuia(g: GuiaFaixas, area: Retangulo): Retangulo[] {
  const total = totalDe(g, area)
  const n = g.count
  const tam = larguraFaixa(g, area)
  if (!(tam > 0) || n < 1) return []
  const soma = n * tam + (n - 1) * g.gutter
  const ini = g.alignment === 'stretch' || g.alignment === 'start' ? g.margin : g.alignment === 'end' ? total - g.margin - soma : (total - soma) / 2
  const colunas = g.type === 'columns'
  return Array.from({ length: n }, (_, i) => {
    const p = ini + i * (tam + g.gutter)
    return colunas ? { x: area.x + p, y: area.y, width: tam, height: area.height } : { x: area.x, y: area.y + p, width: area.width, height: tam }
  })
}

/** Tamanho mínimo da célula na tela (px) para a grade aparecer e encaixar: abaixo disso ela some, como no Figma. */
export const GRADE_MIN_TELA = 4

export const gradeLegivel = (passo: number, escala: number) => passo * escala >= GRADE_MIN_TELA

/** Uma tela ou um frame com guias, e a área (px da cena) onde elas valem. */
export interface AreaGuias { id: string; guias: readonly GuiaLayout[]; area: Retangulo }

/**
 * Áreas com guias: a tela inteira e os frames visíveis e sem rotação que têm guias (as do frame valem dentro dele,
 * como no Figma). `ocultas` = camadas ocultas (inclusive por um pai oculto).
 */
export function areasComGuias(cena: Pick<Cena, 'id' | 'size' | 'guias'>, camadas: readonly Camada[], ocultas?: ReadonlySet<string>): AreaGuias[] {
  const r: AreaGuias[] = []
  if (cena.guias?.length) r.push({ id: cena.id, guias: cena.guias, area: { x: 0, y: 0, width: cena.size.width, height: cena.size.height } })
  for (const l of camadas) {
    if (l.type !== 'frame' || !l.guias?.length || l.rotation || ocultas?.has(l.id)) continue
    r.push({ id: l.id, guias: l.guias, area: { x: l.x, y: l.y, width: l.width, height: l.height } })
  }
  return r
}

/** Grade de encaixe (px da cena): linhas em x0 + k·passo e y0 + k·passo, só para caixas cujo centro está na área. */
export interface GradeEncaixe { passo: number; x0: number; y0: number; area: Retangulo }

/**
 * Alvos de encaixe das guias visíveis: bordas das colunas (x) e das linhas (y) e, se legível no zoom, a grade.
 * `areas` já vem filtrada para o contexto da seleção (a tela e o frame pai).
 */
export function alvosDasGuias(areas: readonly AreaGuias[], escala: number): { x: { v: number; rotulo: string }[]; y: { v: number; rotulo: string }[]; grades: GradeEncaixe[] } {
  const x = new Map<number, { v: number; rotulo: string }>()
  const y = new Map<number, { v: number; rotulo: string }>()
  const grades: GradeEncaixe[] = []
  for (const a of areas) {
    for (const g of a.guias) {
      if (!g.visible) continue
      if (g.type === 'grid') {
        if (gradeLegivel(g.size, escala)) grades.push({ passo: g.size, x0: a.area.x, y0: a.area.y, area: a.area })
        continue
      }
      const alvo = g.type === 'columns' ? x : y
      for (const f of faixasDaGuia(g, a.area)) {
        const [ini, fim] = g.type === 'columns' ? [f.x, f.x + f.width] : [f.y, f.y + f.height]
        for (const v of [ini, fim]) { const k = Math.round(v * 100) / 100; if (!alvo.has(k)) alvo.set(k, { v: k, rotulo: '' }) }
      }
    }
  }
  return { x: [...x.values()], y: [...y.values()], grades }
}

/** Lista vazia vira ausente (o documento não guarda `guias: []`). */
export const guiasOuNada = (lista: readonly GuiaLayout[]): GuiaLayout[] | undefined => (lista.length ? [...lista] : undefined)
