import { Suspense } from 'react'
import { FormAuth, LayoutAuth } from '@/components/app/FormAuth'

export const metadata = { title: 'Criar conta' }

export default function Signup() {
  return (
    <LayoutAuth>
      <Suspense fallback={<div className="min-h-[520px]" />}>
        <FormAuth modo="signup" />
      </Suspense>
    </LayoutAuth>
  )
}
