import { describe, expect, it } from 'vitest'
import { anguloRotacao, deslocarComGrade, distribuir, encaixar, guiasDaCaixa, intersecta, limiarEmCena, medirDistancias, redimensionarComEncaixe, LIMIAR_TELA } from './guias'

const cena = { width: 1000, height: 500 }

describe('guias inteligentes', () => {
  it('encaixa no centro da tela', () => {
    const r = encaixar({ x: 447, y: 10, width: 100, height: 50 }, [], cena, 6)
    expect(r.x).toBe(450)
    expect(r.guias.some((g) => g.eixo === 'v' && g.pos === 500)).toBe(true)
  })
  it('encaixa a borda esquerda na borda de outra camada', () => {
    const outro = { x: 200, y: 300, width: 100, height: 100 }
    const r = encaixar({ x: 203, y: 40, width: 80, height: 40 }, [outro], cena, 6)
    expect(r.x).toBe(200)
    const g = r.guias.find((x) => x.eixo === 'v')!
    expect(g.pos).toBe(200)
    expect(g.de).toBe(40)
    expect(g.ate).toBe(400)
  })
  it('não encaixa fora do limiar', () => {
    const r = encaixar({ x: 120, y: 120, width: 10, height: 10 }, [], cena, 4)
    expect(r).toMatchObject({ x: 120, y: 120, guias: [], espacos: [] })
  })
  it('distribui espaçamento horizontal igual mantendo as pontas', () => {
    const d = distribuir([{ id: 'a', x: 0, y: 0, width: 100, height: 10 }, { id: 'b', x: 150, y: 0, width: 100, height: 10 }, { id: 'c', x: 600, y: 0, width: 100, height: 10 }], 'h')
    expect(d.map((c) => c.x)).toEqual([0, 300, 600])
  })
  it('intersecção para seleção por área', () => {
    expect(intersecta({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true)
    expect(intersecta({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 5, height: 5 })).toBe(false)
  })
  it('ângulo de rotação com encaixe de 15°', () => {
    expect(anguloRotacao({ x: 0, y: 0 }, { x: 0, y: -10 }, false)).toBe(0)
    expect(anguloRotacao({ x: 0, y: 0 }, { x: 10, y: 0 }, false)).toBe(90)
    expect(anguloRotacao({ x: 0, y: 0 }, { x: 10, y: -9 }, true)).toBe(45)
  })
})

describe('encaixe estilo Figma', () => {
  it('limiar em px de tela independe do zoom', () => {
    const outro = { x: 300, y: 300, width: 100, height: 100 }
    // zoom 2×: 5 px de tela = 2,5 px da cena
    const lim = limiarEmCena(LIMIAR_TELA, 2)
    expect(lim).toBe(2.5)
    expect(encaixar({ x: 302, y: 10, width: 50, height: 50 }, [outro], cena, lim).x).toBe(300)
    expect(encaixar({ x: 303.4, y: 10, width: 50, height: 50 }, [outro], cena, lim).x).toBe(303)
    // zoom 0,25×: 5 px de tela = 20 px da cena
    expect(encaixar({ x: 316, y: 10, width: 4, height: 4 }, [outro], cena, limiarEmCena(LIMIAR_TELA, 0.25)).x).toBe(300)
    expect(encaixar({ x: 316, y: 10, width: 4, height: 4 }, [outro], cena, limiarEmCena(LIMIAR_TELA, 1)).x).toBe(316)
  })
  it('X e Y encaixam de forma independente (borda em X, centro em Y)', () => {
    const outro = { x: 600, y: 200, width: 100, height: 100 }
    const r = encaixar({ x: 497, y: 226, width: 100, height: 50 }, [outro], cena, 6)
    // borda esquerda 497 → centro da tela 500 (a borda direita cai em 600, a do outro)
    expect(r.x).toBe(500)
    expect(r.y).toBe(225) // centro 251 → centro do outro 250
    expect(r.guias.filter((g) => g.eixo === 'v').map((g) => g.pos)).toEqual([500, 600])
    expect(r.guias.filter((g) => g.eixo === 'h').map((g) => g.pos)).toEqual([250])
  })
  it('sempre devolve pixels inteiros', () => {
    const r = encaixar({ x: 412.3333, y: 87.6, width: 10, height: 10 }, [], cena, 1)
    expect(r.x).toBe(412)
    expect(r.y).toBe(88)
  })
  it('guia só cobre as camadas alinhadas e mostra a distância ao longo dela', () => {
    const a = { x: 100, y: 0, width: 50, height: 40 }
    const longe = { x: 800, y: 300, width: 50, height: 40 }
    const r = encaixar({ x: 102, y: 140, width: 60, height: 30 }, [a, longe], cena, 6)
    const v = r.guias.find((g) => g.eixo === 'v' && g.pos === 100)!
    expect([v.de, v.ate]).toEqual([0, 170])
    expect(r.medidas).toContainEqual({ eixo: 'v', pos: 100, de: 40, ate: 140, valor: 100 })
  })
  it('espaçamento igual entre dois vizinhos (indicadores rosa)', () => {
    const esq = { x: 0, y: 100, width: 100, height: 50 }
    const dir = { x: 400, y: 100, width: 100, height: 50 }
    // posição igualitária: (100 + 400 - 100) / 2 = 200
    const r = encaixar({ x: 196, y: 400, width: 100, height: 50 }, [esq, dir], { width: 2000, height: 2000 }, 6)
    expect(r.x).toBe(196) // fora da linha (y não sobrepõe): sem espaçamento
    const r2 = encaixar({ x: 196, y: 110, width: 100, height: 50 }, [esq, dir], { width: 2000, height: 2000 }, 6)
    expect(r2.x).toBe(200)
    expect(r2.espacos).toHaveLength(2)
    expect(r2.espacos.every((e) => e.valor === 100 && e.eixo === 'h')).toBe(true)
  })
  it('espaçamento igual continuando uma sequência', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 }
    const b = { x: 80, y: 0, width: 50, height: 50 }
    // vão a→b = 30; colocar depois de b com o mesmo vão: 160
    const r = encaixar({ x: 163, y: 0, width: 50, height: 50 }, [a, b], { width: 3000, height: 3000 }, 6)
    expect(r.x).toBe(160)
    expect(r.espacos.map((e) => [e.de, e.ate]).sort((a, b) => a[0]! - b[0]!)).toEqual([[50, 80], [130, 160]])
  })
  it('com grade ligada a posição arredonda para a grade', () => {
    const r = encaixar({ x: 13, y: 21, width: 10, height: 10 }, [{ x: 15, y: 15, width: 10, height: 10 }], cena, 6, { grade: 8 })
    expect([r.x, r.y]).toEqual([16, 24])
  })
  it('guiasDaCaixa mostra alinhamento após deslocar com as setas', () => {
    const g = guiasDaCaixa({ x: 200, y: 10, width: 20, height: 20 }, [{ x: 200, y: 300, width: 10, height: 10 }], cena)
    expect(g.guias.some((x) => x.eixo === 'v' && x.pos === 200)).toBe(true)
  })
  it('deslocar com grade vai para a próxima linha', () => {
    expect(deslocarComGrade(13, 1, 1, 8)).toBe(16)
    expect(deslocarComGrade(16, 1, 1, 8)).toBe(24)
    expect(deslocarComGrade(16, -1, 1, 8)).toBe(8)
    expect(deslocarComGrade(13.4, 1, 1, 0)).toBe(14)
    expect(deslocarComGrade(13, -1, 10, 0)).toBe(3)
  })
})

describe('redimensionar com encaixe', () => {
  const ini = { x: 100, y: 100, width: 100, height: 100 }
  const outro = { x: 300, y: 50, width: 50, height: 300 }
  it('alça leste encaixa a borda direita em outra camada', () => {
    const r = redimensionarComEncaixe(ini, 'e', 97, 0, [outro], cena, 6)
    expect(r.caixa).toEqual({ x: 100, y: 100, width: 200, height: 100 })
    expect(r.guias.some((g) => g.eixo === 'v' && g.pos === 300)).toBe(true)
  })
  it('alça oeste e norte (canto nw) encaixam as duas bordas', () => {
    const r = redimensionarComEncaixe(ini, 'nw', -92, -48, [outro, { x: 0, y: 0, width: 10, height: 50 }], cena, 6)
    expect(r.caixa).toEqual({ x: 10, y: 50, width: 190, height: 150 })
  })
  it('Shift mantém proporção depois do encaixe', () => {
    const r = redimensionarComEncaixe(ini, 'se', 98, 90, [outro], cena, 6, { proporcional: true })
    expect(r.caixa).toEqual({ x: 100, y: 100, width: 200, height: 200 })
  })
  it('Alt redimensiona a partir do centro (encaixe espelhado)', () => {
    const r = redimensionarComEncaixe(ini, 'e', 48, 0, [outro], cena, 6, { doCentro: true })
    // borda direita 248 → 250? não há alvo; centro em 150 mantido
    expect(r.caixa.x + r.caixa.width / 2).toBe(150)
    const r2 = redimensionarComEncaixe(ini, 'e', 98, 0, [outro], cena, 6, { doCentro: true })
    expect(r2.caixa).toEqual({ x: 0, y: 100, width: 300, height: 100 })
  })
  it('grade arredonda o tamanho', () => {
    const r = redimensionarComEncaixe({ x: 0, y: 0, width: 80, height: 80 }, 'se', 13, 3, [], cena, 6, { grade: 8 })
    expect(r.caixa).toEqual({ x: 0, y: 0, width: 96, height: 80 })
  })
  it('Ctrl/⌘ desliga o encaixe', () => {
    const r = redimensionarComEncaixe(ini, 'e', 97, 0, [outro], cena, 6, { semEncaixe: true })
    expect(r.caixa.width).toBe(197)
    expect(r.guias).toEqual([])
  })
})

describe('medidas com Alt', () => {
  it('caixas separadas: vão horizontal', () => {
    expect(medirDistancias({ x: 0, y: 0, width: 50, height: 50 }, { x: 80, y: 10, width: 20, height: 20 })).toEqual([{ eixo: 'h', pos: 20, de: 50, ate: 80, valor: 30 }])
  })
  it('caixa dentro da outra: quatro distâncias', () => {
    const m = medirDistancias({ x: 10, y: 20, width: 30, height: 30 }, { x: 0, y: 0, width: 100, height: 100 })
    expect(m.map((x) => x.valor)).toEqual([10, 60, 20, 50])
  })
  it('diagonal: vão horizontal e vertical', () => {
    const m = medirDistancias({ x: 0, y: 0, width: 10, height: 10 }, { x: 30, y: 50, width: 10, height: 10 })
    expect(m.map((x) => [x.eixo, x.valor])).toEqual([['h', 20], ['v', 40]])
  })
})
