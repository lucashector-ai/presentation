/**
 * Sessão no servidor: o `get-session` do Neon Auth tem limite de taxa compartilhado por todo o app (o Worker é um
 * cliente só para ele). Estes testes garantem que a sessão quase nunca vai ao Neon Auth e que um 429/5xx dele não
 * vira "sem sessão" (401 → tela de login).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEON_AUTH_SESSION_COOKIE_NAME as TOKEN, NEON_AUTH_SESSION_DATA_COOKIE_NAME as DADOS, validateSessionData } from '@neondatabase/auth/server'

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres!'
process.env.NEON_AUTH_BASE_URL = 'https://auth.exemplo.test/neondb/auth'
process.env.NEON_AUTH_COOKIE_SECRET = SEGREDO

const { AuthIndisponivel, _limparVerificacoes, cookieSessionData, encaminharAuth, sessaoDaRequisicao } = await import('./servidor')

const agora = Date.now()
const sessao = (token: string) => ({
  session: { id: 's1', token, userId: 'u1', expiresAt: new Date(agora + 7 * 86400_000).toISOString(), createdAt: new Date(agora).toISOString(), updatedAt: new Date(agora).toISOString() },
  user: { id: 'u1', email: 'ana@exemplo.com', name: 'Ana', emailVerified: true, createdAt: new Date(agora).toISOString(), updatedAt: new Date(agora).toISOString() },
})
const COOKIE_TOKEN = 'tok123.assinaturaABC%2B%2F%3D'
const pedido = (cookie: string, caminho = '/api/conta') => new Request(`http://localhost:3000${caminho}`, { headers: { cookie, origin: 'http://localhost:3000' } })
const valorDe = (setCookie: string) => decodeURIComponent(setCookie.split(';')[0]!.split('=').slice(1).join('='))
async function sessionDataDe(token: string) {
  const c = await cookieSessionData(sessao(token) as never, SEGREDO)
  return `${DADOS}=${c!.split(';')[0]!.split('=').slice(1).join('=')}`
}

/** Relógio falso só para setTimeout/Date (o crypto.subtle e o setImmediate continuam reais). */
const relogioFalso = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
/**
 * Avança o relógio falso até `p` terminar. Entre um passo e outro deixa o trabalho real andar (crypto.subtle,
 * I/O): com a máquina carregada ele demora mais que um setImmediate, e o código pode agendar a próxima espera
 * depois de o relógio já ter passado. Por isso o limite é de tempo real (o `performance` não é falso), não de
 * tempo simulado: continuar avançando só antecipa o fim do prazo, que é o que os testes conferem.
 */
async function avancarAte<T>(p: Promise<T>): Promise<T> {
  let pronto = false
  void p.then(() => { pronto = true }, () => { pronto = true })
  const limite = performance.now() + 50_000
  while (!pronto && performance.now() < limite) {
    for (let k = 0; k < 5 && !pronto; k++) await new Promise((r) => setImmediate(r))
    await vi.advanceTimersByTimeAsync(250)
  }
  return p
}

let neonAuth: ReturnType<typeof vi.fn>
beforeEach(() => {
  _limparVerificacoes()
  neonAuth = vi.fn(async () => Response.json(sessao('tok123')))
  vi.stubGlobal('fetch', neonAuth)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('session_data (cookie de cache da sessão)', () => {
  it('o JWT gerado aqui é aceito pela validação do toolkit, com validade de no máximo 5 min', async () => {
    const c = await cookieSessionData(sessao('tok123') as never, SEGREDO)
    expect(c).toMatch(new RegExp(`^${DADOS.replace(/\./g, '\\.')}=`))
    expect(c).toMatch(/HttpOnly/)
    expect(c).toMatch(/Secure/)
    expect(Number(c!.match(/Max-Age=(\d+)/)![1])).toBeLessThanOrEqual(300)
    const v = await validateSessionData(valorDe(c!), SEGREDO)
    expect(v.valid).toBe(true)
    expect(v.payload?.user?.id).toBe('u1')
    expect((await validateSessionData(valorDe(c!), 'outro-segredo-com-mais-de-32-caracteres!!')).valid).toBe(false)
  })
})

describe('sessaoDaRequisicao', () => {
  it('sem session_token: sem sessão e sem ir ao Neon Auth', async () => {
    expect(await sessaoDaRequisicao(pedido(''))).toBeNull()
    expect(neonAuth).not.toHaveBeenCalled()
  })

  it('session_data válido da mesma sessão: caminho rápido, sem rede', async () => {
    const u = await sessaoDaRequisicao(pedido(`${TOKEN}=${COOKIE_TOKEN}; ${await sessionDataDe('tok123')}`))
    expect(u).toEqual({ id: 'u1', email: 'ana@exemplo.com', nome: 'Ana' })
    expect(neonAuth).not.toHaveBeenCalled()
  })

  it('session_data de OUTRA sessão não vale: confere no Neon Auth', async () => {
    await sessaoDaRequisicao(pedido(`${TOKEN}=${COOKIE_TOKEN}; ${await sessionDataDe('tokVelho')}`))
    expect(neonAuth).toHaveBeenCalledTimes(1)
  })

  it('sem session_data: uma consulta para a rajada de pedidos simultâneos, e o session_data volta renovado', async () => {
    const cookie = `${TOKEN}=${COOKIE_TOKEN}`
    const renovados: string[][] = [[], [], [], [], [], []]
    const r = await Promise.all(renovados.map((c) => sessaoDaRequisicao(pedido(cookie), c)))
    expect(r.every((u) => u?.id === 'u1')).toBe(true)
    expect(neonAuth).toHaveBeenCalledTimes(1)
    const [url, init] = neonAuth.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://auth.exemplo.test/neondb/auth/get-session')
    expect((init.headers as Record<string, string>).cookie).toBe(`${TOKEN}=tok123.assinaturaABC+/=`)
    for (const c of renovados) {
      const dados = c.find((x) => x.startsWith(`${DADOS}=`))
      expect(dados).toBeTruthy()
      expect((await validateSessionData(valorDe(dados!), SEGREDO)).valid).toBe(true)
    }
  })

  it('o Neon Auth diz que não há sessão (200 null ou 401): sem sessão', async () => {
    neonAuth.mockResolvedValueOnce(Response.json(null))
    expect(await sessaoDaRequisicao(pedido(`${TOKEN}=a.b`))).toBeNull()
    neonAuth.mockResolvedValueOnce(new Response('{}', { status: 401 }))
    expect(await sessaoDaRequisicao(pedido(`${TOKEN}=c.d`))).toBeNull()
  })

  it('429 passageiro do Neon Auth: espera o X-Retry-After e tenta de novo (não é "sem sessão")', async () => {
    relogioFalso()
    neonAuth.mockResolvedValueOnce(new Response('{"message":"Too many requests"}', { status: 429, headers: { 'x-retry-after': '2' } }))
    const p = sessaoDaRequisicao(pedido(`${TOKEN}=${COOKIE_TOKEN}`))
    expect((await avancarAte(p))?.id).toBe('u1')
    expect(neonAuth).toHaveBeenCalledTimes(2)
  }, 60_000)

  it('Neon Auth fora por mais que o prazo: lança AuthIndisponivel (a rota responde 503, não 401)', async () => {
    relogioFalso()
    neonAuth.mockImplementation(async () => new Response('{}', { status: 503 }))
    const p = sessaoDaRequisicao(pedido(`${TOKEN}=${COOKIE_TOKEN}`)).catch((e) => e)
    expect(await avancarAte(p)).toBeInstanceOf(AuthIndisponivel)
    // a falha não fica em cache: o próximo pedido consulta de novo
    neonAuth.mockImplementation(async () => Response.json(sessao('tok123')))
    expect((await sessaoDaRequisicao(pedido(`${TOKEN}=${COOKIE_TOKEN}`)))?.id).toBe('u1')
  }, 60_000)
})

describe('encaminharAuth: get-session respondido no app', () => {
  it('sem session_token: null sem gastar o limite do Neon Auth', async () => {
    const r = await encaminharAuth(pedido('', '/api/auth/get-session'), 'get-session')
    expect(r.status).toBe(200)
    expect(await r.json()).toBeNull()
    expect(neonAuth).not.toHaveBeenCalled()
  })

  it('com sessão: devolve { session, user } e renova o session_data', async () => {
    const r = await encaminharAuth(pedido(`${TOKEN}=${COOKIE_TOKEN}`, '/api/auth/get-session'), 'get-session')
    expect((await r.json()).user.id).toBe('u1')
    expect(r.headers.getSetCookie().some((c) => c.startsWith(`${DADOS}=`))).toBe(true)
  })

  it('Neon Auth indisponível: 503 com Retry-After (o navegador não conclui "deslogado")', async () => {
    relogioFalso()
    neonAuth.mockImplementation(async () => new Response('{}', { status: 429, headers: { 'x-retry-after': '12' } }))
    const p = encaminharAuth(pedido(`${TOKEN}=${COOKIE_TOKEN}`, '/api/auth/get-session'), 'get-session')
    const r = await avancarAte(p)
    expect(r.status).toBe(503)
    expect(r.headers.get('retry-after')).toBe('12')
  }, 60_000)
})
