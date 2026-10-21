import { Suspense } from 'react'
import { NovoProjeto } from '@/components/app/NovoProjeto'

export const metadata = { title: 'Novo projeto' }

export default function Pagina() {
  return <Suspense><NovoProjeto /></Suspense>
}
