import { Suspense } from 'react'
import { Apresentar } from '@/components/app/Apresentar'

export const metadata = { title: 'Visão do apresentador' }

export default function Pagina({ params }: { params: { id: string } }) {
  return <Suspense fallback={<div className="h-dvh w-full bg-grafite" />}><Apresentar id={params.id} apresentador /></Suspense>
}
