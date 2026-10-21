import 'server-only'
/**
 * Neon Auth (Managed Better Auth) no servidor, só com o toolkit agnóstico `@neondatabase/auth/server`
 * (Request/Response da Web): nada de `next/headers` nem middleware do Next, para rodar igual no Node e no
 * Worker (vinext). Duas peças:
 *  - `encaminharAuth`: proxy de /api/auth/* para o Neon Auth (cadastro, login, logout, sessão, OAuth).
 *    Os cookies de sessão ficam no domínio do app (HttpOnly, Secure, SameSite=Lax).
 *  - `sessaoDaRequisicao`: lê a sessão do cookie. Caminho rápido: valida o cookie `session_data`
 *    (assinado com NEON_AUTH_COOKIE_SECRET, 5 min); senão consulta o Neon Auth (`get-session`).
 */
import {
  createAuthServer,
  extractNeonAuthCookies,
  handleAuthProxyRequest,
  serializeSetCookie,
  type RequestContext,
} from '@neondatabase/auth/server'

export const authConfigurado = () => !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET

function configuracao() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!baseUrl || !cookieSecret) throw new Error('Neon Auth não configurado: defina NEON_AUTH_BASE_URL (neon env pull) e NEON_AUTH_COOKIE_SECRET')
  return { baseUrl, cookieSecret, sameSite: 'lax' as const }
}

const origemDe = (req: Request) => req.headers.get('origin') || new URL(req.url).origin

/** /api/auth/[...path] → Neon Auth. `caminho` é o resto depois de /api/auth/ (ex.: "sign-in/email"). */
export async function encaminharAuth(req: Request, caminho: string): Promise<Response> {
  const { baseUrl, cookieSecret, sameSite } = configuracao()
  return handleAuthProxyRequest({ request: req, path: caminho, baseUrl, cookieSecret, sameSite })
}

export interface UsuarioSessao {
  id: string
  email: string
  nome: string
}

/**
 * Usuário da sessão (ou null). Cookies que o toolkit renovar (session_data) vão para `cookiesRenovados`,
 * para a rota devolver no Set-Cookie e a próxima chamada usar o caminho rápido.
 */
export async function sessaoDaRequisicao(req: Request, cookiesRenovados?: string[]): Promise<UsuarioSessao | null> {
  if (!authConfigurado()) return null
  const cookies = extractNeonAuthCookies(req.headers)
  if (!cookies) return null
  const { baseUrl, cookieSecret, sameSite } = configuracao()
  const contexto: RequestContext = {
    getCookies: () => cookies,
    setCookie: (name, value, options) => { cookiesRenovados?.push(serializeSetCookie({ name, value, ...options })) },
    getHeader: (nome) => req.headers.get(nome),
    getOrigin: () => origemDe(req),
    getFramework: () => 'mostra',
  }
  const servidor = createAuthServer({ baseUrl, cookieSecret, sameSite, context: () => contexto, log: { warn: () => {}, error: (m: string) => console.error(JSON.stringify({ nivel: 'erro', origem: 'neon-auth', mensagem: m })) } })
  const { data, error } = await servidor.getSession()
  if (error || !data?.user?.id) return null
  return { id: data.user.id, email: data.user.email ?? '', nome: data.user.name ?? '' }
}
