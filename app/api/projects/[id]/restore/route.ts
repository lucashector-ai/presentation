import { autenticar, ehUuid, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { resumo, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** POST /api/projects/:id/restore — tira o projeto da lixeira. Links revogados na exclusão continuam revogados. */
export const POST = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado')
  const [p] = await sql()`update public.projects set deleted_at = null where id = ${params.id} and workspace_id = ${ctx.workspaceId} and deleted_at is not null returning *`
  if (!p) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado na lixeira')
  return responder(resumo(p as LinhaProjeto, { sceneCount: 0, activeLinks: 0, coverUrl: null }), requestId)
})
