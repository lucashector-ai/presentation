'use client'
/**
 * Realce do trecho de texto guardado (rich text) quando a edição sai para o painel: o mesmo azul da seleção,
 * desenhado sobre o texto renderizado — a pessoa continua vendo o que está estilizando, e cada mudança aparece.
 */
import { useLayoutEffect, useRef, useState } from 'react'

const ZW = /​/g

/** Range DOM das posições [inicio, fim) do texto de uma camada (parágrafos contam a quebra de linha entre eles). */
export function rangeDoTrecho(camada: Element, inicio: number, fim: number): Range | null {
  const pars = [...camada.querySelectorAll('[data-paragrafo]')]
  const blocos: { el: Element; base: number }[] = []
  if (pars.length) {
    let base = 0
    for (const p of pars) { blocos.push({ el: p, base }); base += (p.textContent ?? '').replace(ZW, '').length + 1 }
  } else blocos.push({ el: camada, base: 0 })
  const r = document.createRange()
  let comecou = false
  for (const { el, base } of blocos) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let pos = base
    for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
      const len = (n.textContent ?? '').replace(ZW, '').length
      if (!comecou && inicio <= pos + len) { r.setStart(n, Math.max(0, Math.min(len, inicio - pos))); comecou = true }
      if (comecou && fim <= pos + len) { r.setEnd(n, Math.max(0, Math.min(len, fim - pos))); return r }
      pos += len
    }
  }
  return null
}

export function RealceTrecho({ id, inicio, fim, versao }: { id: string; inicio: number; fim: number; versao: unknown }) {
  const ref = useRef<HTMLDivElement>(null)
  const [caixas, setCaixas] = useState<{ x: number; y: number; w: number; h: number }[]>([])
  useLayoutEffect(() => {
    const raiz = ref.current?.parentElement
    const camada = raiz?.querySelector(`[data-layer-id="${CSS.escape(id)}"]`)
    if (!raiz || !camada) return setCaixas([])
    const medir = () => {
      const r = rangeDoTrecho(camada, inicio, fim)
      const o = raiz.getBoundingClientRect()
      setCaixas(r ? [...r.getClientRects()].filter((c) => c.width > 0.5).map((c) => ({ x: c.left - o.left, y: c.top - o.top, w: c.width, h: c.height })) : [])
    }
    medir()
    // fonte nova carregando ou texto mudando de largura: mede de novo no quadro seguinte
    const q = requestAnimationFrame(medir)
    return () => cancelAnimationFrame(q)
  }, [id, inicio, fim, versao])
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-20">
      {caixas.map((c, i) => <div key={i} className="absolute bg-selecao/25" style={{ left: c.x, top: c.y, width: c.w, height: c.h }} />)}
    </div>
  )
}
