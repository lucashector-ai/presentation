'use client'
import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { Marca, Simbolo } from './Logo'
import { MenuSuspenso, type OpcaoMenu } from './MenuSuspenso'

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ')
}

// ---------- Botão ----------
type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'destaque' | 'acento'
type TamanhoBotao = 'sm' | 'md' | 'lg'
export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: TamanhoBotao
  carregando?: boolean
  icone?: ReactNode
}
const variantes: Record<Variante, string> = {
  primario: 'bg-acao text-acaoTexto hover:bg-acaoHover border-transparent',
  secundario: 'bg-superficie text-texto border-bordaForte hover:border-bordaHover',
  fantasma: 'bg-transparent text-texto border-transparent hover:bg-hover',
  perigo: 'bg-transparent text-perigo border-bordaForte hover:bg-perigo/10',
  destaque: 'bg-lima text-texto border-transparent hover:brightness-95',
  acento: 'bg-acento text-acentoTexto border-transparent hover:bg-acentoHover',
}
// alturas 32/40/48 (T.controle) e raio de controle 8. O sm segue com padding de 12: a barra do editor não tem folga a 1024 px
const tamanhos: Record<TamanhoBotao, string> = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-controle', md: 'h-10 px-4 text-sm gap-2 rounded-controle', lg: 'h-12 px-6 text-[15px] gap-2 rounded-controle' }

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao({ variante = 'primario', tamanho = 'md', carregando, icone, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} disabled={disabled || carregando} className={cx('inline-flex items-center justify-center whitespace-nowrap border-[1.5px] font-medium transition-colors duration-rapida disabled:cursor-not-allowed disabled:opacity-50', variantes[variante], tamanhos[tamanho], className)} {...rest}>
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      {children}
    </button>
  )
})

/**
 * Botão de ícone 32 px. `ativo` = alternador ligado (acento suave, como os do inspetor); `destaque` = ligado em cor
 * cheia (a ferramenta ativa do editor, como no Figma). Os dois seguem os tokens do tema (nada de preto/branco fixo).
 */
export function BotaoIcone({ rotulo, className, children, ativo, destaque, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean; destaque?: boolean }) {
  return (
    <button aria-label={rotulo} title={rotulo} aria-pressed={ativo} className={cx('inline-flex h-8 w-8 items-center justify-center rounded-md text-textoCorpo transition-colors hover:bg-hover hover:text-texto disabled:opacity-40', ativo && (destaque ? 'bg-acento text-acentoTexto hover:bg-acentoHover hover:text-acentoTexto' : 'bg-acentoSuave text-acento hover:bg-acentoSuave hover:text-acento'), className)} {...rest}>
      {children}
    </button>
  )
}

// ---------- Campos ----------
export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('h-10 w-full rounded-controle border border-bordaForte bg-superficie px-4 text-sm text-texto placeholder:text-texto3 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15 disabled:opacity-50', className)} {...rest} />
})

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('w-full rounded-lg border border-bordaForte bg-superficie px-3.5 py-2.5 text-sm text-texto placeholder:text-texto3 outline-none focus:border-acento focus:ring-2 focus:ring-acento/15', className)} {...rest} />
})

/** Lista de opções dos formulários (40 px, com borda): o menu suspenso do Mostra no lugar do <select>. */
export function Selecao({ rotulo, valor, opcoes, aoMudar, className }: { rotulo: string; valor: string; opcoes: OpcaoMenu[]; aoMudar: (v: string) => void; className?: string }) {
  return <MenuSuspenso aparencia="grande" rotulo={rotulo} valor={valor} opcoes={opcoes} aoMudar={aoMudar} className={className} />
}

export function Campo({ rotulo, dica, erro, children, inline }: { rotulo: string; dica?: string; erro?: string; children: ReactNode; inline?: boolean }) {
  return (
    <label className={cx('block', inline && 'flex items-center justify-between gap-3')}>
      <span className="mb-2 block text-[13px] font-medium text-texto">{rotulo}</span>
      <div className={cx(inline && 'w-40')}>{children}</div>
      {dica && !erro && <span className="mt-1 block text-xs text-texto2">{dica}</span>}
      {erro && <span className="mt-1 block text-xs text-perigo" role="alert">{erro}</span>}
    </label>
  )
}

/** Linha do inspetor: rótulo curto à esquerda, controle compacto à direita. */
export function CampoInspetor({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  // Controle único sem aria-label recebe o rótulo como nome acessível (evita o nome "Rótulo + valor" do <label> envolvente).
  const filho = isValidElement<{ 'aria-label'?: string }>(children) && !children.props['aria-label'] ? cloneElement(children, { 'aria-label': rotulo }) : children
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="w-14 shrink-0 truncate text-xs text-texto2" title={rotulo}>{rotulo}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-1">{filho}</span>
    </label>
  )
}

export function EntradaNumero({ value, onChange, min, max, step = 1, sufixo, rotulo }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; sufixo?: string; rotulo: string }) {
  return (
    <span className="relative inline-flex w-full">
      <input
        aria-label={rotulo}
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(v)
        }}
        className={cx('h-8 w-full min-w-0 rounded-lg border bg-superficie px-1.5 text-right text-xs tabular-nums focus:border-texto/40', sufixo && 'pr-5')}
      />
      {sufixo && <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[10px] text-texto2">{sufixo}</span>}
    </span>
  )
}

export function Alternador({ ativo, onChange, rotulo }: { ativo: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button role="switch" aria-checked={ativo} aria-label={rotulo} onClick={() => onChange(!ativo)} className={cx('relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors', ativo ? 'bg-acao' : 'bg-bordaHover')}>
      <span className={cx('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-superficie shadow transition-transform', ativo ? 'translate-x-[14px]' : 'translate-x-[2px]')} />
    </button>
  )
}

// ---------- Superfícies ----------
export function Cartao({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-cartao border bg-superficie', className)} {...rest}>
      {children}
    </div>
  )
}

export function Selo({ tom = 'neutro', children }: { tom?: 'neutro' | 'sucesso' | 'aviso' | 'perigo' | 'destaque'; children: ReactNode }) {
  const tons = {
    neutro: 'bg-superficie2 text-texto2',
    sucesso: 'bg-sucesso/12 text-sucesso',
    aviso: 'bg-aviso/25 text-avisoTexto',
    perigo: 'bg-perigo/12 text-perigo',
    destaque: 'bg-acentoSuave text-acento',
  }
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', tons[tom])}>{children}</span>
}

export function Abas<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: { id: T; rotulo: string }[]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="inline-flex rounded-lg bg-superficie2 p-[3px]">
      {opcoes.map((o) => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} onClick={() => onChange(o.id)} className={cx('rounded-md px-3 py-1.5 text-[13px] transition-colors', valor === o.id ? 'bg-superficie text-texto shadow-sm' : 'text-texto2 hover:text-texto')}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function EstadoVazio({ icone, titulo, descricao, acao, className }: { icone?: ReactNode; titulo: string; descricao?: string; acao?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-bloco border border-dashed px-6 py-16 text-center', className)}>
      {icone && <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-bloco bg-superficie2 text-texto2">{icone}</div>}
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descricao && <p className="mt-2 max-w-sm text-sm text-texto2">{descricao}</p>}
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ aberto, aoFechar, titulo, descricao, children, rodape, largura = 'md' }: { aberto: boolean; aoFechar: () => void; titulo: string; descricao?: string; children: ReactNode; rodape?: ReactNode; largura?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null)
  const idTitulo = useId() // único por modal: modais aninhados (ex.: confirmar dentro de Compartilhar) não podem repetir o id
  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
      if (e.key === 'Tab' && ref.current) {
        const focaveis = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        const primeiro = focaveis[0]
        const ultimo = focaveis[focaveis.length - 1]
        if (!primeiro || !ultimo) return
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
      }
    }
    document.addEventListener('keydown', tecla)
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input, button')?.focus(), 10)
    return () => { document.removeEventListener('keydown', tecla); clearTimeout(t); anterior?.focus() }
  }, [aberto, aoFechar])
  if (!aberto) return null
  const larguras = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={idTitulo} className={cx('w-full rounded-xl border bg-superficie shadow-painel', larguras[largura])}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 id={idTitulo} className="text-xl font-medium tracking-[-0.03em]">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-texto2">{descricao}</p>}
          </div>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}><X className="h-4 w-4" /></BotaoIcone>
        </div>
        <div className="px-6 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t px-6 py-4">{rodape}</div>}
      </div>
    </div>
  )
}

export function ModalConfirmar({ aberto, aoFechar, aoConfirmar, titulo, descricao, rotuloConfirmar = 'Confirmar', perigoso, carregando }: { aberto: boolean; aoFechar: () => void; aoConfirmar: () => void; titulo: string; descricao?: string; rotuloConfirmar?: string; perigoso?: boolean; carregando?: boolean }) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} descricao={descricao} largura="sm" rodape={<>
      <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
      <Botao variante={perigoso ? 'perigo' : 'primario'} onClick={aoConfirmar} carregando={carregando}>{rotuloConfirmar}</Botao>
    </>}>
      <span className="sr-only">Confirme a ação</span>
    </Modal>
  )
}

export function Logo({ compacto, className }: { compacto?: boolean; className?: string }) {
  return compacto ? <Simbolo tamanho={26} className={className} /> : <Marca className={cx('text-[20px]', className)} />
}

export { Marca, Simbolo }

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-texto2" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {texto}
    </div>
  )
}

/** Só mostra o conteúdo depois de `ms` (carregamentos rápidos não piscam um spinner na tela). */
export function Atrasado({ ms = 350, children }: { ms?: number; children: ReactNode }) {
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), ms)
    return () => clearTimeout(t)
  }, [ms])
  return visivel ? <>{children}</> : null
}

/** Bloco de carregamento de uma seção/página (mesma moldura do EstadoVazio, sem borda). */
export function CarregandoBloco({ texto = 'Carregando…', className }: { texto?: string; className?: string }) {
  return <div className={cx('flex min-h-[120px] items-center justify-center px-6 py-16', className)} aria-busy="true"><Atrasado><Carregando texto={texto} /></Atrasado></div>
}

/** Falha ao carregar: explica e oferece tentar de novo. */
export function EstadoErro({ titulo = 'Não foi possível carregar', mensagem, aoTentar, className }: { titulo?: string; mensagem?: string | null; aoTentar?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx('flex flex-col items-center justify-center rounded-bloco border border-dashed border-perigo/40 px-6 py-16 text-center', className)}>
      <h3 className="text-base font-semibold">{titulo}</h3>
      {mensagem && <p className="mt-2 max-w-sm text-sm text-texto2">{mensagem}</p>}
      {aoTentar && <div className="mt-6"><Botao variante="secundario" onClick={aoTentar}>Tentar de novo</Botao></div>}
    </div>
  )
}
