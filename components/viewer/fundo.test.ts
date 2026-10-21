import { describe, expect, it } from 'vitest'
import { encaixar, fundoDaCena, gradienteEstendido, retanguloCover } from './fundo'
import { destinoSeguro, ehEditor, urlApresentar } from './retorno'
import type { Cena } from '@/lib/scene/schema'

const cena = (extra: Partial<Cena> = {}): Cena =>
  ({ id: 'c', title: '', size: { width: 1920, height: 1080 }, background: '#EEE7DB', backgroundFit: 'cover', layers: [], notes: '', ...extra }) as unknown as Cena

describe('encaixar', () => {
  it('ajustar mostra a cena inteira e centraliza (faixas em cima/embaixo em 16:10)', () => {
    const e = encaixar({ width: 1920, height: 1080 }, { width: 1440, height: 900 })
    expect(e.scale).toBeCloseTo(0.75)
    expect(e.offsetX).toBe(0)
    expect(e.offsetY).toBeCloseTo(45)
  })
  it('preencher cobre a tela cortando o mínimo', () => {
    const e = encaixar({ width: 1920, height: 1080 }, { width: 1440, height: 900 }, 'preencher')
    expect(e.scale).toBeCloseTo(900 / 1080)
    expect(e.offsetY).toBe(0)
    expect(e.offsetX).toBeCloseTo((1440 - 1600) / 2)
  })
})

describe('gradienteEstendido', () => {
  it('mesma área = mesmas paradas', () => {
    const g = { type: 'linear' as const, angle: 180, stops: [{ color: '#000', pos: 0 }, { color: '#fff', pos: 100 }] }
    expect(gradienteEstendido(g, { width: 100, height: 100 }, { width: 100, height: 100 })).toBe('linear-gradient(180deg, #000 0%, #fff 100%)')
  })
  it('área maior comprime as paradas em volta do centro (cores iguais dentro da cena)', () => {
    const g = { type: 'linear' as const, angle: 180, stops: [{ color: '#fff', pos: 100 }, { color: '#000', pos: 0 }] }
    // vertical: caixa 100 de altura numa área de 200 → paradas em 25% e 75%
    expect(gradienteEstendido(g, { width: 100, height: 100 }, { width: 100, height: 200 })).toBe('linear-gradient(180deg, #000 25%, #fff 75%)')
  })
  it('radial usa a meia diagonal', () => {
    const g = { type: 'radial' as const, angle: 0, stops: [{ color: '#000', pos: 0 }, { color: '#fff', pos: 100 }] }
    expect(gradienteEstendido(g, { width: 100, height: 100 }, { width: 200, height: 200 })).toBe('radial-gradient(circle at center, #000 0%, #fff 50%)')
  })
})

describe('fundoDaCena', () => {
  it('cor, gradiente e imagem de fundo', () => {
    expect(fundoDaCena(cena())).toEqual({ tipo: 'cor', cor: '#EEE7DB' })
    const g = { type: 'linear' as const, angle: 160, stops: [{ color: '#000', pos: 0 }, { color: '#fff', pos: 100 }] }
    expect(fundoDaCena(cena({ backgroundGradient: g })).tipo).toBe('gradiente')
    expect(fundoDaCena(cena({ backgroundAssetId: 'a1', backgroundGradient: g }))).toMatchObject({ tipo: 'imagem', assetId: 'a1', fit: 'cover' })
  })
  it('foto sangrada na camada mais ao fundo vira o fundo', () => {
    const foto = { id: 'f', type: 'image', assetId: 'img', x: -10, y: 0, width: 1940, height: 1080, z: 0, opacity: 1, rotation: 0, fit: 'cover', mask: 'none', radius: 0, interactions: [] }
    const texto = { id: 't', type: 'text', text: 'oi', x: 10, y: 10, width: 100, height: 40, z: 1, opacity: 1, rotation: 0, interactions: [] }
    expect(fundoDaCena(cena({ layers: [texto, foto] as never }))).toMatchObject({ tipo: 'imagem', assetId: 'img' })
    expect(fundoDaCena(cena({ layers: [{ ...foto, width: 900 }, texto] as never })).tipo).toBe('cor')
  })
})

it('retanguloCover passa da caixa no eixo cortado', () => {
  expect(retanguloCover({ x: 0, y: 0, width: 160, height: 90 }, { width: 400, height: 300 })).toEqual({ x: 0, y: -15, width: 160, height: 120 })
})

describe('retorno da apresentação', () => {
  it('aceita só caminhos internos', () => {
    expect(destinoSeguro('/app/projects/x/edit')).toBe('/app/projects/x/edit')
    expect(destinoSeguro('//evil.com')).toBeNull()
    expect(destinoSeguro('https://evil.com')).toBeNull()
    expect(destinoSeguro('/\\evil.com')).toBeNull()
    expect(destinoSeguro(null)).toBeNull()
  })
  it('monta a URL com a volta', () => {
    expect(urlApresentar('p1', { voltar: '/app/projects/p1/edit', inicio: 3 })).toBe('/app/projects/p1/apresentar?inicio=3&voltar=%2Fapp%2Fprojects%2Fp1%2Fedit')
    expect(urlApresentar('p1', { voltar: '/app', apresentador: true })).toBe('/app/projects/p1/apresentador?voltar=%2Fapp')
    expect(ehEditor('/app/projects/p1/edit?x=1', 'p1')).toBe(true)
    expect(ehEditor('/app/projects/p1', 'p1')).toBe(false)
  })
})
