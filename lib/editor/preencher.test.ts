import { describe, expect, it } from 'vitest'
import { parseCamada } from '@/lib/scene/schema'
import { PREDEFINICOES, alvosDeFracao, atalhoPreencher, colunasDaGrade, dividirCaixa, gradeLayoutPadrao, preencherRegiao, regiaoDaGrade } from './preencher'
import { encaixar, redimensionarComEncaixe } from './guias'

const T = { width: 1920, height: 1080 }
const pre = (id: string) => PREDEFINICOES.find((p) => p.id === id)!.celulas

describe('regiões', () => {
  it('metades, terços e quartos da tela', () => {
    expect(regiaoDaGrade(T, pre('esquerda'))).toEqual({ x: 0, y: 0, width: 960, height: 1080 })
    expect(regiaoDaGrade(T, pre('direita'))).toEqual({ x: 960, y: 0, width: 960, height: 1080 })
    expect(regiaoDaGrade(T, pre('inferior'))).toEqual({ x: 0, y: 540, width: 1920, height: 540 })
    expect(regiaoDaGrade(T, pre('terco2'))).toEqual({ x: 640, y: 0, width: 640, height: 1080 })
    expect(regiaoDaGrade(T, pre('doisTercos2'))).toEqual({ x: 640, y: 0, width: 1280, height: 1080 })
    expect(regiaoDaGrade(T, pre('q4'))).toEqual({ x: 960, y: 540, width: 960, height: 540 })
  })

  it('com margens desconta margem e gutter entre as células', () => {
    const r = regiaoDaGrade(T, pre('esquerda'), { margem: 96, gutter: 24 })
    expect(r).toEqual({ x: 96, y: 96, width: (1920 - 192 - 24) / 2, height: 1080 - 192 })
    const cel = regiaoDaGrade(T, { cols: 6, lins: 4, c0: 1, c1: 2, l0: 0, l1: 0 })
    expect(cel).toEqual({ x: 320, y: 0, width: 640, height: 270 })
  })

  it('grade de layout de 12 colunas dentro das margens', () => {
    const g = gradeLayoutPadrao(T)
    expect(g).toEqual({ colunas: 12, margem: 96, gutter: 24 })
    const cols = colunasDaGrade(T, g)
    expect(cols).toHaveLength(12)
    expect(cols[0]!.x).toBe(96)
    expect(cols[11]!.x + cols[11]!.width).toBeCloseTo(1920 - 96)
  })

  it('atalhos ⌃⌥ como no Rectangle', () => {
    const e = (code: string, extra = {}) => ({ code, key: '', ctrlKey: true, altKey: true, metaKey: false, shiftKey: false, ...extra })
    expect(atalhoPreencher(e('ArrowLeft'))?.id).toBe('esquerda')
    expect(atalhoPreencher(e('Enter'))?.id).toBe('tela')
    expect(atalhoPreencher(e('KeyU'))?.id).toBe('q1')
    expect(atalhoPreencher(e('ArrowLeft', { metaKey: true }))).toBeNull()
    expect(atalhoPreencher(e('ArrowLeft', { ctrlKey: false }))).toBeNull()
  })
})

describe('preencher camadas', () => {
  it('uma camada vai exatamente para a região; texto fica com largura fixa e mantém a fonte', () => {
    const t = parseCamada({ id: 't', type: 'text', text: 'Oi', x: 10, y: 10, width: 100, height: 40, fontSize: 64, sizingW: 'hug', sizingH: 'hug' })
    const r = preencherRegiao([t], ['t'], { x: 0, y: 0, width: 960, height: 1080 }).get('t')!
    expect(r).toMatchObject({ x: 0, y: 0, width: 960, height: 1080, fontSize: 64, sizingW: 'fixed' })
  })

  it('frame livre leva os filhos junto; várias camadas escalam a caixa envolvente', () => {
    const f = parseCamada({ id: 'f', type: 'frame', x: 100, y: 100, width: 200, height: 200 })
    const filho = parseCamada({ id: 'c', type: 'shape', x: 120, y: 130, width: 10, height: 10, parentId: 'f' })
    const m = preencherRegiao([f, filho], ['f'], { x: 0, y: 0, width: 960, height: 540 })
    expect(m.get('c')).toMatchObject({ x: 20, y: 30, width: 10 })
    const a = parseCamada({ id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 100 })
    const b = parseCamada({ id: 'b', type: 'shape', x: 100, y: 0, width: 100, height: 100 })
    const r = preencherRegiao([a, b], ['a', 'b'], { x: 0, y: 0, width: 960, height: 1080 })
    expect(r.get('b')).toMatchObject({ x: 480, width: 480, height: 1080 })
  })

  it('dividir em grade com gap', () => {
    const r = dividirCaixa({ x: 0, y: 0, width: 300, height: 100 }, 3, 1, 30)
    expect(r.map((c) => [c.x, c.width])).toEqual([[0, 80], [110, 80], [220, 80]])
    expect(dividirCaixa({ x: 0, y: 0, width: 10, height: 10 }, 5, 1, 10)).toEqual([])
  })
})

describe('encaixe nas frações da tela', () => {
  const extras = alvosDeFracao(T)
  it('redimensionar a borda até perto da metade encaixa em 960 com rótulo 1/2', () => {
    const r = redimensionarComEncaixe({ x: 0, y: 0, width: 400, height: 1080 }, 'e', 557, 0, [], T, 5, { extras })
    expect(r.caixa.width).toBe(960)
    expect(r.guias.some((g) => g.eixo === 'v' && g.pos === 960 && g.rotulo === '1/2')).toBe(true)
  })

  it('mover até um terço encaixa (borda esquerda em 640)', () => {
    const r = encaixar({ x: 637, y: 100, width: 100, height: 100 }, [], T, 5, { extras })
    expect(r.x).toBe(640)
    expect(r.guias.find((g) => g.pos === 640)?.rotulo).toBe('1/3')
  })

  it('sem frações o comportamento antigo continua', () => {
    const r = encaixar({ x: 637, y: 100, width: 100, height: 100 }, [], T, 5)
    expect(r.x).toBe(637)
    expect(alvosDeFracao(T, { fracoes: false, grade: null }).x).toEqual([])
  })
})
