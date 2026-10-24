import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { gerarFeedInstagram } from './mockups'

describe('feed do Instagram (Blocos)', () => {
  it('celular com tilt, perfil, destaques e 9 posts recortados em cascata', () => {
    const cs = gerarFeedInstagram({ x: 200, y: 80, largura: 400 }, { nome: 'Baderna', arroba: '@baderna' }, 'ig')
    for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
    const raiz = cs[0]!
    expect((raiz as { interactiveEffects?: { tilt?: unknown } }).interactiveEffects?.tilt).toBeTruthy()
    const tela = cs.find((c) => c.type === 'frame' && c.name?.startsWith('Tela'))!
    const posts = cs.filter((c) => c.type === 'frame' && c.name?.startsWith('Post'))
    expect(posts).toHaveLength(9)
    posts.forEach((p, i) => {
      expect(p.parentId).toBe(tela.id)
      expect((p as { clip?: boolean }).clip).toBe(true)
      expect(p.enterAnimation?.delay).toBe(120 * i)
      expect(p.x + p.width).toBeLessThanOrEqual(tela.x + tela.width + 1)
    })
    expect(cs.some((c) => c.type === 'text' && c.text === '@baderna')).toBe(true)
    expect(cs.some((c) => c.type === 'text' && c.text === 'Baderna')).toBe(true)
  })
})
