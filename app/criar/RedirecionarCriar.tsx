'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { sessaoAtiva } from '@/lib/sessao'

/** Com sessão vai direto para /app/criar; sem sessão, para o cadastro, voltando ao fluxo com o prompt preservado. */
export function RedirecionarCriar() {
  const router = useRouter()
  const params = useSearchParams()
  useEffect(() => {
    const destino = `/app/criar${params.toString() ? `?${params.toString()}` : ''}`
    router.replace(sessaoAtiva() ? destino : `/signup?${new URLSearchParams({ proximo: destino })}`)
  }, [router, params])
  return <div className="min-h-dvh bg-fundo" />
}
