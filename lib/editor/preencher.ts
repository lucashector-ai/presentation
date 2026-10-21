/**
 * "Preencher em grade": regiões da tela (metades, terços, quartos, células de uma grade) para encaixar a
 * seleção, alvos de encaixe nas frações da tela (1/2, 1/3, 2/3, 1/4, 3/4) e a grade de layout de 12 colunas.
 * Puro e testável (preencher.test.ts).
 */
import type { Camada } from '@/lib/scene/schema'
import type { Retangulo, Tamanho } from '@/lib/scene/transform'

/** Fração da tela usada como alvo de encaixe (com rótulo na guia). */
export interface AlvoRotulado { v: number; rotulo: string }

const FRACOES: [number, string][] = [[1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4']]

/** Grade de layout (colunas com margens e gutter), como a "Layout grid" de colunas do Figma. */
export interface GradeLayout { colunas: number; margem: number; gutter: number }

/** 12 colunas; margem ≈ 5% da largura; gutter ≈ 1,25% (96 / 24 px numa tela de 1920). */
export function gradeLayoutPadrao(cena: Tamanho): GradeLayout {
  return { colunas: 12, margem: Math.round(Math.min(cena.width, cena.height) * 0.0889), gutter: Math.round(cena.width * 0.0125) }
}

/** Colunas da grade de layout (retângulos de altura total, dentro das margens). */
export function colunasDaGrade(cena: Tamanho, g: GradeLayout): Retangulo[] {
  const util = cena.width - 2 * g.margem
  const cw = (util - (g.colunas - 1) * g.gutter) / g.colunas
  return Array.from({ length: g.colunas }, (_, i) => ({ x: g.margem + i * (cw + g.gutter), y: 0, width: cw, height: cena.height }))
}

/**
 * Alvos extras de encaixe por eixo: frações da tela (com rótulo) e, com a grade de layout ligada,
 * as bordas das colunas e as margens.
 */
export function alvosDeFracao(cena: Tamanho, opcoes: { fracoes?: boolean; grade?: GradeLayout | null } = {}): { x: AlvoRotulado[]; y: AlvoRotulado[] } {
  const x: AlvoRotulado[] = []
  const y: AlvoRotulado[] = []
  if (opcoes.fracoes !== false) {
    for (const [f, r] of FRACOES) {
      x.push({ v: cena.width * f, rotulo: r })
      y.push({ v: cena.height * f, rotulo: r })
    }
  }
  if (opcoes.grade) {
    const g = opcoes.grade
    colunasDaGrade(cena, g).forEach((c, i) => {
      x.push({ v: c.x, rotulo: i === 0 ? 'margem' : `col ${i + 1}` }, { v: c.x + c.width, rotulo: i === g.colunas - 1 ? 'margem' : '' })
    })
    y.push({ v: g.margem, rotulo: 'margem' }, { v: cena.height - g.margem, rotulo: 'margem' })
  }
  return { x, y }
}

/** Região na grade: colunas c0..c1 e linhas l0..l1 (inclusivas) de uma grade cols × lins. */
export interface Celulas { cols: number; lins: number; c0: number; c1: number; l0: number; l1: number }

/** Retângulo (px da cena) de uma região da grade; com margens, desconta margem e gutter (entre células). */
export function regiaoDaGrade(cena: Tamanho, r: Celulas, margens?: { margem: number; gutter: number } | null): Retangulo {
  const m = margens?.margem ?? 0
  const g = margens?.gutter ?? 0
  const c0 = Math.max(0, Math.min(r.c0, r.c1)), c1 = Math.min(r.cols - 1, Math.max(r.c0, r.c1))
  const l0 = Math.max(0, Math.min(r.l0, r.l1)), l1 = Math.min(r.lins - 1, Math.max(r.l0, r.l1))
  const cw = (cena.width - 2 * m - (r.cols - 1) * g) / r.cols
  const lh = (cena.height - 2 * m - (r.lins - 1) * g) / r.lins
  const x = m + c0 * (cw + g)
  const y = m + l0 * (lh + g)
  const x2 = m + c1 * (cw + g) + cw
  const y2 = m + l1 * (lh + g) + lh
  const X = Math.round(x), Y = Math.round(y)
  return { x: X, y: Y, width: Math.max(1, Math.round(x2) - X), height: Math.max(1, Math.round(y2) - Y) }
}

export interface Predefinicao { id: string; rotulo: string; grupo: 'Tela' | 'Metades' | 'Terços' | 'Quartos'; celulas: Celulas; atalho?: string }

const p = (id: string, rotulo: string, grupo: Predefinicao['grupo'], cols: number, lins: number, c0: number, c1: number, l0: number, l1: number, atalho?: string): Predefinicao => ({ id, rotulo, grupo, celulas: { cols, lins, c0, c1, l0, l1 }, atalho })

/** Atalhos no padrão do Rectangle (⌃⌥ + tecla), o organizador de janelas do macOS. */
export const PREDEFINICOES: Predefinicao[] = [
  p('tela', 'Tela inteira', 'Tela', 1, 1, 0, 0, 0, 0, '⌃⌥↵'),
  p('esquerda', 'Metade esquerda', 'Metades', 2, 1, 0, 0, 0, 0, '⌃⌥←'),
  p('direita', 'Metade direita', 'Metades', 2, 1, 1, 1, 0, 0, '⌃⌥→'),
  p('superior', 'Metade superior', 'Metades', 1, 2, 0, 0, 0, 0, '⌃⌥↑'),
  p('inferior', 'Metade inferior', 'Metades', 1, 2, 0, 0, 1, 1, '⌃⌥↓'),
  p('terco1', 'Primeiro terço', 'Terços', 3, 1, 0, 0, 0, 0, '⌃⌥D'),
  p('terco2', 'Terço central', 'Terços', 3, 1, 1, 1, 0, 0, '⌃⌥F'),
  p('terco3', 'Último terço', 'Terços', 3, 1, 2, 2, 0, 0, '⌃⌥G'),
  p('doisTercos1', 'Dois terços à esquerda', 'Terços', 3, 1, 0, 1, 0, 0, '⌃⌥E'),
  p('doisTercos2', 'Dois terços à direita', 'Terços', 3, 1, 1, 2, 0, 0, '⌃⌥T'),
  p('q1', 'Quarto superior esquerdo', 'Quartos', 2, 2, 0, 0, 0, 0, '⌃⌥U'),
  p('q2', 'Quarto superior direito', 'Quartos', 2, 2, 1, 1, 0, 0, '⌃⌥I'),
  p('q3', 'Quarto inferior esquerdo', 'Quartos', 2, 2, 0, 0, 1, 1, '⌃⌥J'),
  p('q4', 'Quarto inferior direito', 'Quartos', 2, 2, 1, 1, 1, 1, '⌃⌥K'),
]

const TECLAS: Record<string, string> = { Enter: 'tela', ArrowLeft: 'esquerda', ArrowRight: 'direita', ArrowUp: 'superior', ArrowDown: 'inferior', KeyD: 'terco1', KeyF: 'terco2', KeyG: 'terco3', KeyE: 'doisTercos1', KeyT: 'doisTercos2', KeyU: 'q1', KeyI: 'q2', KeyJ: 'q3', KeyK: 'q4' }

/** ⌃⌥ + tecla (sem ⌘) → predefinição. Usa `code` (no Mac, ⌥ muda `key`). */
export function atalhoPreencher(e: { code: string; key: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean }): Predefinicao | null {
  if (!e.ctrlKey || !e.altKey || e.metaKey || e.shiftKey) return null
  const id = TECLAS[e.code] ?? TECLAS[e.key]
  return PREDEFINICOES.find((x) => x.id === id) ?? null
}

/**
 * Aplica a região às camadas: uma camada vai exatamente para a região; várias, a caixa envolvente é escalada
 * para a região (como redimensionar a seleção). Texto mantém o tamanho da fonte (só a caixa muda, largura
 * fixa); imagens mantêm o encaixe (cover recorta). Frames levam o conteúdo junto (deslocado, sem escalar).
 * Devolve só as camadas alteradas (mapa id → nova camada).
 */
export function preencherRegiao(camadas: readonly Camada[], ids: readonly string[], regiao: Retangulo): Map<string, Camada> {
  const mapa = new Map(camadas.map((c) => [c.id, c]))
  const alvo = camadas.filter((c) => ids.includes(c.id) && !c.locked)
  const r = new Map<string, Camada>()
  if (!alvo.length) return r
  const x0 = Math.min(...alvo.map((c) => c.x)), y0 = Math.min(...alvo.map((c) => c.y))
  const x1 = Math.max(...alvo.map((c) => c.x + c.width)), y1 = Math.max(...alvo.map((c) => c.y + c.height))
  const sx = regiao.width / Math.max(1, x1 - x0)
  const sy = regiao.height / Math.max(1, y1 - y0)
  const descendentes = (id: string): Camada[] => camadas.filter((c) => { let p = c.parentId; while (p) { if (p === id) return true; p = mapa.get(p)?.parentId } return false })
  for (const c of alvo) {
    const x = Math.round(regiao.x + (c.x - x0) * sx)
    const y = Math.round(regiao.y + (c.y - y0) * sy)
    const width = Math.max(1, Math.round(regiao.x + (c.x + c.width - x0) * sx) - x)
    const height = Math.max(1, Math.round(regiao.y + (c.y + c.height - y0) * sy) - y)
    let nova = { ...c, x, y, width, height, rotation: alvo.length === 1 ? 0 : c.rotation } as Camada
    if (nova.type === 'text') nova = { ...nova, sizingW: 'fixed', sizingH: 'fixed' }
    else if (nova.type === 'frame') nova = { ...nova, sizingW: nova.sizingW === 'hug' ? 'fixed' : nova.sizingW, sizingH: nova.sizingH === 'hug' ? 'fixed' : nova.sizingH }
    r.set(c.id, nova)
    if (c.type === 'frame' && !c.layout) {
      const dx = x - c.x, dy = y - c.y
      for (const d of descendentes(c.id)) if (!ids.includes(d.id)) r.set(d.id, { ...d, x: d.x + dx, y: d.y + dy } as Camada)
    }
  }
  return r
}

/**
 * "Dividir em grade": cópias de uma camada em cols × lins células iguais, com `gap`, dentro da caixa original.
 * Devolve as caixas das células (a primeira é a da própria camada).
 */
export function dividirCaixa(caixa: Retangulo, cols: number, lins: number, gap: number): Retangulo[] {
  const cw = (caixa.width - (cols - 1) * gap) / cols
  const lh = (caixa.height - (lins - 1) * gap) / lins
  if (cw < 1 || lh < 1) return []
  const r: Retangulo[] = []
  for (let l = 0; l < lins; l++) for (let c = 0; c < cols; c++) {
    const x = Math.round(caixa.x + c * (cw + gap))
    const y = Math.round(caixa.y + l * (lh + gap))
    r.push({ x, y, width: Math.max(1, Math.round(caixa.x + c * (cw + gap) + cw) - x), height: Math.max(1, Math.round(caixa.y + l * (lh + gap) + lh) - y) })
  }
  return r
}
