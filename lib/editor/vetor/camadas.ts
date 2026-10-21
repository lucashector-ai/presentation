/**
 * Ponte entre camadas e vetores: coordenadas locais ↔ cena (com rotação e espelho), aplicar um vetor editado
 * a uma camada recalculando a caixa sem mexer na posição visual, e converter camadas SVG em formas `path`.
 */
import { parseCamada, type Camada, type CamadaForma, type CamadaSvg, type Vetor } from '@/lib/scene/schema'
import { novoId } from '@/lib/scene/order'
import { recolorirSvg } from '@/lib/importar/svg'
import { normalizar } from './operacoes'
import { vetorDaForma } from './primitivas'
import { svgParaGrupos, vetorDoGrupo } from './svgVetor'
import type { P } from './geometria'

type Caixa = Pick<Camada, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'>

/** Ponto local do vetor (quadro w × h) → cena. Gira em torno do centro da camada; espelho antes da rotação (como o CSS). */
export function localParaCena(c: Caixa, v: Pick<Vetor, 'w' | 'h'>, p: P): P {
  let x = (p.x * c.width) / v.w - c.width / 2
  let y = (p.y * c.height) / v.h - c.height / 2
  if (c.flipX) x = -x
  if (c.flipY) y = -y
  const a = ((c.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(a), sin = Math.sin(a)
  return { x: c.x + c.width / 2 + x * cos - y * sin, y: c.y + c.height / 2 + x * sin + y * cos }
}

export function cenaParaLocal(c: Caixa, v: Pick<Vetor, 'w' | 'h'>, p: P): P {
  const a = (-(c.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(a), sin = Math.sin(a)
  const dx = p.x - (c.x + c.width / 2)
  const dy = p.y - (c.y + c.height / 2)
  let x = dx * cos - dy * sin
  let y = dx * sin + dy * cos
  if (c.flipX) x = -x
  if (c.flipY) y = -y
  return { x: ((x + c.width / 2) * v.w) / c.width, y: ((y + c.height / 2) * v.h) / c.height }
}

/** Deslocamento em cena → deslocamento local (setas, arraste de vários nós). */
export function deltaParaLocal(c: Caixa, v: Pick<Vetor, 'w' | 'h'>, dx: number, dy: number): P {
  const o = cenaParaLocal(c, v, { x: c.x, y: c.y })
  const d = cenaParaLocal(c, v, { x: c.x + dx, y: c.y + dy })
  return { x: d.x - o.x, y: d.y - o.y }
}

/** Vetor atual da camada (primitivas são convertidas sem gravar) e o ajuste de estilo da conversão. */
export function vetorDaCamada(c: CamadaForma): { vetor: Vetor; patch: Partial<CamadaForma> } {
  if (c.shape === 'path' && c.vetor) return { vetor: c.vetor, patch: {} }
  return vetorDaForma(c)
}

/**
 * Grava o vetor na camada: vira `shape: 'path'` e a caixa passa a abraçar a geometria
 * (o desenho fica exatamente onde estava, inclusive com rotação/espelho).
 */
export function aplicarVetor(c: CamadaForma, vetor: Vetor, patch: Partial<CamadaForma> = {}): CamadaForma {
  const { vetor: v, caixa } = normalizar(vetor)
  const sx = c.width / vetor.w
  const sy = c.height / vetor.h
  const width = caixa.width * sx
  const height = caixa.height * sy
  const centro = localParaCena(c, vetor, { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 })
  const arred = (n: number) => Math.round(n * 1000) / 1000
  return { ...c, ...patch, shape: 'path', vetor: v, x: arred(centro.x - width / 2), y: arred(centro.y - height / 2), width: Math.max(1, arred(width)), height: Math.max(1, arred(height)), radius: 0, radii: undefined, pattern: 'none' }
}

/** Camadas que entram no modo de edição de vetor. */
export function editavelComoVetor(c: Camada | undefined): c is CamadaForma | CamadaSvg {
  return !!c && !c.locked && (c.type === 'shape' || c.type === 'svg')
}

/**
 * Camada SVG → formas `path` (uma por pintura), na mesma posição. Se houver mais de uma, ficam agrupadas.
 * Devolve null quando o SVG não tem nada desenhável (só imagem, texto…).
 */
export function formasDoSvg(svg: CamadaSvg, markup: string, existentes: readonly { id: string }[], parser: { parseFromString(s: string, tipo: string): Document }): CamadaForma[] | null {
  const grupos = svgParaGrupos(recolorirSvg(markup, svg.recolor), svg.width, svg.height, svg.fit, parser)
  if (!grupos) return null
  const usados = [...existentes]
  const groupId = grupos.length > 1 ? (svg.groupId ?? novoId('grupo', usados)) : svg.groupId
  const { markup: _m, assetId: _a, recolor: _r, fit: _f, type: _t, id: _id, ...base } = svg
  const r: CamadaForma[] = []
  grupos.forEach((g, k) => {
    const id = k === 0 ? svg.id : novoId('vetor', usados)
    usados.push({ id })
    const bruta = parseCamada({
      ...base,
      id,
      type: 'shape',
      shape: 'path',
      name: k === 0 ? (svg.name ?? 'Vetor') : `${svg.name ?? 'Vetor'} ${k + 1}`,
      interactions: k === 0 ? svg.interactions : [],
      fill: g.fill ?? '#000000',
      ...(g.stroke ? { stroke: g.stroke, strokeWidth: g.strokeWidth } : {}),
      groupId,
      vetor: vetorDoGrupo(g, svg.width, svg.height),
    }) as CamadaForma
    r.push(aplicarVetor(bruta, bruta.vetor!))
  })
  return r
}
