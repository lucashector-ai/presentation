import { Suspense } from 'react'
import type { Metadata } from 'next'
import { FormAuth, LayoutAuth } from '@/components/app/FormAuth'
import { metadadosPagina } from '@/lib/seo'

/** Indexável (quem busca "mostra criar conta" chega aqui); o canônico ignora ?proximo=. */
export const metadata: Metadata = metadadosPagina('/signup')

export default function Signup() {
  return (
    <LayoutAuth>
      <Suspense fallback={<div className="min-h-[520px]" />}>
        <FormAuth modo="signup" />
      </Suspense>
    </LayoutAuth>
  )
}
