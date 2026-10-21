import { describe, expect, it } from 'vitest'
import { LIMITE_LETRAS, LIMITE_LETRAS_DESFOQUE, QUADRO_MS, agruparLetras, keyframesCursor } from './texto-animado'
import { tempoSegmentos } from './animacoes'

describe('letra por letra leve (agruparLetras)', () => {
  it('título curto continua letra por letra', () => {
    // "Lançamento 21.12" (15 letras) em 1200 ms: ~48 ms entre letras
    const { passo } = tempoSegmentos('letters', 15, 1200)
    expect(passo).toBeGreaterThan(QUADRO_MS)
    expect(agruparLetras({ total: 15, passo })).toBe(false)
  })

  it('parágrafo: várias letras por quadro viram palavras (o ritmo é o mesmo)', () => {
    const { passo } = tempoSegmentos('letters', 120, 1400)
    expect(passo).toBeLessThan(QUADRO_MS)
    expect(agruparLetras({ total: 120, passo })).toBe(true)
  })

  it('giro/escala próprios ou ordem aleatória mantêm as letras enquanto o texto não é longo', () => {
    expect(agruparLetras({ total: 100, passo: 5, giraOuEscala: true })).toBe(false)
    expect(agruparLetras({ total: 100, passo: 5, ordem: 'random' })).toBe(false)
  })

  it('texto longo anima por palavra em qualquer efeito', () => {
    expect(agruparLetras({ total: LIMITE_LETRAS + 1, passo: 40, giraOuEscala: true, ordem: 'random' })).toBe(true)
    expect(agruparLetras({ total: LIMITE_LETRAS, passo: 40 })).toBe(false)
  })

  it('desfoque por letra só em textos curtos', () => {
    expect(agruparLetras({ total: LIMITE_LETRAS_DESFOQUE, passo: 40, desfoque: true })).toBe(false)
    expect(agruparLetras({ total: LIMITE_LETRAS_DESFOQUE + 1, passo: 40, desfoque: true })).toBe(true)
  })

  it('uma letra só não agrupa', () => {
    expect(agruparLetras({ total: 1, passo: 0 })).toBe(false)
  })
})

describe('cursor único da máquina de escrever (keyframesCursor)', () => {
  const pontos = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 8, y: 40 }]
  it('salta de letra em letra (sem deslizar) e pisca 4 vezes no fim', () => {
    const { css, duracao } = keyframesCursor('cursor-t', pontos, [0, 100, 200], 100)
    // fim da digitação (200 + 100) + 4 piscadas de 1 s
    expect(duracao).toBe(4300)
    expect(css.startsWith('@keyframes cursor-t {')).toBe(true)
    expect(css).toContain('0% { transform: translate(10px, 0px); visibility: visible; animation-timing-function: step-end }')
    expect(css).toContain(`${(100 / 4300) * 100}`.slice(0, 5))
    expect(css).toContain('translate(8px, 40px)')
    // só posição (transform) e visibilidade, sempre em degraus
    expect(css).not.toMatch(/box-shadow|left:|top:|opacity/)
    expect(css.match(/step-end/g)!.length).toBe(css.match(/visibility/g)!.length)
    // termina invisível
    expect(css).toMatch(/100% \{ transform: translate\(8px, 40px\); visibility: hidden;/)
  })
  it('segue a ordem em que as letras aparecem (do fim para o início)', () => {
    const { css } = keyframesCursor('c', pontos, [200, 100, 0], 100)
    // a 1ª a aparecer é a última letra
    expect(css).toMatch(/^@keyframes c \{ 0% \{ transform: translate\(8px, 40px\); visibility: visible;/)
  })
  it('fica invisível até a primeira letra aparecer', () => {
    const { css } = keyframesCursor('c', pontos, [50, 150, 250], 100)
    expect(css).toMatch(/^@keyframes c \{ 0% \{ transform: translate\(10px, 0px\); visibility: hidden;/)
  })
})
