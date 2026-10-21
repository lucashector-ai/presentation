import type { Metadata } from 'next'
import { PaginaPublica } from '@/components/viewer/PaginaPublica'

export const metadata: Metadata = { title: 'Apresentação', robots: { index: false, follow: false, noarchive: true, nocache: true } }

export default function Pagina({ params }: { params: { token: string } }) {
  return <PaginaPublica token={params.token} />
}
