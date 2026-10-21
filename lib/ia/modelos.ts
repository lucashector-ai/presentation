/**
 * Qual modelo do Claude atende cada etapa da IA do Mostra, e quanto cada um custa.
 * Fonte dos preços: documentação de modelos da Anthropic (USD por milhão de tokens, out/2026).
 * Ao trocar um modelo ou preço, revise `docs/economia-ia.md` e os custos em créditos (`lib/planos.ts`).
 */

export type EtapaIA = 'roteiro' | 'design' | 'tela' | 'texto'

export interface ModeloIA {
  id: string
  nome: string
  /** USD por milhão de tokens de entrada / saída / leitura de cache. */
  precoEntrada: number
  precoSaida: number
  precoCacheLeitura: number
  /** Reserva automática no servidor quando o modelo recusa por política (beta server-side-fallback). */
  aceitaReserva: boolean
}

export const MODELOS = {
  opus: { id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', precoEntrada: 4, precoSaida: 20, precoCacheLeitura: 0.2, aceitaReserva: true },
  sonnet: { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet 5.5', precoEntrada: 2, precoSaida: 10, precoCacheLeitura: 0.2, aceitaReserva: true },
  // Haiku 5.5: US$ 0,10 / 0,50 até 100K tokens de prompt (US$ 0,50 / 2,50 acima); sem reserva no servidor
  haiku: { id: 'claude-haiku-5-5', nome: 'Claude Haiku 5.5', precoEntrada: 0.1, precoSaida: 0.5, precoCacheLeitura: 0.01, aceitaReserva: false },
} as const satisfies Record<string, ModeloIA>

/**
 * Roteamento: o roteiro (texto e estrutura) não precisa do modelo mais caro; o desenho das telas, sim;
 * ações curtas de texto vão no mais barato.
 */
export const MODELO_POR_ETAPA: Record<EtapaIA, ModeloIA> = {
  roteiro: MODELOS.sonnet,
  design: MODELOS.opus,
  tela: MODELOS.sonnet,
  texto: MODELOS.haiku,
}

/** Custo estimado em USD de uma chamada, a partir do uso devolvido pela API. */
export function custoUsd(modelo: ModeloIA, uso: { entrada: number; saida: number; cacheLeitura?: number }): number {
  return (uso.entrada * modelo.precoEntrada + uso.saida * modelo.precoSaida + (uso.cacheLeitura ?? 0) * modelo.precoCacheLeitura) / 1_000_000
}
