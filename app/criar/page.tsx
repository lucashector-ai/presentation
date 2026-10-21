import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RedirecionarCriar } from './RedirecionarCriar'

export const metadata: Metadata = { title: 'Criar com IA — Mostra', robots: { index: false } }

/**
 * Endereço público do "Criar com IA" (a landing monta /criar?prompt=…&formato=…).
 * O fluxo mora dentro do app, em /app/criar; aqui só encaminhamos mantendo os parâmetros.
 */
export default function PaginaCriar() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-fundo" />}>
      <RedirecionarCriar />
    </Suspense>
  )
}
