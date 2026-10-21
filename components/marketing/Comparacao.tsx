import { COMPARACAO } from './dados'
import { CONTEUDO, Rotulo, TRIANGULO, TituloSecao } from './ui'

export function Comparacao() {
  const celula = 'px-3 py-3.5 sm:px-6 sm:py-4'
  return (
    <section aria-labelledby="titulo-comparacao" className="relative overflow-hidden border-y-2 border-grafite bg-ameixa text-pessego">
      <div aria-hidden className="absolute -right-20 -top-20 h-[220px] w-[220px] rounded-full bg-pessego sm:h-[320px] sm:w-[320px]" />
      <div aria-hidden className={`absolute bottom-10 right-[220px] hidden h-[120px] w-[120px] bg-coral md:block ${TRIANGULO}`} />
      <div className={`${CONTEUDO} py-24 sm:py-[120px]`}>
        <Rotulo>PDF × Mostra</Rotulo>
        <div id="titulo-comparacao">
          <TituloSecao equilibrar={false} className="mb-12 mt-4 max-w-[820px] sm:mb-14">A diferença aparece na reunião.</TituloSecao>
        </div>
        <div className="relative max-w-[960px] overflow-hidden rounded-2xl border-2 border-pessego">
          <table className="w-full table-fixed border-collapse text-left text-[14px] sm:text-[17px]">
            <caption className="sr-only">Comparação entre enviar um PDF e enviar um link da Mostra</caption>
            <colgroup>
              <col className="w-[41%]" />
              <col className="w-[29.5%]" />
              <col className="w-[29.5%]" />
            </colgroup>
            <thead>
              <tr>
                <td className={`${celula} border-b-2 border-pessego`} />
                <th scope="col" className={`${celula} border-b-2 border-l-2 border-pessego font-semibold`}>PDF</th>
                <th scope="col" className={`${celula} border-b-2 border-l-2 border-pessego bg-pessego font-semibold text-ameixa`}>Mostra</th>
              </tr>
            </thead>
            <tbody>
              {COMPARACAO.map((c) => (
                <tr key={c.rotulo} className="border-b border-pessego/30 last:border-b-0">
                  <th scope="row" className={`${celula} font-normal`}>{c.rotulo}</th>
                  <td className={`${celula} border-l-2 border-pessego opacity-70`}>{c.pdf}</td>
                  <td className={`${celula} border-l-2 border-pessego font-semibold`}>{c.mostra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
