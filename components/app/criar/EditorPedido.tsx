'use client'
/**
 * Editor do pedido no "Criar com IA": campo grande que cresce com o texto (até ~60% da tela) e rola depois disso,
 * com contador de caracteres. O pedido inteiro vai para a IA; o que passar do limite (colado de uma vez) não é
 * cortado: vai para o material, com aviso.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/components/ui'
import { MAX_PROMPT } from '@/lib/ia/pedido'

/** Divide um texto longo no limite, de preferência numa quebra de parágrafo (o resto vai inteiro para o material). */
export function dividirNoLimite(texto: string, limite = MAX_PROMPT): [string, string] {
  if (texto.length <= limite) return [texto, '']
  const corte = Math.max(texto.lastIndexOf('\n\n', limite), texto.lastIndexOf('\n', limite))
  const k = corte > limite * 0.6 ? corte : limite
  return [texto.slice(0, k).trimEnd(), texto.slice(k).trim()]
}

export function EditorPedido({ valor, aoMudar, aoExcedente, aoEnviar, rodape, placeholder }: {
  valor: string
  aoMudar: (v: string) => void
  /** Texto que passou do limite (vai para o material). */
  aoExcedente: (resto: string) => void
  /** Ctrl/⌘ + Enter. */
  aoEnviar?: () => void
  rodape?: ReactNode
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // cresce com o conteúdo até o teto (max-height no CSS); depois disso, rola
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [valor])
  const n = valor.length
  const perto = n > MAX_PROMPT * 0.9
  return (
    <div className="flex flex-col">
      <label htmlFor="criar-prompt" className="sr-only">Descreva a apresentação</label>
      <textarea
        id="criar-prompt"
        ref={ref}
        value={valor}
        onChange={(e) => {
          const [cabe, resto] = dividirNoLimite(e.target.value)
          aoMudar(cabe)
          if (resto) aoExcedente(resto)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) aoEnviar?.() }}
        rows={5}
        spellCheck
        placeholder={placeholder}
        className="block max-h-[min(60vh,640px)] min-h-[148px] w-full resize-y overflow-y-auto bg-transparent px-5 pb-3 pt-5 text-[17px] leading-relaxed outline-none placeholder:text-[#A3A3A3] sm:px-6 sm:pt-6 sm:text-[18px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[#F0EFED] px-5 py-2 text-[12px] text-texto3">
        <span className="min-w-0">{n > 1500 ? 'O pedido inteiro vai para a IA: estrutura, dados e regras.' : 'Cole o briefing inteiro: estrutura de telas, dados, cores e regras.'}</span>
        <span className={cx('mono shrink-0', perto && 'text-perigo')} aria-live="polite">{n.toLocaleString('pt-BR')} / {MAX_PROMPT.toLocaleString('pt-BR')} caracteres</span>
      </div>
      {rodape}
    </div>
  )
}
