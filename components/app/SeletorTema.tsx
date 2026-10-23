'use client'
import { useCallback, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { ROTULOS_TEMA, TEMAS, assinarTema, definirTema, lerTema, type Tema } from '@/lib/tema'
import { cx } from '@/components/ui'

const ICONES: Record<Tema, typeof Sun> = { auto: Monitor, claro: Sun, escuro: Moon }

/** Preferência de tema (auto | claro | escuro) e como mudá-la; no servidor e na hidratação vale "auto". */
export function useTema() {
  const tema = useSyncExternalStore(assinarTema, lerTema, () => 'auto' as Tema)
  const mudar = useCallback((t: Tema) => definirTema(t), [])
  return { tema, mudar }
}

/**
 * Seletor Automático / Claro / Escuro. `compacto`: segmentos só com ícone (menu do usuário);
 * padrão: três fichas com descrição (Plano e conta → Preferências).
 */
export function SeletorTema({ compacto, className }: { compacto?: boolean; className?: string }) {
  const { tema, mudar } = useTema()
  return (
    <div role="radiogroup" aria-label="Tema" className={cx(compacto ? 'inline-flex rounded-controle bg-superficie2 p-1' : 'grid gap-4 sm:grid-cols-3', className)}>
      {TEMAS.map((t) => {
        const Icone = ICONES[t]
        const ativo = tema === t
        return compacto ? (
          <button key={t} type="button" role="radio" aria-checked={ativo} aria-label={ROTULOS_TEMA[t].rotulo} title={ROTULOS_TEMA[t].rotulo} onClick={() => mudar(t)} className={cx('flex h-8 w-8 items-center justify-center rounded-md transition-colors', ativo ? 'bg-superficie text-texto shadow-sm' : 'text-texto2 hover:text-texto')}>
            <Icone className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : (
          <button key={t} type="button" role="radio" aria-checked={ativo} onClick={() => mudar(t)} className={cx('flex items-center gap-4 rounded-cartao border-[1.5px] bg-superficie p-4 text-left transition-colors', ativo ? 'border-tinta' : 'border-borda hover:border-bordaHover')}>
            <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-controle', ativo ? 'bg-acao text-acaoTexto' : 'bg-superficie2 text-texto2')}><Icone className="h-4 w-4" strokeWidth={1.75} /></span>
            <span className="min-w-0"><span className="block text-[13px] font-medium">{ROTULOS_TEMA[t].rotulo}</span><span className="block text-[12px] text-texto2">{ROTULOS_TEMA[t].descricao}</span></span>
          </button>
        )
      })}
    </div>
  )
}
