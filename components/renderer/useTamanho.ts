'use client'
import { useEffect, useRef, useState } from 'react'

/** Observa o tamanho de um elemento (ResizeObserver) para encaixe proporcional. */
export function useTamanho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entrada]) => {
      if (!entrada) return
      const { width, height } = entrada.contentRect
      setTamanho((t) => (t.width === width && t.height === height ? t : { width, height }))
    })
    ro.observe(el)
    setTamanho({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  return { ref, tamanho }
}

export function usePreferencias() {
  const [p, setP] = useState({ reduzirMovimento: false, semHover: false })
  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)')
    const sh = matchMedia('(hover: none)')
    const ler = () => setP({ reduzirMovimento: rm.matches, semHover: sh.matches })
    ler()
    rm.addEventListener('change', ler)
    sh.addEventListener('change', ler)
    return () => { rm.removeEventListener('change', ler); sh.removeEventListener('change', ler) }
  }, [])
  return p
}
