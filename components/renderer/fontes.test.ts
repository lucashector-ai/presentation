// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { carregarFontes, precisaCarregar, usoDasCenas, usoDosNomes } from './fontes'
import type { Cena } from '@/lib/scene/schema'

const texto = (fontFamily: string, fontWeight = 400, italic = false) => ({ type: 'text', fontFamily, fontWeight, italic }) as unknown as Cena['layers'][number]
const forma = { type: 'shape' } as unknown as Cena['layers'][number]

describe('carregamento das fontes usadas', () => {
  it('só famílias e variantes usadas pelos textos; locais e genéricas ficam de fora', () => {
    const uso = usoDasCenas([
      { layers: [texto('Playfair Display', 700), texto('Playfair Display', 400, true), texto('Geist', 600), forma] },
      { layers: [texto('Playfair Display', 700), texto('Inter', 500), texto('system-ui'), texto('sans-serif')] },
    ])
    expect([...uso.keys()].sort()).toEqual(['Inter', 'Playfair Display'])
    expect([...uso.get('Playfair Display')!].sort()).toEqual(['700', 'i400'])
    expect([...uso.get('Inter')!]).toEqual(['500'])
    expect(precisaCarregar('Geist Mono')).toBe(false)
    expect(precisaCarregar('Lobster')).toBe(true)
  })

  it('injeta uma folha da mesma origem por família e só pede variantes novas', () => {
    carregarFontes(usoDasCenas([{ layers: [texto('Playfair Display', 700), texto('Playfair Display', 400, true)] }]))
    carregarFontes(usoDasCenas([{ layers: [texto('Playfair Display', 700)] }])) // nada novo
    carregarFontes(usoDasCenas([{ layers: [texto('Playfair Display', 900), texto('Lobster')] }]))
    carregarFontes(usoDosNomes(['Geist', 'Bebas Neue']))
    const hrefs = [...document.querySelectorAll<HTMLLinkElement>('link[data-mostra-fonte]')].map((l) => decodeURIComponent(l.getAttribute('href')!.replace(/\+/g, ' ')))
    expect(hrefs).toEqual([
      '/fontes/css?f=Playfair Display:700,i400',
      '/fontes/css?f=Playfair Display:900',
      '/fontes/css?f=Lobster:400',
      '/fontes/css?f=Bebas Neue:400,700',
    ])
    expect(hrefs.every((h) => !h.includes('googleapis'))).toBe(true)
  })
})
