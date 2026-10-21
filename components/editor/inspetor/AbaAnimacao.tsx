'use client'
/**
 * Aba Animação. Sem seleção: a tela inteira (transição, "Animar tela inteira", linha do tempo).
 * Com seleção: galerias de Entrada / Ênfase / Saída das camadas. Toda mudança toca no canvas na hora.
 */
import type { Animacao } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { PRESETS_ENTRADA } from '@/lib/scene/animacoes'
import { AnimacaoTela } from '@/components/editor/animacao/AnimacaoTela'
import { AnimacaoCamadas } from '@/components/editor/animacao/AnimacaoCamadas'

/** Entradas disponíveis (compatibilidade: outros painéis importam esta lista). */
export const OPCOES_ENTRADA: { id: Animacao['type']; rotulo: string }[] = [{ id: 'none', rotulo: 'Nenhuma' }, ...PRESETS_ENTRADA.map((p) => ({ id: p.id, rotulo: p.rotulo }))]

export const OPCOES_EASING: { id: Animacao['easing']; rotulo: string }[] = [
  { id: 'easeOut', rotulo: 'Ease out' }, { id: 'easeInOut', rotulo: 'In-out' }, { id: 'spring', rotulo: 'Spring' }, { id: 'linear', rotulo: 'Linear' },
]

export function AbaAnimacao({ editor }: { editor: Editor }) {
  return editor.camadasSelecionadas.length === 0 ? <AnimacaoTela editor={editor} /> : <AnimacaoCamadas editor={editor} />
}
