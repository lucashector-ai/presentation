import Link from 'next/link'
import { ArrowRight, Layers, Lock, MousePointerClick, Upload } from 'lucide-react'
import { PLANOS, formatarBytes } from '@/lib/planos'

export const metadata = { robots: { index: true, follow: true } }

export default function Marketing() {
  return (
    <main className="min-h-dvh bg-fundo text-texto">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="inline-flex items-center gap-2 font-semibold tracking-tight"><span className="h-5 w-5 rounded-md bg-acao" />Apresentações</span>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-xl px-3 py-2 hover:bg-superficie2">Entrar</Link>
          <Link href="/signup" className="rounded-xl bg-acao px-4 py-2 font-medium text-acaoTexto">Criar conta</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:pt-20">
        <span className="inline-block rounded-full bg-destaque px-3 py-1 text-xs font-semibold text-[#101820]">Privado por padrão</span>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">Transforme projetos criativos em apresentações digitais que impressionam.</h1>
        <p className="mt-5 max-w-xl text-lg text-texto2">Sem programação, sem distrações e com controle de compartilhamento. Importe suas artes, adicione interações e envie um link privado para o cliente.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-acao px-5 py-3 font-medium text-acaoTexto">Começar grátis <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/p/demo_cafe_aurora_proposta_01_token_fixo_xx" className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 font-medium hover:bg-superficie2">Ver uma apresentação de exemplo</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { i: Upload, t: 'Importe antes de editar', d: 'PNG, JPG, WebP e vídeo. Cada arte vira uma cena em segundos.' },
          { i: MousePointerClick, t: 'Interações sem código', d: 'Um evento, uma ação: clique no hotspot e vá para a cena 05.' },
          { i: Layers, t: 'Slides ou Story', d: 'Cena por cena para apresentar, ou fluxo vertical para contar.' },
          { i: Lock, t: 'Link privado e revogável', d: 'Senha opcional, prazo de validade e revogação imediata.' },
        ].map(({ i: I, t, d }) => (
          <div key={t} className="rounded-2xl border bg-superficie p-5">
            <I className="mb-3 h-5 w-5" />
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-texto2">{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-2xl font-bold tracking-tight">Como funciona</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {['Crie um projeto e arraste suas artes.', 'Monte as cenas, adicione textos e hotspots, pré-visualize.', 'Publique e envie um link privado. Revogue quando quiser.'].map((p, n) => (
            <li key={p} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-superficie2 text-sm font-semibold">{n + 1}</span><p className="pt-1 text-texto2">{p}</p></li>
          ))}
        </ol>
      </section>

      <section id="planos" className="mx-auto max-w-6xl px-5 pb-24">
        <h2 className="text-2xl font-bold tracking-tight">Planos</h2>
        <p className="mt-1 text-sm text-texto2">Convidados sempre visualizam de graça. Preços indicativos durante o beta.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Object.values(PLANOS).map((p) => (
            <div key={p.id} className={`rounded-2xl border p-6 ${p.id === 'creator' ? 'border-texto bg-superficie' : 'bg-superficie'}`}>
              <h3 className="font-semibold">{p.nome}</h3>
              <p className="mt-2 text-3xl font-bold">R$ {p.precoMensalBRL}<span className="text-sm font-normal text-texto2">/mês</span></p>
              <ul className="mt-4 space-y-1.5 text-sm text-texto2">
                <li>Até {p.limites.projetos} projetos ativos</li>
                <li>{formatarBytes(p.limites.armazenamentoBytes)} de armazenamento</li>
                <li>Arquivos até {formatarBytes(p.limites.tamanhoArquivoBytes)}</li>
                <li>{p.capacidades.senhaNoLink ? 'Links com senha e validade' : 'Links privados'}</li>
                <li>{p.capacidades.marcaDaPlataforma ? 'Marca da plataforma no viewer' : 'Sem marca da plataforma'}</li>
                {p.capacidades.equipe && <li>Equipe, marca própria e aprovação (Fase 2)</li>}
              </ul>
              <Link href="/signup" className="mt-6 inline-block w-full rounded-xl border py-2 text-center text-sm font-medium hover:bg-superficie2">Começar</Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-texto2">Apresentações Criativas · MVP em construção · Produto privado por padrão</footer>
    </main>
  )
}
