import { auditar, autenticar, ehUuid, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** DELETE /api/assets/:id?force=1 — avisa se a mídia é usada em cenas; sem force, recusa (evita quebra silenciosa). */
export const DELETE = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const forcar = new URL(req.url).searchParams.get('force') === '1'
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Mídia não encontrada')
  const db = sql()
  const [asset] = await db`select id from public.assets where id = ${params.id} and workspace_id = ${ctx.workspaceId} and deleted_at is null`
  if (!asset) throw new ErroHttp('nao_encontrado', 'Mídia não encontrada')
  const usos = await db`
    select distinct p.name
    from public.project_scenes s join public.projects p on p.id = s.project_id
    where p.workspace_id = ${ctx.workspaceId} and p.deleted_at is null and position(${`"${params.id}"`} in s.content_json::text) > 0`
  const projetos = usos.map((u) => u.name as string)
  if (projetos.length && !forcar) throw new ErroHttp('entrada_invalida', `Esta mídia é usada em ${projetos.length} projeto(s).`, { projetos })
  // soft delete: a rotina de retenção remove o objeto do armazenamento (R2) depois do prazo
  await db`update public.assets set deleted_at = now() where id = ${params.id} and workspace_id = ${ctx.workspaceId}`
  await auditar(ctx, 'asset.deleted', null, { assetId: params.id, forcado: forcar })
  return responder({ deleted: true, projetosAfetados: projetos }, requestId)
})
