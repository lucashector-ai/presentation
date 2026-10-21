import 'server-only'
/**
 * Neon Auth (Managed Better Auth) no servidor, só com o toolkit agnóstico `@neondatabase/auth/server`
 * (Request/Response da Web): nada de `next/headers` nem middleware do Next, para rodar igual no Node e no
 * Worker (vinext). Duas peças:
 *  - `encaminharAuth`: proxy de /api/auth/* para o Neon Auth (cadastro, login, logout, OAuth). Os cookies de
 *    sessão ficam no domínio do app (HttpOnly, Secure, SameSite=Lax). O `get-session` é respondido aqui mesmo.
 *  - `sessaoDaRequisicao`: lê a sessão do cookie.
 *
 * O `get-session` do Neon Auth tem limite de taxa, e o servidor do app aparece lá como UM cliente só (todas as
 * pessoas saem do mesmo Worker): o balde é compartilhado e, quando enche, o Neon Auth responde 429 por até ~10 s.
 * Por isso a sessão quase nunca vai ao Neon Auth:
 *  1. caminho rápido: o cookie `session_data` (JWT assinado com NEON_AUTH_COOKIE_SECRET, 5 min) da MESMA sessão
 *     do `session_token` vale sem rede;
 *  2. sem ele (expirou, ou o login não conseguiu criá-lo), uma consulta ao Neon Auth — compartilhada entre os
 *     pedidos simultâneos da mesma sessão neste isolate — e o cookie `session_data` é renovado na resposta, para os
 *     próximos pedidos voltarem ao caminho rápido;
 *  3. falha passageira do Neon Auth (429, 5xx, rede) NÃO é "sem sessão": tenta de novo por alguns segundos e, se
 *     não der, lança `AuthIndisponivel` (as rotas respondem 503 e o cliente tenta de novo, sem mandar ao login).
 */
import {
  NEON_AUTH_SESSION_COOKIE_NAME,
  NEON_AUTH_SESSION_DATA_COOKIE_NAME,
  handleAuthProxyRequest,
  parseCookieValue,
  parseSessionData,
  parseSetCookies,
  serializeSetCookie,
  validateSessionData,
  type SessionData,
} from '@neondatabase/auth/server'

export const authConfigurado = () => !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET

function configuracao() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!baseUrl || !cookieSecret) throw new Error('Neon Auth não configurado: defina NEON_AUTH_BASE_URL (neon env pull) e NEON_AUTH_COOKIE_SECRET')
  return { baseUrl: baseUrl.replace(/\/+$/, ''), cookieSecret, sameSite: 'lax' as const }
}

const origemDe = (req: Request) => req.headers.get('origin') || new URL(req.url).origin

/** Validade do cookie `session_data` (a mesma do toolkit). */
const TTL_DADOS_S = 300
/**
 * Quanto tempo um pedido espera o Neon Auth voltar (429/5xx/rede) antes de responder "indisponível". O limitador
 * do Better Auth bloqueia por até 10 s (X-Retry-After): o prazo cobre uma espera inteira e mais uma tentativa.
 */
const PRAZO_VERIFICAR_MS = 11_000
/** Resultado bom de uma verificação vale por este tempo neste isolate (pedidos em rajada da mesma sessão). */
const CACHE_VERIFICACAO_MS = 30_000

/** O Neon Auth não respondeu (limite de taxa, erro dele ou rede): a sessão não foi conferida, nem negada. */
export class AuthIndisponivel extends Error {
  constructor(public tenteEmS: number) {
    super('Não foi possível confirmar a sessão agora')
  }
}

export interface UsuarioSessao {
  id: string
  email: string
  nome: string
}

type SessaoValida = { session: NonNullable<SessionData['session']>; user: NonNullable<SessionData['user']> }
interface Resolvida {
  dados: SessaoValida
  /** Set-Cookie para devolver ao navegador (session_data renovado; session_token se o Neon Auth o renovou). */
  setCookies: string[]
}

const valida = (d: SessionData | undefined | null): d is SessaoValida => !!d?.session && !!d.user?.id

/**
 * O `session_data` é da sessão do `session_token`? O cookie do token é `<token>.<assinatura>`; o payload guarda o
 * token. Sem isso, um `session_data` de outra sessão (ex.: o login não conseguiu renovar) valeria por até 5 min.
 */
function mesmaSessao(dados: SessaoValida, token: string): boolean {
  const t = (dados.session as { token?: unknown }).token
  return typeof t !== 'string' || !t || token === t || token.startsWith(`${t}.`)
}

// ---------- session_data: JWT HS256 no formato do toolkit (validateSessionData lê) ----------

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlTexto = (s: string) => b64url(new TextEncoder().encode(s))

async function assinarHs256(payload: Record<string, unknown>, segredo: string): Promise<string> {
  const corpo = `${b64urlTexto(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64urlTexto(JSON.stringify(payload))}`
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
  return `${corpo}.${b64url(sig)}`
}

/** Set-Cookie do `session_data` para esta sessão (até 5 min, nunca além da validade da sessão). */
export async function cookieSessionData(dados: SessaoValida, segredo: string, agora = Date.now()): Promise<string | null> {
  const fimSessao = new Date(dados.session.expiresAt as unknown as string).getTime()
  const expira = Math.min(Number.isFinite(fimSessao) ? fimSessao : agora, agora + TTL_DADOS_S * 1000)
  const maxAge = Math.floor((expira - agora) / 1000)
  if (maxAge <= 0) return null
  const payload = { ...(JSON.parse(JSON.stringify(dados)) as Record<string, unknown>), iat: Math.floor(agora / 1000), exp: Math.floor(expira / 1000), sub: dados.user.id }
  const valor = await assinarHs256(payload, segredo)
  return serializeSetCookie({ name: NEON_AUTH_SESSION_DATA_COOKIE_NAME, value: valor, path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge })
}

// ---------- consulta ao Neon Auth ----------

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ESPERAS_MS = [250, 700, 1500, 2500]

/** GET /get-session no Neon Auth. null = o Neon Auth disse que não há sessão; lança AuthIndisponivel se ele não respondeu. */
async function consultarNeonAuth(token: string, origem: string): Promise<{ dados: SessaoValida; setCookies: string[] } | null> {
  const { baseUrl } = configuracao()
  const prazo = Date.now() + PRAZO_VERIFICAR_MS
  let tenteEmS = 2
  for (let tentativa = 0; ; tentativa++) {
    let motivo: string
    try {
      const r = await fetch(`${baseUrl}/get-session`, {
        headers: { cookie: `${NEON_AUTH_SESSION_COOKIE_NAME}=${token}`, origin: origem, 'x-neon-auth-proxy': 'mostra' },
        signal: AbortSignal.timeout(Math.max(1000, Math.min(4000, prazo - Date.now()))),
      })
      if (r.ok) {
        const dados = parseSessionData(await r.json().catch(() => null))
        if (!valida(dados)) return null
        // o Neon Auth renova o session_token de tempos em tempos (updateAge): repassa ao navegador
        const setCookies = r.headers.getSetCookie().flatMap((h) => parseSetCookies(h)).map((c) => serializeSetCookie({ ...c, partitioned: undefined, sameSite: 'lax', secure: true }))
        return { dados, setCookies }
      }
      if (r.status !== 429 && r.status < 500) return null
      const ra = Number(r.headers.get('x-retry-after') ?? r.headers.get('retry-after'))
      if (Number.isFinite(ra) && ra > 0) tenteEmS = Math.ceil(ra)
      motivo = `HTTP ${r.status}`
      await r.body?.cancel().catch(() => {})
    } catch (e) {
      motivo = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 120) : 'falha de rede'
    }
    const aguardar = motivo.startsWith('HTTP 429') ? Math.max(ESPERAS_MS[tentativa] ?? 2500, tenteEmS * 1000) : (ESPERAS_MS[tentativa] ?? 2500)
    if (Date.now() + aguardar > prazo) {
      console.error(JSON.stringify({ nivel: 'erro', origem: 'neon-auth', mensagem: 'get-session indisponível', motivo, tentativas: tentativa + 1 }))
      throw new AuthIndisponivel(tenteEmS)
    }
    await espera(aguardar)
  }
}

/** Verificações em curso/recentes por sessão (chave = hash do token): uma consulta serve à rajada de pedidos. */
const verificacoes = new Map<string, { p: Promise<{ dados: SessaoValida; setCookies: string[] } | null>; ate: number }>()

async function chaveDoToken(token: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return b64url(h)
}

async function verificar(token: string, origem: string) {
  const chave = await chaveDoToken(token)
  const agora = Date.now()
  const atual = verificacoes.get(chave)
  if (atual && atual.ate > agora) return atual.p
  if (verificacoes.size > 2000) for (const [k, v] of verificacoes) if (v.ate <= agora) verificacoes.delete(k)
  const entrada = { p: consultarNeonAuth(token, origem), ate: Number.POSITIVE_INFINITY }
  verificacoes.set(chave, entrada)
  entrada.p.then(
    (r) => { if (r) entrada.ate = Date.now() + CACHE_VERIFICACAO_MS; else if (verificacoes.get(chave) === entrada) verificacoes.delete(chave) },
    () => { if (verificacoes.get(chave) === entrada) verificacoes.delete(chave) }
  )
  return entrada.p
}

/** Só para os testes: esquece as verificações em cache. */
export function _limparVerificacoes() {
  verificacoes.clear()
}

/**
 * Sessão da requisição: caminho rápido pelo `session_data`; senão consulta o Neon Auth e renova o `session_data`.
 * `forcar` ignora o `session_data` (o cliente pediu `disableCookieCache`).
 */
async function resolverSessao(req: Request, forcar = false): Promise<Resolvida | null> {
  const { cookieSecret } = configuracao()
  const cabecalho = req.headers.get('cookie') ?? ''
  const token = parseCookieValue(cabecalho, NEON_AUTH_SESSION_COOKIE_NAME)
  if (!token) return null
  if (!forcar) {
    const jwt = parseCookieValue(cabecalho, NEON_AUTH_SESSION_DATA_COOKIE_NAME)
    if (jwt) {
      const v = await validateSessionData(jwt, cookieSecret)
      if (v.valid && valida(v.payload) && mesmaSessao(v.payload, token)) return { dados: v.payload, setCookies: [] }
    }
  }
  const r = await verificar(token, origemDe(req))
  if (!r) return null
  const dados = await cookieSessionData(r.dados, cookieSecret)
  return { dados: r.dados, setCookies: [...r.setCookies, ...(dados ? [dados] : [])] }
}

/**
 * Usuário da sessão (ou null = sem sessão). Cookies renovados (session_data) vão para `cookiesRenovados`, para a
 * rota devolver no Set-Cookie e a próxima chamada usar o caminho rápido. Lança `AuthIndisponivel` quando o Neon
 * Auth não pôde ser consultado (não é "sem sessão").
 */
export async function sessaoDaRequisicao(req: Request, cookiesRenovados?: string[]): Promise<UsuarioSessao | null> {
  if (!authConfigurado()) return null
  const r = await resolverSessao(req)
  if (!r) return null
  cookiesRenovados?.push(...r.setCookies)
  return { id: r.dados.user.id, email: r.dados.user.email ?? '', nome: r.dados.user.name ?? '' }
}

const PARAM_VERIFICADOR = 'neon_auth_session_verifier'
const semCache = { 'cache-control': 'no-store' }

/** /api/auth/[...path] → Neon Auth. `caminho` é o resto depois de /api/auth/ (ex.: "sign-in/email"). */
export async function encaminharAuth(req: Request, caminho: string): Promise<Response> {
  const { baseUrl, cookieSecret, sameSite } = configuracao()
  const url = new URL(req.url)
  // get-session (o SDK do navegador pergunta "há sessão?" a cada tela): respondido aqui, sem gastar o limite do
  // Neon Auth à toa. Só o retorno do login com Google (verificador na URL) precisa ir até ele.
  if (caminho === 'get-session' && req.method === 'GET' && !url.searchParams.has(PARAM_VERIFICADOR)) {
    try {
      const r = await resolverSessao(req, url.searchParams.get('disableCookieCache') === 'true')
      const resposta = Response.json(r ? r.dados : null, { headers: semCache })
      for (const c of r?.setCookies ?? []) resposta.headers.append('set-cookie', c)
      return resposta
    } catch (e) {
      if (!(e instanceof AuthIndisponivel)) throw e
      return Response.json({ message: 'Não foi possível confirmar a sessão agora. Tente de novo em instantes.', code: 'SESSION_CHECK_UNAVAILABLE' }, { status: 503, headers: { ...semCache, 'retry-after': String(e.tenteEmS) } })
    }
  }
  return handleAuthProxyRequest({ request: req, path: caminho, baseUrl, cookieSecret, sameSite })
}
