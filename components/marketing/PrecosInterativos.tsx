'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CUSTO_APRESENTACAO, DESCONTO_ANUAL, PACOTES_CREDITOS, PLANOS_MARKETING, ROTAS, TELAS_EXEMPLO, formatarNumero, formatarReais } from './dados'
import { TituloSecao } from './ui'

/** Título + alternador Anual/Mensal + os quatro planos. */
export function PlanosPrecos() {
  const [anual, setAnual] = useState(true)
  const opcoes = [
    { anual: true, rotulo: `Anual · -${Math.round(DESCONTO_ANUAL * 100)}%` },
    { anual: false, rotulo: 'Mensal' },
  ]

  return (
    <>
      <div className="mb-12 mt-4 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
        <TituloSecao className="relative">Comece grátis. Cresça com créditos.</TituloSecao>
        <div role="group" aria-label="Cobrança" className="relative flex gap-1 rounded-full border-2 border-grafite bg-white p-1 text-[14px]">
          {opcoes.map((o) => (
            <button
              key={o.rotulo}
              type="button"
              aria-pressed={anual === o.anual}
              onClick={() => setAnual(o.anual)}
              className={`rounded-full px-4 py-[9px] font-semibold transition-colors ${anual === o.anual ? 'bg-grafite text-[#FAFAF9]' : 'bg-transparent text-grafite hover:bg-[#F3F2F0]'}`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      </div>

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-stretch gap-5 p-0">
        {PLANOS_MARKETING.map((p) => {
          const preco = anual ? p.precoAnual : p.precoMensal
          return (
            <li
              key={p.id}
              className={`relative flex flex-col gap-5 rounded-2xl border-2 border-grafite p-7 sm:p-8 ${p.destaque ? 'shadow-[10px_10px_0_#5965F2]' : ''}`}
              style={{ background: p.cores.fundo, color: p.cores.tinta }}
            >
              <div className="flex min-h-[26px] items-center justify-between gap-2">
                <h3 className="m-0 text-[22px] font-semibold tracking-[-0.03em]">{p.nome}</h3>
                {p.destaque && <span className="rounded-full border-[1.5px] border-grafite bg-lima px-2.5 py-1 font-mono text-[11px] leading-none text-grafite">MAIS ESCOLHIDO</span>}
              </div>
              <p className="m-0 flex items-baseline gap-1.5">
                <span className="shrink-0 text-[56px] font-semibold leading-none tracking-[-0.05em]">{formatarReais(preco)}</span>
                <span className="text-[15px] opacity-75">{p.periodo}</span>
                {p.precoMensal > 0 && anual && <span className="sr-only">, cobrado anualmente</span>}
              </p>
              <p className="m-0 text-[15px] leading-[1.5] opacity-85">{p.descricao}</p>
              <div className="flex items-center gap-3 rounded-xl border-2 border-current px-3.5 py-3">
                <span aria-hidden className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 border-grafite text-[13px] font-bold text-grafite" style={{ background: p.cores.moeda }}>✦</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[18px] font-semibold tracking-[-0.02em]">{formatarNumero(p.creditos)} créditos</span>
                  <span className="text-[12px] opacity-75">{p.creditosLegenda}</span>
                  <span className="text-[12px] font-semibold opacity-90">≈ {formatarNumero(p.telas)} telas com IA · {p.exemplo}</span>
                </span>
              </div>
              <p className="m-0 text-[13px] font-semibold opacity-75">{p.inclui}</p>
              <ul className="-mt-2 m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
                {p.itens.map((it) => (
                  <li key={it} className="flex items-start gap-3 leading-[1.4]">
                    <span aria-hidden className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
                    {it}
                  </li>
                ))}
              </ul>
              <Link
                href={ROTAS.cadastro}
                className="mt-auto rounded-full border-2 border-grafite p-[15px] text-center font-semibold transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
                style={{ background: p.cores.ctaFundo, color: p.cores.ctaTinta }}
              >
                {p.cta}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Cartão violeta dos pacotes avulsos: escolher um pacote atualiza o botão de compra. */
export function CreditosAvulsos() {
  const [sel, setSel] = useState(1)
  const pacote = PACOTES_CREDITOS[sel] ?? PACOTES_CREDITOS[1]!
  return (
    <div className="relative flex flex-col gap-[18px] overflow-hidden rounded-2xl border-2 border-grafite bg-violeta p-6 text-white sm:p-7">
      <div aria-hidden className="absolute -right-[34px] -top-[34px] h-[84px] w-[84px] rounded-full border-2 border-grafite bg-lima sm:-right-[30px] sm:-top-[30px] sm:h-[120px] sm:w-[120px]" />
      <h3 className="relative m-0 text-[22px] font-semibold tracking-[-0.03em]">Créditos avulsos</h3>
      <p className="relative m-0 max-w-[360px] text-[15px] leading-[1.55] text-[#E6E8FD]">
        Acabou antes do fim do mês? Compre um pacote extra, em qualquer plano. Créditos avulsos não expiram e cada apresentação pode ter de 6 a 30 telas.
      </p>
      <div role="group" aria-label="Pacotes de créditos" className="relative grid grid-cols-3 gap-2.5">
        {PACOTES_CREDITOS.map((k, i) => (
          <button
            key={k.creditos}
            type="button"
            aria-pressed={sel === i}
            onClick={() => setSel(i)}
            className={`flex flex-col gap-1 rounded-xl border-2 border-grafite p-3 text-left text-grafite transition-[background-color,box-shadow] sm:p-3.5 ${sel === i ? 'bg-lima shadow-[4px_4px_0_#171717]' : 'bg-white hover:bg-[#F3F2F0]'}`}
          >
            <span className="text-[18px] font-semibold tracking-[-0.03em] sm:text-[20px]">{formatarNumero(k.creditos)}</span>
            <span className="text-[12px] text-[#525252]">créditos</span>
            <span className="text-[12px] leading-tight text-[#525252]">≈ {formatarNumero(k.telas)} telas com IA</span>
            <span className="mt-1.5 text-[15px] font-semibold">{formatarReais(k.preco)}</span>
          </button>
        ))}
      </div>
      <p className="relative m-0 rounded-xl border-2 border-grafite bg-white px-4 py-3 text-[14px] leading-[1.5] text-grafite">
        O pacote de {formatarNumero(pacote.creditos)} créditos rende <strong className="font-semibold">≈ {formatarNumero(pacote.telas)} telas com IA</strong> ({pacote.exemplo}), somadas ao saldo do seu plano.
      </p>
      <Link
        href={ROTAS.cadastro}
        className="relative mt-auto self-start rounded-full border-2 border-grafite bg-grafite px-[22px] py-3.5 text-[15px] font-semibold text-[#FAFAF9] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-[#FAFAF9] motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
      >
        Comprar {formatarNumero(pacote.creditos)} créditos · {formatarReais(pacote.preco)}
      </Link>
    </div>
  )
}

const OPCOES_TELAS = [6, 10, 15, 20, 30] as const

/** "Gerar uma apresentação": escolha o número de telas e veja quanto custa (roteiro + telas). */
export function CalculadoraApresentacao() {
  const [telas, setTelas] = useState<number>(TELAS_EXEMPLO)
  const total = CUSTO_APRESENTACAO.calcular(telas)
  return (
    <div className="rounded-xl border-2 border-grafite bg-[#F4F5FE] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-violeta" />Gerar uma apresentação</p>
          <p className="m-0 mt-1 text-[13px] text-[#525252]">roteiro + telas desenhadas, prontas para editar</p>
        </div>
        <p className="m-0 text-right" aria-live="polite">
          <span className="block text-[34px] font-semibold leading-none tracking-[-0.04em]">{total}</span>
          <span className="font-mono text-[12px] text-[#525252]">créditos</span>
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Telas da apresentação" className="flex gap-1 rounded-full border-[1.5px] border-grafite bg-white p-[3px] text-[13px]">
          {OPCOES_TELAS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={telas === n} onClick={() => setTelas(n)} className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${telas === n ? 'bg-grafite text-[#FAFAF9]' : 'text-grafite hover:bg-[#F3F2F0]'}`}>{n} telas</button>
          ))}
        </div>
        <span className="font-mono text-[12px] text-[#525252]">{CUSTO_APRESENTACAO.roteiro} pelo roteiro + {telas} × {CUSTO_APRESENTACAO.porTela} por tela</span>
      </div>
    </div>
  )
}
