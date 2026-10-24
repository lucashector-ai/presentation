import { describe, expect, it } from 'vitest'
import { novaCena } from '@/lib/scene/schema'
import { arranjar } from './mapaExplorar'

const cenas = Array.from({ length: 4 }, (_, i) => novaCena({ id: `t${i}`, size: { width: 1920, height: 1080 } }))

describe('arranjos do mapa', () => {
  it('linha, coluna, grade e zigue-zague', () => {
    expect(arranjar(cenas, 'linha').map((p) => p.y)).toEqual([0, 0, 0, 0])
    expect(arranjar(cenas, 'coluna').map((p) => p.x)).toEqual([0, 0, 0, 0])
    expect(arranjar(cenas, 'grade')[2]).toEqual({ x: 0, y: 1440 })
    // zigue-zague: a segunda linha volta da direita para a esquerda
    expect(arranjar(cenas, 'zigue').map((p) => p.x)).toEqual([0, 2280, 2280, 0])
  })
})
