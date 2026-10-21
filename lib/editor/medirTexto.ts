/**
 * Medição de texto no DOM (só no editor): largura automática (hug) e altura automática.
 * Usa os mesmos estilos do renderizador (components/renderer/SceneRenderer.tsx → Texto),
 * então o tamanho gravado no documento bate com o que o visualizador desenha.
 */
import type { Camada, CamadaTexto } from '@/lib/scene/schema'
import { aplicarEstilo, estiloCaixaTexto, montarCorpo } from '@/lib/scene/tipografia'

let medidor: HTMLDivElement | null = null

export const textoAutomatico = (c: Camada): c is CamadaTexto => c.type === 'text' && (c.sizingW === 'hug' || c.sizingH === 'hug')

/** Modo de redimensionamento do texto (como no Figma) a partir do dimensionamento por eixo. */
export type ModoTexto = 'larguraAuto' | 'alturaAuto' | 'fixo'
export function modoTexto(c: Pick<Camada, 'sizingW' | 'sizingH'>): ModoTexto {
  if (c.sizingW === 'hug') return 'larguraAuto'
  if (c.sizingH === 'hug') return 'alturaAuto'
  return 'fixo'
}
export function dimensionamentoDoModo(m: ModoTexto): Pick<Camada, 'sizingW' | 'sizingH'> {
  return m === 'larguraAuto' ? { sizingW: 'hug', sizingH: 'hug' } : m === 'alturaAuto' ? { sizingW: 'fixed', sizingH: 'hug' } : { sizingW: 'fixed', sizingH: 'fixed' }
}

export function medirTexto(c: CamadaTexto): { width: number; height: number } {
  if (typeof document === 'undefined') return { width: c.width, height: c.height }
  if (!medidor || !medidor.isConnected) {
    medidor = document.createElement('div')
    medidor.setAttribute('aria-hidden', 'true')
    document.body.appendChild(medidor)
  }
  const hugW = c.sizingW === 'hug'
  // mesma estrutura e estilos do renderizador (caixa → corpo → parágrafos): lista, espaço entre parágrafos,
  // corte vertical e truncar entram na medida
  medidor.removeAttribute('style')
  Object.assign(medidor.style, { position: 'absolute', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none', boxSizing: 'border-box', contain: 'layout style' })
  aplicarEstilo(medidor, { ...estiloCaixaTexto(c), overflow: 'visible', fontSize: c.fontSize, letterSpacing: c.letterSpacing, width: hugW ? 'max-content' : c.width, height: 'auto' })
  medidor.replaceChildren(montarCorpo(document, c))
  const r = medidor.getBoundingClientRect()
  return { width: hugW ? Math.max(1, Math.ceil(r.width)) : c.width, height: Math.max(1, Math.ceil(r.height)) }
}

/**
 * Troca o modo de redimensionamento do texto já com o tamanho medido (um único passo de desfazer: o efeito de
 * medição do canvas não precisa gravar nada depois). Largura automática cresce conforme o alinhamento.
 */
export function comDimensionamento<T extends CamadaTexto>(c: T, d: Pick<Camada, 'sizingW' | 'sizingH'>, livre = true): T {
  const n = { ...c, ...d }
  if (!textoAutomatico(n)) return n
  const m = medirTexto(n)
  const dw = m.width - c.width
  const x = livre && n.sizingW === 'hug' ? (n.align === 'center' ? Math.round(c.x - dw / 2) : n.align === 'right' ? c.x - dw : c.x) : c.x
  return { ...n, ...m, x }
}

/** Posição (índice no texto) sob o ponteiro, para colocar o cursor onde o usuário clicou duas vezes. */
export function indiceNoPonto(clientX: number, clientY: number, raiz: Element | null): number | null {
  if (!raiz) return null
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  let no: Node | null = null
  let offset = 0
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(clientX, clientY)
    if (p) { no = p.offsetNode; offset = p.offset }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(clientX, clientY)
    if (r) { no = r.startContainer; offset = r.startOffset }
  }
  if (!no || !raiz.contains(no) || no.nodeType !== Node.TEXT_NODE) return null
  // texto em parágrafos (lista, espaço entre parágrafos): soma os parágrafos anteriores e as quebras de linha
  const par = no.parentElement?.closest('[data-paragrafo]')
  if (par && raiz.contains(par)) {
    let antes = 0
    for (const p of raiz.querySelectorAll('[data-paragrafo]')) {
      if (p === par) break
      antes += (p.textContent ?? '').replace(/​/g, '').length + 1
    }
    return antes + Math.min(offset, (no.textContent ?? '').replace(/​/g, '').length)
  }
  return offset
}
