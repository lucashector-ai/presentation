import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { gerarFeedInstagram } from './mockups'
import { aplicarFotoFeed, fotosDoFeed, lugarNoPonto } from './feedFotos'

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

describe('fotos do feed', () => {
  const cs = gerarFeedInstagram({ x: 0, y: 0, largura: 960 }, { imagens: [{ id: 'a1' }] }, 'ig')
  const raiz = cs[0]!
  const por = (n: string) => cs.find((c) => c.name === n)!

  it('foto do perfil e capas dos destaques são camadas redondas; a grade usa o preenchimento do frame', () => {
    expect(por('Foto do perfil')).toMatchObject({ type: 'shape', shape: 'ellipse' })
    expect(por('Foto do perfil').width).toBe(por('Foto do perfil').height)
    for (let i = 1; i <= 4; i++) expect(por(`Capa do destaque ${i}`)).toMatchObject({ type: 'shape', shape: 'ellipse' })
    expect(por('Post 1')).toMatchObject({ fillImage: { assetId: 'a1', fit: 'cover' } })
    expect(cs.some((c) => c.name?.startsWith('Imagem do post'))).toBe(false)
    const lugares = fotosDoFeed(raiz.id, cs)
    expect(lugares.map((f) => f.chave)).toEqual(['perfil', 'destaque-1', 'destaque-2', 'destaque-3', 'destaque-4', ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `post-${i}`)])
    expect(lugares.find((f) => f.chave === 'post-1')!.assetId).toBe('a1')
    expect(lugares.find((f) => f.chave === 'destaque-1')!.rotulo).toBe('Coleção')
  })

  it('a foto do post vai para a grade e para o destaque grande; a do perfil esconde as iniciais', () => {
    const post = aplicarFotoFeed(raiz.id, cs, { tipo: 'post', i: 3 }, 'b2')
    expect(post.map((c) => c.name).sort()).toEqual(['Destaque 3', 'Post 3'])
    for (const c of post) expect((c as { fillImage?: { assetId: string } }).fillImage?.assetId).toBe('b2')
    const perfil = aplicarFotoFeed(raiz.id, cs, { tipo: 'perfil' }, 'c3')
    expect(perfil.filter((c) => c.type === 'shape').map((c) => c.name).sort()).toEqual(['Foto do perfil', 'Foto do perfil no post'])
    expect(perfil.filter((c) => c.type === 'text').every((c) => c.hidden)).toBe(true)
    const sem = aplicarFotoFeed(raiz.id, cs, { tipo: 'perfil' }, null)
    expect(sem.filter((c) => c.type === 'text').every((c) => !c.hidden)).toBe(true)
  })

  it('acha o lugar de foto sob o ponto (destaque grande e célula da grade)', () => {
    const p3 = por('Post 3')
    expect(lugarNoPonto(cs, { x: p3.x + 2, y: p3.y + 2 })).toMatchObject({ lugar: { tipo: 'post', i: 3 } })
    const d1 = por('Destaque 1')
    expect(lugarNoPonto(cs, { x: d1.x + 10, y: d1.y + 10 })).toMatchObject({ lugar: { tipo: 'post', i: 1 } })
    expect(lugarNoPonto(cs, { x: -50, y: -50 })).toBeNull()
  })
})
