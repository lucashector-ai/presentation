import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CORES_TEMA } from './design-tokens'
import { SCRIPT_TEMA, temaDoCookie } from './tema'

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8')

/** Variáveis `--cor-*` de um bloco do CSS, como hex. */
function tokensDe(bloco: string): Record<string, string> {
  const r: Record<string, string> = {}
  for (const m of bloco.matchAll(/--cor-([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) {
    const nome = m[1]!.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
    r[nome] = '#' + [m[2], m[3], m[4]].map((n) => Number(n).toString(16).padStart(2, '0').toUpperCase()).join('')
  }
  return r
}
const bloco = (inicio: string) => {
  const i = css.indexOf(inicio)
  if (i < 0) throw new Error(`bloco não encontrado: ${inicio}`)
  return css.slice(i, css.indexOf('}', i))
}

describe('tema escuro', () => {
  it('os dois blocos escuros do CSS (escolhido e automático) são iguais', () => {
    const escolhido = tokensDe(bloco(":root[data-tema='escuro']"))
    const automatico = tokensDe(bloco(":root:not([data-tema='claro'])"))
    expect(Object.keys(escolhido).length).toBeGreaterThan(20)
    expect(automatico).toEqual(escolhido)
  })

  it('lib/design-tokens.ts espelha as variáveis do CSS nos dois temas', () => {
    const claro = tokensDe(bloco(':root {'))
    const escuro = tokensDe(bloco(":root[data-tema='escuro']"))
    for (const [nome, hex] of Object.entries(CORES_TEMA.claro)) expect(claro[nome], `claro.${nome}`).toBe(hex)
    for (const [nome, hex] of Object.entries(CORES_TEMA.escuro)) expect(escuro[nome], `escuro.${nome}`).toBe(hex)
    expect(Object.keys(CORES_TEMA.claro).sort()).toEqual(Object.keys(CORES_TEMA.escuro).sort())
  })

  it('color-scheme coerente: auto = light dark, claro = only light, escuro = dark', () => {
    expect(bloco(':root {')).toContain('color-scheme: light dark')
    expect(css).toContain(":root[data-tema='claro'] { color-scheme: only light; }")
    expect(bloco(":root[data-tema='escuro']")).toContain('color-scheme: dark')
  })

  it('lê a preferência do cookie e cai em auto', () => {
    expect(temaDoCookie('a=1; tema=escuro; b=2')).toBe('escuro')
    expect(temaDoCookie('tema=claro')).toBe('claro')
    expect(temaDoCookie('tema=roxo')).toBe('auto')
    expect(temaDoCookie(undefined)).toBe('auto')
  })

  it('o script inline resolve o tema antes da pintura', () => {
    expect(SCRIPT_TEMA).toContain("localStorage.getItem('tema')")
    expect(SCRIPT_TEMA).toContain('prefers-color-scheme: dark')
    expect(SCRIPT_TEMA.startsWith('(function(){try{')).toBe(true)
    // sintaxe válida
    expect(() => new Function(SCRIPT_TEMA)).not.toThrow()
  })
})
