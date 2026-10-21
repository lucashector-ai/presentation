import { CONTEUDO, Rotulo, TRIANGULO, TituloSecao, pontos } from './ui'
import { DemoIA } from './DemoIA'

export function CriarComIA() {
  return (
    <section id="ia" className="relative scroll-mt-20 overflow-hidden border-y-2 border-grafite bg-grafite text-[#FAFAF9]">
      <div aria-hidden className="absolute -left-[70px] top-20 h-[160px] w-[160px] rounded-full bg-violeta sm:h-[220px] sm:w-[220px]" />
      <div aria-hidden className={`absolute right-[5%] top-[70px] hidden h-[90px] w-[90px] rotate-[14deg] bg-lima sm:block ${TRIANGULO}`} />
      <div aria-hidden className="absolute -right-10 bottom-[120px] h-[160px] w-[160px] -rotate-12 bg-coral" />
      <div aria-hidden className="absolute bottom-[60px] left-[8%] hidden h-[90px] w-[140px] sm:block" style={pontos('#F2C14E', 2.5, 18)} />
      <div className={`${CONTEUDO} flex flex-col gap-12 pb-24 pt-24 sm:pb-[120px] sm:pt-[130px]`}>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="relative">
            <Rotulo className="inline-flex items-center gap-2 text-lima">
              <span aria-hidden className="h-2 w-2 rounded-full bg-lima" />
              Criar com IA
            </Rotulo>
            <TituloSecao className="mt-4 max-w-[820px]">Escreva uma frase. Receba uma apresentação.</TituloSecao>
          </div>
          <p className="relative m-0 max-w-[420px] text-[18px] leading-[1.55] text-[#C7C7C7]">
            Descreva o projeto, revise o roteiro que a IA propõe e escolha um tema. Em segundos você tem telas prontas para editar, apresentar e compartilhar.
          </p>
        </div>
        <DemoIA />
      </div>
    </section>
  )
}
