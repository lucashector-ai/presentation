'use client'
/**
 * Controles compactos do inspetor, no modelo do painel Design do Figma com a identidade Mostra:
 * campos cinza (superficie2) de 32 px, rótulo-prefixo arrastável, números tabulares, seções com título
 * e ações à direita; seções vazias recolhidas só com o título e um "+".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import { cx } from '@/components/ui'
import { useInspetor } from './contexto'

export { CampoCor } from './CampoCor'
export { BotaoCampo, BotaoMini, CampoNum, MISTO, type Misto } from './campos'
import { BotaoMini, MISTO, type Misto } from './campos'


export function Secao({ titulo, children, acao, aberta = true, vazia, aoAdicionar, rotuloAdicionar, aoRemover, rotuloRemover, recolhivel }: {
  titulo: string
  children?: ReactNode
  /** Ícones/ações à direita do título. */
  acao?: ReactNode
  aberta?: boolean
  /** Sem conteúdo: mostra só o título e o "+". */
  vazia?: boolean
  aoAdicionar?: () => void
  rotuloAdicionar?: string
  /** "−" no título (remove a seção inteira, ex.: Exportar). */
  aoRemover?: () => void
  rotuloRemover?: string
  /** Título com seta para recolher/expandir (seções secundárias). */
  recolhivel?: boolean
}) {
  const [abrir, setAbrir] = useState(aberta)
  const mostrar = !vazia && (!recolhivel || abrir)
  return (
    <section aria-label={titulo} className={cx('border-b border-borda px-3', vazia || (recolhivel && !abrir) ? 'py-1' : 'pb-3 pt-1')}>
      <div className="flex h-8 items-center gap-1">
        {recolhivel ? (
          <button type="button" onClick={() => setAbrir((v) => !v)} aria-expanded={abrir} className="-ml-1 flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[5px] px-1 text-left text-[12px] font-medium text-texto hover:bg-hover/60">
            {abrir ? <ChevronDown className="h-3 w-3 shrink-0 text-texto3" /> : <ChevronRight className="h-3 w-3 shrink-0 text-texto3" />}
            <span className="truncate">{titulo}</span>
          </button>
        ) : vazia && aoAdicionar ? (
          <button type="button" onClick={aoAdicionar} className="flex h-7 min-w-0 flex-1 items-center text-left text-[12px] font-medium text-texto2 hover:text-texto">
            <span className="truncate">{titulo}</span>
          </button>
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-[12px] font-medium text-texto">{titulo}</h3>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {acao}
          {aoAdicionar && <BotaoMini rotulo={rotuloAdicionar ?? `Adicionar ${titulo.toLowerCase()}`} onClick={aoAdicionar}><Plus className="h-3.5 w-3.5" /></BotaoMini>}
          {aoRemover && !vazia && <BotaoMini rotulo={rotuloRemover ?? `Remover ${titulo.toLowerCase()}`} onClick={aoRemover}><Minus className="h-3.5 w-3.5" /></BotaoMini>}
        </div>
      </div>
      {mostrar && children !== undefined && <div className="space-y-2 pt-1">{children}</div>}
    </section>
  )
}

/** Rótulo pequeno acima de um campo ("Opacidade", "Raio"). */
export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="mb-1 block truncate text-[11px] text-texto2">{children}</span>
}

/** Linha de resumo clicável (ex.: "Animação  Escala · 800ms ›"). */
export function LinhaResumo({ titulo, valor, aoClicar, destaque }: { titulo: string; valor: string; aoClicar: () => void; destaque?: boolean }) {
  return (
    <button type="button" onClick={aoClicar} className="flex h-10 w-full items-center justify-between border-b border-borda px-3 text-left text-[12px] hover:bg-hover/50">
      <span className="font-medium">{titulo}</span>
      <span className={cx('flex items-center gap-0.5 truncate pl-3', destaque ? 'text-acento' : 'text-texto2')}>{valor}<ChevronRight className="h-3.5 w-3.5 shrink-0" /></span>
    </button>
  )
}

export function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="flex min-h-[32px] items-center justify-between gap-2">
      <span className="w-[84px] shrink-0 truncate text-[12px] text-texto2">{rotulo}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{children}</span>
    </label>
  )
}

/** Campo de texto curto no mesmo estilo dos numéricos (URL, órbita, nome do clip). */
export function CampoTexto({ valor, aoConfirmar, rotulo, placeholder, prefixo, mono }: { valor: string; aoConfirmar: (v: string) => void; rotulo: string; placeholder?: string; prefixo?: ReactNode; mono?: boolean }) {
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  return (
    <div className={cx('flex h-8 min-w-0 flex-1 items-center rounded-md bg-superficie2 ring-inset hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento', !prefixo && 'pl-2')}>
      {prefixo && <span className="flex h-full w-7 shrink-0 items-center justify-center text-texto3" aria-hidden>{prefixo}</span>}
      <input
        aria-label={rotulo}
        value={texto}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => { if (texto !== valor) aoConfirmar(texto) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { e.stopPropagation(); setTexto(valor); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()) } }}
        className={cx('h-full w-full min-w-0 bg-transparent pr-2 text-[12px] text-texto outline-none placeholder:text-texto3', mono && 'mono')}
      />
    </div>
  )
}

export function Deslizante({ valor, aoMudar, min = 0, max = 100, passo = 1, rotulo, formatar }: { valor: number; aoMudar: (v: number) => void; min?: number; max?: number; passo?: number; rotulo: string; formatar?: (v: number) => string }) {
  const { gesto } = useInspetor()
  const iniciar = () => {
    gesto?.iniciar()
    const fim = () => { window.removeEventListener('pointerup', fim); gesto?.terminar() }
    window.addEventListener('pointerup', fim)
  }
  return (
    <span className="flex h-8 w-full items-center gap-3">
      <input type="range" aria-label={rotulo} min={min} max={max} step={passo} value={valor} onPointerDown={iniciar} onChange={(e) => aoMudar(Number(e.target.value))} className="deslizante h-1 min-w-0 flex-1" />
      <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-texto">{formatar ? formatar(valor) : valor}</span>
    </span>
  )
}

export function Segmentado<T extends string>({ valor, opcoes, aoMudar, rotulo, icones }: { valor: T | Misto; opcoes: { id: T; rotulo: string; icone?: ReactNode }[]; aoMudar: (v: T) => void; rotulo: string; icones?: boolean }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex h-8 w-full min-w-0 rounded-md bg-superficie2 p-[2px]">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} title={o.rotulo} aria-label={icones ? o.rotulo : undefined} onClick={() => aoMudar(o.id)} className={cx('flex h-7 min-w-0 flex-1 items-center justify-center rounded-[5px] text-[12px] transition-colors', valor === o.id ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_.5px_rgba(0,0,0,.06)]' : 'text-texto2 hover:text-texto')}>
          {icones ? o.icone : o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function SeletorLista({ valor, aoMudar, opcoes, rotulo, prefixo }: { valor: string; aoMudar: (v: string) => void; opcoes: { id: string; rotulo: string }[]; rotulo: string; prefixo?: ReactNode }) {
  return (
    <span className="relative flex h-8 w-full min-w-0 items-center rounded-md bg-superficie2 ring-inset hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento">
      {prefixo && <span className="pointer-events-none flex h-full w-7 shrink-0 items-center justify-center text-texto3" aria-hidden>{prefixo}</span>}
      <select aria-label={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)} className={cx('h-full w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-7 text-[12px] text-texto outline-none', !prefixo && 'pl-2')}>
        {opcoes.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-texto3" aria-hidden />
    </span>
  )
}

export function Interruptor({ ativo, aoMudar, rotulo }: { ativo: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button type="button" role="switch" aria-checked={ativo} aria-label={rotulo} onClick={() => aoMudar(!ativo)} className={cx('relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors', ativo ? 'bg-acento' : 'bg-bordaForte')}>
      <span className={cx('absolute left-0 top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform', ativo ? 'translate-x-[14px]' : 'translate-x-[2px]')} />
    </button>
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
