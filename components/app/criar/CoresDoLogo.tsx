'use client'
/**
 * Cores do logo SVG (passo da marca): automático, original, nas cores da identidade, uma cor só ou cor a cor, com
 * a prévia nos fundos claro e escuro do estilo e na cor principal da marca. A troca é feita na montagem, por fundo
 * (lib/marca/logo.ts) — o logo nunca some — e continua editável em "Cores do vetor" no editor.
 */
import { useEffect, useMemo, useState } from 'react'
import { cx } from '@/components/ui'
import { RE_HEX } from '@/lib/ia/designSystem'
import { recolorirSvg, svgParaDataUrl } from '@/lib/importar/svg'
import { sanitizarSvgNavegador } from '@/lib/editor/importar'
import { DICAS_MODO_LOGO, MODOS_LOGO, NOMES_MODO_LOGO, recolorDoLogo, type RegraLogo } from '@/lib/marca/logo'
import type { MarcaEscolhida } from './estado'

const FUNDOS_PADRAO = { claro: '#F6F5F2', escuro: '#111418' }

export function CoresDoLogo({ marca, aoMudar, fundos = FUNDOS_PADRAO }: { marca: MarcaEscolhida; aoMudar: (f: (m: MarcaEscolhida) => MarcaEscolhida) => void; fundos?: { claro: string; escuro: string } }) {
  const logo = marca.logo!
  const cores = logo.svg?.cores ?? []
  const [markup, setMarkup] = useState(logo.svg?.markup ?? '')
  // logo de um kit: o markup vem do arquivo (só para as prévias)
  useEffect(() => {
    if (logo.svg?.markup) { setMarkup(logo.svg.markup); return }
    let vivo = true
    fetch(logo.url).then((r) => (r.ok ? r.text() : '')).then((t) => { if (vivo && t) setMarkup(sanitizarSvgNavegador(t)) }).catch(() => {})
    return () => { vivo = false }
  }, [logo.url, logo.svg?.markup])
  const regra: RegraLogo = marca.logoCores ?? { modo: 'auto' }
  const brand = marca.cores.filter((c) => RE_HEX.test(c))
  const definir = (r: RegraLogo) => aoMudar((m) => ({ ...m, logoCores: r }))
  const amostras = useMemo(() => [
    { nome: 'Fundo claro', fundo: fundos.claro },
    { nome: 'Fundo escuro', fundo: fundos.escuro },
    ...(brand[0] ? [{ nome: 'Cor principal', fundo: brand[0] }] : []),
  ], [fundos.claro, fundos.escuro, brand])
  const opcoesCor = [...new Set([...brand.map((c) => c.toUpperCase()), '#FFFFFF', '#111111'])]

  return (
    <div className="flex flex-col gap-3 rounded-[12px] bg-superficie2 p-3" aria-label="Cores do logo" role="group">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">Cores do logo <span className="font-normal text-texto3">· SVG com {cores.length} {cores.length === 1 ? 'cor' : 'cores'}</span></span>
        <span className="flex items-center gap-1">{cores.slice(0, 8).map((c) => <span key={c} title={c.toUpperCase()} className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)]" style={{ background: c }} />)}</span>
      </div>
      <div role="radiogroup" aria-label="Regra de cores do logo" className="flex flex-wrap gap-1.5">
        {MODOS_LOGO.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={regra.modo === m} title={DICAS_MODO_LOGO[m]} onClick={() => definir(m === 'mono' ? { modo: 'mono', cor: regra.cor ?? 'auto' } : m === 'personalizado' ? { modo: 'personalizado', mapa: regra.mapa ?? {} } : { modo: m })} className={cx('rounded-full border px-3 py-1 text-[12px] font-medium', regra.modo === m ? 'border-tinta bg-acao text-acaoTexto' : 'border-borda bg-superficie text-textoCorpo hover:border-bordaForte')}>
            {NOMES_MODO_LOGO[m]}
          </button>
        ))}
      </div>
      <p className="text-[12px] leading-snug text-texto3">{DICAS_MODO_LOGO[regra.modo]}</p>

      {regra.modo === 'mono' && (
        <div role="radiogroup" aria-label="Cor única do logo" className="flex flex-wrap items-center gap-1.5">
          <button type="button" role="radio" aria-checked={!regra.cor || regra.cor === 'auto'} onClick={() => definir({ modo: 'mono', cor: 'auto' })} className={cx('h-7 rounded-full border px-2.5 text-[12px]', !regra.cor || regra.cor === 'auto' ? 'border-tinta' : 'border-borda bg-superficie')}>Automática</button>
          {opcoesCor.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={regra.cor?.toUpperCase() === c} aria-label={`Logo em ${c}`} title={c} onClick={() => definir({ modo: 'mono', cor: c })} className={cx('h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)]', regra.cor?.toUpperCase() === c && 'ring-2 ring-acento ring-offset-2 ring-offset-superficie2')} style={{ background: c }} />
          ))}
          <input type="color" aria-label="Outra cor do logo" value={regra.cor && RE_HEX.test(regra.cor) ? regra.cor : '#5965F2'} onChange={(e) => definir({ modo: 'mono', cor: e.target.value.toUpperCase() })} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" />
        </div>
      )}

      {regra.modo === 'personalizado' && (
        <ul aria-label="Troca cor a cor" className="flex flex-col gap-1.5">
          {cores.slice(0, 8).map((c) => {
            const atual = regra.mapa?.[c]
            const trocar = (nova: string | null) => definir({ modo: 'personalizado', mapa: Object.fromEntries(Object.entries({ ...regra.mapa, [c]: nova ?? '' }).filter(([, v]) => !!v)) })
            return (
              <li key={c} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="mono w-[72px] uppercase text-texto3">{c}</span>
                <span className="text-texto3">→</span>
                <button type="button" aria-pressed={!atual} onClick={() => trocar(null)} className={cx('h-6 rounded-full border px-2', !atual ? 'border-tinta' : 'border-borda bg-superficie')}>original</button>
                {opcoesCor.map((o) => (
                  <button key={o} type="button" aria-pressed={atual?.toUpperCase() === o} aria-label={`${c} vira ${o}`} title={o} onClick={() => trocar(o)} className={cx('h-6 w-6 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)]', atual?.toUpperCase() === o && 'ring-2 ring-acento ring-offset-1 ring-offset-superficie2')} style={{ background: o }} />
                ))}
              </li>
            )
          })}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2" aria-label="Prévia das cores do logo">
        {amostras.map((a) => {
          const mapa = recolorDoLogo({ regra, cores, fundo: a.fundo, marca: brand })
          return (
            <figure key={a.nome} className="flex flex-col gap-1">
              <div className="flex h-16 items-center justify-center rounded-[8px] p-2.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)]" style={{ background: a.fundo }}>
                {markup ? <img src={svgParaDataUrl(recolorirSvg(markup, mapa))} alt={`Logo no ${a.nome.toLowerCase()}`} className="max-h-full max-w-full object-contain" /> : <span className="h-4 w-4 animate-spin rounded-full border-2 border-bordaForte border-t-violeta" />}
              </div>
              <figcaption className="text-center text-[11px] text-texto3">{a.nome}</figcaption>
            </figure>
          )
        })}
      </div>
      <p className="text-[11px] leading-snug text-texto3">Regra fixa: o logo nunca some. Onde a versão escolhida não teria contraste com o fundo, ela vira uma cor só; detalhes vazados continuam vazados.</p>
    </div>
  )
}
