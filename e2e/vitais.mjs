/**
 * Core Web Vitals básicos das páginas públicas, medidos no navegador (PerformanceObserver) com o Playwright, em
 * celular (390 px) e desktop (1440 px): TTFB, FCP, LCP, CLS, peso transferido e número de pedidos. Não substitui o
 * Lighthouse nem o CrUX (dados de campo); serve para pegar regressões antes do deploy. Os números do dia ficam em
 * docs/marketing/seo-geo.md.
 * Rodar com o preview no ar: E2E_BASE_URL=http://localhost:8854 node e2e/vitais.mjs
 */
import { chromium } from 'playwright'

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const PAGINAS = ['/', '/precos', '/apresentacao-com-ia']
const TELAS = [{ nome: 'celular', viewport: { width: 390, height: 844 }, mobile: true }, { nome: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false }]
const RODADAS = Number(process.env.RODADAS || 3)

const browser = await chromium.launch()
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const fmt = (n, casas = 0) => (n == null ? '—' : n.toFixed(casas))

console.log('| Página | Tela | TTFB | FCP | LCP | CLS | Pedidos | Transferido |')
console.log('|---|---|---|---|---|---|---|---|')
for (const tela of TELAS) {
  for (const caminho of PAGINAS) {
    const medidas = []
    for (let i = 0; i < RODADAS; i++) {
      const ctx = await browser.newContext({ viewport: tela.viewport, isMobile: tela.mobile, deviceScaleFactor: tela.mobile ? 3 : 1, locale: 'pt-BR' })
      const page = await ctx.newPage()
      let bytes = 0, pedidos = 0
      page.on('response', async (r) => { pedidos++; const t = Number(r.headers()['content-length']); if (t) bytes += t; else { try { bytes += (await r.body()).length } catch {} } })
      await page.addInitScript(() => {
        window.__vitais = { lcp: 0, cls: 0 }
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vitais.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__vitais.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
      })
      await page.goto(`${BASE}${caminho}`, { waitUntil: 'networkidle' })
      // rolagem até o fim e volta: o CLS acumula a página inteira (o LCP já ficou travado na primeira interação)
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } window.scrollTo(0, 0) })
      await page.waitForTimeout(400)
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0]
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime
        return { ttfb: nav?.responseStart, fcp, lcp: window.__vitais.lcp, cls: window.__vitais.cls, dom: nav?.domContentLoadedEventEnd }
      })
      medidas.push({ ...m, pedidos, bytes })
      await ctx.close()
    }
    const med = (k) => mediana(medidas.map((x) => x[k]))
    console.log(`| ${caminho} | ${tela.nome} | ${fmt(med('ttfb'))} ms | ${fmt(med('fcp'))} ms | ${fmt(med('lcp'))} ms | ${fmt(med('cls'), 3)} | ${fmt(med('pedidos'))} | ${fmt(med('bytes') / 1024)} KB |`)
  }
}
await browser.close()
console.log(`\nMediana de ${RODADAS} carregamentos, cache frio, sem limitação de rede ou CPU (preview local: o TTFB real na borda será outro).`)
