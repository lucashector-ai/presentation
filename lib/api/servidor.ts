import 'server-only'
/**
 * Infraestrutura das rotas /api: envelope { data, error, requestId }, autenticação (cookie de sessão do
 * Neon Auth), autorização por workspace, parsing com Zod, rate limiting simples e auditoria. Nunca registra
 * tokens/senhas.
 *
 * Não há RLS no banco: o app conecta com um único papel. TODA consulta de dados de cliente filtra pelo
 * workspace do usuário da sessão (`ctx.workspaceId`), resolvido aqui a partir do id do Neon Auth.
 */
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'
import { CODIGOS_ERRO, erro, ok, type CodigoErro, type TipoEventoAuditoria } from './contratos'
import { sql } from '@/lib/db/neon'
import { sessaoDaRequisicao } from '@/lib/auth/servidor'

export class ErroHttp extends Error {
  constructor(public code: CodigoErro, message: string, public details?: unknown) {
    super(message)
  }
}

export type PapelWorkspace = 'owner' | 'editor' | 'viewer'

export interface Contexto {
  requestId: string
  userId: string
  workspaceId: string
  /** Papel do usuário no workspace ativo (visualizador só lê). */
  papel: PapelWorkspace
  /** Workspace próprio do usuário (o primeiro, criado no cadastro). */
  workspacePadrao: string
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
  // log estruturado sem dados privados (a causa ajuda a separar rede/banco de bug)
  // o driver do Neon guarda o erro original em sourceError (e o motivo de rede em sourceError.cause)
  const fonte = (e as { sourceError?: unknown } | null)?.sourceError
  const bruto = fonte instanceof Error ? (fonte.cause instanceof Error ? fonte.cause : fonte) : e instanceof Error ? e.cause : null
  const causa = bruto instanceof Error ? bruto : null
  console.error(JSON.stringify({ nivel: 'erro', requestId, mensagem: e instanceof Error ? e.message : 'erro desconhecido', causa: causa ? `${causa.name}: ${causa.message}`.slice(0, 200) : undefined }))
  return NextResponse.json(erro('erro_interno', 'Algo deu errado. Tente novamente.', requestId), { status: 500, headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } })
}

/** Cookies de sessão renovados durante a requisição (session_data do Neon Auth), devolvidos pela rota. */
const cookiesDaRequisicao = new WeakMap<Request, string[]>()

/** Envolve um handler: gera requestId, captura ErroHttp e padroniza a resposta. */
export function rota<P>(handler: (req: Request, ctx: { params: P }, requestId: string) => Promise<Response>) {
  return async (req: Request, ctx: { params: P }) => {
    const requestId = req.headers.get('x-request-id')?.slice(0, 64) || novoRequestId()
    const renovados: string[] = []
    cookiesDaRequisicao.set(req, renovados)
    let resposta: Response
    try {
      resposta = await handler(req, ctx, requestId)
    } catch (e) {
      resposta = responderErro(e, requestId)
    }
    for (const c of renovados) {
      try { resposta.headers.append('set-cookie', c) } catch { /* headers imutáveis: segue sem renovar */ }
    }
    return resposta
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

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Ids vêm da URL: fora do formato, responde 404 (não 500 do cast do Postgres). */
export const ehUuid = (id: unknown): id is string => typeof id === 'string' && RE_UUID.test(id)

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * A sessão vai em cookie, então rotas que mudam estado exigem a mesma origem (defesa contra CSRF além do
 * SameSite=Lax): Origin, quando presente, precisa ser a do app; sem Origin, recusa pedidos cross-site.
 */
export function verificarOrigem(req: Request) {
  if (METODOS_SEGUROS.has(req.method)) return
  const origem = req.headers.get('origin')
  const permitidas = new Set([new URL(req.url).origin])
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try { permitidas.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin) } catch { /* ignorar */ }
  }
  if (origem ? !permitidas.has(origem) : req.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ErroHttp('sem_permissao', 'Origem não permitida')
  }
}

/**
 * Workspace ativo: cookie HttpOnly com o id (não é segredo). A pessoa pode ser membro de mais de um workspace
 * (o próprio + os que aceitou por convite); o servidor confere a participação em TODA requisição e, se ela não
 * vale mais (removida do workspace), volta para o workspace próprio.
 */
export const COOKIE_WORKSPACE = 'mostra_ws'

export function cookieWorkspace(workspaceId: string | null): string {
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return workspaceId
    ? `${COOKIE_WORKSPACE}=${workspaceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${seguro}`
    : `${COOKIE_WORKSPACE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${seguro}`
}

function workspaceDoCookie(req: Request): string | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE_WORKSPACE}=([^;]+)`))
  const v = m ? decodeURIComponent(m[1] as string) : null
  return v && ehUuid(v) ? v : null
}

const PAPEIS = new Set<PapelWorkspace>(['owner', 'editor', 'viewer'])

/**
 * Autentica pelo cookie de sessão do Neon Auth e resolve (criando no primeiro acesso) o workspace do usuário.
 * Com o cookie de workspace ativo, usa aquele workspace se o usuário for membro dele. Visualizadores só podem
 * fazer requisições de leitura, salvo nas rotas que pedem `permitirVisualizador` (aceitar convite, trocar de
 * workspace, sair da equipe).
 */
export async function autenticar(req: Request, requestId: string, opcoes: { permitirVisualizador?: boolean } = {}): Promise<Contexto> {
  verificarOrigem(req)
  const usuario = await sessaoDaRequisicao(req, cookiesDaRequisicao.get(req))
  if (!usuario) throw new ErroHttp('nao_autenticado', 'Faça login para continuar')
  const ativo = workspaceDoCookie(req)
  const linhas = await sql()`
    select c.ws as padrao, m.workspace_id, m.role
    from (select public.garantir_conta(${usuario.id}::uuid, ${usuario.email}, ${usuario.nome}) as ws) c
    left join public.workspace_members m on m.user_id = ${usuario.id}::uuid and m.workspace_id in (c.ws, ${ativo}::uuid)`
  const padrao = linhas[0]?.padrao as string | undefined
  if (!padrao) throw new ErroHttp('sem_permissao', 'Usuário sem workspace')
  const escolhida = linhas.find((l) => l.workspace_id === ativo) ?? linhas.find((l) => l.workspace_id === padrao)
  const papel = (PAPEIS.has(escolhida?.role as PapelWorkspace) ? escolhida!.role : 'owner') as PapelWorkspace
  const workspaceId = (escolhida?.workspace_id as string | undefined) ?? padrao
  if (papel === 'viewer' && !METODOS_SEGUROS.has(req.method) && !opcoes.permitirVisualizador) {
    throw new ErroHttp('sem_permissao', 'Você tem acesso só para ver neste espaço. Peça a quem administra para mudar seu papel para editor.')
  }
  return { requestId, userId: usuario.id, workspaceId, papel, workspacePadrao: padrao }
}

/** Carrega um projeto garantindo que pertence ao workspace do usuário (404 sem vazar existência). */
export async function projetoDoWorkspace(ctx: Contexto, projectId: string) {
  if (!ehUuid(projectId)) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado')
  const [p] = await sql()`select * from public.projects where id = ${projectId} and workspace_id = ${ctx.workspaceId} and deleted_at is null`
  if (!p) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado')
  return p
}

export async function auditar(ctx: { userId?: string | null; workspaceId?: string | null }, tipo: TipoEventoAuditoria, projectId: string | null, meta: Record<string, string | number | boolean> = {}) {
  await sql()`insert into public.audit_events (actor_id, workspace_id, project_id, event_type, metadata_json) values (${ctx.userId ?? null}, ${ctx.workspaceId ?? null}, ${projectId}, ${tipo}, ${JSON.stringify(meta)}::jsonb)`
}

/** Datas do driver vêm como Date; o contrato da API usa ISO string. */
export const iso = (d: Date | string | null | undefined): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : String(d))

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
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconhecido'
  const sal = process.env.SHARE_GRANT_SECRET ?? 'sem-segredo'
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}:${ip}`))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

// ---------- URLs de mídia ----------
export interface LinhaMidia {
  id: string
  metadata_json?: { thumb_key?: string; poster_key?: string } | null
}
export interface UrlsMidia { url: string; thumbUrl: string | null; posterUrl: string | null }

/**
 * URLs de mídia servidas pelo app (o bucket é privado e não gera URL). `base` é a rota que confere a
 * permissão: `/api/midias` (dono, pela sessão) ou `/api/share/{token}/midias` (convidado, pelo link).
 */
export function urlsDeMidia(assets: LinhaMidia[], base: string): Record<string, UrlsMidia> {
  const mapa: Record<string, UrlsMidia> = {}
  for (const a of assets) {
    const url = `${base}/${a.id}`
    mapa[a.id] = {
      url,
      thumbUrl: a.metadata_json?.thumb_key ? `${url}?variante=thumb` : null,
      posterUrl: a.metadata_json?.poster_key ? `${url}?variante=poster` : null,
    }
  }
  return mapa
}

// ---------- grant de convidado (cookie HttpOnly assinado) ----------
const COOKIE_GRANT = 'ap_grant'
export const VALIDADE_GRANT_S = 2 * 60 * 60

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
