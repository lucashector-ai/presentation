'use client'
/** Seção "IA" do inspetor quando há texto selecionado: atalho para reescrever/traduzir com IA. */
import { Sparkles } from 'lucide-react'
import type { Editor } from '@/lib/editor/useEditor'
import { CUSTO_CREDITOS } from '@/lib/planos'
import { Secao } from '../inspetor/controles'
import { abrirIA } from './PainelIA'

export function SecaoIA({ editor }: { editor: Editor }) {
  const textos = editor.camadasSelecionadas.filter((l) => l.type === 'text' && l.text.trim())
  if (!textos.length) return null
  return (
    <Secao titulo="IA">
      <button type="button" onClick={() => abrirIA('texto')} className="flex w-full items-center gap-2 rounded-md border border-borda px-2.5 py-2 text-left text-[12px] font-medium hover:border-bordaForte hover:bg-hover">
        <Sparkles className="h-3.5 w-3.5 text-acento" />
        <span className="flex-1">Reescrever {textos.length > 1 ? `${textos.length} textos` : 'texto'} com IA</span>
        <span className="mono text-[10px] font-normal text-texto3">{CUSTO_CREDITOS.reescrever} créditos</span>
      </button>
    </Secao>
  )
}
