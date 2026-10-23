/**
 * Capturas claro/escuro das telas principais (landing, login, painel, Criar com IA, editor, visualizador, Plano e conta)
 * em 1440 e 390. Rodar com o preview demo no ar: E2E_BASE_URL=http://localhost:8855 SAIDA=/pasta node e2e/tema-capturas.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:8855'
const DIR = process.env.SAIDA || new URL('./capturas/tema/', import.meta.url).pathname
fs.mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch()
const erros = []
const TELAS = [
  ['landing', '/', 'h1'],
  ['login', '/login', 'form'],
  ['painel', '/app', 'h1'],
  ['criar-ia', '/app/criar', '[aria-label="Passos"]'],
  ['editor', '/app/projects/pr-atlas/edit', '[data-testid="canvas"]'],
  ['visualizador', '/p/demo_cafe_aurora_proposta_01_token_fixo_xx', '.viewer-controles'],
  ['plano-conta', '/app/settings', '#preferencias'],
]
for (const tema of ['claro', 'escuro']) {
  for (const [largura, altura] of [[1440, 900], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, locale: 'pt-BR', deviceScaleFactor: 1 })
    await ctx.addInitScript((t) => { localStorage.setItem('tema', t); localStorage.setItem('apresentacoes.sessao', JSON.stringify({ email: 'demo@mostra.app', em: Date.now() })) }, tema)
    await ctx.addCookies([{ name: 'tema', value: tema, url: BASE }])
    const page = await ctx.newPage()
    page.on('pageerror', (e) => erros.push(`${tema}/${largura}: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') erros.push(`${tema}/${largura} console: ${m.text()}`) })
    for (const [nome, rota, espera] of TELAS) {
      try {
        await page.goto(`${BASE}${rota}`, { waitUntil: 'networkidle' })
        await page.locator(espera).first().waitFor({ timeout: 20000 })
        await page.waitForTimeout(700)
        const info = await page.evaluate(() => ({ tema: document.documentElement.dataset.tema, fundo: getComputedStyle(document.body).backgroundColor }))
        console.log(`${tema} ${largura} ${nome}: data-tema=${info.tema} body=${info.fundo}`)
        await page.screenshot({ path: `${DIR}/${nome}-${tema}-${largura}.png`, fullPage: nome === 'landing' || nome === 'plano-conta' })
      } catch (e) { erros.push(`${tema}/${largura} ${nome}: ${e.message}`); await page.screenshot({ path: `${DIR}/${nome}-${tema}-${largura}-falha.png` }).catch(() => {}) }
    }
    await ctx.close()
  }
}
await browser.close()
console.log(erros.length ? `\nErros (${erros.length}):\n${erros.join('\n')}` : '\nSem erros')
