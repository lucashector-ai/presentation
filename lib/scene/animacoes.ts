/**
 * Catálogo de animações da aba Animação + lógica pura de "Animar tela inteira", escalonamento e linha do tempo.
 * Sem React/DOM: usado pelo inspetor, pelo renderizador e pelos testes.
 *
 * Convenção de tempo: `duration` é o tempo TOTAL da entrada. Nas entradas de texto divididas
 * (máquina de escrever, palavra/letra por letra) ele é repartido entre as partes (ver `tempoSegmentos`),
 * então a barra da linha do tempo (delay → delay + duration) é sempre fiel ao que o público vê.
 */
import { ANIMACOES_DE_TEXTO, DURACAO_MAX_MS, DURACAO_MIN_MS, type Animacao, type Camada, type Cena, type Loop } from './schema'
import { EASING_CSS } from './motor'

export type TipoAnimacao = Animacao['type']
export type TipoLoop = Loop['type']

// ---------- catálogo ----------

/** Curva "Rápida" (expo out): arranca rápido e assenta longo — o padrão de entradas profissionais. */
export const EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

export interface PresetEntrada {
  id: TipoAnimacao
  rotulo: string
  /** Duração e curva sugeridas ao escolher o preset. */
  duracao: number
  easing: Animacao['easing']
  bezier?: Animacao['bezier']
  /** Só para camadas de texto. */
  soTexto?: boolean
}

export const PRESETS_ENTRADA: PresetEntrada[] = [
  { id: 'fadeIn', rotulo: 'Fade', duracao: 600, easing: 'easeOut' },
  { id: 'slideUp', rotulo: 'Subir', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideDown', rotulo: 'Descer', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideRight', rotulo: 'Da esquerda', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideLeft', rotulo: 'Da direita', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'pop', rotulo: 'Pop', duracao: 600, easing: 'easeOut' },
  { id: 'zoomOut', rotulo: 'Zoom out', duracao: 900, easing: 'easeOut', bezier: EXPO },
  { id: 'scaleIn', rotulo: 'Escala', duracao: 700, easing: 'spring' },
  { id: 'blurIn', rotulo: 'Desfocar', duracao: 900, easing: 'easeOut' },
  { id: 'reveal', rotulo: 'Revelar', duracao: 800, easing: 'easeInOut' },
  { id: 'rotateIn', rotulo: 'Girar', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'elastic', rotulo: 'Elástico', duracao: 900, easing: 'easeOut' },
  { id: 'typewriter', rotulo: 'Máquina de escrever', duracao: 1200, easing: 'linear', soTexto: true },
  { id: 'words', rotulo: 'Palavra por palavra', duracao: 1000, easing: 'easeOut', bezier: EXPO, soTexto: true },
  { id: 'letters', rotulo: 'Letra por letra', duracao: 1000, easing: 'easeOut', bezier: EXPO, soTexto: true },
]

export interface PresetLoop {
  id: TipoLoop
  rotulo: string
  duracao: number
}
export const PRESETS_LOOP: PresetLoop[] = [
  { id: 'float', rotulo: 'Flutuar', duracao: 3200 },
  { id: 'pulse', rotulo: 'Pulsar', duracao: 1800 },
  { id: 'wiggle', rotulo: 'Balançar', duracao: 1400 },
  { id: 'spin', rotulo: 'Girar contínuo', duracao: 8000 },
]

export const PRESETS_SAIDA: PresetEntrada[] = [
  { id: 'fadeOut', rotulo: 'Fade', duracao: 400, easing: 'easeIn' },
  { id: 'slideOutUp', rotulo: 'Subir', duracao: 450, easing: 'easeIn' },
  { id: 'slideOutDown', rotulo: 'Descer', duracao: 450, easing: 'easeIn' },
  { id: 'scaleOut', rotulo: 'Encolher', duracao: 400, easing: 'easeIn' },
  { id: 'blurOut', rotulo: 'Desfocar', duracao: 500, easing: 'easeIn' },
]

const NOMES: Partial<Record<TipoAnimacao, string>> = {
  none: 'Nenhuma', fadeOut: 'Sumir', scaleOut: 'Encolher', slideOutUp: 'Sair subindo', slideOutDown: 'Sair descendo', blurOut: 'Desfocar',
}
/** Nome curto em português para resumos ("Pop · 600ms"). */
export function nomeAnimacao(tipo: TipoAnimacao): string {
  return NOMES[tipo] ?? PRESETS_ENTRADA.find((p) => p.id === tipo)?.rotulo ?? tipo
}
export function nomeLoop(tipo: TipoLoop): string {
  return PRESETS_LOOP.find((p) => p.id === tipo)?.rotulo ?? tipo
}

export function ehAnimacaoDeTexto(tipo: TipoAnimacao): tipo is (typeof ANIMACOES_DE_TEXTO)[number] {
  return (ANIMACOES_DE_TEXTO as readonly string[]).includes(tipo)
}

export function presetEntrada(tipo: TipoAnimacao): PresetEntrada | undefined {
  return PRESETS_ENTRADA.find((p) => p.id === tipo) ?? PRESETS_SAIDA.find((p) => p.id === tipo)
}

/** Animação completa a partir de um preset (mantém o atraso atual). */
export function animacaoDoPreset(tipo: TipoAnimacao, atual?: Animacao): Animacao {
  const p = presetEntrada(tipo)
  return { type: tipo, duration: p?.duracao ?? 600, delay: atual?.delay ?? 0, easing: p?.easing ?? 'easeOut', ...(p?.bezier ? { bezier: p.bezier } : {}) }
}

// ---------- velocidade e curva em linguagem simples ----------

export type Velocidade = 'rapida' | 'normal' | 'lenta'
export const VELOCIDADES: { id: Velocidade; rotulo: string }[] = [
  { id: 'rapida', rotulo: 'Rápida' },
  { id: 'normal', rotulo: 'Normal' },
  { id: 'lenta', rotulo: 'Lenta' },
]
const FATOR_VELOCIDADE: Record<Velocidade, number> = { rapida: 0.6, normal: 1, lenta: 1.6 }

const limitarDuracao = (ms: number) => Math.max(DURACAO_MIN_MS, Math.min(DURACAO_MAX_MS, Math.round(ms / 50) * 50))

/** Duração do preset na velocidade escolhida. */
export function duracaoPorVelocidade(tipo: TipoAnimacao, v: Velocidade): number {
  return limitarDuracao((presetEntrada(tipo)?.duracao ?? 600) * FATOR_VELOCIDADE[v])
}
/** Qual chip de velocidade corresponde à duração atual (null = personalizada). */
export function velocidadeDe(tipo: TipoAnimacao, duracao: number): Velocidade | null {
  return VELOCIDADES.find((v) => duracaoPorVelocidade(tipo, v.id) === duracao)?.id ?? null
}

export type Curva = 'suave' | 'rapida' | 'elastica' | 'linear' | 'personalizada'
export const CURVAS: { id: Curva; rotulo: string; easing?: Animacao['easing']; bezier?: Animacao['bezier'] }[] = [
  { id: 'suave', rotulo: 'Suave', easing: 'easeOut' },
  { id: 'rapida', rotulo: 'Rápida', easing: 'easeOut', bezier: EXPO },
  { id: 'elastica', rotulo: 'Elástica', easing: 'spring' },
  { id: 'linear', rotulo: 'Linear', easing: 'linear' },
  { id: 'personalizada', rotulo: 'Personalizada' },
]
const mesmaCurva = (a?: readonly number[], b?: readonly number[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) < 1e-3)

export function curvaDe(a: Pick<Animacao, 'easing' | 'bezier'>): Curva {
  if (a.bezier) return mesmaCurva(a.bezier, EXPO) ? 'rapida' : 'personalizada'
  return CURVAS.find((c) => !c.bezier && c.easing === a.easing)?.id ?? 'personalizada'
}

/** Campos de curva para um chip nomeado (remove a curva personalizada quando não se aplica). */
export function camposDaCurva(c: Exclude<Curva, 'personalizada'>): Pick<Animacao, 'easing' | 'bezier'> {
  const d = CURVAS.find((x) => x.id === c)!
  return { easing: d.easing ?? 'easeOut', bezier: d.bezier }
}

/** Pontos de controle da curva (para desenhar/editar). */
export const PONTOS_EASING: Record<Animacao['easing'], [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: [0.34, 1.56, 0.64, 1],
}
export function pontosDaCurva(a: Pick<Animacao, 'easing' | 'bezier'>): [number, number, number, number] {
  return a.bezier ?? PONTOS_EASING[a.easing]
}

/** Timing function CSS (respeita a curva personalizada). */
export function curvaCss(a: Pick<Animacao, 'easing' | 'bezier'>): string {
  if (a.bezier) return `cubic-bezier(${a.bezier.map((n) => Math.round(n * 1000) / 1000).join(', ')})`
  return EASING_CSS[a.easing]
}

// ---------- texto dividido ----------

export interface Segmento {
  texto: string
  /** Índice de animação (espaços e quebras não animam e não contam). */
  indice: number
}
export interface Palavra {
  /** Partes animadas da palavra (uma só no modo palavra; uma por letra nos outros). */
  partes: Segmento[]
  /** Espaço/quebra de linha que vem depois (texto puro, sem animação). */
  separador: string
}

/** Divide o texto em palavras (e letras) preservando espaços e quebras de linha. */
export function dividirTexto(texto: string, modo: 'palavra' | 'letra'): { palavras: Palavra[]; total: number } {
  const palavras: Palavra[] = []
  let indice = 0
  const re = /(\S+)(\s*)/g
  const inicio = texto.match(/^\s+/)?.[0] ?? ''
  if (inicio) palavras.push({ partes: [], separador: inicio })
  for (const m of texto.matchAll(re)) {
    const palavra = m[1] ?? ''
    const sep = m[2] ?? ''
    const partes = modo === 'palavra' ? [{ texto: palavra, indice: indice++ }] : Array.from(palavra).map((ch) => ({ texto: ch, indice: indice++ }))
    palavras.push({ partes, separador: sep })
  }
  return { palavras, total: indice }
}

/** Modo de divisão de cada entrada de texto. */
export function modoDivisao(tipo: TipoAnimacao): 'palavra' | 'letra' | null {
  if (tipo === 'words') return 'palavra'
  if (tipo === 'letters' || tipo === 'typewriter') return 'letra'
  return null
}

/**
 * Tempo de cada parte do texto dividido: a última termina exatamente em `duracao`.
 * Máquina de escrever: cada letra aparece "seca" (duração mínima). Palavras/letras: sobreposição suave.
 */
export function tempoSegmentos(tipo: TipoAnimacao, n: number, duracao: number): { duracaoParte: number; passo: number } {
  if (n <= 1) return { duracaoParte: duracao, passo: 0 }
  if (tipo === 'typewriter') {
    const duracaoParte = Math.min(60, duracao / n)
    return { duracaoParte, passo: (duracao - duracaoParte) / (n - 1) }
  }
  const alvo = tipo === 'words' ? 0.55 : 0.4
  const duracaoParte = Math.max(Math.min(duracao * alvo, 700), Math.min(240, duracao))
  return { duracaoParte, passo: Math.max(0, (duracao - duracaoParte) / (n - 1)) }
}

// ---------- tela inteira ----------

export type EstiloTela = 'suave' | 'editorial' | 'dinamico' | 'cinematografico' | 'minimal'
export type OrdemTela = 'topo' | 'esquerda' | 'camadas'
type Papel = 'fundo' | 'titulo' | 'texto' | 'midia' | 'forma'
type Receita = Pick<Animacao, 'type' | 'duration' | 'easing' | 'bezier'>

export interface DefinicaoEstilo {
  id: EstiloTela
  rotulo: string
  descricao: string
  intervalo: number
  papeis: Record<Papel, Receita>
}

export const ESTILOS_TELA: DefinicaoEstilo[] = [
  {
    id: 'suave', rotulo: 'Suave', descricao: 'Sobe e aparece com calma', intervalo: 90,
    papeis: { fundo: { type: 'fadeIn', duration: 600, easing: 'easeOut' }, titulo: { type: 'slideUp', duration: 800, easing: 'easeOut', bezier: EXPO }, texto: { type: 'fadeIn', duration: 700, easing: 'easeOut' }, midia: { type: 'fadeIn', duration: 900, easing: 'easeOut' }, forma: { type: 'fadeIn', duration: 700, easing: 'easeOut' } },
  },
  {
    id: 'editorial', rotulo: 'Editorial', descricao: 'Palavras e máscaras, ritmo de revista', intervalo: 120,
    papeis: { fundo: { type: 'fadeIn', duration: 600, easing: 'easeOut' }, titulo: { type: 'words', duration: 1000, easing: 'easeOut', bezier: EXPO }, texto: { type: 'slideUp', duration: 700, easing: 'easeOut', bezier: EXPO }, midia: { type: 'reveal', duration: 1000, easing: 'easeInOut' }, forma: { type: 'reveal', duration: 800, easing: 'easeInOut' } },
  },
  {
    id: 'dinamico', rotulo: 'Dinâmico', descricao: 'Rápido, com pop e mola', intervalo: 70,
    papeis: { fundo: { type: 'fadeIn', duration: 400, easing: 'easeOut' }, titulo: { type: 'slideUp', duration: 600, easing: 'spring' }, texto: { type: 'slideUp', duration: 500, easing: 'easeOut', bezier: EXPO }, midia: { type: 'pop', duration: 600, easing: 'easeOut' }, forma: { type: 'pop', duration: 550, easing: 'easeOut' } },
  },
  {
    id: 'cinematografico', rotulo: 'Cinematográfico', descricao: 'Lento, com desfoque e zoom', intervalo: 180,
    papeis: { fundo: { type: 'fadeIn', duration: 1200, easing: 'easeOut' }, titulo: { type: 'blurIn', duration: 1400, easing: 'easeOut' }, texto: { type: 'blurIn', duration: 1000, easing: 'easeOut' }, midia: { type: 'zoomOut', duration: 1600, easing: 'easeOut', bezier: EXPO }, forma: { type: 'fadeIn', duration: 1000, easing: 'easeOut' } },
  },
  {
    id: 'minimal', rotulo: 'Minimal', descricao: 'Só fade, discreto', intervalo: 60,
    papeis: { fundo: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, titulo: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, texto: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, midia: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, forma: { type: 'fadeIn', duration: 500, easing: 'easeOut' } },
  },
]

export const ORDENS_TELA: { id: OrdemTela; rotulo: string }[] = [
  { id: 'topo', rotulo: 'De cima para baixo' },
  { id: 'esquerda', rotulo: 'Da esquerda para a direita' },
  { id: 'camadas', rotulo: 'Pela ordem das camadas' },
]

/** Camadas que fazem sentido animar (hotspots são invisíveis). */
export function animavel(c: Camada): boolean {
  return c.type !== 'hotspot'
}

function papelDa(c: Camada, cena: Cena, maiorFonte: number): Papel {
  const area = Math.max(0, Math.min(c.width, cena.size.width)) * Math.max(0, Math.min(c.height, cena.size.height))
  if ((c.type === 'shape' || c.type === 'image' || c.type === 'svg') && area >= cena.size.width * cena.size.height * 0.85) return 'fundo'
  if (c.type === 'text') return c.fontSize >= Math.max(40, maiorFonte * 0.75) ? 'titulo' : 'texto'
  if (c.type === 'shape') return 'forma'
  return 'midia'
}

/** Ordena camadas para uma sequência (linhas de 24 px contam como a mesma altura). */
export function ordenarParaSequencia<T extends Pick<Camada, 'x' | 'y' | 'z'>>(camadas: T[], ordem: OrdemTela): T[] {
  const linha = (v: number) => Math.round(v / 24)
  return [...camadas].sort((a, b) => {
    if (ordem === 'camadas') return a.z - b.z
    if (ordem === 'esquerda') return linha(a.x) - linha(b.x) || a.y - b.y
    return linha(a.y) - linha(b.y) || a.x - b.x
  })
}

/**
 * Aplica uma entrada coordenada a todas as camadas da tela: fundos primeiro (fade), depois o resto em sequência.
 * Camadas do mesmo grupo entram juntas. Hotspots e camadas ocultas são ignorados.
 * Mantém loops e saídas já definidos.
 */
export function animarTelaInteira(cena: Cena, estilo: EstiloTela, ordem: OrdemTela): Camada[] {
  const def = ESTILOS_TELA.find((e) => e.id === estilo) ?? ESTILOS_TELA[0]!
  const alvos = cena.layers.filter((c) => animavel(c) && !c.hidden)
  const maiorFonte = Math.max(0, ...alvos.map((c) => (c.type === 'text' ? c.fontSize : 0)))
  const papeis = new Map(alvos.map((c) => [c.id, papelDa(c, cena, maiorFonte)]))
  const fundos = alvos.filter((c) => papeis.get(c.id) === 'fundo')
  const resto = ordenarParaSequencia(alvos.filter((c) => papeis.get(c.id) !== 'fundo'), ordem)
  const inicio = fundos.length ? 200 : 0
  const atrasos = new Map<string, number>()
  for (const f of fundos) atrasos.set(f.id, 0)
  const passoDoGrupo = new Map<string, number>()
  let passo = 0
  for (const c of resto) {
    let p: number
    if (c.groupId && passoDoGrupo.has(c.groupId)) p = passoDoGrupo.get(c.groupId)!
    else {
      p = passo++
      if (c.groupId) passoDoGrupo.set(c.groupId, p)
    }
    atrasos.set(c.id, Math.min(5000, inicio + p * def.intervalo))
  }
  return cena.layers.map((c) => {
    const atraso = atrasos.get(c.id)
    if (atraso === undefined) return c
    const receita = def.papeis[papeis.get(c.id)!]
    // títulos longos ficam ilegíveis palavra por palavra: usa a entrada do texto comum
    const r = receita.type === 'words' && c.type === 'text' && c.text.length > 80 ? def.papeis.texto : receita
    const type = ehAnimacaoDeTexto(r.type) && c.type !== 'text' ? 'fadeIn' : r.type
    return { ...c, enterAnimation: { type, duration: r.duration, delay: atraso, easing: r.easing, ...(r.bezier ? { bezier: r.bezier } : {}) } } as Camada
  })
}

/** Remove entradas, loops e saídas de todas as camadas. */
export function removerAnimacoes(camadas: Camada[]): Camada[] {
  return camadas.map((c) => {
    if (!c.enterAnimation && !c.loopAnimation && !c.exitAnimation) return c
    const { enterAnimation: _e, loopAnimation: _l, exitAnimation: _s, ...resto } = c
    return resto as Camada
  })
}

/** Atrasos em sequência para uma seleção: base + i × intervalo, na ordem escolhida (grupos juntos). */
export function escalonar(camadas: Camada[], base: number, intervalo: number, ordem: OrdemTela = 'topo'): Map<string, number> {
  const mapa = new Map<string, number>()
  const grupos = new Map<string, number>()
  let i = 0
  for (const c of ordenarParaSequencia(camadas, ordem)) {
    let p: number
    if (c.groupId && grupos.has(c.groupId)) p = grupos.get(c.groupId)!
    else {
      p = i++
      if (c.groupId) grupos.set(c.groupId, p)
    }
    mapa.set(c.id, Math.max(0, Math.min(5000, Math.round(base + p * intervalo))))
  }
  return mapa
}

// ---------- linha do tempo ----------

export function nomeCamada(c: Camada): string {
  if (c.name?.trim()) return c.name.trim()
  if (c.type === 'text') return c.text.trim().slice(0, 40) || 'Texto'
  const nomes: Record<Camada['type'], string> = { text: 'Texto', image: 'Imagem', video: 'Vídeo', shape: 'Forma', hotspot: 'Hotspot', svg: 'Vetor', model3d: 'Modelo 3D', lottie: 'Lottie', embed: 'Incorporado' }
  return nomes[c.type]
}

export interface LinhaTempo {
  id: string
  nome: string
  tipo: TipoAnimacao
  inicio: number
  fim: number
  loop?: TipoLoop
  saida?: TipoAnimacao
  oculta: boolean
}

/** Fim da entrada de uma camada (0 sem animação). */
export function fimDaEntrada(c: Camada): number {
  const a = c.enterAnimation
  return a && a.type !== 'none' ? a.delay + a.duration : 0
}

/** Linhas da linha do tempo (camadas animáveis, de cima para baixo no painel) e escala total arredondada. */
export function linhaDoTempo(cena: Cena): { linhas: LinhaTempo[]; total: number } {
  const linhas: LinhaTempo[] = [...cena.layers]
    .filter(animavel)
    .sort((a, b) => b.z - a.z)
    .map((c) => {
      const a = c.enterAnimation && c.enterAnimation.type !== 'none' ? c.enterAnimation : undefined
      return { id: c.id, nome: nomeCamada(c), tipo: a?.type ?? 'none', inicio: a?.delay ?? 0, fim: a ? a.delay + a.duration : 0, loop: c.loopAnimation?.type, saida: c.exitAnimation?.type, oculta: c.hidden }
    })
  const maior = Math.max(0, ...linhas.map((l) => l.fim))
  return { linhas, total: Math.max(2000, Math.ceil((maior + 400) / 500) * 500) }
}

/** Duração para tocar a prévia da tela inteira (entradas + 2 ciclos de loop, no máximo 12 s). */
export function duracaoPrevia(camadas: Camada[], semAtraso = false): number {
  let fim = 0
  for (const c of camadas) {
    const a = c.enterAnimation
    const entrada = a && a.type !== 'none' ? (semAtraso ? 0 : a.delay) + a.duration : 0
    const loop = c.loopAnimation ? Math.min(c.loopAnimation.duration * 2, 6000) : 0
    fim = Math.max(fim, entrada + loop)
  }
  return Math.min(12_000, fim)
}

/** Tempo que as saídas da tela levam (0 = nenhuma; o visualizador segue direto para a transição). */
export function tempoSaida(cena: Cena | undefined): number {
  if (!cena) return 0
  let t = 0
  for (const c of cena.layers) {
    const s = c.exitAnimation
    if (s && s.type !== 'none' && !c.hidden) t = Math.max(t, s.delay + s.duration)
  }
  return Math.min(4000, t)
}
