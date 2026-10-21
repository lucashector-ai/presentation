import DOMPurify from 'isomorphic-dompurify'
import { describe, expect, it } from 'vitest'
import { ErroCorpo, lerTudo, separarCabeca, validarTexto } from './upload'
import { detectarMime } from './mime'

/** Stream em pedaços, como chega o corpo de uma requisição. */
const emPedacos = (bytes: Uint8Array, tamanho = 5) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.byteLength; i += tamanho) c.enqueue(bytes.slice(i, i + tamanho))
      c.close()
    },
  })
const ler = async (s: ReadableStream<Uint8Array>) => new Uint8Array(await new Response(s).arrayBuffer())
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 40 }, (_, i) => i)])

describe('separarCabeca', () => {
  it('entrega os primeiros bytes para conferir o MIME e o arquivo inteiro no stream', async () => {
    const { cabeca, corpo } = await separarCabeca(emPedacos(PNG), 32, PNG.byteLength)
    expect(cabeca.byteLength).toBe(32)
    expect(detectarMime(cabeca)).toBe('image/png')
    expect(await ler(corpo)).toEqual(PNG)
  })
  it('falha se vier menos ou mais do que o Content-Length declarado', async () => {
    const menos = await separarCabeca(emPedacos(PNG), 32, PNG.byteLength + 10)
    await expect(ler(menos.corpo)).rejects.toBeInstanceOf(ErroCorpo)
    const mais = await separarCabeca(emPedacos(PNG), 32, PNG.byteLength - 10)
    await expect(ler(mais.corpo)).rejects.toBeInstanceOf(ErroCorpo)
    await expect(separarCabeca(emPedacos(PNG, 100), 32, 10)).rejects.toBeInstanceOf(ErroCorpo)
  })
})

describe('lerTudo', () => {
  it('lê até o limite e para quando passa', async () => {
    expect((await lerTudo(emPedacos(PNG), PNG.byteLength)).byteLength).toBe(PNG.byteLength)
    await expect(lerTudo(emPedacos(PNG), 10)).rejects.toBeInstanceOf(ErroCorpo)
  })
})

describe('validarTexto', () => {
  it('sanitiza SVG: o que é gravado não tem script nem handlers', () => {
    const r = validarTexto('image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10" onload="alert(2)"/></svg>', DOMPurify)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.conteudo).not.toMatch(/script/i)
      expect(r.conteudo).not.toMatch(/onload/i)
      expect(r.conteudo).toMatch(/<rect/)
    }
  })
  it('recusa SVG inválido, JSON que não é Lottie e glTF com recursos externos', () => {
    expect(validarTexto('image/svg+xml', 'olá', DOMPurify).ok).toBe(false)
    expect(validarTexto('application/json', '{"a":1}', DOMPurify).ok).toBe(false)
    expect(validarTexto('application/json', 'não é json', DOMPurify).ok).toBe(false)
    expect(validarTexto('model/gltf+json', JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'externo.bin', byteLength: 4 }] }), DOMPurify).ok).toBe(false)
  })
})
