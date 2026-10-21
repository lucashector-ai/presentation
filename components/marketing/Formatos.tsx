'use client'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { FORMATOS, type IdFormato } from './dados'
import { CONTEUDO, Rotulo, TRIANGULO, TituloSecao } from './ui'

export function Formatos() {
  const [ativo, setAtivo] = useState(0)
  const base = useId()
  const abas = useRef<Array<HTMLButtonElement | null>>([])
  const f = FORMATOS[ativo] ?? FORMATOS[0]

  const teclado = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = FORMATOS.length
    const destino = e.key === 'ArrowRight' ? (ativo + 1) % n : e.key === 'ArrowLeft' ? (ativo - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (destino < 0) return
    e.preventDefault()
    setAtivo(destino)
    abas.current[destino]?.focus()
  }

  return (
    <section id="formatos" className="relative scroll-mt-20 overflow-hidden border-y-2 border-grafite bg-ipe">
      <div aria-hidden className="absolute -bottom-[60px] -left-[60px] hidden h-[260px] w-[260px] rounded-full border-2 border-grafite bg-coral md:block" />
      <div aria-hidden className="absolute right-[6%] top-[60px] hidden h-[90px] w-[90px] -rotate-[14deg] border-2 border-grafite bg-violeta sm:block" />
      <div className={`${CONTEUDO} py-24 sm:py-[120px]`}>
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Rotulo className="text-[#2A2118]">Formatos</Rotulo>
            <TituloSecao className="mt-4 text-[#2A2118]">Três formas de contar.</TituloSecao>
          </div>
          <div role="tablist" aria-label="Formatos" className="relative flex gap-1.5 rounded-full border-2 border-grafite bg-white p-[5px] text-[15px]">
            {FORMATOS.map((fmt, i) => (
              <button
                key={fmt.id}
                ref={(el) => { abas.current[i] = el }}
                type="button"
                role="tab"
                id={`${base}-aba-${fmt.id}`}
                aria-selected={ativo === i}
                aria-controls={`${base}-painel`}
                tabIndex={ativo === i ? 0 : -1}
                onClick={() => setAtivo(i)}
                onKeyDown={teclado}
                className={`rounded-full px-5 py-2.5 font-semibold transition-colors ${ativo === i ? 'bg-grafite text-[#FAFAF9]' : 'bg-transparent text-grafite hover:bg-[#F3F2F0]'}`}
              >
                {fmt.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${base}-painel`}
          aria-labelledby={`${base}-aba-${f.id}`}
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-stretch gap-8"
        >
          <div
            aria-hidden
            className="relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-grafite shadow-[6px_6px_0_#171717] transition-colors duration-300 motion-reduce:transition-none sm:shadow-[10px_10px_0_#171717]"
            style={{ background: f.cor }}
          >
            <Ilustracao id={f.id} />
          </div>
          <div className="flex flex-col justify-center gap-6 text-[#2A2118]">
            <h3 className="m-0 text-[clamp(36px,4vw,60px)] font-semibold leading-none tracking-[-0.05em]">{f.rotulo}</h3>
            <p className="m-0 max-w-[480px] text-[17px] leading-[1.55] sm:text-[19px]">{f.descricao}</p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {f.pontos.map((pt) => (
                <li key={pt} className="flex items-center gap-3.5 text-[16px] font-medium">
                  <span aria-hidden className="h-3.5 w-3.5 shrink-0 rotate-45 bg-grafite" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Ilustracao({ id }: { id: IdFormato }) {
  if (id === 'slides') {
    return (
      <div className="absolute inset-0 [container-type:inline-size]">
        <div className="absolute left-[10%] top-[18%] z-[2] aspect-[16/10] w-[58%] overflow-hidden border-2 border-grafite bg-[#FFF4EC]">
          <span className="absolute right-[10%] top-[14%] aspect-square w-[28%] rounded-full bg-coral" />
          <span className="absolute bottom-[10%] left-[8%] font-bold tracking-[-0.05em] text-grafite" style={{ fontSize: 'clamp(18px, 5.4cqw, 34px)' }}>Slide 01</span>
        </div>
        <div className="absolute left-[34%] top-[30%] aspect-[16/10] w-[58%] border-2 border-grafite bg-lima" />
        <div className="absolute bottom-[10%] left-[10%] flex gap-1.5">
          <span className="h-1.5 w-8 rounded-[3px] bg-grafite" />
          <span className="h-1.5 w-2.5 rounded-[3px] bg-grafite/30" />
          <span className="h-1.5 w-2.5 rounded-[3px] bg-grafite/30" />
        </div>
      </div>
    )
  }
  if (id === 'story') {
    return (
      <>
        <div className="absolute left-[30%] top-[8%] flex h-[130%] w-[40%] flex-col gap-3 border-2 border-grafite bg-[#FFF4EC] p-4">
          <span className="relative h-[28%] shrink-0 overflow-hidden bg-mare">
            <span className="absolute right-[10%] top-[15%] aspect-square w-[30%] rounded-full bg-coral" />
          </span>
          <span className="h-2.5 w-[80%] shrink-0 bg-grafite" />
          <span className="h-1.5 w-[60%] shrink-0 bg-[#A3A3A3]" />
          <span className="h-[24%] shrink-0 bg-ipe [clip-path:polygon(0_0,100%_30%,100%_100%,0_100%)]" />
        </div>
        <div className="absolute right-[20%] top-[20%] h-1/2 w-1.5 rounded-[3px] bg-grafite/20">
          <div className="h-[35%] rounded-[3px] bg-grafite" />
        </div>
      </>
    )
  }
  return (
    <>
      <div className="absolute left-[10%] top-[14%] aspect-[4/3] w-[34%] border-2 border-grafite bg-[#FFF4EC]" />
      <div className="absolute right-[10%] top-[10%] aspect-square w-[28%] rounded-full border-2 border-grafite bg-coral" />
      <div className="absolute bottom-[12%] left-[38%] aspect-[16/10] w-[36%] border-2 border-grafite bg-lima" />
      <div className={`absolute bottom-[18%] left-[14%] aspect-square w-[18%] bg-ipe ${TRIANGULO}`} />
      <div className="absolute left-[40%] top-[44%] h-7 w-7 rounded-full border-[3px] border-grafite bg-[#FFF4EC]" />
      <div className="absolute right-[28%] top-[48%] h-7 w-7 rounded-full border-[3px] border-grafite bg-[#FFF4EC]" />
    </>
  )
}
