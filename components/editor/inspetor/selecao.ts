'use client'
/** Ajudantes das seções do painel Design: valores comuns da seleção ("Misto") e gravação com histórico. */
import { Box, Code2, Crosshair, Frame, Image as ImageIcon, PenTool, Sparkles, Square, Type, Video } from 'lucide-react'
import type { Camada } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { MISTO, type Misto } from './campos'
import { useHistorico } from './contexto'

/** Props comuns das seções do painel Design (`<SecaoX editor={editor} />`). */
export interface PropsSecao { editor: Editor; assets?: AssetDemo[] }

export const ICONE_TIPO: Record<Camada['type'], typeof Type> = { text: Type, shape: Square, image: ImageIcon, video: Video, hotspot: Crosshair, svg: PenTool, model3d: Box, lottie: Sparkles, embed: Code2, frame: Frame }
export const NOME_TIPO: Record<Camada['type'], string> = { text: 'Texto', shape: 'Forma', image: 'Imagem', video: 'Vídeo', hotspot: 'Hotspot', svg: 'Vetor (SVG)', model3d: 'Modelo 3D', lottie: 'Animação Lottie', embed: 'Incorporado', frame: 'Frame' }
export const NOME_FORMA: Record<string, string> = { rect: 'Retângulo', ellipse: 'Elipse', triangle: 'Triângulo', semicircle: 'Semicírculo', line: 'Linha', star: 'Estrela', arrow: 'Seta', path: 'Vetor' }

/** Valor igual em toda a seleção, ou MISTO. */
export function comum<T>(sel: readonly Camada[], f: (c: Camada) => T): T | Misto {
  const primeiro = sel[0]
  if (!primeiro) return MISTO
  const v = f(primeiro)
  for (let i = 1; i < sel.length; i++) if (!igual(f(sel[i]!), v)) return MISTO
  return v
}

function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'object' && typeof b === 'object' && a && b) return JSON.stringify(a) === JSON.stringify(b)
  return false
}

/** Seleção atual + setters que respeitam gestos contínuos (um único desfazer por arraste). */
export function useCamadas(editor: Editor) {
  const { camadasSelecionadas: sel, acoes } = editor
  const historico = useHistorico()
  const ids = sel.map((l) => l.id)
  return {
    sel,
    ids,
    multi: sel.length > 1,
    set: (patch: Partial<Camada>) => acoes.atualizarCamadas(ids, patch, historico()),
    setFn: (fn: (c: Camada) => Camada) => acoes.atualizarCamadas(ids, fn, historico()),
  }
}
