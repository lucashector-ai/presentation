'use client'
/**
 * Barra fina no topo enquanto uma navegação interna está pendente (clique num link para outra rota). Só aparece
 * se a troca demorar mais que um instante (rede lenta): navegações rápidas não piscam nada.
 */
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const ATRASO_MS = 120
/** Se a navegação não acontecer (link interceptado), a barra some sozinha. */
const LIMITE_MS = 10_000

export function ProgressoNavegacao() {
  const caminho = usePathname()
  const [estado, setEstado] = useState<'parado' | 'pendente' | 'andando'>('parado')

  // a rota mudou: a navegação terminou
  useEffect(() => { setEstado('parado') }, [caminho])

  useEffect(() => {
    let timer: number | undefined
    let limite: number | undefined
    // captura: o Link do Next cancela o clique nativo (preventDefault) antes de um ouvinte comum ver
    const clique = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      window.clearTimeout(timer)
      window.clearTimeout(limite)
      setEstado('pendente')
      timer = window.setTimeout(() => setEstado((s) => (s === 'pendente' ? 'andando' : s)), ATRASO_MS)
      limite = window.setTimeout(() => setEstado('parado'), LIMITE_MS)
    }
    window.addEventListener('click', clique, true)
    return () => { window.removeEventListener('click', clique, true); window.clearTimeout(timer); window.clearTimeout(limite) }
  }, [])

  if (estado !== 'andando') return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      <div className="h-full w-full origin-left bg-acento" style={{ animation: 'progresso-navegacao 8s cubic-bezier(.08,.7,.2,1) forwards' }} />
      <style>{'@keyframes progresso-navegacao{from{transform:scaleX(0)}to{transform:scaleX(.92)}}'}</style>
    </div>
  )
}
