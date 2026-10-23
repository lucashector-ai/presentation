import { describe, expect, it } from 'vitest'
import { PACOTES_AVULSOS, PLANOS } from './planos'
import { PAGINAS, ROBOS_IA, absoluta, configRobots, ehCaminhoPrivado, entradasSitemap, grafoJsonLd, jsonLdBreadcrumb, jsonLdFaq, jsonLdOrganizacao, jsonLdSoftware, jsonLdWebPage, jsonLdWebSite, metadadosPagina, serializarJsonLd } from './seo'
import { ORIGEM_SITE } from './site'
import { COMPARATIVO, CONCORRENTES, FAQ, FAQ_PRECOS } from '@/components/marketing/dados'
import { llmsFullTxt, llmsTxt } from '@/components/marketing/llms'

describe('origem e páginas públicas', () => {
  it('ORIGEM_SITE é https e sem barra no fim; absoluta() monta a partir dela', () => {
    expect(ORIGEM_SITE).toMatch(/^https:\/\/[^/]+$/)
    expect(absoluta('/precos')).toBe(`${ORIGEM_SITE}/precos`)
    expect(absoluta('precos')).toBe(`${ORIGEM_SITE}/precos`)
    expect(absoluta('https://x.y/z')).toBe('https://x.y/z')
  })

  it('páginas públicas não incluem caminhos privados e têm título e descrição dentro das medidas', () => {
    for (const p of PAGINAS) {
      expect(ehCaminhoPrivado(p.caminho)).toBe(false)
      expect(p.titulo.length).toBeLessThanOrEqual(60)
      expect(p.descricao.length).toBeGreaterThanOrEqual(70)
      expect(p.descricao.length).toBeLessThanOrEqual(200)
    }
    expect(PAGINAS.map((p) => p.caminho)).toEqual(expect.arrayContaining(['/', '/precos', '/apresentacao-com-ia']))
  })

  it('metadadosPagina: canônico absoluto, indexável, Open Graph e Twitter completos', () => {
    const m = metadadosPagina('/precos')
    expect(m.alternates?.canonical).toBe(`${ORIGEM_SITE}/precos`)
    expect(m.robots).toEqual({ index: true, follow: true })
    expect(m.openGraph).toMatchObject({ type: 'website', locale: 'pt_BR', siteName: 'Mostra', url: `${ORIGEM_SITE}/precos` })
    const imagens = m.openGraph?.images as { url: string; width: number; height: number }[]
    expect(imagens[0]).toMatchObject({ url: `${ORIGEM_SITE}/og.png`, width: 1200, height: 630 })
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', images: [`${ORIGEM_SITE}/og.png`] })
    expect(m.title).toBe('Planos e preços')
    expect(metadadosPagina('/').title).toEqual({ absolute: expect.stringContaining('Mostra') })
    expect(() => metadadosPagina('/app')).toThrow()
  })
})

describe('robots e sitemap', () => {
  it('robots libera tudo menos app, api, p e criar, para todos e para os robôs de IA, e aponta o sitemap', () => {
    const r = configRobots()
    expect(r.sitemap).toBe(`${ORIGEM_SITE}/sitemap.xml`)
    expect(r.host).toBe(ORIGEM_SITE)
    const geral = r.rules.find((x) => x.userAgent === '*')!
    expect(geral.allow).toBe('/')
    expect(geral.disallow).toEqual(['/app/', '/app$', '/api/', '/p/', '/criar'])
    // Disallow casa por prefixo: /p não pode engolir /precos nem /app engolir /apresentacao-com-ia
    for (const d of geral.disallow) for (const p of PAGINAS) expect(p.caminho.startsWith(d.replace(/\$$/, ''))).toBe(false)
    expect(ehCaminhoPrivado('/app')).toBe(true)
    expect(ehCaminhoPrivado('/app/criar')).toBe(true)
    expect(ehCaminhoPrivado('/p/abc')).toBe(true)
    expect(ehCaminhoPrivado('/precos')).toBe(false)
    const ia = r.rules.find((x) => Array.isArray(x.userAgent))!
    for (const robo of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Bingbot', 'CCBot']) expect(ia.userAgent).toContain(robo)
    expect(ia.disallow).toEqual(geral.disallow)
    expect(ROBOS_IA.length).toBe(new Set(ROBOS_IA).size)
  })

  it('sitemap: uma entrada absoluta por página pública, com prioridade e frequência', () => {
    const entradas = entradasSitemap()
    expect(entradas.map((e) => e.url)).toEqual(PAGINAS.map((p) => absoluta(p.caminho)))
    for (const e of entradas) {
      expect(e.url.startsWith(`${ORIGEM_SITE}/`)).toBe(true)
      expect(e.priority).toBeGreaterThan(0)
    }
  })
})

describe('JSON-LD', () => {
  it('SoftwareApplication tem uma oferta por plano e por pacote, em BRL, com os preços de lib/planos.ts', () => {
    const app = jsonLdSoftware()
    const ofertas = (app.offers as { offers: { name: string; price: number; priceCurrency: string }[]; offerCount: number; lowPrice: number; highPrice: number }).offers
    expect(ofertas).toHaveLength(Object.keys(PLANOS).length + PACOTES_AVULSOS.length)
    expect((app.offers as { offerCount: number }).offerCount).toBe(ofertas.length)
    for (const o of ofertas) expect(o.priceCurrency).toBe('BRL')
    for (const p of Object.values(PLANOS)) expect(ofertas.find((o) => o.name === `Plano ${p.nome}`)?.price).toBe(p.precoMensalBRL)
    for (const pk of PACOTES_AVULSOS) expect(ofertas.find((o) => o.name === `Pacote de ${pk.creditos} créditos`)?.price).toBe(pk.precoBRL)
    expect((app.offers as { lowPrice: number }).lowPrice).toBe(0)
    expect((app.offers as { highPrice: number }).highPrice).toBe(PLANOS.studio.precoMensalBRL)
    expect(app['@type']).toContain('SoftwareApplication')
  })

  it('FAQPage reflete as perguntas da landing; a landing tem de 6 a 8 e nenhuma resposta vazia', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(6)
    expect(FAQ.length).toBeLessThanOrEqual(8)
    const faq = jsonLdFaq(FAQ)
    const itens = faq.mainEntity as { '@type': string; name: string; acceptedAnswer: { text: string } }[]
    expect(itens).toHaveLength(FAQ.length)
    for (const [i, q] of itens.entries()) {
      expect(q['@type']).toBe('Question')
      expect(q.name).toBe(FAQ[i]!.pergunta)
      expect(q.acceptedAnswer.text.length).toBeGreaterThan(40)
    }
    expect(FAQ.map((q) => q.pergunta).join(' ')).toMatch(/Gamma/)
    expect(FAQ_PRECOS.length).toBeGreaterThanOrEqual(4)
  })

  it('a resposta de preço usa os números de lib/planos.ts', () => {
    const preco = FAQ.find((q) => /custa/i.test(q.pergunta))!.resposta
    expect(preco).toContain(`R$${PLANOS.plus.precoMensalBRL}`)
    expect(preco).toContain(`R$${PLANOS.pro.precoMensalBRL}`)
    expect(preco).toContain(`${PLANOS.free.creditos.quantidade} créditos`)
    for (const pk of PACOTES_AVULSOS) expect(preco).toContain(`${pk.creditos} créditos por R$${pk.precoBRL}`)
  })

  it('Breadcrumb, WebPage, WebSite e Organization têm ids e URLs absolutas', () => {
    const trilha = jsonLdBreadcrumb([{ nome: 'Início', caminho: '/' }, { nome: 'Preços', caminho: '/precos' }])
    const itens = trilha.itemListElement as { position: number; item: string }[]
    expect(itens.map((i) => i.item)).toEqual([`${ORIGEM_SITE}/`, `${ORIGEM_SITE}/precos`])
    expect(itens.map((i) => i.position)).toEqual([1, 2])
    expect(jsonLdWebPage('/precos')).toMatchObject({ '@type': 'WebPage', url: `${ORIGEM_SITE}/precos`, inLanguage: 'pt-BR' })
    expect(jsonLdOrganizacao()).toMatchObject({ '@type': 'Organization', url: ORIGEM_SITE })
    expect(jsonLdOrganizacao()).not.toHaveProperty('sameAs') // sem perfis inventados
    expect(jsonLdWebSite()).toMatchObject({ '@type': 'WebSite', url: ORIGEM_SITE })
  })

  it('o grafo serializado é JSON válido, com @context, e escapa "<" para não fechar o <script>', () => {
    const texto = serializarJsonLd(grafoJsonLd([jsonLdOrganizacao(), jsonLdFaq([{ pergunta: 'a <b>?', resposta: '</script>' }])]))
    expect(texto).not.toContain('<')
    const obj = JSON.parse(texto) as { '@context': string; '@graph': unknown[] }
    expect(obj['@context']).toBe('https://schema.org')
    expect(obj['@graph']).toHaveLength(2)
  })
})

describe('comparativo e llms.txt', () => {
  it('o comparativo tem uma coluna por concorrente e a do Mostra nunca fica "a confirmar"', () => {
    for (const linha of COMPARATIVO) {
      expect(linha.valores).toHaveLength(CONCORRENTES.length)
      expect(linha.valores[0]).not.toBe('a confirmar')
    }
  })

  it('llms.txt segue o padrão (H1, citação, seções e links absolutos) e traz os números dos planos', () => {
    const curto = llmsTxt()
    expect(curto.startsWith('# Mostra\n\n> ')).toBe(true)
    expect(curto).toContain('## Páginas')
    expect(curto).toContain(`${ORIGEM_SITE}/precos`)
    expect(curto).toContain(`R$ ${PLANOS.plus.precoMensalBRL}`)
    expect(curto).toContain('1 crédito = 1 tela')
    const completo = llmsFullTxt()
    expect(completo).toContain('| Plano |')
    for (const p of Object.values(PLANOS)) expect(completo).toContain(`| ${p.nome} |`)
    for (const q of FAQ) expect(completo).toContain(`### ${q.pergunta}`)
    expect(completo).toContain('| Critério | Mostra | Gamma | Pitch | Canva |')
  })
})
