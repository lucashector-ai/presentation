import Link from 'next/link'
import { Compartilhar } from '@/components/compartilhar/Compartilhar'
import { BarraPublicacao } from '@/components/app/BarraPublicacao'
import { CabecalhoPagina, Grade, PaginaPainel, SPAN } from '@/components/app/Layout'

export const metadata = { title: 'Compartilhar' }

export default function Pagina({ params }: { params: { id: string } }) {
  return (
    // mesma largura e margens das outras telas do painel; o formulário ocupa 2/3 do grid (cheio abaixo de xl)
    <PaginaPainel>
      <Grade>
        <div className={`${SPAN.doisTercos} min-w-0`}>
          <nav aria-label="Trilha" className="mb-4 flex items-center gap-2 text-[13px] text-texto2">
            <Link href="/app" className="hover:text-texto">Início</Link><span className="text-[#D4D4D4]">/</span>
            <Link href={`/app/projects/${params.id}`} className="hover:text-texto">Projeto</Link><span className="text-[#D4D4D4]">/</span>
            <span className="text-texto">Compartilhar</span>
          </nav>
          <CabecalhoPagina
            rotulo="Enviar ao cliente"
            titulo="Compartilhar"
            descricao={<>Links privados, não listados e não indexados. Só quem tem o link acessa a revisão publicada; as visualizações aparecem em <Link href="/app/compartilhados" className="text-acento hover:underline">Enviados</Link>.</>}
          />
          <BarraPublicacao projetoId={params.id} className="mb-6" />
          <Compartilhar projetoId={params.id} publicarFora />
        </div>
      </Grade>
    </PaginaPainel>
  )
}
