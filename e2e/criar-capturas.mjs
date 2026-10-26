// Capturas do fluxo novo do Criar com IA (modo demo). Uso: node telas.mjs <base> <pasta>
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:8797'
const OUT = process.argv[3]
const erros = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
const page = await ctx.newPage()
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })

const logo = `${OUT}/logo-aurora.svg`
fs.writeFileSync(logo, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120"><circle cx="60" cy="60" r="44" fill="#E4572E"/><rect x="38" y="38" width="44" height="44" rx="6" fill="#1F3B4D"/><path d="M130 88 L160 30 L190 88 Z" fill="#1F3B4D"/><rect x="205" y="34" width="22" height="54" fill="#E4572E"/><rect x="240" y="34" width="140" height="22" rx="11" fill="#1F3B4D"/><rect x="240" y="66" width="100" height="22" rx="11" fill="#F2C14E"/></svg>')
// duas "fotos" próprias (gradientes com uma forma), para os espaços de imagem
for (const [i, cores] of [[1, '#F2C14E,#E4572E'], [2, '#1F3B4D,#5DA9E9']]) {
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 800, height: 600 })
  await p.setContent(`<body style="margin:0;height:100vh;background:linear-gradient(135deg,${cores});display:flex;align-items:center;justify-content:center"><div style="width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.35)"></div></body>`)
  await p.screenshot({ path: `${OUT}/foto-${i}.png` })
  await p.close()
}
const shot = async (nome, full = false) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/criar-${nome}.png`, fullPage: full }) }

await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
await page.getByLabel('Nome').fill('Ana Teste')
await page.getByLabel('E-mail').fill('ana@exemplo.com')
await page.getByLabel('Senha').fill('senhaforte123')
await page.getByRole('button', { name: 'Criar conta' }).click()
await page.getByRole('button', { name: 'Continuar para o painel' }).click()
await page.waitForURL(`${BASE}/app`)
await page.screenshot({ path: `${OUT}/criar-0-painel.png` })

await page.goto(`${BASE}/app/criar`, { waitUntil: 'networkidle' })
await page.locator('#criar-prompt').fill('Pitch da Aurora, startup de energia solar por assinatura para pequenos comércios, buscando rodada seed')
await page.getByLabel('Para quem').fill('investidores-anjo')
await shot('1-briefing')
await page.getByRole('button', { name: 'Enviar' }).click()
await page.getByRole('heading', { name: 'Decisões antes do plano' }).waitFor({ timeout: 15000 })
await page.getByLabel('Arquivo do logo').setInputFiles(logo)
await page.getByText('Paletas do seu logo').waitFor({ timeout: 15000 })
await page.getByLabel('Nome da marca').fill('Aurora')
await page.getByRole('radio', { name: 'Space Grotesk + Geist' }).click()
await shot('2-marca', true)
// volta às fontes de cada estilo: as capturas de estilo mostram a tipografia própria de cada um
await page.getByRole('radio', { name: 'Aa Do estilo (automático)' }).click()
await page.getByRole('button', { name: 'Salvar como kit de marca' }).click()
await page.getByText('Kits de marca salvos').waitFor()
await page.getByRole('tab', { name: 'Material' }).click()
await page.getByRole('textbox', { name: 'Números-chave' }).fill('38% | mais clientes atendidos\nR$ 1,2 mi | de receita recorrente\n6 semanas | até o lançamento')
await page.getByRole('textbox', { name: 'O que não pode faltar' }).fill('modelo de assinatura; economia na conta de luz')
await page.locator('input[aria-label="Fotos próprias"]').setInputFiles([`${OUT}/foto-1.png`, `${OUT}/foto-2.png`])
await page.getByRole('textbox', { name: 'Legenda da foto 2' }).waitFor({ timeout: 15000 })
await page.getByRole('textbox', { name: 'Legenda da foto 1' }).fill('Painéis no telhado de uma padaria')
await page.getByRole('textbox', { name: 'Legenda da foto 2' }).fill('App mostrando a economia do mês')
await shot('3-material', true)
await page.getByRole('tab', { name: 'Estilos' }).click()
await page.getByRole('radio', { name: 'Suíço' }).click()
await shot('4-estilo', true)
await page.getByRole('tab', { name: 'Decisões' }).click()
await page.getByRole('radio', { name: '20 telas', exact: true }).click()
await shot('5-tamanho')
await page.getByRole('button', { name: 'Criar o plano →' }).click()
await page.getByText('Plano · 20 telas').waitFor({ timeout: 60000 })
await shot('7-roteiro')
await page.getByRole('button', { name: 'Gerar apresentação' }).click()
await page.getByText('Pronto · 20 telas').waitFor({ timeout: 90000 })
await page.waitForTimeout(1500)
await shot('8-design', true)
for (const [nome, id] of [['Suíço', 'suico'], ['Luxo', 'luxo'], ['Neo-Memphis', 'memphis'], ['Vidro', 'vidro'], ['Brutalista', 'brutalista']]) {
  await page.getByRole('button', { name: /^Estilo/ }).click()
  await page.getByRole('radiogroup', { name: 'Trocar estilo' }).getByRole('radio', { name: nome }).click()
  await page.waitForTimeout(1200)
  await page.getByText('Pronto · 20 telas').waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/criar-estilo-${id}.png`, fullPage: true })
}
console.log('erros:', erros.length)
for (const e of erros.slice(0, 15)) console.log(' ', e)
await browser.close()
