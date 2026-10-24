// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseCamada, type CamadaForma, type CamadaSvg, type Vetor } from '@/lib/scene/schema'
import { aplicarVetor, cenaParaLocal, formasDoSvg, localParaCena, vetorDaCamada } from './camadas'
import { caixaVetor, caminhoParaD, dParaCaminhos, dividirCubica, maisProximoNoSegmento, pontoEm, pontosNoLaco, segmentos, vetorParaD, dentroDoPoligono, achatar } from './geometria'
import { abrirNoNo, adicionarNo, alternarPreenchimento, alternarTipoNo, apagarSegmento, cortarSegmento, curvarSegmento, escalarVetor, inserirNo, moverAlca, moverNos, normalizar, removerNos } from './operacoes'
import { KAPPA, elipseVetor, retanguloVetor, vetorDaForma } from './primitivas'
import { lerTransform, svgParaGrupos } from './svgVetor'

const forma = (extra: Record<string, unknown>) => parseCamada({ id: 'f', type: 'shape', x: 0, y: 0, width: 200, height: 100, ...extra }) as CamadaForma
const quadrado = (): Vetor => ({ w: 100, h: 100, fillRule: 'nonzero', caminhos: [retanguloVetor(100, 100)] })
const perto = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('primitivas → caminho', () => {
  it('retângulo vira 4 nós de canto, fechado', () => {
    const { vetor } = vetorDaForma(forma({ shape: 'rect' }))
    expect(vetor.caminhos).toHaveLength(1)
    expect(vetor.caminhos[0]!.fechado).toBe(true)
    expect(vetor.caminhos[0]!.nos.map((n) => [n.x, n.y])).toEqual([[0, 0], [200, 0], [200, 100], [0, 100]])
    expect(vetorParaD(vetor)).toBe('M0 0 L200 0 L200 100 L0 100 Z')
  })

  it('cantos arredondados viram dois nós por canto com alças (κ) e mantêm a caixa', () => {
    const c = retanguloVetor(200, 100, [20, 0, 0, 0])
    expect(c.nos).toHaveLength(5)
    expect(c.nos[0]).toMatchObject({ x: 0, y: 20, saida: { x: 0, y: 20 - 20 * KAPPA } })
    expect(c.nos[1]).toMatchObject({ x: 20, y: 0, entrada: { x: 20 - 20 * KAPPA, y: 0 } })
    const caixa = caixaVetor({ w: 200, h: 100, fillRule: 'nonzero', caminhos: [c] })
    expect(caixa).toEqual({ x: 0, y: 0, width: 200, height: 100 })
  })

  it('raios maiores que o lado são reduzidos como no CSS', () => {
    const c = retanguloVetor(100, 40, [40, 40, 40, 40])
    // 40+40 > 40 de altura → fator 0,5 → raio 20
    expect(c.nos[0]).toMatchObject({ x: 0, y: 20 })
  })

  it('elipse vira 4 nós suaves e o ponto médio do arco fica no círculo', () => {
    const e = elipseVetor(100, 100)
    expect(e.nos).toHaveLength(4)
    expect(e.nos.every((n) => n.tipo === 'suave')).toBe(true)
    const s = segmentos({ w: 100, h: 100, fillRule: 'nonzero', caminhos: [e] })[0]!
    const m = pontoEm(s, 0.5)
    perto(Math.hypot(m.x - 50, m.y - 50), 50, 0.05)
    expect(caixaVetor({ w: 100, h: 100, fillRule: 'nonzero', caminhos: [e] })).toEqual({ x: 0, y: 0, width: 100, height: 100 })
  })

  it('linha e seta viram traço (preenchimento vira cor do traço)', () => {
    const { vetor, patch } = vetorDaForma(forma({ shape: 'line', fill: '#ff0000', height: 4 }))
    expect(vetor.caminhos[0]).toMatchObject({ fechado: false, semPreenchimento: true })
    expect(patch).toMatchObject({ stroke: '#ff0000', strokeWidth: 4 })
    expect(vetorDaForma(forma({ shape: 'arrow' })).vetor.caminhos).toHaveLength(2)
  })

  it('o schema aceita a forma path com vetor', () => {
    const { vetor } = vetorDaForma(forma({ shape: 'star' }))
    const c = parseCamada({ id: 'p', type: 'shape', shape: 'path', x: 0, y: 0, width: 200, height: 100, vetor })
    expect(c.type === 'shape' && c.vetor?.caminhos[0]?.nos).toHaveLength(10)
  })
})

describe('caixa e normalização', () => {
  it('caixa de uma curva inclui os extremos (não só os nós)', () => {
    const v: Vetor = { w: 100, h: 100, fillRule: 'nonzero', caminhos: [{ fechado: false, nos: [{ x: 0, y: 50, saida: { x: 0, y: -50 }, tipo: 'canto' }, { x: 100, y: 50, entrada: { x: 100, y: -50 }, tipo: 'canto' }] }] }
    const c = caixaVetor(v)
    perto(c.y, 50 - 75) // B(0,5).y = 50·(1/8+1/8) + (−50)·(3/8+3/8) = −25
    expect(c.x).toBe(0)
    expect(c.width).toBe(100)
  })

  it('normalizar desloca para (0,0) e devolve a caixa nas coordenadas antigas', () => {
    const v = moverNos(quadrado(), [{ c: 0, i: 1 }, { c: 0, i: 2 }], 50, 0)
    const { vetor, caixa } = normalizar(v)
    expect(caixa).toEqual({ x: 0, y: 0, width: 150, height: 100 })
    expect(vetor.w).toBe(150)
    const { caixa: c2 } = normalizar(moverNos(quadrado(), [{ c: 0, i: 0 }, { c: 0, i: 3 }], 30, 0))
    expect(c2).toEqual({ x: 30, y: 0, width: 70, height: 100 })
  })

  it('linha reta horizontal ganha altura mínima 1, centrada', () => {
    const v: Vetor = { w: 10, h: 10, fillRule: 'nonzero', caminhos: [{ fechado: false, nos: [{ x: 0, y: 5, tipo: 'canto' }, { x: 10, y: 5, tipo: 'canto' }] }] }
    const { vetor, caixa } = normalizar(v)
    expect(caixa).toEqual({ x: 0, y: 4.5, width: 10, height: 1 })
    expect(vetor.caminhos[0]!.nos[0]!.y).toBe(0.5)
  })

  it('escalar muda o quadro e os nós', () => {
    const v = escalarVetor(quadrado(), 200, 50)
    expect(v.caminhos[0]!.nos[2]).toMatchObject({ x: 200, y: 50 })
  })
})

describe('dividir e inserir (de Casteljau)', () => {
  it('as duas metades reproduzem a curva original', () => {
    const s = { p0: { x: 0, y: 0 }, p1: { x: 10, y: 40 }, p2: { x: 60, y: 40 }, p3: { x: 80, y: 0 } }
    const [a, b] = dividirCubica(s, 0.3)
    const f = pontoEm(s, 0.3)
    perto(a[3].x, f.x); perto(a[3].y, f.y)
    expect(b[0]).toEqual(a[3])
    const orig = pontoEm(s, 0.3 + 0.7 * 0.5)
    const meio = pontoEm({ p0: b[0], p1: b[1], p2: b[2], p3: b[3] }, 0.5)
    perto(orig.x, meio.x)
    perto(orig.y, meio.y)
  })

  it('inserir num segmento reto cria um nó de canto no ponto', () => {
    const r = inserirNo(quadrado(), 0, 0, 0.25)!
    expect(r.ref).toEqual({ c: 0, i: 1 })
    expect(r.vetor.caminhos[0]!.nos).toHaveLength(5)
    expect(r.vetor.caminhos[0]!.nos[1]).toMatchObject({ x: 25, y: 0, tipo: 'canto' })
  })

  it('inserir numa curva mantém a forma (nó suave com alças)', () => {
    const v: Vetor = { w: 100, h: 100, fillRule: 'nonzero', caminhos: [elipseVetor(100, 100)] }
    const antes = pontoEm(segmentos(v)[0]!, 0.75)
    const r = inserirNo(v, 0, 0, 0.5)!
    expect(r.vetor.caminhos[0]!.nos[1]!.tipo).toBe('suave')
    const depois = pontoEm(segmentos(r.vetor)[1]!, 0.5)
    perto(antes.x, depois.x)
    perto(antes.y, depois.y)
  })

  it('o ponto mais próximo acha t num segmento', () => {
    const s = segmentos(quadrado())[0]!
    const r = maisProximoNoSegmento(s, { x: 40, y: 8 })
    perto(r.t, 0.4, 1e-4)
    perto(r.d, 8, 1e-4)
  })
})

describe('cortar, apagar e abrir', () => {
  it('apagar nós liga os vizinhos; apagar tudo devolve null', () => {
    const v = removerNos(quadrado(), [{ c: 0, i: 1 }])!
    expect(v.caminhos[0]!.nos.map((n) => [n.x, n.y])).toEqual([[0, 0], [100, 100], [0, 100]])
    expect(v.caminhos[0]!.fechado).toBe(true)
    expect(removerNos(quadrado(), [0, 1, 2, 3].map((i) => ({ c: 0, i })))).toBeNull()
  })

  it('apagar um segmento de um caminho fechado o abre sem ele', () => {
    const v = apagarSegmento(quadrado(), 0, 0)!
    const c = v.caminhos[0]!
    expect(c.fechado).toBe(false)
    expect(c.nos.map((n) => [n.x, n.y])).toEqual([[100, 0], [100, 100], [0, 100], [0, 0]])
  })

  it('apagar um segmento do meio de um caminho aberto o divide em dois', () => {
    const aberto: Vetor = { ...quadrado(), caminhos: [{ ...retanguloVetor(100, 100), fechado: false }] }
    const v = apagarSegmento(aberto, 0, 1)!
    expect(v.caminhos.map((c) => c.nos.length)).toEqual([2, 2])
  })

  it('cortar num nó abre o caminho fechado ali (nó duplicado nas pontas)', () => {
    const v = abrirNoNo(quadrado(), { c: 0, i: 2 })
    const c = v.caminhos[0]!
    expect(c.fechado).toBe(false)
    expect(c.nos.map((n) => [n.x, n.y])).toEqual([[100, 100], [0, 100], [0, 0], [100, 0], [100, 100]])
  })

  it('cortar num segmento insere um nó e abre ali', () => {
    const v = cortarSegmento(quadrado(), 0, 0, 0.5)
    const c = v.caminhos[0]!
    expect(c.fechado).toBe(false)
    expect(c.nos[0]).toMatchObject({ x: 50, y: 0 })
    expect(c.nos[c.nos.length - 1]).toMatchObject({ x: 50, y: 0 })
  })

  it('cortar num nó do meio de um caminho aberto divide em dois', () => {
    const aberto: Vetor = { ...quadrado(), caminhos: [{ ...retanguloVetor(100, 100), fechado: false }] }
    const v = abrirNoNo(aberto, { c: 0, i: 1 })
    expect(v.caminhos).toHaveLength(2)
    expect(v.caminhos[0]!.nos.at(-1)).toMatchObject({ x: 100, y: 0 })
    expect(v.caminhos[1]!.nos[0]).toMatchObject({ x: 100, y: 0 })
  })
})

describe('curvar e alças', () => {
  it('curvar uma reta faz a curva passar pelo ponteiro', () => {
    const v = curvarSegmento(quadrado(), 0, 0, 0.5, { x: 50, y: -30 })
    const s = segmentos(v)[0]!
    expect(s.reta).toBe(false)
    const m = pontoEm(s, 0.5)
    perto(m.x, 50)
    perto(m.y, -30)
  })

  it('alça de nó suave espelha o ângulo; com Alt (quebrar) vira canto', () => {
    const v: Vetor = { w: 100, h: 100, fillRule: 'nonzero', caminhos: [elipseVetor(100, 100)] }
    const s = moverAlca(v, { c: 0, i: 0 }, 'saida', { x: 50, y: 20 })
    const n = s.caminhos[0]!.nos[0]!
    // saída aponta para baixo → entrada aponta para cima, com o comprimento antigo
    perto(n.entrada!.x, 50)
    perto(n.entrada!.y, -50 * KAPPA)
    const q = moverAlca(v, { c: 0, i: 0 }, 'saida', { x: 50, y: 20 }, true).caminhos[0]!.nos[0]!
    expect(q.tipo).toBe('canto')
    expect(q.entrada).toEqual(v.caminhos[0]!.nos[0]!.entrada)
  })

  it('alternar o tipo do nó: canto ganha alças pela tangente; suave perde', () => {
    const s = alternarTipoNo(quadrado(), { c: 0, i: 1 })
    expect(s.caminhos[0]!.nos[1]).toMatchObject({ tipo: 'suave' })
    expect(s.caminhos[0]!.nos[1]!.saida).toBeDefined()
    expect(alternarTipoNo(s, { c: 0, i: 1 }).caminhos[0]!.nos[1]).toEqual({ x: 100, y: 0, tipo: 'canto' })
  })

  it('caneta: arrastar cria nó suave com alças espelhadas', () => {
    const v: Vetor = { w: 1, h: 1, fillRule: 'nonzero', caminhos: [{ nos: [{ x: 0, y: 0, tipo: 'canto' }], fechado: false }] }
    const r = adicionarNo(v, 0, { x: 100, y: 0 }, { x: 120, y: 20 })
    expect(r.vetor.caminhos[0]!.nos[1]).toMatchObject({ tipo: 'suave', saida: { x: 120, y: 20 }, entrada: { x: 80, y: -20 } })
  })

  it('pintar alterna o preenchimento do caminho', () => {
    const v = alternarPreenchimento(quadrado(), 0)
    expect(v.caminhos[0]!.semPreenchimento).toBe(true)
    expect(alternarPreenchimento(v, 0).caminhos[0]!.semPreenchimento).toBeUndefined()
  })
})

describe('laço e regiões', () => {
  it('seleciona só os pontos dentro do laço livre', () => {
    const laco = [{ x: -10, y: -10 }, { x: 60, y: -10 }, { x: -10, y: 60 }]
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 10, y: 10 }]
    expect(pontosNoLaco(laco, pts)).toEqual([0, 3])
    expect(pontosNoLaco([{ x: 0, y: 0 }, { x: 1, y: 1 }], pts)).toEqual([])
  })

  it('ponto no polígono achatado da elipse', () => {
    const pol = achatar(elipseVetor(100, 100))
    expect(dentroDoPoligono(pol, { x: 50, y: 50 })).toBe(true)
    expect(dentroDoPoligono(pol, { x: 2, y: 2 })).toBe(false)
  })
})

describe('SVG d', () => {
  it('serializa M/L/C/Z com escala', () => {
    const v: Vetor = { w: 100, h: 100, fillRule: 'nonzero', caminhos: [elipseVetor(100, 100)] }
    const d = caminhoParaD(v.caminhos[0]!, 2, 1)
    expect(d.startsWith('M100 0 C')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(4)
  })

  it('lê d com comandos relativos, H/V, S, Q e fecha fundindo o último nó', () => {
    const [c] = dParaCaminhos('m10 10 h80 v80 H10 z')
    expect(c!.fechado).toBe(true)
    expect(c!.nos.map((n) => [n.x, n.y])).toEqual([[10, 10], [90, 10], [90, 90], [10, 90]])
    const [q] = dParaCaminhos('M0 0 Q50 100 100 0')
    perto(q!.nos[0]!.saida!.x, 100 / 3); perto(q!.nos[0]!.saida!.y, 200 / 3)
    const [s] = dParaCaminhos('M0 0 C0 50 50 50 50 0 S100 -50 100 0')
    expect(s!.nos[1]!.tipo).toBe('suave')
    expect(s!.nos[1]!.saida).toEqual({ x: 50, y: -50 })
  })

  it('arco vira cúbicas que passam pelos pontos do círculo', () => {
    const [c] = dParaCaminhos('M0 50 A50 50 0 0 1 100 50')
    const v: Vetor = { w: 100, h: 100, fillRule: 'nonzero', caminhos: [c!] }
    const cx = caixaVetor(v)
    perto(cx.y, 0, 1e-3)
    expect(c!.nos.at(-1)).toMatchObject({ x: 100, y: 50 })
  })

  it('ida e volta d → caminhos → d', () => {
    const d = 'M0 0 L100 0 C120 0 120 50 100 50 Z'
    expect(caminhoParaD(dParaCaminhos(d)[0]!)).toBe(d)
  })
})

describe('SVG → grupos', () => {
  const parser = new DOMParser()
  it('lê formas com transform, agrupa por cor e mapeia o viewBox para a camada', () => {
    const svg = '<svg viewBox="0 0 50 50"><g transform="translate(10 0)"><rect x="0" y="0" width="10" height="10" fill="#ff0000"/></g><circle cx="25" cy="25" r="5" style="fill:#00f"/><path d="M0 0L5 5" stroke="#000" fill="none"/></svg>'
    const g = svgParaGrupos(svg, 100, 100, 'contain', parser)!
    expect(g).toHaveLength(3)
    const vermelho = g.find((x) => x.fill === '#ff0000')!
    expect(vermelho.caminhos[0]!.nos[0]).toMatchObject({ x: 20, y: 0 })
    expect(g.find((x) => x.stroke === '#000000')!.caminhos[0]!.semPreenchimento).toBe(true)
  })

  it('lerTransform compõe translate e scale', () => {
    expect(lerTransform('translate(10,5) scale(2)')).toEqual([2, 0, 0, 2, 10, 5])
  })
})

describe('vetor na camada', () => {
  it('local ↔ cena é inversível com rotação e espelho', () => {
    const c = { x: 100, y: 50, width: 200, height: 100, rotation: 30, flipX: true, flipY: false }
    const v = { w: 100, h: 50 }
    const p = { x: 12, y: 40 }
    const q = cenaParaLocal(c, v, localParaCena(c, v, p))
    perto(q.x, p.x)
    perto(q.y, p.y)
  })

  it('aplicar recalcula a caixa sem mover o desenho (girada)', () => {
    const c = forma({ shape: 'rect', x: 300, y: 200, rotation: 45 })
    const { vetor } = vetorDaCamada(c)
    // arrasta o canto inferior direito para fora da caixa
    const editado = moverNos(vetor, [{ c: 0, i: 2 }], 60, 40)
    const antes = localParaCena(c, editado, editado.caminhos[0]!.nos[2]!)
    const nova = aplicarVetor(c, editado)
    expect(nova.shape).toBe('path')
    expect(nova.width).toBeCloseTo(260)
    expect(nova.height).toBeCloseTo(140)
    const depois = localParaCena(nova, nova.vetor!, nova.vetor!.caminhos[0]!.nos[2]!)
    perto(antes.x, depois.x, 1e-2)
    perto(antes.y, depois.y, 1e-2)
  })

  it('SVG vira formas path agrupadas por cor', () => {
    const parser = new DOMParser()
    const markup = '<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="#f00"/><rect x="5" y="5" width="5" height="5" fill="#00f"/></svg>'
    const svg = parseCamada({ id: 's', type: 'svg', x: 0, y: 0, width: 100, height: 100, markup }) as CamadaSvg
    const r = formasDoSvg(svg, markup, [svg], parser)!
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ id: 's', shape: 'path', fill: '#ff0000', x: 0, y: 0, width: 50, height: 50 })
    expect(r[1]).toMatchObject({ fill: '#0000ff', x: 50, y: 50 })
    expect(r[0]!.groupId).toBeDefined()
    expect(r[0]!.groupId).toBe(r[1]!.groupId)
  })
})

describe('caneta: fechar o caminho', () => {
  it('o caminho aberto nasce sem preenchimento e, ao fechar, passa a preencher', async () => {
    const { novoCaminho, adicionarNo, fecharCaminho } = await import('./operacoes')
    let { vetor } = novoCaminho({ w: 100, h: 100, fillRule: 'nonzero', caminhos: [{ nos: [{ x: 0, y: 0, tipo: 'canto' }], fechado: false }] }, { x: 10, y: 90 })
    const c = vetor.caminhos.length - 1
    expect(vetor.caminhos[c]!.semPreenchimento).toBe(true)
    vetor = adicionarNo(vetor, c, { x: 50, y: 10 }).vetor
    vetor = adicionarNo(vetor, c, { x: 90, y: 90 }).vetor
    const fechado = fecharCaminho(vetor, c).caminhos[c]!
    expect(fechado.fechado).toBe(true)
    expect(fechado.semPreenchimento).toBeUndefined()
  })
})
