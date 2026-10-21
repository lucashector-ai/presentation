import { describe, expect, it } from 'vitest'
import { parseCamada, type Camada } from './schema'
import { costurar } from './costura'

const rect = (id: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) => parseCamada({ id, z: 0, type: 'shape', shape: 'rect', x, y, width: w, height: h, fill: '#5965F2', ...extra }) as Camada

describe('costura', () => {
  it('a caixa de baixo avança 1 px de tela sob a vizinha colada à direita', () => {
    const [a, b] = costurar([rect('a', 0, 0, 733.33, 1080), rect('b', 733.33, 0, 296.67, 1080)], 1.25)
    expect(a).toMatchObject({ x: 0, width: 733.33 + 1.25 })
    expect(b).toMatchObject({ x: 733.33, width: 296.67 })
  })
  it('funciona também quando a de baixo está à direita e embaixo', () => {
    const [a] = costurar([rect('a', 500, 0, 500, 500), rect('b', 0, 0, 500, 500), ], 2)
    expect(a).toMatchObject({ x: 498, width: 502 })
    const [c] = costurar([rect('c', 0, 300, 400, 300), rect('d', 0, 0, 400, 300)], 2)
    expect(c).toMatchObject({ y: 298, height: 302 })
  })
  it('não mexe em caixas separadas, translúcidas ou arredondadas', () => {
    const l = [rect('a', 0, 0, 100, 100), rect('b', 110, 0, 100, 100)]
    expect(costurar(l, 1)).toBe(l)
    const t = [rect('a', 0, 0, 100, 100, { opacity: 0.5 }), rect('b', 100, 0, 100, 100)]
    expect(costurar(t, 1)).toBe(t)
    const r = [rect('a', 0, 0, 100, 100, { radius: 8 }), rect('b', 100, 0, 100, 100)]
    expect(costurar(r, 1)).toBe(r)
    const alfa = [rect('a', 0, 0, 100, 100), rect('b', 100, 0, 100, 100, { fill: '#5965F280' })]
    expect(costurar(alfa, 1)).toBe(alfa)
  })
})
