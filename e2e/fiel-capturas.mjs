// Capturas do "Criar com IA" fiel ao pedido (modo demo), com o briefing real de lib/ia/fixtures/prompt-nexora-resultados.md:
// cartão do painel (desktop e celular), editor do pedido, marca com as cores do texto, roteiro, design e cada tela.
// Uso: node e2e/fiel-capturas.mjs <base> <pasta>
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:8805'
const OUT = process.argv[3] ?? new URL('./capturas/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const PEDIDO = fs.readFileSync(new URL('../lib/ia/fixtures/prompt-nexora-resultados.md', import.meta.url), 'utf8')
const erros = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
const page = await ctx.newPage()
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to fetch RSC payload')) erros.push(`console: ${m.text()}`) })
const shot = async (nome, full = false, p = page) => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/fiel-${nome}.png`, fullPage: full }) }

await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
await page.getByLabel('Nome').fill('Ana Teste')
await page.getByLabel('E-mail').fill('ana@exemplo.com')
await page.getByLabel('Senha').fill('senhaforte123')
await page.getByRole('button', { name: 'Criar conta' }).click()
await page.getByRole('button', { name: 'Continuar para o painel' }).click()
await page.waitForURL(`${BASE}/app`)
await page.locator('#painel-ideia').waitFor()
await shot('1-painel')
const cartao = page.locator('form', { has: page.locator('#painel-ideia') })
await cartao.screenshot({ path: `${OUT}/fiel-1-cartao.png` })
for (const w of [390, 768, 1024]) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(300)
  await cartao.screenshot({ path: `${OUT}/fiel-1-cartao-${w}.png` })
}
await page.setViewportSize({ width: 1440, height: 900 })

// o briefing inteiro no editor do Criar com IA (colado no cartão do painel: vai inteiro para lá)
await page.locator('#painel-ideia').focus()
await page.evaluate((t) => {
  const el = document.querySelector('#painel-ideia')
  const dt = new DataTransfer()
  dt.setData('text/plain', t)
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
}, PEDIDO)
await page.waitForURL(/\/app\/criar\?colado=1/)
await page.locator('#criar-prompt').waitFor()
await page.waitForFunction((n) => document.querySelector('#criar-prompt')?.value.length >= n, PEDIDO.trim().length - 5)
await shot('2-editor')
await page.locator('#criar-prompt').evaluate((el) => { el.scrollTop = el.scrollHeight })
await shot('2-editor-rolado')
await page.getByRole('button', { name: 'Continuar →' }).click()
await page.getByRole('heading', { name: 'A sua marca, antes de gerar' }).waitFor()
await shot('3-marca', true)
await page.getByRole('button', { name: 'Ir para revisar' }).click()
await page.getByRole('heading', { name: 'Revisar e gerar' }).waitFor()
await shot('4-revisar', true)
await page.getByRole('button', { name: 'Gerar roteiro →' }).click()
await page.getByText(/Roteiro · \d+ telas/).waitFor({ timeout: 60000 })
await shot('5-roteiro', true)
await page.getByRole('button', { name: 'Gerar apresentação' }).click()
await page.getByText(/Pronto · \d+ telas/).waitFor({ timeout: 90000 })
await page.waitForTimeout(1500)
await shot('6-design', true)
await page.getByText('Salvando o projeto…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})

// cada tela no visualizador, em 1920 × 1080
await page.getByRole('button', { name: 'Apresentar' }).click()
await page.setViewportSize({ width: 1920, height: 1080 })
await page.locator('.viewer-controles').waitFor({ timeout: 20000 })
const total = Number((await page.locator('.viewer-controles').innerText()).match(/\/\s*(\d+)/)?.[1] ?? 0)
for (let i = 1; i <= total; i++) {
  await page.waitForTimeout(2600)
  await page.mouse.move(5, 5)
  await page.screenshot({ path: `${OUT}/fiel-tela-${String(i).padStart(2, '0')}.png` })
  if (i < total) await page.keyboard.press('ArrowRight')
}
console.log('telas:', total)
console.log('erros:', erros.length)
for (const e of erros.slice(0, 15)) console.log(' ', e)
await browser.close()
process.exit(erros.length ? 1 : 0)
