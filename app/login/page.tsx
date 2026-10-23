import { Suspense } from 'react'
import type { Metadata } from 'next'
import { FormAuth, LayoutAuth } from '@/components/app/FormAuth'
import { absoluta } from '@/lib/seo'

/** Fora do índice (herda o noindex da raiz), mas com canônico e descrição para quem chega por link. */
export const metadata: Metadata = { title: 'Entrar', description: 'Entre na sua conta do Mostra para criar, editar e enviar apresentações.', alternates: { canonical: absoluta('/login') } }

export default function Login() {
  return (
    <LayoutAuth>
      <Suspense fallback={<div className="min-h-[520px]" />}>
        <FormAuth modo="login" />
      </Suspense>
    </LayoutAuth>
  )
}
