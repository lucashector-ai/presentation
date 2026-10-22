import { describe, expect, it } from 'vitest'
import bruto from './catalogo-google.json'
import { buscarFontes, mapearFonte, montarCatalogo, pesoMaisProximo, pesosDisponiveis, suportaPortugues, varianteReal, type CatalogoBruto } from './catalogo'
import { FONTES_APRESENTACAO } from '@/lib/design-tokens'

const cat = montarCatalogo(bruto as unknown as CatalogoBruto)
const nomes = (fs: { familia: string }[]) => fs.map((f) => f.familia)

describe('catálogo do Google Fonts', () => {
  it('tem o catálogo completo, todas com português (latin) e as fontes locais do app', () => {
    expect(cat.fontes.length).toBeGreaterThan(1800)
    expect(cat.fontes.every(suportaPortugues)).toBe(true)
    for (const f of ['Geist', 'Geist Mono', 'Georgia', 'system-ui']) expect(cat.porNome.get(f)?.origem).toBe('local')
    // toda a biblioteca curada continua no catálogo
    for (const f of FONTES_APRESENTACAO) expect(cat.porNome.has(f), f).toBe(true)
  })

  it('variantes: faixa variável, lista estática e itálico', () => {
    const playfair = cat.porNome.get('Playfair Display')!
    expect(playfair.categoria).toBe('serif')
    expect(playfair.pesos).toEqual({ tipo: 'faixa', min: 400, max: 900 })
    expect(playfair.italico).toEqual({ tipo: 'faixa', min: 400, max: 900 })
    expect(pesosDisponiveis(playfair.pesos)).toEqual([400, 500, 600, 700, 800, 900])
    const bebas = cat.porNome.get('Bebas Neue')!
    expect(bebas.pesos).toEqual({ tipo: 'lista', valores: [400] })
    expect(bebas.italico).toBeNull()
    expect(cat.porNome.get('Fira Code')!.categoria).toBe('mono')
    expect(cat.porNome.get('Caveat')!.categoria).toBe('manuscrita')
    expect(cat.porNome.get('Lobster')!.categoria).toBe('display')
  })

  it('peso mais próximo e variante real', () => {
    expect(pesoMaisProximo({ tipo: 'lista', valores: [300, 400, 700] }, 500)).toBe(400)
    expect(pesoMaisProximo({ tipo: 'lista', valores: [300, 400, 700] }, 600)).toBe(700)
    expect(pesoMaisProximo({ tipo: 'lista', valores: [300, 500] }, 400)).toBe(500) // como o CSS: 400 procura 500 antes
    expect(pesoMaisProximo({ tipo: 'lista', valores: [200, 400] }, 300)).toBe(200) // empate abaixo de 400: mais leve
    expect(pesoMaisProximo({ tipo: 'lista', valores: [400, 600] }, 500)).toBe(600) // empate acima: mais pesado
    expect(pesoMaisProximo({ tipo: 'faixa', min: 400, max: 900 }, 300)).toBe(400)
    const bebas = cat.porNome.get('Bebas Neue')!
    expect(varianteReal(bebas, 700, true)).toEqual({ peso: 400, italico: false })
  })
})

describe('busca e filtro', () => {
  it('busca por nome sem acento nem caixa, com o exato e os prefixos primeiro', () => {
    expect(nomes(buscarFontes(cat.fontes, 'playfair')).slice(0, 2)).toEqual(['Playfair', 'Playfair Display'])
    expect(nomes(buscarFontes(cat.fontes, 'Playfair Display'))[0]).toBe('Playfair Display')
    expect(nomes(buscarFontes(cat.fontes, 'PLAYFAIR disp'))[0]).toBe('Playfair Display')
    expect(nomes(buscarFontes(cat.fontes, 'playfairdisplay'))).toContain('Playfair Display')
    expect(nomes(buscarFontes(cat.fontes, 'inter'))[0]).toBe('Inter')
    // palavra do meio do nome
    expect(nomes(buscarFontes(cat.fontes, 'display'))).toContain('Playfair Display')
    expect(buscarFontes(cat.fontes, 'zzzz-não-existe')).toEqual([])
  })

  it('filtra por categoria (com e sem busca)', () => {
    const mono = buscarFontes(cat.fontes, '', 'mono')
    expect(mono.length).toBeGreaterThan(40)
    expect(mono.every((f) => f.categoria === 'mono')).toBe(true)
    expect(nomes(mono)).toContain('Geist Mono')
    expect(nomes(buscarFontes(cat.fontes, 'playfair', 'sans'))).not.toContain('Playfair Display')
    expect(nomes(buscarFontes(cat.fontes, 'playfair', 'serif'))).toContain('Playfair Display')
    const somadas = (['sans', 'serif', 'display', 'manuscrita', 'mono'] as const).reduce((n, c) => n + buscarFontes(cat.fontes, '', c).length, 0)
    expect(somadas).toBe(cat.fontes.length)
  })
})

describe('nomes vindos do Figma e de SVG', () => {
  it('mapeia família, nome PostScript e pilha CSS para o catálogo', () => {
    expect(mapearFonte(cat, 'Playfair Display')).toEqual({ familia: 'Playfair Display' })
    expect(mapearFonte(cat, 'playfair display')).toEqual({ familia: 'Playfair Display' })
    expect(mapearFonte(cat, 'PlayfairDisplay-BoldItalic')).toEqual({ familia: 'Playfair Display', peso: 700, italico: true })
    expect(mapearFonte(cat, 'Montserrat-SemiBold')).toEqual({ familia: 'Montserrat', peso: 600 })
    expect(mapearFonte(cat, 'RobotoMono-Regular')).toEqual({ familia: 'Roboto Mono', peso: 400 })
    expect(mapearFonte(cat, "'Inter Variable', Inter, sans-serif")).toEqual({ familia: 'Inter' })
    expect(mapearFonte(cat, 'DMSans-Medium')).toEqual({ familia: 'DM Sans', peso: 500 })
    expect(mapearFonte(cat, 'Helvetica Neue')).toBeNull()
    expect(mapearFonte(cat, 'SF Pro Display')).toBeNull()
  })
})
