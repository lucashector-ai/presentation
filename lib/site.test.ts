import { describe, expect, it } from 'vitest'
import { destinoCanonico, ehHostDeTransicao, HOST_SITE, HOST_WWW, ORIGEM_SITE, ORIGENS_DO_APP, origemCanonica, urlDoSite } from './site'

describe('origem do site', () => {
  it('tem o domínio oficial como padrão e o www derivado dele', () => {
    expect(ORIGEM_SITE).toMatch(/^https?:\/\/[^/]+$/)
    expect(HOST_WWW).toBe(`www.${HOST_SITE}`)
    expect(ORIGENS_DO_APP.has(ORIGEM_SITE)).toBe(true)
  })

  it('reconhece hosts de desenvolvimento e de transição', () => {
    expect(ehHostDeTransicao('localhost')).toBe(true)
    expect(ehHostDeTransicao('localhost:8853')).toBe(true)
    expect(ehHostDeTransicao('127.0.0.1')).toBe(true)
    expect(ehHostDeTransicao('mostra.oobo-site.workers.dev')).toBe(true)
    expect(ehHostDeTransicao(HOST_SITE)).toBe(false)
    expect(ehHostDeTransicao('outro.example')).toBe(false)
  })

  it('usa a origem do pedido em localhost e no workers.dev, e a canônica no domínio', () => {
    expect(origemCanonica('http://localhost:8853/app')).toBe('http://localhost:8853')
    expect(origemCanonica('https://mostra.oobo-site.workers.dev/p/x')).toBe('https://mostra.oobo-site.workers.dev')
    expect(origemCanonica(`https://${HOST_SITE}/p/x`)).toBe(ORIGEM_SITE)
    expect(origemCanonica(`https://${HOST_WWW}/p/x`)).toBe(ORIGEM_SITE)
    expect(origemCanonica(new Request('https://desconhecido.example/'))).toBe(ORIGEM_SITE)
  })

  it('monta URLs absolutas do site', () => {
    expect(urlDoSite('/p/abc')).toBe(`${ORIGEM_SITE}/p/abc`)
    expect(urlDoSite()).toBe(`${ORIGEM_SITE}/`)
    expect(urlDoSite('/app', 'http://localhost:3000')).toBe('http://localhost:3000/app')
  })

  it('redireciona só o www, preservando caminho e consulta', () => {
    expect(destinoCanonico(new URL(`https://${HOST_WWW}/p/abc?x=1`))).toBe(`${ORIGEM_SITE}/p/abc?x=1`)
    expect(destinoCanonico(new URL(`${ORIGEM_SITE}/p/abc`))).toBeNull()
    expect(destinoCanonico(new URL('https://mostra.oobo-site.workers.dev/'))).toBeNull()
    expect(destinoCanonico(new URL('http://localhost:3000/'))).toBeNull()
  })
})
