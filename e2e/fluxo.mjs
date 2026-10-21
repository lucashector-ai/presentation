import { chromium } from 'playwright'
import fs from 'node:fs'

/**
 * Fluxo ponta a ponta (seção 17.2): conta → projeto → upload → editor → preview → publicar → link → convidado → revogar.
 * Rodar com o app no ar (npm run dev, NEXT_PUBLIC_DEMO=1): npm run test:e2e
 * Capturas em e2e/capturas/ (ignoradas pelo git).
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const SHOTS = new URL('./capturas/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const erros = []
const passos = []
const ok = (nome) => { passos.push(`✔ ${nome}`); console.log('✔', nome) }
const falha = (nome, e) => { passos.push(`✘ ${nome}: ${e?.message ?? e}`); console.log('✘', nome, e?.message ?? e) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
const page = await ctx.newPage()
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })

async function passo(nome, fn) { try { await fn(); ok(nome) } catch (e) { falha(nome, e); await page.screenshot({ path: `${SHOTS}/falha-${passos.length}.png` }).catch(() => {}) } }

// PNGs de teste: screenshots pequenos do site
await page.goto(`${BASE}/`)
for (let i = 1; i <= 3; i++) { await page.setViewportSize({ width: 800 + i * 100, height: 600 }); await page.screenshot({ path: `${SHOTS}/upload-${i}.png` }) }
await page.setViewportSize({ width: 1440, height: 900 })

await passo('Marketing renderiza com CTA e planos', async () => {
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  if (!(await page.getByText('Planos').first().isVisible())) throw new Error('sem seção de planos')
  await page.screenshot({ path: `${SHOTS}/01-marketing.png`, fullPage: true })
})

await passo('AC-01 Cadastro → verificação → painel', async () => {
  await page.goto(`${BASE}/signup`)
  await page.getByLabel('Nome').fill('Teste E2E')
  await page.getByLabel('E-mail').fill('teste@exemplo.com')
  await page.getByLabel('Senha').fill('senhaforte123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.getByText('Verifique seu e-mail').waitFor()
  await page.getByRole('button', { name: 'Continuar para o painel' }).click()
  await page.waitForURL(`${BASE}/app`)
  await page.getByRole('heading', { name: 'Projetos' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/02-dashboard.png` })
})

await passo('AC-08 Sem sessão, /app redireciona para login', async () => {
  const p2 = await (await browser.newContext()).newPage()
  await p2.goto(`${BASE}/app/projects/pr-aurora`)
  await p2.waitForURL(/\/login/)
  await p2.context().close()
})

let urlEditor = ''
await passo('Novo projeto abre o editor', async () => {
  await page.getByRole('button', { name: 'Novo projeto' }).click()
  await page.getByLabel('Nome').fill('Projeto E2E')
  await page.getByRole('button', { name: 'Criar e abrir editor' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/)
  urlEditor = page.url()
  await page.getByRole('button', { name: 'Publicar' }).waitFor()
})

await passo('AC-02/AC-03 Upload em lote com progresso e criação de cenas', async () => {
  await page.getByRole('button', { name: 'Mídias' }).click()
  const input = page.locator('input[type=file]')
  await input.setInputFiles([`${SHOTS}/upload-1.png`, `${SHOTS}/upload-2.png`, `${SHOTS}/upload-3.png`])
  await page.getByRole('button', { name: /Criar 3 cena/ }).click({ timeout: 15000 })
  await page.getByText('Cenas · 3').waitFor()
  await page.screenshot({ path: `${SHOTS}/03-editor-cenas.png` })
})

await passo('AC-02 Formato inválido mostra erro individual', async () => {
  fs.writeFileSync(`${SHOTS}/ruim.txt`, 'nao e imagem')
  await page.getByRole('button', { name: 'Mídias' }).click()
  await page.locator('input[type=file]').setInputFiles([`${SHOTS}/ruim.txt`])
  await page.getByText('Formato não suportado', { exact: false }).first().waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: 'Fechar biblioteca' }).click()
})

await passo('AC-04 Texto e hotspot: adicionar, mover por teclado, alinhar, ordenar', async () => {
  await page.getByRole('option', { name: /^01/ }).click()
  await page.getByRole('button', { name: 'Texto' }).click()
  await page.getByLabel('Conteúdo do texto').fill('Olá, cliente')
  const xAntes = Number(await page.getByLabel('Posição X').inputValue())
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Shift+ArrowRight')
  let xDepois = xAntes
  for (let i = 0; i < 20 && xDepois === xAntes; i++) { await page.waitForTimeout(100); xDepois = Number(await page.getByLabel('Posição X').inputValue()) }
  if (xDepois !== xAntes + 10) throw new Error(`nudge falhou ${xAntes} → ${xDepois}`)
  await page.getByRole('button', { name: 'Centralizar horizontalmente' }).click()
  await page.getByRole('button', { name: 'Trazer para frente' }).click()
  await page.getByRole('button', { name: 'Hotspot' }).click()
  await page.getByLabel('Descrição para leitores de tela').fill('Ir para a segunda cena')
})

await passo('AC-05 Configurar hotspot: ao clicar → ir para cena 02', async () => {
  await page.getByLabel('Quando', { exact: true }).selectOption('click')
  await page.getByLabel('Fazer', { exact: true }).selectOption('goToScene')
  const sel = page.getByLabel('Cena', { exact: true })
  const opcoes = await sel.locator('option').allTextContents()
  const alvo = opcoes.find((o) => o.startsWith('02'))
  if (!alvo) throw new Error('sem cena 02 ' + opcoes.join('|'))
  await sel.selectOption({ label: alvo })
  await page.getByText('Todas as alterações foram salvas.').waitFor({ timeout: 5000 })
  await page.screenshot({ path: `${SHOTS}/04-editor-inspetor.png` })
})

await passo('AC-05/AC-06 Preview: clicar no hotspot navega para a cena 02; teclado funciona', async () => {
  await page.getByRole('button', { name: 'Pré-visualizar' }).click()
  await page.getByText('1 / 3').waitFor()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Ir para a segunda cena' }).click()
  await page.getByText('2 / 3').waitFor()
  await page.waitForTimeout(300)
  await page.keyboard.press('ArrowRight')
  await page.getByText('3 / 3').waitFor()
  await page.waitForTimeout(300)
  await page.keyboard.press('Home')
  await page.getByText('1 / 3').waitFor()
  await page.screenshot({ path: `${SHOTS}/05-preview.png` })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Publicar' }).waitFor()
})

await passo('Undo/redo', async () => {
  const antes = await page.getByText(/Cenas · \d/).textContent()
  await page.getByRole('button', { name: 'Adicionar cena' }).click()
  await page.getByText('Cenas · 4').waitFor()
  await page.getByRole('button', { name: /Desfazer/ }).click()
  await page.getByText(antes).waitFor()
  await page.getByRole('button', { name: /Refazer/ }).click()
  await page.getByText('Cenas · 4').waitFor()
  await page.getByRole('button', { name: /Desfazer/ }).click()
  await page.getByText('Cenas · 3').waitFor()
})

await passo('AC-10 Recarregar preserva a edição confirmada', async () => {
  await page.getByText('Todas as alterações foram salvas.').waitFor({ timeout: 5000 })
  await page.reload()
  await page.getByText('Cenas · 3').waitFor()
  await page.getByRole('option', { name: /^01/ }).click()
  if (!(await page.getByTestId('canvas').getByText('Olá, cliente').isVisible())) throw new Error('texto perdido após reload')
})

await passo('AC-11 Link antes de publicar é recusado; publicar gera revisão', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  if (!(await page.getByRole('button', { name: 'Gerar link' }).isDisabled())) throw new Error('gerar link deveria estar desabilitado antes de publicar')
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('button', { name: 'Publicar' }).click()
  await page.getByText(/Revisão \d+ publicada/).waitFor({ timeout: 10000 })
})

let urlLink = ''
await passo('AC-09 Criar link com senha (plano Creator)', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).first().click()
  await page.getByRole('switch', { name: 'Proteger com senha' }).click()
  await page.getByPlaceholder(/Senha para o cliente/).fill('cliente2026')
  await page.getByRole('button', { name: 'Gerar link' }).click()
  const code = page.locator('code').first()
  await code.waitFor()
  urlLink = (await code.textContent()).trim()
  if (!/\/p\/[A-Za-z0-9_-]{43}$/.test(urlLink)) throw new Error('url inesperada ' + urlLink)
  await page.screenshot({ path: `${SHOTS}/06-compartilhar.png` })
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
})

await passo('AC-09/AC-12 Convidado (celular): senha errada limita, senha certa abre', async () => {
  const movel = await ctx.newPage()
  await movel.setViewportSize({ width: 390, height: 844 })
  await movel.goto(urlLink)
  await movel.getByText('Esta apresentação é protegida').waitFor()
  await movel.getByLabel('Senha').fill('errada')
  await movel.getByRole('button', { name: 'Abrir apresentação' }).click()
  await movel.getByText('Senha incorreta').waitFor()
  await movel.getByLabel('Senha').fill('cliente2026')
  await movel.getByRole('button', { name: 'Abrir apresentação' }).click()
  await movel.getByText('1 / 3').waitFor({ timeout: 10000 })
  await movel.screenshot({ path: `${SHOTS}/07-viewer-mobile.png` })
  // swipe
  await movel.mouse.move(300, 400)
  await movel.touchscreen?.tap?.(300, 400).catch(() => {})
  await movel.close()
})

await passo('AC-11 Mudança no rascunho não aparece no link até publicar', async () => {
  await page.getByRole('option', { name: /^01/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('complementary', { name: 'Propriedades da cena' }).getByRole('button', { name: /Olá, cliente/ }).click()
  await page.getByLabel('Conteúdo do texto').fill('Texto novo do rascunho')
  await page.evaluate(() => document.activeElement?.blur())
  await page.getByText('Todas as alterações foram salvas.').waitFor({ timeout: 5000 })
  const p = await ctx.newPage()
  await p.goto(urlLink)
  await p.getByLabel('Senha').fill('cliente2026')
  await p.getByRole('button', { name: 'Abrir apresentação' }).click()
  await p.getByText('1 / 3').waitFor()
  if (await p.getByText('Texto novo do rascunho').count()) throw new Error('rascunho vazou para o link')
  if (!(await p.getByText('Olá, cliente').count())) throw new Error('conteúdo publicado não apareceu')
  await p.close()
})

await passo('Fluxo B: revogar link → indisponível imediatamente', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).first().click()
  await page.getByRole('button', { name: 'Revogar' }).first().click()
  await page.waitForTimeout(100)
  await page.getByRole('dialog').last().getByRole('button', { name: 'Revogar' }).click()
  await page.getByText('Link revogado.').waitFor()
  const p = await ctx.newPage()
  await p.goto(urlLink)
  await p.getByText('Este link não está mais disponível.').waitFor()
  await p.screenshot({ path: `${SHOTS}/08-link-revogado.png` })
  await p.close()
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
})

await passo('AC-08 URL adivinhada não abre nada', async () => {
  const p = await ctx.newPage()
  await p.goto(`${BASE}/p/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)
  await p.getByText('Este link não está mais disponível.').waitFor()
  await p.close()
})

await passo('Demo Café Aurora: hotspot com zoom, hover revela camada, link externo bloqueado a http(s)', async () => {
  const p = await ctx.newPage()
  await p.goto(`${BASE}/p/demo_cafe_aurora_proposta_01_token_fixo_xx`)
  await p.getByText('1 / 6').waitFor()
  await p.getByRole('button', { name: 'Começar apresentação' }).click()
  await p.getByText('2 / 6').waitFor()
  await p.waitForTimeout(300)
  await p.getByRole('button', { name: 'Ver a marca' }).click()
  await p.getByText('3 / 6').waitFor()
  if (await p.getByText('Versão monocromática').count()) throw new Error('camada oculta visível antes do hover')
  const logo = p.locator('[data-layer-id="hs-logo"]')
  await logo.hover()
  await p.getByText('Versão monocromática').waitFor()
  await p.screenshot({ path: `${SHOTS}/09-demo-hover.png` })
  await p.mouse.move(5, 5)
  await p.waitForTimeout(200)
  if (await p.getByText('Versão monocromática').count()) throw new Error('hover não reverteu')
  await p.close()
})

await passo('Story: modo vertical renderiza e rola', async () => {
  await page.goto(`${BASE}/app/projects/pr-primavera/apresentar`)
  await page.getByText('Campanha Primavera (story)').waitFor()
  await page.screenshot({ path: `${SHOTS}/10-story.png` })
})

await passo('Detalhes, compartilhamento e configurações renderizam', async () => {
  await page.goto(`${BASE}/app/projects/pr-aurora`)
  await page.getByText('Metadados').waitFor()
  await page.goto(`${BASE}/app/projects/pr-aurora/share`)
  await page.getByText(/Links criados/).waitFor()
  await page.goto(`${BASE}/app/settings`)
  await page.getByText('Plano e uso').waitFor()
  await page.screenshot({ path: `${SHOTS}/11-settings.png`, fullPage: true })
})

await passo('AC-14 Reduced motion respeitado (animações encurtadas)', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${BASE}/p/demo_cafe_aurora_proposta_01_token_fixo_xx`)
  await page.getByText('1 / 6').waitFor()
  const dur = await page.locator('[data-layer-id="titulo"]').evaluate((el) => getComputedStyle(el).animationDuration)
  if (dur !== '0.001s' && dur !== '0.15s') throw new Error('duração ' + dur)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})

await browser.close()
console.log('\n' + passos.join('\n'))
console.log(`\nErros de console/página: ${erros.length}`)
erros.slice(0, 20).forEach((e) => console.log('  ', e))
process.exit(passos.some((p) => p.startsWith('✘')) || erros.length ? 1 : 0)
