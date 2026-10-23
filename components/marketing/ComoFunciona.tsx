import type { ReactNode } from 'react'
import { PASSOS } from './dados'
import { CONTEUDO, Rotulo, TRIANGULO, TituloSecao, pontos } from './ui'

type Estilo = { cartao: string; numero: string; texto: string }
const ESTILOS: [Estilo, Estilo, Estilo] = [
  { cartao: 'bg-argila text-grafite', numero: 'bg-grafite text-[#FAFAF9]', texto: 'text-[#3F3F3F]' },
  { cartao: 'bg-mare text-creme', numero: 'bg-creme text-mare', texto: 'text-[#C9D6DE]' },
  { cartao: 'bg-lima text-grafite', numero: 'bg-grafite text-lima', texto: 'text-[#2A2A2A]' },
]

const ILUSTRACOES: ReactNode[] = [
  <>
    <div className="absolute left-[12%] top-[18%] aspect-square w-[42%] max-w-[180px] border-2 border-grafite bg-terracota" />
    <div className="absolute left-[40%] top-[36%] aspect-square w-[30%] max-w-[125px] rounded-full border-2 border-grafite bg-ipe" />
    <div className={`absolute right-[10%] top-[14%] aspect-square w-[22%] max-w-[95px] bg-violeta ${TRIANGULO}`} />
    <div className="absolute bottom-[12%] left-[12%] rounded bg-grafite px-2 py-1 font-mono text-[11px] text-white">arraste · solte · alinhe</div>
  </>,
  <>
    <div className="absolute left-[12%] top-[20%] text-[72px] font-semibold leading-[0.9] tracking-[-0.06em]">Maré</div>
    <div className="absolute right-[10%] top-[16%] aspect-square w-[34%] max-w-[140px] rounded-full bg-coral" />
    <div className="absolute bottom-[20%] right-[34%] aspect-square w-[16%] max-w-[70px] rotate-[14deg] bg-lima" />
    <div className="absolute bottom-[12%] left-[12%] right-[12%] flex gap-[5px]">
      <span className="h-[3px] flex-1 bg-creme" />
      <span className="h-[3px] flex-1 bg-creme" />
      <span className="h-[3px] flex-1 bg-creme/30" />
      <span className="h-[3px] flex-1 bg-creme/30" />
    </div>
  </>,
  <>
    <div className={`absolute left-[8%] top-[12%] h-[70px] w-[70px] bg-grafite ${TRIANGULO}`} />
    <div className="absolute bottom-[10%] right-[8%] h-[60px] w-[60px] rounded-full bg-violeta" />
    <div className="relative flex w-[74%] flex-col gap-2.5 rounded-xl border-2 border-grafite bg-white p-3.5 text-[12px] shadow-[6px_6px_0_#171717]">
      <div className="text-[13px] font-semibold">Compartilhar</div>
      <div className="flex gap-1.5">
        <span className="flex-1 overflow-hidden whitespace-nowrap rounded-md bg-[#F5F5F4] p-2 font-mono text-[10px]">mostra.app/p/ruido-7k2</span>
        <span className="rounded-md bg-grafite px-2.5 py-2 text-white">Copiar</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Protegido por senha</span>
        <span className="relative h-4 w-7 rounded-full bg-violeta"><span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" /></span>
      </div>
    </div>
  </>,
]

export function ComoFunciona() {
  return (
    <section id="como" className={`${CONTEUDO} scroll-mt-20 pb-24 pt-24 sm:pb-[120px] sm:pt-[140px]`}>
      <div aria-hidden className="absolute right-8 top-[120px] hidden h-[120px] w-[120px] sm:block" style={pontos('#5965F2', 3, 20)} />
      <Rotulo>Como funciona</Rotulo>
      <TituloSecao className="mb-12 mt-4 max-w-[900px] sm:mb-16">Do arquivo bruto ao link enviado em três passos.</TituloSecao>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6 p-0">
        {PASSOS.map((p, i) => {
          const e = ESTILOS[i % ESTILOS.length] ?? ESTILOS[0]
          return (
          <li key={p.n} className={`overflow-hidden rounded-2xl border-2 border-tinta ${e.cartao}`}>
            <div aria-hidden className={`relative h-[240px] border-b-2 border-grafite ${i === 2 ? 'flex items-center justify-center' : ''}`}>
              {ILUSTRACOES[i]}
            </div>
            <div className="flex flex-col gap-2.5 px-6 pb-7 pt-6">
              <div className="flex items-center gap-3">
                <span aria-hidden className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${e.numero}`}>{p.n}</span>
                <h3 className="m-0 text-[28px] font-semibold tracking-[-0.04em]"><span className="sr-only">Passo {p.n}: </span>{p.titulo}</h3>
              </div>
              <p className={`m-0 text-[16px] leading-[1.55] ${e.texto}`}>{p.texto}</p>
            </div>
          </li>
          )
        })}
      </ol>
    </section>
  )
}
