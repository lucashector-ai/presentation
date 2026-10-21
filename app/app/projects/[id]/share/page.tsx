import Link from 'next/link'
import { Compartilhar } from '@/components/compartilhar/Compartilhar'
import { BarraPublicacao } from '@/components/app/BarraPublicacao'

export const metadata = { title: 'Compartilhar' }

export default function Pagina({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Trilha" className="mb-4 flex items-center gap-2 text-[13px] text-texto2">
        <Link href="/app" className="hover:text-texto">Início</Link><span className="text-[#D4D4D4]">/</span>
        <Link href={`/app/projects/${params.id}`} className="hover:text-texto">Projeto</Link><span className="text-[#D4D4D4]">/</span>
        <span className="text-texto">Compartilhar</span>
      </nav>
      <div className="mb-8 border-b border-borda pb-6">
        <div className="rotulo-mono">Enviar ao cliente</div>
        <h1 className="titulo-display mt-2.5 text-[32px] sm:text-[40px]">Compartilhar</h1>
        <p className="mt-3 text-[14px] text-texto2">Links privados, não listados e não indexados. Só quem tem o link acessa a revisão publicada; as visualizações aparecem em <Link href="/app/compartilhados" className="text-acento hover:underline">Enviados</Link>.</p>
      </div>
      <BarraPublicacao projetoId={params.id} className="mb-6" />
      <Compartilhar projetoId={params.id} publicarFora />
    </div>
  )
}
