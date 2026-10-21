'use client'
/** Gaveta lateral (celular/tablet): painel de telas/camadas à esquerda ou propriedades à direita. */
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from '@/components/ui'

export function Gaveta({ lado, aberta, aoFechar, rotulo, children }: { lado: 'esquerda' | 'direita'; aberta: boolean; aoFechar: () => void; rotulo: string; children: ReactNode }) {
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); aoFechar() } }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [aberta, aoFechar])
  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={rotulo}>
      <button type="button" aria-label="Fechar painel" className="absolute inset-0 bg-black/25" onClick={aoFechar} />
      <div className={cx('absolute bottom-0 top-0 flex w-[min(320px,88vw)] flex-col bg-superficie shadow-painel', lado === 'esquerda' ? 'left-0' : 'right-0')}>
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-borda pl-3 pr-1">
          <span className="text-[13px] font-medium">{rotulo}</span>
          <button type="button" aria-label="Fechar" onClick={aoFechar} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-texto2 hover:bg-hover hover:text-texto"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
