import type { DocumentoProjeto, ModoProjeto } from '@/lib/scene/schema'
import type { PlanoId, EstadoAssinatura } from '@/lib/planos'

export type StatusProjeto = 'draft' | 'published' | 'archived'
export type StatusAsset = 'queued' | 'processing' | 'ready' | 'failed'
export type TipoMidia = 'image' | 'video' | 'gif'

export interface Usuario {
  id: string
  nome: string
  email: string
}

export interface Workspace {
  id: string
  nome: string
  planoId: PlanoId
  estadoAssinatura: EstadoAssinatura
}

export interface Projeto {
  id: string
  workspaceId: string
  nome: string
  slug: string
  descricao: string
  modo: ModoProjeto
  status: StatusProjeto
  coverAssetId: string | null
  revisaoAtual: number
  revisaoPublicada: number | null
  documento: DocumentoProjeto
  criadoEm: string
  atualizadoEm: string
  excluidoEm: string | null
}

export interface AssetDemo {
  id: string
  workspaceId: string
  nome: string
  tipo: TipoMidia
  mime: string
  bytes: number
  width: number | null
  height: number | null
  duracao: number | null
  status: StatusAsset
  url: string
  thumbUrl: string | null
  posterUrl: string | null
  criadoEm: string
  erro?: string
}

export interface LinkCompartilhado {
  id: string
  projectId: string
  tokenHash: string
  tokenPreview: string
  senhaHash: string | null
  expiraEm: string | null
  revogadoEm: string | null
  visualizacoes: number
  criadoEm: string
  /** Só no modo demo, para que o protótipo consiga abrir o link sem backend. */
  tokenDemo: string
}

export interface Snapshot {
  projectId: string
  revisao: number
  documento: DocumentoProjeto
  criadoEm: string
}

export interface EventoAuditoria {
  id: string
  projectId: string | null
  tipo: string
  criadoEm: string
  meta: Record<string, string | number | boolean>
}

export interface EstadoDemo {
  versao: number
  usuario: Usuario
  workspace: Workspace
  projetos: Projeto[]
  assets: AssetDemo[]
  links: LinkCompartilhado[]
  snapshots: Snapshot[]
  auditoria: EventoAuditoria[]
}
