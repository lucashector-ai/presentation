'use client'
/**
 * Ferramentas (trilho vertical na lateral do canvas; barra no celular): Mover V · Frame F · Formas (R O L ⇧L, num menu) ·
 * Caneta P · Texto T · Mídia · Hotspot S · Mão H.
 */
import { useEffect, useRef, useState, type JSX } from 'react'
import { ChevronDown, Circle, Crosshair, Frame, Hand, Hexagon, Image as ImageIcon, MousePointer2, MoveUpRight, PenTool, Slash, Square, Star, Type } from 'lucide-react'
import type { Ferramenta } from '@/lib/editor/atalhos'
import { BotaoIcone, cx } from '@/components/ui'

const FORMAS: { id: Ferramenta; rotulo: string; tecla: string; icone: JSX.Element }[] = [
  { id: 'forma', rotulo: 'Retângulo', tecla: 'R', icone: <Square className="h-4 w-4" /> },
  { id: 'elipse', rotulo: 'Elipse', tecla: 'O', icone: <Circle className="h-4 w-4" /> },
  { id: 'linha', rotulo: 'Linha', tecla: 'L', icone: <Slash className="h-4 w-4" /> },
  { id: 'seta', rotulo: 'Seta', tecla: 'Shift+L', icone: <MoveUpRight className="h-4 w-4" /> },
  { id: 'poligono', rotulo: 'Polígono', tecla: '', icone: <Hexagon className="h-4 w-4" /> },
  { id: 'estrela', rotulo: 'Estrela', tecla: '', icone: <Star className="h-4 w-4" /> },
]

export function BarraFerramentas({ ferramenta, aoFerramenta, aoMidia, className, menuAcima, vertical }: { ferramenta: Ferramenta; aoFerramenta: (f: Ferramenta) => void; aoMidia: () => void; className?: string; menuAcima?: boolean; /** trilho na lateral do canvas: em coluna, menu de formas abre para o lado */ vertical?: boolean }) {
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
    <div className={cx('items-center gap-0.5', vertical && 'flex-col', className)} role="toolbar" aria-label="Ferramentas" aria-orientation={vertical ? 'vertical' : 'horizontal'}>
      <BotaoIcone rotulo="Mover (V)" destaque ativo={ferramenta === 'mover'} onClick={() => aoFerramenta('mover')}><MousePointer2 className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Frame (F)" destaque ativo={ferramenta === 'frame'} onClick={() => aoFerramenta('frame')}><Frame className="h-4 w-4" /></BotaoIcone>
      <div ref={ref} className={cx('relative flex', vertical && 'flex-col')}>
        <BotaoIcone rotulo={forma.tecla ? `${forma.rotulo} (${forma.tecla})` : forma.rotulo}  destaque ativo={formaAtiva} className={vertical ? 'rounded-b-none' : 'rounded-r-none'} onClick={() => aoFerramenta(forma.id)}>{forma.icone}</BotaoIcone>
        <button type="button" aria-label="Mais formas" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className={cx('inline-flex items-center justify-center text-texto2 hover:bg-hover hover:text-texto', vertical ? 'h-3.5 w-8 rounded-b-md' : 'h-8 w-4 rounded-r-md', formaAtiva && 'bg-acento text-white hover:bg-acentoHover hover:text-white')}>
          <ChevronDown className={cx('h-3 w-3', vertical && '-rotate-90')} />
        </button>
        {menu && (
          <div role="menu" aria-label="Formas" className={cx('absolute z-40 w-48 rounded-lg border border-borda bg-superficie p-1 shadow-painel', vertical ? 'left-10 top-0' : menuAcima ? 'bottom-9 left-0' : 'top-9 left-0')}>
            {FORMAS.map((f) => (
              <button key={f.id} role="menuitemradio" aria-checked={ferramenta === f.id} type="button" onClick={() => { aoFerramenta(f.id); setMenu(false) }} className={cx('flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-hover', ferramenta === f.id && 'text-acento')}>
                {f.icone}<span className="flex-1">{f.rotulo}</span><span className="mono text-[11px] text-texto3">{f.tecla}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <BotaoIcone rotulo="Caneta (P)" destaque ativo={ferramenta === 'caneta'} onClick={() => aoFerramenta('caneta')}><PenTool className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Texto (T)" destaque ativo={ferramenta === 'texto'} onClick={() => aoFerramenta('texto')}><Type className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Imagem, vídeo, SVG ou 3D" onClick={aoMidia}><ImageIcon className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Hotspot (S)" destaque ativo={ferramenta === 'hotspot'} onClick={() => aoFerramenta('hotspot')}><Crosshair className="h-4 w-4" /></BotaoIcone>
      <BotaoIcone rotulo="Mão (H ou Espaço)" destaque ativo={ferramenta === 'mao'} onClick={() => aoFerramenta('mao')}><Hand className="h-4 w-4" /></BotaoIcone>
    </div>
  )
}
