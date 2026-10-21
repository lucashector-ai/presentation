'use client'
import { useMemo, useSyncExternalStore } from 'react'
import { assinar, estado } from './store'
import type { EstadoDemo } from './tipos'

/** Estado completo de demonstração (referência estável entre renders enquanto nada muda). */
export function useDemoEstado(): EstadoDemo {
  return useSyncExternalStore(assinar, estado, estado)
}

/**
 * Lê uma fatia derivada do estado. O seletor pode devolver objetos novos: o resultado só é recalculado
 * quando o estado muda, então a referência fica estável e não provoca re-render em loop.
 */
export function useDemo<T>(seletor: (e: EstadoDemo) => T): T {
  const e = useDemoEstado()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => seletor(e), [e])
}
