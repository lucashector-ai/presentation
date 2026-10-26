'use client'
/**
 * Coluna da conversa do "Criar com IA": mensagens (pessoa, agente e etapas com ✓), cartões que abrem o plano ou a
 * apresentação ao lado, e o campo de envio. Texto longo colado vira um anexo (o campo fica livre para uma
 * instrução); o "+" leva ao material, ao logo e aos estilos no painel ao lado.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Check, ChevronRight, FileText, ImagePlus, Paperclip, Palette, Plus, Square, X } from 'lucide-react'
import { cx } from '@/components/ui'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import type { Cena } from '@/lib/scene/schema'
import { LIMITE_ANEXO, tamanhoTexto, type Mensagem } from './chat'
import { MiniaturaFluida } from './ui'

export interface AcaoMais { id: string; rotulo: string; icone: 'material' | 'logo' | 'estilo'; executar: () => void }

const ICONES = { material: Paperclip, logo: ImagePlus, estilo: Palette }

/** Primeira linha do texto colado, para o nome do anexo. */
export const nomeDoAnexo = (texto: string) => (texto.trim().split('\n')[0] ?? '').replace(/^#+\s*/, '').slice(0, 60) || 'Texto colado'

export function Compositor({ valor, aoMudar, colado, aoColar, aoTirarColado, aoEnviar, aoParar, ocupado, placeholder, acoes, grande, autoFoco }: {
  valor: string
  aoMudar: (v: string) => void
  colado: string | null
  aoColar: (texto: string) => void
  aoTirarColado: () => void
  aoEnviar: () => void
  aoParar?: () => void
  ocupado?: boolean
  placeholder: string
  acoes: AcaoMais[]
  grande?: boolean
  autoFoco?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [menu, setMenu] = useState(false)
  // cresce com o texto até o teto; depois rola
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, grande ? 320 : 200)}px`
  }, [valor, grande])
  useEffect(() => { if (autoFoco) ref.current?.focus({ preventScroll: true }) }, [autoFoco])
  const podeEnviar = !!(valor.trim() || colado) && !ocupado
  return (
    <div className={cx('relative rounded-[18px] border-[1.5px] border-bordaForte bg-superficie transition-colors focus-within:border-tinta', grande ? 'shadow-carimbo-sm' : '')}>
      {colado && (
        <div className="px-3 pt-3">
          <span className="inline-flex max-w-full items-center gap-2.5 rounded-[12px] border border-borda bg-superficie2 py-2 pl-2 pr-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-superficie text-texto2"><FileText className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{nomeDoAnexo(colado)}</span>
              <span className="block text-[11px] text-texto3">Texto colado · {tamanhoTexto(colado)} · {colado.length.toLocaleString('pt-BR')} caracteres</span>
            </span>
            <button type="button" aria-label="Tirar o texto colado" onClick={aoTirarColado} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-texto3 hover:bg-hover hover:text-texto"><X className="h-3.5 w-3.5" /></button>
          </span>
        </div>
      )}
      <label htmlFor="criar-prompt" className="sr-only">Pedido para a IA</label>
      <textarea
        ref={ref}
        id="criar-prompt"
        rows={grande ? 3 : 1}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData('text/plain')
          // briefing longo: vira anexo (vai inteiro para a IA), o campo fica para uma instrução curta
          if (t.length >= LIMITE_ANEXO) { e.preventDefault(); aoColar(t) }
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (podeEnviar) aoEnviar() } }}
        className={cx('block w-full resize-none bg-transparent px-4 text-texto outline-none placeholder:text-texto3', grande ? 'min-h-[88px] pt-4 text-[16px] leading-relaxed' : 'pt-3 text-[14px] leading-normal')}
      />
      <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
        <div className="relative">
          <button type="button" aria-label="Anexar e mais opções" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-full border border-borda text-texto2 hover:border-bordaForte hover:text-texto"><Plus className="h-4 w-4" /></button>
          {menu && (
            <>
              <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute bottom-10 left-0 z-50 w-[248px] rounded-[12px] border border-borda bg-superficie p-1 shadow-painel">
                {acoes.map((a) => {
                  const Icone = ICONES[a.icone]
                  return (
                    <button key={a.id} type="button" role="menuitem" onClick={() => { setMenu(false); a.executar() }} className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-hover">
                      <Icone className="h-4 w-4 text-texto3" />{a.rotulo}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <span className="flex-1" />
        {ocupado && aoParar ? (
          <button type="button" aria-label="Parar" onClick={aoParar} className="flex h-8 w-8 items-center justify-center rounded-full bg-acao text-acaoTexto"><Square className="h-3 w-3 fill-current" /></button>
        ) : (
          <button type="button" aria-label="Enviar" disabled={!podeEnviar} onClick={aoEnviar} className="flex h-8 w-8 items-center justify-center rounded-full bg-acao text-acaoTexto transition-opacity disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  )
}

export function ListaMensagens({ mensagens, titulo, capa, assets, aoAbrir, vistaAtual }: {
  mensagens: Mensagem[]
  titulo: string
  capa: Cena | null
  assets: AssetsResolvidos
  aoAbrir: (cartao: 'plano' | 'apresentacao') => void
  vistaAtual: string | null
}) {
  const fim = useRef<HTMLDivElement>(null)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [mensagens.length])
  return (
    <div role="log" aria-label="Conversa com a IA" aria-live="polite" className="flex flex-col gap-3">
      {mensagens.map((m) => {
        if (m.de === 'pessoa') {
          return (
            <div key={m.id} className="flex flex-col items-end gap-2">
              {m.anexo && (
                <span className="inline-flex max-w-[85%] items-center gap-2.5 rounded-[12px] border border-borda bg-superficie py-2 pl-2 pr-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-superficie2 text-texto2"><FileText className="h-4 w-4" /></span>
                  <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{m.anexo.nome}</span><span className="block text-[11px] text-texto3">Texto colado · {m.anexo.tamanho}</span></span>
                </span>
              )}
              {m.texto && <div className="max-w-[85%] whitespace-pre-wrap rounded-[14px] bg-acentoSuave px-3.5 py-2.5 text-[14px] leading-relaxed text-texto">{m.texto}</div>}
            </div>
          )
        }
        if (m.de === 'etapa') {
          return (
            <div key={m.id} className="flex items-center gap-2 pl-1 text-[13px]">
              {m.feito
                ? <span className="flex h-4 w-4 items-center justify-center rounded-full border border-bordaForte text-texto3"><Check className="h-2.5 w-2.5" /></span>
                : <Onda />}
              <span className={m.feito ? 'text-texto3' : 'font-medium text-acento'}>{m.texto}</span>
            </div>
          )
        }
        return (
          <div key={m.id} className="flex flex-col gap-2.5 rounded-[14px] border border-borda bg-superficie px-4 py-3.5 text-[14px] leading-relaxed text-textoCorpo">
            <p>{m.texto}</p>
            {m.cartao && (
              <button type="button" onClick={() => aoAbrir(m.cartao!)} aria-pressed={vistaAtual === m.cartao} className="group flex items-center gap-3 overflow-hidden rounded-[12px] border border-borda bg-superficie text-left hover:border-bordaForte">
                {m.cartao === 'apresentacao' && capa ? (
                  <span className="w-[112px] shrink-0 border-r border-borda"><MiniaturaFluida cena={capa} assets={assets} /></span>
                ) : (
                  <span className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-acentoSuave text-acento"><FileText className="h-4 w-4" /></span>
                )}
                <span className="min-w-0 flex-1 py-2.5">
                  <span className="block truncate text-[14px] font-medium text-texto">{titulo}</span>
                  <span className="block text-[12px] text-texto3">{m.cartao === 'plano' ? 'Plano para revisar' : 'Apresentação'}</span>
                </span>
                <ChevronRight className="mr-3 h-4 w-4 shrink-0 text-texto3 group-hover:text-texto" />
              </button>
            )}
          </div>
        )
      })}
      <div ref={fim} />
    </div>
  )
}

/** Onda animada das etapas em andamento. */
function Onda() {
  return (
    <svg aria-hidden width="22" height="12" viewBox="0 0 22 12" className="shrink-0 text-acento">
      <path d="M1 6c2-5 3-5 5 0s3 5 5 0 3-5 5 0 3 5 5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="criar-onda" />
    </svg>
  )
}

/** Tela inicial: título, o campo grande e o que vier embaixo (opções e exemplos). */
export function Inicio({ children, compositor }: { children: ReactNode; compositor: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pt-[8vh]">
      <div className="text-center">
        <h1 className="titulo-display text-balance text-[clamp(30px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.045em]">O que vamos apresentar?</h1>
        <p className="mx-auto mt-3 max-w-[520px] text-[15px] text-textoCorpo">Descreva ou cole o briefing inteiro. Eu leio, peço ao lado só as decisões que faltam (logo, identidade visual, fontes) e monto o plano antes de desenhar.</p>
      </div>
      {compositor}
      {children}
    </div>
  )
}
