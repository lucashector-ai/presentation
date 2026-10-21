import { Suspense } from 'react'
import { FormAuth } from '@/components/app/FormAuth'

export const metadata = { title: 'Criar conta' }

export default function Signup() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-2xl border bg-superficie p-6 sm:p-8">
        <Suspense><FormAuth modo="signup" /></Suspense>
      </div>
    </main>
  )
}
