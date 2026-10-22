/**
 * Qual modelo do Claude atende cada etapa da IA do Mostra, com que esforço e limite, e quanto cada um custa.
 * Fonte dos preços: tabela de modelos da Anthropic (USD por milhão de tokens, out/2026). Escrita no cache
 * (TTL de 5 min) custa 1,25× a entrada; leitura, o preço de cache de cada modelo.
 * Ao trocar um modelo ou preço, revise `docs/economia-ia.md` e os custos em créditos (`lib/planos.ts`):
 * o teste `lib/ia/economia.test.ts` falha se algum preço em créditos deixar de cobrir o custo.
 */

export type EtapaIA = 'roteiro' | 'design' | 'tela' | 'texto' | 'pdf' | 'marca'
export type Esforco = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface ModeloIA {
  id: string
  nome: string
  /** USD por milhão de tokens de entrada / saída / leitura de cache / escrita de cache (5 min: 1,25×; 1 hora: 2×). */
  precoEntrada: number
  precoSaida: number
  precoCacheLeitura: number
  precoCacheEscrita: number
  precoCacheEscrita1h: number
  /** Reserva automática no servidor quando o modelo recusa por política (beta server-side-fallback). */
  aceitaReserva: boolean
}

export const MODELOS = {
  opus: { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', precoEntrada: 4, precoSaida: 20, precoCacheLeitura: 0.2, precoCacheEscrita: 5, precoCacheEscrita1h: 8, aceitaReserva: true },
  sonnet: { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', precoEntrada: 2, precoSaida: 10, precoCacheLeitura: 0.2, precoCacheEscrita: 2.5, precoCacheEscrita1h: 4, aceitaReserva: true },
  // Haiku 5.5: US$ 0,10 / 0,50 até 100K tokens de prompt (US$ 0,50 / 2,50 acima); sem reserva no servidor
  haiku: { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', precoEntrada: 0.1, precoSaida: 0.5, precoCacheLeitura: 0.01, precoCacheEscrita: 0.125, precoCacheEscrita1h: 0.2, aceitaReserva: false },
} as const satisfies Record<string, ModeloIA>

/**
 * Roteamento: o roteiro (estrutura e texto) vai no Sonnet; o desenho de cada tela (composição, hierarquia,
 * ajuste de texto ao layout) também no Sonnet — no teste lado a lado de 21/10/2026 o resultado foi equivalente ao
 * Opus pela metade do custo, porque o layout vem do design system; o Opus fica como qualidade "premium"; refazer uma tela no Sonnet; ações curtas de texto no Haiku. A leitura
 * de PDF escaneado (transcrição do material que vai para o roteiro) fica no mesmo modelo do roteiro.
 */
export const MODELO_POR_ETAPA: Record<EtapaIA, ModeloIA> = {
  roteiro: MODELOS.sonnet,
  design: MODELOS.sonnet,
  tela: MODELOS.sonnet,
  texto: MODELOS.haiku,
  pdf: MODELOS.sonnet,
  // resumo do manual da marca: extração estruturada de um texto já filtrado (as cores e fontes vêm sem IA)
  marca: MODELOS.haiku,
}

/** Modelo do desenho das telas pela qualidade pedida: premium (Opus) ou padrão (Sonnet, metade do custo). */
export const modeloDoDesenho = (qualidade: 'padrao' | 'premium' = 'padrao'): ModeloIA => (qualidade === 'premium' ? MODELOS.opus : MODELO_POR_ETAPA.design)

/**
 * Esforço e limite de saída por etapa. O roteiro e o design usam streaming (geração longa ou em paralelo);
 * o design roda uma chamada por tela, com o catálogo e o roteiro em cache.
 */
export const CONFIG_ETAPA: Record<EtapaIA, { esforco: Esforco; maxTokens: number }> = {
  roteiro: { esforco: 'medium', maxTokens: 32000 },
  design: { esforco: 'medium', maxTokens: 8000 },
  tela: { esforco: 'medium', maxTokens: 4000 },
  texto: { esforco: 'low', maxTokens: 8000 },
  // transcrição: pouco raciocínio, saída longa (até ≈ 1.500 tokens por página × 40 páginas), em streaming
  pdf: { esforco: 'low', maxTokens: 64000 },
  marca: { esforco: 'low', maxTokens: 6000 },
}

/** `cacheEscrita` é o total gravado no cache; `cacheEscrita1h` é a parte dele gravada com TTL de 1 hora (preço 2×). */
export interface UsoTokens { entrada: number; saida: number; cacheLeitura?: number; cacheEscrita?: number; cacheEscrita1h?: number }

/** Custo estimado em USD de uma chamada, a partir do uso (tokens) e do preço do modelo. */
export function custoUsd(modelo: ModeloIA, uso: UsoTokens): number {
  const escrita1h = Math.min(uso.cacheEscrita1h ?? 0, uso.cacheEscrita ?? 0)
  return (uso.entrada * modelo.precoEntrada + uso.saida * modelo.precoSaida + (uso.cacheLeitura ?? 0) * modelo.precoCacheLeitura + ((uso.cacheEscrita ?? 0) - escrita1h) * modelo.precoCacheEscrita + escrita1h * modelo.precoCacheEscrita1h) / 1_000_000
}

/** Modelo pelo id devolvido pela API (com ou sem sufixo); desconhecido = o mais caro (estimativa conservadora). */
export function modeloPorId(id: string | null | undefined): ModeloIA {
  const m = (Object.values(MODELOS) as ModeloIA[]).find((x) => !!id && (id === x.id || id.startsWith(`${x.id}-`)))
  return m ?? MODELOS.opus
}

interface PorTtlApi { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null }
interface UsoApi {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_creation?: PorTtlApi | null
  iterations?: ({ type: string; model?: string | null; input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_creation?: PorTtlApi | null } | { type: string })[] | null
}

/**
 * Custo de uma resposta da API. Com reserva no servidor (fallback), cada iteração é cobrada pelo preço do
 * modelo que a rodou; sem iterações, usa o total no preço do modelo pedido.
 */
export function custoDaResposta(usage: UsoApi, modeloPedido: ModeloIA): { usd: number; uso: Required<UsoTokens> } {
  const total = { entrada: usage.input_tokens, saida: usage.output_tokens, cacheLeitura: usage.cache_read_input_tokens ?? 0, cacheEscrita: usage.cache_creation_input_tokens ?? 0, cacheEscrita1h: usage.cache_creation?.ephemeral_1h_input_tokens ?? 0 }
  const iter = (usage.iterations ?? []).filter((i): i is Extract<NonNullable<UsoApi['iterations']>[number], { input_tokens: number }> => 'input_tokens' in i && (i.type === 'message' || i.type === 'fallback_message'))
  if (!iter.length) return { usd: custoUsd(modeloPedido, total), uso: total }
  const usd = iter.reduce((s, i) => s + custoUsd(i.model ? modeloPorId(i.model) : modeloPedido, { entrada: i.input_tokens, saida: i.output_tokens, cacheLeitura: i.cache_read_input_tokens ?? 0, cacheEscrita: i.cache_creation_input_tokens ?? 0, cacheEscrita1h: i.cache_creation?.ephemeral_1h_input_tokens ?? 0 }), 0)
  return { usd, uso: total }
}
