'use client'
/**
 * Trecho selecionado dentro de um texto (ao editar com clique duplo). Fica guardado depois de sair da edição, para
 * o painel aplicar cor, peso, fonte, itálico e sublinhado só nele (como no Figma); some ao trocar de camada.
 */
import { useSyncExternalStore } from 'react'

export type SelecaoTexto = { id: string; inicio: number; fim: number } | null

let atual: SelecaoTexto = null
const ouvintes = new Set<() => void>()

export function definirSelecaoTexto(s: SelecaoTexto) {
  if (s?.id === atual?.id && s?.inicio === atual?.inicio && s?.fim === atual?.fim) return
  atual = s && s.fim > s.inicio ? s : null
  for (const f of ouvintes) f()
}
export const lerSelecaoTexto = () => atual

export function useSelecaoTexto(): SelecaoTexto {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => atual, () => null)
}
