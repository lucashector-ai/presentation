'use client'
/**
 * Estado das guias de layout fora do documento: a área de transferência (copiar as guias de uma tela e colar em
 * outra, ou num frame) e o "mostrar/esconder todas" com o aviso no rodapé, como no Figma (⌃⇧4).
 */
import { useSyncExternalStore } from 'react'
import type { GuiaLayout } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'

let copiadas: GuiaLayout[] | null = null
const ouvintes = new Set<() => void>()

export function copiarGuias(lista: readonly GuiaLayout[]) {
  copiadas = structuredClone([...lista])
  ouvintes.forEach((f) => f())
}

/** Guias copiadas (null = nada copiado). Cada leitor recebe a mesma lista; quem cola faz a própria cópia. */
export function useGuiasCopiadas(): GuiaLayout[] | null {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f) } },
    () => copiadas,
    () => null
  )
}

type Mostrar = (texto: string, tipo?: 'info' | 'sucesso' | 'erro', acao?: { rotulo: string; aoClicar: () => void }, chave?: string) => void

/**
 * Mostra ou esconde todas as guias de layout (preferência da sessão, não do documento) e avisa no rodapé com a
 * ação contrária: "Guias de layout visíveis · Esconder".
 */
export function alternarGuias(acoes: Editor['acoes'], atual: boolean, mostrar: Mostrar, valor = !atual) {
  acoes.ui({ guiasLayout: valor })
  mostrar(valor ? 'Guias de layout visíveis' : 'Guias de layout escondidas', 'info', { rotulo: valor ? 'Esconder' : 'Mostrar', aoClicar: () => acoes.ui({ guiasLayout: !valor }) }, 'guias-layout')
}

/** ⌃⇧4 (Ctrl+Shift+4 no Windows/Linux), como no Figma. Pela tecla física: no Mac, ⇧4 vira "$". */
export const ehAtalhoGuias = (e: { code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }) => e.code === 'Digit4' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey
