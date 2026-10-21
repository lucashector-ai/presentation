import 'server-only'
/**
 * Chamadas ao Claude, uma por etapa, com o modelo de cada uma (lib/ia/modelos.ts):
 * - roteiro (Sonnet, streaming): estrutura narrativa e texto de todas as telas;
 * - design (Opus, streaming, uma chamada por tela): componente, variante, fundo, ênfase e texto ajustado ao
 *   layout. O system (catálogo do design system) e o primeiro bloco da mensagem (roteiro do deck) vão em cache:
 *   a primeira tela escreve o cache e as demais começam depois que ela começa a responder, para lê-lo;
 * - refazer uma tela (Sonnet) e reescrever texto (Haiku) no editor;
 * - ler PDF escaneado (Sonnet, streaming): o PDF vai como documento e volta o texto de cada página.
 * Saída estruturada validada pelo Zod e normalizada aos limites do design system antes de voltar ao cliente.
 * Cada chamada devolve o custo estimado (tokens × preço do modelo que de fato respondeu) para o registro de margem.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { DesenhoModeloSchema, INSTRUCOES_DESIGN, mensagemDeck, mensagemTelaDesign, normalizarDesenho, type PedidoDesign } from './design'
import { CONFIG_ETAPA, MODELO_POR_ETAPA, custoDaResposta, type ModeloIA, type UsoTokens } from './modelos'
import type { TelaDesenhada } from './montagem'
import { normalizarRoteiro, RoteiroModeloSchema, type PedidoRoteiro } from './pedido'
import { INSTRUCOES_PDF, mensagemPdf, normalizarPaginasLidas, PaginasLidasSchema, type PaginaLida } from './pdf'
import { INSTRUCOES_SISTEMA, mensagemUsuario } from './prompt'
import type { Roteiro } from './roteiro'
import { INSTRUCOES_TEXTO, mensagemTexto, normalizarTextos, TextosModeloSchema, type PedidoTexto, type TextoReescrito } from './texto'
import { INSTRUCOES_TELA, mensagemTela, normalizarTela, TelaModeloSchema, type ConteudoTela, type PedidoTela } from './tela'
import type { TemaId } from './designSystem'

/** @deprecated use MODELO_POR_ETAPA (lib/ia/modelos.ts) */
export const MODELO_ROTEIRO = MODELO_POR_ETAPA.roteiro.id

/** Reserva no servidor (se o modelo recusar por política, a API tenta o recomendado na mesma chamada). */
const reserva = (m: ModeloIA) => (m.aceitaReserva ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {})

export class RecusaModelo extends Error {}

/** Custo de uma ou mais chamadas: USD estimado (uso × preço) e o uso somado. */
export interface CustoIa { usd: number; uso: Required<UsoTokens>; modelo: string }
const somar = (a: CustoIa | null, b: CustoIa): CustoIa => (a ? { usd: a.usd + b.usd, modelo: b.modelo, uso: { entrada: a.uso.entrada + b.uso.entrada, saida: a.uso.saida + b.uso.saida, cacheLeitura: a.uso.cacheLeitura + b.uso.cacheLeitura, cacheEscrita: a.uso.cacheEscrita + b.uso.cacheEscrita } } : b)

let cliente: Anthropic | null = null
const obterCliente = () => (cliente ??= new Anthropic({ maxRetries: 2, timeout: 180_000 }))
export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY

const custoDe = (r: { usage: Parameters<typeof custoDaResposta>[0]; model: string }, m: ModeloIA): CustoIa => ({ ...custoDaResposta(r.usage, m), modelo: r.model })

/** Etapa 1: roteiro (streaming: com 20 telas e material longo a resposta passa de alguns milhares de tokens). */
export async function gerarRoteiroClaude(p: PedidoRoteiro, sinal?: AbortSignal): Promise<{ roteiro: Roteiro; tema: TemaId; modelo: string; custo: CustoIa }> {
  const m = MODELO_POR_ETAPA.roteiro
  const stream = obterCliente().beta.messages.stream(
    {
      model: m.id,
      max_tokens: CONFIG_ETAPA.roteiro.maxTokens,
      ...reserva(m),
      // system fixo (catálogo, arcos, temas): igual para todos os pedidos, então vai em cache
      system: [{ type: 'text', text: INSTRUCOES_SISTEMA, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: mensagemUsuario(p) }],
      output_config: { format: betaZodOutputFormat(RoteiroModeloSchema), effort: CONFIG_ETAPA.roteiro.esforco },
    },
    { signal: sinal }
  )
  const resposta = await stream.finalMessage()
  const custo = custoDe(resposta, m)
  if (resposta.stop_reason === 'refusal') throw Object.assign(new RecusaModelo('O modelo não aceitou este pedido.'), { custo })
  if (!resposta.parsed_output) throw Object.assign(new Error(`Roteiro sem saída estruturada (stop_reason: ${resposta.stop_reason})`), { custo })
  return { roteiro: normalizarRoteiro(resposta.parsed_output, p.telas), tema: resposta.parsed_output.tema, modelo: resposta.model, custo }
}

export interface ResultadoDesenho { indice: number; desenho: TelaDesenhada | null; erro?: unknown }

/**
 * Etapa 2: design das telas pedidas, uma chamada por tela (até `paralelo` ao mesmo tempo). A primeira chamada
 * escreve o cache; as outras só começam quando ela começa a responder (antes disso o cache não é legível).
 * Telas que falham voltam com `desenho: null` (a rota usa o desenho local e estorna o crédito delas).
 */
export async function desenharTelasClaude(p: PedidoDesign, sinal?: AbortSignal, paralelo = 4): Promise<{ telas: ResultadoDesenho[]; modelo: string; custo: CustoIa | null }> {
  const m = MODELO_POR_ETAPA.design
  const story = p.formato === 'story'
  const sistema = [{ type: 'text' as const, text: INSTRUCOES_DESIGN, cache_control: { type: 'ephemeral' as const } }]
  const deck = mensagemDeck(p)
  const abrir = (indice: number) =>
    obterCliente().beta.messages.stream(
      {
        model: m.id,
        max_tokens: CONFIG_ETAPA.design.maxTokens,
        ...reserva(m),
        system: sistema,
        messages: [{ role: 'user', content: [{ type: 'text', text: deck, cache_control: { type: 'ephemeral' } }, { type: 'text', text: mensagemTelaDesign(p, indice) }] }],
        output_config: { format: betaZodOutputFormat(DesenhoModeloSchema), effort: CONFIG_ETAPA.design.esforco },
      },
      { signal: sinal }
    )
  let custo: CustoIa | null = null
  let modelo: string = m.id
  const concluir = async (indice: number, stream: ReturnType<typeof abrir>): Promise<ResultadoDesenho> => {
    try {
      const r = await stream.finalMessage()
      custo = somar(custo, custoDe(r, m))
      modelo = r.model
      if (r.stop_reason === 'refusal') return { indice, desenho: null, erro: new RecusaModelo('O modelo não aceitou desenhar esta tela.') }
      if (!r.parsed_output) return { indice, desenho: null, erro: new Error(`Design sem saída estruturada (stop_reason: ${r.stop_reason})`) }
      return { indice, desenho: normalizarDesenho(r.parsed_output, p.roteiro.telas[indice]!, story) }
    } catch (erro) {
      return { indice, desenho: null, erro }
    }
  }
  const [primeiro, ...resto] = p.indices
  const telas: ResultadoDesenho[] = []
  const s0 = abrir(primeiro!)
  // a entrada no cache fica legível quando a primeira resposta começa a chegar
  await s0.emitted('connect').catch(() => undefined)
  const t0 = concluir(primeiro!, s0)
  const fila = [...resto]
  const trabalhadores = Array.from({ length: Math.min(paralelo, fila.length) }, async () => {
    for (let i = fila.shift(); i !== undefined; i = fila.shift()) telas.push(await concluir(i, abrir(i)))
  })
  telas.push(await t0)
  await Promise.all(trabalhadores)
  return { telas: telas.sort((a, b) => p.indices.indexOf(a.indice) - p.indices.indexOf(b.indice)), modelo, custo }
}

/** "Reescrever o texto de uma tela": devolve os mesmos ids, com o texto reescrito. */
export async function reescreverTextoClaude(p: PedidoTexto, sinal?: AbortSignal): Promise<{ textos: TextoReescrito[]; modelo: string; custo: CustoIa }> {
  const m = MODELO_POR_ETAPA.texto
  const resposta = await obterCliente().beta.messages.parse(
    {
      model: m.id,
      max_tokens: CONFIG_ETAPA.texto.maxTokens,
      ...reserva(m),
      system: INSTRUCOES_TEXTO,
      messages: [{ role: 'user', content: mensagemTexto(p) }],
      output_config: { format: betaZodOutputFormat(TextosModeloSchema), effort: CONFIG_ETAPA.texto.esforco },
    },
    { signal: sinal }
  )
  const custo = custoDe(resposta, m)
  if (resposta.stop_reason === 'refusal') throw Object.assign(new RecusaModelo('O modelo não aceitou este pedido.'), { custo })
  if (!resposta.parsed_output) throw Object.assign(new Error(`Texto sem saída estruturada (stop_reason: ${resposta.stop_reason})`), { custo })
  return { textos: normalizarTextos(resposta.parsed_output, p), modelo: resposta.model, custo }
}

/** "Refazer uma tela": novo título, texto, itens e notas para as caixas que a tela já tem. */
export async function refazerTelaClaude(p: PedidoTela, sinal?: AbortSignal): Promise<{ tela: ConteudoTela; modelo: string; custo: CustoIa }> {
  const m = MODELO_POR_ETAPA.tela
  const resposta = await obterCliente().beta.messages.parse(
    {
      model: m.id,
      max_tokens: CONFIG_ETAPA.tela.maxTokens,
      ...reserva(m),
      system: INSTRUCOES_TELA,
      messages: [{ role: 'user', content: mensagemTela(p) }],
      output_config: { format: betaZodOutputFormat(TelaModeloSchema), effort: CONFIG_ETAPA.tela.esforco },
    },
    { signal: sinal }
  )
  const custo = custoDe(resposta, m)
  if (resposta.stop_reason === 'refusal') throw Object.assign(new RecusaModelo('O modelo não aceitou este pedido.'), { custo })
  if (!resposta.parsed_output) throw Object.assign(new Error(`Tela sem saída estruturada (stop_reason: ${resposta.stop_reason})`), { custo })
  return { tela: normalizarTela(resposta.parsed_output, p), modelo: resposta.model, custo }
}

/**
 * Leitura de PDF escaneado: o PDF (montado no navegador só com as páginas sem texto) vai como documento na
 * mensagem, antes do pedido; a resposta é o texto de cada página (saída estruturada, streaming porque um PDF de
 * 40 páginas passa de dezenas de milhares de tokens). Nada é guardado: o base64 só existe nesta chamada.
 */
export async function lerPdfClaude(pdfBase64: string, paginasOriginais: number[], sinal?: AbortSignal): Promise<{ paginas: PaginaLida[]; modelo: string; custo: CustoIa }> {
  const m = MODELO_POR_ETAPA.pdf
  const stream = obterCliente().beta.messages.stream(
    {
      model: m.id,
      max_tokens: CONFIG_ETAPA.pdf.maxTokens,
      ...reserva(m),
      system: INSTRUCOES_PDF,
      messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } }, { type: 'text', text: mensagemPdf(paginasOriginais) }] }],
      output_config: { format: betaZodOutputFormat(PaginasLidasSchema), effort: CONFIG_ETAPA.pdf.esforco },
    },
    { signal: sinal }
  )
  const resposta = await stream.finalMessage()
  const custo = custoDe(resposta, m)
  if (resposta.stop_reason === 'refusal') throw Object.assign(new RecusaModelo('O modelo não aceitou ler este PDF.'), { custo })
  if (!resposta.parsed_output) throw Object.assign(new Error(`Leitura de PDF sem saída estruturada (stop_reason: ${resposta.stop_reason})`), { custo })
  return { paginas: normalizarPaginasLidas(resposta.parsed_output, paginasOriginais), modelo: resposta.model, custo }
}

/** Custo anexado a um erro pelas funções acima (chamada que gastou tokens e falhou). */
export const custoDoErro = (e: unknown): CustoIa | null => (e && typeof e === 'object' && 'custo' in e ? ((e as { custo: CustoIa }).custo ?? null) : null)
