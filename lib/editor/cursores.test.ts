import { describe, expect, it } from 'vitest'
import { cursorMostra } from './cursores'

describe('cursorMostra', () => {
  it('monta um cursor SVG de 24 px com hotspot e reserva do sistema', () => {
    const c = cursorMostra('pointer')
    expect(c).toMatch(/^url\("data:image\/svg\+xml,.*"\) 6 6, default$/)
    expect(decodeURIComponent(c)).toContain("width='24'")
  })
  it('gira setas e o cursor de girar em passos de 5°, reaproveitando o mesmo valor', () => {
    expect(decodeURIComponent(cursorMostra('seta', 47))).toContain('rotate(45 16 16)')
    expect(cursorMostra('seta', 225)).toBe(cursorMostra('seta', 45))
    expect(decodeURIComponent(cursorMostra('girar', 92))).toContain('rotate(90 16 16)')
    expect(cursorMostra('girar', 12)).toMatch(/ 12 12, grab$/)
  })
})

describe('app/cursores.css', () => {
  it('está em dia com lib/editor/cursores.ts (rode npm run cursores)', async () => {
    const { readFileSync } = await import('node:fs')
    const { cssCursores } = await import('./cursores')
    expect(readFileSync(new URL('../../app/cursores.css', import.meta.url), 'utf8')).toBe(cssCursores())
  })
})
