'use client'
import { useId, useState } from 'react'
import { FAQ } from './dados'

export type ItemFaq = { pergunta: string; resposta: string }

/**
 * Acordeão: um item aberto por vez (o primeiro começa aberto, como no design). Todas as respostas vão no HTML
 * (hidden, não desmontadas) para buscadores e IAs lerem o texto inteiro, igual ao JSON-LD FAQPage.
 */
export function FaqLista({ itens = FAQ }: { itens?: readonly ItemFaq[] }) {
  const [aberto, setAberto] = useState(0)
  const base = useId()
  return (
    <div className="flex flex-col gap-3">
      {itens.map((q, i) => {
        const estaAberto = aberto === i
        const idBotao = `${base}-q${i}`
        const idResposta = `${base}-r${i}`
        return (
          <div key={q.pergunta} className="overflow-hidden rounded-[14px] border-2 border-musgo bg-[#F4F1EC]">
            <h3 className="m-0">
              <button
                type="button"
                id={idBotao}
                aria-expanded={estaAberto}
                aria-controls={idResposta}
                onClick={() => setAberto(estaAberto ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 bg-transparent px-[22px] py-5 text-left text-[17px] font-semibold tracking-[-0.02em] text-musgo sm:text-[18px]"
              >
                {q.pergunta}
                <span
                  aria-hidden
                  className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-musgo text-[18px] font-normal text-[#F4F1EC] transition-transform duration-normal motion-reduce:transition-none ${estaAberto ? 'rotate-45' : ''}`}
                >
                  +
                </span>
              </button>
            </h3>
            <div id={idResposta} role="region" aria-labelledby={idBotao} hidden={!estaAberto}>
              <p className="m-0 px-[22px] pb-[22px] text-[16px] leading-[1.6] text-[#3F4A3D]">{q.resposta}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
