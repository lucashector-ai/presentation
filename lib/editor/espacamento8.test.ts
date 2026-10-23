/**
 * "Ajustar espaçamento (8 px)" numa tela e no documento inteiro (lib/editor/espacamento8.ts): devolve camadas
 * válidas do schema, a mesma tela quando nada muda e o documento continua válido. A regra em si é testada em
 * lib/ia/grade8.test.ts (com as distâncias conferidas como o editor mede).
 */
import { describe, expect, it } from 'vitest'
import { LAYOUT_PADRAO } from './autolayout'
import { ajustarEspacamentoCena, ajustarEspacamentoDocumento } from './espacamento8'
import { novaCena, parseCamada, type DocumentoProjeto } from '@/lib/scene/schema'
import { validarDocumento } from '@/lib/scene/validate'

const cenaTorta = () => novaCena({
  id: 'tela-1', size: { width: 1920, height: 1080 },
  layers: [
    parseCamada({ id: 'cartoes', type: 'frame', x: 160, y: 400, width: 1600, height: 200, z: 0, sizingW: 'fixed', sizingH: 'hug', layout: { ...LAYOUT_PADRAO, direction: 'horizontal', gap: 36 } }),
    parseCamada({ id: 'c1', type: 'frame', parentId: 'cartoes', x: 160, y: 400, width: 400, height: 200, z: 1, fill: '#EEE' }),
    parseCamada({ id: 'c2', type: 'frame', parentId: 'cartoes', x: 596, y: 400, width: 400, height: 200, z: 2, fill: '#EEE' }),
    parseCamada({ id: 'rotulo', type: 'text', x: 160, y: 165, width: 143, height: 29, z: 3, text: 'Receita', fontSize: 24, lineHeight: 1.2, sizingW: 'hug', sizingH: 'hug' }),
    parseCamada({ id: 'barra-1', type: 'shape', x: 363, y: 168, width: 611, height: 24, z: 4, fill: '#06F' }),
  ],
})

describe('ajustarEspacamentoCena / ajustarEspacamentoDocumento', () => {
  it('corrige a tela (36 → 32 entre cartões, rótulo a 56 da barra) com camadas válidas e ids únicos', () => {
    const c = ajustarEspacamentoCena(cenaTorta())
    const p = (id: string) => c.layers.find((l) => l.id === id)!
    const cartoes = p('cartoes')
    expect(cartoes.type === 'frame' ? cartoes.layout?.gap : null).toBe(32)
    expect(p('c2').x - (p('c1').x + p('c1').width)).toBe(32)
    expect(p('barra-1').x - (p('rotulo').x + p('rotulo').width)).toBe(56)
    expect(p('rotulo').sizingW).toBe('fixed')
    expect(new Set(c.layers.map((l) => l.id)).size).toBe(c.layers.length)
    expect(c.layers.map((l) => l.z)).toEqual(c.layers.map((_, i) => i))
  })

  it('tela já no 8: devolve o mesmo objeto (passo de desfazer vazio); documento inteiro válido e só as telas tortas mudam', () => {
    const certa = ajustarEspacamentoCena(cenaTorta())
    expect(ajustarEspacamentoCena(certa)).toBe(certa)
    const doc = { version: 1, mode: 'slides', scenes: [certa, { ...cenaTorta(), id: 'tela-2' }] } as unknown as DocumentoProjeto
    const d2 = ajustarEspacamentoDocumento(doc)
    expect(d2.scenes[0]).toBe(certa)
    expect(d2.scenes[1]).not.toBe(doc.scenes[1])
    expect(validarDocumento(d2).ok).toBe(true)
    expect(ajustarEspacamentoDocumento(d2)).toBe(d2)
  })
})
