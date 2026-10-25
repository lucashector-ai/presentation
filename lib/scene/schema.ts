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
  // documentos para PDF (150 dpi): A4, A3 e Carta, retrato e paisagem
  a4Retrato: { width: 1240, height: 1754 },
  a4Paisagem: { width: 1754, height: 1240 },
  a3Retrato: { width: 1754, height: 2480 },
  a3Paisagem: { width: 2480, height: 1754 },
  cartaRetrato: { width: 1275, height: 1650 },
  cartaPaisagem: { width: 1650, height: 1275 },
} as const
/** Nome e uso de cada formato (listas de escolha de formato). */
export const FORMATOS_INFO: Record<keyof typeof FORMATOS, { nome: string; grupo: 'apresentacao' | 'pdf' | 'social' }> = {
  slides169: { nome: 'Apresentação 16:9', grupo: 'apresentacao' },
  slides43: { nome: 'Apresentação 4:3', grupo: 'apresentacao' },
  a4Retrato: { nome: 'PDF A4 retrato', grupo: 'pdf' },
  a4Paisagem: { nome: 'PDF A4 paisagem', grupo: 'pdf' },
  a3Retrato: { nome: 'PDF A3 retrato', grupo: 'pdf' },
  a3Paisagem: { nome: 'PDF A3 paisagem', grupo: 'pdf' },
  cartaRetrato: { nome: 'PDF Carta retrato', grupo: 'pdf' },
  cartaPaisagem: { nome: 'PDF Carta paisagem', grupo: 'pdf' },
  story: { nome: 'Story 9:16', grupo: 'social' },
  quadrado: { nome: 'Quadrado 1:1', grupo: 'social' },
}
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
  /**
   * Quando a entrada toca: ao entrar na tela (padrão), depois de outra camada, ao clicar, ao passar o mouse ou
   * acompanhando a rolagem (`scroll`: no Story o progresso segue a rolagem; nos outros modos toca ao entrar).
   */
  trigger: z.enum(['enter', 'after', 'click', 'hover', 'scroll']).optional(),
  /** trigger "scroll": trecho da passagem da camada pela janela (0 = começa a aparecer, 100 = acabou de sair) em que a entrada acontece. */
  scrollRange: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).optional(),
  /** Quantas vezes a entrada toca seguida (ausente = 1). */
  repeat: z.number().int().min(1).max(20).optional(),
  /** Contador: indicador de progresso junto do número (círculo em volta ou barra embaixo). */
  progress: z.enum(['circle', 'bar']).optional(),
  /** Contador: valor que enche o indicador (ausente = 100 com "%", senão o próprio número). */
  progressMax: z.number().positive().max(1e12).optional(),
  /** Contador: cor do indicador (ausente = a cor do texto). */
  progressColor: CorSchema.optional(),
  /** Contador: espessura do indicador, em px da cena. */
  progressWidth: z.number().min(1).max(80).optional(),
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
  /** `offscreen`: repete até a camada sair da janela (no Story, ao rolar para longe; nos slides, até trocar de tela). */
  until: z.enum(['offscreen']).optional(),
})
export type Loop = z.infer<typeof LoopSchema>

/** Transições entre telas. `morph` anima camadas com o mesmo nome/ID entre a tela de origem e a de destino. */
/** `push`: a tela nova empurra a anterior para fora (as duas andam juntas). */
/** `auto`: morph quando o mesmo objeto (mesmo ID ou nome único) mudou entre as telas, senão fade (lib/scene/morph.ts). */
export const TIPOS_TRANSICAO = ['none', 'fade', 'slide', 'scale', 'morph', 'push', 'auto'] as const
export const TransicaoSchema = z.object({
  type: z.enum(TIPOS_TRANSICAO).default('fade'),
  duration: z.number().int().min(DURACAO_MIN_MS).max(DURACAO_MAX_MS).default(500),
  easing: z.enum(EASINGS).default('easeInOut'),
})
export type Transicao = z.infer<typeof TransicaoSchema>

/**
 * Efeitos interativos da camada (no visualizador): parallax (profundidade que reage ao mouse, à rolagem do
 * Story, ao voo do Explorar e à transição entre telas), tilt 3D e luz que seguem o mouse. Tudo opcional;
 * ausente = camada parada. Parâmetros e padrões: lib/scene/reativos.ts.
 */
export const EfeitosInterativosSchema = z.object({
  parallax: z.object({
    /** Profundidade: positivo = mais perto (anda mais), negativo = mais longe (anda menos, ao contrário). */
    depth: z.number().min(-100).max(100),
    /** Eixos que se movem com o mouse (a rolagem e as transições usam o eixo delas). */
    axis: z.enum(['both', 'x', 'y']).optional(),
  }).optional(),
  tilt: z.object({
    /** Inclinação máxima, em graus. */
    angle: z.number().min(1).max(30),
    /** Escala enquanto o mouse está em cima (1 = não cresce). */
    scale: z.number().min(1).max(1.2).optional(),
    /** Perspectiva em px (menor = 3D mais forte). */
    perspective: z.number().min(300).max(4000).optional(),
    /** Quanto o movimento atrasa em relação ao mouse (0 = cola no mouse, 1 = bem macio). */
    smooth: z.number().min(0).max(1).optional(),
  }).optional(),
  spotlight: z.object({
    /** `light`: luz que segue o mouse; `dark`: lanterna (escurece em volta do mouse). */
    mode: z.enum(['light', 'dark']),
    /** Raio da luz em % do maior lado da camada. */
    size: z.number().min(5).max(150).optional(),
    /** Força (0–1). */
    intensity: z.number().min(0).max(1).optional(),
    color: CorSchema.optional(),
  }).optional(),
})
export type EfeitosInterativos = z.infer<typeof EfeitosInterativosSchema>

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
  /** Grão (ruído) por cima da camada, 0–1. Aditivo. */
  noise: z.number().min(0).max(1).optional(),
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
/** Ponta de início/fim de linhas e setas (como o "Start point"/"End point" do Figma). */
export const PONTAS_SETA = ['none', 'arrow', 'triangle', 'circle', 'square', 'bar'] as const
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
  /** Linhas e setas: ponta desenhada no início/fim (ausente = seta no fim da forma "arrow", nenhuma na linha). */
  startArrow: z.enum(PONTAS_SETA).optional(),
  endArrow: z.enum(PONTAS_SETA).optional(),
  hidden: z.boolean().optional(),
})
export type Traco = z.infer<typeof TracoSchema>
export const MAX_TRACOS = 8

/** Restrições (constraints) do Figma: como a camada acompanha o pai (frame livre ou tela) quando ele muda de tamanho. */
export const RESTRICOES_H = ['left', 'right', 'leftRight', 'center', 'scale'] as const
export const RESTRICOES_V = ['top', 'bottom', 'topBottom', 'center', 'scale'] as const
export const RestricoesSchema = z.object({ h: z.enum(RESTRICOES_H).default('left'), v: z.enum(RESTRICOES_V).default('top') })
export type Restricoes = z.infer<typeof RestricoesSchema>

// ---------- guias de layout ----------

/**
 * Guias de layout (as "layout guides" do Figma/Framer) de uma tela ou de um frame: grade uniforme, colunas ou linhas.
 * Só o editor desenha e encaixa nelas; visualizador, miniaturas e exportação ignoram. Aditivo: ausente = nenhuma.
 * Geometria e padrões em lib/scene/guias.ts.
 */
export const TIPOS_GUIA = ['grid', 'columns', 'rows'] as const
/** Esticar (margens nas duas pontas) · início (esquerda/topo) · centro · fim (direita/base). */
export const ALINHAMENTOS_GUIA = ['stretch', 'start', 'center', 'end'] as const
export const MAX_GUIAS = 20
/** Cor das guias novas: a das guias inteligentes do editor (#F25987) a 10%. */
export const COR_GUIA_PADRAO = '#F259871A'

const GuiaBase = {
  /** Cor com alfa (#RRGGBBAA): a opacidade da guia é o alfa da cor. */
  color: CorSchema.default(COR_GUIA_PADRAO),
  visible: z.boolean().default(true),
}
export const GuiaGradeSchema = z.object({ type: z.literal('grid'), size: z.number().int().min(1).max(1000).default(8), ...GuiaBase })
const faixas = <T extends 'columns' | 'rows'>(tipo: T) =>
  z.object({
    type: z.literal(tipo),
    count: z.number().int().min(1).max(100).default(12),
    alignment: z.enum(ALINHAMENTOS_GUIA).default('stretch'),
    /** Largura (colunas) ou altura (linhas) de cada faixa quando não estica. Ausente = a que esticaria. */
    width: z.number().min(1).max(8192).optional(),
    /** Esticar: margem nas duas pontas. Início/fim: deslocamento da borda. Centro: ignorada. */
    margin: z.number().min(0).max(8192).default(0),
    gutter: z.number().min(0).max(8192).default(0),
    ...GuiaBase,
  })
export const GuiaColunasSchema = faixas('columns')
export const GuiaLinhasSchema = faixas('rows')
export const GuiaLayoutSchema = z.discriminatedUnion('type', [GuiaGradeSchema, GuiaColunasSchema, GuiaLinhasSchema])
export type GuiaLayout = z.infer<typeof GuiaLayoutSchema>
export type GuiaGrade = z.infer<typeof GuiaGradeSchema>
export type GuiaFaixas = z.infer<typeof GuiaColunasSchema> | z.infer<typeof GuiaLinhasSchema>
export const GuiasLayoutSchema = z.array(GuiaLayoutSchema).max(MAX_GUIAS)

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

/** Tipos de máscara (painel "Tipo de máscara": Alfa · Contorno · Luminância). */
export const TIPOS_MASCARA = ['alpha', 'outline', 'luminance'] as const
export type TipoMascara = (typeof TIPOS_MASCARA)[number]

const CamadaBase = z.object({
  id: IdSchema,
  name: z.string().max(80).optional(),
  /** false = não anima entre telas (o mesmo objeto aparece parado nas outras telas, sem Magic Move). */
  morph: z.boolean().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().min(-360).max(360).default(0),
  /** Inclinação 3D (perspectiva CSS): isométrico, cartões em ângulo. Aditivo; ausente = plano. */
  rotateX: z.number().min(-180).max(180).optional(),
  rotateY: z.number().min(-180).max(180).optional(),
  /** Distância da câmera em px (quanto menor, mais perspectiva). */
  perspective: z.number().min(100).max(5000).optional(),
  /** Mídia marcada para download na apresentação (com `documento.downloads.ativo`). Aditivo. */
  download: z.boolean().optional(),
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
  /** Parallax, tilt 3D e luz que seguem o mouse/rolagem (aditivo; ausente = nenhum). */
  interactiveEffects: EfeitosInterativosSchema.optional(),
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
  /** Peso do `fill` no eixo principal do auto layout (como flex-grow): 2 ocupa o dobro de 1. Ausente = 1. */
  layoutGrow: z.number().min(0.1).max(10).optional(),
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
  /** Camada recortada pela máscara `maskId` (uma camada com `isMask` abaixo dela). */
  maskId: IdSchema.optional(),
  /**
   * Camada usada como máscara (⌃⌘M, como "Use as mask" do Figma): não é desenhada; recorta as camadas com
   * `maskId` igual ao seu id. Formas, textos, imagens e SVG. Aditivo (antes só existia em formas).
   */
  isMask: z.boolean().optional(),
  /**
   * Tipo de máscara (como no Figma): `alpha` = usa a transparência da camada (e a opacidade); `outline` = só a
   * silhueta, opaca; `luminance` = claro mostra, escuro esconde. Ausente = `outline` nas formas (como as
   * máscaras antigas) e `alpha` nos demais tipos. Ver lib/scene/mascara.ts (`tipoMascara`).
   */
  maskType: z.enum(TIPOS_MASCARA).optional(),
})

export const EncaixeSchema = z.enum(['contain', 'cover', 'fill'])

/** Preenchimento com imagem (formas e frames), como o Image fill do Figma: ocupa a caixa e respeita raio e recorte. */
export const ImagemPreenchimentoSchema = z.object({ assetId: IdSchema, fit: EncaixeSchema.default('cover') })
export type ImagemPreenchimento = z.infer<typeof ImagemPreenchimentoSchema>

/** Recorte não destrutivo de imagem: frações (0–1) da imagem original. */
export const RecorteSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.01).max(1), h: z.number().min(0.01).max(1) })

export const AjustesImagemSchema = z.object({
  brightness: z.number().min(0).max(2).default(1),
  contrast: z.number().min(0).max(2).default(1),
  saturate: z.number().min(0).max(2).default(1),
  grayscale: z.number().min(0).max(1).default(0),
  /** Inverter as cores (aditivo; com brilho 0 vira silhueta branca, usada no logo sobre fundo escuro). */
  invert: z.number().min(0).max(1).optional(),
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

/** Caixa do texto (none/uppercase/lowercase desde a v1; os demais são aditivos). */
export const CAIXAS_TEXTO = ['none', 'uppercase', 'lowercase', 'capitalize', 'smallCaps', 'allSmallCaps'] as const
export const ESTILOS_DECORACAO = ['solid', 'dotted', 'wavy'] as const

/** Trecho do texto com estilo próprio (rich text): posições de caractere em `text` (fim exclusivo). */
export const TrechoSchema = z.object({
  inicio: z.number().int().min(0),
  fim: z.number().int().min(0),
  color: CorSchema.optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  fontFamily: z.string().max(80).optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
})
export type Trecho = z.infer<typeof TrechoSchema>

export const CamadaTextoSchema = CamadaBase.extend({
  type: z.literal('text'),
  text: z.string().max(5000),
  /** Partes do texto com cor, peso, fonte, itálico ou sublinhado próprios (lib/scene/trechos.ts). */
  trechos: z.array(TrechoSchema).max(500).optional(),
  fontFamily: z.string().max(80).default('Geist'),
  fontSize: z.number().min(6).max(800).default(48),
  fontWeight: z.number().int().min(100).max(900).default(500),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  /**
   * Caixa (como o "Case" do Figma). `capitalize` = Primeira Maiúscula; `smallCaps` = versalete (minúsculas viram
   * versaletes); `allSmallCaps` = versalete forçado (tudo em versalete). Os três últimos são aditivos.
   */
  transform: z.enum(CAIXAS_TEXTO).default('none'),
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
  // --- opções de texto (painel "Opções de texto", como o "Type settings" do Figma). Todas aditivas:
  // ausentes = o visual de antes (documentos antigos abrem iguais). Ver lib/scene/tipografia.ts.
  /** Tachado (exclusivo com `underline` no painel, como a "Decoração" do Figma). */
  strikethrough: z.boolean().optional(),
  /** Estilo da linha do sublinhado/tachado (ausente = contínua). */
  decorationStyle: z.enum(ESTILOS_DECORACAO).optional(),
  /** Espessura da linha em px (ausente = automática, a da fonte). */
  decorationThickness: z.number().min(0.5).max(100).optional(),
  /** Distância do sublinhado até a linha de base, em px (ausente = automática). */
  decorationOffset: z.number().min(-100).max(100).optional(),
  /** Pular descendentes (a linha se interrompe em g, p, y). Ausente = sim. */
  decorationSkipInk: z.boolean().optional(),
  /** Cor da linha (ausente = cor do texto). */
  decorationColor: CorSchema.optional(),
  /**
   * Corte vertical ("Vertical trim" do Figma): `cap` = da altura das maiúsculas até a linha de base — a caixa fica
   * justa nas letras (sem o respiro da entrelinha em cima e embaixo). Ausente/`none` = padrão.
   */
  leadingTrim: z.enum(['none', 'cap']).optional(),
  /** Estilo de lista: cada parágrafo (linha separada por Enter) vira um item com marcador ou número. */
  listStyle: z.enum(['none', 'bullet', 'number']).optional(),
  /** Espaço extra entre parágrafos, em px. */
  paragraphSpacing: z.number().min(0).max(1000).optional(),
  /** Truncar com reticências: corta no fim da caixa (altura fixa) ou em `maxLines` linhas. */
  truncate: z.boolean().optional(),
  /** Máximo de linhas quando `truncate` está ligado (ausente = até onde a caixa couber). */
  maxLines: z.number().int().min(1).max(999).optional(),
  /** Quebra de linha: automática, equilibrada (linhas de tamanho parecido) ou "bonita" (evita palavra sozinha no fim). */
  textWrap: z.enum(['auto', 'balance', 'pretty']).optional(),
  /** Algarismos tabulares (todos com a mesma largura — tabelas, contadores). */
  tabularNums: z.boolean().optional(),
  /** Ligaduras comuns (fi, fl). Ausente = ligadas, como na fonte. */
  ligatures: z.boolean().optional(),
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
  fillImage: ImagemPreenchimentoSchema.optional(),
  stroke: CorSchema.optional(),
  strokeWidth: z.number().min(0).max(100).default(0),
  /** Tracejado do contorno (0 = contínuo). */
  dash: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
  /** Textura listrada dos placeholders do design. */
  pattern: z.enum(['none', 'stripes', 'dots', 'grid']).default('none'),
  /** Textura: escala do passo (1 = padrão), espessura do traço/ponto (1 = padrão) e opacidade (ausente = a do padrão). */
  patternScale: z.number().min(0.1).max(8).optional(),
  patternWeight: z.number().min(0.1).max(8).optional(),
  patternOpacity: z.number().min(0).max(1).optional(),
  /** Caminho editável (aditivo). Com `shape: 'path'` o renderizador desenha este caminho. */
  vetor: VetorSchema.optional(),
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
export const MAX_HTML_EMBED = 60_000
export const CamadaEmbedSchema = CamadaBase.extend({
  type: z.literal('embed'),
  url: UrlExternaSchema.refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' && (HOSTS_EMBED as readonly string[]).includes(u.hostname)
    } catch {
      return false
    }
  }, 'Incorporação permitida só de YouTube, Vimeo, Figma, Loom, Spline, Sketchfab e Spotify (https)').optional(),
  /** HTML próprio (Blocos → Embed → HTML): roda num iframe isolado (sandbox só com scripts, sem origem nem cookies). */
  html: z.string().max(MAX_HTML_EMBED).optional(),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
}).refine((c) => !!c.url || !!c.html, 'Incorporação precisa de um link ou de HTML')

/** Frame: contêiner (com ou sem auto layout). Filhos apontam para ele via `parentId`. */
export const CamadaFrameSchema = CamadaBase.extend({
  type: z.literal('frame'),
  fill: CorSchema.optional(),
  gradient: GradienteSchema.optional(),
  fillImage: ImagemPreenchimentoSchema.optional(),
  stroke: CorSchema.optional(),
  strokeWidth: z.number().min(0).max(100).default(0),
  radius: z.number().min(0).max(999).default(0),
  radii: RaiosSchema.optional(),
  /** Recorta o conteúdo nos limites do frame. */
  clip: z.boolean().default(false),
  /** Ausente = frame livre (filhos com posição própria). */
  layout: AutoLayoutSchema.optional(),
  /** Guias de layout do frame (só no editor). */
  guias: GuiasLayoutSchema.optional(),
  /** Bento grid (Blocos): preset, espaço e raio dos cartões; regenerado pela seção Bento do inspetor. */
  bento: z.object({ preset: z.string().max(40), gap: z.number().min(0).max(200), radius: z.number().min(0).max(200), padding: z.number().min(0).max(400).optional() }).optional(),
  /** Mockup (Blocos): modelo e cor da moldura; regenerado pela seção Mockup do inspetor. */
  mockup: z.object({ modelo: z.string().max(40), cor: CorSchema }).optional(),
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
  /** Guias de layout da tela (grade, colunas, linhas), só no editor. Ausente = nenhuma. */
  guias: GuiasLayoutSchema.optional(),
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
  /** Downloads na apresentação: liga o botão de arquivos e a página de downloads no final. Aditivo. */
  downloads: z.object({ ativo: z.boolean().default(false), paginaFinal: z.boolean().default(false) }).optional(),
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
