/**
 * Contratos de API (seção 13). Todas as rotas validam entrada com estes schemas e
 * devolvem o envelope { data, error, requestId }. Compartilhado entre servidor e cliente.
 */
import { z } from 'zod'
import { CenaSchema, DocumentoProjetoSchema, ModoProjetoSchema } from '@/lib/scene/schema'
import { ehMimeTexto, MAX_BYTES_TEXTO } from '@/lib/midia/mime'

// ---------- envelope e erros ----------

export const CODIGOS_ERRO = {
  entrada_invalida: 400,
  nao_autenticado: 401,
  sem_permissao: 403,
  nao_encontrado: 404,
  conflito_revisao: 409,
  arquivo_grande: 413,
  muitas_tentativas: 429,
  limite_do_plano: 403,
  erro_interno: 500,
} as const
export type CodigoErro = keyof typeof CODIGOS_ERRO

export interface ErroApi {
  code: CodigoErro
  message: string
  details?: unknown
}

export interface Envelope<T> {
  data: T | null
  error: ErroApi | null
  requestId: string
}

export function ok<T>(data: T, requestId: string): Envelope<T> {
  return { data, error: null, requestId }
}
export function erro(code: CodigoErro, message: string, requestId: string, details?: unknown): Envelope<never> {
  return { data: null, error: { code, message, details }, requestId }
}

// ---------- tipos de domínio expostos ----------

export const StatusProjetoSchema = z.enum(['draft', 'published', 'archived'])
export const StatusAssetSchema = z.enum(['queued', 'processing', 'ready', 'failed'])
export const TipoMidiaSchema = z.enum(['image', 'video', 'gif', 'svg', 'model3d', 'lottie'])

export const ProjetoResumoSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  slug: z.string(),
  mode: ModoProjetoSchema,
  status: StatusProjetoSchema,
  coverUrl: z.string().nullable(),
  currentRevision: z.number().int(),
  publishedRevision: z.number().int().nullable(),
  sceneCount: z.number().int(),
  activeLinks: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Primeira tela (capa do card no painel), só na listagem. */
  coverScene: CenaSchema.nullable().optional(),
  /** Preenchido só na listagem da lixeira (?status=trash). */
  deletedAt: z.string().nullable().optional(),
})
export type ProjetoResumo = z.infer<typeof ProjetoResumoSchema>

export const AssetSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  mediaType: TipoMidiaSchema,
  mime: z.string(),
  bytes: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration: z.number().nullable(),
  status: StatusAssetSchema,
  name: z.string(),
  /** Rota do app que confere a permissão a cada pedido (o bucket é privado e não tem URL pública). */
  url: z.string().nullable(),
  thumbUrl: z.string().nullable(),
  createdAt: z.string(),
})
export type Asset = z.infer<typeof AssetSchema>

export const ShareLinkSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** Só devolvido UMA vez, na criação. Depois, apenas prefixo mascarado. */
  token: z.string().optional(),
  tokenPreview: z.string(),
  hasPassword: z.boolean(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  views: z.number().int(),
  createdAt: z.string(),
})
export type ShareLink = z.infer<typeof ShareLinkSchema>

// ---------- projetos ----------

export const CriarProjetoReq = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao projeto').max(120),
  mode: ModoProjetoSchema,
  format: z.enum(['slides169', 'slides43', 'story']).optional(),
})
export type CriarProjetoReq = z.infer<typeof CriarProjetoReq>

export const ListarProjetosQuery = z.object({
  q: z.string().trim().max(120).optional(),
  /** all = ativos (sem arquivados); trash = lixeira (excluídos, ainda restauráveis). */
  status: StatusProjetoSchema.or(z.literal('all')).or(z.literal('trash')).default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export const AtualizarProjetoReq = z.object({
  baseRevision: z.number().int(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  coverAssetId: z.string().nullable().optional(),
  status: z.enum(['draft', 'archived']).optional(),
})

export const DetalheProjetoRes = ProjetoResumoSchema.extend({
  description: z.string(),
  scenes: z.array(CenaSchema),
})

/** PUT /api/projects/:id/scenes — salva cenas com optimistic concurrency. */
export const SalvarCenasReq = z.object({
  baseRevision: z.number().int(),
  document: DocumentoProjetoSchema,
})
export const SalvarCenasRes = z.object({ revision: z.number().int(), savedAt: z.string() })

/** 409: o servidor devolve a revisão atual para a UI oferecer recarregar/fazer cópia. */
export const ConflitoRevisaoRes = z.object({ currentRevision: z.number().int(), updatedAt: z.string() })

export const PublicarReq = z.object({ baseRevision: z.number().int() })
export const PublicarRes = z.object({ publishedRevision: z.number().int(), publishedAt: z.string() })

// ---------- assets ----------

export const MIME_IMAGEM = ['image/png', 'image/jpeg', 'image/webp'] as const
export const MIME_GIF = ['image/gif'] as const
export const MIME_VIDEO = ['video/mp4', 'video/webm'] as const
/** SVG é sanitizado no servidor; glTF precisa ser autocontido; JSON só é aceito se for animação Lottie. */
export const MIME_SVG = ['image/svg+xml'] as const
export const MIME_3D = ['model/gltf-binary', 'model/gltf+json'] as const
export const MIME_LOTTIE = ['application/json'] as const
export const MIMES_ACEITOS = [...MIME_IMAGEM, ...MIME_GIF, ...MIME_VIDEO, ...MIME_SVG, ...MIME_3D, ...MIME_LOTTIE] as const

/**
 * POST /api/assets/upload — o corpo é o próprio arquivo (sem multipart). `mime` vem do Content-Type,
 * `bytes` do Content-Length; o resto na query (?projectId=&name=&width=&height=&duration=).
 * O servidor confere o MIME real (bytes mágicos / sanitização) antes de gravar no armazenamento privado.
 */
export const EnviarMidiaReq = z.object({
  /** Opcional: a mídia é do workspace; com projeto, o servidor confere que ele é do workspace (biblioteca envia sem). */
  projectId: z.string().optional(),
  name: z.string().trim().min(1).max(255),
  mime: z.enum(MIMES_ACEITOS),
  bytes: z.number().int().positive(),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  duration: z.coerce.number().positive().optional(),
}).refine((r) => !ehMimeTexto(r.mime) || r.bytes <= MAX_BYTES_TEXTO, { message: 'Arquivos SVG, glTF e Lottie podem ter até 10 MB.', path: ['bytes'] })
export const EnviarMidiaRes = AssetSchema

// ---------- conta (GET /api/conta) ----------

export const ContaRes = z.object({
  usuario: z.object({ id: z.string(), nome: z.string(), email: z.string() }),
  workspace: z.object({ id: z.string(), nome: z.string(), planoId: z.enum(['free', 'plus', 'pro', 'studio']), estadoAssinatura: z.enum(['trial', 'ativa', 'inadimplente', 'cancelada']), membros: z.number().int(), papel: z.enum(['owner', 'editor', 'viewer']), proprio: z.boolean() }),
  creditos: z.object({ saldo: z.number().int(), movimentos: z.array(z.object({ id: z.string(), quantidade: z.number().int(), motivo: z.string(), criadoEm: z.string() })) }),
  uso: z.object({ projetosAtivos: z.number().int(), armazenamentoBytes: z.number(), bandaMesBytes: z.number() }),
})
export type ContaRes = z.infer<typeof ContaRes>

// ---------- equipe (membros do workspace e convites) ----------

export const PapelSchema = z.enum(['owner', 'editor', 'viewer'])
export type Papel = z.infer<typeof PapelSchema>
/** Papéis que um convite pode dar (dono há um só, o do cadastro). */
export const PapelConviteSchema = z.enum(['editor', 'viewer'])

const EmailSchema = z.string().trim().toLowerCase().max(320).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido')

/** POST /api/equipe/convites — com e-mail: só essa conta aceita, uma vez. Sem e-mail: link para quem tiver. */
export const CriarConviteReq = z.object({
  email: EmailSchema.optional(),
  papel: PapelConviteSchema.default('editor'),
  projetoId: z.string().optional(),
})
export const AlterarPapelReq = z.object({ papel: PapelConviteSchema })
export const AtivarWorkspaceReq = z.object({ workspaceId: z.string() })

export const MembroSchema = z.object({ userId: z.string(), nome: z.string(), email: z.string(), papel: PapelSchema, desde: z.string(), voce: z.boolean() })
export type Membro = z.infer<typeof MembroSchema>
export const ConviteSchema = z.object({ id: z.string(), email: z.string().nullable(), papel: PapelConviteSchema, criadoEm: z.string(), expiraEm: z.string(), projetoId: z.string().nullable() })
export type Convite = z.infer<typeof ConviteSchema>
export const EquipeRes = z.object({
  workspace: z.object({ id: z.string(), nome: z.string() }),
  meuPapel: PapelSchema,
  /** Limite de membros do plano (lib/planos.ts). */
  limite: z.number().int(),
  membros: z.array(MembroSchema),
  /** Convites pendentes (só para quem administra). */
  convites: z.array(ConviteSchema),
})
export type EquipeRes = z.infer<typeof EquipeRes>
/** O token do convite é devolvido UMA vez, na criação, já como URL. */
export const CriarConviteRes = ConviteSchema.extend({ url: z.string() })

/** GET /api/convites/:token — o que a pessoa logada está prestes a aceitar. */
export const ConviteInfoRes = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('invalido') }),
  z.object({ estado: z.literal('outro_email'), emailConvidado: z.string() }),
  z.object({ estado: z.literal('valido'), workspaceNome: z.string(), convidadoPor: z.string(), papel: PapelConviteSchema, jaMembro: z.boolean() }),
])
export type ConviteInfoRes = z.infer<typeof ConviteInfoRes>
export const AceitarConviteRes = z.object({ workspaceId: z.string(), papel: PapelSchema, projetoId: z.string().nullable() })

export const WorkspaceItemSchema = z.object({ id: z.string(), nome: z.string(), dono: z.string(), papel: PapelSchema, proprio: z.boolean(), ativo: z.boolean() })
export type WorkspaceItem = z.infer<typeof WorkspaceItemSchema>

// ---------- compartilhamento ----------

export const CriarShareLinkReq = z.object({
  password: z.string().min(4).max(64).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

/** GET /api/share/:token */
export const ResolverShareRes = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unavailable') }), // revogado, expirado ou inexistente: mesma resposta, sem vazar motivo
  z.object({ state: z.literal('locked'), projectName: z.string() }),
  z.object({
    state: z.literal('ready'),
    projectName: z.string(),
    document: DocumentoProjetoSchema,
    assets: z.record(z.string(), z.object({ url: z.string(), thumbUrl: z.string().nullable(), posterUrl: z.string().nullable() })),
    /** Selo "Feito com Mostra": só nos planos com `marcaDaPlataforma` (lib/planos.ts). */
    brand: z.boolean(),
    /** Grant curto para carregar mídia (cookie HttpOnly no mundo real). */
    grantExpiresAt: z.string(),
  }),
])

export const DesbloquearShareReq = z.object({ password: z.string().min(1).max(64) })

// ---------- eventos de auditoria ----------

export const TIPOS_EVENTO_AUDITORIA = [
  'project.created',
  'project.published',
  'project.archived',
  'project.deleted',
  'share_link.created',
  'share_link.revoked',
  'share_link.unlocked',
  'share_link.unlock_failed',
  'asset.deleted',
  'subscription.changed',
  'workspace.invite_created',
  'workspace.invite_revoked',
  'workspace.member_added',
  'workspace.member_removed',
  'workspace.member_role_changed',
] as const
export type TipoEventoAuditoria = (typeof TIPOS_EVENTO_AUDITORIA)[number]
