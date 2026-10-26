/**
 * Página de texto legal (Termos de uso, Política de privacidade): cabeçalho com a data da versão, índice das
 * seções (fixo ao lado no desktop) e o texto em largura de leitura. Mesmo cabeçalho e rodapé do site.
 */
import type { ReactNode } from 'react'
import { Cabecalho } from './Cabecalho'
import { Rodape } from './Rodape'
import { CONTEUDO } from './ui'

export interface SecaoLegal { id: string; titulo: string; corpo: ReactNode }

export function PaginaLegal({ titulo, resumo, atualizacao, secoes }: { titulo: string; resumo: ReactNode; atualizacao: string; secoes: SecaoLegal[] }) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[#FAFAF9] text-grafite">
      <Cabecalho />
      <main className={`${CONTEUDO} pb-24 pt-12 sm:pt-[72px]`}>
        <nav aria-label="Você está em" className="font-mono text-[13px] uppercase tracking-[0.06em] text-[#737373]">
          <a href="/" className="hover:text-violeta">Início</a> <span aria-hidden>/</span> <span className="text-grafite">{titulo}</span>
        </nav>
        <h1 className="mt-5 text-[clamp(40px,5.5vw,80px)] font-semibold leading-[0.95] tracking-[-0.05em] [text-wrap:balance]">{titulo}</h1>
        <p className="mt-4 font-mono text-[13px] uppercase tracking-[0.06em] text-[#737373]">Última atualização: {atualizacao}</p>
        <div className="mt-8 max-w-[720px] text-[18px] leading-[1.6] text-[#3F3F3F] [text-wrap:pretty]">{resumo}</div>
        <div className="mt-14 grid gap-12 lg:grid-cols-[240px_minmax(0,720px)]">
          <nav aria-label="Seções" className="self-start lg:sticky lg:top-24">
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
              {secoes.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`} className="flex gap-2 text-[#525252] hover:text-violeta"><span className="font-mono text-[12px] text-[#A3A3A3]">{String(i + 1).padStart(2, '0')}</span>{s.titulo}</a></li>
              ))}
            </ol>
          </nav>
          <div className="flex flex-col gap-12">
            {secoes.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-24">
                <h2 id={`${s.id}-t`} className="text-[26px] font-semibold tracking-[-0.03em]"><span className="mr-3 font-mono text-[14px] font-normal text-[#A3A3A3]">{String(i + 1).padStart(2, '0')}</span>{s.titulo}</h2>
                <div className="mt-4 flex flex-col gap-4 text-[16px] leading-[1.7] text-[#3F3F3F]">{s.corpo}</div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Rodape />
    </div>
  )
}

/** Lista com marcadores no padrão dos textos legais. */
export function Lista({ itens }: { itens: ReactNode[] }) {
  return <ul className="m-0 flex list-disc flex-col gap-2 pl-5 marker:text-[#A3A3A3]">{itens.map((t, i) => <li key={i}>{t}</li>)}</ul>
}
