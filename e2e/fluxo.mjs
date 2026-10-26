import { chromium } from 'playwright'
import fs from 'node:fs'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { jsPDF } from 'jspdf'
import { gerarManualFicticio } from '../lib/marca/fixtures/manual-ficticio.mjs'
import { distanciasForaDe8 } from '../lib/ia/distancias8.mjs'

/**
 * Fluxo ponta a ponta (seção 17.2): conta → projeto → upload → editor → preview → publicar → link → convidado → revogar
 * (e o Criar com IA: marca, manual da marca, material, estilos e geração).
 * Rodar com o app no ar (npm run dev, NEXT_PUBLIC_DEMO=1): npm run test:e2e
 * Outro endereço (ex.: o preview do Worker, npm run preview): E2E_BASE_URL=http://localhost:8787 npm run test:e2e
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
const vigiar = (p) => {
  p.on('pageerror', (e) => erros.push(`pageerror (${p.url()}): ${e.message}`))
  // "Failed to fetch RSC payload": o Next só registra isso quando o próprio teste navega (goto/reload) no meio de um
  // prefetch de link; ele cai para navegação normal e o usuário não vê nada. Qualquer outro erro continua contando.
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to fetch RSC payload')) erros.push(`console (${p.url()}): ${m.text()}`) })
}
ctx.on('page', vigiar)
const page = await ctx.newPage()

async function passo(nome, fn) {
  try { await fn(); ok(nome) } catch (e) { falha(nome, e); await page.screenshot({ path: `${SHOTS}/falha-${passos.length}.png` }).catch(() => {}) }
}

/** Espera um número no campo (os campos do inspetor atualizam depois do estado). */
async function esperarValor(loc, alvo, ms = 2000) {
  let v = Number(await loc.inputValue())
  for (let t = 0; t < ms && v !== alvo; t += 100) { await page.waitForTimeout(100); v = Number(await loc.inputValue()) }
  return v
}
/** O autosave tem debounce de 800 ms; espera o indicador do topo voltar a "Salvo". */
async function esperarSalvo(p = page) {
  await p.waitForTimeout(150)
  await p.locator('header [role=status]', { hasText: 'Todas as alterações foram salvas.' }).waitFor({ timeout: 8000 })
}
const telas = (p = page) => p.getByRole('listbox', { name: 'Telas' }).getByRole('option')
/** Escolhe um valor num menu suspenso do Mostra (botão combobox → lista em portal com data-valor). */
async function escolher(loc, valor, p = page) {
  await loc.click()
  await p.locator(`[role=listbox] [role=option][data-valor="${valor}"]`).click()
}
async function esperarTelas(n, p = page) {
  for (let t = 0; t < 5000; t += 100) { if ((await telas(p).count()) === n) return; await p.waitForTimeout(100) }
  throw new Error(`esperava ${n} telas, há ${await telas(p).count()}`)
}
/** Contador do visualizador ("01 / 03"), só dentro dos controles do viewer. */
const contador = (p, texto, raiz) => (raiz ?? p).locator('.viewer-controles').getByText(texto, { exact: true })
const pad = (n) => String(n).padStart(2, '0')
/** Espera o React hidratar o campo da home (ele marca os nós com __reactProps…). No dev do Vite os módulos chegam
 * um a um e isso demora; um screenshot no meio esconde o cursor com style inline e gera aviso de atributos divergentes. */
const esperarHidratacao = (p = page) =>
  p.waitForFunction(() => { const t = document.querySelector('textarea'); return !t || Object.keys(t).some((k) => k.startsWith('__react')) })

// PNGs de teste: screenshots pequenos do site
// (espera a hidratação: capturar a página no meio dela gera aviso de atributos divergentes)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await esperarHidratacao()
await page.waitForTimeout(500)
for (let i = 1; i <= 3; i++) { await page.setViewportSize({ width: 800 + i * 100, height: 600 }); await page.screenshot({ path: `${SHOTS}/upload-${i}.png` }) }
await page.setViewportSize({ width: 1440, height: 900 })

await passo('Marketing renderiza com CTA e planos', async () => {
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.locator('section#precos').waitFor()
  if (!(await page.locator('a[href^="/signup"]').count()) && !(await page.locator('a[href^="/criar"]').count())) throw new Error('sem CTA para cadastro/criação')
  await esperarHidratacao()
  await page.screenshot({ path: `${SHOTS}/01-marketing.png`, fullPage: true })
})

await passo('AC-01 Cadastro → verificação → painel', async () => {
  // networkidle: no dev do Vite os módulos chegam um a um e a hidratação atrasa; clicar antes envia o form nativo
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.getByLabel('Nome').fill('Teste E2E')
  await page.getByLabel('E-mail').fill('teste@exemplo.com')
  await page.getByLabel('Senha').fill('senhaforte123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.getByRole('heading', { name: 'Verifique seu e-mail' }).waitFor()
  await page.getByRole('button', { name: 'Continuar para o painel' }).click()
  await page.waitForURL(`${BASE}/app`)
  await page.getByRole('heading', { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), / }).waitFor()
  await page.getByRole('link', { name: 'Novo projeto' }).first().waitFor()
  const sessao = await page.evaluate(() => localStorage.getItem('apresentacoes.sessao'))
  if (!sessao || !sessao.includes('teste@exemplo.com')) throw new Error('sessão não gravada: ' + sessao)
  await page.screenshot({ path: `${SHOTS}/02-dashboard.png` })
})

await passo('AC-08 Sem sessão, /app redireciona para login', async () => {
  const c2 = await browser.newContext()
  const p2 = await c2.newPage()
  vigiar(p2)
  await p2.goto(`${BASE}/app/projects/pr-atlas`)
  await p2.waitForURL(/\/login/)
  await c2.close()
})

let urlEditorE2E = ''
await passo('Novo projeto (2 passos, com arquivos) abre o editor', async () => {
  await page.getByRole('link', { name: 'Novo projeto' }).first().click()
  await page.waitForURL(/\/app\/novo/)
  await page.getByText('Passo 1 de 2').waitFor()
  await page.getByLabel('Nome do projeto').fill('Projeto E2E')
  await page.getByRole('radiogroup', { name: 'Formato' }).getByRole('radio', { name: /^Slides/ }).click()
  await page.getByRole('button', { name: 'Importar arquivos' }).click()
  await page.getByText('Passo 2 de 2').waitFor()
  await page.locator('input[type=file]').setInputFiles([`${SHOTS}/upload-1.png`, `${SHOTS}/upload-2.png`, `${SHOTS}/upload-3.png`])
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Remover upload-${i}.png` }).waitFor()
  await page.getByText(/3 arquivo\(s\)/).waitFor()
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/, { timeout: 20000 })
  await page.getByRole('button', { name: 'Compartilhar' }).waitFor()
  if ((await page.getByLabel('Nome do projeto').inputValue()) !== 'Projeto E2E') throw new Error('nome do projeto não veio para o editor')
  urlEditorE2E = page.url()
})

await passo('AC-02/AC-03 Upload em lote cria uma tela por imagem', async () => {
  await esperarTelas(3)
  for (let i = 1; i <= 3; i++) {
    const opt = telas().nth(i - 1)
    const t = await opt.textContent()
    if (!t.includes(pad(i)) || !t.includes(`upload-${i}`)) throw new Error(`tela ${i} inesperada: ${t}`)
  }
  await page.locator('footer').getByText('01 / 03', { exact: true }).waitFor()
  // a imagem enviada é renderizada no canvas
  const img = page.getByTestId('canvas').locator('img').first()
  await img.waitFor()
  const carregou = await img.evaluate((el) => el.complete && el.naturalWidth > 0)
  if (!carregou) throw new Error('imagem da tela não carregou no canvas')
  await page.screenshot({ path: `${SHOTS}/03-editor-telas.png` })
})

await passo('AC-02 Formato inválido mostra erro individual', async () => {
  fs.writeFileSync(`${SHOTS}/ruim.txt`, 'nao e imagem')
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Enviar ou soltar arquivos' }).waitFor()
  await page.getByRole('complementary', { name: 'Painel esquerdo' }).locator('input[type=file]').setInputFiles([`${SHOTS}/ruim.txt`])
  await page.getByText('Formato .txt não suportado', { exact: false }).first().waitFor({ timeout: 10000 })
  await page.getByText('Falhou', { exact: true }).first().waitFor({ timeout: 3000 })
  await esperarTelas(3)
})

await passo('AC-04 Texto e hotspot: adicionar, mover por teclado (Shift+→ = 8 px), alinhar, ordenar', async () => {
  await telas().nth(0).click()
  await page.locator('footer').getByText('01 / 03', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('Olá, cliente')
  const campoX = page.getByLabel('Posição X')
  const xAntes = Number(await campoX.inputValue())
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Shift+ArrowRight')
  // regra do 8: Shift + seta anda 8 px
  const xDepois = await esperarValor(campoX, xAntes + 8)
  if (xDepois !== xAntes + 8) throw new Error(`nudge falhou ${xAntes} → ${xDepois}`)
  await page.getByRole('button', { name: 'Alinhar à esquerda' }).click()
  const xEsq = await esperarValor(campoX, 0)
  if (xEsq !== 0) throw new Error(`alinhar à esquerda deu x=${xEsq}`)
  await page.getByRole('button', { name: 'Centralizar na horizontal' }).click()
  const largura = Number(await page.getByLabel('Largura').inputValue())
  const centro = Math.round((1920 - largura) / 2)
  const xCentro = await esperarValor(campoX, centro)
  if (Math.abs(xCentro - centro) > 1) throw new Error(`centralizar deu x=${xCentro}, esperado ${centro}`)
  await page.keyboard.press(']') // trazer para frente (os botões saíram do cabeçalho; ficam no menu e nas teclas)
  await page.getByTestId('canvas').getByText('Olá, cliente').waitFor()
  await page.getByRole('button', { name: 'Hotspot', exact: true }).click()
  await page.getByLabel('Descrição do hotspot').fill('Ir para a segunda tela')
  await page.getByRole('tab', { name: 'Camadas' }).click()
  const arvore = page.getByRole('tree', { name: 'Camadas da tela' })
  await arvore.getByRole('treeitem', { name: /Olá, cliente/ }).waitFor()
  await arvore.getByRole('treeitem', { name: /hotspot/i }).waitFor()
})

await passo('AC-05 Configurar hotspot: ao clicar → ir para a tela 02', async () => {
  await page.getByRole('tab', { name: /^Interações/ }).click()
  await page.getByRole('button', { name: 'Adicionar interação' }).click()
  const gatilho = page.getByRole('radiogroup', { name: 'Gatilho' })
  if ((await gatilho.getByRole('radio', { name: 'Clique' }).getAttribute('aria-checked')) !== 'true') throw new Error('gatilho padrão não é clique')
  await page.getByRole('radiogroup', { name: 'Ação' }).getByRole('radio', { name: 'Navegar para tela' }).click()
  const destino = page.getByRole('button', { name: /^Ir para 02 / })
  await destino.click()
  if ((await destino.getAttribute('aria-pressed')) !== 'true') throw new Error('destino 02 não ficou selecionado')
  await page.getByText(/Clique → Navegar para tela/).waitFor()
  await esperarSalvo()
  await page.screenshot({ path: `${SHOTS}/04-editor-inspetor.png` })
})

await passo('AC-05/AC-06 Preview: clicar no hotspot navega para a tela 02; teclado funciona', async () => {
  await page.getByRole('button', { name: 'Pré-visualizar' }).first().click()
  const viewer = page.locator('div.fixed.inset-0.z-50').filter({ has: page.locator('.viewer-controles') })
  await contador(page, '01 / 03', viewer).waitFor()
  await viewer.getByText('Preparando apresentação…').waitFor({ state: 'hidden', timeout: 10000 })
  await page.waitForTimeout(300)
  await viewer.getByRole('button', { name: 'Ir para a segunda tela' }).click()
  await contador(page, '02 / 03', viewer).waitFor()
  await page.waitForTimeout(400)
  await page.keyboard.press('ArrowRight')
  await contador(page, '03 / 03', viewer).waitFor()
  await page.waitForTimeout(400)
  await page.keyboard.press('Home')
  await contador(page, '01 / 03', viewer).waitFor()
  await page.screenshot({ path: `${SHOTS}/05-preview.png` })
  await page.keyboard.press('Escape')
  await viewer.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Compartilhar' }).waitFor()
})

await passo('Undo/redo de adicionar tela', async () => {
  await esperarTelas(3)
  await page.getByRole('button', { name: 'Nova tela', exact: true }).first().click()
  await esperarTelas(4)
  await page.getByRole('button', { name: /^Desfazer/ }).click()
  await esperarTelas(3)
  await page.getByRole('button', { name: /^Refazer/ }).click()
  await esperarTelas(4)
  await page.getByRole('button', { name: /^Desfazer/ }).click()
  await esperarTelas(3)
})

await passo('AC-10 Recarregar preserva a edição confirmada', async () => {
  await esperarSalvo()
  await page.reload()
  await esperarTelas(3)
  await telas().nth(0).click()
  await page.getByTestId('canvas').getByText('Olá, cliente').waitFor({ timeout: 5000 })
  // a mídia enviada também precisa sobreviver ao reload (não pode virar "Não foi possível carregar")
  const img = page.getByTestId('canvas').locator('img').first()
  await img.waitFor()
  await page.waitForFunction((el) => el.complete, await img.elementHandle())
  if (!(await img.evaluate((el) => el.naturalWidth > 0))) throw new Error('imagem enviada não carrega após reload')
  await page.getByRole('tab', { name: 'Camadas' }).click()
  await page.getByRole('tree', { name: 'Camadas da tela' }).getByRole('treeitem', { name: /hotspot/i }).click()
  await page.getByRole('tab', { name: /^Interações/ }).click()
  if ((await page.getByRole('button', { name: /^Ir para 02 / }).getAttribute('aria-pressed')) !== 'true') throw new Error('interação do hotspot perdida após reload')
})

await passo('AC-11 Link antes de publicar é recusado; publicar gera revisão', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  const dlg = page.getByRole('dialog', { name: 'Compartilhar' })
  await dlg.getByText('ainda não publicado').waitFor()
  // o modal já mostra o estado de publicação com "Publicar": o componente só aponta para ele, sem repetir o aviso
  await dlg.getByText('Publique acima para gerar links.').waitFor()
  if (await dlg.getByText('Há mudanças no rascunho').count()) throw new Error('aviso de rascunho repetido no modal')
  if (!(await dlg.getByRole('button', { name: 'Gerar link' }).isDisabled())) throw new Error('gerar link deveria estar desabilitado antes de publicar')
  await dlg.getByRole('button', { name: 'Publicar' }).click()
  await page.getByText(/Revisão \d+ publicada/).waitFor({ timeout: 10000 })
  await dlg.getByText('Publicado e atualizado').waitFor()
  if (await dlg.getByRole('button', { name: 'Gerar link' }).isDisabled()) throw new Error('gerar link continua desabilitado após publicar')
})

let urlLink = ''
await passo('AC-09 Criar link com senha (plano Studio)', async () => {
  const dlg = page.getByRole('dialog', { name: 'Compartilhar' })
  await dlg.getByRole('switch', { name: 'Proteger com senha' }).click()
  await dlg.getByPlaceholder(/Senha para o cliente/).fill('cliente2026')
  await dlg.getByRole('button', { name: 'Gerar link' }).click()
  const code = dlg.locator('code').first()
  await dlg.getByText('Seu link (exibido uma única vez)').waitFor()
  urlLink = (await code.textContent()).trim()
  if (!/\/p\/[A-Za-z0-9_-]{43}$/.test(urlLink)) throw new Error('url inesperada ' + urlLink)
  await dlg.getByText('senha', { exact: true }).waitFor()
  await page.screenshot({ path: `${SHOTS}/06-compartilhar.png` })
  await dlg.getByRole('button', { name: 'Fechar', exact: true }).click()
  await dlg.waitFor({ state: 'detached' })
})

await passo('AC-09/AC-12 Convidado (celular): senha errada mostra erro, senha certa abre', async () => {
  const movel = await ctx.newPage()
  await movel.setViewportSize({ width: 390, height: 844 })
  await movel.goto(urlLink)
  await movel.getByText('Apresentação protegida').waitFor()
  await movel.getByText('Digite a senha', { exact: false }).waitFor()
  await movel.getByLabel('Senha').fill('errada')
  await movel.getByRole('button', { name: 'Abrir apresentação' }).click()
  await movel.getByRole('alert').getByText('Senha incorreta', { exact: false }).waitFor()
  await movel.getByLabel('Senha').fill('cliente2026')
  await movel.getByRole('button', { name: 'Abrir apresentação' }).click()
  await contador(movel, '01 / 03').waitFor({ timeout: 10000 })
  const largura = await movel.evaluate(() => document.documentElement.scrollWidth)
  if (largura > 390) throw new Error(`rolagem horizontal no celular (${largura}px)`)
  await movel.screenshot({ path: `${SHOTS}/07-viewer-mobile.png` })
  await movel.waitForTimeout(300)
  await movel.getByRole('button', { name: 'Próxima tela' }).click()
  await contador(movel, '02 / 03').waitFor()
  await movel.close()
})

await passo('AC-11 Mudança no rascunho não aparece no link até publicar', async () => {
  await telas().nth(0).click()
  await page.getByRole('tab', { name: 'Camadas' }).click()
  await page.getByRole('tree', { name: 'Camadas da tela' }).getByRole('treeitem', { name: /Olá, cliente/ }).click()
  await page.getByRole('tab', { name: 'Design' }).click()
  await page.getByLabel('Conteúdo do texto').fill('Texto novo do rascunho')
  await page.evaluate(() => document.activeElement?.blur())
  await esperarSalvo()
  await page.getByTestId('canvas').getByText('Texto novo do rascunho').waitFor()
  const p = await ctx.newPage()
  await p.goto(urlLink)
  await p.getByLabel('Senha').fill('cliente2026')
  await p.getByRole('button', { name: 'Abrir apresentação' }).click()
  await contador(p, '01 / 03').waitFor()
  await p.getByText('Olá, cliente').first().waitFor({ timeout: 5000 })
  if (await p.getByText('Texto novo do rascunho').count()) throw new Error('rascunho vazou para o link')
  await p.close()
})

await passo('Fluxo B: revogar link → indisponível imediatamente', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  const dlg = page.getByRole('dialog', { name: 'Compartilhar' })
  await dlg.getByText('Há mudanças não publicadas').waitFor()
  await dlg.getByRole('button', { name: 'Revogar' }).first().click()
  const confirmar = page.getByRole('dialog', { name: 'Revogar este link?' })
  await confirmar.getByRole('button', { name: 'Revogar' }).click()
  await page.getByText('Link revogado.').waitFor()
  await dlg.getByText('revogado', { exact: true }).waitFor()
  const p = await ctx.newPage()
  await p.goto(urlLink)
  await p.getByText('Este link não está mais disponível.').waitFor()
  await p.screenshot({ path: `${SHOTS}/08-link-revogado.png` })
  await p.close()
  await dlg.getByRole('button', { name: 'Fechar', exact: true }).click()
})

await passo('AC-08 URL adivinhada não abre nada', async () => {
  const p = await ctx.newPage()
  await p.goto(`${BASE}/p/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)
  await p.getByText('Este link não está mais disponível.').waitFor()
  await p.close()
})

await passo('Demo Atlas (link público): hover revela camada, hotspot navega com morph e volta', async () => {
  const p = await ctx.newPage()
  await p.goto(`${BASE}/p/demo_cafe_aurora_proposta_01_token_fixo_xx`)
  await contador(p, '01 / 06').waitFor()
  await p.getByText('Preparando apresentação…').waitFor({ state: 'hidden', timeout: 10000 })
  await p.waitForTimeout(1200) // animações de entrada da capa
  if (await p.getByText('foto · vaso esmaltado').count()) throw new Error('camada oculta visível antes do hover')
  await p.locator('[data-layer-id="foto"]').hover()
  await p.getByText('foto · vaso esmaltado').waitFor()
  await p.screenshot({ path: `${SHOTS}/09-demo-hover.png` })
  await p.mouse.move(5, 5)
  await p.getByText('foto · vaso esmaltado').waitFor({ state: 'detached', timeout: 2000 }).catch(() => { throw new Error('hover não reverteu') })
  await p.getByRole('button', { name: 'Ver coleção' }).click()
  await contador(p, '05 / 06').waitFor()
  await p.waitForTimeout(1000) // morph de 800 ms
  await p.getByRole('img', { name: 'Vaso esmaltado em 3D' }).or(p.locator('[data-layer-id="vaso"]')).first().waitFor()
  await p.getByRole('button', { name: 'Voltar à capa' }).click()
  await contador(p, '01 / 06').waitFor()
  await p.close()
})

await passo('Story: modo vertical renderiza e rola', async () => {
  await page.goto(`${BASE}/app/projects/pr-mare/apresentar`)
  await page.locator('.viewer-controles').getByText('Maré — Campanha verão').waitFor()
  await page.getByText('Maré', { exact: true }).waitFor()
  const fim = page.getByText('Lançamento 21.12')
  await fim.scrollIntoViewIfNeeded()
  await fim.waitFor()
  const rolou = await page.locator('.rolagem-fina').first().evaluate((el) => el.scrollTop > 0)
  if (!rolou) throw new Error('story não rolou')
  await page.screenshot({ path: `${SHOTS}/10-story.png` })
})

await passo('Detalhes, compartilhamento e configurações renderizam', async () => {
  await page.goto(`${BASE}/app/projects/pr-atlas`)
  await page.getByRole('heading', { level: 1, name: 'Atlas Cerâmica — Identidade' }).waitFor()
  await page.getByRole('heading', { name: 'Detalhes' }).waitFor()
  await page.getByRole('heading', { name: 'Telas · 6' }).waitFor()
  // espera o prefetch dos links da página terminar: um goto no meio dele aborta o fetch e o Next registra no console
  await page.waitForLoadState('networkidle')
  await page.goto(`${BASE}/app/projects/pr-atlas/share`)
  await page.getByRole('heading', { level: 1, name: 'Compartilhar' }).waitFor()
  await page.getByText(/Links criados · \d+ ativo/).waitFor()
  await page.goto(`${BASE}/app/settings`)
  await page.getByRole('heading', { name: 'Conta e planos.' }).waitFor()
  await page.getByRole('heading', { name: 'Plano e uso' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/11-settings.png`, fullPage: true })
})

/** Contraste WCAG entre duas cores "rgb(r, g, b)" (ou rgba) do getComputedStyle. */
const contraste = (a, b) => {
  const canal = (s) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const [l1, l2] = [lum(canal(a)), lum(canal(b))].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const temaDoc = () => page.evaluate(() => ({ tema: document.documentElement.dataset.tema, pref: document.documentElement.dataset.temaPref, fundo: getComputedStyle(document.body).backgroundColor, cookie: document.cookie, salvo: localStorage.getItem('tema'), esquema: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') }))

await passo('Tema escuro: Plano e conta → Preferências, campos legíveis, canvas e exportação inalterados, persiste, automático segue o sistema', async () => {
  // Plano e conta: escolher Escuro
  await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Escuro' }).click()
  let t = await temaDoc()
  if (t.tema !== 'escuro' || t.pref !== 'escuro') throw new Error(`data-tema=${t.tema} pref=${t.pref}`)
  if (t.fundo !== 'rgb(18, 17, 16)') throw new Error(`fundo do body no escuro: ${t.fundo}`)
  if (t.salvo !== 'escuro' || !/(^|; )tema=escuro/.test(t.cookie) || t.esquema !== 'dark') throw new Error(`persistência: localStorage=${t.salvo} cookie=${t.cookie} meta=${t.esquema}`)
  await page.screenshot({ path: `${SHOTS}/11b-settings-escuro.png` })
  // Criar com IA: o campo "Para quem" tem fundo próprio (nunca transparente) e placeholder legível
  await page.goto(`${BASE}/app/criar`)
  const campo = page.getByPlaceholder('ex.: diretoria, alunos, clientes')
  await campo.waitFor()
  const cores = await campo.evaluate((el) => ({ fundo: getComputedStyle(el).backgroundColor, texto: getComputedStyle(el).color, placeholder: getComputedStyle(el, '::placeholder').color }))
  if (/rgba\(.*, 0\)$/.test(cores.fundo) || cores.fundo === 'transparent') throw new Error(`campo sem fundo: ${cores.fundo}`)
  const cTexto = contraste(cores.texto, cores.fundo)
  const cPlaceholder = contraste(cores.placeholder, cores.fundo)
  if (cTexto < 4.5 || cPlaceholder < 3) throw new Error(`contraste no escuro: texto ${cTexto.toFixed(2)}, placeholder ${cPlaceholder.toFixed(2)} (fundo ${cores.fundo})`)
  await page.screenshot({ path: `${SHOTS}/12b-criar-ia-escuro.png` })
  // Editor: a moldura escurece, a tela do documento não
  await page.goto(`${BASE}/app/projects/pr-atlas/edit`)
  await page.getByRole('button', { name: 'Compartilhar' }).waitFor()
  const cena = page.locator('[data-testid="canvas"] > div').first()
  const fundoCena = await cena.evaluate((el) => getComputedStyle(el).backgroundColor)
  if (fundoCena !== 'rgb(238, 231, 219)') throw new Error(`a tela mudou de cor no escuro: ${fundoCena} (documento: #EEE7DB)`)
  const fundoCanvas = await page.locator('[data-testid="canvas-area"]').evaluate((el) => getComputedStyle(el).backgroundColor)
  if (fundoCanvas !== 'rgb(14, 13, 12)') throw new Error(`moldura do canvas no escuro: ${fundoCanvas}`)
  await page.screenshot({ path: `${SHOTS}/13b-editor-escuro.png` })
  // exportação PNG: a cor de fundo da tela é a do documento (não a do tema)
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Escala' }).getByRole('radio', { name: '1×' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('menuitem', { name: 'Exportar tela atual' }).click()])
  const png = await loadImage(fs.readFileSync(await dl.path()))
  const cv = createCanvas(png.width, png.height)
  cv.getContext('2d').drawImage(png, 0, 0)
  const pixel = [...cv.getContext('2d').getImageData(40, 40, 1, 1).data.slice(0, 3)]
  if (png.width !== 1920 || pixel.some((c, i) => Math.abs(c - [238, 231, 219][i]) > 2)) throw new Error(`PNG no escuro: canto ${pixel} (${png.width}px), esperado 238,231,219`)
  await page.keyboard.press('Escape')
  // persiste ao recarregar (sem piscar: o cookie manda o data-tema do servidor e o script do <head> confirma)
  await page.reload()
  await page.getByRole('button', { name: 'Compartilhar' }).waitFor()
  t = await temaDoc()
  if (t.tema !== 'escuro' || t.fundo !== 'rgb(18, 17, 16)') throw new Error(`não persistiu: data-tema=${t.tema} fundo=${t.fundo}`)
  // Automático: segue prefers-color-scheme
  await page.goto(`${BASE}/app/settings`)
  await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Automático' }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(100)
  t = await temaDoc()
  if (t.pref !== 'auto' || t.tema !== 'escuro' || t.fundo !== 'rgb(18, 17, 16)' || t.esquema !== 'light dark') throw new Error(`automático com sistema escuro: ${JSON.stringify(t)}`)
  await page.emulateMedia({ colorScheme: 'light' })
  await page.waitForTimeout(100)
  t = await temaDoc()
  if (t.tema !== 'claro' || t.fundo !== 'rgb(250, 250, 249)') throw new Error(`automático com sistema claro: ${JSON.stringify(t)}`)
  // Claro explícito: color-scheme "only light" (o Chrome não força escuro)
  await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Claro' }).click()
  const esquemaCss = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
  if (!/only/.test(esquemaCss)) throw new Error(`color-scheme no claro: ${esquemaCss}`)
  // volta ao padrão (Automático, sistema claro) para os passos seguintes
  await page.getByRole('radiogroup', { name: 'Tema' }).getByRole('radio', { name: 'Automático' }).click()
  await page.emulateMedia({ colorScheme: null })
})

/** Saldo de créditos mostrado no cabeçalho do Criar com IA. */
const saldoNoCabecalho = async () => Number((await page.locator('button[title^="Comprar créditos"] .mono').first().innerText()).replace(/\D/g, ''))

await passo('Criar com IA: roteiro de 6 telas → apresentação → editor', async () => {
  // com o prompt na URL, o pedido chega já enviado: o agente responde e abre as decisões ao lado
  await page.goto(`${BASE}/criar?prompt=Pitch%20da%20Aurora%2C%20startup%20de%20energia%20solar&formato=slides`)
  await page.getByRole('heading', { name: 'Decisões antes do plano' }).waitFor({ timeout: 15000 })
  await page.getByRole('log', { name: 'Conversa com a IA' }).getByText(/^Vou transformar esse pedido/).waitFor()
  await page.getByRole('radio', { name: '6 telas', exact: true }).click()
  if ((await page.getByRole('radio', { name: '6 telas', exact: true }).getAttribute('aria-checked')) !== 'true') throw new Error('6 telas não selecionado')
  await page.getByRole('button', { name: 'Criar o plano →' }).click()
  await page.getByText('Plano · 6 telas').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 6 telas').waitFor({ timeout: 30000 })
  await page.screenshot({ path: `${SHOTS}/12-criar-ia.png` })
  await page.getByRole('button', { name: 'Abrir no editor →' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/, { timeout: 15000 })
  await esperarTelas(6)
})

await passo('Texto: duplo clique na borda de baixo abraça a altura (um desfazer)', async () => {
  await telas().nth(0).click()
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('Caixa justa E2E')
  await page.evaluate(() => document.activeElement?.blur())
  const modo = page.getByRole('radiogroup', { name: 'Redimensionar texto' })
  await modo.getByRole('radio', { name: 'Tamanho fixo' }).click()
  const alt = page.getByLabel('Altura', { exact: true })
  await alt.fill('300')
  await alt.press('Enter')
  if ((await esperarValor(alt, 300)) !== 300) throw new Error('altura fixa não ficou em 300')
  await page.screenshot({ path: `${SHOTS}/13-texto-borda-antes.png` })
  // a alça do meio fica por cima do centro da borda: clica num quarto da largura (a borda inteira vale)
  const b = await page.getByTestId('borda-s').boundingBox()
  await page.mouse.dblclick(b.x + b.width * 0.25, b.y + b.height / 2)
  let h = Number(await alt.inputValue())
  for (let t = 0; t < 2000 && h >= 300; t += 100) { await page.waitForTimeout(100); h = Number(await alt.inputValue()) }
  if (!(h > 0 && h < 300)) throw new Error(`altura não abraçou o texto: ${h}`)
  if ((await modo.getByRole('radio', { name: /^Auto vertical/ }).getAttribute('aria-checked')) !== 'true') throw new Error('Redimensionar não mostra "Auto vertical"')
  await page.screenshot({ path: `${SHOTS}/14-texto-borda-depois.png` })
  // um passo de desfazer volta o modo e a altura de antes
  await page.getByRole('button', { name: /^Desfazer/ }).first().click()
  await page.getByTestId('canvas').getByText('Caixa justa E2E').click()
  if ((await esperarValor(alt, 300)) !== 300) throw new Error(`desfazer não voltou a altura: ${await alt.inputValue()}`)
  await page.getByRole('button', { name: /^Refazer/ }).first().click()
  await page.getByTestId('canvas').getByText('Caixa justa E2E').click()
  if ((await esperarValor(alt, h)) !== h) throw new Error('refazer não reaplicou a altura automática')
})

await passo('Texto: corte vertical (opções de texto) deixa a caixa justa nas maiúsculas', async () => {
  const alt = page.getByLabel('Altura', { exact: true })
  const antes = Number(await alt.inputValue())
  await page.getByRole('button', { name: 'Opções de texto' }).click()
  const painel = page.getByRole('dialog', { name: 'Opções de texto' })
  await painel.getByRole('tab', { name: 'Básico' }).waitFor()
  await painel.getByRole('radiogroup', { name: 'Corte vertical' }).getByRole('radio', { name: 'Justo' }).click()
  let h = Number(await alt.inputValue())
  for (let t = 0; t < 2000 && h >= antes; t += 100) { await page.waitForTimeout(100); h = Number(await alt.inputValue()) }
  const fs = Number(await page.getByLabel('Tamanho da fonte').inputValue())
  // Geist: altura das maiúsculas = 0,71 do tamanho
  if (Math.abs(h - Math.ceil(fs * 0.71)) > 1) throw new Error(`altura com corte ${h}, esperado ~${Math.ceil(fs * 0.71)} (antes ${antes})`)
  await page.screenshot({ path: `${SHOTS}/15-texto-corte.png` })
  await painel.getByRole('tab', { name: 'Detalhes' }).click()
  await painel.getByRole('radiogroup', { name: 'Quebra de linha' }).waitFor()
  await painel.getByRole('button', { name: 'Fechar opções de texto' }).click()
  await painel.waitFor({ state: 'detached' })
})

await passo('Texto: entrelinha justa não corta descendentes nem acentos (a tinta passa da caixa, como no Figma)', async () => {
  await page.getByRole('button', { name: 'Nova tela', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('O próximo resultado\ncomeça agora')
  await page.evaluate(() => document.activeElement?.blur())
  for (const [r, v] of [['Tamanho da fonte', 140], ['Entrelinha', 1]]) { const f = page.getByLabel(r, { exact: true }); await f.fill(String(v)); await f.press('Enter') }
  await escolher(page.getByLabel('Peso', { exact: true }), '700')
  // cor que contrasta com qualquer fundo de tela (o tema da apresentação pode ter fundo escuro e texto escuro)
  await page.getByRole('button', { name: 'Cor do texto: escolher cor' }).click()
  const hex = page.getByLabel('Hexadecimal')
  await hex.fill('#FF2D6F')
  await hex.press('Enter')
  await page.keyboard.press('Escape')
  await page.getByRole('radiogroup', { name: 'Redimensionar texto' }).getByRole('radio', { name: /^Auto horizontal/ }).click()
  await page.evaluate(() => document.activeElement?.blur())
  await page.getByRole('button', { name: 'Centralizar na horizontal' }).click()
  const camada = page.getByTestId('canvas').locator('[data-layer-id^="text-"]').last()
  const id = await camada.getAttribute('data-layer-id')
  // nada entre as letras e a tela recorta (overflow, clip-path, contain: paint) — no canvas e na miniatura da tela
  const cortes = (raiz) => raiz.locator(`[data-layer-id="${id}"]`).first().evaluate((el) => {
    const r = []
    for (let n = el.querySelector('span') ?? el; n && n !== el.parentElement; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.overflow !== 'visible' || cs.clipPath !== 'none' || /paint|strict|content/.test(cs.contain)) r.push(`${n.tagName} overflow=${cs.overflow} clip=${cs.clipPath} contain=${cs.contain}`)
    }
    return r
  })
  const noCanvas = await cortes(page.getByTestId('canvas'))
  if (noCanvas.length) throw new Error(`o texto é recortado no canvas: ${noCanvas.join(' | ')}`)
  const miniatura = telas().filter({ has: page.locator(`[data-layer-id="${id}"]`) })
  await miniatura.waitFor()
  const naMiniatura = await cortes(miniatura)
  if (naMiniatura.length) throw new Error(`o texto é recortado na miniatura: ${naMiniatura.join(' | ')}`)
  // tinta: sem seleção, a faixa logo abaixo da caixa tem pixels das descendentes (p, ç, g); antes ficava vazia
  await page.keyboard.press('Escape')
  const tela = await page.getByTestId('canvas').boundingBox()
  await page.mouse.click(tela.x + tela.width / 2, tela.y + tela.height + 40)
  await page.mouse.move(tela.x + tela.width / 2, tela.y + tela.height + 60)
  await page.waitForTimeout(300)
  const b = await camada.boundingBox()
  const em = b.height / 2 // duas linhas com entrelinha 1,0: altura da caixa = 2 em
  const faixa = { x: Math.round(b.x), y: Math.round(b.y + b.height) + 1, width: Math.round(b.width), height: Math.max(4, Math.round(em * 0.2)) }
  const img = await loadImage(await page.screenshot({ clip: faixa }))
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext('2d')
  g.drawImage(img, 0, 0)
  const px = g.getImageData(0, 0, img.width, img.height).data
  const fundo = [px[px.length - 4], px[px.length - 3], px[px.length - 2]] // canto de baixo à direita: só fundo
  let tinta = 0
  for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - fundo[0]) + Math.abs(px[i + 1] - fundo[1]) + Math.abs(px[i + 2] - fundo[2]) > 90) tinta++
  await page.screenshot({ path: `${SHOTS}/15b-texto-descendentes.png` })
  if (tinta < 15) throw new Error(`descendentes cortadas: ${tinta} px de tinta abaixo da caixa (faixa ${JSON.stringify(faixa)})`)
})

/** Máscaras: estilo calculado de uma camada no canvas e geometria pelo inspetor. */
const mascaraDe = (id) => page.getByTestId('canvas').locator(`[data-layer-id="${id}"]`).evaluate((e) => ({ img: decodeURIComponent(getComputedStyle(e).maskImage), modo: getComputedStyle(e).maskMode }))
async function geometria(pares) {
  for (const [r, v] of pares) { const f = page.getByLabel(r, { exact: true }); await f.fill(String(v)); await f.press('Enter') }
  await page.evaluate(() => document.activeElement?.blur())
}
async function esperarMascara(id, teste, ms = 6000) {
  let m = await mascaraDe(id)
  for (let t = 0; t < ms && !teste(m); t += 150) { await page.waitForTimeout(150); m = await mascaraDe(id) }
  if (!teste(m)) throw new Error(`máscara inesperada em ${id}: ${m.modo} ${m.img.slice(0, 160)}`)
  return m
}
const arvoreCamadas = () => page.getByRole('tree', { name: 'Camadas da tela' })

await passo('Máscara: texto como máscara de imagem (foto dentro do título, ⌃⌥M), editável, remover e desfazer', async () => {
  await page.getByRole('button', { name: 'Nova tela', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Título', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('FOTO')
  const tam = page.getByLabel('Tamanho da fonte')
  await tam.fill('480')
  await tam.press('Enter')
  await page.getByRole('radiogroup', { name: 'Redimensionar texto' }).getByRole('radio', { name: /^Auto horizontal/ }).click()
  await page.evaluate(() => document.activeElement?.blur())
  await page.getByRole('button', { name: 'Centralizar na horizontal' }).click()
  // a foto entra por cima do título
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByTitle(/Adicionar upload-1/).first().click()
  await page.getByRole('tab', { name: 'Camadas' }).click()
  await arvoreCamadas().getByRole('treeitem', { name: 'upload-1', exact: true }).waitFor()
  await geometria([['Largura', 1920], ['Altura', 1080], ['Posição X', 0], ['Posição Y', 0]])
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+Alt+KeyM')
  await page.getByText('Máscara criada: a camada de baixo recorta as outras.').waitFor()
  // painel de camadas: ícone de máscara no título; a foto recuada, com a seta para a máscara
  const linhaTexto = arvoreCamadas().getByRole('treeitem', { name: 'FOTO', exact: true })
  const linhaFoto = arvoreCamadas().getByRole('treeitem', { name: 'upload-1', exact: true })
  await linhaTexto.locator('[data-mascara]').waitFor()
  await linhaFoto.locator('[data-recortada]').waitFor()
  const idFoto = await page.getByTestId('canvas').locator('[data-layer-id^="image-"]').first().getAttribute('data-layer-id')
  await esperarMascara(idFoto, (m) => m.img.includes('<foreignObject') && m.img.includes('>FOTO<'))
  // fonte da biblioteca embutida na máscara (a imagem SVG não enxerga as fontes da página)
  await esperarMascara(idFoto, (m) => m.img.includes('@font-face'))
  await linhaTexto.locator('div').first().click()
  const tipo = page.getByRole('radiogroup', { name: 'Tipo de máscara' })
  if ((await tipo.getByRole('radio', { name: 'Alfa' }).getAttribute('aria-checked')) !== 'true') throw new Error('máscara nova não é de alfa')
  await page.screenshot({ path: `${SHOTS}/16-mascara-texto.png` })
  // continua editável: mudar o texto atualiza o recorte
  await page.getByLabel('Conteúdo do texto').fill('MOSTRA')
  await page.evaluate(() => document.activeElement?.blur())
  await esperarMascara(idFoto, (m) => m.img.includes('>MOSTRA<'))
  // desligar (olho) mostra a foto inteira; ligar volta
  await page.getByRole('button', { name: 'Desligar máscara' }).first().click()
  await esperarMascara(idFoto, (m) => m.img === 'none')
  await page.getByRole('button', { name: 'Ligar máscara' }).first().click()
  await esperarMascara(idFoto, (m) => m.img.includes('>MOSTRA<'))
  // remover máscara desfaz; desfazer traz de volta
  await page.getByRole('button', { name: 'Remover máscara' }).click()
  await esperarMascara(idFoto, (m) => m.img === 'none')
  if (await linhaTexto.locator('[data-mascara]').count()) throw new Error('o título continuou como máscara')
  await page.getByRole('button', { name: /^Desfazer/ }).first().click()
  await esperarMascara(idFoto, (m) => m.img.includes('>MOSTRA<'))
})

const PNG_ALFA = `${SHOTS}/alfa-e2e.png`
{
  const c = createCanvas(400, 400)
  const g = c.getContext('2d')
  const rg = g.createRadialGradient(200, 200, 30, 200, 200, 195)
  rg.addColorStop(0, 'rgba(255,255,255,1)')
  rg.addColorStop(0.6, 'rgba(110,110,110,1)')
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.beginPath(); g.arc(200, 200, 195, 0, Math.PI * 2); g.fill()
  fs.writeFileSync(PNG_ALFA, c.toBuffer('image/png'))
}

await passo('Máscara: PNG com transparência como máscara de alfa, luminância e contorno', async () => {
  await page.getByRole('button', { name: 'Nova tela', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('complementary', { name: 'Painel esquerdo' }).locator('input[type=file]').setInputFiles([PNG_ALFA])
  await page.getByRole('tab', { name: 'Camadas' }).click()
  await arvoreCamadas().getByRole('treeitem', { name: 'alfa-e2e', exact: true }).waitFor({ timeout: 15000 })
  await geometria([['Largura', 800], ['Altura', 800], ['Posição X', 560], ['Posição Y', 140]])
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByTitle(/Adicionar upload-2/).first().click()
  await page.getByRole('tab', { name: 'Camadas' }).click()
  await arvoreCamadas().getByRole('treeitem', { name: 'upload-2', exact: true }).waitFor()
  await geometria([['Largura', 1920], ['Altura', 1080], ['Posição X', 0], ['Posição Y', 0]])
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+Alt+KeyM')
  await page.getByText('Máscara criada: a camada de baixo recorta as outras.').first().waitFor()
  const linhaAlfa = arvoreCamadas().getByRole('treeitem', { name: 'alfa-e2e', exact: true })
  await linhaAlfa.locator('[data-mascara]').waitFor()
  // a foto recortada é a camada do canvas com mask-image (espera o PNG embutido carregar)
  const comMascara = () => page.getByTestId('canvas').locator('[data-layer-id]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).maskImage !== 'none').map((e) => e.getAttribute('data-layer-id')))
  let ids = await comMascara()
  for (let t = 0; t < 6000 && ids.length !== 1; t += 150) { await page.waitForTimeout(150); ids = await comMascara() }
  if (ids.length !== 1) throw new Error(`esperava 1 camada recortada, há ${ids.length}`)
  const idFoto = ids[0]
  // alfa: o PNG embutido na máscara (a transparência dele recorta a foto)
  await esperarMascara(idFoto, (m) => m.img.includes('<img src="data:image/') && m.modo !== 'luminance')
  await linhaAlfa.locator('div').first().click()
  const tipo = page.getByRole('radiogroup', { name: 'Tipo de máscara' })
  await page.screenshot({ path: `${SHOTS}/17-mascara-alfa.png` })
  await tipo.getByRole('radio', { name: 'Luminância' }).click()
  await esperarMascara(idFoto, (m) => m.modo === 'luminance')
  await page.screenshot({ path: `${SHOTS}/18-mascara-luminancia.png` })
  await tipo.getByRole('radio', { name: 'Contorno' }).click()
  await esperarMascara(idFoto, (m) => m.modo !== 'luminance' && !m.img.includes('<img'))
  await tipo.getByRole('radio', { name: 'Alfa' }).click()
  await esperarMascara(idFoto, (m) => m.img.includes('<img src="data:image/'))
  // a miniatura da tela usa o mesmo renderizador
  const mini = page.getByRole('listbox', { name: 'Telas' }).getByRole('option', { selected: true }).locator(`[data-layer-id="${idFoto}"]`)
  const mm = await mini.evaluate((e) => getComputedStyle(e).maskImage)
  if (!mm.includes('data:image/svg+xml')) throw new Error('miniatura sem a máscara')
})

// ---------- fontes do Google (catálogo, carregamento pela mesma origem, apresentação e exportação)
const pedidosFontes = []
page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com|\/fontes\//.test(r.url())) pedidosFontes.push(r.url()) })
/** Largura da "tinta" de um texto numa fonte (canvas 2D), para comparar com a fonte de reserva. */
/** Carrega (se preciso) e confirma que todas as faces da fonte estão prontas. */
const fonteCarregada = (p, fonte) => p.waitForFunction((f) => document.fonts.load(f).then((fs) => fs.length > 0 && fs.every((x) => x.status === 'loaded')), fonte, { timeout: 15000 })
const larguraTexto = (p, texto, fonte) => p.evaluate(([t, f]) => { const c = document.createElement('canvas').getContext('2d'); c.font = f; const m = c.measureText(t); return m.actualBoundingBoxLeft + m.actualBoundingBoxRight }, [texto, fonte])

await passo('Fonte do Google: catálogo completo no seletor (busca, categoria, prévias leves) → Playfair Display no canvas', async () => {
  await telas().nth(0).click()
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('Google 2026')
  await page.evaluate(() => document.activeElement?.blur())
  await page.getByRole('radiogroup', { name: 'Redimensionar texto' }).getByRole('radio', { name: /^Auto horizontal/ }).click()
  const gatilho = page.getByRole('button', { name: /^Fonte: / })
  await gatilho.click()
  const dlg = page.getByRole('dialog', { name: 'Escolher fonte' })
  const busca = dlg.getByLabel('Buscar fonte')
  await page.waitForFunction(() => /^Buscar entre [\d.]+ fontes$/.test(document.querySelector('[aria-label="Buscar fonte"]')?.getAttribute('placeholder') ?? ''))
  const total = Number((await busca.getAttribute('placeholder')).replace(/\D/g, ''))
  if (total < 1800) throw new Error(`catálogo com ${total} fontes`)
  // lista virtualizada: só as linhas visíveis existem
  const noDom = await dlg.getByRole('option').count()
  if (noDom > 60) throw new Error(`lista não virtualizada: ${noDom} opções no DOM`)
  // cada nome escrito na própria fonte, só com os glifos do nome (text=), pela mesma origem
  await page.waitForFunction(() => [...document.fonts].some((f) => f.family.replace(/["']/g, '').startsWith('mp-') && f.status === 'loaded'), null, { timeout: 15000 })
  if (!pedidosFontes.some((u) => u.includes('/fontes/css?') && u.includes('&t='))) throw new Error('prévias sem text= (carregariam a fonte inteira)')
  await dlg.getByRole('button', { name: 'Manuscrita' }).click()
  await dlg.getByText(/^Manuscrita · \d+$/).waitFor()
  await dlg.getByRole('button', { name: 'Todas', exact: true }).click()
  await busca.fill('playfair disp')
  await dlg.getByRole('option').first().filter({ hasText: 'Playfair Display' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/16-fontes-busca.png` })
  await page.keyboard.press('Enter')
  await dlg.waitFor({ state: 'detached' })
  if ((await gatilho.getAttribute('aria-label')) !== 'Fonte: Playfair Display') throw new Error(`fonte escolhida: ${await gatilho.getAttribute('aria-label')}`)
  // aplicada no canvas e carregada (só a variante usada)
  await fonteCarregada(page, '500 48px "Playfair Display"')
  const ff = await page.getByTestId('canvas').getByText('Google 2026').evaluate((el) => getComputedStyle(el).fontFamily)
  if (!ff.includes('Playfair Display')) throw new Error(`canvas com ${ff}`)
  const folha = pedidosFontes.find((u) => /\/fontes\/css\?f=Playfair\+Display%3A500$/.test(u))
  if (!folha) throw new Error(`folha da Playfair não pedida só com o peso usado: ${pedidosFontes.filter((u) => u.includes('Playfair')).join(' ')}`)
  if (pedidosFontes.some((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))) throw new Error('o navegador falou direto com o Google (deveria ser pela mesma origem)')
  // pesos que a família tem (400–900)
  await page.getByLabel('Peso', { exact: true }).click()
  const pesos = await page.getByRole('listbox', { name: 'Peso' }).getByRole('option').allTextContents()
  await page.keyboard.press('Escape')
  if (pesos.includes('Light') || !pesos.includes('Black')) throw new Error(`pesos oferecidos: ${pesos.join(', ')}`)
  // "Fontes do documento" no topo do seletor
  await gatilho.click()
  await dlg.getByText('Fontes do documento').waitFor()
  await dlg.getByRole('option', { name: /Playfair Display/ }).first().waitFor()
  await page.keyboard.press('Escape')
  await dlg.waitFor({ state: 'detached' })
  await esperarSalvo()
})

await passo('Fonte do Google na apresentação (página nova, carregada do zero)', async () => {
  const p2 = await ctx.newPage()
  await p2.goto(page.url().replace(/\/edit.*$/, '/apresentar'))
  await p2.locator('.viewer-controles').getByText(/^01 \/ \d+$/).waitFor()
  const t = p2.getByText('Google 2026', { exact: true })
  await t.waitFor()
  await fonteCarregada(p2, '500 48px "Playfair Display"')
  const ff = await t.evaluate((el) => getComputedStyle(el).fontFamily)
  if (!ff.includes('Playfair Display')) throw new Error(`apresentação com ${ff}`)
  // a largura desenhada é a da Playfair (não a da reserva)
  const tam = await t.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const desenhada = await t.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width })
  const escala = await t.evaluate((el) => el.getBoundingClientRect().width / el.offsetWidth || 1)
  const pf = await larguraTexto(p2, 'Google 2026', `500 ${tam}px "Playfair Display"`) * escala
  if (Math.abs(desenhada - pf) / pf > 0.1) throw new Error(`largura na apresentação ${desenhada.toFixed(1)} ≠ Playfair ${pf.toFixed(1)}`)
  await p2.screenshot({ path: `${SHOTS}/17-fontes-apresentacao.png` })
  await p2.close()
})

await passo('Exportar PNG com a fonte do Google embutida (largura do texto ≠ fonte de reserva)', async () => {
  await page.getByTestId('canvas').getByText('Google 2026').click()
  await page.getByRole('button', { name: 'Adicionar exportação' }).click()
  await escolher(page.getByLabel('Escala da exportação'), '1')
  const tam = Number(await page.getByLabel('Tamanho da fonte').inputValue())
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /^Exportar / }).click()])
  const png = fs.readFileSync(await dl.path())
  // largura da tinta no PNG (pixels opacos) × a mesma medida na Playfair e na fonte de reserva (Geist)
  const tinta = await page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let min = c.width, max = -1
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 96) { if (x < min) min = x; if (x > max) max = x }
    return max - min + 1
  }, png.toString('base64'))
  const reserva = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--font-geist-sans').trim() || 'sans-serif')
  const pf = await larguraTexto(page, 'Google 2026', `500 ${tam}px "Playfair Display"`)
  const fb = await larguraTexto(page, 'Google 2026', `500 ${tam}px ${reserva}`)
  // "Google 2026": ~11% mais estreito na Playfair do que na Geist (algarismos e o G bem diferentes)
  if (Math.abs(pf - fb) / pf < 0.06) throw new Error(`Playfair (${pf.toFixed(1)}) e reserva (${fb.toFixed(1)}) parecidas demais para comparar`)
  if (Math.abs(tinta - pf) / pf > 0.03 || Math.abs(tinta - fb) < Math.abs(tinta - pf)) throw new Error(`PNG com ${tinta}px de texto; Playfair ${pf.toFixed(1)}, reserva ${fb.toFixed(1)}`)
  console.log(`   PNG: texto com ${tinta}px · Playfair ${pf.toFixed(1)}px · reserva (Geist) ${fb.toFixed(1)}px`)
  await page.getByRole('button', { name: 'Fechar exportação' }).click()
})

const LOGO = `${SHOTS}/logo-aurora.svg`
fs.writeFileSync(LOGO, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120"><circle cx="60" cy="60" r="44" fill="#E4572E"/><rect x="38" y="38" width="44" height="44" rx="6" fill="#1F3B4D"/><rect x="130" y="34" width="250" height="22" rx="11" fill="#1F3B4D"/><rect x="130" y="66" width="160" height="22" rx="11" fill="#F2C14E"/></svg>')

/** Cartão "Criar com IA" do painel (uma linha opcional de ideia + botão). */
const cartaoIa = () => page.locator('form', { has: page.locator('#painel-ideia') })

await passo('Criar com IA: atalho do painel (ideia em uma linha) → marca com logo, paleta do logo e kit salvo', async () => {
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.locator('#painel-ideia').fill('Pitch da Aurora, startup de energia solar por assinatura para pequenos comércios')
  await cartaoIa().getByRole('button', { name: 'Criar com IA' }).click()
  await page.waitForURL(/\/app\/criar\?/)
  await page.getByRole('heading', { name: 'Decisões antes do plano' }).waitFor({ timeout: 15000 })
  await page.getByLabel('Arquivo do logo').setInputFiles(LOGO)
  await page.getByText('Paletas do seu logo').waitFor({ timeout: 15000 })
  // a 1ª paleta do logo entra sozinha: a cor principal (laranja) é a 1ª cor da marca
  const cor1 = await page.getByLabel('Código da cor 1').inputValue()
  if (cor1.toUpperCase() !== '#E4572E') throw new Error(`cor principal tirada do logo: ${cor1}`)
  await page.getByLabel('Nome da marca').fill('Aurora')
  await page.getByRole('button', { name: 'Salvar como kit de marca' }).click()
  await page.getByRole('button', { name: 'Usar o kit Aurora' }).waitFor()
  // a prévia da capa já tem o logo (camada de imagem do logo, aplicada sem IA)
  const logoNaPrevia = await page.locator('[data-layer-id^="logo-"] img').count()
  if (!logoNaPrevia) throw new Error('logo não aparece na prévia da capa')
  await page.screenshot({ path: `${SHOTS}/13-criar-marca.png` })
})

await passo('Criar com IA: qualquer fonte do Google no kit de marca (títulos e textos)', async () => {
  await page.getByRole('button', { name: /^Fonte dos títulos: / }).click()
  const dlg = page.getByRole('dialog', { name: 'Escolher fonte dos títulos' })
  await dlg.getByLabel('Buscar fonte').fill('abril fatface')
  await dlg.getByRole('option').first().filter({ hasText: 'Abril Fatface' }).waitFor()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: /^Fonte dos textos: / }).click()
  const dlg2 = page.getByRole('dialog', { name: 'Escolher fonte dos textos' })
  await dlg2.getByLabel('Buscar fonte').fill('Lora')
  await dlg2.getByRole('option').first().filter({ hasText: 'Lora' }).waitFor()
  await page.keyboard.press('Enter')
  await page.getByText('Par próprio:').waitFor()
  // a prévia da capa já usa a fonte dos títulos, carregada
  await page.locator('[style*="Abril Fatface"]').first().waitFor()
  await fonteCarregada(page, '16px "Abril Fatface"')
  await page.getByRole('button', { name: /^Atualizar o kit/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/13b-criar-marca-fontes.png` })
})

await passo('Criar com IA: material (números), galeria de estilos com filtro e busca, tamanho e custo no painel ao lado', async () => {
  await page.getByRole('tab', { name: 'Material' }).click()
  await page.getByRole('textbox', { name: 'Números-chave' }).fill('38% | mais clientes atendidos\n6 semanas | até o lançamento')
  await page.getByRole('tab', { name: 'Estilos' }).click()
  const galeria = page.getByRole('radiogroup', { name: 'Estilo de design' })
  const total = await galeria.getByRole('radio').count()
  if (total < 16) throw new Error(`galeria com ${total} opções (esperava ≥ 15 estilos + sugestão)`)
  await page.getByRole('radiogroup', { name: 'Categoria de estilo' }).getByRole('radio', { name: /^Elegante/ }).click()
  await galeria.getByRole('radio', { name: 'Luxo', exact: true }).waitFor()
  await page.getByRole('radiogroup', { name: 'Categoria de estilo' }).getByRole('radio', { name: /^Todos/ }).click()
  await page.getByLabel('Buscar estilo').fill('memphis')
  if ((await galeria.getByRole('radio').count()) !== 1) throw new Error('busca de estilo não filtrou')
  await page.getByLabel('Buscar estilo').fill('')
  await galeria.getByRole('radio', { name: 'Luxo', exact: true }).click()
  await page.getByLabel('Prévia do estilo escolhido').waitFor()
  await page.getByRole('tab', { name: 'Decisões' }).click()
  await page.getByRole('radio', { name: '20 telas', exact: true }).click()
  if ((await page.getByRole('radio', { name: '20 telas', exact: true }).getAttribute('aria-checked')) !== 'true') throw new Error('20 telas não selecionado')
  // a ideia escrita no cartão do painel chegou à conversa
  if (!/Pitch da Aurora/.test(await page.getByRole('log', { name: 'Conversa com a IA' }).innerText())) throw new Error('a ideia do cartão do painel não chegou à conversa')
  const resumo = await page.getByText(/^Plano agora/).innerText()
  if (!/design de 20 telas depois/.test(resumo)) throw new Error(`resumo de custo: ${resumo}`)
  await page.screenshot({ path: `${SHOTS}/14-criar-revisar.png` })
})

await passo('Criar com IA: 20 telas com o logo; trocar o estilo depois é grátis; abre no editor', async () => {
  await page.getByRole('button', { name: 'Criar o plano →' }).click()
  await page.getByText('Plano · 20 telas').waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 20 telas').waitFor({ timeout: 90000 })
  const capa = page.locator('[data-layer-id^="logo-"]')
  if ((await capa.count()) < 2) throw new Error('logo não está na capa e no encerramento')
  // logo em SVG entra como vetor com as cores trocadas por fundo (regras de cor do logo)
  if ((await capa.first().getAttribute('data-layer-type')) !== 'svg') throw new Error('logo SVG deveria entrar como camada vetorial')
  const antes = await saldoNoCabecalho()
  const trocar = page.getByRole('radiogroup', { name: 'Trocar estilo' })
  const menuEstilo = page.getByRole('button', { name: /^Estilo/ })
  for (const nome of ['Suíço', 'Neo-Memphis']) {
    await menuEstilo.click()
    await trocar.getByRole('radio', { name: nome }).click()
    await page.getByText('Pronto · 20 telas').waitFor({ timeout: 20000 })
    if (!(await menuEstilo.innerText()).includes(nome)) throw new Error(`estilo ${nome} não aplicado`)
  }
  await page.waitForTimeout(500)
  if ((await saldoNoCabecalho()) !== antes) throw new Error('trocar o estilo gastou créditos')
  await page.screenshot({ path: `${SHOTS}/15-criar-estilos.png` })
  await page.getByText('Salvando…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})
  // apresentar e sair com Esc volta para a mesma conversa, com as telas prontas (não para o início)
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click()
  await page.waitForURL(/\/apresentar/, { timeout: 15000 })
  await page.waitForTimeout(800)
  await page.keyboard.press('Escape')
  await page.waitForURL(/\/app\/criar\?sessao=/, { timeout: 15000 })
  await page.getByText('Pronto · 20 telas').waitFor({ timeout: 15000 })
  await page.getByRole('log', { name: 'Conversa com a IA' }).getByText(/^A apresentação está pronta/).waitFor()
  await page.getByRole('button', { name: 'Abrir no editor →' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/, { timeout: 15000 })
  await esperarTelas(20)
  await page.getByTestId('canvas').locator('img').first().waitFor({ timeout: 10000 })
})

await passo('Criar com IA: as fontes do kit (Abril Fatface + Lora) estão nas telas geradas', async () => {
  const familias = await page.getByTestId('canvas').locator('[data-layer-id] *').evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).fontFamily))])
  if (!familias.some((f) => f.includes('Abril Fatface'))) throw new Error(`títulos sem a fonte do kit: ${familias.join(' | ')}`)
  if (!familias.some((f) => f.includes('Lora'))) throw new Error(`textos sem a fonte do kit: ${familias.join(' | ')}`)
  await fonteCarregada(page, '16px "Abril Fatface"')
})

await passo('Criar com IA: o kit de marca fica salvo no espaço para a próxima apresentação', async () => {
  await page.goto(`${BASE}/app/criar?prompt=Outra%20apresenta%C3%A7%C3%A3o`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Usar o kit Aurora' }).click()
  if ((await page.getByLabel('Nome da marca').inputValue()) !== 'Aurora') throw new Error('kit não aplicou o nome')
  if ((await page.getByLabel('Código da cor 1').inputValue()).toUpperCase() !== '#E4572E') throw new Error('kit não aplicou as cores')
  await page.getByAltText(/^Logo/).first().waitFor()
})

await passo('Criar com IA: o kit traz de volta as fontes do Google escolhidas', async () => {
  if ((await page.getByRole('button', { name: /^Fonte dos títulos: / }).getAttribute('aria-label')) !== 'Fonte dos títulos: Abril Fatface') throw new Error('kit não trouxe a fonte dos títulos')
  if ((await page.getByRole('button', { name: /^Fonte dos textos: / }).getAttribute('aria-label')) !== 'Fonte dos textos: Lora') throw new Error('kit não trouxe a fonte dos textos')
})

const BRIEFING = fs.readFileSync(new URL('../lib/ia/fixtures/prompt-nexora-resultados.md', import.meta.url), 'utf8')

await passo('Painel: cartão "Criar com IA" sem nada sobreposto em 390, 768, 1024 e 1440 px', async () => {
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  for (const w of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.waitForTimeout(200)
    const caixa = await cartaoIa().boundingBox()
    const filhos = await cartaoIa().evaluate((f) => [...f.querySelectorAll('h2, p, input, button, span.mono')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return { n: e.tagName, x: r.x, y: r.y, w: r.width, h: r.height } }))
    for (const a of filhos) {
      if (a.x < caixa.x - 1 || a.x + a.w > caixa.x + caixa.width + 1 || a.y + a.h > caixa.y + caixa.height + 1) throw new Error(`${w}px: ${a.n} sai do cartão`)
      for (const b of filhos) if (a !== b && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1) throw new Error(`${w}px: ${a.n} sobre ${b.n}`)
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error(`${w}px: rolagem horizontal`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: `${SHOTS}/16-painel-cartao-ia.png` })
})

await passo('Criar com IA: briefing longo colado no painel vai inteiro; 15 telas, cores e estrutura reconhecidas; dados nas telas', async () => {
  // colar um briefing longo na linha do cartão leva o texto inteiro para o editor grande (nada é cortado)
  await page.locator('#painel-ideia').focus()
  await page.evaluate((t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    document.querySelector('#painel-ideia').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, BRIEFING)
  await page.waitForURL(/\/app\/criar\?colado=1/)
  // o briefing chega enviado como anexo (texto colado inteiro) e o agente diz o que reconheceu
  const conversa = page.getByRole('log', { name: 'Conversa com a IA' })
  await conversa.getByText(/^Texto colado · \d+ KB$/).waitFor({ timeout: 10000 })
  await conversa.getByText(/a estrutura tela a tela \(15 telas\)/).waitFor()
  await page.getByRole('heading', { name: 'Decisões antes do plano' }).waitFor({ timeout: 15000 })
  await page.screenshot({ path: `${SHOTS}/17-criar-briefing-longo.png` })
  // as cores em hex do texto viram a marca, com papéis, sem digitar de novo
  if ((await page.getByLabel('Código da cor 1').inputValue()).toUpperCase() !== '#006BFF') throw new Error('cor principal do pedido')
  if ((await page.getByLabel('Código da cor 2').inputValue()).toUpperCase() !== '#071A3D') throw new Error('fundo escuro do pedido')
  await page.getByLabel('Papéis de cor do pedido').getByText('#16A765').waitFor()
  if ((await page.getByLabel('Nome da marca').inputValue()) !== 'Nexora Soluções') throw new Error('nome da marca do pedido')
  if ((await page.getByRole('radio', { name: '15 telas', exact: true }).getAttribute('aria-checked')) !== 'true') throw new Error('15 telas do pedido não pré-selecionadas')
  await page.getByRole('button', { name: 'Criar o plano →' }).click()
  await page.getByText('Plano · 15 telas').waitFor({ timeout: 60000 })
  if ((await page.getByLabel('Título da tela 15').inputValue()) !== 'O próximo resultado começa agora') throw new Error('título do encerramento pedido')
  if ((await page.getByLabel('Tipo da tela 8').inputValue()) !== 'funil') throw new Error('a tela 8 deveria ser o funil')
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 15 telas').waitFor({ timeout: 90000 })
  for (const t of ['↓ 41,9%  maior perda', '41,1%', '91,9%', 'Ana Souza']) await page.getByText(t, { exact: true }).first().waitFor({ timeout: 5000 })
  if (await page.getByText(/arraste sua imagem|\[data\]|\[Nome\]/).count()) throw new Error('placeholder numa tela gerada')
  await page.screenshot({ path: `${SHOTS}/18-criar-15-telas.png`, fullPage: true })
  await page.getByText('Salvando o projeto…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})
})

/**
 * Caixas reais das camadas da tela atual no canvas do editor (lidas do DOM, em coordenadas da cena), com tipo, pai
 * e texto — o que a conferência da regra do 8 (lib/ia/distancias8.mjs) usa. Camadas giradas ficam de fora (a caixa
 * do DOM é a envolvente da rotação, não a que o editor mede).
 */
const lerCaixasDaTela = async () => {
  // as animações de entrada terminam antes da leitura (as que ficam em loop são puladas na leitura)
  await page.waitForFunction(() => document.querySelector('[data-testid="canvas"]')?.getAnimations({ subtree: true }).every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {})
  return page.evaluate(() => {
  const tela = document.querySelector('[data-testid="canvas"]')
  const T = tela.getBoundingClientRect()
  const largura = T.width >= T.height ? 1920 : 1080
  const s = T.width / largura
  const tamanho = { width: largura, height: Math.round(T.height / s) }
  const camadas = []
  const caixas = {}
  for (const el of tela.querySelectorAll('[data-layer-id]')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (el.getAnimations().some((a) => a.playState === 'running')) continue
    const m = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/)
    if (m) { const [, b, c] = m[1].split(',').map(Number); if (Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3) continue }
    const id = el.dataset.layerId
    camadas.push({ id, type: el.dataset.layerType, parentId: el.dataset.parentId || undefined, text: el.dataset.layerType === 'text' ? el.textContent : undefined })
    caixas[id] = { x: (r.x - T.x) / s, y: (r.y - T.y) / s, w: r.width / s, h: r.height / s, tela: { x: r.x, y: r.y, w: r.width, h: r.height } }
  }
  return { camadas, caixas, tamanho }
  })
}

await passo('Regra do 8 no editor: nas 15 telas da Nexora toda distância entre vizinhos e até o pai é múltipla de 8; "Ajustar espaçamento (8 px)" leva 36 → 32 e 60 → 56, com desfazer', async () => {
  await page.getByRole('button', { name: 'Abrir no editor →' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/, { timeout: 15000 })
  await esperarTelas(15)
  const conferir = async (rotulo) => {
    const { camadas, caixas, tamanho } = await lerCaixasDaTela()
    const r = distanciasForaDe8(camadas, new Map(Object.entries(caixas)), tamanho)
    if (!r.conferidas) throw new Error(`${rotulo}: nenhuma distância conferida`)
    return r.problemas
  }
  const problemas = []
  let conferidas = 0
  for (let i = 0; i < 15; i++) {
    await telas().nth(i).click()
    await page.waitForTimeout(500)
    const { camadas, caixas, tamanho } = await lerCaixasDaTela()
    const r = distanciasForaDe8(camadas, new Map(Object.entries(caixas)), tamanho)
    conferidas += r.conferidas
    problemas.push(...r.problemas.map((p) => `tela ${i + 1}: ${p}`))
  }
  if (!conferidas) throw new Error('nenhuma distância conferida')
  if (problemas.length) throw new Error(`${problemas.length} distância(s) fora do 8 em ${conferidas} conferidas:\n${problemas.slice(0, 40).join('\n')}`)
  console.log(`  regra do 8: ${conferidas} distâncias conferidas nas 15 telas, 0 fora`)

  // um frame de auto layout com dois ou mais filhos numa linha (cartões): o vão vira 36 e depois 60 à mão — o
  // comando leva para 32 e 56 (a escala), e um desfazer volta
  const gapCampo = page.getByLabel('Espaço entre itens', { exact: true })
  const vaoEntreFilhos = async (id) => {
    const { caixas, camadas } = await lerCaixasDaTela()
    const fs = camadas.filter((c) => c.parentId === id).map((c) => caixas[c.id]).sort((a, b) => a.x - b.x || a.y - b.y)
    return Math.max(fs[1].x - (fs[0].x + fs[0].w), fs[1].y - (fs[0].y + fs[0].h))
  }
  let alvo = null
  for (let i = 0; i < 15 && !alvo; i++) {
    await telas().nth(i).click()
    await page.waitForTimeout(300)
    const { camadas, caixas } = await lerCaixasDaTela()
    // (o clique seleciona a camada de cima da árvore, como no Figma: o frame tem de ser de primeiro nível)
    const candidatos = camadas.filter((c) => c.type === 'frame' && !c.parentId && camadas.filter((f) => f.parentId === c.id).length >= 2 && !camadas.some((f) => f.parentId === c.id && f.type === 'shape' && Math.min(caixas[f.id].w, caixas[f.id].h) <= 6))
    const dentroDe = (o, id) => { let p = o; while (p && p.id !== id) p = camadas.find((q) => q.id === p.parentId); return !!p }
    for (const c of candidatos) {
      const b = caixas[c.id]
      // canto do frame sem nenhuma camada de fora dele por cima: o clique seleciona o frame
      const ponto = { x: b.tela.x + 2, y: b.tela.y + 2 }
      const coberto = camadas.some((o) => !dentroDe(o, c.id) && camadas.indexOf(o) > camadas.indexOf(c) && caixas[o.id].tela.x <= ponto.x && caixas[o.id].tela.x + caixas[o.id].tela.w >= ponto.x && caixas[o.id].tela.y <= ponto.y && caixas[o.id].tela.y + caixas[o.id].tela.h >= ponto.y)
      if (coberto || (await vaoEntreFilhos(c.id)) < 8) continue
      await page.mouse.click(ponto.x, ponto.y)
      await page.waitForTimeout(150)
      if (await gapCampo.count()) { alvo = { id: c.id, tela: i }; break }
    }
  }
  if (!alvo) throw new Error('nenhum frame de auto layout com dois filhos para o teste do comando')
  const vaoOriginal = await vaoEntreFilhos(alvo.id)
  for (const [torto, certo] of [[36, 32], [60, 56]]) {
    await gapCampo.fill(String(torto))
    await gapCampo.press('Enter')
    await page.waitForTimeout(150)
    if (Math.round(await vaoEntreFilhos(alvo.id)) !== torto) throw new Error(`vão não ficou em ${torto}: ${await vaoEntreFilhos(alvo.id)}`)
    const antes = await conferir(`tela ${alvo.tela + 1} torta`)
    if (!antes.some((p) => p.endsWith(`= ${torto}`))) throw new Error(`a conferência não viu o vão de ${torto}: ${antes.join('; ') || 'nada'}`)
    // o comando, pelo menu de contexto da tela
    const area = await page.getByTestId('canvas-area').boundingBox()
    await page.mouse.click(area.x + 12, area.y + area.height - 12, { button: 'right' })
    await page.getByRole('menu', { name: 'Ações' }).getByRole('menuitem', { name: 'Ajustar espaçamento (8 px)' }).click()
    await page.waitForTimeout(300)
    if (Math.round(await vaoEntreFilhos(alvo.id)) !== certo) throw new Error(`o comando levou ${torto} para ${await vaoEntreFilhos(alvo.id)}, não ${certo}`)
    const depois = await conferir(`tela ${alvo.tela + 1} ajustada`)
    if (depois.length) throw new Error(`depois do comando ainda fora do 8: ${depois.slice(0, 8).join('; ')}`)
    console.log(`  comando: vão de ${torto} → ${certo}; fora do 8 antes ${antes.length}, depois ${depois.length}`)
    // um passo de desfazer volta o vão torto; o seguinte, o original
    await page.getByRole('button', { name: /^Desfazer/ }).first().click()
    await page.waitForTimeout(200)
    if (Math.round(await vaoEntreFilhos(alvo.id)) !== torto) throw new Error(`desfazer não voltou o vão de ${torto}: ${await vaoEntreFilhos(alvo.id)}`)
    await page.getByRole('button', { name: /^Desfazer/ }).first().click()
    await page.waitForTimeout(200)
    if (Math.round(await vaoEntreFilhos(alvo.id)) !== Math.round(vaoOriginal)) throw new Error(`desfazer não voltou o vão original ${vaoOriginal}: ${await vaoEntreFilhos(alvo.id)}`)
    // o frame continua selecionado para a próxima rodada
    if (!(await gapCampo.count())) { const b = (await lerCaixasDaTela()).caixas[alvo.id]; await page.mouse.click(b.tela.x + 2, b.tela.y + 2) }
  }
  await page.screenshot({ path: `${SHOTS}/18b-editor-regra-do-8.png` })
  await page.getByText('Salvando o projeto…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})
})

// ---------- manual da marca (PDF fictício gerado aqui): leitura sem IA, revisão, resumo simulado, kit e telas
const MANUAL_PDF = `${SHOTS}/manual-vela.pdf`
fs.writeFileSync(MANUAL_PDF, gerarManualFicticio({ jsPDF, createCanvas }))

await passo('Criar com IA: manual da marca (PDF) no passo da marca → cores com papéis, fontes, logo e regras reconhecidos; aplicado e salvo no kit', async () => {
  await page.goto(`${BASE}/app/criar?prompt=${encodeURIComponent('Plano 2027 da Vela Energia para a diretoria')}&telas=6`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Decisões antes do plano' }).waitFor({ timeout: 15000 })
  await page.getByLabel('Arquivos do manual da marca').setInputFiles(MANUAL_PDF)
  const rev = page.getByRole('region', { name: 'Revisão do manual da marca' })
  await rev.waitFor({ timeout: 30000 })
  if ((await rev.getByLabel('Papel da cor #0B4F8A').inputValue()) !== 'principal') throw new Error('papel principal')
  if ((await rev.getByLabel('Papel da cor #0E1726').inputValue()) !== 'fundoEscuro') throw new Error('papel fundo escuro')
  if ((await rev.getByRole('button', { name: /^Fonte do manual: títulos: / }).getAttribute('aria-label')) !== 'Fonte do manual: títulos: Montserrat') throw new Error('fonte títulos')
  await rev.getByTestId('aviso-fonte-textos').getByText('Helvetica Neue', { exact: false }).waitFor()
  await rev.getByRole('list', { name: 'Não faz' }).getByText('Não use gradientes nas cores da marca.').waitFor()
  await rev.getByRole('list', { name: 'Tom de voz' }).getByText(/otimismo/).waitFor()
  if (!/barato/.test(await rev.getByTestId('termos-evitar').innerText())) throw new Error('termos')
  await rev.getByRole('button', { name: 'Usar a imagem 1 do manual como logo' }).click()
  await page.getByAltText(/^Logo/).first().waitFor({ timeout: 15000 })
  const antes = await saldoNoCabecalho()
  await rev.getByRole('button', { name: /^Resumir com IA · 1 crédito/ }).click()
  await page.getByText(/Resumo simulado \(demonstração\) · 1 crédito/).waitFor({ timeout: 15000 })
  if (antes - (await saldoNoCabecalho()) !== 1) throw new Error(`resumo cobrou ${antes - (await saldoNoCabecalho())}`)
  await page.screenshot({ path: `${SHOTS}/19-criar-manual-revisao.png`, fullPage: true })
  await rev.getByRole('button', { name: 'Aplicar à marca' }).click()
  await page.getByTestId('manual-aplicado').waitFor()
  if ((await page.getByLabel('Código da cor 1').inputValue()).toUpperCase() !== '#0B4F8A') throw new Error('cor 1')
  if ((await page.getByLabel('Código da cor 2').inputValue()).toUpperCase() !== '#0E1726') throw new Error('cor 2')
  if ((await page.getByRole('button', { name: /^Fonte dos títulos: / }).getAttribute('aria-label')) !== 'Fonte dos títulos: Montserrat') throw new Error('fonte aplicada')
  if ((await page.getByLabel('Nome da marca').inputValue()) !== 'Vela Energia') throw new Error('nome: ' + await page.getByLabel('Nome da marca').inputValue())
  await page.getByRole('button', { name: 'Salvar como kit de marca' }).click()
  await page.getByRole('button', { name: 'Usar o kit Vela Energia' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/19b-criar-manual-aplicado.png`, fullPage: true })
})

await passo('Criar com IA: com o manual, as telas geradas no demo usam as cores e as fontes da marca; o kit traz o manual de volta', async () => {
  await page.getByRole('button', { name: 'Criar o plano →' }).click()
  await page.getByText('Plano · 6 telas').waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 6 telas').waitFor({ timeout: 90000 })
  await page.waitForTimeout(800)
  const r = await page.locator('[data-layer-id]').evaluateAll((els) => {
    const fontes = new Set(); const cores = new Set()
    for (const e of els) for (const x of [e, ...e.querySelectorAll('*')]) { const st = getComputedStyle(x); if ((x.textContent || '').trim() && x.children.length === 0) fontes.add(st.fontFamily.split(',')[0].replace(/"/g, '').trim()); cores.add(st.backgroundColor); cores.add(st.color); cores.add(st.fill) }
    return { fontes: [...fontes], cores: [...cores] }
  })
  if (!r.fontes.includes('Montserrat')) throw new Error('sem Montserrat')
  if (r.fontes.some((f) => /Geist/.test(f))) throw new Error('fonte fora da marca: ' + r.fontes)
  if (!r.cores.includes('rgb(11, 79, 138)')) throw new Error('sem a cor principal')
  await page.screenshot({ path: `${SHOTS}/19c-criar-manual-telas.png`, fullPage: true })
  await page.getByText('Salvando o projeto…').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {})
  await page.goto(`${BASE}/app/criar?prompt=${encodeURIComponent('Outra apresentação da Vela')}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Usar o kit Vela Energia' }).click()
  await page.getByTestId('manual-aplicado').waitFor()
  await page.screenshot({ path: `${SHOTS}/19d-criar-kit-com-manual.png` })
})

/** Cor (RGB) de um ponto da tela do editor (px da cena), lida de uma captura de 1 px. */
async function corNaTela(cx, cy) {
  const tela = await page.getByTestId('canvas').boundingBox()
  const s = tela.width / 1920
  const img = await loadImage(await page.screenshot({ clip: { x: Math.round(tela.x + cx * s), y: Math.round(tela.y + cy * s), width: 1, height: 1 } }))
  const cv = createCanvas(1, 1)
  cv.getContext('2d').drawImage(img, 0, 0)
  return [...cv.getContext('2d').getImageData(0, 0, 1, 1).data.slice(0, 3)]
}
/** Espera o resumo do que o canvas das guias desenha (null = nada desenhado). */
async function esperarGuias(valor, ms = 3000) {
  const d = page.getByTestId('guias-layout')
  const ler = async () => ((await d.count()) ? await d.getAttribute('data-guias') : null)
  let v = await ler()
  for (let t = 0; t < ms && v !== valor; t += 100) { await page.waitForTimeout(100); v = await ler() }
  if (v !== valor) throw new Error(`guias desenhadas: ${v}, esperado ${valor}`)
}

await passo('Guias de layout: 12 colunas e grade de 8, editar, ⌃⇧4, encaixe na coluna, fora do /p e do PNG, desfazer', async () => {
  // tela nova e vazia no projeto do começo do fluxo
  await page.goto(urlEditorE2E)
  await esperarTelas(3)
  await telas().nth(2).click() // a tela nova entra depois da atual: fica por último
  await page.getByRole('button', { name: 'Nova tela', exact: true }).first().click()
  await page.locator('footer').getByText('04 / 04', { exact: true }).waitFor()
  const secao = page.getByRole('region', { name: 'Guias de layout' })
  await secao.waitFor()
  await esperarGuias(null)
  // predefinição: 12 colunas (margem 64 e calha 24 numa tela de 1920)
  await secao.getByRole('button', { name: 'Guias prontas' }).click()
  await page.getByRole('menuitem', { name: '12 colunas' }).click()
  await esperarGuias('12 colunas')
  await secao.getByRole('button', { name: 'Editar guia: 12 colunas' }).click()
  const pop = page.getByRole('dialog', { name: 'Guia de layout: Colunas' })
  await pop.waitFor()
  if ((await pop.getByLabel('Margem').inputValue()) !== '64' || (await pop.getByLabel('Calha').inputValue()) !== '24') throw new Error('padrão das colunas fora da regra do 8')
  // o primeiro campo (quantidade) vem focado e selecionado: digitar troca o valor
  await page.keyboard.type('6')
  await page.keyboard.press('Enter')
  for (const [campo, v] of [['Margem', '120'], ['Calha', '48']]) { await pop.getByLabel(campo).fill(v); await pop.getByLabel(campo).press('Enter') }
  await esperarGuias('6 colunas')
  await secao.getByRole('button', { name: 'Editar guia: 6 colunas' }).waitFor()
  // tipo: Esquerda fixa a largura que as colunas tinham (240) e a margem vira deslocamento; Esticar volta ao "Auto"
  await escolher(pop.getByLabel('Tipo das colunas'), 'start')
  if ((await esperarValor(pop.getByLabel('Largura das colunas'), 240)) !== 240) throw new Error('largura fixa ≠ 240 ao sair do esticar')
  await pop.getByLabel('Deslocamento').waitFor()
  await escolher(pop.getByLabel('Tipo das colunas'), 'stretch')
  if (!(await pop.getByLabel('Largura das colunas').isDisabled())) throw new Error('largura deveria ser Auto ao esticar')
  // tipo da guia (topo do popover): colunas → linhas → colunas
  await escolher(pop.getByLabel('Tipo da guia'), 'rows')
  await esperarGuias('6 linhas')
  await escolher(page.getByRole('dialog', { name: 'Guia de layout: Linhas' }).getByLabel('Tipo da guia'), 'columns')
  await esperarGuias('6 colunas')
  await page.getByRole('button', { name: 'Fechar guia' }).click()
  // "+": grade de 8, já com o popover aberto
  await secao.getByRole('button', { name: 'Adicionar guia de layout' }).click()
  const popGrade = page.getByRole('dialog', { name: 'Guia de layout: Grade' })
  if ((await popGrade.getByLabel('Tamanho da grade').inputValue()) !== '8') throw new Error('grade nova não é de 8')
  await page.getByRole('button', { name: 'Fechar guia' }).click()
  await secao.getByRole('button', { name: 'Editar guia: Grade 8px' }).waitFor()
  // no zoom de ajuste a célula fica com ~3 px: a grade some sozinha; a 100% aparece
  await esperarGuias('6 colunas')
  if ((await page.getByTestId('guias-layout').getAttribute('data-grade-miuda')) !== 'true') throw new Error('grade miúda deveria sumir no zoom de ajuste')
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Control+0')
  await esperarGuias('6 colunas|Grade 8px')
  await page.screenshot({ path: `${SHOTS}/20-guias-zoom-100.png` })
  await page.locator('footer').getByRole('button', { name: 'Ajustar', exact: true }).click()
  await esperarGuias('6 colunas')
  // desfazer e refazer a grade
  await page.keyboard.press('Control+z')
  await secao.getByRole('button', { name: 'Editar guia: Grade 8px' }).waitFor({ state: 'detached' })
  await page.keyboard.press('Control+Shift+z')
  await secao.getByRole('button', { name: 'Editar guia: Grade 8px' }).waitFor()
  // desenho: a coluna fica tingida, a calha não
  const coluna = await corNaTela(240, 300)
  const calha = await corNaTela(384, 300)
  if (!(coluna[1] < calha[1] - 8)) throw new Error(`coluna sem cor no editor: coluna ${coluna}, calha ${calha}`)
  await page.screenshot({ path: `${SHOTS}/21-guias-editor.png` })
  // ⌃⇧4 esconde e mostra todas, com o aviso
  await page.keyboard.press('Control+Shift+Digit4')
  await page.getByText('Guias de layout escondidas').waitFor()
  await esperarGuias(null)
  await page.keyboard.press('Control+Shift+Digit4')
  await page.getByRole('status').filter({ hasText: 'Guias de layout visíveis' }).getByRole('button', { name: 'Esconder' }).waitFor()
  await esperarGuias('6 colunas')
  await page.screenshot({ path: `${SHOTS}/22-guias-aviso.png` })
  // arrastar uma camada: a borda encaixa na coluna (408) com a guia vermelha; com Ctrl, fica livre
  await page.getByRole('tab', { name: 'Adicionar' }).click()
  await page.getByRole('button', { name: 'Forma', exact: true }).click()
  for (const [campo, v] of [['Largura', '240'], ['Posição X', '200'], ['Posição Y', '400']]) { await page.getByLabel(campo, { exact: true }).fill(v); await page.getByLabel(campo, { exact: true }).press('Enter') }
  const campoX = page.getByLabel('Posição X')
  if ((await esperarValor(campoX, 200)) !== 200) throw new Error('forma não foi para x=200')
  const tela = await page.getByTestId('canvas').boundingBox()
  const s = tela.width / 1920
  // desfazer tira a seleção: cada arraste começa com x = 200
  const arrastar = async (alvoX, ctrl) => {
    const x0 = 200
    const ini = { x: tela.x + (x0 + 120) * s, y: tela.y + 544 * s }
    await page.mouse.move(ini.x, ini.y)
    if (ctrl) await page.keyboard.down('Control')
    await page.mouse.down()
    for (let k = 1; k <= 8; k++) await page.mouse.move(ini.x + ((alvoX - x0) * s * k) / 8, ini.y)
    const guias = await page.locator('[data-guia="v"]').count()
    await page.mouse.up()
    if (ctrl) await page.keyboard.up('Control')
    return guias
  }
  const guiasNoArraste = await arrastar(413, false)
  const xEncaixe = await esperarValor(campoX, 408)
  if (xEncaixe !== 408) throw new Error(`não encaixou na coluna: x=${xEncaixe}`)
  if (!guiasNoArraste) throw new Error('sem guia vermelha no encaixe da coluna')
  await page.keyboard.press('Control+z')
  await page.mouse.click(tela.x + 320 * s, tela.y + 544 * s)
  if ((await esperarValor(campoX, 200)) !== 200) throw new Error('desfazer não voltou a forma')
  await arrastar(413, true)
  await page.waitForTimeout(200)
  const xLivre = Number(await campoX.inputValue())
  if (xLivre === 408 || Math.abs(xLivre - 413) > 3) throw new Error(`com Ctrl deveria ficar livre perto de 413: x=${xLivre}`)
  await page.keyboard.press('Control+z')
  await page.mouse.click(tela.x + 320 * s, tela.y + 544 * s)
  if ((await esperarValor(campoX, 200)) !== 200) throw new Error('desfazer não voltou a forma (arraste livre)')
  // exportação PNG: só a tela, sem guias (a coluna fica com a cor da calha)
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Escala' }).getByRole('radio', { name: '1×' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('menuitem', { name: 'Exportar tela atual' }).click()])
  const png = await loadImage(fs.readFileSync(await dl.path()))
  const cv = createCanvas(png.width, png.height)
  cv.getContext('2d').drawImage(png, 0, 0)
  const naColuna = [...cv.getContext('2d').getImageData(240, 300, 1, 1).data.slice(0, 3)]
  const naCalha = [...cv.getContext('2d').getImageData(384, 300, 1, 1).data.slice(0, 3)]
  if (png.width !== 1920 || naColuna.some((c, i) => Math.abs(c - naCalha[i]) > 2)) throw new Error(`guias no PNG: coluna ${naColuna}, calha ${naCalha} (${png.width}px)`)
  await esperarSalvo()
  // visualizador /p: publica, gera um link e vai à tela 04 — nenhuma guia
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  const dlg = page.getByRole('dialog', { name: 'Compartilhar' })
  await dlg.getByRole('button', { name: 'Publicar' }).click()
  await page.getByText(/Revisão \d+ publicada/).waitFor({ timeout: 10000 })
  await dlg.getByRole('button', { name: 'Gerar link' }).click()
  await dlg.getByText('Seu link (exibido uma única vez)').waitFor()
  const link = (await dlg.locator('code').first().textContent()).trim()
  await dlg.getByRole('button', { name: 'Fechar', exact: true }).click()
  const p = await ctx.newPage()
  await p.goto(link)
  await contador(p, '01 / 04').waitFor({ timeout: 10000 })
  await p.keyboard.press('End')
  await contador(p, '04 / 04').waitFor()
  await p.waitForTimeout(600)
  if (await p.locator('[data-testid="guias-layout"]').count()) throw new Error('guias no visualizador')
  await p.screenshot({ path: `${SHOTS}/23-guias-visualizador.png` })
  await p.close()
})

await passo('AC-14 Reduced motion respeitado (animações encurtadas)', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${BASE}/p/demo_cafe_aurora_proposta_01_token_fixo_xx`)
  await contador(page, '01 / 06').waitFor()
  const dur = await page.locator('[data-layer-id="titulo"]').evaluate((el) => getComputedStyle(el).animationDuration)
  if (dur !== '0.001s' && dur !== '0.15s') throw new Error('duração ' + dur)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(`${BASE}/p/demo_cafe_aurora_proposta_01_token_fixo_xx`)
  await contador(page, '01 / 06').waitFor()
  const normal = await page.locator('[data-layer-id="titulo"]').evaluate((el) => getComputedStyle(el).animationDuration)
  if (normal !== '0.8s') throw new Error('duração sem reduced motion ' + normal)
})

await passo('Texto com estilo em partes: selecionar "Hector" ao editar e mudar cor e peso só dele; a caixa com largura automática acompanha', async () => {
  await page.goto(`${BASE}/app/projects/pr-atlas/edit`)
  await page.getByRole('button', { name: 'Nova tela no fim' }).click()
  await page.keyboard.press('t')
  const tela = await page.getByTestId('canvas').boundingBox()
  await page.mouse.click(tela.x + tela.width / 2 - 100, tela.y + tela.height / 2)
  await page.keyboard.type('Lucas Hector')
  for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowLeft')
  await page.getByText('Só no trecho', { exact: false }).waitFor()
  const hex = page.getByLabel('Cor do trecho', { exact: true })
  await hex.click()
  await hex.fill('5965F2')
  await hex.press('Enter')
  const larguraAntes = Number(await page.getByLabel('Largura').inputValue())
  await page.getByLabel('Peso').click()
  await page.getByRole('option', { name: /^Bold/ }).first().click()
  const trechos = page.getByTestId('canvas').locator('[data-trecho]')
  await trechos.first().waitFor()
  const r = await trechos.first().evaluate((e) => ({ t: e.textContent, c: getComputedStyle(e).color, w: getComputedStyle(e).fontWeight }))
  if (r.t !== 'Hector' || r.c !== 'rgb(89, 101, 242)' || r.w !== '700') throw new Error(`trecho errado: ${JSON.stringify(r)}`)
  await page.waitForFunction((a) => Number(document.querySelector('[aria-label="Largura"]')?.value) > a, larguraAntes)
  // "Texto todo" volta a aplicar no texto inteiro
  await page.getByRole('button', { name: 'Texto todo' }).click()
  await page.getByLabel('Cor do texto', { exact: true }).waitFor()
})

await browser.close()
console.log('\n' + passos.join('\n'))
console.log(`\nErros de console/página: ${erros.length}`)
erros.slice(0, 20).forEach((e) => console.log('  ', e))
process.exit(passos.some((p) => p.startsWith('✘')) || erros.length ? 1 : 0)
