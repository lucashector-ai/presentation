import { describe, expect, it } from 'vitest'
import { LINKS_DEMO, TOKEN_DEMO } from './dados'
import { resolverVitrine } from './vitrine'

describe('vitrine pública (exemplos da demo no modo real)', () => {
  it('o token fixo da landing abre o exemplo publicado, só leitura', () => {
    const r = resolverVitrine(TOKEN_DEMO)
    expect(r.state).toBe('ready')
    if (r.state !== 'ready') return
    expect(r.projectName).toBe('Atlas Cerâmica — Identidade')
    expect(r.documento.scenes.length).toBeGreaterThan(0)
    expect(Object.keys(r.assets).length).toBeGreaterThan(0)
  })

  it('link revogado da demo e token desconhecido continuam indisponíveis', () => {
    const revogado = LINKS_DEMO.find((l) => l.revogadoEm)!.tokenDemo!
    expect(resolverVitrine(revogado)).toEqual({ state: 'unavailable' })
    expect(resolverVitrine('demo_nao_existe')).toEqual({ state: 'unavailable' })
  })
})
