'use client'
/**
 * Sincronização entre a janela do apresentador e a do público (mesmo navegador) via BroadcastChannel.
 * Mensagens pequenas e sem dados sensíveis: só índice de tela e comandos de navegação.
 */
import { useEffect, useRef } from 'react'

export type MensagemCanal = { tipo: 'estado'; indice: number; total: number } | { tipo: 'ir'; indice: number } | { tipo: 'pedirEstado' } | { tipo: 'encerrar' }

export function nomeCanal(projetoId: string) {
  return `mostra-apresentacao-${projetoId}`
}

export function useCanal(nome: string | undefined, aoReceber: (m: MensagemCanal) => void) {
  const ref = useRef<BroadcastChannel | null>(null)
  const cb = useRef(aoReceber)
  cb.current = aoReceber
  useEffect(() => {
    if (!nome || typeof BroadcastChannel === 'undefined') return
    const c = new BroadcastChannel(nome)
    c.onmessage = (e) => cb.current(e.data as MensagemCanal)
    ref.current = c
    return () => {
      c.close()
      ref.current = null
    }
  }, [nome])
  return (m: MensagemCanal) => ref.current?.postMessage(m)
}
