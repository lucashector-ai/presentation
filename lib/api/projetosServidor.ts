import 'server-only'
import { SCHEMA_VERSION, type Cena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import { sql } from '@/lib/db/neon'
import type { ProjetoResumo } from './contratos'
import { ErroHttp, iso } from './servidor'

export interface LinhaProjeto {
  id: string
  workspace_id: string
  name: string
  slug: string
  description: string
  mode: ModoProjeto
  status: 'draft' | 'published' | 'archived'
  cover_asset_id: string | null
  current_revision: number
  published_revision: number | null
  created_at: Date | string
  updated_at: Date | string
}

export function resumo(p: LinhaProjeto, extras: { sceneCount: number; activeLinks: number; coverUrl: string | null }): ProjetoResumo {
  return {
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    slug: p.slug,
    mode: p.mode,
    status: p.status,
    coverUrl: extras.coverUrl,
    currentRevision: p.current_revision,
    publishedRevision: p.published_revision,
    sceneCount: extras.sceneCount,
    activeLinks: extras.activeLinks,
    createdAt: iso(p.created_at) ?? '',
    updatedAt: iso(p.updated_at) ?? '',
  }
}

/** Cenas do rascunho. Só chamar com um projeto já autorizado (projetoDoWorkspace). */
export async function documentoDoProjeto(p: LinhaProjeto): Promise<DocumentoProjeto> {
  const linhas = await sql()`select content_json from public.project_scenes where project_id = ${p.id} order by order_index`
  return { schemaVersion: SCHEMA_VERSION, mode: p.mode, scenes: linhas.map((r) => r.content_json as Cena) }
}

export function gerarSlug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'projeto'
}

/** Converte erros das funções SQL (REVISION_CONFLICT:n / NOT_FOUND) em ErroHttp. */
export function traduzirErroRpc(e: unknown): never {
  const msg = e instanceof Error ? e.message : String((e as { message?: string } | null)?.message ?? '')
  const m = msg.match(/REVISION_CONFLICT:(\d+)/)
  if (m) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente. Suas mudanças continuam seguras nesta sessão.', { currentRevision: Number(m[1]) })
  if (msg.includes('NOT_FOUND')) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado')
  throw e instanceof Error ? e : new Error(msg || 'Falha na operação')
}

export function idsDeAssets(doc: DocumentoProjeto): string[] {
  const ids = new Set<string>()
  for (const s of doc.scenes) {
    if (s.backgroundAssetId) ids.add(s.backgroundAssetId)
    for (const l of s.layers) {
      if (l.type === 'image' || l.type === 'video') ids.add(l.assetId)
      if (l.type === 'video' && l.posterAssetId) ids.add(l.posterAssetId)
    }
  }
  return [...ids]
}
