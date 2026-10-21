'use client'
/** Curva de easing desenhada (bezier) com uma bolinha percorrendo no tempo da animação. */
import type { Animacao } from '@/lib/scene/schema'
import { EASING_CSS } from '@/lib/scene/motor'

const PONTOS: Record<Animacao['easing'], [number, number, number, number]> = {
  linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], easeIn: [0.4, 0, 1, 1], easeOut: [0.16, 1, 0.3, 1], easeInOut: [0.65, 0, 0.35, 1], spring: [0.34, 1.56, 0.64, 1],
}

export function CurvaEasing({ easing, duracao, chave }: { easing: Animacao['easing']; duracao: number; chave: string }) {
  const [a, b, c, d] = PONTOS[easing]
  const curva = `M0 60 C${a * 100} ${60 - b * 60} ${c * 100} ${60 - d * 60} 100 0`
  return (
    <div className="flex items-center gap-3 rounded-md bg-superficie2 p-3">
      <svg viewBox="-4 -14 108 88" className="h-16 w-24 overflow-visible" aria-hidden>
        <path d="M0 60 L100 0" stroke="#D4D4D4" strokeDasharray="3 3" fill="none" />
        <path d={curva} stroke="#5965F2" strokeWidth="2.5" fill="none" />
      </svg>
      <div className="relative h-10 flex-1 overflow-hidden rounded bg-superficie">
        <span key={chave} className="absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md bg-acento" style={{ animation: `previa-mov ${duracao}ms ${EASING_CSS[easing]} 200ms infinite alternate` }} />
      </div>
    </div>
  )
}
