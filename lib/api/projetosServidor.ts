import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SCHEMA_VERSION, type Cena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import type { ProjetoResumo } from './contratos'
import { ErroHttp } from './servidor'

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
  created_at: string
  updated_at: string
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
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
}

export async function documentoDoProjeto(sb: SupabaseClient, p: LinhaProjeto): Promise<DocumentoProjeto> {
  const { data } = await sb.from('project_scenes').select('content_json').eq('project_id', p.id).order('order_index')
  return { schemaVersion: SCHEMA_VERSION, mode: p.mode, scenes: (data ?? []).map((r) => r.content_json as Cena) }
}

export function gerarSlug(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'projeto'
}

/** Converte erros das funções SQL (REVISION_CONFLICT:n / NOT_FOUND) em ErroHttp. */
export function traduzirErroRpc(e: { message?: string } | null): never {
  const msg = e?.message ?? ''
  const m = msg.match(/REVISION_CONFLICT:(\d+)/)
  if (m) throw new ErroHttp('conflito_revisao', 'Há uma versão mais recente. Suas mudanças continuam seguras nesta sessão.', { currentRevision: Number(m[1]) })
  if (msg.includes('NOT_FOUND')) throw new ErroHttp('nao_encontrado', 'Projeto não encontrado')
  throw new Error(msg || 'Falha na operação')
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
