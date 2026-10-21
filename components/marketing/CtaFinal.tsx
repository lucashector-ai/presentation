import Link from 'next/link'
import { ROTAS } from './dados'
import { BOTAO_CLARO, BOTAO_ESCURO, TRIANGULO } from './ui'

export function CtaFinal() {
  return (
    <section aria-labelledby="titulo-cta" className="relative overflow-hidden border-t-2 border-grafite bg-violeta text-white">
      <div aria-hidden className="absolute -left-5 top-6 h-[64px] w-[64px] rounded-full border-2 border-grafite bg-lima sm:left-[6%] sm:top-[60px] sm:h-[110px] sm:w-[110px]" />
      <div aria-hidden className="absolute right-[8%] top-20 hidden h-[120px] w-[120px] rotate-[15deg] border-2 border-grafite bg-coral sm:block" />
      <div aria-hidden className={`absolute bottom-[60px] left-[18%] hidden h-[100px] w-[100px] bg-ipe sm:block ${TRIANGULO}`} />
      <div aria-hidden className="absolute bottom-[50px] right-[20%] h-[50px] w-[100px] rounded-t-full border-2 border-b-0 border-grafite bg-pessego sm:h-20 sm:w-40" />
      <div className="relative mx-auto max-w-[1000px] px-4 py-[120px] text-center sm:px-8 sm:py-[140px]">
        <h2 id="titulo-cta" className="m-0 text-[clamp(44px,6.4vw,104px)] font-semibold leading-[0.92] tracking-[-0.055em] [text-wrap:balance]">
          Seu próximo projeto merece um palco.
        </h2>
        <p className="mx-auto mt-7 max-w-[520px] text-[18px] leading-[1.5] text-[#E6E8FD] sm:text-[20px]">Três projetos grátis, para sempre. Sem cartão de crédito.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href={ROTAS.cadastro} className={`${BOTAO_ESCURO} px-7 py-[18px] text-[17px] shadow-[5px_5px_0_#D7F25C] hover:shadow-[7px_7px_0_#D7F25C]`}>
            Começar gratuitamente
          </Link>
          <Link href={ROTAS.exemplo} className={`${BOTAO_CLARO} px-7 py-[18px] text-[17px]`}>
            Ver um exemplo
          </Link>
        </div>
      </div>
    </section>
  )
}
