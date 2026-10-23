'use client'
/**
 * Menu "⋯" da barra superior do editor: ver (guias de layout, ⌃⇧4), exportar (PNG/JPG 1×–3× da tela ou da seleção, PDF da apresentação),
 * detalhes do projeto e atalhos. No celular também reúne o que não cabe na barra (desfazer, pré-visualizar,
 * opções de apresentação).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, Copy, Download, Eye, FileText, Info, Keyboard, Loader2, MonitorPlay, MoreHorizontal, Play, Redo2, Undo2 } from 'lucide-react'
import type { Editor } from '@/lib/editor/useEditor'
import { ESCALAS, type FormatoImagem } from '@/lib/exportar/medidas'
import { cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { useExportar } from './useExportar'
import { alternarGuias } from './guias/estado'

export interface PropsMenuEditor {
  editor: Editor
  projetoId: string
  nomeProjeto: string
  aoPreview: () => void
  aoApresentar: (o: { doInicio?: boolean; telaCheia?: boolean; apresentador?: boolean }) => void
  aoAtalhos: () => void
}

export function MenuEditor({ editor, projetoId, nomeProjeto, aoPreview, aoApresentar, aoAtalhos }: PropsMenuEditor) {
  const [aberto, setAberto] = useState(false)
  const [formato, setFormato] = useState<FormatoImagem>('png')
  const [escala, setEscala] = useState(2)
  const ref = useRef<HTMLDivElement>(null)
  const exp = useExportar(editor, nomeProjeto)
  const { estado, acoes } = editor
  const { mostrar } = useToast()
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc, true) }
  }, [aberto])
  const fechar = (fn: () => void) => () => { setAberto(false); fn() }
  const copiar = exp.copiarPng
  useEffect(() => {
    const f = () => void copiar()
    window.addEventListener('mostra:copiar-png', f)
    return () => window.removeEventListener('mostra:copiar-png', f)
  }, [copiar])
  const girando = (id: string) => (exp.ocupado === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null)

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={aberto} title="Mais opções" onClick={() => setAberto((v) => !v)} className={cx('inline-flex h-8 w-8 items-center justify-center rounded-md text-textoCorpo transition-colors hover:bg-hover hover:text-texto', aberto && 'bg-hover text-texto')}>
        {exp.ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>
      {aberto && (
        <div role="menu" aria-label="Mais opções" className="absolute right-0 z-50 mt-1 max-h-[calc(100dvh-64px)] w-[272px] overflow-y-auto max-md:fixed max-md:left-auto max-md:right-2 max-md:top-[52px] rounded-lg border border-borda bg-superficie p-1 shadow-painel">
          <div className="md:hidden">
            <div className="flex gap-1 p-1">
              <button type="button" role="menuitem" disabled={!estado.passado.length} onClick={acoes.desfazer} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-superficie2 text-[12px] hover:bg-hover disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" /> Desfazer</button>
              <button type="button" role="menuitem" disabled={!estado.futuro.length} onClick={acoes.refazer} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-superficie2 text-[12px] hover:bg-hover disabled:opacity-40"><Redo2 className="h-3.5 w-3.5" /> Refazer</button>
            </div>
            <Item icone={<Eye className="h-3.5 w-3.5" />} onClick={fechar(aoPreview)}>Pré-visualizar</Item>
            <Item icone={<Play className="h-3.5 w-3.5" />} onClick={fechar(() => aoApresentar({ telaCheia: true, doInicio: true }))}>Apresentar do início</Item>
            <Item icone={<MonitorPlay className="h-3.5 w-3.5" />} onClick={fechar(() => aoApresentar({ apresentador: true }))}>Visão do apresentador</Item>
            <div className="my-1 h-px bg-borda" />
          </div>

          <div className="px-2 pb-0.5 pt-1.5"><div className="rotulo-mono text-[10px] text-texto3">Ver</div></div>
          <Item role="menuitemcheckbox" aria-checked={estado.guiasLayout} icone={estado.guiasLayout ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />} onClick={fechar(() => alternarGuias(acoes, estado.guiasLayout, mostrar))}>Guias de layout <span className="mono float-right text-[11px] text-texto3">⌃⇧4</span></Item>
          <div className="my-1 h-px bg-borda" />
          <div className="px-2 pb-1 pt-1.5">
            <div className="rotulo-mono mb-2 text-[10px] text-texto3">Exportar</div>
            <div className="mb-2 flex gap-1.5">
              <Segmento rotulo="Formato" opcoes={[['png', 'PNG'], ['jpg', 'JPG']]} valor={formato} aoMudar={(v) => setFormato(v as FormatoImagem)} />
              <Segmento rotulo="Escala" opcoes={ESCALAS.map((e) => [String(e), `${e}×`])} valor={String(escala)} aoMudar={(v) => setEscala(Number(v))} />
            </div>
          </div>
          <Item icone={girando('tela') ?? <Download className="h-3.5 w-3.5" />} disabled={!!exp.ocupado} onClick={fechar(() => void exp.exportarTela(formato, escala))}>Exportar tela atual</Item>
          <Item icone={girando('selecao') ?? <Download className="h-3.5 w-3.5" />} disabled={!!exp.ocupado || !exp.temSelecao} title={exp.temSelecao ? undefined : 'Selecione camadas no canvas'} onClick={fechar(() => void exp.exportarSelecao(formato, escala))}>Exportar seleção</Item>
          <Item icone={girando('copiar') ?? <Copy className="h-3.5 w-3.5" />} disabled={!!exp.ocupado} onClick={fechar(() => void exp.copiarPng())}>Copiar como PNG <span className="mono float-right text-[11px] text-texto3">⇧⌘C</span></Item>
          <Item icone={girando('pdf') ?? <FileText className="h-3.5 w-3.5" />} disabled={!!exp.ocupado} onClick={fechar(() => void exp.exportarPdf())}>Exportar apresentação em PDF</Item>
          <div className="my-1 h-px bg-borda" />
          <Link role="menuitem" href={`/app/projects/${projetoId}`} onClick={() => acoes.salvarAgora()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover"><Info className="h-3.5 w-3.5" /> Detalhes do projeto</Link>
          <Item icone={<Keyboard className="h-3.5 w-3.5" />} onClick={fechar(aoAtalhos)}>Atalhos de teclado</Item>
        </div>
      )}
    </div>
  )
}

function Item({ icone, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icone: ReactNode }) {
  return (
    <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" {...rest}>
      {icone}
      <span className="flex-1">{children}</span>
    </button>
  )
}

function Segmento({ rotulo, opcoes, valor, aoMudar }: { rotulo: string; opcoes: readonly (readonly [string, string])[]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex h-7 flex-1 rounded-md bg-superficie2 p-[2px]">
      {opcoes.map(([id, r]) => (
        <button key={id} type="button" role="radio" aria-checked={valor === id} onClick={() => aoMudar(id)} className={cx('flex-1 rounded-[5px] text-[12px] tabular-nums', valor === id ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-texto2 hover:text-texto')}>{r}</button>
      ))}
    </div>
  )
}
