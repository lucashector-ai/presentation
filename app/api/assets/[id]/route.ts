import { auditar, autenticar, responder, rota, ErroHttp, BUCKET_MIDIAS } from '@/lib/api/servidor'

export const dynamic = 'force-dynamic'

/** DELETE /api/assets/:id?force=1 — avisa se a mídia é usada em cenas; sem force, recusa (evita quebra silenciosa). */
export const DELETE = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const forcar = new URL(req.url).searchParams.get('force') === '1'
  const { data: asset } = await ctx.sb.from('assets').select('id, storage_key').eq('id', params.id).eq('workspace_id', ctx.workspaceId).is('deleted_at', null).maybeSingle()
  if (!asset) throw new ErroHttp('nao_encontrado', 'Mídia não encontrada')
  const { data: usos } = await ctx.sb.from('project_scenes').select('project_id, projects!inner(name, workspace_id)').eq('projects.workspace_id', ctx.workspaceId).filter('content_json::text', 'ilike', `%"${asset.id}"%`)
  const projetos = [...new Set((usos ?? []).map((u) => { const pr = (u as unknown as { projects?: { name: string } | { name: string }[] }).projects; return Array.isArray(pr) ? pr[0]?.name : pr?.name }).filter((n): n is string => !!n))]
  if (projetos.length && !forcar) throw new ErroHttp('entrada_invalida', `Esta mídia é usada em ${projetos.length} projeto(s).`, { projetos })
  // soft delete: a rotina de retenção remove o objeto do bucket depois do prazo
  const { error } = await ctx.sb.from('assets').update({ deleted_at: new Date().toISOString() }).eq('id', asset.id)
  if (error) throw error
  void BUCKET_MIDIAS
  await auditar(ctx, 'asset.deleted', null, { assetId: asset.id, forcado: forcar })
  return responder({ deleted: true, projetosAfetados: projetos }, requestId)
})
