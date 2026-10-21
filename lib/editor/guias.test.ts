import { describe, expect, it } from 'vitest'
import { anguloRotacao, distribuir, encaixar, intersecta } from './guias'

const cena = { width: 1000, height: 500 }

describe('guias inteligentes', () => {
  it('encaixa no centro da tela', () => {
    const r = encaixar({ x: 447, y: 10, width: 100, height: 50 }, [], cena, 6)
    expect(r.x).toBe(450)
    expect(r.guias.some((g) => g.eixo === 'v' && g.pos === 500)).toBe(true)
  })
  it('encaixa a borda esquerda na borda de outra camada', () => {
    const outro = { x: 200, y: 300, width: 100, height: 100 }
    const r = encaixar({ x: 203, y: 40, width: 80, height: 40 }, [outro], cena, 6)
    expect(r.x).toBe(200)
    const g = r.guias.find((x) => x.eixo === 'v')!
    expect(g.pos).toBe(200)
    expect(g.de).toBe(40)
    expect(g.ate).toBe(400)
  })
  it('não encaixa fora do limiar', () => {
    const r = encaixar({ x: 120, y: 120, width: 10, height: 10 }, [], cena, 4)
    expect(r).toEqual({ x: 120, y: 120, guias: [] })
  })
  it('distribui espaçamento horizontal igual mantendo as pontas', () => {
    const d = distribuir([{ id: 'a', x: 0, y: 0, width: 100, height: 10 }, { id: 'b', x: 150, y: 0, width: 100, height: 10 }, { id: 'c', x: 600, y: 0, width: 100, height: 10 }], 'h')
    expect(d.map((c) => c.x)).toEqual([0, 300, 600])
  })
  it('intersecção para seleção por área', () => {
    expect(intersecta({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
    expect(intersecta({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 })).toBe(false)
  })
  it('ângulo de rotação com encaixe de 15°', () => {
    expect(anguloRotacao({ x: 0, y: 0 }, { x: 0, y: -10 }, false)).toBe(0)
    expect(anguloRotacao({ x: 0, y: 0 }, { x: 10, y: 0 }, false)).toBe(90)
    expect(anguloRotacao({ x: 0, y: 0 }, { x: 10, y: -9 }, true)).toBe(45)
  })
})
