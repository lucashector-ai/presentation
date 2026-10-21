/**
 * Medição de texto no DOM (só no editor): largura automática (hug) e altura automática.
 * Usa os mesmos estilos do renderizador (components/renderer/SceneRenderer.tsx → Texto),
 * então o tamanho gravado no documento bate com o que o visualizador desenha.
 */
import type { Camada, CamadaTexto } from '@/lib/scene/schema'
import { pilhaFonte } from '@/lib/design-tokens'

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
    Object.assign(medidor.style, { position: 'absolute', left: '-100000px', top: '0', visibility: 'hidden', pointerEvents: 'none', boxSizing: 'border-box', wordBreak: 'break-word', contain: 'layout style' })
    document.body.appendChild(medidor)
  }
  const hugW = c.sizingW === 'hug'
  const s = medidor.style
  s.fontFamily = pilhaFonte(c.fontFamily)
  s.fontSize = `${c.fontSize}px`
  s.fontWeight = String(c.fontWeight)
  s.fontStyle = c.italic ? 'italic' : 'normal'
  s.letterSpacing = `${c.letterSpacing}px`
  s.lineHeight = String(c.lineHeight)
  s.textTransform = c.transform === 'none' ? 'none' : c.transform
  s.padding = `${c.padding}px`
  s.whiteSpace = hugW ? 'pre' : 'pre-wrap'
  s.width = hugW ? 'max-content' : `${c.width}px`
  // linha vazia (ou terminada em \n) ainda ocupa uma linha
  medidor.textContent = !c.text ? '​' : c.text.endsWith('\n') ? `${c.text}​` : c.text
  const r = medidor.getBoundingClientRect()
  return { width: hugW ? Math.max(1, Math.ceil(r.width)) : c.width, height: Math.max(1, Math.ceil(r.height)) }
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
  return offset
}
