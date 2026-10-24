/** Atalho de quem já está conectado: /, /login e /signup → painel; sem sessão (ou Neon Auth fora), a página abre. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEON_AUTH_SESSION_COOKIE_NAME as TOKEN } from '@neondatabase/auth/server'

vi.mock('server-only', () => ({}))
process.env.NEON_AUTH_BASE_URL = 'https://auth.exemplo.test/neondb/auth'
process.env.NEON_AUTH_COOKIE_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres!'

const { entrarDiretoSeConectado, destinoInterno } = await import('./entrada')
const { _limparVerificacoes } = await import('./servidor')

const agora = Date.now()
const sessao = {
  session: { id: 's1', token: 'tok', userId: 'u1', expiresAt: new Date(agora + 7 * 86400_000).toISOString(), createdAt: new Date(agora).toISOString(), updatedAt: new Date(agora).toISOString() },
  user: { id: 'u1', email: 'ana@exemplo.com', name: 'Ana', emailVerified: true, createdAt: new Date(agora).toISOString(), updatedAt: new Date(agora).toISOString() },
}
const pedido = (caminho: string, cookie = `${TOKEN}=tok.assinatura`) => new Request(`https://mostra.page${caminho}`, { headers: cookie ? { cookie } : {} })

let neonAuth: ReturnType<typeof vi.fn>
beforeEach(() => {
  _limparVerificacoes()
  neonAuth = vi.fn(async () => Response.json(sessao))
  vi.stubGlobal('fetch', neonAuth)
})
afterEach(() => vi.unstubAllGlobals())

describe('entrarDiretoSeConectado', () => {
  it('conectado: página inicial vai ao painel; login respeita o destino seguro', async () => {
    const r = await entrarDiretoSeConectado(pedido('/'))
    expect(r?.status).toBe(302)
    expect(r?.headers.get('location')).toBe('/app')
    expect((await entrarDiretoSeConectado(pedido('/login?proximo=%2Fapp%2Fprojects%2Fx')))?.headers.get('location')).toBe('/app/projects/x')
    expect((await entrarDiretoSeConectado(pedido('/signup?proximo=%2F%2Fmal.com')))?.headers.get('location')).toBe('/app')
  })
  it('sem cookie de sessão não consulta nada e a página abre', async () => {
    expect(await entrarDiretoSeConectado(pedido('/', ''))).toBeNull()
    expect(neonAuth).not.toHaveBeenCalled()
  })
  it('sessão inválida, outra rota ou ?site=1: a página abre', async () => {
    expect(await entrarDiretoSeConectado(pedido('/precos'))).toBeNull()
    expect(await entrarDiretoSeConectado(pedido('/?site=1'))).toBeNull()
    neonAuth.mockImplementation(async () => Response.json(null))
    expect(await entrarDiretoSeConectado(pedido('/'))).toBeNull()
  })
  it('destinoInterno só aceita caminhos desta origem', () => {
    expect(destinoInterno('/app/settings')).toBe('/app/settings')
    expect(destinoInterno('https://x.com')).toBe('/app')
    expect(destinoInterno('/\\x.com')).toBe('/app')
    expect(destinoInterno(null)).toBe('/app')
  })
})
