import 'server-only'
/**
 * Kits de marca no banco (tabela brand_kits, migration 0005; perfil do manual da marca na 0007): leitura e
 * gravação sempre filtradas pelo workspace ativo da sessão. O logo precisa ser uma mídia pronta do mesmo workspace.
 */
import type { z } from 'zod'
import type { Contexto } from './servidor'
import { ehUuid, ErroHttp } from './servidor'
import type { KitMarca, KitMarcaReq } from './contratos'
import { sql } from '@/lib/db/neon'
import { lerPerfil } from '@/lib/marca/perfil'

interface LinhaKit {
  id: string
  name: string
  colors: unknown
  font_title: string | null
  font_body: string | null
  logo_asset_id: string | null
  logo_meta: unknown
  logo_in_footer: boolean
  /** Perfil do manual da marca (migration 0007; ausente antes dela). */
  brand_profile?: unknown
  logo_ok: boolean | null
  created_at: string | Date
  updated_at: string | Date
}

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString())

export function paraKit(l: LinhaKit): KitMarca {
  const meta = (l.logo_meta ?? {}) as { largura?: number; altura?: number; cor?: string }
  const cores = Array.isArray(l.colors) ? (l.colors as unknown[]).filter((c): c is string => typeof c === 'string') : []
  return {
    id: l.id,
    nome: l.name,
    cores,
    fontes: l.font_title && l.font_body ? { titulo: l.font_title, texto: l.font_body } : null,
    // mídia apagada (ou ainda sem estar pronta): o kit fica sem logo
    logo: l.logo_asset_id && l.logo_ok && meta.largura && meta.altura ? { assetId: l.logo_asset_id, largura: meta.largura, altura: meta.altura, cor: meta.cor ?? '#808080' } : null,
    logoRodape: l.logo_in_footer,
    perfil: lerPerfil(l.brand_profile),
    criadoEm: iso(l.created_at),
    atualizadoEm: iso(l.updated_at),
  }
}

const SELECAO = (ctx: Contexto) => sql()`
  select k.*, (a.id is not null) as logo_ok
  from public.brand_kits k
  left join public.assets a on a.id = k.logo_asset_id and a.workspace_id = k.workspace_id and a.deleted_at is null and a.status = 'ready'
  where k.workspace_id = ${ctx.workspaceId}
  order by k.updated_at desc
  limit 100`

export async function listarKits(ctx: Contexto): Promise<KitMarca[]> {
  return ((await SELECAO(ctx)) as LinhaKit[]).map(paraKit)
}

export async function obterKit(ctx: Contexto, id: string): Promise<KitMarca> {
  if (!ehUuid(id)) throw new ErroHttp('nao_encontrado', 'Kit de marca não encontrado')
  const [l] = (await sql()`
    select k.*, (a.id is not null) as logo_ok
    from public.brand_kits k
    left join public.assets a on a.id = k.logo_asset_id and a.workspace_id = k.workspace_id and a.deleted_at is null and a.status = 'ready'
    where k.id = ${id} and k.workspace_id = ${ctx.workspaceId}`) as LinhaKit[]
  if (!l) throw new ErroHttp('nao_encontrado', 'Kit de marca não encontrado')
  return paraKit(l)
}

/** O logo tem de ser uma mídia pronta do workspace (nunca de outro). */
export async function conferirLogo(ctx: Contexto, entrada: z.infer<typeof KitMarcaReq>): Promise<void> {
  if (!entrada.logo) return
  if (!ehUuid(entrada.logo.assetId)) throw new ErroHttp('entrada_invalida', 'Logo inválido')
  const [a] = await sql()`select id from public.assets where id = ${entrada.logo.assetId} and workspace_id = ${ctx.workspaceId} and deleted_at is null and status = 'ready'`
  if (!a) throw new ErroHttp('entrada_invalida', 'O logo precisa ser uma mídia deste espaço.')
}

export const metaDoLogo = (entrada: z.infer<typeof KitMarcaReq>) => JSON.stringify(entrada.logo ? { largura: entrada.logo.largura, altura: entrada.logo.altura, cor: entrada.logo.cor } : {})

/** Perfil do manual da marca como JSON para a coluna brand_profile (null = kit sem manual). */
export const perfilDoKit = (entrada: z.infer<typeof KitMarcaReq>) => (entrada.perfil ? JSON.stringify(entrada.perfil) : null)
