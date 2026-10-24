import 'server-only'
/**
 * Quem já está conectado não vê a página inicial, o login nem o cadastro: o Worker manda direto ao painel (ou ao
 * destino `proximo` do login). Só confere quando há o cookie de sessão (quem não tem conta não paga nada a mais);
 * se o Neon Auth não responder, a página abre normalmente. `?site=1` deixa ver a página inicial mesmo conectado.
 */
import { NEON_AUTH_SESSION_COOKIE_NAME, parseCookieValue } from '@neondatabase/auth/server'
import { AuthIndisponivel, authConfigurado, sessaoDaRequisicao } from './servidor'

const ROTAS_ENTRADA = new Set(['/', '/login', '/signup'])

/** Destino interno seguro (mesma origem, sem `//` nem `/\`). */
export function destinoInterno(proximo: string | null): string {
  return proximo && proximo.startsWith('/') && !proximo.startsWith('//') && !proximo.startsWith('/\\') ? proximo : '/app'
}

export async function entrarDiretoSeConectado(req: Request): Promise<Response | null> {
  if (req.method !== 'GET' || !authConfigurado()) return null
  const url = new URL(req.url)
  if (!ROTAS_ENTRADA.has(url.pathname) || url.searchParams.has('site')) return null
  if (!parseCookieValue(req.headers.get('cookie') ?? '', NEON_AUTH_SESSION_COOKIE_NAME)) return null
  const cookies: string[] = []
  try {
    if (!(await sessaoDaRequisicao(req, cookies))) return null
  } catch (e) {
    if (e instanceof AuthIndisponivel) return null
    throw e
  }
  const destino = url.pathname === '/' ? '/app' : destinoInterno(url.searchParams.get('proximo'))
  const resposta = new Response(null, { status: 302, headers: { location: destino, 'cache-control': 'no-store' } })
  for (const c of cookies) resposta.headers.append('set-cookie', c)
  return resposta
}
