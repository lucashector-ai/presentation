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
async function esperarTelas(n, p = page) {
  for (let t = 0; t < 5000; t += 100) { if ((await telas(p).count()) === n) return; await p.waitForTimeout(100) }
  throw new Error(`esperava ${n} telas, há ${await telas(p).count()}`)
}
/** Contador do visualizador ("01 / 03"), só dentro dos controles do viewer. */
const contador = (p, texto, raiz) => (raiz ?? p).locator('.viewer-controles').getByText(texto, { exact: true })
const pad = (n) => String(n).padStart(2, '0')

// PNGs de teste: screenshots pequenos do site
// (espera a hidratação: capturar a página no meio dela gera aviso de atributos divergentes)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
for (let i = 1; i <= 3; i++) { await page.setViewportSize({ width: 800 + i * 100, height: 600 }); await page.screenshot({ path: `${SHOTS}/upload-${i}.png` }) }
await page.setViewportSize({ width: 1440, height: 900 })

await passo('Marketing renderiza com CTA e planos', async () => {
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.locator('section#precos').waitFor()
  if (!(await page.locator('a[href^="/signup"]').count()) && !(await page.locator('a[href^="/criar"]').count())) throw new Error('sem CTA para cadastro/criação')
  await page.screenshot({ path: `${SHOTS}/01-marketing.png`, fullPage: true })
})

await passo('AC-01 Cadastro → verificação → painel', async () => {
  await page.goto(`${BASE}/signup`)
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
  await page.getByRole('tab', { name: 'Arquivos' }).click()
  await page.getByRole('button', { name: 'Enviar ou soltar arquivos' }).waitFor()
  await page.getByRole('complementary', { name: 'Painel esquerdo' }).locator('input[type=file]').setInputFiles([`${SHOTS}/ruim.txt`])
  await page.getByText('Formato .txt não suportado', { exact: false }).first().waitFor({ timeout: 10000 })
  await page.getByText('Falhou', { exact: true }).first().waitFor({ timeout: 3000 })
  await page.getByRole('tab', { name: 'Telas' }).click()
  await esperarTelas(3)
})

await passo('AC-04 Texto e hotspot: adicionar, mover por teclado (Shift+→ = 10 px), alinhar, ordenar', async () => {
  await page.getByRole('tab', { name: 'Telas' }).click()
  await telas().nth(0).click()
  await page.locator('footer').getByText('01 / 03', { exact: true }).waitFor()
  await page.getByRole('tab', { name: 'Blocos' }).click()
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('Olá, cliente')
  const campoX = page.getByLabel('Posição X')
  const xAntes = Number(await campoX.inputValue())
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Shift+ArrowRight')
  const xDepois = await esperarValor(campoX, xAntes + 10)
  if (xDepois !== xAntes + 10) throw new Error(`nudge falhou ${xAntes} → ${xDepois}`)
  await page.getByRole('button', { name: 'Alinhar à esquerda' }).click()
  const xEsq = await esperarValor(campoX, 0)
  if (xEsq !== 0) throw new Error(`alinhar à esquerda deu x=${xEsq}`)
  await page.getByRole('button', { name: 'Centralizar na horizontal' }).click()
  const largura = Number(await page.getByLabel('Largura').inputValue())
  const centro = Math.round((1920 - largura) / 2)
  const xCentro = await esperarValor(campoX, centro)
  if (Math.abs(xCentro - centro) > 1) throw new Error(`centralizar deu x=${xCentro}, esperado ${centro}`)
  await page.getByRole('button', { name: 'Trazer para frente' }).click()
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
  await page.getByRole('tab', { name: 'Telas' }).click()
  await esperarTelas(3)
  await page.getByRole('button', { name: '+ Nova tela' }).click()
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
  await dlg.getByText('Publique o projeto no editor antes de criar links.', { exact: false }).waitFor()
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
  await page.getByRole('tab', { name: 'Telas' }).click()
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

await passo('Criar com IA: roteiro de 6 telas → apresentação → editor', async () => {
  await page.goto(`${BASE}/criar?prompt=Pitch%20da%20Aurora%2C%20startup%20de%20energia%20solar&formato=slides`)
  await page.getByRole('radio', { name: '6 telas', exact: true }).click()
  if ((await page.getByRole('radio', { name: '6 telas', exact: true }).getAttribute('aria-checked')) !== 'true') throw new Error('6 telas não selecionado')
  await page.getByRole('button', { name: 'Gerar roteiro →' }).click()
  await page.getByText('Roteiro · 6 telas').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 6 telas').waitFor({ timeout: 30000 })
  await page.screenshot({ path: `${SHOTS}/12-criar-ia.png` })
  await page.getByRole('button', { name: 'Abrir no editor →' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/, { timeout: 15000 })
  await esperarTelas(6)
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

await browser.close()
console.log('\n' + passos.join('\n'))
console.log(`\nErros de console/página: ${erros.length}`)
erros.slice(0, 20).forEach((e) => console.log('  ', e))
process.exit(passos.some((p) => p.startsWith('✘')) || erros.length ? 1 : 0)
