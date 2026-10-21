import { describe, expect, it } from 'vitest'
import { parseCamada, type Camada } from '@/lib/scene/schema'
import { comCanto, comRaio, raioUnico, raiosDe } from './raios'

const forma = (extra: Record<string, unknown> = {}) => parseCamada({ id: 'r', type: 'shape', x: 0, y: 0, width: 100, height: 100, radius: 8, ...extra })
const texto = () => parseCamada({ id: 't', type: 'text', text: 'oi', x: 0, y: 0, width: 100, height: 40, radius: 4 })

describe('cantos independentes', () => {
  it('raio único vira 4 cantos iguais', () => {
    expect(raiosDe(forma())).toEqual([8, 8, 8, 8])
    expect(raioUnico(forma())).toBe(8)
  })
  it('mudar um canto grava radii e radius = maior canto (compatível com renderizadores antigos)', () => {
    const c = comCanto(forma(), 0, 32) as Camada & { radius: number; radii?: number[] }
    expect(c.radii).toEqual([32, 8, 8, 8])
    expect(c.radius).toBe(32)
    expect(raioUnico(c)).toBeNull()
    expect(() => parseCamada(c)).not.toThrow()
  })
  it('quatro cantos iguais voltam a ser raio único', () => {
    const c = comCanto(forma({ radii: [8, 8, 8, 0] }), 3, 8) as Camada & { radii?: number[] }
    expect(c.radii).toBeUndefined()
    expect(raioUnico(c)).toBe(8)
  })
  it('raio único limpa os cantos e limita a 0–999', () => {
    const c = comRaio(forma({ radii: [1, 2, 3, 4] }), 2000) as Camada & { radius: number; radii?: number[] }
    expect(c.radii).toBeUndefined()
    expect(c.radius).toBe(999)
  })
  it('texto (fundo da caixa) também aceita cantos independentes', () => {
    const c = comCanto(texto(), 1, 12) as Camada & { radius: number; radii?: number[] }
    expect(c.radius).toBe(12)
    expect(c.radii).toEqual([4, 12, 4, 4])
    expect(() => parseCamada(c)).not.toThrow()
  })
  it('hotspot e SVG não têm raio: comCanto não muda nada', () => {
    const h = parseCamada({ id: 'h', type: 'hotspot', ariaLabel: 'x', x: 0, y: 0, width: 10, height: 10 })
    expect(comCanto(h, 0, 5)).toBe(h)
  })
  it('documentos antigos (sem radii) continuam válidos', () => {
    expect((forma() as Camada & { radii?: unknown }).radii).toBeUndefined()
    expect(() => parseCamada({ id: 'f', type: 'frame', x: 0, y: 0, width: 10, height: 10, radii: [1, 2, 3, 4] })).not.toThrow()
    expect(() => parseCamada({ id: 'f', type: 'frame', x: 0, y: 0, width: 10, height: 10, radii: [1, 2, 3] })).toThrow()
  })
})
