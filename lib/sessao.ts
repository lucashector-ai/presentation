'use client'
/**
 * Sessão no modo demonstração: só marca que "alguém entrou". No modo real, a sessão vem do Supabase Auth
 * (cookies HttpOnly via @supabase/ssr) e o middleware protege /app. Nenhum dado sensível aqui.
 */
const CHAVE = 'apresentacoes.sessao'

export function sessaoAtiva(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem(CHAVE) } catch { return false }
}
export function entrar(email: string) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ email, em: Date.now() })) } catch { /* ignorar */ }
}
export function sair() {
  try { localStorage.removeItem(CHAVE) } catch { /* ignorar */ }
}
export function alternarTema() {
  const atual = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'
  document.documentElement.dataset.tema = atual
  try { localStorage.setItem('tema', atual) } catch { /* ignorar */ }
  return atual
}
