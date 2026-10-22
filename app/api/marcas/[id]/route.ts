import { KitMarcaReq } from '@/lib/api/contratos'
import { autenticar, ehUuid, ErroHttp, lerJson, responder, rota } from '@/lib/api/servidor'
import { conferirLogo, metaDoLogo, obterKit, perfilDoKit } from '@/lib/api/marcaServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

type P = { id: string }

/** PATCH /api/marcas/:id — atualiza um kit do workspace ativo (o corpo é o kit inteiro). */
export const PATCH = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Kit de marca não encontrado')
  const entrada = await lerJson(req, KitMarcaReq)
  await conferirLogo(ctx, entrada)
  const r = await sql()`
    update public.brand_kits set name = ${entrada.nome}, colors = ${JSON.stringify(entrada.cores)}::jsonb, font_title = ${entrada.fontes?.titulo ?? null}, font_body = ${entrada.fontes?.texto ?? null},
      logo_asset_id = ${entrada.logo?.assetId ?? null}, logo_meta = ${metaDoLogo(entrada)}::jsonb, logo_in_footer = ${entrada.logoRodape}, brand_profile = ${perfilDoKit(entrada)}::jsonb, updated_at = now()
    where id = ${params.id} and workspace_id = ${ctx.workspaceId}
    returning id`
  if (!r.length) throw new ErroHttp('nao_encontrado', 'Kit de marca não encontrado')
  return responder(await obterKit(ctx, params.id), requestId)
})

/** DELETE /api/marcas/:id — apaga um kit do workspace ativo (a mídia do logo continua na biblioteca). */
export const DELETE = rota<P>(async (req, { params }, requestId) => {
  const ctx = await autenticar(req, requestId)
  if (!ehUuid(params.id)) throw new ErroHttp('nao_encontrado', 'Kit de marca não encontrado')
  const r = await sql()`delete from public.brand_kits where id = ${params.id} and workspace_id = ${ctx.workspaceId} returning id`
  if (!r.length) throw new ErroHttp('nao_encontrado', 'Kit de marca não encontrado')
  return responder({ deleted: true }, requestId)
})
