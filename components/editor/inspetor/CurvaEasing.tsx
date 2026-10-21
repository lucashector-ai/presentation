'use client'
/**
 * Curva de animação: desenho da bezier com uma bolinha percorrendo no tempo real.
 * Com `aoMudar`, as duas alças são arrastáveis (curva personalizada → `bezier` no schema).
 */
import { useRef } from 'react'
import type { Animacao } from '@/lib/scene/schema'
import { curvaCss, pontosDaCurva } from '@/lib/scene/animacoes'

type Bezier = [number, number, number, number]
const W = 100
const H = 70
// área do desenho com folga para curvas que ultrapassam (y de -0,4 a 1,4)
const Y_MIN = -0.4
const Y_MAX = 1.4
const px = (x: number) => x * W
const py = (y: number) => H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * H

export function CurvaEasing({ easing, bezier, duracao, chave, aoMudar, aoInicio, aoFim }: { easing: Animacao['easing']; bezier?: Animacao['bezier']; duracao: number; chave: string; aoMudar?: (b: Bezier) => void; aoInicio?: () => void; aoFim?: () => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [a, b, c, d] = pontosDaCurva({ easing, bezier })
  const curva = `M${px(0)} ${py(0)} C${px(a)} ${py(b)} ${px(c)} ${py(d)} ${px(1)} ${py(1)}`
  const arrastar = (qual: 0 | 1) => (e: React.PointerEvent) => {
    if (!aoMudar || !svg.current) return
    e.preventDefault()
    const el = e.currentTarget as Element
    el.setPointerCapture(e.pointerId)
    aoInicio?.()
    const alvo = svg.current
    const mover = (ev: PointerEvent) => {
      const m = alvo.getScreenCTM()
      if (!m) return
      const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse())
      const x = Math.max(0, Math.min(1, p.x / W))
      const y = Math.max(-1, Math.min(2, Y_MIN + ((H - p.y) / H) * (Y_MAX - Y_MIN)))
      const arred = (n: number) => Math.round(n * 100) / 100
      aoMudar(qual === 0 ? [arred(x), arred(y), c, d] : [a, b, arred(x), arred(y)])
    }
    const soltar = () => { el.removeEventListener('pointermove', mover as EventListener); el.removeEventListener('pointerup', soltar); aoFim?.() }
    el.addEventListener('pointermove', mover as EventListener)
    el.addEventListener('pointerup', soltar)
  }
  return (
    <div className="flex items-center gap-3 rounded-md bg-superficie2 p-2.5">
      <svg ref={svg} viewBox={`-8 -8 ${W + 16} ${H + 16}`} className="h-[86px] w-[104px] shrink-0 touch-none overflow-visible" role={aoMudar ? 'group' : undefined} aria-label={aoMudar ? 'Editor de curva: arraste as alças' : undefined} aria-hidden={aoMudar ? undefined : true}>
        <rect x={0} y={py(1)} width={W} height={py(0) - py(1)} fill="rgb(var(--cor-superficie))" rx={3} />
        <path d={`M${px(0)} ${py(0)} L${px(1)} ${py(1)}`} stroke="rgb(var(--cor-borda-forte))" strokeDasharray="3 3" fill="none" />
        {aoMudar && (
          <>
            <line x1={px(0)} y1={py(0)} x2={px(a)} y2={py(b)} stroke="rgb(var(--cor-texto-3))" strokeWidth={1} />
            <line x1={px(1)} y1={py(1)} x2={px(c)} y2={py(d)} stroke="rgb(var(--cor-texto-3))" strokeWidth={1} />
          </>
        )}
        <path d={curva} stroke="rgb(var(--cor-acento))" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {aoMudar && (
          <>
            <circle cx={px(a)} cy={py(b)} r={5} fill="rgb(var(--cor-superficie))" stroke="rgb(var(--cor-acento))" strokeWidth={2} className="cursor-grab" onPointerDown={arrastar(0)} />
            <circle cx={px(c)} cy={py(d)} r={5} fill="rgb(var(--cor-superficie))" stroke="rgb(var(--cor-acento))" strokeWidth={2} className="cursor-grab" onPointerDown={arrastar(1)} />
          </>
        )}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="relative h-8 overflow-hidden rounded bg-superficie">
          <span key={chave} className="absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-[5px] bg-acento" style={{ animation: `previa-mov ${duracao}ms ${curvaCss({ easing, bezier })} 200ms infinite alternate` }} />
        </div>
        {aoMudar && <div className="mono truncate text-[10px] text-texto3">{[a, b, c, d].map((n) => n.toFixed(2)).join(' · ')}</div>}
      </div>
    </div>
  )
}
