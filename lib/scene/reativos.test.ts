import { describe, expect, it } from 'vitest'
import { CenaSchema, parseCamada, type Camada } from './schema'
import { parseDocumento } from './migrar'
import { DOC_ATLAS } from '@/lib/demo/dados'
import { PARALLAX_PX, deslocamentoMouse, deslocamentoRolagem, passoSuave, ponteiroSimulado, profundidadeAutomatica, semProfundidade, temInterativo, transformTilt } from './reativos'

const forma = (id: string, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'shape', x: 0, y: 0, width: 200, height: 200, ...extra })

describe('schema: efeitos interativos', () => {
  it('são opcionais e retrocompatíveis (documentos antigos continuam válidos)', () => {
    expect(() => parseDocumento(DOC_ATLAS)).not.toThrow()
    const c = forma('a')
    expect(c.interactiveEffects).toBeUndefined()
    expect(temInterativo(c)).toBe(false)
  })
  it('aceita parallax, tilt e luz e rejeita valores fora da faixa', () => {
    const c = forma('a', { interactiveEffects: { parallax: { depth: -40, axis: 'x' }, tilt: { angle: 8 }, spotlight: { mode: 'dark', size: 50 } } })
    expect(temInterativo(c)).toBe(true)
    expect(() => forma('b', { interactiveEffects: { parallax: { depth: 140 } } })).toThrow()
    expect(() => forma('b', { interactiveEffects: { tilt: { angle: 0 } } })).toThrow()
  })
  it('profundidade zero não conta como efeito', () => {
    expect(temInterativo(forma('a', { interactiveEffects: { parallax: { depth: 0 } } }))).toBe(false)
  })
})

describe('parallax', () => {
  it('pelo mouse: perto anda ao contrário do mouse, longe a favor e menos; no máximo PARALLAX_PX.mouse', () => {
    const [x, y] = deslocamentoMouse({ depth: 100 }, 1, -1)
    expect(x).toBe(-PARALLAX_PX.mouse)
    expect(y).toBe(PARALLAX_PX.mouse)
    const [xl] = deslocamentoMouse({ depth: -50 }, 1, 0)
    expect(xl).toBe(PARALLAX_PX.mouse / 2)
    expect(deslocamentoMouse({ depth: 60 }, 0, 0)).toEqual([0, 0])
  })
  it('respeita o eixo escolhido', () => {
    expect(deslocamentoMouse({ depth: 100, axis: 'x' }, 1, 1)[1]).toBe(0)
    expect(deslocamentoMouse({ depth: 100, axis: 'y' }, 1, 1)[0]).toBe(0)
  })
  it('na rolagem: simétrico em volta do meio da passagem (o mesmo do keyframe plx-rolagem, ±80 px)', () => {
    expect(deslocamentoRolagem({ depth: 100 }, 0)).toBe(80)
    expect(deslocamentoRolagem({ depth: 100 }, 1)).toBe(-80)
    expect(deslocamentoRolagem({ depth: 100 }, 0.5)).toBe(0)
    expect(deslocamentoRolagem({ depth: -50 }, 0)).toBe(-40)
  })
})

describe('tilt', () => {
  it('em repouso é a identidade (sem giro nem escala)', () => {
    expect(transformTilt({ angle: 10 }, 0.9, 0.1, 0)).toBe('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)')
  })
  it('o lado sob o mouse afunda, até o ângulo máximo', () => {
    expect(transformTilt({ angle: 10, scale: 1.05 }, 1, 0, 1)).toBe('perspective(1000px) rotateX(10deg) rotateY(10deg) scale(1.05)')
    expect(transformTilt({ angle: 10 }, 0, 1, 1)).toContain('rotateX(-10deg) rotateY(-10deg)')
  })
})

describe('movimento suave e ponteiro simulado', () => {
  it('suavidade 0 cola no alvo; 1 anda pouco por quadro; quadros longos andam mais', () => {
    expect(passoSuave(0)).toBeCloseTo(1)
    expect(passoSuave(1)).toBeLessThan(0.1)
    expect(passoSuave(0.5, 33.3)).toBeGreaterThan(passoSuave(0.5, 16.7))
  })
  it('o ponteiro simulado começa e termina no centro e fica dentro da camada', () => {
    expect(ponteiroSimulado(0)).toEqual([0.5, 0.5])
    expect(ponteiroSimulado(1)).toEqual([0.5, 0.5])
    for (let t = 0; t <= 1; t += 0.05) {
      const [x, y] = ponteiroSimulado(t)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
  })
})

describe('profundidade automática da tela', () => {
  const cena = CenaSchema.parse({
    id: 'c', size: { width: 1920, height: 1080 },
    layers: [
      forma('fundo', { width: 1920, height: 1080 }),
      parseCamada({ id: 'titulo', type: 'text', text: 'Título', x: 100, y: 100, width: 1200, height: 160, fontSize: 120 }),
      parseCamada({ id: 'apoio', type: 'text', text: 'Texto de apoio', x: 100, y: 400, width: 800, height: 60, fontSize: 36 }),
      forma('ponto', { width: 80, height: 80, interactiveEffects: { tilt: { angle: 6 } } }),
      forma('h', { hidden: true }),
    ],
  })
  const depth = (cs: Camada[], id: string) => cs.find((c) => c.id === id)?.interactiveEffects?.parallax?.depth
  it('fundo longe, título à frente, apoio um pouco à frente; camada oculta de fora; mantém o tilt', () => {
    const r = profundidadeAutomatica(cena)
    expect(depth(r, 'fundo')).toBeLessThan(0)
    expect(depth(r, 'titulo')).toBeGreaterThan(depth(r, 'apoio')!)
    expect(depth(r, 'apoio')).toBeGreaterThan(0)
    expect(depth(r, 'h')).toBeUndefined()
    expect(r.find((c) => c.id === 'ponto')?.interactiveEffects?.tilt).toEqual({ angle: 6 })
  })
  it('tirar a profundidade remove só o parallax', () => {
    const r = semProfundidade(profundidadeAutomatica(cena))
    expect(r.every((c) => !c.interactiveEffects?.parallax)).toBe(true)
    expect(r.find((c) => c.id === 'ponto')?.interactiveEffects).toEqual({ tilt: { angle: 6 } })
    expect(r.find((c) => c.id === 'fundo')).not.toHaveProperty('interactiveEffects')
  })
})
