import { describe, expect, it } from 'vitest'
import { JANELA_DIGITOS_MS, atalhoFigma, caixaDeLinha, opacidadePorDigito, type TeclaPressionada } from './atalhos'

const t = (key: string, code: string, m: Partial<TeclaPressionada> = {}): TeclaPressionada => ({ key, code, shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, ...m })

describe('atalhos do Figma', () => {
  it('⌥A/D/W/S/H/V alinham (pelo code: no Mac ⌥A gera "å")', () => {
    expect(atalhoFigma(t('å', 'KeyA', { altKey: true }))).toEqual({ tipo: 'alinhar', modo: 'esquerda' })
    expect(atalhoFigma(t('∂', 'KeyD', { altKey: true }))).toEqual({ tipo: 'alinhar', modo: 'direita' })
    expect(atalhoFigma(t('w', 'KeyW', { altKey: true }))).toEqual({ tipo: 'alinhar', modo: 'topo' })
    expect(atalhoFigma(t('s', 'KeyS', { altKey: true }))).toEqual({ tipo: 'alinhar', modo: 'base' })
    expect(atalhoFigma(t('h', 'KeyH', { altKey: true }))).toEqual({ tipo: 'alinhar', modo: 'centroH' })
    expect(atalhoFigma(t('v', 'KeyV', { altKey: true }))).toEqual({ tipo: 'alinhar', modo: 'centroV' })
  })

  it('⇧H/⇧V espelham e ⇧L é a seta', () => {
    expect(atalhoFigma(t('H', 'KeyH', { shiftKey: true }))).toEqual({ tipo: 'espelhar', eixo: 'x' })
    expect(atalhoFigma(t('V', 'KeyV', { shiftKey: true }))).toEqual({ tipo: 'espelhar', eixo: 'y' })
    expect(atalhoFigma(t('L', 'KeyL', { shiftKey: true }))).toEqual({ tipo: 'ferramenta', ferramenta: 'seta' })
  })

  it('ferramentas: V F R O L T H (mão) S (hotspot)', () => {
    const f = (k: string) => atalhoFigma(t(k, `Key${k.toUpperCase()}`))
    expect(f('v')).toEqual({ tipo: 'ferramenta', ferramenta: 'mover' })
    expect(f('f')).toEqual({ tipo: 'ferramenta', ferramenta: 'frame' })
    expect(f('r')).toEqual({ tipo: 'ferramenta', ferramenta: 'forma' })
    expect(f('o')).toEqual({ tipo: 'ferramenta', ferramenta: 'elipse' })
    expect(f('l')).toEqual({ tipo: 'ferramenta', ferramenta: 'linha' })
    expect(f('t')).toEqual({ tipo: 'ferramenta', ferramenta: 'texto' })
    expect(f('h')).toEqual({ tipo: 'ferramenta', ferramenta: 'mao' })
    expect(f('s')).toEqual({ tipo: 'ferramenta', ferramenta: 'hotspot' })
  })

  it('dígitos sem modificador; nada com ⌘/Ctrl ou ⇧⌥', () => {
    expect(atalhoFigma(t('7', 'Digit7'))).toEqual({ tipo: 'digito', digito: 7 })
    expect(atalhoFigma(t('a', 'KeyA', { metaKey: true }))).toBeNull()
    expect(atalhoFigma(t('d', 'KeyD', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(atalhoFigma(t('A', 'KeyA', { shiftKey: true, altKey: true }))).toBeNull()
    expect(atalhoFigma(t('!', 'Digit1', { shiftKey: true }))).toBeNull()
    expect(atalhoFigma(t('x', 'KeyX'))).toBeNull()
  })
})

describe('opacidade pelas teclas numéricas', () => {
  it('1–9 = 10–90% e 0 = 100%', () => {
    expect(opacidadePorDigito(5, 0, null).opacidade).toBe(0.5)
    expect(opacidadePorDigito(0, 0, null).opacidade).toBe(1)
    expect(opacidadePorDigito(9, 0, null).opacidade).toBe(0.9)
  })
  it('dois dígitos rápidos formam o valor exato', () => {
    const a = opacidadePorDigito(5, 1000, null)
    expect(opacidadePorDigito(5, 1200, a.memoria)).toEqual({ opacidade: 0.55, memoria: null })
    const z = opacidadePorDigito(0, 0, null)
    expect(opacidadePorDigito(5, 100, z.memoria).opacidade).toBe(0.05)
    expect(opacidadePorDigito(0, 100, z.memoria).opacidade).toBe(0)
  })
  it('depois da janela, o dígito volta a valer sozinho', () => {
    const a = opacidadePorDigito(5, 0, null)
    expect(opacidadePorDigito(3, JANELA_DIGITOS_MS + 1, a.memoria).opacidade).toBe(0.3)
  })
})

describe('linha/seta desenhada', () => {
  it('caixa horizontal centrada no traço, girada no ângulo', () => {
    const c = caixaDeLinha({ x: 0, y: 0 }, { x: 100, y: 100 }, 4)
    expect(c.rotation).toBe(45)
    expect(c.width).toBe(141)
    expect(Math.abs(c.x + c.width / 2 - 50)).toBeLessThanOrEqual(1)
    expect(Math.abs(c.y + c.height / 2 - 50)).toBeLessThanOrEqual(1)
  })
  it('Shift trava em 45°', () => {
    expect(caixaDeLinha({ x: 0, y: 0 }, { x: 100, y: 10 }, 4, true).rotation).toBe(0)
    expect(caixaDeLinha({ x: 0, y: 0 }, { x: -100, y: 0 }, 4).rotation).toBe(180)
    expect(caixaDeLinha({ x: 0, y: 0 }, { x: 10, y: -100 }, 4, true).rotation).toBe(-90)
  })
})
