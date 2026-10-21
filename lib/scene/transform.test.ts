import { describe, expect, it } from 'vitest'
import { alinhar, calcularEncaixe, camadaNoPonto, enquadrarNaCena, paraCena, paraViewport, redimensionar, snap } from './transform'
import { parseCena } from './schema'

describe('encaixe proporcional', () => {
  it('encaixa 16:9 em viewport mais largo centralizando horizontalmente', () => {
    const e = calcularEncaixe({ width: 1920, height: 1080 }, { width: 2000, height: 1000 })
    expect(e.scale).toBeCloseTo(1000 / 1080)
    expect(e.height).toBeCloseTo(1000)
    expect(e.offsetY).toBeCloseTo(0)
    expect(e.offsetX).toBeGreaterThan(0)
  })

  it('respeita margem de segurança', () => {
    const e = calcularEncaixe({ width: 1000, height: 1000 }, { width: 500, height: 500 }, 50)
    expect(e.width).toBe(400)
    expect(e.offsetX).toBe(50)
  })

  it('paraCena e paraViewport são inversas', () => {
    const e = calcularEncaixe({ width: 1920, height: 1080 }, { width: 960, height: 600 })
    const r = { x: 240, y: 180, width: 920, height: 620 }
    const v = paraViewport(r, e)
    const volta = paraCena({ x: v.x, y: v.y }, e)
    expect(volta.x).toBeCloseTo(240)
    expect(volta.y).toBeCloseTo(180)
  })
})

describe('redimensionar', () => {
  const r = { x: 100, y: 100, width: 200, height: 100 }
  it('alça leste aumenta largura', () => {
    expect(redimensionar(r, 'e', 50, 0)).toEqual({ x: 100, y: 100, width: 250, height: 100 })
  })
  it('alça noroeste move origem', () => {
    expect(redimensionar(r, 'nw', 20, 10)).toEqual({ x: 120, y: 110, width: 180, height: 90 })
  })
  it('proporcional mantém razão pelo canto', () => {
    const n = redimensionar(r, 'se', 100, 0, true)
    expect(n.width / n.height).toBeCloseTo(2)
  })
  it('não deixa tamanho abaixo do mínimo', () => {
    const n = redimensionar(r, 'w', 500, 0)
    expect(n.width).toBe(8)
    expect(n.x).toBe(292)
  })
})

describe('alinhar e snap', () => {
  it('uma camada alinha em relação à cena', () => {
    const [c] = alinhar([{ x: 0, y: 0, width: 100, height: 50 }], { width: 1000, height: 500 }, 'centroH')
    expect(c?.x).toBe(450)
  })
  it('várias camadas alinham pela caixa envolvente', () => {
    const r = alinhar([{ x: 0, y: 0, width: 100, height: 50 }, { x: 300, y: 100, width: 100, height: 50 }], { width: 1000, height: 500 }, 'direita')
    expect(r.map((c) => c.x)).toEqual([300, 300])
  })
  it('snap arredonda para a grade', () => {
    expect(snap(13, 8)).toBe(16)
    expect(snap(13, 8, false)).toBe(13)
  })
})

describe('seleção por ponto e enquadramento', () => {
  it('camadaNoPonto prefere maior z', () => {
    const cena = parseCena({
      id: 'a',
      size: { width: 100, height: 100 },
      layers: [
        { id: 'baixo', type: 'shape', x: 0, y: 0, width: 100, height: 100, z: 0 },
        { id: 'cima', type: 'shape', x: 10, y: 10, width: 20, height: 20, z: 5 },
      ],
    })
    expect(camadaNoPonto(cena, { x: 15, y: 15 })?.id).toBe('cima')
    expect(camadaNoPonto(cena, { x: 80, y: 80 })?.id).toBe('baixo')
  })
  it('enquadrarNaCena centraliza mídia 1:1 em 16:9', () => {
    const r = enquadrarNaCena({ width: 1000, height: 1000 }, { width: 1920, height: 1080 })
    expect(r.width).toBe(1080)
    expect(r.x).toBe(420)
  })
})
