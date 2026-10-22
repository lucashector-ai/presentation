import { describe, expect, it } from 'vitest'
import { atenderFontes } from './proxy'

const pedidos: string[] = []
const google = async (req: Request) => {
  pedidos.push(req.url)
  if (req.url.startsWith('https://fonts.googleapis.com/css2')) {
    expect(req.headers.get('user-agent')).toMatch(/Chrome\//)
    return new Response("/* latin */\n@font-face {\n  font-family: 'Playfair Display';\n  src: url(https://fonts.gstatic.com/s/playfairdisplay/v40/lat.woff2) format('woff2');\n}\n", { headers: { 'content-type': 'text/css' } })
  }
  if (req.url.startsWith('https://fonts.gstatic.com/')) return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32]), { headers: { 'content-type': 'font/woff2' } })
  return new Response('não', { status: 404 })
}
const get = (caminho: string) => atenderFontes(new Request(`https://mostra.app${caminho}`), undefined, google)

describe('proxy de fontes (Worker)', () => {
  it('ignora o que não é rota de fontes', async () => {
    expect(await get('/app')).toBeNull()
    expect(await get('/fontesx/css')).toBeNull()
  })

  it('folha: ajusta ao catálogo, pede ao Google e reescreve para a mesma origem', async () => {
    pedidos.length = 0
    const r = (await get('/fontes/css?f=Playfair+Display%3A300%2Ci400'))!
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toMatch(/^text\/css/)
    expect(r.headers.get('cache-control')).toMatch(/max-age=86400/)
    expect(pedidos).toEqual(['https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&display=swap'])
    const css = await r.text()
    expect(css).toContain('url(/fontes/arquivo/s/playfairdisplay/v40/lat.woff2)')
  })

  it('família fora do catálogo: folha vazia sem ir ao Google', async () => {
    pedidos.length = 0
    const r = (await get('/fontes/css?f=Helvetica+Neue%3A400'))!
    expect(r.status).toBe(200)
    expect(await r.text()).not.toContain('@font-face')
    expect(pedidos).toEqual([])
  })

  it('arquivo: repassa o woff2 com cache imutável; recusa caminhos estranhos e métodos de escrita', async () => {
    const r = (await get('/fontes/arquivo/s/playfairdisplay/v40/lat.woff2'))!
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('font/woff2')
    expect(r.headers.get('cache-control')).toMatch(/immutable/)
    expect((await get('/fontes/arquivo/s/../x'))!.status).toBe(400)
    expect((await get('/fontes/css?f=%3Cx%3E'))!.status).toBe(400)
    expect((await atenderFontes(new Request('https://mostra.app/fontes/css?f=Inter', { method: 'POST' }), undefined, google))!.status).toBe(405)
  })

  it('Google fora do ar: folha vazia (o texto usa a reserva), sem cache', async () => {
    const r = (await atenderFontes(new Request('https://mostra.app/fontes/css?f=Inter%3A400'), undefined, async () => { throw new Error('rede') }))!
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
  })
})
