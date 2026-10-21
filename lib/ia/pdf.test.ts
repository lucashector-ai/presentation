/**
 * Leitura de PDF escaneado pela IA: conferência do PDF, contrato e a chamada ao Claude (documento PDF na
 * mensagem) contra um servidor local que imita a Messages API em streaming. Nada sai da máquina.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { jsPDF } from 'jspdf'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { montarPdfDeImagens } from '@/lib/pdf/montar'
import { custoLeituraPdf } from '@/lib/planos'
import { MODELOS } from './modelos'
import { inspecionarPdf, lerListaPaginas, LEITURA_PDF, normalizarPaginasLidas } from './pdf'

// JPEG 16×16 de verdade (página "escaneada" mínima)
const JPEG = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAQABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUG/8QAIRAAAQIEBwAAAAAAAAAAAAAAEQAFARITFAIDBAYiMZH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1G4HjWNNvZtOe41ZpqR4AAjDHsx8Tb7xrHa4vGnPbqUstU8ySDhh0IeqwiD/2Q=='), (c) => c.charCodeAt(0))
const pdfEscaneado = (n: number) => montarPdfDeImagens(jsPDF, Array.from({ length: n }, (_, i) => ({ jpeg: JPEG, larguraPt: i % 2 ? 842 : 595, alturaPt: i % 2 ? 595 : 842 })))
const comoPdf = (s: string) => new TextEncoder().encode(s)

describe('PDF montado para a IA', () => {
  it('só imagens, sem texto nem conteúdo ativo; páginas contadas', () => {
    const r = inspecionarPdf(pdfEscaneado(3))
    expect(r).toEqual({ ok: true, paginas: 3 })
  })

  it('recusa script, anexo, formulário, fluxo de objetos e o que não é PDF', () => {
    const base = '%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n'
    expect(inspecionarPdf(comoPdf(base + 'trailer << /Root 1 0 R >>'))).toEqual({ ok: true, paginas: 1 })
    for (const extra of ['4 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj', '<< /OpenAction << /S /Launch /F (calc.exe) >> >>', '<< /Names << /EmbeddedFiles 5 0 R >> >>', '<< /AcroForm << /XFA 6 0 R >> >>', '7 0 obj << /Type /ObjStm /N 3 >> stream\nxx\nendstream']) {
      expect(inspecionarPdf(comoPdf(base + extra)).ok).toBe(false)
    }
    expect(inspecionarPdf(comoPdf('GIF89a não é pdf'.padEnd(100, '.'))).ok).toBe(false)
    // conteúdo binário de stream (pixels) pode conter qualquer sequência: não conta
    expect(inspecionarPdf(comoPdf(base + '8 0 obj << /Length 9 >> stream\n/JS lixo\nendstream')).ok).toBe(true)
    // página escondida num "stream" falso ainda conta na cobrança
    expect(inspecionarPdf(comoPdf(base + '9 0 obj << /Length 40 >> stream\n10 0 obj << /Type /Page >> endobj\nendstream'))).toEqual({ ok: true, paginas: 2 })
  })

  it('lista de páginas: crescente, sem repetição, até o máximo', () => {
    expect(lerListaPaginas('2,5,9')).toEqual([2, 5, 9])
    for (const ruim of [null, '', '2,2', '5,3', '0', '1,a', '1;2']) expect(lerListaPaginas(ruim)).toBeNull()
    expect(lerListaPaginas(Array.from({ length: LEITURA_PDF.maxPaginas + 1 }, (_, i) => i + 1).join(','))).toBeNull()
  })

  it('resposta do modelo casa com as páginas originais (pela posição) e respeita o teto por página', () => {
    expect(normalizarPaginasLidas({ paginas: [{ pagina: 2, texto: '  B\r\n\n\n\nfim ' }, { pagina: 1, texto: 'A' }, { pagina: 9, texto: 'x' }] }, [4, 7, 8])).toEqual([
      { pagina: 4, texto: 'A' }, { pagina: 7, texto: 'B\n\nfim' }, { pagina: 8, texto: '' },
    ])
    // numerou pelas páginas originais
    expect(normalizarPaginasLidas({ paginas: [{ pagina: 7, texto: 'sete' }] }, [4, 7])).toEqual([{ pagina: 4, texto: '' }, { pagina: 7, texto: 'sete' }])
    expect(normalizarPaginasLidas({ paginas: [{ pagina: 1, texto: 'x'.repeat(20000) }] }, [1])[0]!.texto.length).toBe(LEITURA_PDF.maxCaracteresPagina)
  })
})

// ---------- Claude simulado ----------
interface Pedido { corpo: Record<string, unknown>; url: string }
const pedidos: Pedido[] = []
let server: Server
let resposta: { json?: unknown; recusa?: boolean; status?: number } = {}
const ler = (req: IncomingMessage) => new Promise<string>((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)) })
const sse = (tipo: string, dados: unknown) => `event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const corpo = JSON.parse(await ler(req)) as Record<string, unknown>
    pedidos.push({ corpo, url: req.url ?? '' })
    if (resposta.status) { res.writeHead(resposta.status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'sobrecarga' } })); return }
    const texto = JSON.stringify(resposta.json ?? {})
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(sse('message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: corpo.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }))
    if (!resposta.recusa) {
      res.write(sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
      res.write(sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texto } }))
      res.write(sse('content_block_stop', { type: 'content_block_stop', index: 0 }))
    }
    res.write(sse('message_delta', { type: 'message_delta', delta: { stop_reason: resposta.recusa ? 'refusal' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1500 } }))
    res.write(sse('message_stop', { type: 'message_stop' }))
    res.end()
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste'
  process.env.NEXT_PUBLIC_DEMO = '1'
})
afterAll(() => {
  server.close()
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.NEXT_PUBLIC_DEMO
})

describe('leitura pelo Claude (API simulada)', () => {
  it('PDF como documento antes do pedido; Sonnet, streaming, esforço baixo, reserva; custo pelo uso', async () => {
    const { lerPdfClaude } = await import('./claude')
    pedidos.length = 0
    resposta = { json: { paginas: [{ pagina: 1, texto: '# Ata\n\nReceita de R$ 1,2 mi' }, { pagina: 2, texto: '| a | b |' }] } }
    const r = await lerPdfClaude('JVBERi0=', [3, 5])
    const p = pedidos[0]!
    expect(p.url).toContain('beta=true')
    expect(p.corpo).toMatchObject({ model: MODELOS.sonnet.id, stream: true, fallbacks: 'default', output_config: { effort: 'low', format: { type: 'json_schema' } } })
    const conteudo = (p.corpo.messages as { content: { type: string; source?: unknown; text?: string }[] }[])[0]!.content
    expect(conteudo[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } })
    expect(conteudo[1]!.type).toBe('text')
    expect(conteudo[1]!.text).toContain('páginas 3, 5')
    expect(r.paginas).toEqual([{ pagina: 3, texto: '# Ata\n\nReceita de R$ 1,2 mi' }, { pagina: 5, texto: '| a | b |' }])
    expect(r.custo.usd).toBeCloseTo((12000 * 2 + 1500 * 10) / 1e6, 6)
  })

  it('rota (modo demo): confere o PDF e as páginas, devolve o texto; erros com mensagem', async () => {
    const { POST } = await import('@/app/api/ai/pdf/route')
    const chamar = (corpo: Uint8Array, paginas: string, tipo = 'application/pdf') =>
      POST(new Request(`http://localhost/api/ai/pdf?paginas=${paginas}`, { method: 'POST', headers: { 'content-type': tipo, 'content-length': String(corpo.byteLength) }, body: new Uint8Array(corpo) }), { params: {} })
    resposta = { json: { paginas: [{ pagina: 1, texto: 'Página um' }, { pagina: 2, texto: 'Página dois' }] } }
    pedidos.length = 0
    const pdf = pdfEscaneado(2)
    const ok = await chamar(pdf, '2,4')
    const env = (await ok.json()) as { data: { paginas: { pagina: number; texto: string }[]; caracteres: number; creditos: number } }
    expect(ok.status).toBe(200)
    expect(env.data.paginas).toEqual([{ pagina: 2, texto: 'Página um' }, { pagina: 4, texto: 'Página dois' }])
    expect(env.data.caracteres).toBe(20)
    // demo: a rota não debita (o saldo fictício é debitado no navegador)
    expect(env.data.creditos).toBe(0)
    // o PDF foi para o Claude como veio, em base64
    const doc = (pedidos[0]!.corpo.messages as { content: { source?: { data: string } }[] }[])[0]!.content[0]!.source!.data
    expect(doc).toBe(Buffer.from(pdf).toString('base64'))

    // número de páginas diferente do informado (é por ele que se cobra)
    expect((await chamar(pdf, '1')).status).toBe(400)
    expect((await chamar(pdf, '1,2', 'image/png')).status).toBe(400)
    expect((await chamar(comoPdf('%PDF-1.7 << /Type /Page >> << /JS (x) >>'.padEnd(80)), '1')).status).toBe(400)
    // API fora do ar → indisponível (nenhum crédito)
    resposta = { status: 529 }
    const fora = await chamar(pdf, '1,2')
    expect(fora.status).toBe(503)
    resposta = { recusa: true }
    expect((await chamar(pdf, '1,2')).status).toBe(400)
    expect(custoLeituraPdf(2)).toBe(8)
  }, 20000)
})
