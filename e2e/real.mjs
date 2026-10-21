import { chromium } from 'playwright'
import fs from 'node:fs'

/**
 * Fluxo ponta a ponta no MODO REAL (sem NEXT_PUBLIC_DEMO): Neon Auth, Neon Postgres e armazenamento de mídias de verdade.
 * cadastro → painel → projeto → editar e salvar → recarregar → enviar imagem → duas abas em tempo real → publicar → link →
 * convidado em aba anônima → sair → login volta ao destino.
 *
 * Rodar contra um BRANCH de teste do Neon (nunca o production): o teste cria um usuário novo a cada execução.
 *   E2E_BASE_URL=http://localhost:3104 node e2e/real.mjs
 * No fim imprime o e-mail e o id do usuário criado, para apagar (neon neon-auth user delete / SQL no branch).
 * Ver "Modo real local" no README para subir o app com o banco (npm run dev + e2e/saida-pelo-node.mjs).
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3104'
const SHOTS = new URL('./capturas/real/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const erros = []
const passos = []
const ok = (nome) => { passos.push(`✔ ${nome}`); console.log('✔', nome) }
const falha = (nome, e) => { passos.push(`✘ ${nome}: ${e?.message ?? e}`); console.log('✘', nome, e?.message ?? e) }

const browser = await chromium.launch()
const vigiar = (p) => {
  p.on('pageerror', (e) => erros.push(`pageerror (${p.url()}): ${e.message}`))
  p.on('console', (m) => {
    if (m.type() !== 'error' || m.text().startsWith('Failed to fetch RSC payload')) return
    erros.push(`console (${p.url()}): ${m.text()}`)
  })
}
const novoContexto = async (opcoes = {}) => {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', ...opcoes })
  c.on('page', vigiar)
  return c
}
const ctx = await novoContexto()
const page = await ctx.newPage()

async function passo(nome, fn) {
  try { await fn(); ok(nome) } catch (e) { falha(nome, e); await page.screenshot({ path: `${SHOTS}/falha-${passos.length}.png` }).catch(() => {}) }
}
async function esperarSalvo(p = page) {
  await p.waitForTimeout(150)
  await p.locator('header [role=status]', { hasText: 'Todas as alterações foram salvas.' }).waitFor({ timeout: 15000 })
}
const contador = (p, texto) => p.locator('.viewer-controles').getByText(texto, { exact: true })
const esperarHidratacao = (p = page) => p.waitForFunction(() => { const b = document.querySelector('form button, main button'); return !!b && Object.keys(b).some((k) => k.startsWith('__react')) }, null, { timeout: 30000 })
async function imagemCarregada(loc) {
  await loc.waitFor({ timeout: 15000 })
  await loc.page().waitForFunction((el) => el.complete && el.naturalWidth > 0, await loc.elementHandle(), { timeout: 15000 })
}

const carimbo = Date.now().toString(36)
const EMAIL = `e2e-real-${carimbo}@exemplo.com`
const EMAIL_2 = `e2e-real-${carimbo}-b@exemplo.com`
const SENHA = 'senhaforte-e2e-123'
const NOME_PROJETO = `Projeto Real ${carimbo}`
let idProjeto = ''
let idUsuario = ''
let idUsuario2 = ''

// PNG de teste: um screenshot pequeno de uma página local
{
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 640, height: 400 })
  await p.setContent('<body style="margin:0;background:#5965F2;display:flex;align-items:center;justify-content:center;height:100vh"><h1 style="font:600 64px sans-serif;color:#fff">imagem real</h1></body>')
  await p.screenshot({ path: `${SHOTS}/imagem.png` })
  await p.close()
  // SVG com script embutido: o servidor sanitiza no upload e só grava a versão limpa
  fs.writeFileSync(`${SHOTS}/vetor.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><script>alert(1)</script><circle cx="100" cy="100" r="80" fill="#E4572E" onclick="alert(2)"/></svg>')
}

await passo('Sem sessão, /app/settings vai para o login com o destino guardado', async () => {
  const anonimo = await novoContexto()
  const p = await anonimo.newPage()
  await p.goto(`${BASE}/app/settings`)
  await p.waitForURL(/\/login\?proximo=%2Fapp%2Fsettings/, { timeout: 30000 })
  await anonimo.close()
})

await passo('Cadastro no Neon Auth → painel com conta, plano e créditos do servidor', async () => {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await esperarHidratacao()
  await page.getByLabel('Nome').fill('Rita Real')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.waitForURL(`${BASE}/app`, { timeout: 30000 })
  await page.getByRole('heading', { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Rita\.$/ }).waitFor({ timeout: 20000 })
  // conta nova: plano Free e 50 créditos de boas-vindas (1 crédito = 1 tela; lib/planos.ts, db/migrations/0006), sem projetos
  await page.getByText('Plano Free', { exact: false }).first().waitFor()
  await page.getByText('50 créditos').first().waitFor()
  await page.getByRole('heading', { name: 'Nenhum projeto ainda' }).waitFor({ timeout: 20000 })
  const conta = await page.evaluate(async () => (await (await fetch('/api/conta')).json()).data)
  idUsuario = conta.usuario.id
  if (conta.usuario.email !== EMAIL.toLowerCase()) throw new Error(`conta inesperada: ${conta.usuario.email}`)
  await page.screenshot({ path: `${SHOTS}/01-painel-vazio.png` })
})

await passo('Criar projeto (POST /api/projects) abre o editor; renomear grava no servidor', async () => {
  await page.getByRole('link', { name: 'Novo projeto' }).first().click()
  await page.waitForURL(/\/app\/novo/)
  await page.getByLabel('Nome do projeto').fill(`${NOME_PROJETO} (rascunho)`)
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await page.waitForURL(/\/app\/projects\/[0-9a-f-]{36}\/edit/, { timeout: 30000 })
  idProjeto = page.url().match(/projects\/([0-9a-f-]{36})\//)[1]
  await page.getByRole('button', { name: 'Compartilhar' }).waitFor({ timeout: 20000 })
  if ((await page.getByLabel('Nome do projeto').inputValue()) !== `${NOME_PROJETO} (rascunho)`) throw new Error('nome do projeto não veio para o editor')
  await esperarSalvo()
  // renomear no cabeçalho do editor (PATCH /api/projects/:id)
  await page.getByLabel('Nome do projeto').fill(NOME_PROJETO)
  await page.evaluate(() => document.activeElement?.blur())
  for (let t = 0; t < 40; t++) {
    const nome = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`)).json()).data?.name, idProjeto)
    if (nome === NOME_PROJETO) return
    await page.waitForTimeout(250)
  }
  throw new Error('o novo nome não chegou ao servidor')
})

await passo('Editar e salvar uma tela (PUT /api/projects/:id/scenes com revisão)', async () => {
  await page.getByRole('tab', { name: 'Blocos' }).click()
  await page.getByRole('button', { name: 'Texto', exact: true }).click()
  await page.getByLabel('Conteúdo do texto').fill('Olá do banco real')
  await page.evaluate(() => document.activeElement?.blur())
  await page.getByTestId('canvas').getByText('Olá do banco real').waitFor()
  await esperarSalvo()
})

await passo('Recarregar mostra a edição vinda do servidor', async () => {
  await page.reload()
  await page.getByTestId('canvas').getByText('Olá do banco real').waitFor({ timeout: 30000 })
  const detalhe = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`)).json()).data, idProjeto)
  if (!JSON.stringify(detalhe.scenes).includes('Olá do banco real')) throw new Error('o texto não está nas cenas do servidor')
})

await passo('Enviar imagem (POST /api/assets/upload) e vê-la no canvas por /api/midias/:id', async () => {
  await page.getByRole('tab', { name: 'Arquivos' }).click()
  await page.getByRole('complementary', { name: 'Painel esquerdo' }).locator('input[type=file]').setInputFiles([`${SHOTS}/imagem.png`])
  await page.getByText(/adicionad[ao] à tela/).first().waitFor({ timeout: 30000 })
  const img = page.getByTestId('canvas').locator('img[src*="/api/midias/"]').first()
  await imagemCarregada(img)
  await esperarSalvo()
  // a imagem continua no canvas depois de recarregar (a cena referencia o asset do workspace)
  await page.reload()
  await imagemCarregada(page.getByTestId('canvas').locator('img[src*="/api/midias/"]').first())
  await page.getByRole('tab', { name: 'Arquivos' }).click()
  await page.getByRole('complementary', { name: 'Painel esquerdo' }).getByText('imagem.png').first().waitFor()
  await page.screenshot({ path: `${SHOTS}/02-editor-imagem.png` })
})

await passo('Enviar SVG: limpo no navegador, conferido no servidor (gravado sem script) e visível no canvas', async () => {
  await page.getByRole('complementary', { name: 'Painel esquerdo' }).locator('input[type=file]').setInputFiles([`${SHOTS}/vetor.svg`])
  await page.getByText(/Vetor adicionad[ao] à tela/).first().waitFor({ timeout: 30000 })
  const imgs = page.getByTestId('canvas').locator('img[src*="/api/midias/"]')
  await imagemCarregada(imgs.nth(1))
  const urls = await imgs.evaluateAll((els) => els.map((e) => e.getAttribute('src')))
  const textos = await page.evaluate(async (lista) => Promise.all(lista.map(async (u) => (await fetch(u)).text())), urls)
  const svg = textos.find((t) => t.includes('<svg'))
  if (!svg) throw new Error('o SVG enviado não está entre as mídias do canvas')
  if (/<script|onclick/i.test(svg)) throw new Error('o SVG gravado ainda tem script')
  await esperarSalvo()
})

await passo('Duas abas: a edição de uma aparece na outra em tempo real (sala de colaboração, sem 409)', async () => {
  const outra = await ctx.newPage()
  await outra.goto(`${BASE}/app/projects/${idProjeto}/edit`)
  await outra.getByTestId('canvas').getByText('Olá do banco real').waitFor({ timeout: 30000 })
  await outra.getByRole('tab', { name: 'Camadas' }).click()
  await outra.getByRole('tree', { name: 'Camadas da tela' }).getByRole('treeitem', { name: /Olá do banco real/ }).click()
  await outra.getByLabel('Conteúdo do texto').fill('Versão da outra aba')
  await outra.evaluate(() => document.activeElement?.blur())
  // a primeira aba vê na hora, sem recarregar nem escolher versão
  await page.getByTestId('canvas').getByText('Versão da outra aba').waitFor({ timeout: 15000 })
  await esperarSalvo(outra)
  await outra.close()
  // e continua gravando normalmente: a sala grava com a revisão certa (nenhum 409)
  await page.getByRole('tab', { name: 'Blocos' }).click()
  await page.getByRole('button', { name: 'Forma', exact: true }).click()
  await esperarSalvo(page)
  await page.screenshot({ path: `${SHOTS}/03-duas-abas.png` })
})

let urlLink = ''
await passo('Publicar (POST /api/projects/:id/publish) e gerar link', async () => {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
  const dlg = page.getByRole('dialog', { name: 'Compartilhar' })
  await dlg.getByText('ainda não publicado').waitFor()
  await dlg.getByRole('button', { name: 'Publicar' }).click()
  await page.getByText(/Revisão \d+ publicada/).waitFor({ timeout: 20000 })
  await dlg.getByText('Publicado e atualizado').waitFor()
  await dlg.getByRole('button', { name: 'Gerar link' }).click()
  await dlg.getByText('Seu link (exibido uma única vez)').waitFor({ timeout: 20000 })
  urlLink = (await dlg.locator('code').first().textContent()).trim()
  if (!/\/p\/[A-Za-z0-9_-]{43}$/.test(urlLink)) throw new Error('url inesperada ' + urlLink)
  await dlg.getByText(/^1 ativo$|Links criados · 1 ativo/).first().waitFor()
  await dlg.getByRole('button', { name: 'Fechar', exact: true }).click()
})

await passo('Convidado em aba anônima abre /p/:token pelo servidor, com a mídia', async () => {
  const anonimo = await novoContexto({ viewport: { width: 1280, height: 800 } })
  const p = await anonimo.newPage()
  const url = urlLink.replace(/^https?:\/\/[^/]+/, BASE)
  await p.goto(url)
  await contador(p, '01 / 01').waitFor({ timeout: 30000 })
  await p.getByText('Versão da outra aba').first().waitFor()
  await imagemCarregada(p.locator(`img[src*="/api/share/"]`).first())
  await p.screenshot({ path: `${SHOTS}/04-convidado.png` })
  await anonimo.close()
})

await passo('Painel e Enviados mostram o projeto publicado com link ativo', async () => {
  await page.goto(`${BASE}/app`)
  const card = page.locator('#projetos li', { hasText: NOME_PROJETO })
  await card.getByText('Enviado').waitFor({ timeout: 20000 })
  await card.getByText('1 tela').waitFor()
  await page.goto(`${BASE}/app/compartilhados`)
  await page.getByText(NOME_PROJETO).first().waitFor({ timeout: 20000 })
  await page.getByText('1 link ativo').waitFor()
  await page.screenshot({ path: `${SHOTS}/05-enviados.png` })
})

await passo('Painel: duplicar, arquivar/restaurar, lixeira (restaurar e excluir de vez)', async () => {
  await page.goto(`${BASE}/app`)
  const copia = `${NOME_PROJETO} (cópia)`
  await page.getByRole('button', { name: `Ações de ${NOME_PROJETO}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Duplicar' }).click()
  await page.getByText('Projeto duplicado.').waitFor({ timeout: 20000 })
  const cardCopia = page.locator('#projetos li', { hasText: copia })
  await cardCopia.getByText('Rascunho').waitFor()
  // arquivar e restaurar a cópia
  await page.getByRole('button', { name: `Ações de ${copia}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Arquivar' }).click()
  await page.getByRole('dialog', { name: 'Arquivar projeto?' }).getByRole('button', { name: 'Arquivar' }).click()
  await page.getByText('Projeto arquivado.').waitFor({ timeout: 20000 })
  await page.getByRole('tab', { name: /^Arquivados/ }).click()
  await page.getByRole('button', { name: `Ações de ${copia}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Restaurar' }).click()
  await page.getByText('Projeto restaurado.').waitFor({ timeout: 20000 })
  await page.getByRole('tab', { name: /^Todos/ }).click()
  // lixeira: mover, restaurar, mover de novo e excluir de vez
  await page.getByRole('button', { name: `Ações de ${copia}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()
  await page.getByRole('dialog', { name: 'Mover para a lixeira?' }).getByRole('button', { name: 'Mover para a lixeira' }).click()
  await page.getByText('Projeto movido para a lixeira.').waitFor({ timeout: 20000 })
  await page.goto(`${BASE}/app/lixeira`)
  await page.getByText(copia).waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'Restaurar' }).click()
  await page.getByText('Projeto restaurado.', { exact: false }).first().waitFor({ timeout: 20000 })
  await page.getByRole('heading', { name: 'A lixeira está vazia' }).waitFor()
  await page.goto(`${BASE}/app`)
  await page.getByRole('button', { name: `Ações de ${copia}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()
  await page.getByRole('dialog', { name: 'Mover para a lixeira?' }).getByRole('button', { name: 'Mover para a lixeira' }).click()
  await page.getByText('Projeto movido para a lixeira.').waitFor({ timeout: 20000 })
  await page.goto(`${BASE}/app/lixeira`)
  await page.getByRole('button', { name: `Excluir ${copia} definitivamente` }).click()
  await page.getByRole('dialog', { name: 'Excluir definitivamente?' }).getByRole('button', { name: 'Excluir para sempre' }).click()
  await page.getByText('Projeto excluído definitivamente.').waitFor({ timeout: 20000 })
  await page.reload()
  await page.getByRole('heading', { name: 'A lixeira está vazia' }).waitFor({ timeout: 20000 })
})

await passo('Biblioteca: envio sem projeto e lista vinda do servidor', async () => {
  await page.goto(`${BASE}/app/biblioteca`)
  await page.getByText('imagem.png').first().waitFor({ timeout: 20000 })
  await page.locator('input[type=file]').setInputFiles([`${SHOTS}/imagem.png`])
  await page.getByText('1 arquivo enviado para a biblioteca.').waitFor({ timeout: 30000 })
  await page.reload()
  await page.getByText('imagem.png').nth(1).waitFor({ timeout: 20000 })
  await imagemCarregada(page.locator('img[src*="/api/midias/"]').first())
})

let idKit = ''
let idLogo = ''
await passo('Criar com IA: logo enviado (POST /api/assets/upload), paleta do logo e kit de marca salvo no Neon', async () => {
  fs.writeFileSync(`${SHOTS}/logo.svg`, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120"><circle cx="60" cy="60" r="44" fill="#E4572E"/><rect x="130" y="34" width="250" height="22" rx="11" fill="#1F3B4D"/><rect x="130" y="66" width="160" height="22" rx="11" fill="#F2C14E"/></svg>')
  await page.goto(`${BASE}/app/criar?prompt=Pitch%20de%20uma%20padaria%20de%20bairro&formato=slides`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'A sua marca, antes de gerar' }).waitFor({ timeout: 30000 })
  await page.getByLabel('Arquivo do logo').setInputFiles(`${SHOTS}/logo.svg`)
  await page.getByText('Paletas do seu logo').waitFor({ timeout: 30000 })
  await page.getByLabel('Nome da marca').fill('Padaria Real')
  await page.getByRole('button', { name: 'Salvar como kit de marca' }).click()
  await page.getByRole('button', { name: 'Usar o kit Padaria Real' }).waitFor({ timeout: 20000 })
  const kits = await page.evaluate(async () => (await (await fetch('/api/marcas')).json()).data)
  if (kits.length !== 1 || kits[0].nome !== 'Padaria Real' || kits[0].cores[0] !== '#E4572E' || !kits[0].logo) throw new Error(`kit no servidor: ${JSON.stringify(kits)}`)
  idKit = kits[0].id
  idLogo = kits[0].logo.assetId
  // a mídia do logo é do workspace e é servida pela rota de mídias
  await imagemCarregada(page.getByAltText(/^Logo/).first())
})

await passo('Kits de marca: outra conta não vê, não altera e não apaga o kit (filtro por workspace)', async () => {
  // contexto sem vigia de console: as respostas 404/400 abaixo são o que se espera (o navegador as registra como erro)
  const outra = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
  const p = await outra.newPage()
  await p.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await esperarHidratacao(p)
  await p.getByLabel('Nome').fill('Outra Pessoa')
  await p.getByLabel('E-mail').fill(EMAIL_2)
  await p.getByLabel('Senha').fill(SENHA)
  await p.getByRole('button', { name: 'Criar conta' }).click()
  await p.waitForURL(`${BASE}/app`, { timeout: 30000 })
  const r = await p.evaluate(async ({ id, logo }) => {
    const lista = (await (await fetch('/api/marcas')).json()).data
    const corpo = JSON.stringify({ nome: 'Roubado', cores: [], logo: null })
    const patch = await fetch(`/api/marcas/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: corpo })
    const del = await fetch(`/api/marcas/${id}`, { method: 'DELETE' })
    // usar o logo de outro workspace num kit próprio é recusado
    const comLogo = await fetch('/api/marcas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Meu', cores: [], logo: { assetId: logo, largura: 400, altura: 120, cor: '#E4572E' } }) })
    const conta = (await (await fetch('/api/conta')).json()).data
    return { lista, patch: patch.status, del: del.status, comLogo: comLogo.status, id: conta.usuario.id }
  }, { id: idKit, logo: idLogo })
  idUsuario2 = r.id
  if (r.lista.length !== 0 || r.patch !== 404 || r.del !== 404 || r.comLogo !== 400) throw new Error(`isolamento: ${JSON.stringify(r)}`)
  // sem sessão, a rota recusa
  // pelo navegador (o contexto de API do Playwright sai pelo Node, que pode não ter a rota de rede do navegador)
  const semSessao = await browser.newContext()
  const pa = await semSessao.newPage()
  await pa.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  const anon = await pa.evaluate(async () => (await fetch('/api/marcas')).status)
  await semSessao.close()
  if (anon !== 401) throw new Error(`/api/marcas sem sessão respondeu ${anon}`)
  await outra.close()
})

await passo('Criar com IA: rota /api/ai/roteiro com sessão → projeto salvo no servidor', async () => {
  await page.getByRole('navigation', { name: 'Passos' }).getByRole('button', { name: /Tamanho/ }).click()
  await page.getByRole('radio', { name: '6 telas', exact: true }).click()
  await page.getByRole('button', { name: 'Ir para revisar' }).click()
  await page.getByRole('button', { name: 'Gerar roteiro →' }).click()
  await page.getByText('Roteiro · 6 telas').waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 6 telas').waitFor({ timeout: 60000 })
  await page.getByRole('button', { name: 'Abrir no editor →' }).click()
  await page.waitForURL(/\/app\/projects\/[0-9a-f-]{36}\/edit/, { timeout: 30000 })
  const id = page.url().match(/projects\/([0-9a-f-]{36})\//)[1]
  const detalhe = await page.evaluate(async (pid) => (await (await fetch(`/api/projects/${pid}`)).json()).data, id)
  if (detalhe.scenes.length !== 6) throw new Error(`esperava 6 telas no servidor, há ${detalhe.scenes.length}`)
  // o logo do kit entrou na capa (camada de imagem com a mídia do workspace), sem IA
  if (!JSON.stringify(detalhe.scenes[0]).includes(idLogo)) throw new Error('logo não está na capa salva no servidor')
  // sem ANTHROPIC_API_KEY a rota usa o gerador local e não cobra; com a chave, debita no servidor
  const conta = await page.evaluate(async () => (await (await fetch('/api/conta')).json()).data)
  console.log(`   saldo depois da IA: ${conta.creditos.saldo} créditos (${conta.creditos.movimentos.length} movimento(s) no extrato)`)
})

await passo('Sair e voltar: login leva de volta ao destino (/app/projects/:id)', async () => {
  await page.goto(`${BASE}/app`)
  await page.getByRole('button', { name: 'Menu do usuário' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await page.waitForURL(/\/login/, { timeout: 20000 })
  await page.goto(`${BASE}/app/projects/${idProjeto}`)
  await page.waitForURL(/\/login\?proximo=/, { timeout: 30000 })
  await esperarHidratacao()
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha').fill(SENHA)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(`${BASE}/app/projects/${idProjeto}`, { timeout: 30000 })
  await page.getByRole('heading', { level: 1, name: NOME_PROJETO }).waitFor({ timeout: 20000 })
})

await browser.close()
console.log('\n' + passos.join('\n'))
console.log(`\nErros de console/página: ${erros.length}`)
for (const e of erros.slice(0, 20)) console.log('  ', e)
console.log(`\nUsuários de teste criados: ${EMAIL} (id ${idUsuario || '?'}) e ${EMAIL_2} (id ${idUsuario2 || '?'}) — apague no branch de teste.`)
process.exit(passos.some((p) => p.startsWith('✘')) ? 1 : 0)
