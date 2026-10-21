/**
 * Traços da lista `strokes` (como no Figma): desenhados por cima do conteúdo, num SVG que transborda a caixa,
 * sem mudar a geometria da camada. Posição:
 * - retângulos/frames/mídia: o contorno é deslocado (dentro −w/2, centro 0, fora +w/2) acompanhando os raios
 *   e a suavização; espessura por lado vira bordas CSS posicionadas;
 * - elipse: elipse deslocada;
 * - polígonos, estrela e caminhos: traço no centro; dentro = recortado pela forma, fora = mascarado por ela
 *   (espessura dobrada para que a metade visível tenha a espessura pedida).
 * Linhas e setas desenham o traço em `Forma.tsx` (o traço é o próprio desenho). Texto usa -webkit-text-stroke.
 */
import type { CSSProperties, JSX } from 'react'
import type { Camada, Gradiente, Traco } from '@/lib/scene/schema'
import { caminhoCantos, caminhoElipse, raiosDaCamada } from '@/lib/scene/cantos'
import { caminhoDaForma } from '@/lib/scene/formas'
import { deslocamentoDoTraco, espessuraMax, pontaSvg, tracejadoSvg, tracosVisiveis } from '@/lib/scene/tracos'

/** Camadas cujo contorno é o retângulo da caixa (com raios). */
function ehCaixa(c: Camada): boolean {
  if (c.type === 'shape') return c.shape === 'rect'
  return c.type === 'frame' || c.type === 'image' || c.type === 'video' || c.type === 'embed' || c.type === 'lottie' || c.type === 'model3d' || c.type === 'svg'
}

/** Aceita traço desenhado por este componente. */
export function aceitaTracoSvg(c: Camada): boolean {
  if (c.type === 'shape') return c.shape !== 'line' && c.shape !== 'arrow'
  return ehCaixa(c)
}

function DefGradiente({ id, g }: { id: string; g: Gradiente }) {
  return g.type === 'radial' ? (
    <radialGradient id={id}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</radialGradient>
  ) : (
    <linearGradient id={id} gradientTransform={`rotate(${g.angle - 90} .5 .5)`}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</linearGradient>
  )
}

const ESTILO_SVG: CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }

/** Bordas por lado (CSS), posicionadas para dentro/centro/fora. */
function TracoPorLado({ t, raios }: { t: Traco; raios: readonly number[] }) {
  const s = t.sides!
  const k = t.position === 'inside' ? 0 : t.position === 'center' ? 0.5 : 1
  const media = (s.top + s.right + s.bottom + s.left) / 4
  const estilo = t.style === 'dashed' ? 'dashed' : t.style === 'dotted' ? 'dotted' : 'solid'
  const cor = t.gradient ? t.gradient.stops[0]?.color ?? t.color : t.color
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: -s.top * k,
        right: -s.right * k,
        bottom: -s.bottom * k,
        left: -s.left * k,
        borderStyle: estilo,
        borderColor: cor,
        borderWidth: `${s.top}px ${s.right}px ${s.bottom}px ${s.left}px`,
        borderRadius: raios.map((r) => `${r > 0 ? r + media * k : 0}px`).join(' '),
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}
    />
  )
}

export function Tracos({ camada: c }: { camada: Camada }) {
  if (!c.strokes || !aceitaTracoSvg(c)) return null
  const lista = tracosVisiveis(c)
  if (!lista.length) return null
  const w = c.width
  const h = c.height
  const caixa = ehCaixa(c)
  const raios = caixa ? (c.type === 'svg' ? ([0, 0, 0, 0] as const) : raiosDaCamada(c as { radius?: number; radii?: [number, number, number, number] })) : ([0, 0, 0, 0] as const)
  const suav = c.cornerSmoothing ?? 0
  const porLado = lista.filter((t) => t.sides && caixa)
  const svg = lista.filter((t) => !(t.sides && caixa))
  // ordem do painel: de cima para baixo → o primeiro desenhado por último
  const ordem = [...svg].reverse()
  const base = `t-${c.id}`
  const centro = c.type === 'shape' && !caixa && c.shape !== 'ellipse' ? caminhoDaForma(c) : null
  const aberto = c.type === 'shape' && c.shape === 'path' && !!c.vetor?.caminhos.some((k) => !k.fechado)
  const elementos: JSX.Element[] = []
  const defs: JSX.Element[] = []
  ordem.forEach((t, i) => {
    const id = `${base}-${i}`
    const peso = t.weight
    const pintura = t.gradient ? `url(#${id}-g)` : t.color
    if (t.gradient) defs.push(<DefGradiente key={`${id}-g`} id={`${id}-g`} g={t.gradient} />)
    const comum = { fill: 'none', stroke: pintura, strokeDasharray: tracejadoSvg(t, peso), strokeLinecap: pontaSvg(t), strokeLinejoin: t.join, strokeMiterlimit: 10 } as const
    if (caixa || (c.type === 'shape' && c.shape === 'ellipse')) {
      const o = deslocamentoDoTraco(t, peso)
      const d = caixa ? caminhoCantos(w, h, raios as unknown as [number, number, number, number], suav, o) : caminhoElipse(w, h, o)
      elementos.push(<path key={id} d={d} strokeWidth={peso} {...comum} />)
      return
    }
    if (!centro) return
    if (t.position === 'center' || aberto) {
      elementos.push(<path key={id} d={centro} strokeWidth={peso} {...comum} />)
    } else if (t.position === 'inside') {
      defs.push(<clipPath key={`${id}-c`} id={`${id}-c`}><path d={centro} /></clipPath>)
      elementos.push(<path key={id} d={centro} strokeWidth={peso * 2} clipPath={`url(#${id}-c)`} {...comum} />)
    } else {
      const m = peso * 2 + 4
      defs.push(
        <mask key={`${id}-m`} id={`${id}-m`} maskUnits="userSpaceOnUse" x={-m} y={-m} width={w + m * 2} height={h + m * 2}>
          <rect x={-m} y={-m} width={w + m * 2} height={h + m * 2} fill="#fff" />
          <path d={centro} fill="#000" />
        </mask>
      )
      elementos.push(<path key={id} d={centro} strokeWidth={peso * 2} mask={`url(#${id}-m)`} {...comum} />)
    }
  })
  return (
    <>
      {[...porLado].reverse().map((t, i) => <TracoPorLado key={`l-${i}`} t={t} raios={raios} />)}
      {elementos.length > 0 && (
        <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={ESTILO_SVG} data-tracos="">
          {defs.length > 0 && <defs>{defs}</defs>}
          {elementos}
        </svg>
      )}
    </>
  )
}

/** -webkit-text-stroke do primeiro traço visível do texto (fora = dobrado e atrás do preenchimento). */
export function estiloTracoTexto(c: Camada): CSSProperties | undefined {
  if (c.type !== 'text' || !c.strokes) return undefined
  const t = tracosVisiveis(c)[0]
  if (!t) return undefined
  const peso = espessuraMax(t)
  const cor = t.gradient ? t.gradient.stops[0]?.color ?? t.color : t.color
  if (t.position === 'outside') return { WebkitTextStroke: `${peso * 2}px ${cor}`, paintOrder: 'stroke fill' }
  return { WebkitTextStroke: `${peso}px ${cor}` }
}
