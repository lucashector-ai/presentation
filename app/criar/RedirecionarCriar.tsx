'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MODO_DEMO, sessaoAtiva, verificarSessao } from '@/lib/sessao'

/** Com sessão vai direto para /app/criar; sem sessão, para o cadastro, voltando ao fluxo com o prompt preservado. */
export function RedirecionarCriar() {
  const router = useRouter()
  const params = useSearchParams()
  useEffect(() => {
    const destino = `/app/criar${params.toString() ? `?${params.toString()}` : ''}`
    const ir = (logado: boolean) => router.replace(logado ? destino : `/signup?${new URLSearchParams({ proximo: destino })}`)
    if (MODO_DEMO) return ir(sessaoAtiva())
    let vivo = true
    verificarSessao().then((ok) => { if (vivo) ir(ok) })
    return () => { vivo = false }
  }, [router, params])
  return <div className="min-h-dvh bg-fundo" />
}
