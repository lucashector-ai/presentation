import type { ReactNode } from 'react'

/**
 * Moldura do editor enquanto ele abre (rota carregando e projeto sendo lido): barra superior, painéis e canvas
 * nos mesmos tamanhos do editor, então o clique em "Abrir no editor" responde na hora e nada pula ao montar.
 */
export function EsqueletoEditor({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-fundo" aria-busy="true">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-borda bg-superficie px-3">
        <span className="h-[26px] w-[26px] rounded-md bg-hover" />
        <span className="h-4 w-40 rounded bg-hover" />
        <span className="flex-1" />
        <span className="h-8 w-28 rounded-md bg-hover" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[248px] shrink-0 border-r border-borda bg-superficie md:block" />
        <div className="flex min-w-0 flex-1 items-center justify-center bg-canvas">{children}</div>
        <div className="hidden w-[288px] shrink-0 border-l border-borda bg-superficie lg:block" />
      </div>
      <div className="hidden h-9 shrink-0 border-t border-borda bg-superficie md:block" />
    </div>
  )
}
