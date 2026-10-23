import { RECURSOS, type IconeRecurso } from './dados'
import { CONTEUDO, Rotulo, TRIANGULO, TituloSecao, pontos } from './ui'

function Icone({ tipo }: { tipo: IconeRecurso }) {
  switch (tipo) {
    case 'circulo':
      return <span className="block h-14 w-14 rounded-full border-2 border-tinta bg-coral" />
    case 'quadrado':
      return <span className="block h-14 w-14 border-2 border-tinta bg-violeta" />
    case 'triangulo':
      return <span className={`block h-14 w-[60px] bg-lima ${TRIANGULO}`} />
    case 'semicirculo':
      return <span className="block h-8 w-16 rounded-t-full border-2 border-b-0 border-tinta bg-ipe" />
    case 'pontos':
      return <span className="block h-14 w-14" style={pontos('rgb(var(--cor-tinta))', 3, 14)} />
    case 'avatares':
      return (
        <span className="flex">
          <span className="h-10 w-10 rounded-full border-2 border-tinta bg-salvia" />
          <span className="-ml-3 h-10 w-10 rounded-full border-2 border-tinta bg-pessego" />
          <span className="-ml-3 h-10 w-10 rounded-full border-2 border-tinta bg-ameixa" />
        </span>
      )
    case 'cubo':
      // cubo isométrico: topo lima, faces violeta e maré
      return (
        <svg viewBox="0 0 56 60" className="block h-[60px] w-14 text-tinta" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M28 2 L54 16 L28 30 L2 16 Z" fill="#D7F25C" />
          <path d="M2 16 L28 30 V58 L2 44 Z" fill="#5965F2" />
          <path d="M54 16 L28 30 V58 L54 44 Z" fill="#1F3B4D" />
        </svg>
      )
  }
}

export function Recursos() {
  return (
    <section id="recursos" className={`${CONTEUDO} scroll-mt-20 pb-24 pt-24 sm:pb-[120px] sm:pt-[140px]`}>
      <div aria-hidden className={`absolute left-[46%] top-[100px] hidden h-20 w-20 rotate-[18deg] bg-lima sm:block ${TRIANGULO}`} />
      <Rotulo>Recursos</Rotulo>
      <TituloSecao className="mb-12 mt-4 max-w-[820px] sm:mb-16">Tudo o que um PDF não faz.</TituloSecao>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-[2px] overflow-hidden rounded-2xl border-2 border-tinta bg-tinta p-0">
        {RECURSOS.map((r) => (
          <li key={r.titulo} className="flex min-h-[260px] flex-col gap-3.5 bg-fundo p-8">
            <span aria-hidden>
              <Icone tipo={r.icone} />
            </span>
            <h3 className="m-0 mt-auto text-[22px] font-semibold leading-[1.2] tracking-[-0.03em]">{r.titulo}</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-textoCorpo">{r.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
