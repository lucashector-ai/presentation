import { Suspense } from 'react'
import { Dashboard } from '@/components/app/Dashboard'

export const metadata = { title: 'Projetos' }

export default function PaginaApp() {
  return <Suspense><Dashboard /></Suspense>
}
