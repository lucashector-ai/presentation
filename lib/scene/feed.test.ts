import { describe, expect, it } from 'vitest'
import { gerarFeedInstagram } from '@/lib/editor/mockups'
import { migrarDocumento } from './migrar'
import { sincronizarDestaques } from './feed'
import type { Camada } from './schema'

const feed = () => gerarFeedInstagram({ x: 0, y: 0, largura: 960 }, {}, 'ig')
const foto = (cs: readonly Camada[], nome: string) => { const c = cs.find((l) => l.name === nome)! as { assetId?: string; fillImage?: { assetId: string } }; return c.assetId ?? c.fillImage?.assetId }

describe('sincronia post → destaque do feed', () => {
  it('a foto posta num post (pelo preenchimento) vai para o destaque dele', () => {
    const antes = feed()
    const depois = antes.map((c) => (c.name === 'Post 2' ? ({ ...c, fillImage: { assetId: 'x', fit: 'cover' } } as Camada) : c))
    const r = sincronizarDestaques(depois, antes)
    expect(foto(r, 'Destaque 2')).toBe('x')
    expect(foto(r, 'Destaque 1')).toBeUndefined()
    // nada mudou nos posts: a mesma lista
    expect(sincronizarDestaques(r, r)).toBe(r)
  })

  it('imagem filha de um post (feeds antigos) também vale, e ao abrir o documento o destaque sem foto recebe a do post', () => {
    const cs = feed()
    const post = cs.find((c) => c.name === 'Post 4')!
    const comFilha = [...cs, { ...post, id: 'img4', type: 'image', name: 'Imagem do post 4', parentId: post.id, assetId: 'y', interactions: [] } as unknown as Camada]
    const doc = migrarDocumento({ schemaVersion: 2, scenes: [{ id: 's', layers: comFilha }] }) as { scenes: { layers: Camada[] }[] }
    expect(foto(doc.scenes[0]!.layers, 'Destaque 4')).toBe('y')
  })
})
