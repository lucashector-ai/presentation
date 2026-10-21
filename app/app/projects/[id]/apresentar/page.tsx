import { Suspense } from 'react'
import { Apresentar } from '@/components/app/Apresentar'

export const metadata = { title: 'Apresentar' }

export default function Pagina({ params }: { params: { id: string } }) {
  return <Suspense fallback={<div className="h-dvh w-full bg-[#111]" />}><Apresentar id={params.id} /></Suspense>
}
