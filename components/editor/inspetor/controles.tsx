'use client'
/**
 * Controles compactos do inspetor, no modelo do painel Design do Figma com a identidade Mostra:
 * campos cinza (superficie2) de 32 px, rótulo-prefixo arrastável, números tabulares, seções com título
 * e ações à direita; seções recolhíveis com resumo e memória; seções vazias só com o título e um "+";
 * menu suspenso para predefinições e ações raras.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import { cx } from '@/components/ui'
import { useInspetor } from './contexto'

export { CampoCor } from './CampoCor'
export { BotaoCampo, BotaoMini, CampoNum, MISTO, type Misto } from './campos'
import { BotaoMini, MISTO, type Misto } from './campos'


/**
 * Seções abertas/fechadas pela pessoa, lembradas entre seleções e sessões (chave = título ou `chave`).
 * Só o que ela mexeu entra aqui: o padrão de cada seção (`aberta`) continua valendo para o resto.
 */
const CHAVE_SECOES = 'mostra.inspetor.secoes'
const lembradas = new Map<string, boolean>()
try {
  if (typeof localStorage !== 'undefined') for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(CHAVE_SECOES) ?? '{}') as Record<string, boolean>)) lembradas.set(k, !!v)
} catch { /* sem armazenamento */ }
function lembrar(chave: string, aberta: boolean) {
  lembradas.set(chave, aberta)
  try { localStorage.setItem(CHAVE_SECOES, JSON.stringify(Object.fromEntries(lembradas))) } catch { /* sem armazenamento */ }
}

/**
 * Seção do inspetor (modelo do painel Design do Figma): cabeçalho de 32 px com título, resumo e ações à direita;
 * clicar no título recolhe/expande (lembrado por `chave`/título); recolhida mostra `resumo` numa linha;
 * vazia mostra só o título e o "+".
 */
export function Secao({ titulo, children, acao, aberta = true, vazia, aoAdicionar, rotuloAdicionar, aoRemover, rotuloRemover, recolhivel = true, resumo, chave }: {
  titulo: string
  children?: ReactNode
  /** Ícones/ações à direita do título. */
  acao?: ReactNode
  /** Estado inicial (se a pessoa nunca recolheu/abriu esta seção). */
  aberta?: boolean
  /** Sem conteúdo: mostra só o título e o "+". */
  vazia?: boolean
  aoAdicionar?: () => void
  rotuloAdicionar?: string
  /** "−" no título (remove a seção inteira, ex.: Exportar). */
  aoRemover?: () => void
  rotuloRemover?: string
  /** `false` = sempre aberta (sem seta). */
  recolhivel?: boolean
  /** Uma linha ao lado do título quando recolhida ("Subir · 800 ms"). */
  resumo?: string
  /** Chave da memória (padrão: o título). */
  chave?: string
}) {
  const id = chave ?? titulo
  const [abrir, setAbrir] = useState(() => lembradas.get(id) ?? aberta)
  const alternar = () => setAbrir((v) => { lembrar(id, !v); return !v })
  const mostrar = !vazia && (!recolhivel || abrir)
  const recolhida = !vazia && recolhivel && !abrir
  return (
    <section aria-label={titulo} className={cx('border-b border-borda px-3', mostrar && children !== undefined && 'pb-2')}>
      <div className="flex h-8 items-center gap-1">
        {vazia ? (
          aoAdicionar ? (
            <button type="button" onClick={aoAdicionar} className="-ml-1 flex h-7 min-w-0 flex-1 items-center rounded-[5px] px-1 text-left text-[12px] font-medium text-texto2 hover:text-texto">
              <span className="truncate">{titulo}</span>
            </button>
          ) : (
            <h3 className="min-w-0 flex-1 truncate text-[12px] font-medium text-texto2">{titulo}</h3>
          )
        ) : recolhivel ? (
          <button type="button" onClick={alternar} aria-expanded={abrir} className="-ml-1 flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[5px] px-1 text-left text-[12px] font-medium text-texto hover:bg-hover/60">
            <ChevronRight className={cx('h-3 w-3 shrink-0 text-texto3 transition-transform', abrir && 'rotate-90')} aria-hidden />
            <span className="truncate">{titulo}</span>
            {recolhida && resumo && <span className="ml-auto min-w-0 truncate pl-2 font-normal text-texto3">{resumo}</span>}
          </button>
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-[12px] font-medium text-texto">{titulo}</h3>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {!recolhida && acao}
          {aoAdicionar && <BotaoMini rotulo={rotuloAdicionar ?? `Adicionar ${titulo.toLowerCase()}`} onClick={aoAdicionar}><Plus className="h-3.5 w-3.5" /></BotaoMini>}
          {aoRemover && !vazia && !recolhida && <BotaoMini rotulo={rotuloRemover ?? `Remover ${titulo.toLowerCase()}`} onClick={aoRemover}><Minus className="h-3.5 w-3.5" /></BotaoMini>}
        </div>
      </div>
      {mostrar && children !== undefined && <div className="space-y-2">{children}</div>}
    </section>
  )
}

export interface ItemMenu {
  id: string
  rotulo: string
  /** Linha menor embaixo do rótulo. */
  descricao?: string
  /** Marcado (menu de opções): vira `menuitemcheckbox`. */
  ativo?: boolean
  desativado?: boolean
  /** Linha divisória acima deste item. */
  separador?: boolean
  perigo?: boolean
  aoClicar: () => void
}

/**
 * Menu suspenso leve (predefinições, "Mais"): o gatilho é um botão de ícone (24 px) ou um campo com seta;
 * a lista abre num portal, alinhada à direita do gatilho, com setas/Home/End/Esc no teclado e fecha ao clicar fora,
 * rolar ou escolher.
 */
export function Menu({ rotulo, itens, children, variante = 'icone', ativo, className, titulo }: { rotulo: string; itens: ItemMenu[]; children: ReactNode; variante?: 'icone' | 'campo'; ativo?: boolean; className?: string; titulo?: string }) {
  const gatilho = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    if (!aberto) return
    const posicionar = () => {
      const r = gatilho.current?.getBoundingClientRect()
      const el = lista.current
      if (!r || !el) return
      const w = el.offsetWidth, h = el.offsetHeight
      const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
      const top = r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - 4 - h) : r.bottom + 4
      setPos({ left, top })
    }
    posicionar()
    const fora = (e: PointerEvent) => { const a = e.target as Node; if (!lista.current?.contains(a) && !gatilho.current?.contains(a)) setAberto(false) }
    // rolar o painel (inclusive o rolar-até-o-gatilho que precede um clique) só reposiciona; clicar fora fecha
    window.addEventListener('pointerdown', fora, true)
    window.addEventListener('scroll', posicionar, true)
    window.addEventListener('resize', posicionar)
    // foco no item marcado (ou no primeiro)
    const alvo = lista.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? lista.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')
    alvo?.focus({ preventScroll: true })
    return () => { window.removeEventListener('pointerdown', fora, true); window.removeEventListener('scroll', posicionar, true); window.removeEventListener('resize', posicionar) }
  }, [aberto])
  const fechar = (focar = true) => { setAberto(false); if (focar) gatilho.current?.focus({ preventScroll: true }) }
  const teclas = (e: React.KeyboardEvent) => {
    // nada daqui chega aos atalhos do editor (setas moveriam a camada, Enter abriria a edição do texto…)
    e.stopPropagation()
    const botoes = [...(lista.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])]
    const i = botoes.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); fechar() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); botoes[(i + 1) % botoes.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); botoes[(i - 1 + botoes.length) % botoes.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); botoes[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); botoes[botoes.length - 1]?.focus() }
    else if (e.key === 'Tab') fechar(false)
  }
  const comMarcacao = itens.some((i) => i.ativo !== undefined)
  return (
    <>
      <button
        ref={gatilho}
        type="button"
        aria-label={variante === 'icone' ? rotulo : undefined}
        title={titulo ?? (variante === 'icone' ? rotulo : undefined)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !aberto) { e.preventDefault(); e.stopPropagation(); setAberto(true) } }}
        className={cx(
          variante === 'icone'
            ? cx('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] transition-colors', ativo || aberto ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover hover:text-texto')
            : cx('flex h-7 w-full min-w-0 items-center gap-1 rounded-md bg-superficie2 px-2 text-left text-[12px] text-texto ring-inset hover:ring-1 hover:ring-bordaForte', aberto && 'ring-1 ring-acento'),
          className
        )}
      >
        {variante === 'campo' ? <><span className="min-w-0 flex-1 truncate">{children}</span><ChevronDown className="h-3 w-3 shrink-0 text-texto3" aria-hidden /></> : children}
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <div ref={lista} role="menu" aria-label={rotulo} onKeyDown={teclas} className="fixed z-50 min-w-[180px] max-w-[260px] rounded-lg border border-borda bg-superficie p-1 text-[12px] shadow-painel" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
          {itens.map((it) => (
            <div key={it.id} className={cx(it.separador && 'mt-1 border-t border-borda pt-1')}>
              <button
                type="button"
                role={it.ativo === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={it.ativo === undefined ? undefined : it.ativo}
                disabled={it.desativado}
                onClick={() => { fechar(); it.aoClicar() }}
                className={cx('flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-hover focus-visible:bg-hover disabled:cursor-not-allowed disabled:opacity-40', it.perigo ? 'text-perigo' : 'text-texto')}
              >
                {comMarcacao && <span className="flex h-4 w-3 shrink-0 items-center justify-center" aria-hidden>{it.ativo && <Check className="h-3 w-3 text-acento" />}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{it.rotulo}</span>
                  {it.descricao && <span className="block text-[11px] leading-snug text-texto3">{it.descricao}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
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
    <label className="flex min-h-[28px] items-center justify-between gap-2">
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
    <div className={cx('flex h-7 min-w-0 flex-1 items-center rounded-md bg-superficie2 ring-inset hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento', !prefixo && 'pl-2')}>
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
    <span className="flex h-7 w-full items-center gap-3">
      <input type="range" aria-label={rotulo} min={min} max={max} step={passo} value={valor} onPointerDown={iniciar} onChange={(e) => aoMudar(Number(e.target.value))} className="deslizante h-1 min-w-0 flex-1" />
      <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-texto">{formatar ? formatar(valor) : valor}</span>
    </span>
  )
}

export function Segmentado<T extends string>({ valor, opcoes, aoMudar, rotulo, icones }: { valor: T | Misto; opcoes: { id: T; rotulo: string; icone?: ReactNode }[]; aoMudar: (v: T) => void; rotulo: string; icones?: boolean }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex h-7 w-full min-w-0 rounded-md bg-superficie2 p-[2px]">
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} title={o.rotulo} aria-label={icones ? o.rotulo : undefined} onClick={() => aoMudar(o.id)} className={cx('flex h-6 min-w-0 flex-1 items-center justify-center rounded-[5px] text-[12px] transition-colors', valor === o.id ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_.5px_rgba(0,0,0,.06)]' : 'text-texto2 hover:text-texto')}>
          {icones ? o.icone : o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function SeletorLista({ valor, aoMudar, opcoes, rotulo, prefixo }: { valor: string; aoMudar: (v: string) => void; opcoes: { id: string; rotulo: string }[]; rotulo: string; prefixo?: ReactNode }) {
  return (
    <span className="relative flex h-7 w-full min-w-0 items-center rounded-md bg-superficie2 ring-inset hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento">
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
      <span className={cx('absolute left-0 top-[2px] h-[14px] w-[14px] rounded-full bg-superficie shadow transition-transform', ativo ? 'translate-x-[14px]' : 'translate-x-[2px]')} />
    </button>
  )
}

/** Grade de cartões com ícone (efeitos de entrada, gatilhos, transições). */
export function GradeCartoes<T extends string>({ valor, opcoes, aoMudar, rotulo, colunas = 3 }: { valor: T; opcoes: { id: T; rotulo: string; icone: ReactNode }[]; aoMudar: (v: T) => void; rotulo: string; colunas?: number }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0,1fr))` }}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} onClick={() => aoMudar(o.id)} className={cx('flex flex-col items-center justify-center gap-2 rounded-lg border py-3 text-[12px] transition-colors', valor === o.id ? 'border-acento bg-acentoSuave text-acento' : 'border-borda bg-superficie text-texto2 hover:border-bordaHover hover:text-texto')}>
          <span className="flex h-5 items-center justify-center">{o.icone}</span>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
