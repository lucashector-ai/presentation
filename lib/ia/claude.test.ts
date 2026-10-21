/**
 * Pipeline do Claude contra um servidor local que imita a Messages API (streaming SSE e resposta JSON).
 * Nada sai da máquina: o SDK aponta para o servidor por ANTHROPIC_BASE_URL e usa uma chave falsa.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PedidoDesignSchema } from './design'
import { gerarRoteiroLocal } from './local'
import { PedidoRoteiroSchema } from './pedido'
import { MODELOS } from './modelos'
import { PedidoTextoSchema } from './texto'

interface Pedido { corpo: Record<string, unknown>; chegada: number; beta: boolean }
const pedidos: Pedido[] = []
let server: Server
let t0 = 0
/** Resposta por chamada: devolve o JSON da saída estruturada (ou recusa). */
let responder: (corpo: Record<string, unknown>) => { json?: unknown; recusa?: boolean; atraso?: number } = () => ({ json: {} })

const ler = (req: IncomingMessage) => new Promise<string>((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)) })
const sse = (tipo: string, dados: unknown) => `event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`
const usoDe = (corpo: Record<string, unknown>) => {
  // simula o cache: system/primeiro bloco com cache_control já escritos depois da primeira chamada
  const anteriores = pedidos.filter((p) => p.corpo.model === corpo.model).length - 1
  return anteriores > 0 ? { input_tokens: 60, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 } : { input_tokens: 60, cache_read_input_tokens: 0, cache_creation_input_tokens: 3000 }
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const corpo = JSON.parse(await ler(req)) as Record<string, unknown>
    pedidos.push({ corpo, chegada: Date.now() - t0, beta: (req.url ?? '').includes('beta=true') })
    const r = responder(corpo)
    await new Promise((ok) => setTimeout(ok, r.atraso ?? 0))
    const texto = JSON.stringify(r.json ?? {})
    const uso = usoDe(corpo)
    const mensagem = { id: `msg_${pedidos.length}`, type: 'message', role: 'assistant', model: corpo.model, content: [] as unknown[], stop_reason: null, stop_sequence: null, usage: { ...uso, output_tokens: 1 } }
    if (!corpo.stream) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ...mensagem, content: r.recusa ? [] : [{ type: 'text', text: texto }], stop_reason: r.recusa ? 'refusal' : 'end_turn', usage: { ...uso, output_tokens: 400 } }))
      return
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(sse('message_start', { type: 'message_start', message: mensagem }))
    if (!r.recusa) {
      res.write(sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
      for (let i = 0; i < texto.length; i += 200) res.write(sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texto.slice(i, i + 200) } }))
      res.write(sse('content_block_stop', { type: 'content_block_stop', index: 0 }))
    }
    res.write(sse('message_delta', { type: 'message_delta', delta: { stop_reason: r.recusa ? 'refusal' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 800 } }))
    res.write(sse('message_stop', { type: 'message_stop' }))
    res.end()
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste'
})
afterAll(() => {
  server.close()
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
})

const pedidoRoteiro = PedidoRoteiroSchema.parse({ prompt: 'Pitch da Aurora, energia solar por assinatura', telas: 6, tipo: 'pitch' })
const roteiro = gerarRoteiroLocal(pedidoRoteiro)

describe('pipeline com o Claude (API simulada)', () => {
  it('roteiro: Sonnet, streaming, system em cache, esforço médio; saída normalizada e custo pelo uso', async () => {
    const { gerarRoteiroClaude } = await import('./claude')
    pedidos.length = 0
    responder = () => ({ json: { titulo: 'Aurora', tema: 'grafite', telas: roteiro.telas.map((t) => ({ ...t, titulo: `${t.titulo}  ` })) } })
    const r = await gerarRoteiroClaude(pedidoRoteiro)
    const p = pedidos[0]!
    expect(p.beta).toBe(true)
    expect(p.corpo).toMatchObject({ model: MODELOS.sonnet.id, stream: true, fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema' } } })
    expect((p.corpo.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(r.tema).toBe('grafite')
    expect(r.roteiro.telas).toHaveLength(6)
    expect(r.roteiro.telas[0]!.titulo).toBe(roteiro.telas[0]!.titulo)
    // 60 entrada + 3000 escrita de cache + 800 saída, no preço do Sonnet
    expect(r.custo.usd).toBeCloseTo((60 * 2 + 3000 * 2.5 + 800 * 10) / 1e6, 6)
    expect(r.custo.uso).toEqual({ entrada: 60, saida: 800, cacheLeitura: 0, cacheEscrita: 3000, cacheEscrita1h: 0 })
  })

  it('design premium: Opus, uma chamada por tela; a primeira sozinha (escreve o cache) e as outras depois; deck em cache', async () => {
    const { desenharTelasClaude } = await import('./claude')
    pedidos.length = 0
    t0 = Date.now()
    responder = (corpo) => {
      const msg = JSON.stringify(corpo.messages)
      const n = Number(/Desenhe a tela (\d+)/.exec(msg)?.[1] ?? 1)
      const t = roteiro.telas[n - 1]!
      return { atraso: n === 1 ? 150 : 20, json: { variante: n === 1 ? 'capa.tipografica' : 'capa.classica', fundo: 'escuro', alinhamento: 'esquerda', rotulo: '', titulo: '', enfase: '', texto: '', itens: [], destaque: -1, imagem: n === 1 ? 'painel solar no telhado' : '', decoracao: 'marcante' }, recusa: t.tipo === 'encerramento' }
    }
    // sem qualidade o padrão é o Sonnet; o teste usa premium para conferir o Opus e o preço dele
    expect(PedidoDesignSchema.parse({ roteiro, indices: [0] }).qualidade).toBe('padrao')
    const p = PedidoDesignSchema.parse({ roteiro, indices: [0, 1, 2, 5], tipo: 'pitch', tema: 'grafite', estilo: 'ousado', qualidade: 'premium' })
    const r = await desenharTelasClaude(p)
    expect(pedidos).toHaveLength(4)
    expect(pedidos.every((x) => x.corpo.model === MODELOS.opus.id && x.corpo.stream === true)).toBe(true)
    // as outras telas só partem depois que a primeira começou a responder
    const primeira = pedidos[0]!
    expect(JSON.stringify(primeira.corpo.messages)).toContain('Desenhe a tela 1 ')
    for (const x of pedidos.slice(1)) expect(x.chegada).toBeGreaterThanOrEqual(primeira.chegada)
    // system com o catálogo e primeiro bloco (roteiro do deck) com cache; segundo bloco varia por tela
    const blocos = (primeira.corpo.messages as { content: { text: string; cache_control?: unknown }[] }[])[0]!.content
    expect((primeira.corpo.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    expect(blocos[0]!.cache_control).toEqual({ type: 'ephemeral' })
    expect(blocos[1]!.cache_control).toBeUndefined()
    const primeirosBlocos = pedidos.map((x) => JSON.stringify((x.corpo.messages as { content: unknown[] }[])[0]!.content[0]))
    expect(new Set(primeirosBlocos).size).toBe(1)
    // saída normalizada: variante de outro tipo (incompatível) vira a padrão do tipo da tela; recusa volta sem desenho
    expect(r.telas.map((t) => t.indice)).toEqual([0, 1, 2, 5])
    expect(r.telas[0]!.desenho).toMatchObject({ tipo: 'capa', variante: 'capa.tipografica', fundo: 'escuro', imagem: 'painel solar no telhado', titulo: roteiro.telas[0]!.titulo })
    expect(r.telas[1]!.desenho).toMatchObject({ tipo: roteiro.telas[1]!.tipo, titulo: roteiro.telas[1]!.titulo })
    expect(r.telas[1]!.desenho!.variante.startsWith(`${roteiro.telas[1]!.tipo}.`)).toBe(true)
    expect(r.telas[3]!.desenho).toBeNull()
    // custo: 1 escrita de cache + 3 leituras, 4 × 800 de saída, no preço do Opus
    expect(r.custo!.uso).toEqual({ entrada: 240, saida: 3200, cacheLeitura: 9000, cacheEscrita: 3000, cacheEscrita1h: 0 })
    expect(r.custo!.usd).toBeCloseTo((240 * 4 + 3200 * 20 + 9000 * 0.2 + 3000 * 5) / 1e6, 6)
  })

  it('reescrever texto: Haiku sem reserva no servidor, resposta não-streaming normalizada', async () => {
    const { reescreverTextoClaude } = await import('./claude')
    pedidos.length = 0
    responder = () => ({ json: { textos: [{ id: 'a', texto: 'Mais curto' }, { id: 'desconhecido', texto: 'x' }] } })
    const r = await reescreverTextoClaude(PedidoTextoSchema.parse({ acao: 'curto', textos: [{ id: 'a', texto: 'Um texto bem mais longo' }, { id: 'b', texto: 'Fica' }] }))
    expect(pedidos[0]!.corpo).toMatchObject({ model: MODELOS.haiku.id, output_config: { effort: 'low' } })
    expect(pedidos[0]!.corpo.fallbacks).toBeUndefined()
    expect(r.textos).toEqual([{ id: 'a', texto: 'Mais curto' }, { id: 'b', texto: 'Fica' }])
    expect(r.custo.usd).toBeGreaterThan(0)
  })

  it('recusa no roteiro vira RecusaModelo, com o custo gasto anexado', async () => {
    const { gerarRoteiroClaude, RecusaModelo, custoDoErro } = await import('./claude')
    responder = () => ({ recusa: true })
    const erro = await gerarRoteiroClaude(pedidoRoteiro).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(RecusaModelo)
    expect(custoDoErro(erro)?.usd).toBeGreaterThan(0)
  })
})
