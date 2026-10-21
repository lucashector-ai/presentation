import { describe, expect, it } from 'vitest'
import { avancarUm, enviarParaTras, moverItem, normalizarZ, novoId, trazerParaFrente } from './order'
import type { Camada } from './schema'

const c = (id: string, z: number): Camada => ({ id, type: 'shape', shape: 'rect', fill: '#000', strokeWidth: 0, radius: 0, shadow: false, x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, z, locked: false, hidden: false })

describe('ordem', () => {
  it('moverItem reordena e tolera índices fora da faixa', () => {
    expect(moverItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(moverItem([1, 2, 3], 2, 99)).toEqual([1, 2, 3])
    expect(moverItem([1, 2, 3], 9, 0)).toEqual([1, 2, 3])
  })
  it('normalizarZ deixa 0..n-1 preservando ordem', () => {
    expect(normalizarZ([c('a', 10), c('b', -3), c('c', 10)]).map((x) => [x.id, x.z])).toEqual([['b', 0], ['a', 1], ['c', 2]])
  })
  it('trazerParaFrente / enviarParaTras', () => {
    const base = [c('a', 0), c('b', 1), c('c', 2)]
    expect(trazerParaFrente(base, 'a').map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(enviarParaTras(base, 'c').map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(avancarUm(base, 'a').map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
  it('novoId evita colisões', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 200; i++) ids.add(novoId('cena', Array.from(ids, (id) => ({ id }))))
    expect(ids.size).toBe(200)
  })
})
