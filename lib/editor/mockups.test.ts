import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { gerarMockup, MODELOS_MOCKUP } from './mockups'

describe('mockups (Blocos)', () => {
  for (const m of MODELOS_MOCKUP) {
    it(`${m.id}: frame externo com meta, tela recortada dentro e tudo na grade de 8`, () => {
      const cs = gerarMockup(m.id, { x: 100, y: 100, largura: 400 }, {}, 'mk')
      const [raiz, ...resto] = cs
      expect(raiz).toMatchObject({ type: 'frame', x: 104, y: 104, width: 400 })
      expect((raiz as { mockup?: { modelo: string } }).mockup?.modelo).toBe(m.id)
      for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
      for (const c of resto) expect(c.parentId).toBe(raiz!.id)
      const tela = resto.find((c) => c.type === 'frame' && c.name?.startsWith('Tela'))!
      expect(tela).toBeTruthy()
      expect((tela as { clip?: boolean }).clip).toBe(true)
      expect(tela.x).toBeGreaterThanOrEqual(raiz!.x); expect(tela.x + tela.width).toBeLessThanOrEqual(raiz!.x + raiz!.width)
      expect(tela.y).toBeGreaterThanOrEqual(raiz!.y); expect(tela.y + tela.height).toBeLessThanOrEqual(raiz!.y + raiz!.height)
      for (const c of [raiz!, tela]) { expect(c.x % 8).toBe(0); expect(c.y % 8).toBe(0); expect(c.width % 8).toBe(0); expect(c.height % 8).toBe(0) }
    })
  }
})
