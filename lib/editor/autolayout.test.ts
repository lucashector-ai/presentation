import { describe, expect, it } from 'vitest'
import { parseCamada, type AutoLayout, type Camada } from '@/lib/scene/schema'
import { calcularLayout, indiceDeInsercao, inferirLayout, inserirNoFrame, moverNaLista, resolverCamadas, LAYOUT_PADRAO } from './autolayout'
import { alvoDoClique, comDescendentes, normalizarArvore, ocultasEfetivas } from '@/lib/scene/arvore'

let z = 0
const forma = (id: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'shape', x, y, width: w, height: h, z: z++, ...extra })
const frame = (id: string, x: number, y: number, w: number, h: number, layout?: Partial<AutoLayout>, extra: Record<string, unknown> = {}) =>
  parseCamada({ id, type: 'frame', x, y, width: w, height: h, z: z++, ...(layout ? { layout: { ...LAYOUT_PADRAO, ...layout } } : {}), ...extra })
const caixa = (cs: Camada[], id: string) => { const c = cs.find((l) => l.id === id)!; return { x: c.x, y: c.y, w: c.width, h: c.height } }

describe('calcularLayout', () => {
  it('sem frames devolve a mesma lista (documentos antigos não mudam)', () => {
    const ls = [forma('a', 1, 2, 3, 4)]
    expect(calcularLayout(ls)).toBe(ls)
  })

  it('horizontal com gap e padding, frame abraça o conteúdo (hug)', () => {
    const ls = [
      frame('f', 100, 50, 10, 10, { gap: 10, padding: { top: 5, right: 20, bottom: 5, left: 20 } }, { sizingW: 'hug', sizingH: 'hug' }),
      forma('a', 0, 0, 40, 30, { parentId: 'f' }),
      forma('b', 0, 0, 60, 20, { parentId: 'f' }),
    ]
    const r = calcularLayout(ls)
    expect(caixa(r, 'f')).toEqual({ x: 100, y: 50, w: 20 + 40 + 10 + 60 + 20, h: 5 + 30 + 5 })
    expect(caixa(r, 'a')).toEqual({ x: 120, y: 55, w: 40, h: 30 })
    expect(caixa(r, 'b')).toEqual({ x: 170, y: 55, w: 60, h: 20 })
  })

  it('é idempotente (resolver duas vezes não muda nada)', () => {
    const ls = [frame('f', 0, 0, 300, 100, { gap: 7, alignX: 'center', alignY: 'center' }), forma('a', 0, 0, 33, 33, { parentId: 'f' }), forma('b', 0, 0, 41, 20, { parentId: 'f' })]
    const r1 = calcularLayout(ls)
    expect(calcularLayout(r1)).toBe(r1)
  })

  it('vertical com alinhamento 3×3 (centro/fim) em frame fixo', () => {
    const ls = [frame('f', 0, 0, 200, 300, { direction: 'vertical', gap: 20, alignX: 'center', alignY: 'end' }), forma('a', 0, 0, 100, 50, { parentId: 'f' }), forma('b', 0, 0, 40, 30, { parentId: 'f' })]
    const r = calcularLayout(ls)
    // conteúdo 50+20+30 = 100 → começa em 300-100
    expect(caixa(r, 'a')).toEqual({ x: 50, y: 200, w: 100, h: 50 })
    expect(caixa(r, 'b')).toEqual({ x: 80, y: 270, w: 40, h: 30 })
  })

  it('fill divide o espaço restante e o eixo cruzado preenche a área interna', () => {
    const ls = [
      frame('f', 0, 0, 400, 100, { gap: 10, padding: { top: 10, right: 10, bottom: 10, left: 10 } }),
      forma('a', 0, 0, 80, 20, { parentId: 'f' }),
      forma('b', 0, 0, 1, 20, { parentId: 'f', sizingW: 'fill', sizingH: 'fill' }),
      forma('c', 0, 0, 1, 20, { parentId: 'f', sizingW: 'fill' }),
    ]
    const r = calcularLayout(ls)
    // interno 380; restante 380 - 80 - 20 = 280 → 140 cada
    expect(caixa(r, 'a')).toEqual({ x: 10, y: 10, w: 80, h: 20 })
    expect(caixa(r, 'b')).toEqual({ x: 100, y: 10, w: 140, h: 80 })
    expect(caixa(r, 'c')).toEqual({ x: 250, y: 10, w: 140, h: 20 })
  })

  it('fill com divisão fracionária fica em pixels inteiros sem buracos', () => {
    const ls = [frame('f', 0, 0, 100, 10), ...['a', 'b', 'c'].map((id) => forma(id, 0, 0, 1, 10, { parentId: 'f', sizingW: 'fill' }))]
    const r = calcularLayout([...ls.slice(0, 1), ...ls.slice(1).map((l) => l)].map((l, i) => (i === 0 ? { ...l, layout: { ...LAYOUT_PADRAO, gap: 0 } } : l)) as Camada[])
    const xs = ['a', 'b', 'c'].map((id) => caixa(r, id))
    expect(xs.every((b) => Number.isInteger(b.x) && Number.isInteger(b.w))).toBe(true)
    expect(xs[0]!.x).toBe(0)
    expect(xs[1]!.x).toBe(xs[0]!.x + xs[0]!.w)
    expect(xs[2]!.x + xs[2]!.w).toBe(100)
  })

  it('gap automático (space-between)', () => {
    const ls = [frame('f', 0, 0, 300, 50, { gapAuto: true }), forma('a', 0, 0, 50, 50, { parentId: 'f' }), forma('b', 0, 0, 50, 50, { parentId: 'f' }), forma('c', 0, 0, 50, 50, { parentId: 'f' })]
    const r = calcularLayout(ls)
    expect(['a', 'b', 'c'].map((id) => caixa(r, id).x)).toEqual([0, 125, 250])
  })

  it('wrap quebra linhas e o frame abraça a altura', () => {
    const ls = [
      frame('f', 0, 0, 230, 10, { direction: 'wrap', gap: 10, rowGap: 20 }, { sizingH: 'hug' }),
      ...['a', 'b', 'c', 'd', 'e'].map((id) => forma(id, 0, 0, 70, 40, { parentId: 'f' })),
    ]
    const r = calcularLayout(ls)
    // 3 por linha (70*3 + 20 = 230)
    expect(['a', 'b', 'c', 'd', 'e'].map((id) => [caixa(r, id).x, caixa(r, id).y])).toEqual([[0, 0], [80, 0], [160, 0], [0, 60], [80, 60]])
    expect(caixa(r, 'f').h).toBe(100)
  })

  it('filhos absolutos e ocultos não ocupam espaço', () => {
    const ls = [
      frame('f', 0, 0, 10, 10, { gap: 10 }, { sizingW: 'hug', sizingH: 'hug' }),
      forma('a', 0, 0, 50, 50, { parentId: 'f' }),
      forma('abs', 500, 500, 20, 20, { parentId: 'f', absolute: true }),
      forma('oculto', 0, 0, 999, 999, { parentId: 'f', hidden: true }),
      forma('b', 0, 0, 50, 50, { parentId: 'f' }),
    ]
    const r = calcularLayout(ls)
    expect(caixa(r, 'f')).toEqual({ x: 0, y: 0, w: 110, h: 50 })
    expect(caixa(r, 'b').x).toBe(60)
    expect(caixa(r, 'abs')).toEqual({ x: 500, y: 500, w: 20, h: 20 })
  })

  it('aninhado: frame hug dentro de frame vertical; mover o pai leva os netos', () => {
    const ls = [
      frame('pai', 0, 0, 10, 10, { direction: 'vertical', gap: 8, padding: { top: 4, right: 4, bottom: 4, left: 4 } }, { sizingW: 'hug', sizingH: 'hug' }),
      frame('linha', 0, 0, 10, 10, { gap: 2 }, { parentId: 'pai', sizingW: 'hug', sizingH: 'hug' }),
      forma('x', 0, 0, 10, 10, { parentId: 'linha' }),
      forma('y', 0, 0, 20, 10, { parentId: 'linha' }),
      forma('rodape', 0, 0, 50, 6, { parentId: 'pai' }),
    ]
    const r = calcularLayout(ls)
    expect(caixa(r, 'linha')).toEqual({ x: 4, y: 4, w: 32, h: 10 })
    expect(caixa(r, 'y')).toEqual({ x: 16, y: 4, w: 20, h: 10 })
    expect(caixa(r, 'rodape')).toEqual({ x: 4, y: 22, w: 50, h: 6 })
    expect(caixa(r, 'pai')).toEqual({ x: 0, y: 0, w: 58, h: 32 })
    const movido = resolverCamadas(r, r.map((c) => (c.id === 'pai' ? { ...c, x: 100, y: 200 } : c)))
    expect(caixa(movido, 'y')).toEqual({ x: 116, y: 204, w: 20, h: 10 })
  })

  it('frame com fill dentro de auto layout distribui os próprios filhos', () => {
    const ls = [
      frame('pai', 0, 0, 300, 100, { gap: 0 }),
      frame('cartao', 0, 0, 1, 1, { direction: 'vertical', alignX: 'center' }, { parentId: 'pai', sizingW: 'fill', sizingH: 'fill' }),
      forma('icone', 0, 0, 20, 20, { parentId: 'cartao' }),
    ]
    const r = calcularLayout(ls)
    expect(caixa(r, 'cartao')).toEqual({ x: 0, y: 0, w: 300, h: 100 })
    expect(caixa(r, 'icone')).toEqual({ x: 140, y: 0, w: 20, h: 20 })
  })

  it('frame livre (sem auto layout) dentro de auto layout move os filhos junto', () => {
    const ls = [frame('pai', 100, 0, 300, 100, { padding: { top: 10, right: 0, bottom: 0, left: 10 } }), frame('livre', 0, 0, 50, 50, undefined, { parentId: 'pai' }), forma('k', 5, 5, 10, 10, { parentId: 'livre' })]
    const r = calcularLayout(ls)
    expect(caixa(r, 'livre')).toEqual({ x: 110, y: 10, w: 50, h: 50 })
    expect(caixa(r, 'k')).toEqual({ x: 115, y: 15, w: 10, h: 10 })
  })
})

describe('resolverCamadas', () => {
  it('mudança explícita de largura troca hug por fixo', () => {
    const ls = calcularLayout([frame('f', 0, 0, 10, 10, {}, { sizingW: 'hug', sizingH: 'hug' }), forma('a', 0, 0, 40, 40, { parentId: 'f' })])
    const r = resolverCamadas(ls, ls.map((c) => (c.id === 'f' ? { ...c, width: 200 } : c)))
    const f = r.find((c) => c.id === 'f')!
    expect(f.sizingW).toBe('fixed')
    expect(f.sizingH).toBe('hug')
    expect(f.width).toBe(200)
  })
  it('texto solto (sem frames) com largura automática redimensionado vira altura automática', () => {
    const t = parseCamada({ id: 't', type: 'text', text: 'oi', x: 0, y: 0, width: 100, height: 10, sizingW: 'hug', sizingH: 'hug' })
    const r = resolverCamadas([t], [{ ...t, width: 60 } as Camada])
    expect([r[0]!.sizingW, r[0]!.sizingH]).toEqual(['fixed', 'hug'])
    const igual = [forma('s', 0, 0, 5, 5)]
    expect(resolverCamadas([forma('s', 1, 0, 5, 5)], igual)).toBe(igual)
  })
  it('medição de texto mantém o modo (manterDimensionamento)', () => {
    const t = parseCamada({ id: 't', type: 'text', text: 'oi', x: 0, y: 0, width: 10, height: 10, sizingW: 'hug', sizingH: 'hug' })
    const ls = [frame('f', 0, 0, 10, 10), { ...t, parentId: 'f' } as Camada]
    const r = resolverCamadas(ls, ls.map((c) => (c.id === 't' ? { ...c, width: 33 } : c)), { manterDimensionamento: true })
    expect(r.find((c) => c.id === 't')!.sizingW).toBe('hug')
  })
  it('redimensionar o frame refaz o fluxo (fill acompanha)', () => {
    const ls = calcularLayout([frame('f', 0, 0, 100, 20, { gap: 0 }), forma('a', 0, 0, 1, 20, { parentId: 'f', sizingW: 'fill' })])
    const r = resolverCamadas(ls, ls.map((c) => (c.id === 'f' ? { ...c, width: 250 } : c)))
    expect(caixa(r, 'a').w).toBe(250)
  })
})

describe('reordenar e inserir', () => {
  it('índice de inserção e linha azul no fluxo horizontal', () => {
    const ls = calcularLayout([frame('f', 0, 0, 10, 10, { gap: 10 }, { sizingW: 'hug', sizingH: 'hug' }), forma('a', 0, 0, 50, 50, { parentId: 'f' }), forma('b', 0, 0, 50, 50, { parentId: 'f' })])
    const f = ls.find((c) => c.id === 'f')! as Extract<Camada, { type: 'frame' }>
    expect(indiceDeInsercao(f, ls, { x: 10, y: 10 }).indice).toBe(0)
    const meio = indiceDeInsercao(f, ls, { x: 56, y: 10 })
    expect(meio.indice).toBe(1)
    expect(meio.linha).toEqual({ eixo: 'v', pos: 55, de: 0, ate: 50 })
    expect(indiceDeInsercao(f, ls, { x: 200, y: 10 }).indice).toBe(2)
  })
  it('inserirNoFrame reordena o fluxo e muda o pai', () => {
    let ls: Camada[] = [frame('f', 0, 0, 10, 10, { gap: 0 }, { sizingW: 'hug', sizingH: 'hug' }), forma('a', 0, 0, 10, 10, { parentId: 'f' }), forma('b', 0, 0, 20, 10, { parentId: 'f' }), forma('solta', 300, 300, 30, 10)]
    ls = calcularLayout(inserirNoFrame(ls, 'b', 'f', 0))
    expect(caixa(ls, 'b').x).toBe(0)
    expect(caixa(ls, 'a').x).toBe(20)
    ls = calcularLayout(inserirNoFrame(ls, 'solta', 'f', 1))
    expect(ls.find((c) => c.id === 'solta')!.parentId).toBe('f')
    expect(caixa(ls, 'solta').x).toBe(20)
    expect(caixa(ls, 'f').w).toBe(60)
    ls = calcularLayout(inserirNoFrame(ls, 'a', undefined))
    expect(ls.find((c) => c.id === 'a')!.parentId).toBeUndefined()
    expect(caixa(ls, 'f').w).toBe(50)
  })
  it('inferirLayout lê direção, gap e alinhamento do arranjo', () => {
    const { layout, ordem } = inferirLayout([{ x: 200, y: 10, width: 50, height: 30 }, { x: 0, y: 0, width: 50, height: 50 }, { x: 70, y: 5, width: 100, height: 40 }])
    expect(layout.direction).toBe('horizontal')
    expect(ordem).toEqual([1, 2, 0])
    expect(layout.gap).toBe(25)
    expect(layout.alignY).toBe('center')
  })
})

describe('árvore de camadas', () => {
  it('normaliza empilhamento: frame logo abaixo dos filhos', () => {
    const ls = [forma('a', 0, 0, 1, 1, { z: 0, parentId: 'f' }), forma('solta', 0, 0, 1, 1, { z: 1 }), frame('f', 0, 0, 1, 1, undefined, { z: 2 })]
    const r = normalizarArvore(ls)
    const zz = Object.fromEntries(r.map((c) => [c.id, c.z]))
    expect(zz.solta).toBeLessThan(zz.f!)
    expect(zz.f).toBeLessThan(zz.a!)
  })
  it('remove parentId órfão e resiste a ciclos', () => {
    const r = normalizarArvore([forma('a', 0, 0, 1, 1, { parentId: 'nao-existe' }), frame('p', 0, 0, 1, 1, undefined, { parentId: 'q' }), frame('q', 0, 0, 1, 1, undefined, { parentId: 'p' })])
    expect(r.find((c) => c.id === 'a')!.parentId).toBeUndefined()
    expect(r).toHaveLength(3)
    expect(calcularLayout(r)).toHaveLength(3)
  })
  it('clique seleciona o frame externo; com irmão selecionado fica no nível de dentro', () => {
    const ls = [frame('f', 0, 0, 100, 100), forma('a', 0, 0, 10, 10, { parentId: 'f' }), forma('b', 20, 0, 10, 10, { parentId: 'f' })]
    const b = ls[2]!
    expect(alvoDoClique(b, ls, []).id).toBe('f')
    expect(alvoDoClique(b, ls, ['a']).id).toBe('b')
    expect(alvoDoClique(b, ls, ['f']).id).toBe('f')
    expect(alvoDoClique(b, ls, [], true).id).toBe('b')
  })
  it('descendentes e ocultação herdada', () => {
    const ls = [frame('f', 0, 0, 1, 1, undefined, { hidden: true }), frame('g', 0, 0, 1, 1, undefined, { parentId: 'f' }), forma('a', 0, 0, 1, 1, { parentId: 'g' })]
    expect(comDescendentes(['f'], ls).sort()).toEqual(['a', 'f', 'g'])
    expect([...ocultasEfetivas(ls)].sort()).toEqual(['a', 'f', 'g'])
  })
})

describe('painel de camadas', () => {
  it('moverNaLista: acima/abaixo do alvo e dentro de frame', () => {
    let ls: Camada[] = [frame('f', 0, 0, 10, 10, { gap: 0 }, { sizingW: 'hug', sizingH: 'hug', z: 0 }), forma('a', 0, 0, 10, 10, { parentId: 'f', z: 1 }), forma('b', 0, 0, 20, 10, { parentId: 'f', z: 2 }), forma('solta', 300, 300, 30, 10, { z: 3 })]
    ls = calcularLayout(moverNaLista(ls, 'a', 'b', 'acima'))
    expect(caixa(ls, 'b').x).toBe(0)
    expect(caixa(ls, 'a').x).toBe(20)
    ls = calcularLayout(moverNaLista(ls, 'solta', 'b', 'abaixo'))
    expect(ls.find((c) => c.id === 'solta')!.parentId).toBe('f')
    expect(caixa(ls, 'solta').x).toBe(0)
    // um frame não entra num filho dele
    expect(moverNaLista(ls, 'f', 'a', 'acima').find((c) => c.id === 'f')!.parentId).toBeUndefined()
  })
})
