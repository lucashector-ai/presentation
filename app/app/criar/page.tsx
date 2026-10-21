import { Suspense } from 'react'
import type { Metadata } from 'next'
import { CriarComIA } from '@/components/app/CriarComIA'

export const metadata: Metadata = { title: 'Criar com IA' }

export default function PaginaCriar() {
  return (
    <Suspense>
      <CriarComIA />
    </Suspense>
  )
}
