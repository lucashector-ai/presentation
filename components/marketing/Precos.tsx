import { CUSTOS_CREDITOS, formatarNumero } from './dados'
import { CONTEUDO, Forma, Rotulo } from './ui'
import { CreditosAvulsos, PlanosPrecos } from './PrecosInterativos'

export function Precos() {
  return (
    <section id="precos" className={`${CONTEUDO} scroll-mt-20 pb-24 pt-24 sm:pb-[120px] sm:pt-[140px]`}>
      <div aria-hidden className="absolute right-4 top-[72px] h-16 w-16 rounded-full bg-violeta sm:right-10 sm:top-[120px] sm:h-[100px] sm:w-[100px]" />
      <div aria-hidden className="absolute right-[64px] top-[116px] h-10 w-10 rotate-[20deg] border-2 border-grafite bg-ipe sm:right-[120px] sm:top-[190px] sm:h-[60px] sm:w-[60px]" />
      <Rotulo className="relative">Preços</Rotulo>
      <PlanosPrecos />

      <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5">
        <div className="flex flex-col gap-[18px] rounded-2xl border-2 border-grafite bg-white p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-2 border-grafite bg-lima font-bold">✦</span>
            <h3 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">Como funcionam os créditos</h3>
          </div>
          <p className="m-0 text-[15px] leading-[1.55] text-[#525252]">
            Créditos são usados só nos recursos de IA. Editar, apresentar e compartilhar não consomem nada. Os créditos mensais renovam todo mês.
          </p>
          <dl className="m-0 flex flex-col border-t-[1.5px] border-grafite">
            {CUSTOS_CREDITOS.map((c) => (
              <div key={c.id} className="flex justify-between gap-3 border-b border-[#E7E5E4] py-3 text-[15px]">
                <dt className="flex items-center gap-2.5">
                  <Forma tipo={c.forma} cor={c.cor} className={c.forma === 'semicirculo' ? 'h-[5px] w-2.5' : 'h-2.5 w-2.5'} />
                  {c.rotulo}
                </dt>
                <dd className="m-0 whitespace-nowrap font-mono text-[13px]">{formatarNumero(c.creditos)} créditos</dd>
              </div>
            ))}
          </dl>
        </div>
        <CreditosAvulsos />
      </div>
    </section>
  )
}
