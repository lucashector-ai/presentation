import { FAIXA, type TipoForma } from './dados'
import { Forma } from './ui'

const TAMANHO: Record<TipoForma, string> = {
  circulo: 'h-[18px] w-[18px]',
  triangulo: 'h-[18px] w-[18px]',
  quadrado: 'h-4 w-4',
  quadradoSuave: 'h-4 w-4',
  semicirculo: 'h-[10px] w-5',
}

/** Faixa preta com os tipos de projeto rolando infinitamente (parada com prefers-reduced-motion). */
export function Faixa() {
  return (
    <section aria-label="Feito para" className="overflow-hidden border-y-2 border-grafite bg-grafite text-[#FAFAF9]">
      <div className="marquee flex w-max">
        {[0, 1].map((copia) => (
          <ul
            key={copia}
            aria-hidden={copia === 1 || undefined}
            className="m-0 flex shrink-0 list-none items-center gap-10 whitespace-nowrap py-[18px] pl-0 pr-10 text-[22px] font-semibold tracking-[-0.03em] sm:py-[22px] sm:text-[28px]"
          >
            {FAIXA.map((item) => (
              <li key={item.rotulo} className="flex items-center gap-10">
                <span>{item.rotulo}</span>
                <Forma tipo={item.forma} cor={item.cor} className={TAMANHO[item.forma]} />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  )
}
