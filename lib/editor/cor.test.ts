import { describe, expect, it } from 'vitest'
import { alfaDe, comAlfa, corNoGradiente, coresUsadas, hex6, hexParaRgba, hslParaRgb, hsvParaHsl, hsvParaRgb, lerCor, mesmaCor, normalizarHex, rgbParaHsl, rgbParaHsv, rgbaParaHex, hslParaHsv } from './cor'

describe('hex', () => {
  it('lê formatos curtos e longos', () => {
    expect(hexParaRgba('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(hexParaRgba('5965F2')).toEqual({ r: 89, g: 101, b: 242, a: 1 })
    expect(hexParaRgba('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 0.502 })
    expect(hexParaRgba('#0008')?.a).toBeCloseTo(0.533, 2)
    // atalhos do Figma: 1 e 2 dígitos repetem
    expect(hexParaRgba('#12')).toEqual({ r: 18, g: 18, b: 18, a: 1 })
    expect(hexParaRgba('F')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(hexParaRgba('0')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
    expect(hexParaRgba('#GGGGGG')).toBeNull()
  })
  it('escreve opaco sem alfa e transparente com alfa', () => {
    expect(rgbaParaHex({ r: 89, g: 101, b: 242, a: 1 })).toBe('#5965F2')
    expect(rgbaParaHex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('#00000080')
    expect(rgbaParaHex({ r: 300, g: -4, b: 10.4, a: 1 })).toBe('#FF000A')
  })
  it('helpers de alfa e normalização', () => {
    expect(hex6('#d9d9d9')).toBe('D9D9D9')
    expect(alfaDe('#0000004D')).toBeCloseTo(0.302, 2)
    expect(comAlfa('#5965F2', 0.5)).toBe('#5965F280')
    expect(comAlfa('#5965F280', 1)).toBe('#5965F2')
    expect(normalizarHex('#abc')).toBe('#AABBCC')
    expect(mesmaCor('#abc', '#AABBCC')).toBe(true)
    expect(mesmaCor('#abc', undefined)).toBe(false)
  })
})

describe('modelos de cor', () => {
  it('rgb ↔ hsv ida e volta', () => {
    for (const hex of ['#5965F2', '#E4572E', '#171717', '#FFFFFF', '#D7F25C', '#2E3A2C']) {
      const c = hexParaRgba(hex)!
      expect(rgbaParaHex({ ...hsvParaRgb(rgbParaHsv(c)), a: 1 })).toBe(hex)
      expect(rgbaParaHex({ ...hslParaRgb(rgbParaHsl(c)), a: 1 })).toBe(hex)
    }
  })
  it('valores conhecidos', () => {
    expect(rgbParaHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, v: 100 })
    expect(hsvParaRgb({ h: 120, s: 100, v: 100 })).toEqual({ r: 0, g: 255, b: 0 })
    expect(hsvParaRgb({ h: 360, s: 100, v: 100 })).toEqual({ r: 255, g: 0, b: 0 })
    const hsl = rgbParaHsl({ r: 89, g: 101, b: 242 })
    expect(Math.round(hsl.h)).toBe(235)
    expect(Math.round(hsl.s)).toBe(85)
    expect(Math.round(hsl.l)).toBe(65)
  })
  it('hsv ↔ hsl', () => {
    const hsl = hsvParaHsl({ h: 200, s: 50, v: 80 })
    const hsv = hslParaHsv(hsl)
    expect(hsv.s).toBeCloseTo(50, 5)
    expect(hsv.v).toBeCloseTo(80, 5)
    expect(hsvParaHsl({ h: 0, s: 0, v: 0 }).l).toBe(0)
  })
})

describe('lerCor', () => {
  it('aceita hex, rgb(), rgba() e hsl()', () => {
    expect(lerCor(' 5965f2 ')).toEqual({ r: 89, g: 101, b: 242, a: 1 })
    expect(lerCor('rgb(89, 101, 242)')).toEqual({ r: 89, g: 101, b: 242, a: 1 })
    expect(lerCor('rgba(0 0 0 / 50%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(lerCor('rgba(10,20,30,.25)')?.a).toBe(0.25)
    expect(rgbaParaHex(lerCor('hsl(0 100% 50%)')!)).toBe('#FF0000')
    expect(lerCor('azul')).toBeNull()
    expect(lerCor('rgb(1,2)')).toBeNull()
  })
})

describe('gradiente', () => {
  const paradas = [{ color: '#000000', pos: 0 }, { color: '#FFFFFF', pos: 100 }]
  it('interpola no meio e prende nas pontas', () => {
    expect(corNoGradiente(paradas, 50)).toBe('#808080')
    expect(corNoGradiente(paradas, -10)).toBe('#000000')
    expect(corNoGradiente(paradas, 120)).toBe('#FFFFFF')
    expect(corNoGradiente([{ color: '#FF000000', pos: 0 }, { color: '#FF0000', pos: 100 }], 50)).toBe('#FF000080')
  })
})

describe('coresUsadas', () => {
  it('coleta sem repetir e ignora transparentes', () => {
    const cenas = [
      { background: '#FAFAF9', layers: [{ fill: '#5965f2' }, { color: '#171717', background: '#5965F2' }, { fill: '#00000000' }] },
      { background: '#fafaf9', backgroundGradient: { stops: [{ color: '#E4572E', pos: 0 }, { color: '#171717', pos: 100 }] }, layers: [{ effects: { shadow: { color: '#0000004D' } } }, { recolor: { '#000000': '#D7F25C' } }] },
    ]
    expect(coresUsadas(cenas)).toEqual(['#FAFAF9', '#5965F2', '#171717', '#E4572E', '#0000004D', '#D7F25C'])
  })
})
