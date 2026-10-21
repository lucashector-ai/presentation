import { PublicarReq } from '@/lib/api/contratos'
import { auditar, autenticar, lerJson, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { documentoDoProjeto, traduzirErroRpc, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { validarDocumento } from '@/lib/scene/validate'

export const dynamic = 'force-dynamic'

/** POST /api/projects/:id/publish — valida o rascunho e grava snapshot imutável da revisão atual. */
export const POST = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto
  const entrada = await lerJson(req, PublicarReq)
  if (entrada.baseRevision !== p.current_revision) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente. Recarregue antes de publicar.', { currentRevision: p.current_revision })
  const doc = await documentoDoProjeto(ctx.sb, p)
  const { data: assets } = await ctx.sb.from('assets').select('id, status').eq('workspace_id', ctx.workspaceId).is('deleted_at', null)
  const v = validarDocumento(doc, { assetsExistentes: new Set((assets ?? []).map((a) => a.id)) })
  if (!v.ok || !v.documento) throw new ErroHttp('entrada_invalida', 'Corrija os erros antes de publicar', v.erros)
  const pendentes = (assets ?? []).filter((a) => a.status !== 'ready').map((a) => a.id)
  const usados = JSON.stringify(v.documento)
  const bloqueando = pendentes.filter((id) => usados.includes(`"${id}"`))
  if (bloqueando.length) throw new ErroHttp('entrada_invalida', 'Há mídias ainda em processamento ou com falha nesta apresentação', { assets: bloqueando })

  const { data, error } = await ctx.sb.rpc('publish_project', { p_project_id: p.id, p_base_revision: entrada.baseRevision, p_user_id: ctx.userId, p_document: v.documento, p_schema_version: v.documento.schemaVersion })
  if (error) traduzirErroRpc(error)
  const linha = (data as { published_revision: number; published_at: string }[] | null)?.[0]
  if (!linha) throw new Error('Resposta inesperada ao publicar')
  await auditar(ctx, 'project.published', p.id, { revision: linha.published_revision })
  return responder({ publishedRevision: linha.published_revision, publishedAt: linha.published_at }, requestId)
})
