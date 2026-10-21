import { describe, expect, it } from 'vitest'
import { avaliarTentativa, estadoDoLink, gerarToken, hashSenha, hashToken, registrarFalha, tokenValido, urlDoLink, verificarSenha } from './token'

describe('tokens de link', () => {
  it('gera tokens únicos de 43 caracteres base64url', () => {
    const a = gerarToken()
    const b = gerarToken()
    expect(a).not.toBe(b)
    expect(tokenValido(a)).toBe(true)
    expect(tokenValido('curto')).toBe(false)
    expect(tokenValido(a + '/')).toBe(false)
  })
  it('hash do token é determinístico e não revela o token', async () => {
    const t = gerarToken()
    const h1 = await hashToken(t)
    expect(h1).toBe(await hashToken(t))
    expect(h1).toHaveLength(64)
    expect(h1).not.toContain(t)
  })
  it('senha de link: hash com salt e verificação', async () => {
    const h = await hashSenha('cliente2026')
    expect(h.startsWith('pbkdf2$')).toBe(true)
    expect(await verificarSenha('cliente2026', h)).toBe(true)
    expect(await verificarSenha('errada', h)).toBe(false)
    expect(await verificarSenha('cliente2026', 'lixo')).toBe(false)
    expect(await hashSenha('cliente2026')).not.toBe(h) // salt aleatório
  })
  it('estado do link', () => {
    const agora = new Date('2026-10-20T12:00:00Z')
    expect(estadoDoLink({ expiresAt: null, revokedAt: null }, agora)).toBe('ativo')
    expect(estadoDoLink({ expiresAt: '2026-10-19T00:00:00Z', revokedAt: null }, agora)).toBe('expirado')
    expect(estadoDoLink({ expiresAt: '2027-01-01T00:00:00Z', revokedAt: '2026-10-20T11:00:00Z' }, agora)).toBe('revogado')
  })
  it('bloqueia após 5 falhas na janela', () => {
    let r = undefined as ReturnType<typeof registrarFalha> | undefined
    for (let i = 0; i < 5; i++) r = registrarFalha(r, 1000 + i)
    expect(avaliarTentativa(r, 2000).bloqueado).toBe(true)
    expect(avaliarTentativa(r, 2000 + 16 * 60 * 1000).bloqueado).toBe(false)
  })
  it('monta URL do link sem barra dupla', () => {
    expect(urlDoLink('https://app.exemplo.com/', 'abc')).toBe('https://app.exemplo.com/p/abc')
  })
})
