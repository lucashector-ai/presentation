import type { DocumentoProjeto, ModoProjeto } from '@/lib/scene/schema'
import type { PlanoId, EstadoAssinatura } from '@/lib/planos'
import type { KitMarca } from '@/lib/api/contratos'

export type StatusProjeto = 'draft' | 'published' | 'archived'
export type StatusAsset = 'queued' | 'processing' | 'ready' | 'failed'
export type TipoMidia = 'image' | 'video' | 'gif' | 'svg' | 'model3d' | 'lottie'

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
  membros: number
  /** Papel de quem está logado neste workspace (modo real; no demo é sempre o dono). */
  papel?: 'owner' | 'editor' | 'viewer'
  /** É o workspace próprio (do cadastro) ou um aceito por convite. */
  proprio?: boolean
}

export interface MovimentoCredito {
  id: string
  /** positivo = entrada (plano, pacote), negativo = consumo */
  quantidade: number
  motivo: string
  criadoEm: string
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
  /** Cliente (opcional, só exibição). */
  cliente?: string
  /** Categoria exibida na capa do card (ex.: IDENTIDADE VISUAL). */
  categoria?: string
  revisaoAtual: number
  revisaoPublicada: number | null
  documento: DocumentoProjeto
  /**
   * Modo real (lib/dados): a listagem traz só a primeira tela (capa). `documentoParcial` marca esse caso e
   * `totalTelas` guarda a contagem real; as telas que precisam do documento inteiro o pedem a `dados.abrirProjeto`.
   */
  documentoParcial?: boolean
  totalTelas?: number
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
  creditos: { saldo: number; movimentos: MovimentoCredito[] }
  /** Kits de marca do espaço (aditivo: estados antigos não têm). */
  marcas?: KitMarca[]
}
