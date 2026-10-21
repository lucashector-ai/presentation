import { Marca } from '@/components/ui/Logo'
import { RODAPE } from './dados'
import { Forma } from './ui'

export function Rodape() {
  return (
    <footer className="bg-grafite text-[#FAFAF9]">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-14 px-4 pb-8 pt-[72px] sm:px-8">
        <div className="grid grid-cols-2 gap-8 text-[15px] sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          {RODAPE.map((col) => (
            <nav key={col.titulo} aria-label={col.titulo} className="flex flex-col gap-3">
              <h2 className="m-0 font-mono text-[12px] font-normal uppercase text-[#A3A3A3]">{col.titulo}</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {col.links.map((l) => (
                  <li key={l.rotulo}>
                    {l.href ? <a href={l.href} className="transition-colors hover:text-violeta">{l.rotulo}</a> : <span>{l.rotulo}</span>}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div aria-hidden className="flex items-start gap-2.5 sm:justify-end">
            <Forma tipo="circulo" cor="#E4572E" className="h-7 w-7" />
            <Forma tipo="triangulo" cor="#D7F25C" className="h-7 w-7" />
            <Forma tipo="quadrado" cor="#5965F2" className="h-[26px] w-[26px]" />
            <Forma tipo="semicirculo" cor="#F2C14E" className="mt-1.5 h-4 w-8" />
          </div>
        </div>
        <div className="w-full [container-type:inline-size]">
          <Marca className="max-w-full text-[length:31.9cqw] !leading-[0.8]" />
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-[#333] pt-6 text-[13px] text-[#A3A3A3]">
          <span>© 2026 Mostra · Feito no Brasil</span>
          <span>Apresentações para quem cria.</span>
        </div>
      </div>
    </footer>
  )
}
