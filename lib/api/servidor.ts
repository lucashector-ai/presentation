import 'server-only'
/**
 * Infraestrutura das rotas /api: envelope { data, error, requestId }, autenticação (Bearer do Supabase Auth),
 * autorização por workspace, parsing com Zod, rate limiting simples e auditoria. Nunca registra tokens/senhas.
 */
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CODIGOS_ERRO, erro, ok, type CodigoErro, type TipoEventoAuditoria } from './contratos'
import { supabaseServidor } from '@/lib/supabase/servidor'

export class ErroHttp extends Error {
  constructor(public code: CodigoErro, message: string, public details?: unknown) {
    super(message)
  }
}

export interface Contexto {
  sb: SupabaseClient
  requestId: string
  userId: string
  workspaceId: string
}

export function novoRequestId(): string {
  return crypto.randomUUID()
}

export function responder<T>(data: T, requestId: string, status = 200, init?: ResponseInit) {
  return NextResponse.json(ok(data, requestId), { status, ...init, headers: { 'x-request-id': requestId, 'cache-control': 'no-store', ...(init?.headers ?? {}) } })
}

export function responderErro(e: unknown, requestId: string) {
  if (e instanceof ErroHttp) {
    return NextResponse.json(erro(e.code, e.message, requestId, e.details), { status: CODIGOS_ERRO[e.code], headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } })
  }
  // log estruturado sem dados privados
  console.error(JSON.stringify({ nivel: 'erro', requestId, mensagem: e instanceof Error ? e.message : 'erro desconhecido' }))
  return NextResponse.json(erro('erro_interno', 'Algo deu errado. Tente novamente.', requestId), { status: 500, headers: { 'x-request-id': requestId } })
}

/** Envolve um handler: gera requestId, captura ErroHttp e padroniza a resposta. */
export function rota<P>(handler: (req: Request, ctx: { params: P }, requestId: string) => Promise<Response>) {
  return async (req: Request, ctx: { params: P }) => {
    const requestId = req.headers.get('x-request-id')?.slice(0, 64) || novoRequestId()
    try {
      return await handler(req, ctx, requestId)
    } catch (e) {
      return responderErro(e, requestId)
    }
  }
}

export async function lerJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let bruto: unknown
  try {
    bruto = await req.json()
  } catch {
    throw new ErroHttp('entrada_invalida', 'Corpo JSON inválido')
  }
  const r = schema.safeParse(bruto)
  if (!r.success) throw new ErroHttp('entrada_invalida', 'Entrada inválida', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })))
  return r.data
}

export function lerQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url)
  const r = schema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!r.success) throw new ErroHttp('entrada_invalida', 'Parâmetros inválidos', r.error.issues)
  return r.data
}

/** Autentica pelo Bearer (sessão do Supabase Auth) e resolve o workspace do usuário. */
export async function autenticar(req: Request, requestId: string): Promise<Contexto> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) throw new ErroHttp('nao_autenticado', 'Faça login para continuar')
  const sb = supabaseServidor()
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) throw new ErroHttp('nao_autenticado', 'Sessão inválida ou expirada')
  const { data: membro } = await sb.from('workspace_members').select('workspace_id').eq('user_id', data.user.id).limit(1).maybeSingle()
  if (!membro) throw new ErroHttp('sem_permissao', 'Usuário sem workspace')
  return { sb, requestId, userId: data.user.id, workspaceId: membro.workspace_id as string }
}

/** Carrega um projeto garantindo que pertence ao workspace do usuário (404 sem vazar existência). */
export async function projetoDoWorkspace(ctx: Contexto, projectId: string) {
  const { data } = await ctx.sb.from('projects').select('*').eq('id', projectId).eq('workspace_id', ctx.workspaceId).is('deleted_at', null).maybeSingle()
  if (!data) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado')
  return data
}

export async function auditar(ctx: Pick<Contexto, 'sb'> & { userId?: string | null; workspaceId?: string | null }, tipo: TipoEventoAuditoria, projectId: string | null, meta: Record<string, string | number | boolean> = {}) {
  await ctx.sb.from('audit_events').insert({ actor_id: ctx.userId ?? null, workspace_id: ctx.workspaceId ?? null, project_id: projectId, event_type: tipo, metadata_json: meta })
}

// ---------- rate limit simples por processo (complementa o limite na borda/CDN) ----------
const janelas = new Map<string, { contagem: number; inicio: number }>()
export function limitar(chave: string, max: number, janelaMs: number) {
  const agora = Date.now()
  const j = janelas.get(chave)
  if (!j || agora - j.inicio > janelaMs) {
    janelas.set(chave, { contagem: 1, inicio: agora })
    return
  }
  j.contagem++
  if (j.contagem > max) throw new ErroHttp('muitas_tentativas', 'Muitas tentativas. Aguarde alguns minutos.')
  if (janelas.size > 10_000) janelas.clear()
}

export async function hashIp(req: Request): Promise<string> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconhecido'
  const sal = process.env.SHARE_GRANT_SECRET ?? 'sem-segredo'
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}:${ip}`))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export const BUCKET_MIDIAS = process.env.MIDIAS_BUCKET || 'midias'
export const VALIDADE_URL_MIDIA_S = 15 * 60

/** URLs assinadas curtas para um conjunto de assets (nunca expor o storage_key público). */
export async function urlsAssinadas(sb: SupabaseClient, assets: { id: string; storage_key: string; metadata_json?: { thumb_key?: string; poster_key?: string } | null }[]) {
  const mapa: Record<string, { url: string; thumbUrl: string | null; posterUrl: string | null }> = {}
  if (!assets.length) return mapa
  const chaves = assets.flatMap((a) => [a.storage_key, a.metadata_json?.thumb_key, a.metadata_json?.poster_key].filter((k): k is string => !!k))
  const { data } = await sb.storage.from(BUCKET_MIDIAS).createSignedUrls(chaves, VALIDADE_URL_MIDIA_S)
  const porChave = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
  for (const a of assets) {
    mapa[a.id] = {
      url: porChave.get(a.storage_key) ?? '',
      thumbUrl: a.metadata_json?.thumb_key ? porChave.get(a.metadata_json.thumb_key) ?? null : null,
      posterUrl: a.metadata_json?.poster_key ? porChave.get(a.metadata_json.poster_key) ?? null : null,
    }
  }
  return mapa
}

// ---------- grant de convidado (cookie HttpOnly assinado) ----------
const COOKIE_GRANT = 'ap_grant'
const VALIDADE_GRANT_S = 2 * 60 * 60

async function hmac(texto: string): Promise<string> {
  const segredo = process.env.SHARE_GRANT_SECRET
  if (!segredo) throw new Error('SHARE_GRANT_SECRET não configurado')
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function emitirGrant(linkId: string): Promise<{ nome: string; valor: string; opcoes: { httpOnly: true; secure: boolean; sameSite: 'lax'; path: string; maxAge: number } }> {
  const exp = Math.floor(Date.now() / 1000) + VALIDADE_GRANT_S
  const corpo = `${linkId}.${exp}`
  const valor = `${corpo}.${await hmac(corpo)}`
  return { nome: COOKIE_GRANT, valor, opcoes: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: VALIDADE_GRANT_S } }
}

export async function grantValido(req: Request, linkId: string): Promise<boolean> {
  const cookies = req.headers.get('cookie') ?? ''
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_GRANT}=([^;]+)`))
  if (!m) return false
  const [id, exp, sig] = decodeURIComponent(m[1] as string).split('.')
  if (id !== linkId || !exp || !sig) return false
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false
  return (await hmac(`${id}.${exp}`)) === sig
}
