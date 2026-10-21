import { CONTEUDO, Rotulo, TRIANGULO } from './ui'
import { FaqLista } from './FaqLista'

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t-2 border-grafite bg-salvia">
      <div className={`${CONTEUDO} grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-14 py-24 sm:py-[120px]`}>
        <div className="relative">
          <Rotulo className="text-musgo">Perguntas frequentes</Rotulo>
          <h2 className="m-0 mt-4 text-[clamp(40px,5vw,76px)] font-semibold leading-[0.95] tracking-[-0.05em] text-musgo">Ficou alguma dúvida?</h2>
          <div aria-hidden className="relative mt-12 hidden h-[200px] sm:block">
            <div className="absolute left-0 top-0 h-[140px] w-[140px] rounded-full bg-musgo" />
            <div className={`absolute left-[100px] top-[60px] h-[130px] w-[130px] bg-[#F4F1EC] ${TRIANGULO}`} />
            <div className="absolute left-[220px] top-5 h-20 w-20 border-2 border-musgo bg-coral" />
          </div>
        </div>
        <FaqLista />
      </div>
    </section>
  )
}
