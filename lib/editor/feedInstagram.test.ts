import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { gerarFeedInstagram } from './mockups'

describe('feed do Instagram (Blocos)', () => {
  it('post em destaque grande + celular com tilt, perfil e 9 posts que trocam o destaque', () => {
    const cs = gerarFeedInstagram({ x: 200, y: 80, largura: 960 }, { nome: 'Baderna', arroba: '@baderna' }, 'ig')
    for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
    const raiz = cs[0]!
    expect(raiz.type).toBe('frame')
    expect(cs.some((c) => c.name === 'Post em destaque')).toBe(true)
    expect(cs.filter((c) => c.name?.startsWith('Destaque ')).length).toBe(9)
    const celular = cs.find((c) => (c as { interactiveEffects?: { tilt?: unknown } }).interactiveEffects?.tilt)
    expect(celular).toBeTruthy()
    const posts = cs.filter((c) => c.type === 'frame' && /^Post \d/.test(c.name ?? ''))
    expect(posts).toHaveLength(9)
    posts.forEach((p, i) => {
      expect((p as { clip?: boolean }).clip).toBe(true)
      expect(p.enterAnimation?.delay).toBe(360 + 70 * i)
      expect(p.interactions.length).toBeGreaterThan(0)
    })
    expect(cs.some((c) => c.type === 'text' && c.text === '@baderna')).toBe(true)
    expect(cs.some((c) => c.type === 'text' && c.text === 'Baderna')).toBe(true)
  })
})
