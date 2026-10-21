/** Traços, sombras (inclusive realistas), cantos suavizados, restrições, máscaras e formas — lógica pura. */
import { describe, expect, it } from 'vitest'
import { DocumentoProjetoSchema, parseCamada, type Camada, type CamadaForma, type Efeitos } from './schema'
import { caminhoCantos, orcamentoDosCantos, raiosDaCamada, temSuavizacao } from './cantos'
import { TRACO_PADRAO, alcanceExterno, comTracos, deslocamentoDoTraco, pontaSvg, tracejadoSvg, tracosDe, temTraco } from './tracos'
import { boxShadowCss, comSombras, desfoqueDe, dropShadowCss, internas, projetadas, sombrasDe, textShadowCss } from './efeitos'
import { PREDEFINICOES_REALISTA, comSombraRealista, gerarSombrasRealistas } from './sombrasRealistas'
import { aplicarRestricao, converterFormato, propagarRestricoes } from './restricoes'
import { criarMascara, estiloMascara, removerMascara, svgDaMascara } from './mascara'
import { caminhoDaForma, pontosEstrela, pontosPoligono } from './formas'
import { mapaDe } from './arvore'
import { moverNoFluxo, passoDaSeta, areasDeEspaco, calcularLayout, LAYOUT_PADRAO } from '@/lib/editor/autolayout'

const forma = (extra: Record<string, unknown> = {}) => parseCamada({ id: 'f', type: 'shape', x: 0, y: 0, width: 100, height: 50, ...extra }) as CamadaForma

describe('compatibilidade do schema', () => {
  it('documento antigo (sem campos novos) continua válido e igual', () => {
    const doc = { schemaVersion: 2, mode: 'slides', scenes: [{ id: 's', size: { width: 1920, height: 1080 }, layers: [{ id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10, stroke: '#000000', strokeWidth: 2, effects: { shadow: { x: 0, y: 4, blur: 8, spread: 0, color: '#00000040' }, blur: 0, backdropBlur: 0, blend: 'normal' } }] }] }
    const p = DocumentoProjetoSchema.parse(doc)
    const c = p.scenes[0]!.layers[0]!
    expect(c.strokes).toBeUndefined()
    expect(c.effects?.shadows).toBeUndefined()
    expect(c.constraints).toBeUndefined()
  })
  it('aceita os campos novos (traços, sombras, realista, restrições, máscara, polígono)', () => {
    expect(() => parseCamada({ id: 'a', type: 'shape', shape: 'polygon', count: 6, x: 0, y: 0, width: 10, height: 10, cornerSmoothing: 0.6, constraints: { h: 'leftRight', v: 'center' }, strokes: [{ weight: 2, position: 'outside', style: 'dashed' }], effects: { shadows: [{ inner: true }], realistic: {}, blur: 0, backdropBlur: 0, blend: 'soft-light' } })).not.toThrow()
    expect(() => parseCamada({ id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10, strokes: [{ position: 'meio' }] })).toThrow()
  })
})

describe('cantos', () => {
  it('raios efetivos e suavização', () => {
    expect(raiosDaCamada({ radius: 8 })).toEqual([8, 8, 8, 8])
    expect(raiosDaCamada({ radius: 8, radii: [1, 2, 3, 4] })).toEqual([1, 2, 3, 4])
    expect(temSuavizacao({ radius: 0, cornerSmoothing: 0.6 })).toBe(false)
    expect(temSuavizacao({ radius: 8, cornerSmoothing: 0.6 })).toBe(true)
  })
  it('raios maiores que o lado são reduzidos (o maior escolhe primeiro)', () => {
    const o = orcamentoDosCantos(100, 40, [80, 0, 0, 0])
    expect(o.tl.raio).toBeLessThanOrEqual(40)
  })
  it('caminho fecha e respeita o deslocamento (traço de fora cresce a caixa)', () => {
    const d = caminhoCantos(100, 50, [10, 10, 10, 10], 0.6)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    const fora = caminhoCantos(100, 50, [0, 0, 0, 0], 0, 2)
    expect(fora).toContain('M 102 -2')
    expect(fora).toContain('L -2 52')
  })
})

describe('traços', () => {
  it('traço antigo aparece como um traço "dentro"; linha usa a própria espessura e cor', () => {
    expect(tracosDe(forma({ stroke: '#ff0000', strokeWidth: 3, dash: 4 }))).toEqual([expect.objectContaining({ color: '#ff0000', weight: 3, position: 'inside', style: 'dashed', dash: 4 })])
    expect(tracosDe(forma({ shape: 'line', fill: '#123456', height: 6 }))).toEqual([expect.objectContaining({ color: '#123456', weight: 6, position: 'center', cap: 'round' })])
    expect(tracosDe(forma())).toEqual([])
    expect(temTraco(forma({ stroke: '#000000', strokeWidth: 0 }))).toBe(false)
  })
  it('gravar a lista limpa o traço antigo', () => {
    const c = comTracos(forma({ stroke: '#ff0000', strokeWidth: 3, dash: 4 }), [{ ...TRACO_PADRAO, weight: 5 }]) as CamadaForma
    expect(c.stroke).toBeUndefined()
    expect(c.strokeWidth).toBe(0)
    expect(c.strokes?.[0]?.weight).toBe(5)
    expect(() => parseCamada(c)).not.toThrow()
  })
  it('posição, tracejado e alcance para fora', () => {
    expect(deslocamentoDoTraco({ position: 'inside' }, 4)).toBe(-2)
    expect(deslocamentoDoTraco({ position: 'outside' }, 4)).toBe(2)
    expect(tracejadoSvg({ ...TRACO_PADRAO, style: 'dashed', dash: 6, gap: 3 }, 2)).toBe('6 3')
    expect(tracejadoSvg({ ...TRACO_PADRAO, style: 'dotted', gap: 3 }, 2)).toBe('0 5')
    expect(pontaSvg({ ...TRACO_PADRAO, style: 'dotted' })).toBe('round')
    expect(alcanceExterno(forma({ strokes: [{ ...TRACO_PADRAO, weight: 6, position: 'outside' }, { ...TRACO_PADRAO, weight: 4, position: 'center' }] }))).toBe(6)
  })
})

describe('efeitos', () => {
  const base: Efeitos = { blur: 0, backdropBlur: 0, blend: 'normal' }
  it('sombra antiga vira lista; CSS com projetadas e internas', () => {
    const e: Efeitos = { ...base, shadow: { x: 0, y: 4, blur: 8, spread: 0, color: '#00000040' } }
    expect(sombrasDe(e)).toHaveLength(1)
    expect(boxShadowCss(sombrasDe(e))).toBe('0px 4px 8px 0px #00000040')
    const lista = comSombras(e, [{ x: 0, y: 2, blur: 4, spread: 0, color: '#000000', inner: true }, { x: 1, y: 1, blur: 0, spread: 0, color: '#ff0000', hidden: true }, ...sombrasDe(e)])
    expect(lista.shadow).toBeUndefined()
    expect(internas(lista)).toHaveLength(1)
    expect(projetadas(lista)).toHaveLength(1)
    expect(boxShadowCss(sombrasDe(lista))).toBe('inset 0px 2px 4px 0px #000000, 0px 4px 8px 0px #00000040')
    expect(dropShadowCss(sombrasDe(lista))).toBe('drop-shadow(0px 4px 4px #00000040)')
    expect(textShadowCss(sombrasDe(lista))).toBe('0px 4px 8px #00000040')
  })
  it('olho do desfoque', () => {
    expect(desfoqueDe({ ...base, blur: 6 })).toBe(6)
    expect(desfoqueDe({ ...base, blur: 6, blurHidden: true })).toBe(0)
  })
})

describe('sombra realista', () => {
  it('gera N camadas com distância dobrando até a elevação, do lado oposto à luz', () => {
    const s = gerarSombrasRealistas({ light: { x: -1, y: -1 }, elevation: 32, layers: 4 })
    expect(s).toHaveLength(4)
    expect(s.every((x) => x.realistic)).toBe(true)
    // luz em cima à esquerda → sombra para baixo e para a direita, crescendo
    expect(s[3]!.x).toBe(32)
    expect(s[0]!.x).toBe(4)
    expect(s.every((x, i) => i === 0 || x.blur > s[i - 1]!.blur)).toBe(true)
    expect(s.every((x) => /^#[0-9A-F]{8}$/.test(x.color))).toBe(true)
  })
  it('luz no centro: sombra embaixo da camada, sem deslocamento lateral', () => {
    const s = gerarSombrasRealistas({ light: { x: 0, y: 0 } })
    expect(s.every((x) => x.x === 0)).toBe(true)
  })
  it('regerar troca só as camadas geradas e mantém as sombras manuais', () => {
    const manual = { x: 0, y: 1, blur: 2, spread: 0, color: '#FF0000FF' }
    const e1 = comSombraRealista({ blur: 0, backdropBlur: 0, blend: 'normal', shadows: [manual] }, { ...PREDEFINICOES_REALISTA[0]!.ajustes, light: { x: 0, y: -1 }, elevation: 8, intensity: 0.5, softness: 0.5, layers: 3, color: '#000000' })
    expect(e1.shadows).toHaveLength(4)
    const e2 = comSombraRealista(e1, { ...e1.realistic!, layers: 5 })
    expect(e2.shadows!.filter((s) => s.realistic)).toHaveLength(5)
    expect(e2.shadows!.filter((s) => !s.realistic)).toEqual([manual])
    const e3 = comSombraRealista(e2, undefined)
    expect(e3.shadows).toEqual([manual])
    expect(e3.realistic).toBeUndefined()
  })
  it('intensidade 0 = sombras transparentes', () => {
    expect(gerarSombrasRealistas({ intensity: 0 }).every((s) => s.color.endsWith('00'))).toBe(true)
  })
})

describe('restrições', () => {
  const pai = { x: 0, y: 0, width: 100, height: 100 }
  const novo = { x: 0, y: 0, width: 200, height: 100 }
  const filho = { x: 70, y: 10, width: 20, height: 20 }
  it('cada modo horizontal', () => {
    expect(aplicarRestricao(filho, pai, novo, { h: 'left', v: 'top' }).x).toBe(70)
    expect(aplicarRestricao(filho, pai, novo, { h: 'right', v: 'top' }).x).toBe(170)
    expect(aplicarRestricao(filho, pai, novo, { h: 'leftRight', v: 'top' })).toMatchObject({ x: 70, width: 120 })
    expect(aplicarRestricao(filho, pai, novo, { h: 'center', v: 'top' }).x).toBe(120)
    expect(aplicarRestricao(filho, pai, novo, { h: 'scale', v: 'top' })).toMatchObject({ x: 140, width: 40 })
  })
  it('redimensionar um frame livre move os filhos com restrição (e não os sem restrição)', () => {
    const antes = [
      parseCamada({ id: 'fr', type: 'frame', x: 0, y: 0, width: 100, height: 100 }),
      parseCamada({ id: 'a', type: 'shape', parentId: 'fr', x: 70, y: 10, width: 20, height: 20, constraints: { h: 'right', v: 'top' } }),
      parseCamada({ id: 'b', type: 'shape', parentId: 'fr', x: 70, y: 10, width: 20, height: 20 }),
    ]
    const depois = antes.map((c) => (c.id === 'fr' ? { ...c, width: 200 } : c)) as Camada[]
    const r = propagarRestricoes(antes, depois)
    expect(r.find((c) => c.id === 'a')!.x).toBe(170)
    expect(r.find((c) => c.id === 'b')!.x).toBe(70)
  })
  it('converter formato da tela: "manter" deixa camadas sem restrição onde estão', () => {
    const ls = [parseCamada({ id: 'a', type: 'shape', x: 1800, y: 1000, width: 100, height: 50, constraints: { h: 'right', v: 'bottom' } }), parseCamada({ id: 'b', type: 'shape', x: 10, y: 10, width: 10, height: 10 })]
    const r = converterFormato(ls, { width: 1920, height: 1080 }, { width: 1080, height: 1920 }, 'manter')
    expect(r.find((c) => c.id === 'a')).toMatchObject({ x: 960, y: 1840 })
    expect(r.find((c) => c.id === 'b')).toMatchObject({ x: 10, y: 10 })
  })
})

describe('máscara', () => {
  const foto = parseCamada({ id: 'foto', type: 'image', assetId: 'x', x: 0, y: 0, width: 200, height: 100, z: 2 })
  const circulo = parseCamada({ id: 'c', type: 'shape', shape: 'ellipse', x: 50, y: 0, width: 100, height: 100, z: 1 })
  it('a camada de baixo (forma) vira máscara, como no Figma', () => {
    const r = criarMascara([foto, circulo], ['foto', 'c'], ['foto', 'c'], 'g1')!
    expect(r.find((c) => c.id === 'c')).toMatchObject({ isMask: true, groupId: 'g1' })
    expect(r.find((c) => c.id === 'foto')).toMatchObject({ maskId: 'c', groupId: 'g1' })
    const est = estiloMascara(r.find((c) => c.id === 'foto')!, mapaDe(r))
    expect(est?.maskImage).toContain('data:image/svg+xml')
    const desfeito = removerMascara(r, ['foto'])
    expect(desfeito.every((c) => !c.maskId && !(c as CamadaForma).isMask && !c.groupId)).toBe(true)
  })
  it('sem forma na seleção não cria máscara; SVG da máscara no quadro da camada', () => {
    expect(criarMascara([foto], ['foto'], ['foto'], 'g')).toBeNull()
    const svg = svgDaMascara(foto, circulo as CamadaForma)!
    expect(svg).toContain('viewBox="0 0 200 100"')
    expect(svg).toContain('translate(100 50)')
  })
})

describe('formas', () => {
  it('polígono ocupa a caixa inteira (como no Figma); estrela antiga não muda', () => {
    const tri = pontosPoligono(100, 100, 3)
    expect(tri[0]).toEqual([50, 0])
    expect(Math.max(...tri.map((p) => p[1]))).toBeCloseTo(100)
    expect(Math.min(...tri.map((p) => p[0]))).toBeCloseTo(0)
    const est = pontosEstrela(100, 100)
    expect(est).toHaveLength(10)
    expect(est[1]![0]).toBeCloseTo(50 + Math.cos(-Math.PI / 2 + Math.PI / 5) * 20)
    expect(pontosEstrela(100, 100, 8, 0.5)).toHaveLength(16)
    expect(caminhoDaForma({ shape: 'polygon', width: 10, height: 10, radius: 0, count: 4 })).toMatch(/^M .* Z$/)
    expect(caminhoDaForma({ shape: 'line', width: 10, height: 10, radius: 0 })).toBeNull()
  })
})

describe('auto layout pelo teclado', () => {
  const ls = () => calcularLayout([
    parseCamada({ id: 'f', type: 'frame', x: 0, y: 0, width: 400, height: 100, layout: { ...LAYOUT_PADRAO, gap: 10, padding: { top: 5, right: 5, bottom: 5, left: 5 } } }),
    parseCamada({ id: 'a', type: 'shape', parentId: 'f', x: 0, y: 0, width: 40, height: 40, z: 0 }),
    parseCamada({ id: 'b', type: 'shape', parentId: 'f', x: 0, y: 0, width: 40, height: 40, z: 1 }),
    parseCamada({ id: 'c', type: 'shape', parentId: 'f', x: 0, y: 0, width: 40, height: 40, z: 2 }),
  ])
  it('a seta na direção do fluxo reordena; a perpendicular não', () => {
    expect(passoDaSeta('horizontal', 'ArrowRight')).toBe(1)
    expect(passoDaSeta('horizontal', 'ArrowUp')).toBe(0)
    expect(passoDaSeta('vertical', 'ArrowUp')).toBe(-1)
    expect(passoDaSeta('wrap', 'ArrowDown')).toBe(1)
  })
  it('→ troca com o próximo; nas pontas nada muda', () => {
    const r = calcularLayout(moverNoFluxo(ls(), ['a'], 1))
    const xs = Object.fromEntries(r.filter((c) => c.parentId).map((c) => [c.id, c.x]))
    expect(xs.b).toBeLessThan(xs.a!)
    expect(xs.a).toBeLessThan(xs.c!)
    const fim = ls()
    expect(moverNoFluxo(fim, ['c'], 1)).toBe(fim)
    expect(moverNoFluxo(fim, ['a'], -1)).toBe(fim)
  })
  it('bloco de vários itens anda junto', () => {
    const r = calcularLayout(moverNoFluxo(ls(), ['a', 'b'], 1))
    const ordem = r.filter((c) => c.parentId).sort((x, y) => x.x - y.x).map((c) => c.id)
    expect(ordem).toEqual(['c', 'a', 'b'])
  })
  it('áreas do gap e do padding para o destaque', () => {
    const r = ls()
    const f = r.find((c) => c.id === 'f')!
    if (f.type !== 'frame') throw new Error('frame')
    expect(areasDeEspaco(f, r, 'gap')).toHaveLength(2)
    expect(areasDeEspaco(f, r, 'gap')[0]).toMatchObject({ x: 45, width: 10 })
    expect(areasDeEspaco(f, r, 'padding')).toHaveLength(4)
  })
})
