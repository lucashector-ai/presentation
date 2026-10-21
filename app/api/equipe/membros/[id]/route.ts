import { AlterarPapelReq } from '@/lib/api/contratos'
import { auditar, autenticar, cookieWorkspace, ehUuid, ErroHttp, lerJson, responder, rota } from '@/lib/api/servidor'
import { exigirDono } from '@/lib/api/equipeServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'
type P = { id: string }

/** PATCH /api/equipe/membros/:userId — muda o papel (editor ↔ visualizador). Só o dono; o dono não muda. */
export const PATCH = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  exigirDono(ctx)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Membro não encontrado')
  const { papel } = await lerJson(req, AlterarPapelReq)
  const r = await sql()`update public.workspace_members set role = ${papel}::workspace_role where workspace_id = ${ctx.workspaceId} and user_id = ${params.id} and role <> 'owner' returning user_id`
  if (!r.length) throw new ErroHttp('nao_encontrado', 'Membro não encontrado')
  await auditar(ctx, 'workspace.member_role_changed', null, { papel })
  return responder({ papel }, requestId)
})

/**
 * DELETE /api/equipe/membros/:userId — o dono remove alguém; qualquer membro remove a si mesmo (sair do espaço).
 * Quem sai perde o acesso na hora nas rotas (cada requisição confere a participação) e a sala de edição o
 * desconecta na próxima conferência (alguns segundos).
 */
export const DELETE = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId, { permitirVisualizador: true })
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Membro não encontrado')
  const saindo = params.id === ctx.userId
  if (!saindo) exigirDono(ctx)
  if (saindo && ctx.papel === 'owner') throw new ErroHttp('entrada_invalida', 'Quem criou o espaço não pode sair dele.')
  const r = await sql()`delete from public.workspace_members where workspace_id = ${ctx.workspaceId} and user_id = ${params.id} and role <> 'owner' returning user_id`
  if (!r.length) throw new ErroHttp('nao_encontrado', 'Membro não encontrado')
  await auditar(ctx, 'workspace.member_removed', null, { saiu: saindo })
  return responder({ removed: true }, requestId, 200, saindo ? { headers: { 'set-cookie': cookieWorkspace(null) } } : undefined)
})
