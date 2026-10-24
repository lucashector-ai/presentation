/**
 * Formas vetoriais. Retângulo e elipse em CSS (borda arredondada, gradiente, padrão); as demais em SVG.
 * `shape: 'path'` desenha o caminho editável (`vetor`) escalado do quadro de referência para o tamanho da camada.
 */
import type { CSSProperties, JSX } from 'react'
import type { CamadaForma, Gradiente, Traco, Vetor } from '@/lib/scene/schema'
import { vetorParaD } from '@/lib/editor/vetor/geometria'
import { caminhoCantos, raiosDaCamada, temSuavizacao } from '@/lib/scene/cantos'
import { pontosDaForma } from '@/lib/scene/formas'
import { pontaFim, pontaInicio, pontaSvg, tracejadoSvg, tracosVisiveis, type PontaSeta } from '@/lib/scene/tracos'
import { boxShadowCss, internas, sombrasVisiveis } from '@/lib/scene/efeitos'
import { fundoImagemCss, gradienteCss, padraoCss, raioCss } from '../estilos'

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
  // com a lista nova (`strokes`) o traço é desenhado em Tracos.tsx
  const sw = c.strokes ? 0 : c.strokeWidth
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }} aria-hidden data-vetor="">
      {c.gradient && <DefsGradiente id={gid} g={c.gradient} />}
      {dFill && <path d={dFill} fill={c.gradient ? `url(#${gid})` : c.fill} fillRule={v.fillRule} />}
      {c.stroke && sw > 0 && dTraco && <path d={dTraco} fill="none" stroke={c.stroke} strokeWidth={sw} strokeDasharray={c.dash ? `${c.dash} ${c.dash}` : undefined} strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  )
}

/**
 * Linha e seta desenhadas pelos traços da lista (o traço é o próprio desenho), com as pontas de início/fim
 * (nenhuma, seta, triângulo, círculo, quadrado, barra). O tamanho da ponta segue a altura da caixa (como a seta
 * antiga) e nunca fica menor que ~3× a espessura; a linha para antes das pontas cheias.
 */
function LinhaComTracos({ c }: { c: CamadaForma }) {
  const w = c.width
  const h = c.height
  const tracos = [...tracosVisiveis(c)].reverse()
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }} aria-hidden>
      <defs>{tracos.map((t, i) => (t.gradient ? <DefsGradienteSo key={i} id={`g-${c.id}-l${i}`} g={t.gradient} /> : null))}</defs>
      {tracos.map((t: Traco, i) => {
        const p = t.weight
        const cor = t.gradient ? `url(#g-${c.id}-l${i})` : t.color
        const props = { stroke: cor, strokeWidth: p, fill: 'none', strokeLinecap: pontaSvg(t), strokeLinejoin: t.join, strokeDasharray: tracejadoSvg(t, p) } as const
        const y = h / 2
        const ini = pontaInicio(c, t)
        const fim = pontaFim(c, t)
        const a = cabecaDeSeta(ini, 0, 1, w, h, p, cor, t.join)
        const b = cabecaDeSeta(fim, w, -1, w, h, p, cor, t.join)
        return (
          <g key={i}>
            {b.x > a.x && <line x1={a.x} y1={y} x2={b.x} y2={y} {...props} />}
            {a.el}
            {b.el}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Ponta numa extremidade da linha: `x` é a extremidade, `dir` aponta para dentro da linha (1 no início, −1 no fim).
 * Devolve onde a linha deve parar (`x`) e o desenho da ponta (`el`).
 */
function cabecaDeSeta(tipo: PontaSeta, x: number, dir: 1 | -1, w: number, h: number, p: number, cor: string, join: Traco['join']): { x: number; el: React.ReactNode } {
  const y = h / 2
  if (tipo === 'none') return { x, el: null }
  // seta antiga: cabeça com 40% da largura da caixa e 80% da altura; linhas finas: pelo menos 3× a espessura
  const comp = Math.max(h * 0.4, p * 3)
  const alt = Math.max(h * 0.4 - p, p * 2)
  const xi = x + dir * comp
  const traco = { stroke: cor, strokeWidth: p, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  switch (tipo) {
    case 'arrow':
      return { x: x + dir * p, el: <polyline points={`${xi},${y - alt} ${x + dir * p},${y} ${xi},${y + alt}`} {...traco} /> }
    case 'triangle':
      return { x: x + dir * comp * 0.85, el: <polygon points={`${x + dir * p * 0.5},${y} ${xi},${y - alt} ${xi},${y + alt}`} fill={cor} stroke={cor} strokeWidth={p * 0.5} strokeLinejoin={join === 'miter' ? 'miter' : 'round'} /> }
    case 'circle': {
      const r = Math.max(alt * 0.8, p * 1.5)
      return { x: x + dir * r * 2, el: <circle cx={x + dir * r} cy={y} r={r} fill={cor} /> }
    }
    case 'square': {
      const lado = Math.max(alt * 1.5, p * 2.5)
      return { x: x + dir * lado, el: <rect x={Math.min(x, x + dir * lado)} y={y - lado / 2} width={lado} height={lado} fill={cor} /> }
    }
    case 'bar':
      return { x, el: <line x1={x + dir * p * 0.5} y1={y - alt} x2={x + dir * p * 0.5} y2={y + alt} stroke={cor} strokeWidth={p} strokeLinecap="butt" /> }
  }
}

function DefsGradienteSo({ id, g }: { id: string; g: Gradiente }) {
  return g.type === 'radial' ? (
    <radialGradient id={id}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</radialGradient>
  ) : (
    <linearGradient id={id} gradientTransform={`rotate(${g.angle - 90} .5 .5)`}>{g.stops.map((s, i) => <stop key={i} offset={`${s.pos}%`} stopColor={s.color} />)}</linearGradient>
  )
}

export function Forma({ camada: c, urlImagem, transicao }: { camada: CamadaForma; urlImagem?: string; /** morph: "600ms ease" para a cor e o raio interpolarem */ transicao?: string }) {
  if (c.isMask) return null
  if (c.shape === 'path' && c.vetor) return <FormaVetor c={c} v={c.vetor} />
  if (c.shape === 'line' || c.shape === 'arrow') return <LinhaComTracos c={c} />
  const imagem = urlImagem && c.fillImage ? urlImagem : undefined
  const preenchimento = imagem ? fundoImagemCss(imagem, c.fillImage!.fit) : c.gradient ? gradienteCss(c.gradient) : c.fill
  if (c.shape === 'rect' || c.shape === 'ellipse') {
    const legado = !c.strokes
    // cantos suavizados (squircle): recorte pelo caminho; a sombra externa vai para o filtro do contêiner
    const suave = c.shape === 'rect' && temSuavizacao(c)
    const estilo: CSSProperties = {
      width: '100%',
      height: '100%',
      background: preenchimento,
      borderRadius: c.shape === 'ellipse' ? '50%' : suave ? undefined : raioCss(c),
      clipPath: suave ? `path("${caminhoCantos(c.width, c.height, raiosDaCamada(c), c.cornerSmoothing ?? 0)}")` : undefined,
      border: legado && c.stroke && c.strokeWidth ? `${c.strokeWidth}px ${c.dash ? 'dashed' : 'solid'} ${c.stroke}` : undefined,
      boxShadow: boxShadowCss(suave ? internas(c.effects) : sombrasVisiveis(c.effects)),
      ...padraoCss(c),
      transition: transicao ? `background-color ${transicao}, border-radius ${transicao}, box-shadow ${transicao}` : undefined,
    }
    if (c.pattern !== 'none' && preenchimento && !imagem) estilo.backgroundColor = c.gradient ? undefined : c.fill
    if (c.pattern !== 'none' && !imagem) estilo.background = undefined
    if (c.pattern !== 'none' && c.gradient) estilo.backgroundImage = `${padraoCss(c).backgroundImage}, ${gradienteCss(c.gradient)}`
    return <div style={estilo} />
  }
  const w = c.width
  const h = c.height
  const sw = c.strokes ? 0 : c.strokeWidth
  const gid = `g-${c.id}`
  const pid = `p-${c.id}`
  const fill = imagem ? `url(#${pid})` : c.gradient ? `url(#${gid})` : c.fill
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
    case 'star':
    case 'polygon': {
      const pts = (pontosDaForma(c) ?? []).map(([x, y]) => `${x},${y}`)
      forma = <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />
      break
    }
    default:
      forma = <rect width={w} height={h} fill={fill} />
  }
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }} aria-hidden>
      {c.gradient && <DefsGradiente id={gid} g={c.gradient} />}
      {imagem && (
        <defs>
          <pattern id={pid} patternUnits="userSpaceOnUse" width={w} height={h}>
            <image href={imagem} width={w} height={h} preserveAspectRatio={c.fillImage!.fit === 'fill' ? 'none' : c.fillImage!.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} />
          </pattern>
        </defs>
      )}
      {forma}
    </svg>
  )
}
