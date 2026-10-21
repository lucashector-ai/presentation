/**
 * Formas vetoriais. Retângulo e elipse em CSS (borda arredondada, gradiente, padrão); as demais em SVG.
 * `shape: 'path'` desenha o caminho editável (`vetor`) escalado do quadro de referência para o tamanho da camada.
 */
import type { CSSProperties } from 'react'
import type { CamadaForma, Gradiente, Vetor } from '@/lib/scene/schema'
import { vetorParaD } from '@/lib/editor/vetor/geometria'
import { PADROES, gradienteCss, raioCss, sombraCss } from '../estilos'

function DefsGradiente({ id, g }: { id: string; g: Gradiente }) {
  return (
    <defs>
      {g.type === 'radial' ? (
        <radialGradient id={id}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</radialGradient>
      ) : (
        <linearGradient id={id} gradientTransform={`rotate(${g.angle - 90} .5 .5)`}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</linearGradient>
      )}
    </defs>
  )
}

/** Caminho editável: um <path> preenchido (regiões com preenchimento) e um com o traço de todos os caminhos. */
function FormaVetor({ c, v }: { c: CamadaForma; v: Vetor }) {
  const w = c.width
  const h = c.height
  const sx = w / v.w
  const sy = h / v.h
  const gid = `g-${c.id}`
  const dFill = vetorParaD(v, sx, sy, (k) => !k.semPreenchimento)
  const dTraco = vetorParaD(v, sx, sy)
  const sw = c.strokeWidth
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }} aria-hidden data-vetor="">
      {c.gradient && <DefsGradiente id={gid} g={c.gradient} />}
      {dFill && <path d={dFill} fill={c.gradient ? `url(#${gid})` : c.fill} fillRule={v.fillRule} />}
      {c.stroke && sw > 0 && dTraco && <path d={dTraco} fill="none" stroke={c.stroke} strokeWidth={sw} strokeDasharray={c.dash ? `${c.dash} ${c.dash}` : undefined} strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  )
}

export function Forma({ camada: c }: { camada: CamadaForma }) {
  if (c.shape === 'path' && c.vetor) return <FormaVetor c={c} v={c.vetor} />
  const preenchimento = c.gradient ? gradienteCss(c.gradient) : c.fill
  if (c.shape === 'rect' || c.shape === 'ellipse') {
    const estilo: CSSProperties = {
      width: '100%',
      height: '100%',
      background: preenchimento,
      borderRadius: c.shape === 'ellipse' ? '50%' : raioCss(c),
      border: c.stroke && c.strokeWidth ? `${c.strokeWidth}px ${c.dash ? 'dashed' : 'solid'} ${c.stroke}` : undefined,
      boxShadow: sombraCss(c.effects),
      ...(c.pattern !== 'none' ? PADROES[c.pattern] : {}),
    }
    if (c.pattern !== 'none' && preenchimento) estilo.backgroundColor = c.gradient ? undefined : c.fill
    if (c.pattern !== 'none') estilo.background = undefined
    if (c.pattern !== 'none' && c.gradient) estilo.backgroundImage = `${PADROES[c.pattern]?.backgroundImage}, ${gradienteCss(c.gradient)}`
    return <div style={estilo} />
  }
  const w = c.width
  const h = c.height
  const sw = c.strokeWidth
  const gid = `g-${c.id}`
  const fill = c.gradient ? `url(#${gid})` : c.fill
  const stroke = c.stroke && sw ? c.stroke : 'none'
  const dash = c.dash ? `${c.dash} ${c.dash}` : undefined
  let forma: JSX.Element
  switch (c.shape) {
    case 'triangle':
      forma = <polygon points={`${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />
      break
    case 'semicircle':
      forma = <path d={`M ${sw} ${h - sw} A ${w / 2 - sw} ${h - sw * 2} 0 0 1 ${w - sw} ${h - sw} Z`} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
      break
    case 'line':
      forma = <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke={c.stroke ?? c.fill} strokeWidth={Math.max(1, sw || h)} strokeDasharray={dash} strokeLinecap="round" />
      break
    case 'arrow': {
      const t = Math.max(2, sw || h * 0.12)
      forma = (
        <g stroke={c.stroke ?? c.fill} strokeWidth={t} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash}>
          <line x1={t} y1={h / 2} x2={w - t} y2={h / 2} />
          <polyline points={`${w - h * 0.4},${h * 0.1 + t} ${w - t},${h / 2} ${w - h * 0.4},${h * 0.9 - t}`} />
        </g>
      )
      break
    }
    case 'star': {
      const pts: string[] = []
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.2
        const a = (Math.PI / 5) * i - Math.PI / 2
        pts.push(`${w / 2 + Math.cos(a) * w * r},${h / 2 + Math.sin(a) * h * r}`)
      }
      forma = <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />
      break
    }
    default:
      forma = <rect width={w} height={h} fill={fill} />
  }
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }} aria-hidden>
      {c.gradient && <DefsGradiente id={gid} g={c.gradient} />}
      {forma}
    </svg>
  )
}
