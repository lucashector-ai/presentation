/**
 * Atalhos de teclado no padrão do Figma (lógica pura, testada em atalhos.test.ts).
 * O EditorShell traduz o KeyboardEvent com `atalhoFigma` e executa a ação.
 * Usa `code` (tecla física) com Alt: no Mac, ⌥A produz "å" em `key`.
 */
import type { Alinhamento } from '@/lib/scene/transform'

/** Ferramentas do editor (V, F, R, O, L, ⇧L, P, T, S, H). */
export type Ferramenta = 'mover' | 'mao' | 'texto' | 'forma' | 'elipse' | 'linha' | 'seta' | 'poligono' | 'estrela' | 'frame' | 'hotspot' | 'caneta'

export interface TeclaPressionada {
  key: string
  code: string
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}

export type AcaoAtalho =
  | { tipo: 'alinhar'; modo: Alinhamento }
  | { tipo: 'espelhar'; eixo: 'x' | 'y' }
  | { tipo: 'ferramenta'; ferramenta: Ferramenta }
  | { tipo: 'digito'; digito: number }

/** ⌥A ⌥D ⌥W ⌥S ⌥H ⌥V (alinhar) — iguais ao Figma. */
const ALINHAR: Record<string, Alinhamento> = { KeyA: 'esquerda', KeyD: 'direita', KeyW: 'topo', KeyS: 'base', KeyH: 'centroH', KeyV: 'centroV' }

/** Teclas de ferramenta sem modificador. H = mão (como no Figma); S = hotspot (área clicável, parecida com a fatia); P = caneta. */
export const TECLAS_FERRAMENTA: Record<string, Ferramenta> = { v: 'mover', f: 'frame', r: 'forma', o: 'elipse', l: 'linha', t: 'texto', h: 'mao', s: 'hotspot', p: 'caneta' }

export function atalhoFigma(e: TeclaPressionada): AcaoAtalho | null {
  if (e.metaKey || e.ctrlKey) return null
  if (e.altKey && !e.shiftKey) {
    const modo = ALINHAR[e.code]
    return modo ? { tipo: 'alinhar', modo } : null
  }
  if (e.altKey) return null
  if (e.shiftKey) {
    if (e.code === 'KeyH') return { tipo: 'espelhar', eixo: 'x' }
    if (e.code === 'KeyV') return { tipo: 'espelhar', eixo: 'y' }
    if (e.code === 'KeyL') return { tipo: 'ferramenta', ferramenta: 'seta' }
    return null
  }
  if (/^[0-9]$/.test(e.key)) return { tipo: 'digito', digito: Number(e.key) }
  const f = TECLAS_FERRAMENTA[e.key.toLowerCase()]
  return f ? { tipo: 'ferramenta', ferramenta: f } : null
}

/** Janela para o segundo dígito ("5" "5" = 55%). */
export const JANELA_DIGITOS_MS = 600

export interface MemoriaDigito { digito: number; em: number }

/**
 * Opacidade pelas teclas numéricas, como no Figma: 1–9 = 10–90%, 0 = 100%;
 * dois dígitos rápidos formam o valor exato ("5","5" = 55%, "0","5" = 5%, "0","0" = 0%).
 * Devolve a opacidade (0–1) e a memória para a próxima tecla (null depois de um par).
 */
export function opacidadePorDigito(digito: number, agora: number, anterior: MemoriaDigito | null): { opacidade: number; memoria: MemoriaDigito | null } {
  if (anterior && agora - anterior.em <= JANELA_DIGITOS_MS) {
    return { opacidade: (anterior.digito * 10 + digito) / 100, memoria: null }
  }
  return { opacidade: digito === 0 ? 1 : digito / 10, memoria: { digito, em: agora } }
}

/** Ferramentas que desenham arrastando (ou clicando, com o tamanho padrão). */
export const FERRAMENTAS_DESENHO: readonly Ferramenta[] = ['texto', 'forma', 'elipse', 'linha', 'seta', 'poligono', 'estrela', 'frame', 'hotspot']

/** Forma do schema criada por cada ferramenta de forma. */
export const FORMA_DA_FERRAMENTA: Partial<Record<Ferramenta, 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star'>> = { forma: 'rect', elipse: 'ellipse', linha: 'line', seta: 'arrow', poligono: 'polygon', estrela: 'star' }

/**
 * Linha/seta desenhada de `a` até `b`: caixa horizontal com o comprimento do traço, girada no ângulo do arraste
 * (Shift = passos de 45°). A camada fica centrada no meio do traço.
 */
export function caixaDeLinha(a: { x: number; y: number }, b: { x: number; y: number }, espessura: number, passo45 = false) {
  let ang = Math.atan2(b.y - a.y, b.x - a.x)
  if (passo45) ang = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4)
  const comp = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
  const fim = { x: a.x + Math.cos(ang) * comp, y: a.y + Math.sin(ang) * comp }
  const cx = (a.x + fim.x) / 2
  const cy = (a.y + fim.y) / 2
  let graus = Math.round((ang * 180) / Math.PI)
  if (graus > 180) graus -= 360
  if (graus === -180) graus = 180
  return { x: Math.round(cx - comp / 2), y: Math.round(cy - espessura / 2), width: Math.round(comp), height: Math.max(1, Math.round(espessura)), rotation: graus, fim }
}
