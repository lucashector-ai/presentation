import { A_CONFIRMAR, COMPARATIVO, CONCORRENTES } from './dados'
import { CONTEUDO, Rotulo, TituloSecao } from './ui'

/**
 * Mostra × Gamma × Pitch × Canva: tabela factual (dados em dados.ts). Em telas estreitas a tabela rola na
 * horizontal dentro do cartão, com a primeira coluna fixa, em vez de espremer cinco colunas.
 */
export function Concorrentes({ id = 'comparativo', titulo = 'E comparado com Gamma, Pitch e Canva?' }: { id?: string; titulo?: string }) {
  const celula = 'px-3 py-3 sm:px-5 sm:py-4'
  const marca = (v: string) => (v === A_CONFIRMAR ? <span className="opacity-60">a confirmar<sup aria-hidden>*</sup></span> : v)
  return (
    <section id={id} aria-labelledby={`titulo-${id}`} className={`${CONTEUDO} scroll-mt-20 py-24 sm:py-[120px]`}>
      <div aria-hidden className="absolute right-6 top-16 hidden h-[90px] w-[90px] rotate-12 border-2 border-grafite bg-lima sm:block" />
      <Rotulo>Comparativo</Rotulo>
      <div id={`titulo-${id}`}>
        <TituloSecao className="mb-6 mt-4 max-w-[900px]">{titulo}</TituloSecao>
      </div>
      <p className="m-0 mb-10 max-w-[720px] text-[17px] leading-[1.55] text-[#3F3F3F] sm:mb-12 sm:text-[18px]">
        Os três fazem apresentações com IA e são boas ferramentas. O Mostra foi feito para quem apresenta em português, paga em reais e precisa de um editor de verdade: canvas livre, cola do Figma, três formatos e link privado.
      </p>
      <p className="m-0 mb-3 font-mono text-[12px] uppercase tracking-[0.06em] text-[#737373] md:hidden" aria-hidden>Deslize para ver Gamma, Pitch e Canva →</p>
      <div className="overflow-x-auto rounded-2xl border-2 border-grafite bg-white [scrollbar-width:thin]">
        <table className="w-full min-w-[820px] border-collapse text-left text-[14px] sm:text-[16px]">
          <caption className="sr-only">Comparação entre Mostra, Gamma, Pitch e Canva</caption>
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[19%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead>
            <tr>
              <td className={`${celula} sticky left-0 border-b-2 border-grafite bg-white`} />
              {CONCORRENTES.map((c, i) => (
                <th key={c} scope="col" className={`${celula} border-b-2 border-l-2 border-grafite font-semibold ${i === 0 ? 'bg-grafite text-[#FAFAF9]' : ''}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARATIVO.map((linha) => (
              <tr key={linha.rotulo} className="border-b border-[#E7E5E4] last:border-b-0">
                <th scope="row" className={`${celula} sticky left-0 bg-white font-medium leading-[1.4] shadow-[2px_0_0_#E7E5E4]`}>{linha.rotulo}</th>
                {linha.valores.map((v, i) => (
                  <td key={i} className={`${celula} border-l-2 border-grafite leading-[1.4] ${i === 0 ? 'bg-[#F0F1FE] font-semibold' : 'text-[#3F3F3F]'}`}>{marca(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 mt-4 max-w-[820px] text-[13px] leading-[1.5] text-[#737373]">
        Sobre os outros produtos, só o que está público nos sites oficiais em outubro de 2026 (sujeito a mudança); <sup aria-hidden>*</sup>“a confirmar” marca o que não conseguimos afirmar com certeza. Gamma, Pitch e Canva são marcas dos respectivos donos.
      </p>
    </section>
  )
}
