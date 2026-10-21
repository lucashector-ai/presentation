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
  /** URLs assinadas/curta duração. Nunca persistir no cliente além da sessão. */
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
  status: StatusProjetoSchema.or(z.literal('all')).default('all'),
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

export const UploadUrlReq = z.object({
  projectId: z.string(),
  name: z.string().trim().min(1).max(255),
  mime: z.enum(MIMES_ACEITOS),
  bytes: z.number().int().positive(),
}).refine((r) => !ehMimeTexto(r.mime) || r.bytes <= MAX_BYTES_TEXTO, { message: 'Arquivos SVG, glTF e Lottie podem ter até 10 MB.', path: ['bytes'] })
export const UploadUrlRes = z.object({
  assetId: z.string(),
  uploadUrl: z.string(),
  /** Cabeçalhos exigidos pelo storage (ex.: content-type). */
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

export const FinalizarUploadReq = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
})

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
] as const
export type TipoEventoAuditoria = (typeof TIPOS_EVENTO_AUDITORIA)[number]
