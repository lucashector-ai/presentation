import { Suspense } from 'react'
import { FormAuth, LayoutAuth } from '@/components/app/FormAuth'

export const metadata = { title: 'Entrar' }

export default function Login() {
  return (
    <LayoutAuth>
      <Suspense fallback={<div className="min-h-[520px]" />}>
        <FormAuth modo="login" />
      </Suspense>
    </LayoutAuth>
  )
}
