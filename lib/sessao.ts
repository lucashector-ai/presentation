'use client'
/**
 * Sessão do usuário.
 * - Modo demonstração (NEXT_PUBLIC_DEMO=1): só marca em localStorage que "alguém entrou". Nenhum dado sensível.
 * - Modo real: Neon Auth (cookies HttpOnly do próprio domínio, via /api/auth). As rotas /api conferem a
 *   sessão no servidor; o guard de /app no cliente (Shell) é só navegação.
 */
const CHAVE = 'apresentacoes.sessao'

export const MODO_DEMO = process.env.NEXT_PUBLIC_DEMO === '1'

/** Cliente do Neon Auth sob demanda: o modo demo não baixa o SDK. */
export const carregarAuth = () => import('@/lib/auth/cliente').then((m) => m.clienteAuth())

export function sessaoAtiva(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem(CHAVE) } catch { return false }
}

/** Erro que não diz nada sobre a sessão: o servidor não conseguiu conferir (429/5xx) ou não houve resposta. */
function falhaPassageira(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status
  return typeof status !== 'number' || status === 0 || status === 429 || status >= 500
}

/**
 * Há sessão? No modo real pergunta ao servidor (cookie de sessão; /api/auth/get-session). "Não" só quando o
 * servidor responde que não há sessão: se ele não conseguiu conferir (Neon Auth fora, limite de taxa, rede),
 * tenta de novo algumas vezes e então LANÇA (a tela mostra "tentar de novo") em vez de mandar ao login.
 */
export async function verificarSessao(): Promise<boolean> {
  if (MODO_DEMO) return sessaoAtiva()
  const auth = await carregarAuth()
  for (let tentativa = 0; ; tentativa++) {
    let falha: unknown
    try {
      const { data, error } = await auth.getSession()
      if (!error) return !!data?.user
      falha = error
    } catch (e) {
      falha = e
    }
    if (!falhaPassageira(falha)) return false
    if (tentativa >= 3) throw new Error('Não foi possível confirmar sua sessão agora. Tente de novo em instantes.')
    await new Promise((r) => setTimeout(r, 1000 * 2 ** tentativa))
  }
}

export function entrar(email: string) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ email, em: Date.now() })) } catch { /* ignorar */ }
}
export async function sair() {
  try { localStorage.removeItem(CHAVE) } catch { /* ignorar */ }
  if (!MODO_DEMO) await (await carregarAuth()).signOut().catch(() => {})
}
export function alternarTema() {
  const atual = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'
  document.documentElement.dataset.tema = atual
  try { localStorage.setItem('tema', atual) } catch { /* ignorar */ }
  return atual
}
