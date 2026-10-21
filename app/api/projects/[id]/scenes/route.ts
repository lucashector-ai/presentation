import { SalvarCenasReq } from '@/lib/api/contratos'
import { autenticar, iso, lerJson, projetoDoWorkspace, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { traduzirErroRpc, type LinhaProjeto } from '@/lib/api/projetosServidor'
import { validarDocumento } from '@/lib/scene/validate'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** PUT /api/projects/:id/scenes — salva o documento com optimistic concurrency (função SQL transacional). */
export const PUT = rota<{ id: string }>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  const p = (await projetoDoWorkspace(ctx, params.id)) as LinhaProjeto
  const entrada = await lerJson(req, SalvarCenasReq)
  if (entrada.document.mode !== p.mode) throw new ErroHttp('entrada_invalida', 'O modo do documento não corresponde ao projeto')

  // só mídias do PRÓPRIO workspace podem ser referenciadas pelas cenas
  const assets = await sql()`select id from public.assets where workspace_id = ${ctx.workspaceId} and deleted_at is null`
  const v = validarDocumento(entrada.document, { assetsExistentes: new Set(assets.map((a) => a.id as string)) })
  if (!v.ok || !v.documento) throw new ErroHttp('entrada_invalida', 'Documento inválido', v.erros)

  let linha: { revision: number; saved_at: Date } | undefined
  try {
    ;[linha] = (await sql()`select * from public.save_project_scenes(${p.id}::uuid, ${ctx.workspaceId}::uuid, ${entrada.baseRevision}::int, ${JSON.stringify(v.documento.scenes)}::jsonb, ${v.documento.schemaVersion}::int)`) as { revision: number; saved_at: Date }[]
  } catch (e) {
    traduzirErroRpc(e)
  }
  if (!linha) throw new Error('Resposta inesperada ao salvar')
  return responder({ revision: linha.revision, savedAt: iso(linha.saved_at), warnings: v.avisos }, requestId)
})
