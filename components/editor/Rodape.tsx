'use client'
/**
 * Barra inferior do editor: zoom (−, %, +, Ajustar), grade, encaixes, guias de layout, interagir com 3D, telas e
 * verificação. O controle de zoom lê a escala de um armazém próprio (escalaCanvas.ts): dar zoom não re-renderiza
 * o rodapé inteiro, só o número.
 */
import { memo, useEffect, useRef, useState } from 'react'
import { Box, ChevronDown, ChevronLeft, ChevronRight, Columns3, Grid3X3, Keyboard, Magnet, Ratio, TriangleAlert } from 'lucide-react'
import { mesmoEditorForaDoCanvas, type Editor } from '@/lib/editor/useEditor'
import { BotaoIcone, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { alternarGuias } from './guias/estado'
import { useEscalaCanvas, zoomMais, zoomMenos } from './escalaCanvas'

type Acoes = Pick<Editor['acoes'], 'setZoom' | 'ajustar'>

/** −  100%  +  Ajustar (rodapé). Só este pedaço acompanha o zoom. */
export const ControleZoom = memo(function ControleZoom({ acoes }: { acoes: Acoes }) {
  const escala = useEscalaCanvas()
  return (
    <>
      <button aria-label="Diminuir zoom" title="Diminuir zoom (−)" className="rounded px-2 py-1 hover:bg-hover hover:text-texto" onClick={() => acoes.setZoom(zoomMenos(escala))}>−</button>
      <span className="mono w-11 text-center tabular-nums text-texto" data-testid="zoom-rodape">{Math.round(escala * 100)}%</span>
      <button aria-label="Aumentar zoom" title="Aumentar zoom (+)" className="rounded px-2 py-1 hover:bg-hover hover:text-texto" onClick={() => acoes.setZoom(zoomMais(escala))}>+</button>
      <button className="rounded px-2 py-1 hover:bg-hover hover:text-texto" title="Ajustar à tela (Shift + 1)" onClick={acoes.ajustar}>Ajustar</button>
    </>
  )
})

/** "100% ▾" do cabeçalho (como o do Figma): menu com mais/menos, ajustar, zoom na seleção e valores fixos. */
export const MenuZoom = memo(function MenuZoom({ acoes, temSelecao, className }: { acoes: Acoes; temSelecao: boolean; className?: string }) {
  const escala = useEscalaCanvas()
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc, true) }
  }, [aberto])
  const item = (rotulo: string, atalho: string, acao: () => void, desativado = false) => (
    <button type="button" role="menuitem" disabled={desativado} onClick={() => { setAberto(false); acao() }} className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent">
      {rotulo}<span className="mono text-[11px] text-texto3">{atalho}</span>
    </button>
  )
  return (
    <div ref={ref} className={cx('relative', className)}>
      <button type="button" aria-label="Zoom" aria-haspopup="menu" aria-expanded={aberto} title="Zoom" onClick={() => setAberto((v) => !v)} className={cx('mono inline-flex h-8 items-center gap-0.5 rounded-md px-2 text-[12px] tabular-nums text-textoCorpo hover:bg-hover hover:text-texto', aberto && 'bg-hover text-texto')}>
        {Math.round(escala * 100)}%<ChevronDown className="h-3 w-3 text-texto3" />
      </button>
      {aberto && (
        <div role="menu" aria-label="Zoom" className="absolute right-0 z-50 mt-1 w-52 rounded-lg border border-borda bg-superficie p-1 shadow-painel">
          {item('Aumentar zoom', '+', () => acoes.setZoom(zoomMais(escala)))}
          {item('Diminuir zoom', '−', () => acoes.setZoom(zoomMenos(escala)))}
          <div className="my-1 h-px bg-borda" />
          {item('Ajustar à tela', '⇧1', acoes.ajustar)}
          {item('Zoom na seleção', '⇧2', () => window.dispatchEvent(new Event('mostra:zoom-selecao')), !temSelecao)}
          {item('Zoom 100%', '⌘0', () => acoes.setZoom(1))}
          <div className="my-1 h-px bg-borda" />
          {item('50%', '', () => acoes.setZoom(0.5))}
          {item('200%', '', () => acoes.setZoom(2))}
        </div>
      )}
    </div>
  )
})

/** Durante um arraste no canvas o rodapé não re-renderiza a cada quadro (compara o editor sem zoom/pan). */
export const Rodape = memo(function Rodape({ editor, interagir3d, aoInteragir3d, aoAtalhos }: { editor: Editor; interagir3d: boolean; aoInteragir3d: (f: (v: boolean) => boolean) => void; aoAtalhos: () => void }) {
  const { estado, acoes, validacao, indiceCena } = editor
  const { mostrar } = useToast()
  const total = estado.documento.scenes.length
  return (
    <footer className="hidden h-9 shrink-0 items-center gap-1 border-t border-borda bg-superficie px-3 text-[12px] text-texto2 md:flex">
      <ControleZoom acoes={acoes} />
      <span className="mx-1 h-4 w-px bg-borda" />
      <BotaoIcone rotulo="Grade (Shift + ')" ativo={estado.grade} className="h-6 w-6" onClick={() => acoes.ui({ grade: !estado.grade })}><Grid3X3 className="h-3.5 w-3.5" /></BotaoIcone>
      {estado.grade && (
        <label className="flex items-center gap-1 rounded px-1 text-texto2" title="Tamanho da grade (posição e tamanho arredondam para ela)">
          <input aria-label="Tamanho da grade" type="number" min={1} max={200} value={estado.gradePasso} onChange={(e) => { const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 200) acoes.ui({ gradePasso: v }) }} onKeyDown={(e) => e.stopPropagation()} className="mono h-5 w-9 rounded bg-superficie2 px-1 text-right text-[11px] text-texto outline-none focus:ring-1 focus:ring-acento" />
          <span className="text-[11px]">px</span>
        </label>
      )}
      <BotaoIcone rotulo="Guias inteligentes" ativo={estado.snap} className="h-6 w-6" onClick={() => acoes.ui({ snap: !estado.snap })}><Magnet className="h-3.5 w-3.5" /></BotaoIcone>
      <BotaoIcone rotulo="Encaixar nas frações da tela (1/2, 1/3, 1/4…)" ativo={estado.fracoes} className="h-6 w-6" onClick={() => acoes.ui({ fracoes: !estado.fracoes })}><Ratio className="h-3.5 w-3.5" /></BotaoIcone>
      <BotaoIcone rotulo="Guias de layout (Ctrl + Shift + 4)" ativo={estado.guiasLayout} className="h-6 w-6" onClick={() => alternarGuias(acoes, estado.guiasLayout, mostrar)}><Columns3 className="h-3.5 w-3.5" /></BotaoIcone>
      <BotaoIcone rotulo="Interagir com 3D e incorporados no canvas" ativo={interagir3d} className="h-6 w-6" onClick={() => aoInteragir3d((v) => !v)}><Box className="h-3.5 w-3.5" /></BotaoIcone>
      <span className="flex-1" />
      <button aria-label="Tela anterior" className="rounded p-1 hover:bg-hover disabled:opacity-30" disabled={indiceCena <= 0} onClick={() => acoes.irParaCena(estado.documento.scenes[indiceCena - 1]!.id)}><ChevronLeft className="h-3.5 w-3.5" /></button>
      <span className="mono tabular-nums text-texto">{String(indiceCena + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      <button aria-label="Próxima tela" className="rounded p-1 hover:bg-hover disabled:opacity-30" disabled={indiceCena >= total - 1} onClick={() => acoes.irParaCena(estado.documento.scenes[indiceCena + 1]!.id)}><ChevronRight className="h-3.5 w-3.5" /></button>
      <span className="flex-1" />
      {!validacao.ok && <button className="mr-2 flex items-center gap-1 text-perigo hover:underline" onClick={() => { acoes.selecionarExato([]); acoes.ui({ abaDireita: 'design' }) }}><TriangleAlert className="h-3.5 w-3.5" /> {validacao.erros.length} erro(s)</button>}
      <span className="hidden gap-3 xl:flex"><span><b className="font-medium text-texto">V</b> Mover</span><span><b className="font-medium text-texto">T</b> Texto</span><span><b className="font-medium text-texto">S</b> Hotspot</span><span><b className="font-medium text-texto">H</b> Mão</span><span><b className="font-medium text-texto">⌘V</b> Colar do Figma</span><span><b className="font-medium text-texto">⌘Z</b> Desfazer</span></span>
      <BotaoIcone rotulo="Atalhos de teclado (?)" className="ml-2 h-6 w-6" onClick={aoAtalhos}><Keyboard className="h-3.5 w-3.5" /></BotaoIcone>
    </footer>
  )
}, (a, b) => mesmoEditorForaDoCanvas(a.editor, b.editor) && a.interagir3d === b.interagir3d && a.aoInteragir3d === b.aoInteragir3d && a.aoAtalhos === b.aoAtalhos)
