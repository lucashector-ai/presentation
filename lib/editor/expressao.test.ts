import { describe, expect, it } from 'vitest'
import { avaliar } from './expressao'

describe('expressões nos campos numéricos', () => {
  it('calcula + - * / e parênteses', () => {
    expect(avaliar('100+20')).toBe(120)
    expect(avaliar('50*2-10')).toBe(90)
    expect(avaliar('(1920-200)/2')).toBe(860)
    expect(avaliar('-12')).toBe(-12)
    expect(avaliar('3,5')).toBe(3.5)
  })
  it('recusa lixo e código', () => {
    expect(avaliar('alert(1)')).toBeNull()
    expect(avaliar('1+')).toBeNull()
    expect(avaliar('')).toBeNull()
    expect(avaliar('1/0')).toBeNull()
  })
})
