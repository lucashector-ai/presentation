/**
 * Schema de cena — a ÚNICA fonte de verdade do modelo de renderização.
 * Editor, preview e visualizador importam daqui. Nunca duplicar em outro lugar.
 *
 * Coordenadas: todas as camadas usam pixels de referência da cena (ex.: 1920x1080).
 * O visualizador escala proporcionalmente (ver lib/scene/transform.ts).
 *
 * Versionamento: `schemaVersion` é gravado em cada cena/snapshot. Mudanças incompatíveis
 * exigem nova versão e uma função de migração em lib/scene/migrar.ts (criar quando necessário).
 */
import { z } from 'zod'

export const SCHEMA_VERSION = 1 as const

// ---------- primitivos ----------

export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'ID deve conter apenas letras, números, _ e -')

export const CorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Cor deve ser hexadecimal (#RGB, #RRGGBB ou #RRGGBBAA)')

export const TamanhoSchema = z.object({
  width: z.number().int().min(16).max(8192),
  height: z.number().int().min(16).max(8192),
})

/** Formatos de referência suportados no MVP. */
export const FORMATOS = {
  slides169: { width: 1920, height: 1080 },
  slides43: { width: 1600, height: 1200 },
  story: { width: 1080, height: 1920 },
} as const

export const ModoProjetoSchema = z.enum(['slides', 'story'])
export type ModoProjeto = z.infer<typeof ModoProjetoSchema>

// ---------- animações ----------

export const TIPOS_ANIMACAO = [
  'none',
  'fadeIn',
  'fadeOut',
  'slideUp',
  'slideDown',
  'slideLeft',
  'slideRight',
  'scaleIn',
  'scaleOut',
  'reveal',
] as const

export const EASINGS = ['linear', 'ease', 'easeIn', 'easeOut', 'easeInOut'] as const

export const DURACAO_MIN_MS = 150
export const DURACAO_MAX_MS = 1200

export const AnimacaoSchema = z.object({
  type: z.enum(TIPOS_ANIMACAO),
  duration: z.number().int().min(DURACAO_MIN_MS).max(DURACAO_MAX_MS).default(400),
  delay: z.number().int().min(0).max(3000).default(0),
  easing: z.enum(EASINGS).default('easeOut'),
})
export type Animacao = z.infer<typeof AnimacaoSchema>

export const TransicaoSchema = z.object({
  type: z.enum(['none', 'fade', 'slide', 'zoom']).default('fade'),
  duration: z.number().int().min(DURACAO_MIN_MS).max(DURACAO_MAX_MS).default(350),
})
export type Transicao = z.infer<typeof TransicaoSchema>

// ---------- interações: Evento (trigger) + Condições + Ação + Transição ----------

export const TRIGGERS = ['click', 'sceneEnter', 'hover', 'scrollThreshold'] as const
export type Trigger = (typeof TRIGGERS)[number]

/** Apenas http(s). javascript:, data:, file:, vbscript: etc. são rejeitados na validação. */
export const UrlExternaSchema = z
  .string()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }, 'Somente links http:// ou https:// são permitidos')

export const AcaoSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('nextScene') }),
  z.object({ action: z.literal('prevScene') }),
  z.object({ action: z.literal('goToScene'), targetSceneId: IdSchema }),
  z.object({ action: z.literal('openLink'), url: UrlExternaSchema, newTab: z.boolean().default(true) }),
  z.object({
    action: z.literal('toggleLayer'),
    targetLayerId: IdSchema,
    mode: z.enum(['show', 'hide', 'toggle']).default('toggle'),
  }),
  z.object({
    action: z.literal('toggleVideo'),
    targetLayerId: IdSchema,
    mode: z.enum(['play', 'pause', 'toggle']).default('toggle'),
  }),
  z.object({ action: z.literal('animate'), targetLayerId: IdSchema, animation: AnimacaoSchema }),
])
export type Acao = z.infer<typeof AcaoSchema>
export type TipoAcao = Acao['action']

export const CondicoesSchema = z.object({
  /** Dispara uma única vez por sessão de visualização (evita múltiplos disparos). */
  once: z.boolean().default(false),
  /** Fração do elemento visível no viewport para scrollThreshold (0 a 1). */
  threshold: z.number().min(0).max(1).default(0.5),
})

export const InteracaoSchema = z.object({
  trigger: z.enum(TRIGGERS),
  conditions: CondicoesSchema.default({ once: false, threshold: 0.5 }),
  do: AcaoSchema,
  transition: TransicaoSchema.optional(),
})
export type Interacao = z.infer<typeof InteracaoSchema>

/** Matriz trigger → ações permitidas no MVP (seção 7.1 do blueprint). */
export const ACOES_POR_TRIGGER: Record<Trigger, readonly TipoAcao[]> = {
  click: ['nextScene', 'prevScene', 'goToScene', 'openLink', 'toggleLayer', 'toggleVideo'],
  sceneEnter: ['animate', 'toggleLayer'],
  hover: ['toggleLayer', 'animate'],
  scrollThreshold: ['animate', 'toggleLayer'],
}

// ---------- camadas ----------

const CamadaBase = z.object({
  id: IdSchema,
  name: z.string().max(80).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  z: z.number().int().default(0),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /** Rótulo para leitores de tela. Obrigatório quando há interação e a camada não tem texto. */
  ariaLabel: z.string().max(200).optional(),
  interaction: InteracaoSchema.optional(),
  /** Animação executada ao entrar na cena (atalho para trigger sceneEnter + animate em si mesma). */
  enterAnimation: AnimacaoSchema.optional(),
  /** Ajuste de enquadramento por breakpoint (MVP: apenas contain/cover; layouts distintos ficam na Fase 2). */
  mobile: z.object({ fit: z.enum(['contain', 'cover']).optional(), hidden: z.boolean().optional() }).optional(),
})

export const EncaixeSchema = z.enum(['contain', 'cover'])

export const CamadaImagemSchema = CamadaBase.extend({
  type: z.literal('image'),
  assetId: IdSchema,
  fit: EncaixeSchema.default('contain'),
  radius: z.number().min(0).max(999).default(0),
  shadow: z.boolean().default(false),
})

export const CamadaVideoSchema = CamadaBase.extend({
  type: z.literal('video'),
  assetId: IdSchema,
  posterAssetId: IdSchema.optional(),
  fit: EncaixeSchema.default('contain'),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  /** Autoplay só é permitido com áudio mudo (navegadores exigem gesto do usuário para som). */
  muted: z.boolean().default(true),
  controls: z.boolean().default(true),
  radius: z.number().min(0).max(999).default(0),
})

export const CamadaTextoSchema = CamadaBase.extend({
  type: z.literal('text'),
  text: z.string().max(5000),
  fontFamily: z.string().max(80).default('system-ui'),
  fontSize: z.number().min(6).max(600).default(48),
  fontWeight: z.number().int().min(100).max(900).default(500),
  color: CorSchema.default('#111111'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  lineHeight: z.number().min(0.6).max(3).default(1.2),
  letterSpacing: z.number().min(-10).max(50).default(0),
})

export const CamadaFormaSchema = CamadaBase.extend({
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse']).default('rect'),
  fill: CorSchema.default('#D9F99D'),
  stroke: CorSchema.optional(),
  strokeWidth: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(999).default(0),
  shadow: z.boolean().default(false),
})

/** Área clicável transparente sobre uma arte finalizada. */
export const CamadaHotspotSchema = CamadaBase.extend({
  type: z.literal('hotspot'),
  ariaLabel: z.string().min(1, 'Hotspot precisa de descrição para leitores de tela').max(200),
  /** Mostra um contorno discreto ao passar o mouse (ajuda o convidado a descobrir a interação). */
  hint: z.boolean().default(false),
})

export const CamadaSchema = z.discriminatedUnion('type', [
  CamadaImagemSchema,
  CamadaVideoSchema,
  CamadaTextoSchema,
  CamadaFormaSchema,
  CamadaHotspotSchema,
])
export type Camada = z.infer<typeof CamadaSchema>
export type TipoCamada = Camada['type']
export type CamadaImagem = z.infer<typeof CamadaImagemSchema>
export type CamadaVideo = z.infer<typeof CamadaVideoSchema>
export type CamadaTexto = z.infer<typeof CamadaTextoSchema>
export type CamadaForma = z.infer<typeof CamadaFormaSchema>
export type CamadaHotspot = z.infer<typeof CamadaHotspotSchema>

// ---------- cena e documento ----------

export const CenaSchema = z.object({
  id: IdSchema,
  title: z.string().max(120).default(''),
  size: TamanhoSchema,
  background: CorSchema.default('#101820'),
  backgroundAssetId: IdSchema.optional(),
  backgroundFit: EncaixeSchema.default('cover'),
  /** Transição padrão ao ENTRAR nesta cena (uma ação pode sobrescrever). */
  transition: TransicaoSchema.optional(),
  layers: z.array(CamadaSchema).max(200),
})
export type Cena = z.infer<typeof CenaSchema>

/** Conteúdo completo gravado em project_snapshots.content_json e usado pelo visualizador. */
export const DocumentoProjetoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  mode: ModoProjetoSchema,
  scenes: z.array(CenaSchema).min(1).max(300),
})
export type DocumentoProjeto = z.infer<typeof DocumentoProjetoSchema>

// ---------- helpers ----------

/** Valida e aplica defaults. Lança ZodError em caso inválido. */
export function parseDocumento(entrada: unknown): DocumentoProjeto {
  return DocumentoProjetoSchema.parse(entrada)
}

export function parseCena(entrada: unknown): Cena {
  return CenaSchema.parse(entrada)
}

export function novaCena(parcial: Partial<Cena> & Pick<Cena, 'id' | 'size'>): Cena {
  return CenaSchema.parse({ title: '', layers: [], ...parcial })
}

export function camadaTemTextoVisivel(c: Camada): boolean {
  return c.type === 'text' && c.text.trim().length > 0
}
