import { describe, expect, it } from 'vitest'
import { alvosDasGuias, areasComGuias, faixasDaGuia, guiasOuNada, larguraEsticada, medidasPadrao, novaGuia, resumoGuia, trocarTipo } from './guias'
import { encaixar, redimensionarComEncaixe } from '@/lib/editor/guias'
import { CenaSchema, GuiaLayoutSchema, parseCamada, type GuiaFaixas } from './schema'
import { parseDocumento } from './migrar'
import { aplicarOps, diferenca } from '@/lib/colab/ops'

const tela = { x: 0, y: 0, width: 1920, height: 1080 }
const colunas = (p: Partial<GuiaFaixas> = {}): GuiaFaixas => ({ ...(novaGuia('columns', tela) as GuiaFaixas), ...p })

describe('guias de layout: padrões (regra do 8)', () => {
  it('grade de 8; 12 colunas com margem 64 e calha 24 numa tela de 1920; linhas com calha 24', () => {
    expect(novaGuia('grid', tela)).toMatchObject({ type: 'grid', size: 8, visible: true })
    expect(novaGuia('columns', tela)).toMatchObject({ type: 'columns', count: 12, alignment: 'stretch', margin: 64, gutter: 24 })
    expect(novaGuia('rows', tela)).toMatchObject({ type: 'rows', gutter: 24 })
  })
  it('margem e calha proporcionais e sempre múltiplas de 8', () => {
    expect(medidasPadrao({ width: 1080 })).toEqual({ margem: 40, calha: 16 })
    expect(medidasPadrao({ width: 400 })).toEqual({ margem: 16, calha: 8 })
  })
  it('resumo como no painel', () => {
    expect(resumoGuia(novaGuia('grid', tela))).toBe('Grade 8px')
    expect(resumoGuia(colunas())).toBe('12 colunas')
    expect(resumoGuia({ ...colunas({ count: 1 }), type: 'rows' })).toBe('1 linha')
  })
  it('trocar o tipo: colunas ↔ linhas mantém as medidas; para grade, mantém a cor', () => {
    const c = colunas({ count: 6, margin: 120, gutter: 48, color: '#00FF0033' })
    expect(trocarTipo(c, 'rows', tela)).toMatchObject({ type: 'rows', count: 6, margin: 120, gutter: 48 })
    expect(trocarTipo(c, 'grid', tela)).toMatchObject({ type: 'grid', size: 8, color: '#00FF0033' })
  })
})

describe('guias de layout: geometria', () => {
  it('esticar: colunas entre as margens', () => {
    const f = faixasDaGuia(colunas({ count: 6, margin: 120, gutter: 48 }), tela)
    expect(f).toHaveLength(6)
    expect(f[0]).toEqual({ x: 120, y: 0, width: 240, height: 1080 })
    expect(f[5]!.x + f[5]!.width).toBe(1800)
  })
  it('esquerda, centro e direita com largura fixa', () => {
    const base = colunas({ count: 2, width: 100, gutter: 20, margin: 30 })
    expect(faixasDaGuia({ ...base, alignment: 'start' }, tela).map((r) => r.x)).toEqual([30, 150])
    expect(faixasDaGuia({ ...base, alignment: 'end' }, tela).map((r) => r.x)).toEqual([1670, 1790])
    expect(faixasDaGuia({ ...base, alignment: 'center' }, tela).map((r) => r.x)).toEqual([850, 970])
  })
  it('linhas no eixo vertical, dentro de um frame', () => {
    const linhas: GuiaFaixas = { ...colunas({ count: 2, margin: 10, gutter: 20 }), type: 'rows' }
    expect(faixasDaGuia(linhas, { x: 100, y: 200, width: 300, height: 140 })).toEqual([
      { x: 100, y: 210, width: 300, height: 50 },
      { x: 100, y: 280, width: 300, height: 50 },
    ])
  })
  it('sem espaço: nenhuma faixa', () => {
    expect(faixasDaGuia(colunas({ margin: 960 }), tela)).toEqual([])
    expect(larguraEsticada(colunas({ count: 4, margin: 0, gutter: 0 }), tela)).toBe(480)
  })
})

describe('guias de layout: encaixe', () => {
  const cena = { id: 'tela', size: { width: 1920, height: 1080 }, guias: [colunas({ count: 6, margin: 120, gutter: 48 }), novaGuia('grid', tela)] }
  it('bordas das colunas viram alvos; grade só se legível no zoom', () => {
    const a = alvosDasGuias(areasComGuias(cena, []), 1)
    expect(a.x.map((x) => x.v)).toContain(408)
    expect(a.grades).toHaveLength(1)
    expect(alvosDasGuias(areasComGuias(cena, []), 0.4).grades).toHaveLength(0) // 8 × 0,4 = 3,2 px na tela
  })
  it('guias escondidas não encaixam; frames com guias valem dentro deles', () => {
    const escondidas = { ...cena, guias: cena.guias.map((g) => ({ ...g, visible: false })) }
    const a = alvosDasGuias(areasComGuias(escondidas, []), 1)
    expect(a.x).toEqual([])
    const frame = parseCamada({ id: 'f', type: 'frame', x: 100, y: 100, width: 400, height: 400, guias: [novaGuia('grid', tela)] })
    expect(areasComGuias({ ...cena, guias: undefined }, [frame]).map((x) => x.id)).toEqual(['f'])
  })
  it('mover: a borda encaixa na coluna', () => {
    const { x, grades } = alvosDasGuias(areasComGuias({ ...cena, guias: [cena.guias[0]!] }, []), 1)
    const r = encaixar({ x: 411, y: 300, width: 100, height: 100 }, [], cena.size, 6, { extras: { x, y: [] }, grades })
    expect(r.x).toBe(408)
    expect(r.guias.some((g) => g.eixo === 'v' && g.pos === 408)).toBe(true)
  })
  it('mover: na grade (sem desenhar guia), perdendo para guias inteligentes empatadas', () => {
    const { grades } = alvosDasGuias(areasComGuias({ ...cena, guias: [novaGuia('grid', tela)] }, []), 1)
    const r = encaixar({ x: 203, y: 299, width: 101, height: 50 }, [], cena.size, 5, { grades })
    expect(r.x % 8 === 0 || (r.x + 101) % 8 === 0).toBe(true)
    expect(r.y).toBe(296 + 0) // 299 → 296 (d 3) ganha de 299+50=349 → 352 (d 3, empate: a primeira)
    expect(r.guias).toEqual([])
    // ⌘/Ctrl: quem chama não encaixa (o canvas pula `encaixar`); redimensionar respeita `semEncaixe`
    const rr = redimensionarComEncaixe({ x: 0, y: 0, width: 100, height: 100 }, 'e', 3, 0, [], cena.size, 5, { grades, semEncaixe: true })
    expect(rr.caixa.width).toBe(103)
    const rg = redimensionarComEncaixe({ x: 0, y: 0, width: 100, height: 100 }, 'e', 3, 0, [], cena.size, 5, { grades })
    expect(rg.caixa.width).toBe(104)
  })
})

describe('guias de layout: documento', () => {
  it('documentos antigos abrem sem guias; lista vazia não é gravada', () => {
    const doc = parseDocumento({ schemaVersion: 2, mode: 'slides', scenes: [{ id: 'a', size: { width: 1920, height: 1080 }, layers: [] }] })
    expect(doc.scenes[0]!.guias).toBeUndefined()
    expect(guiasOuNada([])).toBeUndefined()
  })
  it('valida e aplica padrões; recusa valores fora do intervalo', () => {
    expect(GuiaLayoutSchema.parse({ type: 'columns' })).toMatchObject({ count: 12, alignment: 'stretch', margin: 0, gutter: 0, visible: true })
    expect(() => GuiaLayoutSchema.parse({ type: 'grid', size: 0 })).toThrow()
    expect(() => CenaSchema.parse({ id: 'a', size: { width: 100, height: 100 }, layers: [], guias: [{ type: 'rows', count: 0 }] })).toThrow()
  })
  it('colaboração e desfazer: as guias viajam como uma propriedade da tela', () => {
    const antes = parseDocumento({ schemaVersion: 2, mode: 'slides', scenes: [{ id: 'a', size: { width: 1920, height: 1080 }, layers: [] }] })
    const depois = { ...antes, scenes: [{ ...antes.scenes[0]!, guias: [novaGuia('columns', tela)] }] }
    const ops = diferenca(antes, depois)
    expect(ops).toEqual([{ o: 'cena', id: 'a', p: { guias: depois.scenes[0]!.guias } }])
    expect(aplicarOps(antes, ops).scenes[0]!.guias).toEqual(depois.scenes[0]!.guias)
    expect(aplicarOps(depois, diferenca(depois, antes)).scenes[0]!.guias).toBeUndefined()
  })
})
