import { describe, expect, it } from 'vitest'
import { contraste } from '@/lib/ia/designSystem'
import { legivel, mapaDaMarca, mapaUmaCor, recolorDoLogo, regraLogoDoPedido } from './logo'

const ESCURO = '#0e1726'
const CLARO = '#f6f5f2'
// logo: selo azul (mais usado) com o nome vazado em branco e um detalhe laranja
const LOGO = ['#1e5bd8', '#ffffff', '#f28c28']
const MARCA = ['#0B4F8A', '#16A765', '#0E1726']

describe('cores do logo SVG', () => {
  it('nas cores da marca: matizes viram as cores da identidade na ordem; o branco vazado fica', () => {
    const m = mapaDaMarca(LOGO, MARCA)
    expect(m['#1e5bd8']).toBe('#0b4f8a')
    expect(m['#f28c28']).toBe('#16a765')
    expect(m['#ffffff']).toBeUndefined()
    // um fundo quase preto da identidade não entra como cor viva
    expect(mapaDaMarca(LOGO, ['#0B4F8A', '#0E1726', '#16A765'])['#f28c28']).toBe('#16a765')
  })

  it('uma cor só preserva os detalhes vazados com a cor do fundo', () => {
    const m = mapaUmaCor(LOGO, '#ffffff', ESCURO)
    expect(m['#1e5bd8']).toBe('#ffffff')
    expect(m['#ffffff']).toBe(ESCURO)
  })

  it('nunca some no fundo: "branco" pedido num fundo claro vira a cor escura da marca', () => {
    const m = recolorDoLogo({ regra: { modo: 'mono', cor: '#ffffff' }, cores: LOGO, fundo: CLARO, marca: MARCA })
    expect(legivel(LOGO, m, CLARO)).toBe(true)
    expect(contraste(m['#1e5bd8']!, CLARO)).toBeGreaterThanOrEqual(4.5)
  })

  it('automático: original onde lê; no fundo da mesma cor, outra versão que contrasta', () => {
    expect(recolorDoLogo({ regra: { modo: 'auto' }, cores: LOGO, fundo: CLARO, marca: MARCA })).toEqual({})
    const noAzul = recolorDoLogo({ regra: { modo: 'auto' }, cores: LOGO, fundo: '#1e5bd8', marca: MARCA })
    expect(legivel(LOGO, noAzul, '#1e5bd8')).toBe(true)
    // logo preto num fundo escuro: vira branco
    const preto = recolorDoLogo({ regra: { modo: 'original' }, cores: ['#000000'], fundo: ESCURO, marca: [] })
    expect(preto['#000000']).toBe('#ffffff')
  })

  it('lê a regra do logo no pedido', () => {
    expect(regraLogoDoPedido('Use o logo em branco nas capas.')?.regra).toEqual({ modo: 'mono', cor: '#ffffff' })
    expect(regraLogoDoPedido('O logotipo deve seguir as cores da nova identidade.')?.regra).toEqual({ modo: 'marca' })
    expect(regraLogoDoPedido('Manter o logo original, sem alterar.')?.regra).toEqual({ modo: 'original' })
    expect(regraLogoDoPedido('Logo na cor #0B4F8A em tudo')?.regra).toEqual({ modo: 'mono', cor: '#0b4f8a' })
    expect(regraLogoDoPedido('Relatório trimestral com gráficos')).toBeNull()
  })
})
