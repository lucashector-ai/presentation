'use client'
/**
 * Ferramentas da barra superior (modelo do Figma): Mover V · Frame F · Formas (R O L ⇧L, num menu) ·
 * Caneta P · Texto T · Mídia · Hotspot S · Mão H.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Circle, Crosshair, Frame, Hand, Image as ImageIcon, MousePointer2, MoveUpRight, PenTool, Slash, Square, Type } from 'lucide-react'
import type { Ferramenta } from '@/lib/editor/atalhos'
import { BotaoIcone, cx } from '@/components/ui'

const FORMAS: { id: Ferramenta; rotulo: string; tecla: string; icone: JSX.Element }[] = [
  { id: 'forma', rotulo: 'Retângulo', tecla: 'R', icone: <Square className="h-4 w-4" /> },
  { id: 'elipse', rotulo: 'Elipse', tecla: 'O', icone: <Circle className="h-4 w-4" /> },
  { id: 'linha', rotulo: 'Linha', tecla: 'L', icone: <Slash className="h-4 w-4" /> },
  { id: 'seta', rotulo: 'Seta', tecla: 'Shift+L', icone: <MoveUpRight className="h-4 w-4" /> },
]

export function BarraFerramentas({ ferramenta, aoFerramenta, aoMidia, className, menuAcima }: { ferramenta: Ferramenta; aoFerramenta: (f: Ferramenta) => void; aoMidia: () => void; className?: string; menuAcima?: boolean }) {
  const [menu, setMenu] = useState(false)
  // o botão de formas lembra a última forma usada (como no Figma)
  const [ultima, setUltima] = useState<Ferramenta>('forma')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (FORMAS.some((f) => f.id === ferramenta)) setUltima(ferramenta) }, [ferramenta])
  useEffect(() => {
    if (!menu) return
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc) }
  }, [menu])
  const forma = FORMAS.find((f) => f.id === ultima) ?? FORMAS[0]!
  const formaAtiva = FORMAS.some((f) => f.id === ferramenta)
  return (
    <div className={cx('items-center gap-0.5', className)} role="toolbar" aria-label="Ferramentas">
      <BotaoIcone rotulo="Mover (V)" ativo={ferramenta === 'mover'} onClick={() => aoFerramenta('mover')}><MousePointer2 className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Frame (F)" ativo={ferramenta === 'frame'} onClick={() => aoFerramenta('frame')}><Frame className="h-4 w-4" /></BotaoIcone>
      <div ref={ref} className="relative flex">
        <BotaoIcone rotulo={`${forma.rotulo} (${forma.tecla})`} ativo={formaAtiva} className="rounded-r-none" onClick={() => aoFerramenta(forma.id)}>{forma.icone}</BotaoIcone>
        <button type="button" aria-label="Mais formas" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className={cx('inline-flex h-8 w-4 items-center justify-center rounded-r-md text-texto2 hover:bg-hover hover:text-texto', formaAtiva && 'bg-grafite/90 text-white hover:bg-grafite hover:text-white')}>
          <ChevronDown className="h-3 w-3" />
        </button>
        {menu && (
          <div role="menu" aria-label="Formas" className={cx('absolute left-0 z-40 w-48 rounded-lg border border-borda bg-superficie p-1 shadow-painel', menuAcima ? 'bottom-9' : 'top-9')}>
            {FORMAS.map((f) => (
              <button key={f.id} role="menuitemradio" aria-checked={ferramenta === f.id} type="button" onClick={() => { aoFerramenta(f.id); setMenu(false) }} className={cx('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-hover', ferramenta === f.id && 'text-acento')}>
                {f.icone}<span className="flex-1">{f.rotulo}</span><span className="mono text-[11px] text-texto3">{f.tecla}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <BotaoIcone rotulo="Caneta (P)" ativo={ferramenta === 'caneta'} onClick={() => aoFerramenta('caneta')}><PenTool className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Texto (T)" ativo={ferramenta === 'texto'} onClick={() => aoFerramenta('texto')}><Type className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Imagem, vídeo, SVG ou 3D" onClick={aoMidia}><ImageIcon className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Hotspot (S)" ativo={ferramenta === 'hotspot'} onClick={() => aoFerramenta('hotspot')}><Crosshair className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Mão (H ou Espaço)" ativo={ferramenta === 'mao'} onClick={() => aoFerramenta('mao')}><Hand className="h-4 w-4" /></BotaoIcone>
    </div>
  )
}
