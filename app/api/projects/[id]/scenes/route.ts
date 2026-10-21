import { SalvarCenasReq } from '@/lib/api/contratos'
import { autenticar, lerJson, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { traduzirErroRpc, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { validarDocumento } from '@/lib/scene/validate'

export const dynamic = 'force-dynamic'

/** PUT /api/projects/:id/scenes — salva o documento com optimistic concurrency (função SQL transacional). */
export const PUT = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto
  const entrada = await lerJson(req, SalvarCenasReq)
  if (entrada.document.mode !== p.mode) throw new ErroHttp('entrada_invalida', 'O modo do documento não corresponde ao projeto')

  const { data: assets } = await ctx.sb.from('assets').select('id').eq('workspace_id', ctx.workspaceId).is('deleted_at', null)
  const v = validarDocumento(entrada.document, { assetsExistentes: new Set((assets ?? []).map((a) => a.id)) })
  if (!v.ok || !v.documento) throw new ErroHttp('entrada_invalida', 'Documento inválido', v.erros)

  const { data, error } = await ctx.sb.rpc('save_project_scenes', { p_project_id: p.id, p_base_revision: entrada.baseRevision, p_scenes: v.documento.scenes, p_schema_version: v.documento.schemaVersion })
  if (error) traduzirErroRpc(error)
  const linha = (data as { revision: number; saved_at: string }[] | null)?.[0]
  if (!linha) throw new Error('Resposta inesperada ao salvar')
  return responder({ revision: linha.revision, savedAt: linha.saved_at, warnings: v.avisos }, requestId)
})
