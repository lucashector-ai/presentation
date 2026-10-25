/**
 * Corpo de uma camada de texto (o elemento com as letras): corte vertical, truncar com reticências, lista e
 * espaço entre parágrafos — as regras ficam em lib/scene/tipografia.ts (as mesmas da medição do editor).
 * Sem nenhum desses recursos o DOM é o de sempre: um <span> com o texto.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { CamadaTexto } from '@/lib/scene/schema'
import { LINHA_VAZIA, corpoTexto, corteVertical } from '@/lib/scene/tipografia'
import { cssTrecho, segmentar } from '@/lib/scene/trechos'
import { pilhaFonte } from '@/lib/design-tokens'

/** Trechos com estilo próprio (cor, peso, fonte…) viram <span>s; sem trechos, o texto puro (DOM de sempre). */
function comTrechos(c: CamadaTexto, inicio: number, tamanho: number): ReactNode {
  if (!c.trechos?.length) return c.text.slice(inicio, inicio + tamanho)
  return segmentar(c.text, c.trechos, inicio, inicio + tamanho).map((p, k) => (Object.keys(p.estilo).length ? <span key={k} data-trecho="" style={cssTrecho(p.estilo, pilhaFonte)}>{p.texto}</span> : p.texto))
}
/** Posição do parágrafo i no texto (parágrafos separados por uma quebra de linha). */
const inicioDoParagrafo = (ps: string[], i: number) => ps.slice(0, i).reduce((n, p) => n + p.length + 1, 0)

export function CorpoTexto({ c, gradiente }: { c: CamadaTexto; gradiente?: string }) {
  const t = corpoTexto(c)
  const pintura: CSSProperties | undefined = gradiente ? { backgroundImage: gradiente, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : undefined
  const estilo = { ...t.estilo, ...pintura }
  return (
    <span className={t.classe} style={Object.keys(estilo).length ? estilo : undefined}>
      {t.paragrafos ? t.paragrafos.map((p, i) => <span key={i} data-paragrafo={i} style={t.paragrafo(i, p)}>{p ? comTrechos(c, inicioDoParagrafo(t.paragrafos!, i), p.length) : LINHA_VAZIA}</span>) : comTrechos(c, 0, c.text.length)}
    </span>
  )
}

/** Texto animado por partes (palavras, letras, linhas): mantém o corte vertical em volta das partes. */
export function CorteTexto({ c, children }: { c: CamadaTexto; children: ReactNode }) {
  if (c.leadingTrim !== 'cap') return <>{children}</>
  const k = corteVertical(c)
  return <span className="texto-corte" style={{ display: 'block', ['--corte-topo' as string]: `${k.topo}px`, ['--corte-base' as string]: `${k.base}px` }}>{children}</span>
}
