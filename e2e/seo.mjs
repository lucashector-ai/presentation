/**
 * SEO e GEO contra um servidor no ar (preview do Worker ou dev): status e content-type de robots, sitemap, llms,
 * og.png e das páginas públicas; metadados do HTML (title, description, canonical, Open Graph, Twitter, lang,
 * noindex onde deve); JSON-LD lido com um parser de verdade (JSON.parse de cada <script type=application/ld+json>).
 * Rodar: E2E_BASE_URL=http://localhost:8854 node e2e/seo.mjs
 */
const BASE = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const erros = []
const ok = (nome) => console.log('✔', nome)
const falha = (nome, detalhe) => { erros.push(`${nome}: ${detalhe}`); console.log('✘', nome, detalhe) }
const confere = (nome, cond, detalhe = '') => (cond ? ok(nome) : falha(nome, detalhe))

const meta = (html, re) => { const m = html.match(re); return m ? m[1] : null }
const propriedade = (html, prop) => meta(html, new RegExp(`<meta[^>]+(?:property|name)="${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]+content="([^"]*)"`, 'i')) ?? meta(html, new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i'))
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))

async function pegar(caminho) {
  const r = await fetch(`${BASE}${caminho}`, { redirect: 'manual' })
  return { status: r.status, tipo: r.headers.get('content-type') ?? '', corpo: caminho.endsWith('.png') ? Buffer.from(await r.arrayBuffer()) : await r.text(), cabecalhos: r.headers }
}

// ---------- arquivos de rastreamento ----------
{
  const r = await pegar('/robots.txt')
  confere('robots.txt 200 text/plain', r.status === 200 && /^text\/plain/.test(r.tipo), `${r.status} ${r.tipo}`)
  confere('robots.txt bloqueia /app/, /api/, /p/ e aponta o sitemap', /Disallow: \/app\//.test(r.corpo) && /Disallow: \/api\//.test(r.corpo) && /Disallow: \/p\//.test(r.corpo) && /Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/.test(r.corpo), r.corpo.slice(0, 200))
  confere('robots.txt libera robôs de IA', ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Bingbot', 'CCBot'].every((b) => r.corpo.includes(`User-Agent: ${b}`)), r.corpo)
  confere('robots.txt não bloqueia /precos nem /apresentacao-com-ia', !/Disallow: \/p\n/.test(r.corpo) && !/Disallow: \/app\n/.test(r.corpo))
}
{
  const r = await pegar('/sitemap.xml')
  confere('sitemap.xml 200 application/xml', r.status === 200 && /xml/.test(r.tipo), `${r.status} ${r.tipo}`)
  const locs = [...r.corpo.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  confere('sitemap lista as páginas públicas com URL absoluta', locs.length >= 3 && locs.every((l) => /^https?:\/\//.test(l)) && locs.some((l) => l.endsWith('/precos')) && locs.some((l) => l.endsWith('/apresentacao-com-ia')), locs.join(', '))
  confere('sitemap não lista rotas privadas', !locs.some((l) => /\/(app|api|p|criar)(\/|$)/.test(new URL(l).pathname)))
}
for (const caminho of ['/llms.txt', '/llms-full.txt']) {
  const r = await pegar(caminho)
  confere(`${caminho} 200 text/plain`, r.status === 200 && /^text\/plain/.test(r.tipo), `${r.status} ${r.tipo}`)
  confere(`${caminho} começa com "# Mostra" e tem planos`, r.corpo.startsWith('# Mostra') && /Plus/.test(r.corpo) && /cr[ée]dito/.test(r.corpo))
}
{
  const r = await pegar('/og.png')
  confere('og.png 200 image/png', r.status === 200 && /^image\/png/.test(r.tipo), `${r.status} ${r.tipo}`)
  // IHDR: largura e altura nos bytes 16–23
  const png = r.corpo
  const largura = png.readUInt32BE(16), altura = png.readUInt32BE(20)
  confere('og.png tem 1200×630', png.subarray(1, 4).toString() === 'PNG' && largura === 1200 && altura === 630, `${largura}×${altura}`)
}

// ---------- páginas públicas ----------
const PUBLICAS = [
  { caminho: '/', titulo: /Mostra/, tipos: ['Organization', 'WebSite', 'SoftwareApplication', 'WebPage', 'FAQPage'] },
  { caminho: '/precos', titulo: /Planos e preços · Mostra/, tipos: ['BreadcrumbList', 'WebPage', 'SoftwareApplication', 'FAQPage'] },
  { caminho: '/apresentacao-com-ia', titulo: /apresentação com IA · Mostra/i, tipos: ['BreadcrumbList', 'WebPage', 'HowTo', 'FAQPage'] },
  { caminho: '/signup', titulo: /Criar conta grátis · Mostra/, tipos: [], h1Opcional: true },
]
for (const p of PUBLICAS) {
  const r = await pegar(p.caminho)
  const html = r.corpo
  confere(`${p.caminho} 200 text/html`, r.status === 200 && /^text\/html/.test(r.tipo), `${r.status} ${r.tipo}`)
  confere(`${p.caminho} lang="pt-BR"`, /<html[^>]+lang="pt-BR"/.test(html))
  const titulo = meta(html, /<title>([^<]*)<\/title>/)
  confere(`${p.caminho} <title> "${titulo}"`, titulo && p.titulo.test(titulo) && titulo.length <= 70, titulo)
  const descricao = propriedade(html, 'description')
  confere(`${p.caminho} meta description (${descricao?.length ?? 0} caracteres)`, descricao && descricao.length >= 70 && descricao.length <= 200, descricao)
  const canonico = meta(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) ?? meta(html, /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/)
  confere(`${p.caminho} canonical absoluto "${canonico}"`, canonico && /^https?:\/\/[^/]+/.test(canonico) && new URL(canonico).pathname === p.caminho, canonico)
  confere(`${p.caminho} indexável`, !/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html), 'tem noindex')
  const og = { title: propriedade(html, 'og:title'), description: propriedade(html, 'og:description'), image: propriedade(html, 'og:image'), url: propriedade(html, 'og:url'), type: propriedade(html, 'og:type'), locale: propriedade(html, 'og:locale'), site: propriedade(html, 'og:site_name') }
  confere(`${p.caminho} Open Graph completo`, og.title && og.description && og.image && /\/og\.png$/.test(og.image) && og.url && new URL(og.url).pathname === p.caminho && og.type === 'website' && og.locale === 'pt_BR' && og.site === 'Mostra', JSON.stringify(og))
  confere(`${p.caminho} og:image com largura e altura`, propriedade(html, 'og:image:width') === '1200' && propriedade(html, 'og:image:height') === '630')
  confere(`${p.caminho} Twitter card`, propriedade(html, 'twitter:card') === 'summary_large_image' && !!propriedade(html, 'twitter:image') && !!propriedade(html, 'twitter:title'))
  // JSON-LD: cada bloco é JSON válido, com @context e os tipos esperados
  let nos = []
  try {
    const blocos = jsonLd(html)
    nos = blocos.flatMap((b) => (b['@graph'] ? b['@graph'] : [b]))
    confere(`${p.caminho} JSON-LD válido (${blocos.length} bloco, ${nos.length} nós)`, p.tipos.length === 0 || (blocos.length >= 1 && blocos.every((b) => b['@context'] === 'https://schema.org')), JSON.stringify(blocos).slice(0, 200))
  } catch (e) {
    falha(`${p.caminho} JSON-LD não é JSON`, e.message)
  }
  const tipos = nos.flatMap((n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]))
  for (const t of p.tipos) confere(`${p.caminho} JSON-LD tem ${t}`, tipos.includes(t), tipos.join(', '))
  const app = nos.find((n) => [].concat(n['@type']).includes('SoftwareApplication'))
  if (app) {
    const ofertas = app.offers?.offers ?? []
    confere(`${p.caminho} ofertas em BRL com preço numérico (${ofertas.length})`, ofertas.length >= 4 && ofertas.every((o) => o.priceCurrency === 'BRL' && typeof o.price === 'number'))
  }
  const faq = nos.find((n) => n['@type'] === 'FAQPage')
  if (faq) {
    const perguntas = faq.mainEntity ?? []
    confere(`${p.caminho} FAQPage com ${perguntas.length} perguntas e respostas no HTML`, perguntas.length >= 4 && perguntas.every((q) => q.acceptedAnswer?.text && html.includes(q.name.replace(/&/g, '&amp;'))), '')
  }
  // o formulário de cadastro é um componente de cliente dentro de Suspense: o h1 dele não vem no HTML do servidor
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length
  confere(`${p.caminho} um único <h1>`, h1s === 1 || (p.h1Opcional && h1s === 0), `${h1s} h1`)
  confere(`${p.caminho} preload da fonte`, /<link[^>]+rel="preload"[^>]+as="font"[^>]+\.woff2/.test(html) || /<link[^>]+as="font"[^>]+rel="preload"/.test(html))
}

// ---------- privadas: noindex ----------
for (const caminho of ['/login', '/p/demo_cafe_aurora_proposta_01_token_fixo_xx']) {
  const r = await pegar(caminho)
  const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(r.corpo) || /noindex/.test(r.cabecalhos.get('x-robots-tag') ?? '')
  confere(`${caminho} fora do índice (meta robots ou X-Robots-Tag)`, r.status === 200 && noindex, `${r.status} ${r.cabecalhos.get('x-robots-tag')}`)
}

console.log(erros.length ? `\n${erros.length} erro(s)` : '\nSEO: tudo verde')
process.exit(erros.length ? 1 : 0)
