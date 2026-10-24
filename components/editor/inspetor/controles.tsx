'use client'
/**
 * Controles compactos do inspetor, no modelo do painel Design do Figma com a identidade Mostra:
 * campos cinza (superficie2) de 32 px, rótulo-prefixo arrastável, números tabulares, seções com título
 * e ações à direita; seções recolhíveis com resumo e memória; seções vazias só com o título e um "+";
 * menu suspenso para predefinições e ações raras.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, Minus, Plus } from 'lucide-react'
import { cx } from '@/components/ui'
import { MenuSuspenso } from '@/components/ui/MenuSuspenso'
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
          // sem fundo no hover: a linha tem botões próprios à direita, e duas superfícies juntas confundem
          <button type="button" onClick={alternar} aria-expanded={abrir} className="group -ml-1 flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[5px] px-1 text-left text-[12px] font-medium text-texto">
            <ChevronRight className={cx('h-3 w-3 shrink-0 text-texto3 transition-transform group-hover:text-texto', abrir && 'rotate-90')} aria-hidden />
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
 * Menu de ações do inspetor (predefinições, "Mais"): o mesmo `MenuSuspenso` do resto do app, no modo `acoes`.
 * O gatilho é um botão de ícone (24 px) ou um campo com seta.
 */
export function Menu({ rotulo, itens, children, variante = 'icone', ativo, className, titulo }: { rotulo: string; itens: ItemMenu[]; children: ReactNode; variante?: 'icone' | 'campo'; ativo?: boolean; className?: string; titulo?: string }) {
  return (
    <MenuSuspenso
      modo="acoes"
      aparencia={variante}
      rotulo={rotulo}
      ativo={ativo}
      title={titulo}
      className={className}
      opcoes={itens.map((it) => ({ id: it.id, rotulo: it.rotulo, descricao: it.descricao, marcada: it.ativo, desativada: it.desativado, separador: it.separador, perigo: it.perigo, aoClicar: it.aoClicar }))}
    >
      {children}
    </MenuSuspenso>
  )
}

/** Rótulo pequeno acima de um campo ("Opacidade", "Raio"). */
export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="mb-1 block truncate text-[12px] text-texto2">{children}</span>
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

/** Lista de opções do inspetor (menu suspenso do Mostra, no lugar do <select>): campo de 28 px com prefixo opcional. */
export function SeletorLista({ valor, aoMudar, opcoes, rotulo, prefixo }: { valor: string; aoMudar: (v: string) => void; opcoes: { id: string; rotulo: string; grupo?: string; desativada?: boolean }[]; rotulo: string; prefixo?: ReactNode }) {
  return <MenuSuspenso aparencia="campo" rotulo={rotulo} valor={valor} aoMudar={aoMudar} opcoes={opcoes} prefixo={prefixo} />
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
