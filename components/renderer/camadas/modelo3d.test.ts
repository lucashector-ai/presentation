import { describe, expect, it } from 'vitest'
import { enquadramentoComSangria } from './enquadramento3d'

const tg = (g: number) => Math.tan((g * Math.PI) / 360)
const sen = (g: number) => Math.sin((g * Math.PI) / 360)

describe('enquadramentoComSangria', () => {
  it('campo de visão k vezes maior e câmera na mesma distância', () => {
    const e = enquadramentoComSangria('30deg 72deg 105%', 30, 0.25)!
    const fov = parseFloat(e.fieldOfView)
    expect(tg(fov) / tg(30)).toBeCloseTo(1.5, 2)
    // distância = raio% · R / sen(fov/2) deve ser a mesma de antes
    const raio = parseFloat(e.cameraOrbit.split(' ')[2]!)
    expect(raio / sen(fov)).toBeCloseTo(105 / sen(30), 1)
    expect(e.cameraOrbit.startsWith('30deg 72deg ')).toBe(true)
    expect(e.maxFieldOfView).toBe(e.fieldOfView)
  })
  it('raio "auto"/ausente vira 105% compensado; raio absoluto fica igual', () => {
    expect(enquadramentoComSangria('0deg 75deg', 30)!.cameraOrbit).toMatch(/^0deg 75deg \d+(\.\d+)?%$/)
    expect(enquadramentoComSangria('0deg 75deg 2.5m', 30)!.cameraOrbit).toBe('0deg 75deg 2.5m')
  })
  it('órbitas que não sabemos converter desligam a sangria', () => {
    expect(enquadramentoComSangria('calc(10deg + 5deg) 75deg 105%', 30)).toBeNull()
    expect(enquadramentoComSangria('0deg 75deg 10vh', 30)).toBeNull()
  })
})
