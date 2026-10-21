/**
 * Modelo de parâmetros das animações: cada tipo tem uma família de keyframes (app/globals.css, bloco
 * "MOSTRA · ANIMAÇÕES") e valores padrão. O renderizador transforma (padrões + ajustes da camada) em variáveis
 * CSS (`--anim-*`, `--seg-*`), então UM keyframe serve qualquer distância/escala/rotação no editor, no
 * Pré-visualizar, no /apresentar e no link público. Ajuste ausente = visual padrão do preset (documentos antigos
 * tocam igual). Puro: sem React/DOM.
 */
import { ANIMACOES_DE_SAIDA, ANIMACOES_DE_TEXTO, DIRECOES, ORIGENS, type Animacao } from './schema'

export type Direcao = (typeof DIRECOES)[number]
export type Origem = (typeof ORIGENS)[number]
export type TipoAnim = Animacao['type']
export type Parametro = 'distance' | 'direction' | 'scale' | 'rotate' | 'blur' | 'opacity' | 'origin' | 'split' | 'order' | 'stagger' | 'color' | 'range'
export type Categoria = 'basicas' | 'movimento' | 'revelar' | '3d' | 'enfase' | 'texto'
/** Família de keyframes. `mov`: transform genérico (desloca, escala, gira, desfoca). */
export type Familia = 'mov' | 'pop' | 'elastic' | 'bounce' | 'flip' | 'reveal' | 'mask' | 'iris' | 'draw' | 'texto' | 'nenhuma'

export const CATEGORIAS: { id: Categoria; rotulo: string }[] = [
  { id: 'basicas', rotulo: 'Básicas' },
  { id: 'movimento', rotulo: 'Movimento' },
  { id: 'revelar', rotulo: 'Revelar' },
  { id: '3d', rotulo: '3D' },
  { id: 'enfase', rotulo: 'Ênfase' },
  { id: 'texto', rotulo: 'Texto' },
]

export interface Padroes {
  distance: number
  direction: Direcao
  scale: number
  rotate: number
  blur: number
  opacity: number
  origin: Origem
  split: 'line' | 'word' | 'letter'
  order: 'start' | 'end' | 'center' | 'edges' | 'random'
}

interface Definicao {
  familia: Familia
  categoria: Categoria
  /** Valores padrão (o resto vem de BASE). */
  padrao?: Partial<Padroes>
  /** Controles mostrados em "Ajustar". */
  controles: Parametro[]
  /** Aceita direções diagonais. */
  diagonais?: boolean
  /** A escala vale só num eixo (Expandir: x, Desdobrar: y). */
  eixo?: 'x' | 'y'
}

const BASE: Padroes = { distance: 0, direction: 'up', scale: 1, rotate: 0, blur: 0, opacity: 0, origin: 'center', split: 'word', order: 'start' }
const TEXTO_PARTES: Parametro[] = ['split', 'order', 'stagger', 'distance', 'blur', 'opacity']

export const DEFINICOES: Record<TipoAnim, Definicao> = {
  none: { familia: 'nenhuma', categoria: 'basicas', controles: [] },
  // básicas
  fadeIn: { familia: 'mov', categoria: 'basicas', controles: ['opacity'] },
  scaleIn: { familia: 'mov', categoria: 'basicas', padrao: { scale: 0.92 }, controles: ['scale', 'origin', 'opacity'] },
  blurIn: { familia: 'mov', categoria: 'basicas', padrao: { blur: 24 }, controles: ['blur', 'opacity'] },
  expand: { familia: 'mov', categoria: 'basicas', padrao: { scale: 0, opacity: 1 }, eixo: 'x', controles: ['scale', 'origin', 'opacity'] },
  // movimento
  slideUp: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'up' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideDown: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'down' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideRight: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'right' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideLeft: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'left' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideBlur: { familia: 'mov', categoria: 'movimento', padrao: { distance: 160, direction: 'left', blur: 14 }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  rotateIn: { familia: 'mov', categoria: 'movimento', padrao: { rotate: -12, scale: 0.94 }, controles: ['rotate', 'scale', 'origin', 'opacity'] },
  spinIn: { familia: 'mov', categoria: 'movimento', padrao: { rotate: -180, scale: 0.4 }, controles: ['rotate', 'scale', 'origin', 'opacity'] },
  // revelar
  reveal: { familia: 'reveal', categoria: 'revelar', padrao: { direction: 'right', opacity: 1 }, controles: ['direction', 'opacity'] },
  mask: { familia: 'mask', categoria: 'revelar', padrao: { direction: 'up', opacity: 1 }, controles: ['direction'] },
  iris: { familia: 'iris', categoria: 'revelar', padrao: { opacity: 1 }, controles: ['origin'] },
  unfold: { familia: 'mov', categoria: 'revelar', padrao: { scale: 0, origin: 'top', opacity: 1 }, eixo: 'y', controles: ['scale', 'origin', 'opacity'] },
  draw: { familia: 'draw', categoria: 'revelar', controles: [] },
  // 3D
  flip: { familia: 'flip', categoria: '3d', padrao: { direction: 'up', rotate: 80 }, controles: ['direction', 'rotate', 'origin', 'opacity'] },
  zoomIn: { familia: 'mov', categoria: '3d', padrao: { scale: 0.6, blur: 10 }, controles: ['scale', 'blur', 'origin', 'opacity'] },
  zoomOut: { familia: 'mov', categoria: '3d', padrao: { scale: 1.25, blur: 6 }, controles: ['scale', 'blur', 'origin', 'opacity'] },
  // ênfase
  pop: { familia: 'pop', categoria: 'enfase', padrao: { scale: 0.5 }, controles: ['scale', 'origin'] },
  elastic: { familia: 'elastic', categoria: 'enfase', padrao: { scale: 0.4 }, controles: ['scale', 'origin'] },
  bounce: { familia: 'bounce', categoria: 'enfase', padrao: { distance: 120, direction: 'down' }, diagonais: true, controles: ['distance', 'direction'] },
  // texto (camadas de texto; nas outras viram fade)
  words: { familia: 'texto', categoria: 'texto', padrao: { split: 'word' }, controles: TEXTO_PARTES },
  letters: { familia: 'texto', categoria: 'texto', padrao: { split: 'letter' }, controles: TEXTO_PARTES },
  lines: { familia: 'texto', categoria: 'texto', padrao: { split: 'line', opacity: 1 }, controles: ['order', 'stagger'] },
  cascade: { familia: 'texto', categoria: 'texto', padrao: { split: 'letter', scale: 0.4, rotate: -14 }, controles: ['split', 'order', 'stagger', 'distance', 'rotate', 'scale'] },
  typewriter: { familia: 'texto', categoria: 'texto', padrao: { split: 'letter' }, controles: ['stagger'] },
  scramble: { familia: 'texto', categoria: 'texto', padrao: { split: 'letter' }, controles: ['order', 'stagger'] },
  highlight: { familia: 'texto', categoria: 'texto', controles: ['color', 'range'] },
  underline: { familia: 'texto', categoria: 'texto', controles: ['color', 'range'] },
  counter: { familia: 'texto', categoria: 'texto', controles: [] },
  // saídas
  fadeOut: { familia: 'mov', categoria: 'basicas', controles: ['opacity'] },
  scaleOut: { familia: 'mov', categoria: 'basicas', padrao: { scale: 0.92 }, controles: ['scale', 'origin', 'opacity'] },
  blurOut: { familia: 'mov', categoria: 'basicas', padrao: { blur: 16 }, controles: ['blur', 'opacity'] },
  slideOutUp: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'up' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideOutDown: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'down' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideOutLeft: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'left' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  slideOutRight: { familia: 'mov', categoria: 'movimento', padrao: { distance: 40, direction: 'right' }, diagonais: true, controles: ['distance', 'direction', 'blur', 'opacity'] },
  spinOut: { familia: 'mov', categoria: 'movimento', padrao: { rotate: 180, scale: 0.4 }, controles: ['rotate', 'scale', 'origin', 'opacity'] },
  wipeOut: { familia: 'reveal', categoria: 'revelar', padrao: { direction: 'right', opacity: 1 }, controles: ['direction', 'opacity'] },
  maskOut: { familia: 'mask', categoria: 'revelar', padrao: { direction: 'down', opacity: 1 }, controles: ['direction'] },
  irisOut: { familia: 'iris', categoria: 'revelar', padrao: { opacity: 1 }, controles: ['origin'] },
  flipOut: { familia: 'flip', categoria: '3d', padrao: { direction: 'down', rotate: 80 }, controles: ['direction', 'rotate', 'origin', 'opacity'] },
  zoomAway: { familia: 'mov', categoria: '3d', padrao: { scale: 0.6, blur: 10 }, controles: ['scale', 'blur', 'origin', 'opacity'] },
  collapse: { familia: 'mov', categoria: 'revelar', padrao: { scale: 0, opacity: 1 }, eixo: 'y', controles: ['scale', 'origin', 'opacity'] },
}

export function ehSaida(tipo: TipoAnim): boolean {
  return (ANIMACOES_DE_SAIDA as readonly string[]).includes(tipo)
}
export function ehTextoAnimado(tipo: TipoAnim): boolean {
  return (ANIMACOES_DE_TEXTO as readonly string[]).includes(tipo)
}
export function definicao(tipo: TipoAnim): Definicao {
  return DEFINICOES[tipo] ?? DEFINICOES.fadeIn
}

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Padrões do tipo + ajustes da animação, normalizados (faixas seguras, direção válida para o tipo). */
export function parametros(a: Pick<Animacao, 'type'> & Partial<Animacao>): Padroes {
  const d = definicao(a.type)
  const p = { ...BASE, ...d.padrao }
  let direction = a.direction ?? p.direction
  if (!d.diagonais && direction.includes('-')) direction = direction.split('-')[0] as Direcao
  return {
    distance: limitar(a.distance ?? p.distance, 0, 800),
    direction,
    scale: limitar(a.scale ?? p.scale, 0, 3),
    rotate: limitar(a.rotate ?? p.rotate, -720, 720),
    blur: limitar(a.blur ?? p.blur, 0, 80),
    opacity: limitar(a.opacity ?? p.opacity, 0, 1),
    origin: a.origin ?? p.origin,
    split: a.split ?? p.split,
    order: a.order ?? p.order,
  }
}

/** Remove ajustes iguais ao padrão (o documento só guarda o que mudou). */
export function semAjustesPadrao(a: Animacao): Animacao {
  const d = definicao(a.type)
  const p = { ...BASE, ...d.padrao } as Record<string, unknown>
  const r = { ...a } as Record<string, unknown>
  for (const k of ['distance', 'direction', 'scale', 'rotate', 'blur', 'opacity', 'origin', 'split', 'order'] as const) if (r[k] !== undefined && r[k] === p[k]) delete r[k]
  return r as Animacao
}

/** Ajustes da animação que valem para o tipo (ao trocar de preset, descarta o que não se aplica). */
export function ajustesQueServem(a: Partial<Animacao>, tipo: TipoAnim): Partial<Animacao> {
  const controles = new Set<string>(definicao(tipo).controles)
  const r: Partial<Animacao> = {}
  for (const k of ['distance', 'direction', 'scale', 'rotate', 'blur', 'opacity', 'origin', 'split', 'order', 'stagger', 'color', 'range'] as const) {
    if (a[k] !== undefined && controles.has(k)) (r as Record<string, unknown>)[k] = a[k]
  }
  return r
}

export const VETOR: Record<Direcao, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  'up-left': [-Math.SQRT1_2, -Math.SQRT1_2], 'up-right': [Math.SQRT1_2, -Math.SQRT1_2], 'down-left': [-Math.SQRT1_2, Math.SQRT1_2], 'down-right': [Math.SQRT1_2, Math.SQRT1_2],
}
/** Deslocamento do ponto de origem em relação ao centro (% do próprio tamanho). */
const ORIGEM_XY: Record<Origem, [number, number]> = {
  'top-left': [-50, -50], top: [0, -50], 'top-right': [50, -50], left: [-50, 0], center: [0, 0], right: [50, 0], 'bottom-left': [-50, 50], bottom: [0, 50], 'bottom-right': [50, 50],
}
const arred = (n: number) => Math.round(n * 100) / 100

export interface ResultadoCss {
  /** Nome do keyframe da camada (vazio = a camada não anima; ex.: texto dividido anima as partes). */
  keyframe: string
  vars: Record<string, string | number>
}

/**
 * Keyframe + variáveis CSS de uma entrada/saída. `ehTexto`: camada de texto (as entradas de texto animam as
 * partes; a camada só recebe as variáveis `--seg-*`).
 */
export function cssDaAnimacao(a: Pick<Animacao, 'type'> & Partial<Animacao>, ehTexto: boolean): ResultadoCss {
  const d = definicao(a.type)
  const saida = ehSaida(a.type)
  const p = parametros(a)
  const [vx, vy] = VETOR[p.direction]
  const sinal = saida ? 1 : -1 // entrada: começa do lado oposto ao movimento; saída: termina no sentido dele
  const [ox, oy] = ORIGEM_XY[p.origin]
  const vars: Record<string, string | number> = {
    '--anim-op': p.opacity,
    '--anim-ox': `${ox}%`,
    '--anim-oy': `${oy}%`,
  }
  switch (d.familia) {
    case 'nenhuma':
      return { keyframe: '', vars: {} }
    case 'mov':
    case 'bounce':
    case 'pop':
    case 'elastic': {
      vars['--anim-dx'] = `${arred(sinal * vx * p.distance)}px`
      vars['--anim-dy'] = `${arred(sinal * vy * p.distance)}px`
      vars['--anim-sx'] = d.eixo === 'y' ? 1 : p.scale
      vars['--anim-sy'] = d.eixo === 'x' ? 1 : p.scale
      vars['--anim-rot'] = `${p.rotate}deg`
      vars['--anim-blur'] = `${p.blur}px`
      if (d.familia !== 'mov') return { keyframe: `anim-${d.familia}`, vars }
      return { keyframe: `anim-mov${saida ? 'Sai' : ''}${p.blur > 0 ? 'Blur' : ''}`, vars }
    }
    case 'flip': {
      const r = p.rotate
      // "para cima": a borda de baixo vem para a frente (rotateX positivo inclina o topo para trás)
      vars['--anim-rx'] = `${p.direction === 'up' ? -sinal * r : p.direction === 'down' ? sinal * r : 0}deg`
      vars['--anim-ry'] = `${p.direction === 'left' ? sinal * r : p.direction === 'right' ? -sinal * r : 0}deg`
      return { keyframe: saida ? 'anim-flipSai' : 'anim-flip', vars }
    }
    case 'reveal': {
      // entrada: o lado para onde a cortina anda vai de 100% a 0; saída: o lado de trás vai de 0 a 100%
      const lados = { up: 0, right: 1, down: 2, left: 3 } as const
      const oposto = { up: 'down', down: 'up', left: 'right', right: 'left' } as const
      const dir = p.direction as keyof typeof lados
      const lado = lados[saida ? oposto[dir] : dir]
      const inset = (v: string) => `inset(${[0, 1, 2, 3].map((i) => (i === lado ? v : '-50%')).join(' ')})`
      vars['--clip-de'] = inset(saida ? '0%' : '100%')
      vars['--clip-ate'] = inset(saida ? '100%' : '0%')
      return { keyframe: saida ? 'anim-revealSai' : 'anim-reveal', vars }
    }
    case 'mask': {
      vars['--mask-x'] = `${sinal * vx * 100}%`
      vars['--mask-y'] = `${sinal * vy * 100}%`
      return { keyframe: saida ? 'anim-maskSai' : 'anim-mask', vars }
    }
    case 'iris': {
      vars['--iris-pos'] = `${50 + ox}% ${50 + oy}%`
      // raio que cobre a caixa a partir do ponto (circle() em % da diagonal/√2)
      vars['--iris-r'] = ox === 0 && oy === 0 ? '72%' : ox === 0 || oy === 0 ? '115%' : '145%'
      return { keyframe: saida ? 'anim-irisSai' : 'anim-iris', vars }
    }
    case 'draw':
      return { keyframe: 'anim-draw', vars }
    case 'texto': {
      if (!ehTexto) return { keyframe: 'anim-mov', vars: { ...vars, '--anim-op': 0, '--anim-dx': '0px', '--anim-dy': '0px', '--anim-sx': 1, '--anim-sy': 1, '--anim-rot': '0deg', '--anim-blur': '0px' } }
      return { keyframe: '', vars: varsDeTexto(a, p) }
    }
  }
}

/** Variáveis das partes do texto (em em: proporcionais ao corpo; a distância ajustada vem em px). */
function varsDeTexto(a: Pick<Animacao, 'type'> & Partial<Animacao>, p: Padroes): Record<string, string | number> {
  const padraoDy: Partial<Record<TipoAnim, string>> = { words: '.45em', letters: '.6em', cascade: '-.9em' }
  const padraoBlur: Partial<Record<TipoAnim, string>> = { words: '.06em' }
  return {
    '--seg-dy': a.distance !== undefined ? `${a.type === 'cascade' ? -a.distance : a.distance}px` : (padraoDy[a.type] ?? '0px'),
    '--seg-blur': a.blur !== undefined ? `${a.blur}px` : (padraoBlur[a.type] ?? '0px'),
    '--seg-op': p.opacity,
    '--seg-escala': p.scale,
    '--seg-rot': `${p.rotate}deg`,
  }
}

/** Keyframe das partes de um texto dividido. */
export function keyframeDaParte(a: Pick<Animacao, 'type'> & Partial<Animacao>): string {
  if (a.type === 'typewriter') return 'seg-typewriter'
  if (a.type === 'lines') return 'seg-linha'
  if (a.type === 'scramble') return 'seg-scramble'
  const temBlur = a.blur !== undefined ? a.blur > 0 : a.type === 'words'
  return temBlur ? 'seg-movBlur' : 'seg-mov'
}

/** Modo de divisão efetivo de uma entrada de texto (null = não divide). */
export function divisao(a: Pick<Animacao, 'type'> & Partial<Animacao>): 'line' | 'word' | 'letter' | null {
  if (a.type === 'typewriter' || a.type === 'scramble') return 'letter'
  if (a.type === 'lines') return 'line'
  if (a.type === 'words' || a.type === 'letters' || a.type === 'cascade') return parametros(a).split
  return null
}
