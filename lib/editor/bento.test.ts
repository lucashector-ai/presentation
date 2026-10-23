import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { cartoesDoBento, gerarBento, PRESETS_BENTO } from './bento'

const rect = { x: 160, y: 120, width: 1376, height: 648 }

describe('bento grid como auto layout aninhado', () => {
  for (const p of PRESETS_BENTO) {
    it(`preset ${p.id}: frame externo + cartões na grade de 8, dentro do retângulo, sem sobreposição`, () => {
      const cs = gerarBento(rect, { preset: p.id, gap: 24, radius: 24, clip: true }, 'b')
      const [raiz, ...resto] = cs
      expect(raiz).toMatchObject({ type: 'frame', x: 160, y: 120, width: 1376, height: 648, clip: true })
      expect((raiz as { bento?: { preset: string } }).bento?.preset).toBe(p.id)
      for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
      for (const c of resto) expect(c.parentId).toBeTruthy()
      const cartoes = cartoesDoBento(raiz!.id, cs)
      expect(cartoes.length).toBeGreaterThanOrEqual(3)
      for (const k of cartoes) {
        expect(k.x % 8).toBe(0); expect(k.y % 8).toBe(0); expect(k.width % 8).toBe(0); expect(k.height % 8).toBe(0)
        expect(k.x).toBeGreaterThanOrEqual(rect.x); expect(k.y).toBeGreaterThanOrEqual(rect.y)
        expect(k.x + k.width).toBeLessThanOrEqual(rect.x + rect.width); expect(k.y + k.height).toBeLessThanOrEqual(rect.y + rect.height)
        expect((k as { clip?: boolean }).clip).toBe(true)
      }
      for (const a of cartoes) for (const b of cartoes) if (a !== b) {
        const sobre = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0
        expect(sobre).toBe(false)
      }
    })
  }
})
