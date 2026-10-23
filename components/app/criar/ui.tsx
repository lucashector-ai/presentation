'use client'
/** Peças de interface do Criar com IA (segmentos, selos de "grátis", miniatura fluida, seções dos passos). */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/components/ui'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import type { Cena } from '@/lib/scene/schema'

export function Segmento<T extends string>({ opcoes, valor, aoMudar, rotulo, nomes, claro, cheio }: { opcoes: readonly T[]; valor: T; aoMudar: (v: T) => void; rotulo: string; nomes: (v: T) => string; claro?: boolean; cheio?: boolean }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cx('flex gap-1 rounded-full p-[3px] text-[13px]', claro ? 'bg-hover p-1 text-[14px]' : 'bg-superficie2', cheio && 'w-full [&>button]:flex-1')}>
      {opcoes.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          onClick={() => aoMudar(o)}
          className={cx(
            'whitespace-nowrap rounded-full font-medium transition-colors',
            claro ? 'px-3 py-2 sm:px-4' : 'px-3 py-1.5',
            valor === o ? (claro ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-acao text-acaoTexto') : claro ? 'text-texto3 hover:text-texto' : 'text-textoCorpo hover:text-texto'
          )}
        >
          {nomes(o)}
        </button>
      ))}
    </div>
  )
}

/** Selo de custo: "grátis" (aplicado sem IA) ou N créditos. */
export function SeloCusto({ creditos, children }: { creditos?: number; children?: ReactNode }) {
  const gratis = !creditos
  return (
    <span className={cx('mono inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]', gratis ? 'bg-sucessoFundo text-sucessoTexto' : 'bg-acentoSuave text-acento')}>
      {children ?? (gratis ? 'grátis' : `${creditos} créditos`)}
    </span>
  )
}

/** Seção de um passo: título, dica e o selo de custo à direita. */
export function Secao({ titulo, dica, selo, children, id }: { titulo: string; dica?: ReactNode; selo?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-bordaForte bg-superficie p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">{titulo}</h3>
          {dica && <p className="mt-0.5 text-[13px] leading-snug text-texto3">{dica}</p>}
        </div>
        {selo}
      </div>
      {children}
    </section>
  )
}

/** Miniatura que ocupa a largura do contêiner (renderizada pelo próprio renderer). */
export function MiniaturaFluida({ cena, assets = {}, className }: { cena: Cena; assets?: AssetsResolvidos; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(e?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={cx('relative w-full overflow-hidden', className)} style={{ aspectRatio: `${cena.size.width} / ${cena.size.height}`, background: cena.background }}>
      {largura > 0 && <SceneRenderer cena={cena} assets={assets} escala={largura / cena.size.width} modo="miniatura" />}
    </div>
  )
}

/** Amostra de cor clicável (paletas). */
export function Amostras({ cores, tamanho = 22 }: { cores: string[]; tamanho?: number }) {
  return (
    <span className="flex">
      {cores.map((c, i) => <span key={`${c}-${i}`} className="rounded-full ring-2 ring-white" style={{ width: tamanho, height: tamanho, background: c, marginLeft: i ? -tamanho * 0.28 : 0 }} />)}
    </span>
  )
}
