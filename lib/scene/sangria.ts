/**
 * Sangria na apresentação: quando a tela tem proporção diferente do projeto (16:10, janela do navegador,
 * celular), sobram faixas em volta da cena. O fundo da cena já é estendido para elas; aqui as camadas que
 * encostam na borda da cena (um retângulo de cor, uma foto "sangrada", um frame) também se estendem até a
 * borda da tela, como numa arte com sangria. Texto, vetores e formas não retangulares nunca são esticados.
 */
import type { Camada } from './schema'
import { temTraco } from './tracos'

/** Área extra disponível em cada lado, em unidades da cena (px do projeto). */
export interface Sangria {
  top: number
  right: number
  bottom: number
  left: number
}

/** Distância (px da cena) para considerar que a camada encosta na borda. */
const TOLERANCIA = 1

function esticavel(c: Camada): boolean {
  if (c.parentId || c.hidden || c.maskId || Math.abs(c.rotation % 360) > 0.01) return false
  if (c.isMask) return false
  if (c.flipX || c.flipY) return c.type === 'shape' || c.type === 'frame'
  switch (c.type) {
    case 'shape':
      return c.shape === 'rect' && !c.radius && !temTraco(c)
    case 'frame':
      return !c.radius && !temTraco(c)
    case 'image':
      // sem recorte manual e sem máscara: com "cover" a foto só ganha mais área visível
      return c.fit === 'cover' && !c.crop && !c.radius && (c.mask ?? 'none') === 'none'
    case 'video':
      return c.fit === 'cover' && !c.radius
    default:
      return false
  }
}

/** Sangria a partir do encaixe da cena na tela (offsets em px de tela, escala da cena). */
export function sangriaDoEncaixe(offsetX: number, offsetY: number, escala: number): Sangria | undefined {
  if (escala <= 0) return undefined
  const h = Math.max(0, offsetX / escala)
  const v = Math.max(0, offsetY / escala)
  if (h < 0.5 && v < 0.5) return undefined
  return { top: v, right: h, bottom: v, left: h }
}

/** Estende até a borda da tela as camadas que encostam na borda da cena. Não altera as demais. */
export function sangrar(camadas: Camada[], tamanho: { width: number; height: number }, s: Sangria | undefined): Camada[] {
  if (!s || (!s.top && !s.right && !s.bottom && !s.left)) return camadas
  return camadas.map((c) => {
    if (!esticavel(c)) return c
    const esq = c.x <= TOLERANCIA && s.left > 0
    const dir = c.x + c.width >= tamanho.width - TOLERANCIA && s.right > 0
    const topo = c.y <= TOLERANCIA && s.top > 0
    const base = c.y + c.height >= tamanho.height - TOLERANCIA && s.bottom > 0
    if (!esq && !dir && !topo && !base) return c
    const x = esq ? -s.left : c.x
    const y = topo ? -s.top : c.y
    const x1 = dir ? tamanho.width + s.right : c.x + c.width
    const y1 = base ? tamanho.height + s.bottom : c.y + c.height
    return { ...c, x, y, width: x1 - x, height: y1 - y }
  })
}
