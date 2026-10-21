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

/** Há sessão? No modo real pergunta ao Neon Auth (cookie de sessão). */
export async function verificarSessao(): Promise<boolean> {
  if (MODO_DEMO) return sessaoAtiva()
  try {
    const { data } = await (await carregarAuth()).getSession()
    return !!data?.user
  } catch {
    return false
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
