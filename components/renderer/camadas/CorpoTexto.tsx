/**
 * Corpo de uma camada de texto (o elemento com as letras): corte vertical, truncar com reticências, lista e
 * espaço entre parágrafos — as regras ficam em lib/scene/tipografia.ts (as mesmas da medição do editor).
 * Sem nenhum desses recursos o DOM é o de sempre: um <span> com o texto.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { CamadaTexto } from '@/lib/scene/schema'
import { LINHA_VAZIA, corpoTexto, corteVertical } from '@/lib/scene/tipografia'

export function CorpoTexto({ c, gradiente }: { c: CamadaTexto; gradiente?: string }) {
  const t = corpoTexto(c)
  const pintura: CSSProperties | undefined = gradiente ? { backgroundImage: gradiente, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined
  const estilo = { ...t.estilo, ...pintura }
  return (
    <span className={t.classe} style={Object.keys(estilo).length ? estilo : undefined}>
      {t.paragrafos ? t.paragrafos.map((p, i) => <span key={i} data-paragrafo={i} style={t.paragrafo(i, p)}>{p || LINHA_VAZIA}</span>) : c.text}
    </span>
  )
}

/** Texto animado por partes (palavras, letras, linhas): mantém o corte vertical em volta das partes. */
export function CorteTexto({ c, children }: { c: CamadaTexto; children: ReactNode }) {
  if (c.leadingTrim !== 'cap') return <>{children}</>
  const k = corteVertical(c)
  return <span className="texto-corte" style={{ display: 'block', ['--corte-topo' as string]: `${k.topo}px`, ['--corte-base' as string]: `${k.base}px` }}>{children}</span>
}
