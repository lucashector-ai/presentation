/**
 * Catálogo de animações da aba Animação + lógica pura de "Animar tela inteira", escalonamento e linha do tempo.
 * Sem React/DOM: usado pelo inspetor, pelo renderizador e pelos testes.
 *
 * Convenção de tempo: `duration` é o tempo TOTAL da entrada. Nas entradas de texto divididas
 * (máquina de escrever, palavra/letra por letra) ele é repartido entre as partes (ver `tempoSegmentos`),
 * então a barra da linha do tempo (delay → delay + duration) é sempre fiel ao que o público vê.
 */
import { ANIMACOES_DE_TEXTO, DURACAO_MAX_MS, DURACAO_MIN_MS, type Animacao, type Camada, type Cena, type Interacao, type Loop } from './schema'
import { EASING_CSS } from './motor'
import { definicao, type Categoria } from './parametros'
import { analisarNumero } from './texto-animado'

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
  /** Variação de um tipo com ajustes prontos (ex.: "Fade + desfoque" = Desfocar com 12 px). */
  chave?: string
  ajustes?: Partial<Animacao>
  /** Seção da galeria (padrão: a categoria do tipo em lib/scene/parametros.ts). */
  categoria?: Categoria
}

/** Chave única do cartão na galeria. */
export const chavePreset = (p: PresetEntrada) => p.chave ?? p.id

export const PRESETS_ENTRADA: PresetEntrada[] = [
  // básicas
  { id: 'fadeIn', rotulo: 'Fade', duracao: 600, easing: 'easeOut' },
  { id: 'slideUp', chave: 'fade-mov', rotulo: 'Fade + movimento', duracao: 700, easing: 'easeOut', bezier: EXPO, ajustes: { distance: 20 }, categoria: 'basicas' },
  { id: 'blurIn', rotulo: 'Desfocar', duracao: 900, easing: 'easeOut' },
  { id: 'blurIn', chave: 'fade-blur', rotulo: 'Fade + desfoque', duracao: 700, easing: 'easeOut', bezier: EXPO, ajustes: { blur: 12 } },
  { id: 'scaleIn', rotulo: 'Escala', duracao: 700, easing: 'spring' },
  { id: 'expand', rotulo: 'Expandir do centro', duracao: 700, easing: 'easeOut', bezier: EXPO },
  // movimento
  { id: 'slideUp', rotulo: 'Subir', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideDown', rotulo: 'Descer', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideRight', rotulo: 'Da esquerda', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideLeft', rotulo: 'Da direita', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'slideBlur', rotulo: 'Deslizar com rastro', duracao: 800, easing: 'easeOut', bezier: EXPO },
  { id: 'rotateIn', rotulo: 'Girar', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'spinIn', rotulo: 'Rotação suave', duracao: 1000, easing: 'easeOut', bezier: EXPO },
  // revelar
  { id: 'reveal', rotulo: 'Cortina', duracao: 800, easing: 'easeInOut' },
  { id: 'mask', rotulo: 'Máscara', duracao: 800, easing: 'easeOut', bezier: EXPO },
  { id: 'iris', rotulo: 'Íris', duracao: 900, easing: 'easeInOut' },
  { id: 'unfold', rotulo: 'Desdobrar', duracao: 700, easing: 'easeOut', bezier: EXPO },
  { id: 'expand', chave: 'barra', rotulo: 'Barra de progresso', duracao: 1200, easing: 'easeOut', bezier: EXPO, ajustes: { origin: 'left' }, categoria: 'revelar' },
  { id: 'draw', rotulo: 'Desenhar contorno', duracao: 1200, easing: 'easeInOut' },
  // 3D
  { id: 'flip', rotulo: 'Virar 3D', duracao: 900, easing: 'easeOut', bezier: EXPO },
  { id: 'flip', chave: 'dobrar', rotulo: 'Dobrar 3D', duracao: 1000, easing: 'easeOut', bezier: EXPO, ajustes: { origin: 'top', rotate: 90 } },
  { id: 'zoomIn', rotulo: 'Zoom profundo', duracao: 1000, easing: 'easeOut', bezier: EXPO },
  { id: 'zoomOut', rotulo: 'Zoom out', duracao: 900, easing: 'easeOut', bezier: EXPO },
  // ênfase
  { id: 'pop', rotulo: 'Pop', duracao: 600, easing: 'easeOut' },
  { id: 'elastic', rotulo: 'Elástico', duracao: 900, easing: 'easeOut' },
  { id: 'bounce', rotulo: 'Quicar', duracao: 1000, easing: 'linear' },
  // texto
  { id: 'lines', rotulo: 'Linha por linha', duracao: 1000, easing: 'easeOut', bezier: EXPO, soTexto: true },
  { id: 'words', rotulo: 'Palavras com desfoque', duracao: 1000, easing: 'easeOut', bezier: EXPO, soTexto: true },
  { id: 'letters', rotulo: 'Letra por letra', duracao: 1000, easing: 'easeOut', bezier: EXPO, soTexto: true },
  { id: 'cascade', rotulo: 'Cascata elástica', duracao: 1200, easing: 'spring', soTexto: true },
  { id: 'typewriter', rotulo: 'Máquina de escrever', duracao: 1200, easing: 'linear', soTexto: true },
  { id: 'scramble', rotulo: 'Decodificar', duracao: 1400, easing: 'linear', soTexto: true },
  { id: 'highlight', rotulo: 'Destaque', duracao: 900, easing: 'easeInOut', soTexto: true },
  { id: 'underline', rotulo: 'Sublinhado', duracao: 700, easing: 'easeInOut', soTexto: true },
  { id: 'counter', rotulo: 'Contador', duracao: 1600, easing: 'easeOut', bezier: EXPO, soTexto: true },
]

export interface PresetLoop {
  id: TipoLoop
  rotulo: string
  duracao: number
}
export const PRESETS_LOOP: PresetLoop[] = [
  { id: 'float', rotulo: 'Flutuar', duracao: 3200 },
  { id: 'drift', rotulo: 'Deriva', duracao: 7000 },
  { id: 'pulse', rotulo: 'Pulsar', duracao: 1800 },
  { id: 'glow', rotulo: 'Brilho', duracao: 2400 },
  { id: 'wiggle', rotulo: 'Balançar', duracao: 1400 },
  { id: 'shake', rotulo: 'Tremer', duracao: 1600 },
  { id: 'spin', rotulo: 'Girar contínuo', duracao: 8000 },
]

export const PRESETS_SAIDA: PresetEntrada[] = [
  { id: 'fadeOut', rotulo: 'Fade', duracao: 400, easing: 'easeIn' },
  { id: 'blurOut', chave: 'dissolver', rotulo: 'Dissolver', duracao: 500, easing: 'easeIn', ajustes: { blur: 6 } },
  { id: 'blurOut', rotulo: 'Desfocar', duracao: 500, easing: 'easeIn' },
  { id: 'scaleOut', rotulo: 'Encolher', duracao: 400, easing: 'easeIn' },
  { id: 'scaleOut', chave: 'sumir', rotulo: 'Sumir encolhendo', duracao: 450, easing: 'easeIn', ajustes: { scale: 0.3 } },
  { id: 'slideOutUp', rotulo: 'Subir', duracao: 450, easing: 'easeIn' },
  { id: 'slideOutDown', rotulo: 'Descer', duracao: 450, easing: 'easeIn' },
  { id: 'slideOutLeft', rotulo: 'Para a esquerda', duracao: 450, easing: 'easeIn' },
  { id: 'slideOutRight', rotulo: 'Para a direita', duracao: 450, easing: 'easeIn' },
  { id: 'spinOut', rotulo: 'Girar', duracao: 500, easing: 'easeIn' },
  { id: 'wipeOut', rotulo: 'Cortina', duracao: 600, easing: 'easeInOut' },
  { id: 'maskOut', rotulo: 'Máscara', duracao: 600, easing: 'easeIn' },
  { id: 'irisOut', rotulo: 'Íris', duracao: 600, easing: 'easeInOut' },
  { id: 'collapse', rotulo: 'Recolher', duracao: 450, easing: 'easeIn' },
  { id: 'flipOut', rotulo: 'Virar 3D', duracao: 600, easing: 'easeIn' },
  { id: 'zoomAway', rotulo: 'Afastar', duracao: 600, easing: 'easeIn' },
]

/** Categoria do preset na galeria. */
export function categoriaDoPreset(p: PresetEntrada): Categoria {
  return p.categoria ?? definicao(p.id).categoria
}

const NOMES: Partial<Record<TipoAnimacao, string>> = {
  none: 'Nenhuma', fadeOut: 'Sumir', scaleOut: 'Encolher', slideOutUp: 'Sair subindo', slideOutDown: 'Sair descendo', slideOutLeft: 'Sair pela esquerda', slideOutRight: 'Sair pela direita', blurOut: 'Desfocar',
  spinOut: 'Sair girando', wipeOut: 'Cortina', maskOut: 'Máscara', irisOut: 'Íris', collapse: 'Recolher', flipOut: 'Virar 3D', zoomAway: 'Afastar',
}
/** Nome curto em português para resumos ("Pop · 600ms"). */
export function nomeAnimacao(tipo: TipoAnimacao): string {
  return NOMES[tipo] ?? PRESETS_ENTRADA.find((p) => p.id === tipo && !p.chave)?.rotulo ?? tipo
}
export function nomeLoop(tipo: TipoLoop): string {
  return PRESETS_LOOP.find((p) => p.id === tipo)?.rotulo ?? tipo
}

export function ehAnimacaoDeTexto(tipo: TipoAnimacao): tipo is (typeof ANIMACOES_DE_TEXTO)[number] {
  return (ANIMACOES_DE_TEXTO as readonly string[]).includes(tipo)
}

export function presetEntrada(tipo: TipoAnimacao): PresetEntrada | undefined {
  return PRESETS_ENTRADA.find((p) => p.id === tipo && !p.chave) ?? PRESETS_SAIDA.find((p) => p.id === tipo && !p.chave)
}

/** Animação completa a partir de um preset (mantém o atraso e o "quando" atuais; ajustes do preset ou nenhum). */
export function animacaoDoPreset(tipo: TipoAnimacao, atual?: Animacao, preset?: PresetEntrada): Animacao {
  const p = preset ?? presetEntrada(tipo)
  const gatilho = atual?.trigger && atual.trigger !== 'enter' ? { trigger: atual.trigger, ...(atual.after ? { after: atual.after } : {}), ...(atual.on ? { on: atual.on } : {}), ...(atual.scrollRange ? { scrollRange: atual.scrollRange } : {}) } : {}
  // repetir vale para qualquer efeito: trocar de preset mantém
  const repetir = atual?.repeat && atual.repeat > 1 ? { repeat: atual.repeat } : {}
  return { type: tipo, duration: p?.duracao ?? 600, delay: atual?.delay ?? 0, easing: p?.easing ?? 'easeOut', ...(p?.bezier ? { bezier: p.bezier } : {}), ...(p?.ajustes ?? {}), ...gatilho, ...repetir }
}

/** O preset (ou variação) corresponde à animação atual? Variações exigem os próprios ajustes; o preset base, nenhum ajuste dessas chaves. */
export function presetSelecionado(p: PresetEntrada, a: Animacao | undefined, lista: PresetEntrada[]): boolean {
  if (!a || a.type !== p.id) return false
  const variacoes = lista.filter((x) => x.id === p.id && x.ajustes)
  const casa = (x: PresetEntrada) => Object.entries(x.ajustes ?? {}).every(([k, v]) => (a as Record<string, unknown>)[k] === v)
  if (p.ajustes) return casa(p)
  return !variacoes.some(casa)
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

export type Curva = 'suave' | 'rapida' | 'equilibrada' | 'elastica' | 'quique' | 'linear' | 'personalizada'
/** Ultrapassa um pouco e assenta (o "bounce suave" de uma curva só). */
export const QUIQUE: [number, number, number, number] = [0.34, 1.35, 0.6, 1]
export const CURVAS: { id: Curva; rotulo: string; easing?: Animacao['easing']; bezier?: Animacao['bezier'] }[] = [
  { id: 'suave', rotulo: 'Suave', easing: 'easeOut' },
  { id: 'rapida', rotulo: 'Rápida', easing: 'easeOut', bezier: EXPO },
  { id: 'equilibrada', rotulo: 'Equilibrada', easing: 'easeInOut' },
  { id: 'elastica', rotulo: 'Elástica', easing: 'spring' },
  { id: 'quique', rotulo: 'Quique suave', easing: 'easeOut', bezier: QUIQUE },
  { id: 'linear', rotulo: 'Linear', easing: 'linear' },
  { id: 'personalizada', rotulo: 'Personalizada' },
]
const mesmaCurva = (a?: readonly number[], b?: readonly number[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? NaN)) < 1e-3)

export function curvaDe(a: Pick<Animacao, 'easing' | 'bezier'>): Curva {
  if (a.bezier) return mesmaCurva(a.bezier, EXPO) ? 'rapida' : mesmaCurva(a.bezier, QUIQUE) ? 'quique' : 'personalizada'
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

/** Letras como o leitor as vê (grafemas: acentos combinados, emoji com modificadores ficam inteiros). */
export function grafemas(palavra: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: 'grapheme' }) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter
  if (Seg) return Array.from(new Seg('pt-BR', { granularity: 'grapheme' }).segment(palavra), (s) => s.segment)
  return Array.from(palavra)
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
    const partes = modo === 'palavra' ? [{ texto: palavra, indice: indice++ }] : grafemas(palavra).map((ch) => ({ texto: ch, indice: indice++ }))
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
 * No máximo quantas partes de um texto se movem ao mesmo tempo (intervalo automático). Cada parte em movimento
 * é uma camada composta com o estilo recalculado a cada quadro, e o compositor desenha cada uma: com 60 palavras
 * sobrepostas, um parágrafo recalculava 120 elementos e compunha 60 camadas por quadro — e numa tela há vários
 * blocos de texto ao mesmo tempo. Acima do limite o passo entre partes cresce e cada parte anda um pouco mais
 * rápido (palavras de ~0,5 s a cada 40 ms em vez de 0,77 s a cada 30 ms: a cadência fica mais nítida); a duração
 * total (o que o público percebe e a linha do tempo mostra) não muda.
 */
export const PARTES_SIMULTANEAS_MAX = 12
/** Duração mínima de cada parte quando o limite de partes simultâneas encurta o movimento. */
const PARTE_MIN_MS = 240

/**
 * Tempo de cada parte do texto dividido: a última termina exatamente em `duracao` (n = número de passos).
 * Máquina de escrever: cada letra aparece "seca" (duração mínima). Palavras/letras/linhas: sobreposição suave,
 * com no máximo PARTES_SIMULTANEAS_MAX partes em movimento ao mesmo tempo.
 * Com `intervalo` (ajuste "Intervalo entre partes"), o passo é fixo e cada parte dura o que sobra (mín. 240 ms).
 */
export function tempoSegmentos(tipo: TipoAnimacao, n: number, duracao: number, intervalo?: number): { duracaoParte: number; passo: number } {
  if (n <= 1) return { duracaoParte: duracao, passo: 0 }
  if (intervalo !== undefined) {
    const passo = intervalo
    return { duracaoParte: tipo === 'typewriter' ? Math.min(60, Math.max(16, passo)) : Math.max(Math.min(240, duracao), duracao - passo * (n - 1)), passo }
  }
  if (tipo === 'typewriter') {
    const duracaoParte = Math.min(60, duracao / n)
    return { duracaoParte, passo: (duracao - duracaoParte) / (n - 1) }
  }
  const alvo = tipo === 'words' || tipo === 'lines' ? 0.55 : tipo === 'scramble' ? 0.5 : 0.4
  let duracaoParte = Math.max(Math.min(duracao * alvo, 700), Math.min(240, duracao))
  let passo = Math.max(0, (duracao - duracaoParte) / (n - 1))
  // decodificar: a parte só marca o início (o sorteio corre em JS), não há movimento a limitar
  if (tipo !== 'scramble' && passo > 0 && duracaoParte / passo > PARTES_SIMULTANEAS_MAX) {
    // d + (n − 1)·p = duração e d = LIMITE·p → p = duração / (n − 1 + LIMITE); sem descer de PARTE_MIN_MS
    const p = duracao / (n - 1 + PARTES_SIMULTANEAS_MAX)
    duracaoParte = Math.min(duracaoParte, Math.max(PARTES_SIMULTANEAS_MAX * p, Math.min(PARTE_MIN_MS, duracao)))
    passo = Math.max(0, (duracao - duracaoParte) / (n - 1))
  }
  return { duracaoParte, passo }
}

/** Tempo total de uma entrada (com as repetições). */
export function duracaoTotal(a: Pick<Animacao, 'duration' | 'repeat'>): number {
  return a.duration * Math.max(1, a.repeat ?? 1)
}

// ---------- quando (gatilhos) ----------

/**
 * Atraso efetivo de cada entrada: "depois de [camada]" soma o fim da entrada daquela camada (em cadeia,
 * com proteção contra ciclos). Entradas por clique/hover não entram na conta (tocam quando o público age).
 */
export function atrasosEfetivos(camadas: readonly Camada[]): Map<string, number> {
  const porId = new Map(camadas.map((c) => [c.id, c]))
  const memo = new Map<string, number>()
  const atraso = (c: Camada, visitando: Set<string>): number => {
    const salvo = memo.get(c.id)
    if (salvo !== undefined) return salvo
    const a = c.enterAnimation
    let v = a?.delay ?? 0
    if (a?.trigger === 'after' && a.after && !visitando.has(c.id)) {
      const ant = porId.get(a.after)
      const ea = ant?.enterAnimation
      if (ant && ea && ea.type !== 'none' && ea.trigger !== 'click' && ea.trigger !== 'hover') v += atraso(ant, new Set([...visitando, c.id])) + duracaoTotal(ea)
    }
    v = Math.min(20_000, v)
    memo.set(c.id, v)
    return v
  }
  for (const c of camadas) atraso(c, new Set())
  return memo
}

/** Entrada que espera o público (clique/hover): fica no 1º quadro até a interação. */
export function esperaGatilho(a: Animacao | undefined): boolean {
  return !!a && a.type !== 'none' && (a.trigger === 'click' || a.trigger === 'hover')
}

/**
 * Interações "virtuais" criadas pelos gatilhos de entrada: a camada que dispara (on, ou a própria) ganha um
 * "Tocar animação" da camada alvo. Assim o clique/hover usa o mesmo motor de interações do visualizador.
 */
export function interacoesDosGatilhos(camadas: readonly Camada[]): Map<string, { click: Interacao[]; hover: Interacao[] }> {
  const mapa = new Map<string, { click: Interacao[]; hover: Interacao[] }>()
  for (const c of camadas) {
    const a = c.enterAnimation
    if (!a || !esperaGatilho(a)) continue
    const fonte = a.on && camadas.some((x) => x.id === a.on) ? a.on : c.id
    const { trigger: _t, on: _o, after: _a, ...animacao } = a
    const it: Interacao = { trigger: a.trigger === 'hover' ? 'hover' : 'click', conditions: { once: true, threshold: 0.5 }, do: { action: 'animate', targetLayerId: c.id, animation: animacao } }
    const e = mapa.get(fonte) ?? { click: [], hover: [] }
    e[a.trigger === 'hover' ? 'hover' : 'click'].push(it)
    mapa.set(fonte, e)
  }
  return mapa
}

// ---------- tela inteira ----------

export type EstiloTela = 'suave' | 'editorial' | 'dinamico' | 'cinematografico' | 'minimal'
/**
 * Ordem da sequência. "leitura" (padrão): fundos na hora, depois o título, o texto de apoio na ordem de
 * leitura e por último imagens e formas — cartões (formas com texto por cima) entram junto com o seu texto.
 */
export type OrdemTela = 'leitura' | 'topo' | 'esquerda' | 'camadas'
type Papel = 'fundo' | 'titulo' | 'texto' | 'midia' | 'forma' | 'linha'
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
    papeis: { fundo: { type: 'fadeIn', duration: 600, easing: 'easeOut' }, titulo: { type: 'slideUp', duration: 800, easing: 'easeOut', bezier: EXPO }, texto: { type: 'fadeIn', duration: 700, easing: 'easeOut' }, midia: { type: 'fadeIn', duration: 900, easing: 'easeOut' }, forma: { type: 'fadeIn', duration: 700, easing: 'easeOut' }, linha: { type: 'fadeIn', duration: 700, easing: 'easeOut' } },
  },
  {
    id: 'editorial', rotulo: 'Editorial', descricao: 'Palavras e máscaras, ritmo de revista', intervalo: 120,
    papeis: { fundo: { type: 'fadeIn', duration: 600, easing: 'easeOut' }, titulo: { type: 'words', duration: 1000, easing: 'easeOut', bezier: EXPO }, texto: { type: 'lines', duration: 900, easing: 'easeOut', bezier: EXPO }, midia: { type: 'reveal', duration: 1000, easing: 'easeInOut' }, forma: { type: 'reveal', duration: 800, easing: 'easeInOut' }, linha: { type: 'reveal', duration: 800, easing: 'easeInOut' } },
  },
  {
    id: 'dinamico', rotulo: 'Dinâmico', descricao: 'Rápido, com pop e mola', intervalo: 70,
    papeis: { fundo: { type: 'fadeIn', duration: 400, easing: 'easeOut' }, titulo: { type: 'slideUp', duration: 600, easing: 'spring' }, texto: { type: 'slideUp', duration: 500, easing: 'easeOut', bezier: EXPO }, midia: { type: 'pop', duration: 600, easing: 'easeOut' }, forma: { type: 'pop', duration: 550, easing: 'easeOut' }, linha: { type: 'reveal', duration: 500, easing: 'easeOut', bezier: EXPO } },
  },
  {
    id: 'cinematografico', rotulo: 'Cinematográfico', descricao: 'Lento, com desfoque e zoom', intervalo: 180,
    papeis: { fundo: { type: 'fadeIn', duration: 1200, easing: 'easeOut' }, titulo: { type: 'blurIn', duration: 1400, easing: 'easeOut' }, texto: { type: 'blurIn', duration: 1000, easing: 'easeOut' }, midia: { type: 'zoomOut', duration: 1600, easing: 'easeOut', bezier: EXPO }, forma: { type: 'fadeIn', duration: 1000, easing: 'easeOut' }, linha: { type: 'fadeIn', duration: 1000, easing: 'easeOut' } },
  },
  {
    id: 'minimal', rotulo: 'Minimal', descricao: 'Só fade, discreto', intervalo: 60,
    papeis: { fundo: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, titulo: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, texto: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, midia: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, forma: { type: 'fadeIn', duration: 500, easing: 'easeOut' }, linha: { type: 'fadeIn', duration: 500, easing: 'easeOut' } },
  },
]

export const ORDENS_TELA: { id: OrdemTela; rotulo: string }[] = [
  { id: 'leitura', rotulo: 'Título, texto e imagens' },
  { id: 'topo', rotulo: 'De cima para baixo' },
  { id: 'esquerda', rotulo: 'Da esquerda para a direita' },
  { id: 'camadas', rotulo: 'Pela ordem das camadas' },
]

/** Camadas que fazem sentido animar (hotspots são invisíveis). */
export function animavel(c: Camada): boolean {
  return c.type !== 'hotspot'
}

const ehLinha = (c: Pick<Camada, 'width' | 'height'>) => Math.min(c.width, c.height) <= 8

function papelDa(c: Camada, cena: Cena, maiorFonte: number): Papel {
  const area = Math.max(0, Math.min(c.width, cena.size.width)) * Math.max(0, Math.min(c.height, cena.size.height))
  if ((c.type === 'shape' || c.type === 'image' || c.type === 'svg' || c.type === 'frame') && area >= cena.size.width * cena.size.height * 0.85) return 'fundo'
  if (c.type === 'text') return c.fontSize >= Math.max(40, maiorFonte * 0.75) ? 'titulo' : 'texto'
  if (c.type === 'shape') return ehLinha(c) ? 'linha' : 'forma'
  return 'midia'
}

/** Ordena camadas para uma sequência (linhas de 24 px contam como a mesma altura). "leitura" sem contexto = de cima para baixo. */
export function ordenarParaSequencia<T extends Pick<Camada, 'x' | 'y' | 'z'>>(camadas: T[], ordem: OrdemTela): T[] {
  const linha = (v: number) => Math.round(v / 24)
  return [...camadas].sort((a, b) => {
    if (ordem === 'camadas') return a.z - b.z
    if (ordem === 'esquerda') return linha(a.x) - linha(b.x) || a.y - b.y
    return linha(a.y) - linha(b.y) || a.x - b.x
  })
}

/** Grupo de leitura: 0 = títulos (textos de destaque), 1 = texto de apoio e linhas, 2 = imagens e formas. */
function grupoLeitura(c: Camada, maiorFonte: number): 0 | 1 | 2 {
  if (c.type === 'text') return c.fontSize >= Math.max(40, maiorFonte * 0.45) ? 0 : 1
  if (c.type === 'shape' && ehLinha(c)) return 1
  return 2
}

const contem = (fora: Camada, dentro: Camada) => {
  const l = Math.max(fora.x, dentro.x)
  const t = Math.max(fora.y, dentro.y)
  const r = Math.min(fora.x + fora.width, dentro.x + dentro.width)
  const b = Math.min(fora.y + fora.height, dentro.y + dentro.height)
  const inter = Math.max(0, r - l) * Math.max(0, b - t)
  return inter >= dentro.width * dentro.height * 0.8
}

/**
 * Ordem de leitura: títulos → texto/linhas → imagens/formas (cada grupo de cima para baixo).
 * Um cartão (forma/imagem por baixo de um texto que ele contém) entra junto com o primeiro texto dele,
 * para o texto nunca aparecer "no ar" antes do fundo do cartão.
 */
function sequenciaDeLeitura(camadas: Camada[]): Camada[][] {
  const maiorFonte = Math.max(0, ...camadas.map((c) => (c.type === 'text' ? c.fontSize : 0)))
  const passos: Camada[][] = []
  const fluxo = ([0, 1, 2] as const).flatMap((g) => ordenarParaSequencia(camadas.filter((c) => grupoLeitura(c, maiorFonte) === g), 'topo'))
  const cartoes = new Map<string, Camada>()
  for (const c of camadas) {
    if (c.type === 'text' || grupoLeitura(c, maiorFonte) !== 2) continue
    const primeiro = fluxo.find((t) => t.type === 'text' && t.z > c.z && contem(c, t))
    if (primeiro) cartoes.set(primeiro.id, c)
  }
  const usados = new Set([...cartoes.values()].map((c) => c.id))
  for (const c of fluxo) {
    if (usados.has(c.id)) continue
    const cartao = cartoes.get(c.id)
    passos.push(cartao ? [cartao, c] : [c])
  }
  return passos
}

/**
 * Aplica uma entrada coordenada a todas as camadas da tela: fundos primeiro (fade), depois o resto em sequência.
 * Camadas do mesmo grupo entram juntas. Hotspots e camadas ocultas são ignorados.
 * Mantém loops e saídas já definidos.
 */
export function animarTelaInteira(cena: Cena, estilo: EstiloTela, ordem: OrdemTela = 'leitura'): Camada[] {
  const def = ESTILOS_TELA.find((e) => e.id === estilo) ?? ESTILOS_TELA[0]!
  const alvos = cena.layers.filter((c) => animavel(c) && !c.hidden)
  const maiorFonte = Math.max(0, ...alvos.map((c) => (c.type === 'text' ? c.fontSize : 0)))
  const papeis = new Map(alvos.map((c) => [c.id, papelDa(c, cena, maiorFonte)]))
  const fundos = alvos.filter((c) => papeis.get(c.id) === 'fundo')
  const resto = alvos.filter((c) => papeis.get(c.id) !== 'fundo')
  const passos = ordem === 'leitura' ? sequenciaDeLeitura(resto) : ordenarParaSequencia(resto, ordem).map((c) => [c])
  const inicio = fundos.length ? 200 : 0
  const atrasos = new Map<string, number>()
  for (const f of fundos) atrasos.set(f.id, 0)
  const passoDoGrupo = new Map<string, number>()
  let passo = 0
  for (const camadasDoPasso of passos) {
    let p: number | undefined
    for (const c of camadasDoPasso) if (c.groupId && passoDoGrupo.has(c.groupId)) p = passoDoGrupo.get(c.groupId)
    if (p === undefined) p = passo++
    for (const c of camadasDoPasso) {
      if (atrasos.has(c.id)) continue
      if (c.groupId && !passoDoGrupo.has(c.groupId)) passoDoGrupo.set(c.groupId, p)
      atrasos.set(c.id, Math.min(5000, inicio + p * def.intervalo))
    }
  }
  return cena.layers.map((c) => {
    const atraso = atrasos.get(c.id)
    if (atraso === undefined) return c
    const receita = def.papeis[papeis.get(c.id)!]
    // títulos longos ficam ilegíveis palavra por palavra: usa a entrada do texto comum
    let r = receita.type === 'words' && c.type === 'text' && c.text.length > 80 ? def.papeis.texto : receita
    // número em destaque ("38%", "R$ 2,4 mi") conta até o valor (menos no Minimal, que é só fade)
    if (c.type === 'text' && estilo !== 'minimal' && c.fontSize >= 48 && ehNumeroDestaque(c.text)) r = { type: 'counter', duration: estilo === 'cinematografico' ? 2000 : 1400, easing: 'easeOut', bezier: EXPO }
    // texto de apoio de uma linha só não precisa de máscara por linha: sobe junto
    if (r.type === 'lines' && c.type === 'text' && !c.text.includes('\n') && c.text.length < 40) r = { type: 'mask', duration: r.duration, easing: r.easing, bezier: r.bezier }
    const type = ehAnimacaoDeTexto(r.type) && c.type !== 'text' ? 'fadeIn' : r.type
    return { ...c, enterAnimation: { type, duration: r.duration, delay: atraso, easing: r.easing, ...(r.bezier ? { bezier: r.bezier } : {}) } } as Camada
  })
}

/** Texto curto que é basicamente um número (candidato a contador). */
export function ehNumeroDestaque(texto: string): boolean {
  const t = texto.trim()
  if (!t || t.length > 14 || t.includes('\n')) return false
  const n = analisarNumero(t)
  return !!n && n.prefixo.trim().length <= 3 && n.sufixo.trim().length <= 6 && /\d/.test(t.slice(0, 4))
}

/** Remove entradas, loops e saídas de todas as camadas. */
export function removerAnimacoes(camadas: Camada[]): Camada[] {
  return camadas.map((c) => {
    if (!c.enterAnimation && !c.loopAnimation && !c.exitAnimation) return c
    const { enterAnimation: _e, loopAnimation: _l, exitAnimation: _s, ...resto } = c
    return resto as Camada
  })
}

/** Atrasos em sequência para uma seleção: base + i × intervalo, na ordem escolhida (grupos e cartões juntos). */
export function escalonar(camadas: Camada[], base: number, intervalo: number, ordem: OrdemTela = 'leitura'): Map<string, number> {
  const mapa = new Map<string, number>()
  const grupos = new Map<string, number>()
  const passos = ordem === 'leitura' ? sequenciaDeLeitura(camadas) : ordenarParaSequencia(camadas, ordem).map((c) => [c])
  let i = 0
  for (const doPasso of passos) {
    let p: number | undefined
    for (const c of doPasso) if (c.groupId && grupos.has(c.groupId)) p = grupos.get(c.groupId)
    if (p === undefined) p = i++
    for (const c of doPasso) {
      if (c.groupId && !grupos.has(c.groupId)) grupos.set(c.groupId, p)
      mapa.set(c.id, Math.max(0, Math.min(5000, Math.round(base + p * intervalo))))
    }
  }
  return mapa
}

// ---------- linha do tempo ----------

export function nomeCamada(c: Camada): string {
  if (c.name?.trim()) return c.name.trim()
  if (c.type === 'text') return c.text.trim().slice(0, 40) || 'Texto'
  const nomes: Record<Camada['type'], string> = { text: 'Texto', image: 'Imagem', video: 'Vídeo', shape: 'Forma', hotspot: 'Hotspot', svg: 'Vetor', model3d: 'Modelo 3D', lottie: 'Lottie', embed: 'Incorporado', frame: 'Frame' }
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
  /** Quando a entrada toca, se não for "ao entrar na tela". */
  gatilho?: 'after' | 'click' | 'hover' | 'scroll'
}

/** Fim da entrada de uma camada (0 sem animação). */
export function fimDaEntrada(c: Camada): number {
  const a = c.enterAnimation
  return a && a.type !== 'none' ? a.delay + duracaoTotal(a) : 0
}

/** Linhas da linha do tempo (camadas animáveis, de cima para baixo no painel) e escala total arredondada. */
export function linhaDoTempo(cena: Cena): { linhas: LinhaTempo[]; total: number } {
  const efetivos = atrasosEfetivos(cena.layers)
  const linhas: LinhaTempo[] = [...cena.layers]
    .filter(animavel)
    .sort((a, b) => b.z - a.z)
    .map((c) => {
      const a = c.enterAnimation && c.enterAnimation.type !== 'none' ? c.enterAnimation : undefined
      const inicio = a ? (efetivos.get(c.id) ?? a.delay) : 0
      return { id: c.id, nome: nomeCamada(c), tipo: a?.type ?? 'none', inicio, fim: a ? inicio + duracaoTotal(a) : 0, loop: c.loopAnimation?.type, saida: c.exitAnimation?.type, oculta: c.hidden, gatilho: a?.trigger && a.trigger !== 'enter' ? a.trigger : undefined }
    })
  const maior = Math.max(0, ...linhas.map((l) => l.fim))
  return { linhas, total: Math.max(2000, Math.ceil((maior + 400) / 500) * 500) }
}

/** Quando a última entrada da tela termina (ms; sem loops nem entradas por clique/hover). */
export function fimDasEntradas(camadas: Camada[]): number {
  const efetivos = atrasosEfetivos(camadas)
  let fim = 0
  for (const c of camadas) {
    const a = c.enterAnimation
    if (a && a.type !== 'none' && !esperaGatilho(a)) fim = Math.max(fim, (efetivos.get(c.id) ?? a.delay) + duracaoTotal(a))
  }
  return fim
}

/** Duração para tocar a prévia da tela inteira (entradas + 2 ciclos de loop, no máximo 12 s). */
export function duracaoPrevia(camadas: Camada[], semAtraso = false): number {
  let fim = 0
  const efetivos = atrasosEfetivos(camadas)
  for (const c of camadas) {
    const a = c.enterAnimation
    const entrada = a && a.type !== 'none' ? (semAtraso ? 0 : (efetivos.get(c.id) ?? a.delay)) + duracaoTotal(a) : 0
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
