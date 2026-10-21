/**
 * Qual modelo do Claude atende cada etapa da IA do Mostra, com que esforço e limite, e quanto cada um custa.
 * Fonte dos preços: tabela de modelos da Anthropic (USD por milhão de tokens, out/2026). Escrita no cache
 * (TTL de 5 min) custa 1,25× a entrada; leitura, o preço de cache de cada modelo.
 * Ao trocar um modelo ou preço, revise `docs/economia-ia.md` e os custos em créditos (`lib/planos.ts`):
 * o teste `lib/ia/economia.test.ts` falha se algum preço em créditos deixar de cobrir o custo.
 */

export type EtapaIA = 'roteiro' | 'design' | 'tela' | 'texto'
export type Esforco = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface ModeloIA {
  id: string
  nome: string
  /** USD por milhão de tokens de entrada / saída / leitura de cache / escrita de cache (5 min). */
  precoEntrada: number
  precoSaida: number
  precoCacheLeitura: number
  precoCacheEscrita: number
  /** Reserva automática no servidor quando o modelo recusa por política (beta server-side-fallback). */
  aceitaReserva: boolean
}

export const MODELOS = {
  opus: { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', precoEntrada: 4, precoSaida: 20, precoCacheLeitura: 0.2, precoCacheEscrita: 5, aceitaReserva: true },
  sonnet: { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', precoEntrada: 2, precoSaida: 10, precoCacheLeitura: 0.2, precoCacheEscrita: 2.5, aceitaReserva: true },
  // Haiku 5.5: US$ 0,10 / 0,50 até 100K tokens de prompt (US$ 0,50 / 2,50 acima); sem reserva no servidor
  haiku: { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', precoEntrada: 0.1, precoSaida: 0.5, precoCacheLeitura: 0.01, precoCacheEscrita: 0.125, aceitaReserva: false },
} as const satisfies Record<string, ModeloIA>

/**
 * Roteamento: o roteiro (estrutura e texto) vai no Sonnet; o desenho de cada tela (composição, hierarquia,
 * ajuste de texto ao layout) no Opus; refazer uma tela no Sonnet; ações curtas de texto no Haiku.
 */
export const MODELO_POR_ETAPA: Record<EtapaIA, ModeloIA> = {
  roteiro: MODELOS.sonnet,
  design: MODELOS.opus,
  tela: MODELOS.sonnet,
  texto: MODELOS.haiku,
}

/**
 * Esforço e limite de saída por etapa. O roteiro e o design usam streaming (geração longa ou em paralelo);
 * o design roda uma chamada por tela, com o catálogo e o roteiro em cache.
 */
export const CONFIG_ETAPA: Record<EtapaIA, { esforco: Esforco; maxTokens: number }> = {
  roteiro: { esforco: 'medium', maxTokens: 32000 },
  design: { esforco: 'medium', maxTokens: 8000 },
  tela: { esforco: 'medium', maxTokens: 4000 },
  texto: { esforco: 'low', maxTokens: 8000 },
}

export interface UsoTokens { entrada: number; saida: number; cacheLeitura?: number; cacheEscrita?: number }

/** Custo estimado em USD de uma chamada, a partir do uso (tokens) e do preço do modelo. */
export function custoUsd(modelo: ModeloIA, uso: UsoTokens): number {
  return (uso.entrada * modelo.precoEntrada + uso.saida * modelo.precoSaida + (uso.cacheLeitura ?? 0) * modelo.precoCacheLeitura + (uso.cacheEscrita ?? 0) * modelo.precoCacheEscrita) / 1_000_000
}

/** Modelo pelo id devolvido pela API (com ou sem sufixo); desconhecido = o mais caro (estimativa conservadora). */
export function modeloPorId(id: string | null | undefined): ModeloIA {
  const m = (Object.values(MODELOS) as ModeloIA[]).find((x) => !!id && (id === x.id || id.startsWith(`${x.id}-`)))
  return m ?? MODELOS.opus
}

interface UsoApi {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  iterations?: ({ type: string; model?: string | null; input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | { type: string })[] | null
}

/**
 * Custo de uma resposta da API. Com reserva no servidor (fallback), cada iteração é cobrada pelo preço do
 * modelo que a rodou; sem iterações, usa o total no preço do modelo pedido.
 */
export function custoDaResposta(usage: UsoApi, modeloPedido: ModeloIA): { usd: number; uso: Required<UsoTokens> } {
  const total = { entrada: usage.input_tokens, saida: usage.output_tokens, cacheLeitura: usage.cache_read_input_tokens ?? 0, cacheEscrita: usage.cache_creation_input_tokens ?? 0 }
  const iter = (usage.iterations ?? []).filter((i): i is Extract<NonNullable<UsoApi['iterations']>[number], { input_tokens: number }> => 'input_tokens' in i && (i.type === 'message' || i.type === 'fallback_message'))
  if (!iter.length) return { usd: custoUsd(modeloPedido, total), uso: total }
  const usd = iter.reduce((s, i) => s + custoUsd(i.model ? modeloPorId(i.model) : modeloPedido, { entrada: i.input_tokens, saida: i.output_tokens, cacheLeitura: i.cache_read_input_tokens ?? 0, cacheEscrita: i.cache_creation_input_tokens ?? 0 }), 0)
  return { usd, uso: total }
}
