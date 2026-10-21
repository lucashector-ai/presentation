import { PublicarReq } from '@/lib/api/contratos'
import { auditar, autenticar, iso, lerJson, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { documentoDoProjeto, traduzirErroRpc, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { validarDocumento } from '@/lib/scene/validate'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** POST /api/projects/:id/publish — valida o rascunho e grava snapshot imutável da revisão atual. */
export const POST = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto
  const entrada = await lerJson(req, PublicarReq)
  if (entrada.baseRevision !== p.current_revision) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente. Recarregue antes de publicar.', { currentRevision: p.current_revision })
  const doc = await documentoDoProjeto(p)
  const assets = await sql()`select id, status from public.assets where workspace_id = ${ctx.workspaceId} and deleted_at is null`
  const v = validarDocumento(doc, { assetsExistentes: new Set(assets.map((a) => a.id as string)) })
  if (!v.ok || !v.documento) throw new ErroHttp('entrada_invalida', 'Corrija os erros antes de publicar', v.erros)
  const pendentes = assets.filter((a) => a.status !== 'ready').map((a) => a.id as string)
  const usados = JSON.stringify(v.documento)
  const bloqueando = pendentes.filter((id) => usados.includes(`"${id}"`))
  if (bloqueando.length) throw new ErroHttp('entrada_invalida', 'Há mídias ainda em processamento ou com falha nesta apresentação', { assets: bloqueando })

  let linha: { published_revision: number; published_at: Date } | undefined
  try {
    ;[linha] = (await sql()`select * from public.publish_project(${p.id}::uuid, ${ctx.workspaceId}::uuid, ${entrada.baseRevision}::int, ${ctx.userId}::uuid, ${JSON.stringify(v.documento)}::jsonb, ${v.documento.schemaVersion}::int)`) as { published_revision: number; published_at: Date }[]
  } catch (e) {
    traduzirErroRpc(e)
  }
  if (!linha) throw new Error('Resposta inesperada ao publicar')
  await auditar(ctx, 'project.published', p.id, { revision: linha.published_revision })
  return responder({ publishedRevision: linha.published_revision, publishedAt: iso(linha.published_at) }, requestId)
})
