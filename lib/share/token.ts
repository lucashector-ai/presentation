/**
 * Tokens de compartilhamento e senhas de link (seção 9.2).
 * - Token: 32 bytes aleatórios em base64url (256 bits). Só o HASH (SHA-256) vai para o banco.
 * - Senha de link: PBKDF2-SHA256 com salt aleatório (sem dependências; troca por Argon2 no servidor se adotado).
 * Funciona em Node 20+ e no navegador (Web Crypto). Nunca logar tokens em texto puro.
 */

const cripto: Crypto = globalThis.crypto

function paraBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function paraHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const TAMANHO_TOKEN_BYTES = 32

export function gerarToken(): string {
  const bytes = new Uint8Array(TAMANHO_TOKEN_BYTES)
  cripto.getRandomValues(bytes)
  return paraBase64Url(bytes)
}

/** Formato aceito na rota /p/:token (evita consultas ao banco com lixo). */
export const REGEX_TOKEN = /^[A-Za-z0-9_-]{43}$/

export function tokenValido(t: string): boolean {
  return REGEX_TOKEN.test(t)
}

export async function hashToken(token: string): Promise<string> {
  const dados = new TextEncoder().encode(token)
  return paraHex(await cripto.subtle.digest('SHA-256', dados))
}

const PBKDF2_ITERACOES = 150_000

export async function hashSenha(senha: string): Promise<string> {
  const salt = new Uint8Array(16)
  cripto.getRandomValues(salt)
  const hash = await derivar(senha, salt, PBKDF2_ITERACOES)
  return `pbkdf2$${PBKDF2_ITERACOES}$${paraBase64Url(salt)}$${hash}`
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$')
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false
  const iteracoes = Number(partes[1])
  const salt = deBase64Url(partes[2] as string)
  const esperado = partes[3] as string
  const calculado = await derivar(senha, salt, iteracoes)
  return comparacaoConstante(calculado, esperado)
}

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<string> {
  const chave = await cripto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await cripto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iteracoes }, chave, 256)
  return paraHex(bits)
}

function deBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function comparacaoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---------- estado do link ----------

export type EstadoLink = 'ativo' | 'expirado' | 'revogado'

export interface LinkParaEstado {
  expiresAt: string | Date | null
  revokedAt: string | Date | null
}

export function estadoDoLink(l: LinkParaEstado, agora: Date = new Date()): EstadoLink {
  if (l.revokedAt) return 'revogado'
  if (l.expiresAt && new Date(l.expiresAt).getTime() <= agora.getTime()) return 'expirado'
  return 'ativo'
}

export function urlDoLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/p/${token}`
}

/** Política mínima de senha de link: 4 a 64 caracteres (é um segredo compartilhado com o cliente, não a senha da conta). */
export function senhaDeLinkValida(s: string): boolean {
  return s.length >= 4 && s.length <= 64
}

// ---------- limite de tentativas (brute force) ----------

export const MAX_TENTATIVAS_SENHA = 5
export const JANELA_BLOQUEIO_MS = 15 * 60 * 1000

export interface RegistroTentativas {
  falhas: number
  primeiraFalhaEm: number
}

export function avaliarTentativa(r: RegistroTentativas | undefined, agora = Date.now()): { bloqueado: boolean; restantes: number } {
  if (!r || agora - r.primeiraFalhaEm > JANELA_BLOQUEIO_MS) return { bloqueado: false, restantes: MAX_TENTATIVAS_SENHA }
  const restantes = Math.max(0, MAX_TENTATIVAS_SENHA - r.falhas)
  return { bloqueado: restantes === 0, restantes }
}

export function registrarFalha(r: RegistroTentativas | undefined, agora = Date.now()): RegistroTentativas {
  if (!r || agora - r.primeiraFalhaEm > JANELA_BLOQUEIO_MS) return { falhas: 1, primeiraFalhaEm: agora }
  return { falhas: r.falhas + 1, primeiraFalhaEm: r.primeiraFalhaEm }
}
