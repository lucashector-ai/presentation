import { KitMarcaReq, MAX_KITS_MARCA } from '@/lib/api/contratos'
import { autenticar, ErroHttp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { conferirLogo, listarKits, metaDoLogo, obterKit, perfilDoKit } from '@/lib/api/marcaServidor'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** GET /api/marcas — kits de marca do workspace ativo (quem só vê também lê). */
export const GET = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId, { permitirVisualizador: true })
  return responder(await listarKits(ctx), requestId)
})

/** POST /api/marcas — salva um kit novo (nome, cores, fontes, logo do próprio workspace e o perfil do manual da marca). */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  limitar(`marcas:${ctx.userId}`, 60, 10 * 60_000)
  const entrada = await lerJson(req, KitMarcaReq)
  await conferirLogo(ctx, entrada)
  const [contagem] = (await sql()`select count(*)::int as total from public.brand_kits where workspace_id = ${ctx.workspaceId}`) as { total: number }[]
  const total = contagem?.total ?? 0
  if (total >= MAX_KITS_MARCA) throw new ErroHttp('limite_do_plano', `Cada espaço guarda até ${MAX_KITS_MARCA} kits de marca. Apague um que não usa mais.`)
  const [l] = (await sql()`
    insert into public.brand_kits (workspace_id, name, colors, font_title, font_body, logo_asset_id, logo_meta, logo_in_footer, brand_profile, created_by)
    values (${ctx.workspaceId}, ${entrada.nome}, ${JSON.stringify(entrada.cores)}::jsonb, ${entrada.fontes?.titulo ?? null}, ${entrada.fontes?.texto ?? null}, ${entrada.logo?.assetId ?? null}, ${metaDoLogo(entrada)}::jsonb, ${entrada.logoRodape}, ${perfilDoKit(entrada)}::jsonb, ${ctx.userId})
    returning id`) as { id: string }[]
  return responder(await obterKit(ctx, l!.id), requestId, 201)
})
