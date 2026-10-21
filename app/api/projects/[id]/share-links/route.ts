import { CriarShareLinkReq, type ShareLink } from '@/lib/api/contratos'
import { auditar, autenticar, lerJson, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { podeUsarSenhaNoLink } from '@/lib/planos'
import { gerarToken, hashSenha, hashToken } from '@/lib/share/token'
import type { LinhaProjeto } from '@/lib/api/projetosServidor'

export const dynamic = 'force-dynamic'

interface LinhaLink { id: string; project_id: string; token_preview: string; password_hash: string | null; expires_at: string | null; revoked_at: string | null; view_count: number; created_at: string }
const paraContrato = (l: LinhaLink): ShareLink => ({ id: l.id, projectId: l.project_id, tokenPreview: l.token_preview, hasPassword: !!l.password_hash, expiresAt: l.expires_at, revokedAt: l.revoked_at, views: l.view_count, createdAt: l.created_at })

export const GET = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = await projetoDoWorkspace(ctx, params.id)
  const { data } = await ctx.sb.from('share_links').select('id, project_id, token_preview, password_hash, expires_at, revoked_at, view_count, created_at').eq('project_id', p.id).order('created_at', { ascending: false })
  return responder(((data ?? []) as LinhaLink[]).map(paraContrato), requestId)
})

/** POST — cria token aleatório; só o hash vai para o banco; o token em texto é devolvido UMA vez. */
export const POST = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto
  const entrada = await lerJson(req, CriarShareLinkReq)
  if (p.published_revision == null) throw new ErroHttp('entrada_invalida', 'Publique o projeto antes de criar um link.')
  if (entrada.password) {
    const { plano } = await planoEUso(ctx)
    const d = podeUsarSenhaNoLink(plano)
    if (!d.ok) throw new ErroHttp('limite_do_plano', d.motivo, { upgradePara: d.upgradePara })
  }
  if (entrada.expiresAt && new Date(entrada.expiresAt).getTime() <= Date.now()) throw new ErroHttp('entrada_invalida', 'A validade precisa estar no futuro')
  const token = gerarToken()
  const { data, error } = await ctx.sb
    .from('share_links')
    .insert({ project_id: p.id, token_hash: await hashToken(token), token_preview: token.slice(0, 4), password_hash: entrada.password ? await hashSenha(entrada.password) : null, expires_at: entrada.expiresAt ?? null, created_by: ctx.userId })
    .select('id, project_id, token_preview, password_hash, expires_at, revoked_at, view_count, created_at')
    .single()
  if (error) throw error
  await auditar(ctx, 'share_link.created', p.id, { comSenha: !!entrada.password, expira: !!entrada.expiresAt })
  return responder({ ...paraContrato(data as LinhaLink), token }, requestId, 201)
})
