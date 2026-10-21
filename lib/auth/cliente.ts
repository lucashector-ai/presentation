'use client'
/**
 * Cliente do Neon Auth no navegador (métodos do Better Auth pelo wrapper oficial `@neondatabase/auth`).
 * Fala com o proxy do PRÓPRIO app (/api/auth), então os cookies de sessão são do domínio do app (HttpOnly) —
 * nada de cookie de terceiro nem token em localStorage. Sem adaptador de React: não depende do Next.
 * Carregado sob demanda (lib/sessao.ts) para não entrar no bundle do modo demonstração.
 */
import { createAuthClient } from '@neondatabase/auth'

let instancia: ReturnType<typeof criar> | null = null
const criar = () => createAuthClient(new URL('/api/auth', window.location.origin).href)

export function clienteAuth() {
  return (instancia ??= criar())
}
export type ClienteAuth = ReturnType<typeof clienteAuth>

/**
 * Mensagem em português para os erros do Neon Auth. O SDK LANÇA `AuthApiError` (códigos normalizados, ex.:
 * `invalid_credentials`, `user_already_exists`) e às vezes devolve `{ error }` com o código do Better Auth
 * (ex.: `INVALID_EMAIL_OR_PASSWORD`): aceita os dois.
 */
export function mensagemErroAuth(e: unknown): string {
  const erro = (e ?? {}) as { code?: unknown; status?: unknown }
  const codigo = String(erro.code ?? '').toUpperCase()
  const status = typeof erro.status === 'number' ? erro.status : 0
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|INVALID_CREDENTIALS|CREDENTIAL_ACCOUNT_NOT_FOUND/.test(codigo)) return 'E-mail ou senha incorretos.'
  if (/USER_ALREADY_EXISTS|EMAIL_EXISTS/.test(codigo)) return 'Já existe uma conta com este e-mail. Entre ou recupere a senha.'
  if (/PASSWORD_TOO_SHORT|WEAK_PASSWORD/.test(codigo)) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (codigo.includes('PASSWORD_TOO_LONG')) return 'A senha é longa demais.'
  if (/INVALID_EMAIL|EMAIL_ADDRESS_INVALID/.test(codigo)) return 'Informe um e-mail válido.'
  if (/EMAIL_NOT_VERIFIED|EMAIL_NOT_CONFIRMED/.test(codigo)) return 'Confirme seu e-mail antes de entrar.'
  if (/OTP|INVALID_CODE/.test(codigo)) return 'Código inválido ou expirado. Peça um novo.'
  if (status === 429 || /TOO_MANY|RATE_LIMIT/.test(codigo)) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (codigo.startsWith('NETWORK') || status === 502 || status === 503) return 'Não foi possível falar com o servidor de login. Tente de novo.'
  if (codigo === 'USER_NOT_FOUND' && status === 401) return 'E-mail ou senha incorretos.'
  return 'Não foi possível concluir agora. Tente de novo.'
}
