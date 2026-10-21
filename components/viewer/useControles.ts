'use client'
/**
 * Controles que somem durante a apresentação.
 * - Aparecem ao mover o mouse perto deles (faixa de baixo / canto do selo), ao passar o mouse, ao focar
 *   pelo teclado (Tab) e, no toque, por alguns segundos depois de um toque.
 * - Somem assim que quem apresenta clica na cena ou avança pelo teclado, e depois de ~2 s sem movimento.
 * - Nunca somem com o mouse em cima, com foco de teclado dentro deles ou com um painel aberto (`fixar`).
 * - O cursor também some após ~2 s parado (fora dos controles).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export const TEMPO_OCULTAR = 2000
const TEMPO_INICIAL = 3000
const TEMPO_TOQUE = 3500

export function useControles({ fixar = false, zonaTopo = false }: { fixar?: boolean; zonaTopo?: boolean } = {}) {
  const [visiveis, setVisiveis] = useState(true)
  const [cursor, setCursor] = useState(true)
  const sobre = useRef(false)
  const foco = useRef(false)
  const fixarRef = useRef(fixar)
  fixarRef.current = fixar
  const timer = useRef<number | undefined>(undefined)
  const timerCursor = useRef<number | undefined>(undefined)
  const ultimo = useRef<{ x: number; y: number } | null>(null)

  const presos = useCallback(() => sobre.current || foco.current || fixarRef.current, [])

  const agendar = useCallback((ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { if (!presos()) setVisiveis(false) }, ms)
  }, [presos])

  const mostrar = useCallback((ms = TEMPO_OCULTAR) => {
    setVisiveis(true)
    agendar(ms)
  }, [agendar])

  const ocultar = useCallback(() => {
    if (presos()) return
    window.clearTimeout(timer.current)
    setVisiveis(false)
  }, [presos])

  const acordarCursor = useCallback(() => {
    setCursor(true)
    window.clearTimeout(timerCursor.current)
    timerCursor.current = window.setTimeout(() => { if (!sobre.current) setCursor(false) }, TEMPO_OCULTAR)
  }, [])

  useEffect(() => {
    mostrar(TEMPO_INICIAL)
    acordarCursor()
    return () => { window.clearTimeout(timer.current); window.clearTimeout(timerCursor.current) }
  }, [mostrar, acordarCursor])

  // painel aberto (ex.: visão geral do mapa) mantém os controles; ao fechar, voltam a sumir sozinhos
  const fixarAntes = useRef(fixar)
  useEffect(() => {
    if (fixarAntes.current === fixar) return
    fixarAntes.current = fixar
    if (fixar) mostrar()
    else agendar(TEMPO_OCULTAR)
  }, [fixar, mostrar, agendar])

  /** Na raiz do visualizador. */
  const raiz = {
    onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
      // alguns navegadores disparam mousemove sem movimento (ex.: depois de uma transição)
      const u = ultimo.current
      if (u && Math.abs(u.x - e.clientX) < 2 && Math.abs(u.y - e.clientY) < 2) return
      ultimo.current = { x: e.clientX, y: e.clientY }
      acordarCursor()
      const r = e.currentTarget.getBoundingClientRect()
      const faixa = Math.max(120, r.height * 0.22)
      const perto = e.clientY >= r.bottom - faixa || (zonaTopo && e.clientY <= r.top + 90 && e.clientX <= r.left + 320)
      if (perto) mostrar()
    },
    onMouseLeave: () => { if (!foco.current && !fixarRef.current) agendar(600) },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('[data-controles]')) return
      if (e.pointerType === 'touch') mostrar(TEMPO_TOQUE)
      else ocultar()
    },
  }

  /** Em cada grupo de controles. */
  const grupo = {
    'data-controles': '',
    // clique do mouse não move o foco para os botões (Espaço depois de um clique continua avançando)
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') { sobre.current = true; setCursor(true); mostrar() } },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') { sobre.current = false; agendar(TEMPO_OCULTAR) } },
    onFocus: (e: React.FocusEvent) => {
      // só foco de teclado (clicar num botão também foca, mas não deve prender os controles)
      if (!(e.target as HTMLElement).matches(':focus-visible')) return
      foco.current = true
      mostrar()
    },
    onBlur: (e: React.FocusEvent) => {
      if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest?.('[data-controles]')) return
      foco.current = false
      agendar(TEMPO_OCULTAR)
    },
  }

  return { visiveis, cursor, mostrar, ocultar, raiz, grupo }
}
