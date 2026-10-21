'use client'
/** Camada Lottie (lottie-web carregado sob demanda). Em miniaturas mostra só o primeiro quadro. */
import { useEffect, useRef, useState } from 'react'
import type { CamadaLottie } from '@/lib/scene/schema'

type Animacao = { destroy(): void; setSpeed(n: number): void; goToAndStop(v: number, f?: boolean): void }

const cacheJson = new Map<string, Promise<unknown>>()
function carregarJson(url: string) {
  if (!cacheJson.has(url)) cacheJson.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))))
  return cacheJson.get(url) as Promise<unknown>
}

export function Lottie({ camada: c, src, estatico }: { camada: CamadaLottie; src?: string; estatico: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let anim: Animacao | null = null
    let ativo = true
    ;(async () => {
      try {
        const [{ default: lottie }, dados] = await Promise.all([import('lottie-web/build/player/lottie_light'), c.data ? Promise.resolve(JSON.parse(c.data)) : src ? carregarJson(src) : Promise.reject(new Error('sem fonte'))])
        if (!ativo || !ref.current) return
        anim = lottie.loadAnimation({ container: ref.current, renderer: 'svg', loop: c.loop, autoplay: c.autoplay && !estatico, animationData: structuredClone(dados) }) as unknown as Animacao
        anim.setSpeed(c.speed)
        if (estatico) anim.goToAndStop(0, true)
      } catch {
        if (ativo) setErro(true)
      }
    })()
    return () => {
      ativo = false
      anim?.destroy()
    }
  }, [c.data, src, c.loop, c.autoplay, c.speed, estatico])

  if (erro) return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(23,23,23,.45)', fontSize: 20 }}>Lottie indisponível</div>
  return <div ref={ref} style={{ width: '100%', height: '100%' }} aria-hidden />
}
