import { CriarShareLinkReq, type ShareLink } from '@/lib/api/contratos'
import { auditar, autenticar, iso, lerJson, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { podeUsarSenhaNoLink } from '@/lib/planos'
import { gerarToken, hashSenha, hashToken } from '@/lib/share/token'
import type { LinhaProjeto } from '@/lib/api/projetosServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

interface LinhaLink { id: string; project_id: string; token_preview: string; tem_senha: boolean; expires_at: Date | null; revoked_at: Date | null; view_count: number; created_at: Date }
const paraContrato = (l: LinhaLink): ShareLink => ({ id: l.id, projectId: l.project_id, tokenPreview: l.token_preview, hasPassword: l.tem_senha, expiresAt: iso(l.expires_at), revokedAt: iso(l.revoked_at), views: l.view_count, createdAt: iso(l.created_at) ?? '' })

export const GET = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = await projetoDoWorkspace(ctx, params.id)
  // o hash da senha nunca sai do banco: só o booleano
  const linhas = await sql()`select id, project_id, token_preview, password_hash is not null as tem_senha, expires_at, revoked_at, view_count, created_at from public.share_links where project_id = ${p.id} order by created_at desc`
  return responder((linhas as LinhaLink[]).map(paraContrato), requestId)
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
  const senha = entrada.password ? await hashSenha(entrada.password) : null
  const [linha] = await sql()`
    insert into public.share_links (project_id, token_hash, token_preview, password_hash, expires_at, created_by)
    values (${p.id}, ${await hashToken(token)}, ${token.slice(0, 4)}, ${senha}, ${entrada.expiresAt ?? null}::timestamptz, ${ctx.userId})
    returning id, project_id, token_preview, password_hash is not null as tem_senha, expires_at, revoked_at, view_count, created_at`
  await auditar(ctx, 'share_link.created', p.id, { comSenha: !!entrada.password, expira: !!entrada.expiresAt })
  return responder({ ...paraContrato(linha as LinhaLink), token }, requestId, 201)
})
