'use client'
/**
 * Escala atual do canvas (zoom) fora do estado do React: o canvas grava a cada passo e só quem mostra o número
 * (o controle de zoom do rodapé e do cabeçalho) re-renderiza — o editor inteiro não acompanha o gesto de zoom.
 */
import { useSyncExternalStore } from 'react'

let escala = 1
const ouvintes = new Set<() => void>()

export function definirEscala(s: number) {
  if (s === escala || !Number.isFinite(s)) return
  escala = s
  ouvintes.forEach((f) => f())
}

export function lerEscala(): number {
  return escala
}

function assinar(f: () => void) {
  ouvintes.add(f)
  return () => { ouvintes.delete(f) }
}

export function useEscalaCanvas(): number {
  return useSyncExternalStore(assinar, lerEscala, () => 1)
}

export const ZOOM_MIN = 0.05
export const ZOOM_MAX = 8
/** Próximo zoom ao apertar + / − (×1,33: 100 → 400% em 5 passos). */
export const zoomMais = (s: number) => Math.min(ZOOM_MAX, (s * 4) / 3)
export const zoomMenos = (s: number) => Math.max(ZOOM_MIN, (s * 3) / 4)
