import 'server-only'
/**
 * Acesso ao Neon usado pela sala (Durable Object) e pela entrada dela (Worker). O banco continua sendo a fonte
 * da verdade: a sala carrega o rascunho dele, consolida as edições e grava com a revisão (save_project_scenes).
 */
import { sql } from '@/lib/db/neon'
import { SCHEMA_VERSION, assetsDaCamada, type Cena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import { parseDocumento } from '@/lib/scene/migrar'
import { validarDocumento } from '@/lib/scene/validate'
import type { Papel } from './protocolo'

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ProjetoSala {
  workspaceId: string
  modo: ModoProjeto
  revisao: number
  doc: DocumentoProjeto
}

/** Rascunho atual do projeto (null = não existe ou está na lixeira). */
export async function carregarProjeto(projetoId: string): Promise<ProjetoSala | null> {
  const [p] = await sql()`select workspace_id, mode, current_revision from public.projects where id = ${projetoId} and deleted_at is null`
  if (!p) return null
  const linhas = await sql()`select content_json from public.project_scenes where project_id = ${projetoId} order by order_index`
  const bruto = { schemaVersion: SCHEMA_VERSION, mode: p.mode, scenes: linhas.map((r) => r.content_json as Cena) }
  let doc: DocumentoProjeto
  try { doc = parseDocumento(bruto) } catch { doc = bruto as DocumentoProjeto }
  return { workspaceId: String(p.workspace_id), modo: p.mode as ModoProjeto, revisao: Number(p.current_revision), doc }
}

/** Quem entra na sala: membro do workspace do projeto (qualquer papel). */
export async function acessoAoProjeto(userId: string, projetoId: string): Promise<{ workspaceId: string; papel: Papel } | null> {
  const [l] = await sql()`
    select p.workspace_id, m.role from public.projects p
    join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = ${userId}::uuid
    where p.id = ${projetoId} and p.deleted_at is null`
  return l ? { workspaceId: String(l.workspace_id), papel: l.role as Papel } : null
}

/** Papel atual de cada usuário no workspace (ausente = não é mais membro). */
export async function papeisAtuais(workspaceId: string, userIds: string[]): Promise<Map<string, Papel>> {
  if (!userIds.length) return new Map()
  const linhas = await sql()`select user_id, role from public.workspace_members where workspace_id = ${workspaceId} and user_id = any(${userIds}::uuid[])`
  return new Map(linhas.map((l) => [String(l.user_id), l.role as Papel]))
}

export type ResultadoGravacao =
  | { ok: true; revisao: number; salvoEm: string }
  | { ok: false; motivo: 'conflito'; atual: number }
  | { ok: false; motivo: 'removido' }
  | { ok: false; motivo: 'invalido'; mensagem: string }

/** Grava o documento consolidado da sala com a revisão base (mesmas regras do PUT /api/projects/:id/scenes). */
export async function gravarDocumento(projetoId: string, workspaceId: string, base: number, doc: DocumentoProjeto): Promise<ResultadoGravacao> {
  // ids fora do formato uuid não existem no banco (e quebrariam o cast): a validação acusa "mídia inexistente"
  const ids = [...new Set(doc.scenes.flatMap((c) => [...(c.backgroundAssetId ? [c.backgroundAssetId] : []), ...c.layers.flatMap(assetsDaCamada)]))].filter((id) => RE_UUID.test(id))
  const assets = ids.length ? await sql()`select id from public.assets where workspace_id = ${workspaceId} and deleted_at is null and id = any(${ids}::uuid[])` : []
  const v = validarDocumento(doc, { assetsExistentes: new Set(assets.map((a) => String(a.id))) })
  if (!v.ok || !v.documento) return { ok: false, motivo: 'invalido', mensagem: v.erros[0]?.mensagem ?? 'Documento inválido' }
  try {
    const [linha] = await sql()`select * from public.save_project_scenes(${projetoId}::uuid, ${workspaceId}::uuid, ${base}::int, ${JSON.stringify(v.documento.scenes)}::jsonb, ${v.documento.schemaVersion}::int)`
    const salvoEm = linha?.saved_at instanceof Date ? linha.saved_at.toISOString() : String(linha?.saved_at ?? new Date().toISOString())
    return { ok: true, revisao: Number(linha?.revision), salvoEm }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string } | null)?.message ?? '')
    const m = msg.match(/REVISION_CONFLICT:(\d+)/)
    if (m) return { ok: false, motivo: 'conflito', atual: Number(m[1]) }
    if (msg.includes('NOT_FOUND')) return { ok: false, motivo: 'removido' }
    throw e
  }
}
