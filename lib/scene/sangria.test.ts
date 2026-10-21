import { describe, expect, it } from 'vitest'
import { parseCamada, type Camada } from './schema'
import { sangrar, sangriaDoEncaixe } from './sangria'

const T = { width: 1920, height: 1080 }
const S = { top: 60, right: 0, bottom: 60, left: 0 }
const camada = (c: Record<string, unknown>) => parseCamada({ id: 'c', z: 0, ...c }) as Camada

describe('sangria', () => {
  it('calcula a área extra a partir do encaixe', () => {
    expect(sangriaDoEncaixe(0, 45, 0.75)).toEqual({ top: 60, right: 0, bottom: 60, left: 0 })
    expect(sangriaDoEncaixe(0, 0, 1)).toBeUndefined()
    expect(sangriaDoEncaixe(-10, -10, 1)).toBeUndefined()
  })
  it('estende retângulo que encosta em cima e embaixo', () => {
    const [r] = sangrar([camada({ type: 'shape', shape: 'rect', x: 0, y: 0, width: 1030, height: 1080 })], T, S)
    expect(r).toMatchObject({ x: 0, y: -60, width: 1030, height: 1200 })
  })
  it('estende só os lados que encostam', () => {
    const [r] = sangrar([camada({ type: 'shape', shape: 'rect', x: 100, y: 0, width: 200, height: 500 })], T, S)
    expect(r).toMatchObject({ y: -60, height: 560 })
  })
  it('não estica texto, elipse, forma arredondada, girada ou dentro de frame', () => {
    const intocadas = [
      camada({ type: 'text', text: 'Oi', x: 0, y: 0, width: 400, height: 1080 }),
      camada({ type: 'shape', shape: 'ellipse', x: 0, y: 0, width: 1080, height: 1080 }),
      camada({ type: 'shape', shape: 'rect', radius: 12, x: 0, y: 0, width: 400, height: 1080 }),
      camada({ type: 'shape', shape: 'rect', rotation: 5, x: 0, y: 0, width: 400, height: 1080 }),
      camada({ type: 'shape', shape: 'rect', parentId: 'f', x: 0, y: 0, width: 400, height: 1080 }),
    ]
    const r = sangrar(intocadas, T, S)
    r.forEach((c, i) => expect(c).toBe(intocadas[i]))
  })
  it('sem sangria devolve a mesma lista', () => {
    const l = [camada({ type: 'shape', shape: 'rect', x: 0, y: 0, width: 10, height: 10 })]
    expect(sangrar(l, T, undefined)).toBe(l)
  })
})
