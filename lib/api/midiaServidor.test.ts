import { beforeAll, describe, expect, it } from 'vitest'

process.env.ARMAZENAMENTO_DEV = 'memoria'
const { lerRange, servirMidia } = await import('./midiaServidor')
const { armazenamento } = await import('@/lib/armazenamento')

const pedido = (headers: Record<string, string> = {}) => new Request('http://localhost/api/midias/x', { headers })
const midia = { chave: 'ws/a/original.mp4', mime: 'video/mp4', nome: 'clipe.mp4' }

beforeAll(async () => {
  await (await armazenamento()).guardar(midia.chave, '0123456789', { tipo: 'video/mp4' })
})

describe('lerRange', () => {
  it('entende início-fim, início- e -sufixo; recusa o resto', () => {
    expect(lerRange(null)).toBeNull()
    expect(lerRange('bytes=0-3')).toEqual({ inicio: 0, fim: 3 })
    expect(lerRange('bytes=5-')).toEqual({ inicio: 5, fim: undefined })
    expect(lerRange('bytes=-4', 10)).toEqual({ inicio: 6 })
    expect(lerRange('bytes=4-2')).toBe('invalido')
    expect(lerRange('bytes=0-1,4-5')).toBe('invalido')
    expect(lerRange('items=0-1')).toBe('invalido')
  })
})

describe('servirMidia', () => {
  it('200 com tipo, tamanho, cache e cabeçalhos defensivos', async () => {
    const r = await servirMidia(pedido(), midia, 'private, max-age=60')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('video/mp4')
    expect(r.headers.get('content-length')).toBe('10')
    expect(r.headers.get('cache-control')).toBe('private, max-age=60')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(r.headers.get('content-security-policy')).toContain('sandbox')
    expect(await r.text()).toBe('0123456789')
  })
  it('206 para Range, 416 fora do arquivo, 304 com ETag igual', async () => {
    const parte = await servirMidia(pedido({ range: 'bytes=2-4' }), midia, 'private')
    expect(parte.status).toBe(206)
    expect(parte.headers.get('content-range')).toBe('bytes 2-4/10')
    expect(await parte.text()).toBe('234')
    const fora = await servirMidia(pedido({ range: 'bytes=50-' }), midia, 'private')
    expect(fora.status).toBe(416)
    const etag = (await servirMidia(pedido(), midia, 'private')).headers.get('etag')!
    const igual = await servirMidia(pedido({ 'if-none-match': etag }), midia, 'private')
    expect(igual.status).toBe(304)
  })
  it('404 quando o objeto não existe', async () => {
    const r = await servirMidia(pedido(), { ...midia, chave: 'ws/nao/existe.mp4' }, 'private')
    expect(r.status).toBe(404)
  })
})
