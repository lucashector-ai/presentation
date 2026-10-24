import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { gerarMockup, MODELOS_MOCKUP } from './mockups'

describe('mockups (Blocos)', () => {
  for (const m of MODELOS_MOCKUP) {
    it(`${m.id}: frame externo na grade de 8 com meta, moldura e tela recortada dentro`, () => {
      const cs = gerarMockup(m.id, { x: 100, y: 100, largura: 400 }, {}, 'mk')
      const [raiz, ...resto] = cs
      expect(raiz).toMatchObject({ type: 'frame', x: 104, y: 104, width: 400 })
      for (const k of ['x', 'y', 'width', 'height'] as const) expect(raiz![k] % 8).toBe(0)
      expect((raiz as { mockup?: { modelo: string } }).mockup?.modelo).toBe(m.id)
      for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
      expect(resto.some((c) => c.type === 'svg')).toBe(true)
      const tela = resto.find((c) => c.type === 'frame' && c.name?.startsWith('Tela'))!
      expect(tela).toBeTruthy()
      expect((tela as { clip?: boolean }).clip).toBe(true)
      expect(tela.x).toBeGreaterThanOrEqual(raiz!.x); expect(tela.x + tela.width).toBeLessThanOrEqual(raiz!.x + raiz!.width)
      expect(tela.y).toBeGreaterThanOrEqual(raiz!.y); expect(tela.y + tela.height).toBeLessThanOrEqual(raiz!.y + raiz!.height)
    })
  }
})
