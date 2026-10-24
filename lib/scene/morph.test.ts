import { describe, expect, it } from 'vitest'
import { novaCena, parseCamada, type Cena } from './schema'
import { pareamentoMorph, resolverTransicao, telasComObjeto, temMovimento } from './morph'

const ret = (id: string, x: number, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'shape', x, y: 100, width: 200, height: 200, ...extra })
const tela = (id: string, layers: ReturnType<typeof ret>[]): Cena => novaCena({ id, size: { width: 1920, height: 1080 }, layers })

describe('mesmo objeto entre telas', () => {
  it('casa pelo ID (cópia ou tela duplicada) e anima quando mudou de lugar', () => {
    const a = tela('a', [ret('caixa', 100)])
    const b = tela('b', [ret('caixa', 900)])
    expect(pareamentoMorph(a, b).get('caixa')?.x).toBe(100)
    expect(temMovimento(a, b)).toBe(true)
    expect(resolverTransicao(a, b, undefined).type).toBe('morph')
  })
  it('sem nada para mover, a automática vira fade; transição escolhida é respeitada', () => {
    const a = tela('a', [ret('caixa', 100)])
    const b = tela('b', [ret('caixa', 100)])
    expect(resolverTransicao(a, b, undefined).type).toBe('fade')
    expect(resolverTransicao(a, tela('c', [ret('caixa', 500)]), { type: 'slide', duration: 500, easing: 'easeInOut' }).type).toBe('slide')
  })
  it('casa pelo nome só quando ele é único nas duas telas', () => {
    const a = tela('a', [ret('r1', 0, { name: 'Logo' }), ret('r2', 0, { name: 'Caixa' }), ret('r3', 0, { name: 'Caixa' })])
    const b = tela('b', [ret('s1', 50, { name: 'logo' }), ret('s2', 50, { name: 'Caixa' })])
    const pares = pareamentoMorph(a, b)
    expect(pares.get('s1')?.id).toBe('r1')
    expect(pares.has('s2')).toBe(false)
  })
  it('"Animar entre telas" desligado numa tela: o objeto entra parado', () => {
    const a = tela('a', [ret('caixa', 100)])
    const b = tela('b', [ret('caixa', 900, { morph: false })])
    expect(pareamentoMorph(a, b).size).toBe(0)
    expect(resolverTransicao(a, b, undefined).type).toBe('fade')
  })
  it('lista as outras telas em que o objeto aparece', () => {
    const c = ret('caixa', 0)
    const doc = { schemaVersion: 2 as const, mode: 'slides' as const, scenes: [tela('a', [c]), tela('b', []), tela('c', [ret('caixa', 9)])] }
    expect(telasComObjeto(doc, 'a', c).map((s) => s.id)).toEqual(['c'])
  })
})
