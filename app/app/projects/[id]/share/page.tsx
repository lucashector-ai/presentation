import Link from 'next/link'
import { Compartilhar } from '@/components/compartilhar/Compartilhar'

export const metadata = { title: 'Compartilhar' }

export default function Pagina({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-2 text-sm text-texto2"><Link href={`/app/projects/${params.id}`} className="hover:underline">Projeto</Link><span>/</span><span className="text-texto">Compartilhar</span></div>
      <h1 className="mb-1 text-xl font-bold tracking-tight">Compartilhar</h1>
      <p className="mb-6 text-sm text-texto2">Links privados, não listados e não indexados. Só quem tem o link acessa a revisão publicada.</p>
      <Compartilhar projetoId={params.id} />
    </div>
  )
}
