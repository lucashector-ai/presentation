/**
 * Schema de cena — a ÚNICA fonte de verdade do modelo de renderização.
 * Editor, miniaturas, preview, visualizador, API e IA importam daqui.
 *
 * Coordenadas: camadas usam pixels de referência da cena (ex.: 1920×1080); o visualizador escala.
 * Versionamento: `schemaVersion` vai em cada documento/snapshot. Versões antigas passam por
 * `migrarDocumento` (lib/scene/migrar.ts) antes da validação.
 */
import { z } from 'zod'

export const SCHEMA_VERSION = 2 as const

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
export type Tamanho = z.infer<typeof TamanhoSchema>

/** Formatos de referência. */
export const FORMATOS = {
  slides169: { width: 1920, height: 1080 },
  slides43: { width: 1600, height: 1200 },
  story: { width: 1080, height: 1920 },
  quadrado: { width: 1080, height: 1080 },
} as const
export type Formato = keyof typeof FORMATOS

/** Slides: uma tela por vez. Story: fluxo vertical. Explorar: mapa livre de telas conectadas por hotspots. */
export const ModoProjetoSchema = z.enum(['slides', 'story', 'explorar'])
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
  'blurIn',
  'rotateIn',
  'reveal',
  // --- presets da aba Animação (aditivos; documentos antigos continuam válidos) ---
  /** Escala com leve ultrapassagem. */
  'pop',
  /** Começa maior e assenta no tamanho final. */
  'zoomOut',
  /** Estica e acomoda como borracha. */
  'elastic',
  /** Texto: letras aparecem uma a uma (máquina de escrever). */
  'typewriter',
  /** Texto: palavra por palavra (sobe com desfoque leve). */
  'words',
  /** Texto: letra por letra (sobe com fade). */
  'letters',
  // saídas (usadas em `exitAnimation`)
  'slideOutUp',
  'slideOutDown',
  'blurOut',
  // --- catálogo ampliado (aditivo): ver lib/scene/parametros.ts e docs/animacoes.md ---
  'slideBlur', 'zoomIn', 'expand', 'spinIn', 'bounce', 'flip', 'unfold', 'mask', 'iris', 'draw',
  'lines', 'cascade', 'scramble', 'highlight', 'underline', 'counter',
  'slideOutLeft', 'slideOutRight', 'zoomAway', 'spinOut', 'flipOut', 'maskOut', 'wipeOut', 'irisOut', 'collapse',
] as const

/** Direção do movimento (para onde a camada vai): também diagonais. */
export const DIRECOES = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'] as const
/** Origem da transformação (escala/rotação), grade 3×3. */
export const ORIGENS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const

/** Entradas que dividem o texto em partes (só valem para camadas de texto; nas outras viram fade). */
export const ANIMACOES_DE_TEXTO = ['typewriter', 'words', 'letters', 'lines', 'cascade', 'scramble', 'highlight', 'underline', 'counter'] as const
/** Tipos que fazem sentido como saída. */
export const ANIMACOES_DE_SAIDA = ['fadeOut', 'scaleOut', 'slideOutUp', 'slideOutDown', 'blurOut', 'slideOutLeft', 'slideOutRight', 'zoomAway', 'spinOut', 'flipOut', 'maskOut', 'wipeOut', 'irisOut', 'collapse'] as const

export const EASINGS = ['linear', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'spring'] as const

export const DURACAO_MIN_MS = 100
export const DURACAO_MAX_MS = 3000

export const AnimacaoSchema = z.object({
  type: z.enum(TIPOS_ANIMACAO),
  duration: z.number().int().min(DURACAO_MIN_MS).max(DURACAO_MAX_MS).default(500),
  delay: z.number().int().min(0).max(5000).default(0),
  easing: z.enum(EASINGS).default('easeOut'),
  /** Curva personalizada (cubic-bezier x1 y1 x2 y2). Quando presente, substitui `easing`. */
  bezier: z.tuple([z.number().min(0).max(1), z.number().min(-1).max(2), z.number().min(0).max(1), z.number().min(-1).max(2)]).optional(),
  // --- ajustes finos (opcionais; ausentes = o visual padrão do preset, ver lib/scene/parametros.ts) ---
  /** Distância percorrida, em px da cena. */
  distance: z.number().min(0).max(800).optional(),
  /** Para onde a camada se move (entrada) / vai (saída); nas revelações, o sentido da cortina. */
  direction: z.enum(DIRECOES).optional(),
  /** Escala inicial (entrada) ou final (saída). */
  scale: z.number().min(0).max(3).optional(),
  /** Rotação inicial/final, em graus. */
  rotate: z.number().min(-720).max(720).optional(),
  /** Desfoque inicial/final, em px. */
  blur: z.number().min(0).max(80).optional(),
  /** Opacidade inicial/final (0–1). */
  opacity: z.number().min(0).max(1).optional(),
  /** Ponto fixo da escala/rotação. */
  origin: z.enum(ORIGENS).optional(),
  /** Texto: dividir por linha, palavra ou letra. */
  split: z.enum(['line', 'word', 'letter']).optional(),
  /** Texto: ordem das partes. */
  order: z.enum(['start', 'end', 'center', 'edges', 'random']).optional(),
  /** Texto: intervalo entre partes, em ms (ausente = automático pela duração). */
  stagger: z.number().int().min(0).max(1000).optional(),
  /** Destaque/sublinhado: cor do marcador. */
  color: CorSchema.optional(),
  /** Destaque/sublinhado: palavras marcadas (índices, inclusive; ausente = todas). */
  range: z.tuple([z.number().int().min(0).max(999), z.number().int().min(0).max(999)]).optional(),
  /** Quando a entrada toca: ao entrar na tela (padrão), depois de outra camada, ao clicar ou ao passar o mouse. */
  trigger: z.enum(['enter', 'after', 'click', 'hover']).optional(),
  /** trigger "after": camada cuja entrada precisa terminar antes (o atraso conta a partir do fim dela). */
  after: IdSchema.optional(),
  /** trigger "click"/"hover": camada que dispara (ausente = a própria camada). */
  on: IdSchema.optional(),
})
export type Animacao = z.infer<typeof AnimacaoSchema>

/** Ênfase contínua enquanto a tela está visível (começa ao fim da entrada). */
export const TIPOS_LOOP = ['float', 'pulse', 'wiggle', 'spin', 'drift', 'shake', 'glow'] as const
export const LoopSchema = z.object({
  type: z.enum(TIPOS_LOOP),
  /** Duração de um ciclo, em ms. */
  duration: z.number().int().min(400).max(20_000).default(3000),
  /** Multiplicador da amplitude (0,5 = sutil, 1 = normal, 2 = forte). */
  intensity: z.number().min(0.25).max(3).default(1),
  /** Quantas vezes repete (ausente = enquanto a tela estiver aberta). */
  repeat: z.number().int().min(1).max(50).optional(),
})
export type Loop = z.infer<typeof LoopSchema>

/** Transições entre telas. `morph` anima camadas com o mesmo nome/ID entre a tela de origem e a de destino. */
export const TIPOS_TRANSICAO = ['none', 'fade', 'slide', 'scale', 'morph'] as const
export const TransicaoSchema = z.object({
  type: z.enum(TIPOS_TRANSICAO).default('fade'),
  duration: z.number().int().min(DURACAO_MIN_MS).max(DURACAO_MAX_MS).default(500),
  easing: z.enum(EASINGS).default('easeInOut'),
})
export type Transicao = z.infer<typeof TransicaoSchema>

// ---------- interações: Evento (trigger) + Condições + Ação + Transição ----------

export const TRIGGERS = ['click', 'sceneEnter', 'hover', 'scrollThreshold'] as const
export type Trigger = (typeof TRIGGERS)[number]

/** Apenas http(s). javascript:, data:, file:, vbscript: etc. são rejeitados. */
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
  z.object({ action: z.literal('toggleLayer'), targetLayerId: IdSchema, mode: z.enum(['show', 'hide', 'toggle']).default('toggle') }),
  z.object({ action: z.literal('toggleVideo'), targetLayerId: IdSchema, mode: z.enum(['play', 'pause', 'toggle']).default('toggle') }),
  z.object({ action: z.literal('animate'), targetLayerId: IdSchema, animation: AnimacaoSchema }),
])
export type Acao = z.infer<typeof AcaoSchema>
export type TipoAcao = Acao['action']

export const CondicoesSchema = z.object({
  /** Dispara uma única vez por sessão de visualização. */
  once: z.boolean().default(false),
  /** Fração visível no viewport para scrollThreshold (0 a 1). */
  threshold: z.number().min(0).max(1).default(0.5),
})

export const InteracaoSchema = z.object({
  trigger: z.enum(TRIGGERS),
  conditions: CondicoesSchema.default({ once: false, threshold: 0.5 }),
  do: AcaoSchema,
  transition: TransicaoSchema.optional(),
})
export type Interacao = z.infer<typeof InteracaoSchema>

export const MAX_INTERACOES_POR_CAMADA = 8

/** Matriz trigger → ações permitidas. */
export const ACOES_POR_TRIGGER: Record<Trigger, readonly TipoAcao[]> = {
  click: ['nextScene', 'prevScene', 'goToScene', 'openLink', 'toggleLayer', 'toggleVideo', 'animate'],
  sceneEnter: ['animate', 'toggleLayer', 'toggleVideo'],
  hover: ['toggleLayer', 'animate'],
  scrollThreshold: ['animate', 'toggleLayer', 'toggleVideo'],
}

// ---------- efeitos e preenchimento ----------

/** Modos de mesclagem do CSS (os mesmos do Figma). Os 9 primeiros existem desde a v2; os demais são aditivos. */
export const MODOS_MESCLAGEM = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'difference', 'luminosity', 'color-burn', 'hard-light', 'soft-light', 'exclusion', 'hue', 'saturation', 'color'] as const

export const SombraSchema = z.object({
  x: z.number().min(-200).max(200).default(0),
  y: z.number().min(-200).max(200).default(16),
  blur: z.number().min(0).max(300).default(40),
  spread: z.number().min(-100).max(100).default(-12),
  color: CorSchema.default('#00000059'),
  /** Sombra interna (inset). Aditivo. */
  inner: z.boolean().optional(),
  /** Oculta pelo olho do painel (mantém os valores). */
  hidden: z.boolean().optional(),
  /** Camada gerada por "Sombra realista" (regerada quando os ajustes mudam). */
  realistic: z.boolean().optional(),
})
export type Sombra = z.infer<typeof SombraSchema>

export const MAX_SOMBRAS = 16

/**
 * Ajustes da "Sombra realista" (como o plugin Beautiful Shadows): posição da luz em relação ao centro da
 * camada (−1…1; a sombra cai do lado oposto), elevação (quanto a camada flutua, px), intensidade (0–1),
 * suavidade (0–1), número de camadas e cor. As sombras geradas ficam em `shadows` com `realistic: true`.
 */
export const SombraRealistaSchema = z.object({
  light: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1) }).default({ x: -0.35, y: -0.75 }),
  elevation: z.number().min(0).max(200).default(24),
  intensity: z.number().min(0).max(1).default(0.5),
  softness: z.number().min(0).max(1).default(0.6),
  layers: z.number().int().min(1).max(10).default(6),
  color: CorSchema.default('#0F1235'),
  hidden: z.boolean().optional(),
})
export type SombraRealista = z.infer<typeof SombraRealistaSchema>

export const EfeitosSchema = z.object({
  /** Sombra única (documentos antigos). Quando `shadows` existe, ela é ignorada. */
  shadow: SombraSchema.optional(),
  /** Lista de sombras (projetadas e internas), de cima para baixo como no painel. Aditivo. */
  shadows: z.array(SombraSchema).max(MAX_SOMBRAS).optional(),
  /** Ajustes da sombra realista (as camadas geradas estão em `shadows`). Aditivo. */
  realistic: SombraRealistaSchema.optional(),
  /** Desfoque gaussiano da própria camada, em px de referência. */
  blur: z.number().min(0).max(100).default(0),
  /** Desfoque do que está atrás (vidro). */
  backdropBlur: z.number().min(0).max(100).default(0),
  /** Olho dos desfoques (mantém o valor). */
  blurHidden: z.boolean().optional(),
  backdropBlurHidden: z.boolean().optional(),
  blend: z.enum(MODOS_MESCLAGEM).default('normal'),
})
export type Efeitos = z.infer<typeof EfeitosSchema>

export const GradienteSchema = z.object({
  type: z.enum(['linear', 'radial']).default('linear'),
  angle: z.number().min(0).max(360).default(135),
  stops: z
    .array(z.object({ color: CorSchema, pos: z.number().min(0).max(100) }))
    .min(2)
    .max(8),
})
export type Gradiente = z.infer<typeof GradienteSchema>

// ---------- traço ----------

export const POSICOES_TRACO = ['inside', 'center', 'outside'] as const
export const ESTILOS_TRACO = ['solid', 'dashed', 'dotted'] as const
export const PONTAS_TRACO = ['none', 'round', 'square'] as const
export const JUNCOES_TRACO = ['miter', 'round', 'bevel'] as const
const LadoTraco = z.number().min(0).max(200)

/**
 * Um traço (como no Figma): cor/gradiente, espessura, posição (dentro, centro, fora — a geometria da camada
 * não muda), espessura por lado (retângulos), estilo (contínuo, tracejado com traço/espaço, pontilhado),
 * pontas e junções (linhas, setas e caminhos). Aditivo: camadas antigas usam `stroke/strokeWidth/dash`.
 */
export const TracoSchema = z.object({
  color: CorSchema.default('#171717'),
  gradient: GradienteSchema.optional(),
  weight: z.number().min(0).max(200).default(1),
  position: z.enum(POSICOES_TRACO).default('inside'),
  sides: z.object({ top: LadoTraco, right: LadoTraco, bottom: LadoTraco, left: LadoTraco }).optional(),
  style: z.enum(ESTILOS_TRACO).default('solid'),
  dash: z.number().min(0).max(500).default(8),
  gap: z.number().min(0).max(500).default(8),
  cap: z.enum(PONTAS_TRACO).default('none'),
  join: z.enum(JUNCOES_TRACO).default('miter'),
  hidden: z.boolean().optional(),
})
export type Traco = z.infer<typeof TracoSchema>
export const MAX_TRACOS = 8

/** Restrições (constraints) do Figma: como a camada acompanha o pai (frame livre ou tela) quando ele muda de tamanho. */
export const RESTRICOES_H = ['left', 'right', 'leftRight', 'center', 'scale'] as const
export const RESTRICOES_V = ['top', 'bottom', 'topBottom', 'center', 'scale'] as const
export const RestricoesSchema = z.object({ h: z.enum(RESTRICOES_H).default('left'), v: z.enum(RESTRICOES_V).default('top') })
export type Restricoes = z.infer<typeof RestricoesSchema>

// ---------- camadas ----------

/**
 * Cantos independentes [superior esquerdo, superior direito, inferior direito, inferior esquerdo] em px.
 * Aditivo: quando presente, substitui `radius` no renderizador; `radius` guarda o maior dos quatro
 * (renderizadores antigos mostram um canto uniforme aproximado).
 */
export const RaiosSchema = z.tuple([z.number().min(0).max(999), z.number().min(0).max(999), z.number().min(0).max(999), z.number().min(0).max(999)])
export type Raios = z.infer<typeof RaiosSchema>

/** fixed = tamanho fixo · hug = abraçar conteúdo · fill = preencher o pai (auto layout). */
export const DIMENSIONAMENTOS = ['fixed', 'hug', 'fill'] as const
export type Dimensionamento = (typeof DIMENSIONAMENTOS)[number]

export const DIRECOES_LAYOUT = ['horizontal', 'vertical', 'wrap'] as const
export const ALINHAMENTOS_LAYOUT = ['start', 'center', 'end'] as const

/** Auto layout de um frame. Alinhamento em coordenadas absolutas (grade 3×3 do Figma). */
export const AutoLayoutSchema = z.object({
  direction: z.enum(DIRECOES_LAYOUT).default('horizontal'),
  /** Espaço entre itens (px de referência). */
  gap: z.number().min(-2000).max(2000).default(16),
  /** Espaço automático (space-between) no eixo principal. */
  gapAuto: z.boolean().default(false),
  /** Espaço entre linhas quando a direção é wrap (ausente = gap). */
  rowGap: z.number().min(-2000).max(2000).optional(),
  padding: z
    .object({ top: z.number().min(0).max(2000), right: z.number().min(0).max(2000), bottom: z.number().min(0).max(2000), left: z.number().min(0).max(2000) })
    .default({ top: 0, right: 0, bottom: 0, left: 0 }),
  alignX: z.enum(ALINHAMENTOS_LAYOUT).default('start'),
  alignY: z.enum(ALINHAMENTOS_LAYOUT).default('start'),
})
export type AutoLayout = z.infer<typeof AutoLayoutSchema>

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
  /** Camadas com o mesmo groupId são selecionadas e movidas juntas. */
  groupId: IdSchema.optional(),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
  /** Rótulo para leitores de tela. Obrigatório quando há interação e a camada não tem texto. */
  ariaLabel: z.string().max(200).optional(),
  interactions: z.array(InteracaoSchema).max(MAX_INTERACOES_POR_CAMADA).default([]),
  /** Animação ao entrar na tela. */
  enterAnimation: AnimacaoSchema.optional(),
  /** Ênfase em loop (flutuar, pulsar…) enquanto a tela está visível. */
  loopAnimation: LoopSchema.optional(),
  /** Animação ao SAIR da tela (o visualizador espera ela terminar antes da transição). */
  exitAnimation: AnimacaoSchema.optional(),
  effects: EfeitosSchema.optional(),
  /** Ajustes simples para celular. */
  mobile: z.object({ fit: z.enum(['contain', 'cover']).optional(), hidden: z.boolean().optional() }).optional(),
  /** Frame que contém esta camada (aninhamento). Coordenadas continuam absolutas na cena. */
  parentId: IdSchema.optional(),
  /**
   * Dimensionamento por eixo (como no Figma): fixo, abraçar o conteúdo (frames com auto layout e textos)
   * ou preencher o frame pai com auto layout. Ausente = fixo (documentos antigos não mudam).
   */
  sizingW: z.enum(DIMENSIONAMENTOS).optional(),
  sizingH: z.enum(DIMENSIONAMENTOS).optional(),
  /** Filho de auto layout com posição absoluta (ignora o fluxo). */
  absolute: z.boolean().optional(),
  /**
   * Estilos de cor do documento ligados às propriedades de cor desta camada (`theme.colorStyles[].id`).
   * A cor literal continua gravada na propriedade (fill/color/stroke/background); editar o estilo reescreve
   * todas as camadas ligadas. Renderizadores ignoram este campo.
   */
  colorStyleIds: z.object({ fill: IdSchema.optional(), color: IdSchema.optional(), stroke: IdSchema.optional(), background: IdSchema.optional() }).optional(),
  /** Traços (lista, de cima para baixo). Aditivo: ausente = `stroke/strokeWidth/dash` antigos (formas e frames). */
  strokes: z.array(TracoSchema).max(MAX_TRACOS).optional(),
  /** Suavização dos cantos (squircle, 0–1, como o "corner smoothing" do Figma) em camadas retangulares. */
  cornerSmoothing: z.number().min(0).max(1).optional(),
  /** Restrições em relação ao pai (frame sem auto layout ou a tela). Ausente = esquerda/topo. */
  constraints: RestricoesSchema.optional(),
  /** Camada recortada pela forma-máscara `maskId` (uma forma com `isMask` acima dela). */
  maskId: IdSchema.optional(),
})

export const EncaixeSchema = z.enum(['contain', 'cover', 'fill'])

/** Recorte não destrutivo de imagem: frações (0–1) da imagem original. */
export const RecorteSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.01).max(1), h: z.number().min(0.01).max(1) })

export const AjustesImagemSchema = z.object({
  brightness: z.number().min(0).max(2).default(1),
  contrast: z.number().min(0).max(2).default(1),
  saturate: z.number().min(0).max(2).default(1),
  grayscale: z.number().min(0).max(1).default(0),
})

export const CamadaImagemSchema = CamadaBase.extend({
  type: z.literal('image'),
  assetId: IdSchema,
  fit: EncaixeSchema.default('cover'),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
  crop: RecorteSchema.optional(),
  adjust: AjustesImagemSchema.optional(),
  /** Máscara de forma aplicada à imagem. */
  mask: z.enum(['none', 'ellipse', 'arch', 'triangle']).default('none'),
})

export const CamadaVideoSchema = CamadaBase.extend({
  type: z.literal('video'),
  assetId: IdSchema,
  posterAssetId: IdSchema.optional(),
  fit: EncaixeSchema.default('cover'),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  /** Autoplay só é permitido mudo (navegadores exigem gesto do usuário para som). */
  muted: z.boolean().default(true),
  controls: z.boolean().default(true),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
})

export const CamadaTextoSchema = CamadaBase.extend({
  type: z.literal('text'),
  text: z.string().max(5000),
  fontFamily: z.string().max(80).default('Geist'),
  fontSize: z.number().min(6).max(800).default(48),
  fontWeight: z.number().int().min(100).max(900).default(500),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  transform: z.enum(['none', 'uppercase', 'lowercase']).default('none'),
  color: CorSchema.default('#171717'),
  /** Texto com gradiente (preenche as letras). */
  gradient: GradienteSchema.optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  valign: z.enum(['top', 'middle', 'bottom']).default('top'),
  lineHeight: z.number().min(0.6).max(3).default(1.15),
  letterSpacing: z.number().min(-100).max(100).default(0),
  /** Fundo opcional (etiquetas, pills). */
  background: CorSchema.optional(),
  padding: z.number().min(0).max(200).default(0),
  radius: z.number().min(0).max(999).default(0),
  /** Cantos independentes do fundo da caixa. */
  radii: RaiosSchema.optional(),
})

/** `path` = caminho vetorial editável (`vetor`); as demais são primitivas desenhadas pelo renderizador. */
export const FORMAS = ['rect', 'ellipse', 'triangle', 'semicircle', 'line', 'star', 'arrow', 'path', 'polygon'] as const

/** Ponto em coordenadas locais do vetor (0..w, 0..h). */
export const PontoVetorSchema = z.object({ x: z.number(), y: z.number() })
/**
 * Nó de um caminho: posição e alças de Bézier (posições absolutas, nas mesmas coordenadas locais).
 * `suave` = alças espelhadas (mesma direção); `canto` = alças independentes ou nenhuma.
 */
export const NoVetorSchema = z.object({
  x: z.number(),
  y: z.number(),
  entrada: PontoVetorSchema.optional(),
  saida: PontoVetorSchema.optional(),
  tipo: z.enum(['canto', 'suave']).default('canto'),
})
export const CaminhoVetorSchema = z.object({
  nos: z.array(NoVetorSchema).min(1).max(5000),
  fechado: z.boolean().default(false),
  /** Região sem preenchimento (ferramenta Pintar); caminhos abertos desenhados com a caneta começam assim. */
  semPreenchimento: z.boolean().optional(),
})
/**
 * Caminho vetorial editável (modo "Editar vetor"). Coordenadas locais num quadro de referência `w × h`;
 * o renderizador escala para o tamanho atual da camada (redimensionar não reescreve os nós).
 */
export const VetorSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
  caminhos: z.array(CaminhoVetorSchema).min(1).max(500),
  fillRule: z.enum(['nonzero', 'evenodd']).default('nonzero'),
})
export type NoVetor = z.infer<typeof NoVetorSchema>
export type CaminhoVetor = z.infer<typeof CaminhoVetorSchema>
export type Vetor = z.infer<typeof VetorSchema>

export const CamadaFormaSchema = CamadaBase.extend({
  type: z.literal('shape'),
  shape: z.enum(FORMAS).default('rect'),
  fill: CorSchema.default('#5965F2'),
  gradient: GradienteSchema.optional(),
  stroke: CorSchema.optional(),
  strokeWidth: z.number().min(0).max(100).default(0),
  /** Tracejado do contorno (0 = contínuo). */
  dash: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
  /** Textura listrada dos placeholders do design. */
  pattern: z.enum(['none', 'stripes', 'dots', 'grid']).default('none'),
  /** Caminho editável (aditivo). Com `shape: 'path'` o renderizador desenha este caminho. */
  vetor: VetorSchema.optional(),
  /** Forma usada como máscara: não é desenhada; recorta as camadas com `maskId` igual ao seu id. */
  isMask: z.boolean().optional(),
  /** Polígono: número de lados; estrela: número de pontas (ausente = 3 no polígono, 5 na estrela). */
  count: z.number().int().min(3).max(60).optional(),
  /** Estrela: raio interno em fração do externo (ausente = 0,4). */
  ratio: z.number().min(0.05).max(1).optional(),
})

/** Área clicável transparente sobre uma arte finalizada. */
export const CamadaHotspotSchema = CamadaBase.extend({
  type: z.literal('hotspot'),
  ariaLabel: z.string().min(1, 'Hotspot precisa de descrição para leitores de tela').max(200),
  /** Contorno discreto ao passar o mouse (ajuda o convidado a descobrir a interação). */
  hint: z.boolean().default(false),
})

/** SVG vetorial colado do Figma/Illustrator ou enviado como arquivo. Sempre sanitizado antes de salvar. */
export const MAX_SVG_INLINE = 400_000
export const CamadaSvgSchema = CamadaBase.extend({
  type: z.literal('svg'),
  /** Markup SVG já sanitizado (lib/importar/svg.ts). Alternativa: assetId de um .svg no storage. */
  markup: z.string().max(MAX_SVG_INLINE).optional(),
  assetId: IdSchema.optional(),
  /** Troca de cores: cor original (normalizada #rrggbb) → nova cor. */
  recolor: z.record(z.string(), CorSchema).default({}),
  fit: z.enum(['contain', 'fill']).default('contain'),
}).refine((c) => !!c.markup || !!c.assetId, 'SVG precisa de markup ou assetId')

/** Modelo 3D (GLB/GLTF embutido) exportado do Blender, Cinema 4D, Spline etc. Renderizado com <model-viewer>. */
export const CamadaModelo3dSchema = CamadaBase.extend({
  type: z.literal('model3d'),
  assetId: IdSchema,
  posterAssetId: IdSchema.optional(),
  autoRotate: z.boolean().default(true),
  rotationSpeed: z.number().min(0).max(360).default(30),
  /** Convidado pode girar e dar zoom no modelo. */
  cameraControls: z.boolean().default(true),
  /** Órbita inicial no formato do model-viewer: "theta phi raio", ex.: "45deg 70deg 2.5m". */
  cameraOrbit: z.string().max(60).default('0deg 75deg 105%'),
  fieldOfView: z.number().min(10).max(90).default(30),
  exposure: z.number().min(0).max(3).default(1),
  shadowIntensity: z.number().min(0).max(2).default(1),
  shadowSoftness: z.number().min(0).max(1).default(1),
  environment: z.enum(['neutral', 'legacy', 'none']).default('neutral'),
  background: CorSchema.optional(),
  /** Animação embutida no GLB (nome do clip). */
  animation: z.string().max(80).optional(),
  autoplay: z.boolean().default(true),
  /** Permite ver em realidade aumentada no celular. */
  ar: z.boolean().default(false),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
})

/** Animação Lottie (JSON exportado do After Effects/LottieFiles). */
export const MAX_LOTTIE_INLINE = 1_500_000
export const CamadaLottieSchema = CamadaBase.extend({
  type: z.literal('lottie'),
  assetId: IdSchema.optional(),
  /** JSON Lottie inline (arquivos pequenos colados/soltos). */
  data: z.string().max(MAX_LOTTIE_INLINE).optional(),
  loop: z.boolean().default(true),
  autoplay: z.boolean().default(true),
  speed: z.number().min(0.1).max(5).default(1),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
}).refine((c) => !!c.data || !!c.assetId, 'Lottie precisa de data ou assetId')

/** Conteúdo incorporado de serviços confiáveis (YouTube, Vimeo, Figma, Loom, Spline, Sketchfab). */
export const HOSTS_EMBED = ['www.youtube.com', 'youtube.com', 'youtu.be', 'player.vimeo.com', 'vimeo.com', 'www.figma.com', 'figma.com', 'embed.figma.com', 'www.loom.com', 'my.spline.design', 'sketchfab.com', 'open.spotify.com'] as const
export const CamadaEmbedSchema = CamadaBase.extend({
  type: z.literal('embed'),
  url: UrlExternaSchema.refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' && (HOSTS_EMBED as readonly string[]).includes(u.hostname)
    } catch {
      return false
    }
  }, 'Incorporação permitida só de YouTube, Vimeo, Figma, Loom, Spline, Sketchfab e Spotify (https)'),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
})

/** Frame: contêiner (com ou sem auto layout). Filhos apontam para ele via `parentId`. */
export const CamadaFrameSchema = CamadaBase.extend({
  type: z.literal('frame'),
  fill: CorSchema.optional(),
  gradient: GradienteSchema.optional(),
  stroke: CorSchema.optional(),
  strokeWidth: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
  /** Recorta o conteúdo nos limites do frame. */
  clip: z.boolean().default(false),
  /** Ausente = frame livre (filhos com posição própria). */
  layout: AutoLayoutSchema.optional(),
})

export const CamadaSchema = z.discriminatedUnion('type', [
  CamadaImagemSchema,
  CamadaVideoSchema,
  CamadaTextoSchema,
  CamadaFormaSchema,
  CamadaHotspotSchema,
  CamadaSvgSchema,
  CamadaModelo3dSchema,
  CamadaLottieSchema,
  CamadaEmbedSchema,
  CamadaFrameSchema,
])
export type Camada = z.infer<typeof CamadaSchema>
export type TipoCamada = Camada['type']
export type CamadaImagem = z.infer<typeof CamadaImagemSchema>
export type CamadaVideo = z.infer<typeof CamadaVideoSchema>
export type CamadaTexto = z.infer<typeof CamadaTextoSchema>
export type CamadaForma = z.infer<typeof CamadaFormaSchema>
export type CamadaHotspot = z.infer<typeof CamadaHotspotSchema>
export type CamadaSvg = z.infer<typeof CamadaSvgSchema>
export type CamadaModelo3d = z.infer<typeof CamadaModelo3dSchema>
export type CamadaLottie = z.infer<typeof CamadaLottieSchema>
export type CamadaEmbed = z.infer<typeof CamadaEmbedSchema>
export type CamadaFrame = z.infer<typeof CamadaFrameSchema>

/** Tipos que referenciam um asset do storage (para validação de posse e URLs assinadas). */
export function assetsDaCamada(c: Camada): string[] {
  switch (c.type) {
    case 'image':
      return [c.assetId]
    case 'video':
      return [c.assetId, c.posterAssetId].filter((x): x is string => !!x)
    case 'model3d':
      return [c.assetId, c.posterAssetId].filter((x): x is string => !!x)
    case 'svg':
    case 'lottie':
      return c.assetId ? [c.assetId] : []
    default:
      return []
  }
}

// ---------- cena e documento ----------

export const CenaSchema = z.object({
  id: IdSchema,
  title: z.string().max(120).default(''),
  size: TamanhoSchema,
  background: CorSchema.default('#FAFAF9'),
  backgroundGradient: GradienteSchema.optional(),
  backgroundAssetId: IdSchema.optional(),
  backgroundFit: EncaixeSchema.default('cover'),
  /** Transição padrão ao ENTRAR nesta tela (uma ação pode sobrescrever). */
  transition: TransicaoSchema.optional(),
  layers: z.array(CamadaSchema).max(400),
  /** Notas do apresentador (só aparecem na visão do apresentador). */
  notes: z.string().max(10_000).default(''),
  /** Posição no mapa do modo Explorar (px do mapa). */
  map: z.object({ x: z.number(), y: z.number() }).optional(),
  /** Tempo de avanço automático em ms (0 = manual). */
  autoAdvance: z.number().int().min(0).max(600_000).default(0),
})
export type Cena = z.infer<typeof CenaSchema>

/** Estilo de cor nomeado do documento (como os estilos de cor locais do Figma). */
export const EstiloCorSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60),
  color: CorSchema,
})
export type EstiloCor = z.infer<typeof EstiloCorSchema>

export const TemaSchema = z.object({
  /** ID do par da paleta (lib/design-tokens.ts) usado como base. */
  palette: z.string().max(40).default('argila'),
  fontTitle: z.string().max(80).default('Geist'),
  fontBody: z.string().max(80).default('Geist'),
  /** Estilos de cor nomeados (aditivo; ausente = nenhum). */
  colorStyles: z.array(EstiloCorSchema).max(200).optional(),
})
export type Tema = z.infer<typeof TemaSchema>

/** Conteúdo completo gravado em project_snapshots.content_json e usado pelo visualizador. */
export const DocumentoProjetoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  mode: ModoProjetoSchema,
  theme: TemaSchema.optional(),
  scenes: z.array(CenaSchema).min(1).max(300),
})
export type DocumentoProjeto = z.infer<typeof DocumentoProjetoSchema>

// ---------- helpers ----------

export function parseCena(entrada: unknown): Cena {
  return CenaSchema.parse(entrada)
}

export function novaCena(parcial: Partial<Cena> & Pick<Cena, 'id' | 'size'>): Cena {
  return CenaSchema.parse({ title: '', layers: [], ...parcial })
}

export function camadaTemTextoVisivel(c: Camada): boolean {
  return c.type === 'text' && c.text.trim().length > 0
}

/** Normaliza uma camada parcial aplicando defaults do schema (útil no editor e na importação). */
export function parseCamada(entrada: unknown): Camada {
  return CamadaSchema.parse(entrada)
}
