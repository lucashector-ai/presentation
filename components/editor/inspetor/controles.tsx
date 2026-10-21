'use client'
/** Controles compactos do inspetor (estilo do design: campos cinza #F5F5F4, rótulo-prefixo, 28px de altura). */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { PALETA } from '@/lib/design-tokens'
import { cx } from '@/components/ui'
import { avaliar } from '@/lib/editor/expressao'

export function Secao({ titulo, children, acao, aberta = true }: { titulo: string; children: ReactNode; acao?: ReactNode; aberta?: boolean }) {
  const [abrir, setAbrir] = useState(aberta)
  return (
    <section className="border-b border-borda px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setAbrir((v) => !v)} className="flex items-center gap-1 text-[13px] font-medium text-texto" aria-expanded={abrir}>
          {titulo}
        </button>
        {acao}
      </div>
      {abrir && <div className="space-y-2">{children}</div>}
    </section>
  )
}

/** Linha de resumo clicável (ex.: "Animação  Escala · 800ms ›"). */
export function LinhaResumo({ titulo, valor, aoClicar, destaque }: { titulo: string; valor: string; aoClicar: () => void; destaque?: boolean }) {
  return (
    <button type="button" onClick={aoClicar} className="flex w-full items-center justify-between border-b border-borda px-4 py-4 text-left text-[13px] hover:bg-hover/50">
      <span className="font-medium">{titulo}</span>
      <span className={cx('flex items-center gap-0.5 truncate pl-3', destaque ? 'text-acento' : 'text-texto2')}>{valor}<ChevronRight className="h-3.5 w-3.5 shrink-0" /></span>
    </button>
  )
}

export function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="flex min-h-[28px] items-center justify-between gap-3">
      <span className="w-[74px] shrink-0 truncate text-[13px] text-texto2">{rotulo}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{children}</span>
    </label>
  )
}

/**
 * Campo numérico com prefixo. Arrastar o prefixo na horizontal muda o valor (como no Figma);
 * setas ↑/↓ somam 1 (Shift = 10). Aceita expressões simples: "100+20", "50*2".
 */
export function CampoNum({ prefixo, valor, aoMudar, min, max, passo = 1, sufixo, rotulo, casas = 0 }: { prefixo?: ReactNode; valor: number; aoMudar: (v: number) => void; min?: number; max?: number; passo?: number; sufixo?: string; rotulo: string; casas?: number }) {
  const [texto, setTexto] = useState(fmt(valor, casas))
  const focado = useRef(false)
  useEffect(() => { if (!focado.current) setTexto(fmt(valor, casas)) }, [valor, casas])
  const limitar = (v: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v))
  const confirmar = () => {
    const v = avaliar(texto)
    if (v === null) setTexto(fmt(valor, casas))
    else { aoMudar(limitar(v)); setTexto(fmt(limitar(v), casas)) }
  }
  const arrastar = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const v0 = valor
    const mover = (ev: PointerEvent) => aoMudar(limitar(Math.round((v0 + ((ev.clientX - x0) / 2) * passo) / passo) * passo))
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar) }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  return (
    <span className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-superficie2 px-2 focus-within:ring-1 focus-within:ring-acento">
      {prefixo !== undefined && <span onPointerDown={arrastar} className="cursor-ew-resize select-none text-[12px] text-texto3" aria-hidden>{prefixo}</span>}
      <input
        aria-label={rotulo}
        value={texto}
        inputMode="decimal"
        onFocus={(e) => { focado.current = true; e.currentTarget.select() }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => { focado.current = false; confirmar() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { confirmar(); (e.target as HTMLInputElement).blur() }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const d = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * passo
            const v = limitar(Math.round((valor + d) * 1000) / 1000)
            aoMudar(v)
            setTexto(fmt(v, casas))
          }
        }}
        className="h-full w-full min-w-0 bg-transparent text-[13px] tabular-nums text-texto outline-none"
      />
      {sufixo && <span className="text-[11px] text-texto3">{sufixo}</span>}
    </span>
  )
}

function fmt(v: number, casas: number) {
  return Number.isFinite(v) ? String(Math.round(v * 10 ** casas) / 10 ** casas) : '0'
}
export function Deslizante({ valor, aoMudar, min = 0, max = 100, passo = 1, rotulo, formatar }: { valor: number; aoMudar: (v: number) => void; min?: number; max?: number; passo?: number; rotulo: string; formatar?: (v: number) => string }) {
  return (
    <span className="flex w-full items-center gap-3">
      <input type="range" aria-label={rotulo} min={min} max={max} step={passo} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} className="deslizante h-1 flex-1" />
      <span className="mono w-11 text-right text-[12px] text-texto">{formatar ? formatar(valor) : valor}</span>
    </span>
  )
}

export function Segmentado<T extends string>({ valor, opcoes, aoMudar, rotulo, icones }: { valor: T; opcoes: { id: T; rotulo: string; icone?: ReactNode }[]; aoMudar: (v: T) => void; rotulo: string; icones?: boolean }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex w-full rounded-md bg-superficie2 p-[3px]">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} title={o.rotulo} aria-label={icones ? o.rotulo : undefined} onClick={() => aoMudar(o.id)} className={cx('flex h-6 flex-1 items-center justify-center rounded-[5px] text-[12px] transition-colors', valor === o.id ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-texto2 hover:text-texto')}>
          {icones ? o.icone : o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function SeletorLista({ valor, aoMudar, opcoes, rotulo }: { valor: string; aoMudar: (v: string) => void; opcoes: { id: string; rotulo: string }[]; rotulo: string }) {
  return (
    <select aria-label={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)} className="h-7 w-full min-w-0 rounded-md bg-superficie2 px-2 text-[13px] text-texto outline-none focus:ring-1 focus:ring-acento">
      {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
    </select>
  )
}

export function Interruptor({ ativo, aoMudar, rotulo }: { ativo: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ativo} aria-label={rotulo} onClick={() => aoMudar(!ativo)} className={cx('relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors', ativo ? 'bg-grafite' : 'bg-[#D4D4D4]')}>
      <span className={cx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform', ativo ? 'translate-x-[14px]' : 'translate-x-[2px]')} />
    </button>
  )
}

/** Cor: amostra + hex + popover com a paleta da marca e seletor do sistema. */
export function CampoCor({ valor, aoMudar, rotulo, permitirVazio }: { valor: string | undefined; aoMudar: (v: string | undefined) => void; rotulo: string; permitirVazio?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [hex, setHex] = useState(valor ?? '')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => setHex(valor ?? ''), [valor])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  const hex6 = valor && valor.length >= 7 ? valor.slice(0, 7) : valor && valor.length === 4 ? `#${valor[1]}${valor[1]}${valor[2]}${valor[2]}${valor[3]}${valor[3]}` : '#ffffff'
  return (
    <div ref={ref} className="relative flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md bg-superficie2 px-1.5">
      <button type="button" aria-label={`${rotulo}: escolher cor`} onClick={() => setAberto((v) => !v)} className="h-[18px] w-[18px] shrink-0 rounded-[4px] border border-black/10" style={{ background: valor ?? 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/8px 8px' }} />
      <input
        aria-label={rotulo}
        value={hex}
        placeholder={permitirVazio ? 'Nenhuma' : ''}
        onChange={(e) => setHex(e.target.value)}
        onBlur={() => { if (!hex && permitirVazio) aoMudar(undefined); else if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) aoMudar(hex.toUpperCase()); else setHex(valor ?? '') }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="mono h-full w-full min-w-0 bg-transparent text-[12px] uppercase text-texto outline-none"
      />
      {aberto && (
        <div className="absolute right-0 top-8 z-40 w-[220px] rounded-lg border border-borda bg-superficie p-3 shadow-painel">
          <div className="rotulo-mono mb-2">Paleta Mostra</div>
          <div className="grid grid-cols-8 gap-1.5">
            {[...new Set(PALETA.flatMap((p) => [p.fundo, p.tinta]))].map((c) => (
              <button key={c} type="button" title={c} aria-label={c} onClick={() => { aoMudar(c); setAberto(false) }} className={cx('h-5 w-5 rounded-[4px] border border-black/10', c.toLowerCase() === valor?.toLowerCase() && 'ring-2 ring-acento ring-offset-1')} style={{ background: c }} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="color" aria-label="Seletor de cor do sistema" value={hex6} onChange={(e) => aoMudar(e.target.value.toUpperCase())} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
            <span className="text-[12px] text-texto2">Personalizada</span>
            {permitirVazio && <button type="button" className="ml-auto text-[12px] text-texto2 underline" onClick={() => { aoMudar(undefined); setAberto(false) }}>Remover</button>}
          </div>
        </div>
      )}
    </div>
  )
}

/** Grade de cartões com ícone (efeitos de entrada, gatilhos, transições). */
export function GradeCartoes<T extends string>({ valor, opcoes, aoMudar, rotulo, colunas = 3 }: { valor: T; opcoes: { id: T; rotulo: string; icone: ReactNode }[]; aoMudar: (v: T) => void; rotulo: string; colunas?: number }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0,1fr))` }}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} onClick={() => aoMudar(o.id)} className={cx('flex flex-col items-center justify-center gap-2 rounded-lg border py-3 text-[12px] transition-colors', valor === o.id ? 'border-acento bg-acentoSuave text-acento' : 'border-borda bg-superficie text-texto2 hover:border-[#D4D4D4] hover:text-texto')}>
          <span className="flex h-5 items-center justify-center">{o.icone}</span>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
