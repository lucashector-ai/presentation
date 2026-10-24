import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { neon } from '@neondatabase/serverless'
import { tentar } from './sonda-sala.mjs'

/**
 * Colaboração em tempo real no MODO REAL, com duas pessoas em dois navegadores (contextos isolados):
 * Ana cria um projeto, o plano Free recusa convite, no Studio ela convida o Bruno por e-mail; o Bruno cria a conta,
 * aceita e cai no editor. Os dois se veem (avatares, cursores com nome, seleção), uma edição aparece na outra tela
 * (com a latência medida), edições simultâneas em camadas diferentes se somam, o desfazer de cada um só desfaz o
 * que ele fez, o Bruno cai da rede, edita offline e volta sincronizado, e depois de recarregar está tudo no banco.
 * No fim, a sala recusa quem não tem sessão, quem vem de outro site e quem saiu da equipe.
 *
 * Rodar contra um BRANCH de teste do Neon (o script recusa o production): cria dois usuários a cada execução.
 *   NODE_USE_ENV_PROXY=1 E2E_BASE_URL=http://localhost:3105 node e2e/colaboracao.mjs
 * Lê DATABASE_URL e NEON_BRANCH do .env.local (só para pôr o workspace da Ana no plano Studio, como faria a cobrança).
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3105'
const SHOTS = process.env.E2E_CAPTURAS || new URL('./capturas/colaboracao/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
try { process.loadEnvFile('.env.local') } catch { /* variáveis já no ambiente */ }
if (!process.env.DATABASE_URL || !process.env.NEON_BRANCH || /^(production|main)$/i.test(process.env.NEON_BRANCH)) {
  console.error('Rode contra um branch de teste do Neon (NEON_BRANCH no .env.local), nunca o production.')
  process.exit(2)
}
const db = neon(process.env.DATABASE_URL)

const erros = []
/** Respostas de erro que o passo testa de propósito: 403 da recusa do plano Free, 404 de quem saiu da equipe. */
let aceitarStatus = null
const esperados = []
const passos = []
const medidas = []
const ok = (nome) => { passos.push(`✔ ${nome}`); console.log('✔', nome) }
const falha = (nome, e) => { passos.push(`✘ ${nome}: ${e?.message ?? e}`); console.log('✘', nome, e?.message ?? e) }

const browser = await chromium.launch()
const vigiar = (p, quem) => {
  p.on('pageerror', (e) => erros.push(`pageerror ${quem} (${p.url()}): ${e.message}`))
  p.on('console', (m) => {
    if (m.type() !== 'error' || m.text().startsWith('Failed to fetch RSC payload')) return
    // o WebSocket recusado de propósito (rede derrubada) aparece como erro de conexão no console
    if (/WebSocket connection to .* failed|ERR_INTERNET_DISCONNECTED/.test(m.text())) return
    if (aceitarStatus && m.text().includes(`status of ${aceitarStatus}`)) { esperados.push(m.text()); return }
    erros.push(`console ${quem} (${p.url()}): ${m.text()}`)
  })
}
const contexto = async (quem) => {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
  c.on('page', (p) => vigiar(p, quem))
  return c
}
const ctxA = await contexto('Ana')
const ctxB = await contexto('Bruno')
const ana = await ctxA.newPage()
const bruno = await ctxB.newPage()

async function passo(nome, fn) {
  try { await fn(); ok(nome) } catch (e) {
    falha(nome, e)
    await ana.screenshot({ path: path.join(SHOTS, `falha-${passos.length}-ana.png`) }).catch(() => {})
    await bruno.screenshot({ path: path.join(SHOTS, `falha-${passos.length}-bruno.png`) }).catch(() => {})
  }
}
const esperarHidratacao = (p) => p.waitForFunction(() => { const b = document.querySelector('form button, main button'); return !!b && Object.keys(b).some((k) => k.startsWith('__react')) }, null, { timeout: 30000 })
async function esperarSalvo(p, timeout = 20000) {
  await p.waitForTimeout(150)
  await p.locator('header [role=status]', { hasText: 'Todas as alterações foram salvas.' }).waitFor({ timeout })
}
const canvas = (p) => p.getByTestId('canvas')
/** Hora (Date.now do navegador) em que o texto aparece no canvas da página; recusa depois de 10 s. */
const quandoAparecer = (p, texto) => comAviso(p.evaluate((t) => new Promise((resolve, reject) => {
  const alvo = document.querySelector('[data-testid=canvas]')
  if (!alvo) return reject(new Error('canvas ausente'))
  const ver = () => { if (alvo.textContent?.includes(t)) { resolve(Date.now()); return true } return false }
  if (ver()) return
  const obs = new MutationObserver(() => { if (ver()) obs.disconnect() })
  obs.observe(alvo, { subtree: true, childList: true, characterData: true })
  setTimeout(() => { obs.disconnect(); reject(new Error(`"${t}" não apareceu em 10 s`)) }, 10000)
}), texto))
/** Promessa que pode falhar antes de ser esperada: sem isso o Node derruba o processo (unhandled rejection). */
function comAviso(p) { p.catch(() => {}); return p }
const detalhe = (p, id) => p.evaluate(async (pid) => (await (await fetch(`/api/projects/${pid}`)).json()).data, id)
const camadas = async (p, id) => (await detalhe(p, id)).scenes[0].layers
const posicao = (p, id) => p.locator(`[data-testid=canvas] [data-layer-id="${id}"]`).evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }))

const carimbo = Date.now().toString(36)
const A = { nome: 'Ana Colab', email: `e2e-colab-ana-${carimbo}@exemplo.com`, id: '' }
const B = { nome: 'Bruno Colab', email: `e2e-colab-bruno-${carimbo}@exemplo.com`, id: '' }
const SENHA = 'senhaforte-e2e-123'
let idProjeto = ''
let idTexto = ''
let idForma = ''
let linkConvite = ''

async function cadastrar(p, u) {
  await p.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await esperarHidratacao(p)
  await p.getByLabel('Nome').fill(u.nome)
  await p.getByLabel('E-mail').fill(u.email)
  await p.getByLabel('Senha').fill(SENHA)
  await p.getByRole('button', { name: 'Criar conta' }).click()
  await p.waitForURL(`${BASE}/app`, { timeout: 30000 })
  u.id = (await p.evaluate(async () => (await (await fetch('/api/conta')).json()).data)).usuario.id
}

await passo('Ana cria a conta e um projeto com um texto e uma forma (salvos pela sala no banco)', async () => {
  await cadastrar(ana, A)
  await ana.getByRole('link', { name: 'Novo projeto' }).first().click()
  await ana.waitForURL(/\/app\/novo/)
  await ana.getByLabel('Nome do projeto').fill(`Colab ${carimbo}`)
  await ana.getByRole('button', { name: 'Criar projeto' }).click()
  await ana.waitForURL(/\/app\/projects\/[0-9a-f-]{36}\/edit/, { timeout: 30000 })
  idProjeto = ana.url().match(/projects\/([0-9a-f-]{36})\//)[1]
  await ana.getByRole('tab', { name: 'Blocos' }).click()
  await ana.getByRole('button', { name: 'Texto', exact: true }).click()
  await ana.getByLabel('Conteúdo do texto').fill('Título da Ana')
  await ana.evaluate(() => document.activeElement?.blur())
  await ana.getByRole('button', { name: 'Forma', exact: true }).click()
  await canvas(ana).getByText('Título da Ana').waitFor()
  await esperarSalvo(ana)
  const ls = await camadas(ana, idProjeto)
  idTexto = ls.find((l) => l.type === 'text').id
  idForma = ls.find((l) => l.type === 'shape').id
  if (!idTexto || !idForma) throw new Error('as duas camadas não chegaram ao banco')
})

await passo('Plano Free é individual: o convite é recusado com o motivo (limite em lib/planos.ts)', async () => {
  aceitarStatus = 403
  await ana.getByRole('button', { name: 'Convidar pessoas para editar' }).click()
  const dlg = ana.getByRole('dialog', { name: 'Convidar para editar' })
  await dlg.getByLabel('E-mail de quem vai entrar').fill(B.email)
  await dlg.getByRole('button', { name: 'Convidar', exact: true }).click()
  await ana.getByText(/O plano Free é individual/).first().waitFor({ timeout: 15000 })
  await dlg.getByRole('button', { name: 'Fechar', exact: true }).click()
  aceitarStatus = null
})

await passo('No plano Studio, Ana convida o Bruno por e-mail (papel: pode editar)', async () => {
  // a cobrança ainda não existe: o teste põe o workspace no Studio direto no branch de teste
  const r = await db`update public.workspaces set plan_id = 'studio' where owner_user_id = ${A.id}::uuid returning id`
  if (r.length !== 1) throw new Error('workspace da Ana não encontrado')
  await ana.getByRole('button', { name: 'Convidar pessoas para editar' }).click()
  const dlg = ana.getByRole('dialog', { name: 'Convidar para editar' })
  await dlg.getByLabel('E-mail de quem vai entrar').fill(B.email)
  await dlg.getByLabel('Papel do convite').click()
  await ana.locator('[role=listbox] [role=option][data-valor="editor"]').click()
  await dlg.getByRole('button', { name: 'Convidar', exact: true }).click()
  linkConvite = (await dlg.getByTestId('link-convite').textContent({ timeout: 15000 })).trim()
  if (!/\/app\/convite\/[A-Za-z0-9_-]{43}$/.test(linkConvite)) throw new Error(`link inesperado: ${linkConvite}`)
  await dlg.getByRole('list', { name: 'Convites pendentes' }).getByText(B.email).waitFor()
  await dlg.getByRole('button', { name: 'Fechar', exact: true }).click()
})

await passo('Bruno cria a conta, abre o convite, aceita e cai no editor do projeto da Ana', async () => {
  await cadastrar(bruno, B)
  await bruno.goto(linkConvite.replace(/^https?:\/\/[^/]+/, BASE))
  await bruno.getByRole('heading', { name: /Ana Colab convidou você para Espaço de Ana/ }).waitFor({ timeout: 30000 })
  await bruno.getByRole('button', { name: 'Aceitar convite' }).click()
  await bruno.waitForURL(new RegExp(`/app/projects/${idProjeto}/edit`), { timeout: 30000 })
  await canvas(bruno).getByText('Título da Ana').waitFor({ timeout: 30000 })
})

await passo('Presença: cada um vê o avatar do outro no cabeçalho, com a tela em que está', async () => {
  await ana.getByRole('list', { name: 'Pessoas neste projeto' }).getByRole('button', { name: /^Bruno Colab na tela 01/ }).waitFor({ timeout: 15000 })
  await bruno.getByRole('list', { name: 'Pessoas neste projeto' }).getByRole('button', { name: /^Ana Colab na tela 01/ }).waitFor({ timeout: 15000 })
})

await passo('Cursores: o cursor de cada um aparece na tela do outro, com nome, e se move junto', async () => {
  const caixaA = await canvas(ana).boundingBox()
  const caixaB = await canvas(bruno).boundingBox()
  await bruno.mouse.move(caixaB.x + caixaB.width * 0.7, caixaB.y + caixaB.height * 0.3)
  await ana.mouse.move(caixaA.x + caixaA.width * 0.25, caixaA.y + caixaA.height * 0.7)
  const cursorBnaA = ana.locator('[data-testid=cursor-remoto][data-nome="Bruno Colab"]')
  const cursorAnaB = bruno.locator('[data-testid=cursor-remoto][data-nome="Ana Colab"]')
  await cursorBnaA.waitFor({ timeout: 10000 })
  await cursorAnaB.waitFor({ timeout: 10000 })
  const antes = await cursorBnaA.evaluate((el) => el.style.transform)
  await bruno.mouse.move(caixaB.x + caixaB.width * 0.4, caixaB.y + caixaB.height * 0.55, { steps: 8 })
  await ana.waitForFunction((t) => document.querySelector('[data-testid=cursor-remoto][data-nome="Bruno Colab"]')?.style.transform !== t, antes, { timeout: 5000 })
  // a Ana seleciona o texto: o Bruno vê a seleção dela destacada na cor dela
  await canvas(ana).getByText("Título da Ana").click({ position: { x: 8, y: 8 } })
  await bruno.locator('[data-testid=selecao-remota]', { hasText: 'Ana' }).waitFor({ timeout: 10000 })
  await ana.mouse.move(caixaA.x + caixaA.width * 0.62, caixaA.y + caixaA.height * 0.62)
  await bruno.waitForTimeout(300)
  await ana.screenshot({ path: path.join(SHOTS, 'colab-ana-ve-bruno.png') })
  await bruno.screenshot({ path: path.join(SHOTS, 'colab-bruno-ve-ana.png') })
  // as duas telas lado a lado: cada uma mostra o cursor (e a seleção) da outra pessoa
  const lado = await ctxA.newPage()
  await lado.setViewportSize({ width: 1440, height: 470 })
  const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(SHOTS, f)).toString('base64')}`
  await lado.setContent(`<body style="margin:0;display:flex;gap:8px;background:#111;font:600 13px sans-serif;color:#fff"><figure style="margin:0;flex:1"><figcaption style="padding:6px">Tela da Ana (vê o cursor do Bruno)</figcaption><img style="width:100%" src="${img('colab-ana-ve-bruno.png')}"></figure><figure style="margin:0;flex:1"><figcaption style="padding:6px">Tela do Bruno (vê o cursor e a seleção da Ana)</figcaption><img style="width:100%" src="${img('colab-bruno-ve-ana.png')}"></figure></body>`)
  await lado.screenshot({ path: path.join(SHOTS, 'colab-dois-cursores.png') })
  await lado.close()
})

await passo('Ana edita o texto e o Bruno vê em menos de ~200 ms', async () => {
  // o Bruno marca a hora em que o texto novo aparece no canvas dele; a Ana, a hora em que digitou
  const espera = quandoAparecer(bruno, 'Editado pela Ana')
  const campo = ana.getByLabel('Conteúdo do texto')
  await campo.click()
  await campo.press('ControlOrMeta+a')
  const t0 = await ana.evaluate(() => Date.now())
  await campo.pressSequentially('Editado pela Ana', { delay: 0 })
  const t1 = await espera
  // do início da digitação até aparecer no outro navegador (inclui digitar 16 caracteres pelo Playwright)
  const latencia = t1 - t0
  medidas.push(`Edição de texto da Ana → tela do Bruno: ${latencia} ms (desde a primeira tecla)`)
  await ana.evaluate(() => document.activeElement?.blur())
  if (latencia > 1500) throw new Error(`demorou ${latencia} ms`)
  // latência de uma mudança só (uma tecla): mede várias vezes
  const amostras = []
  for (let i = 0; i < 5; i++) {
    const sufixo = ` ${i}`
    const esperaB = quandoAparecer(bruno, `Editado pela Ana${sufixo}`)
    await campo.click()
    await campo.press('End')
    const ini = await ana.evaluate(() => Date.now())
    await campo.pressSequentially(sufixo, { delay: 0 })
    amostras.push((await esperaB) - ini)
    await campo.press('ControlOrMeta+a')
    await campo.pressSequentially('Editado pela Ana', { delay: 0 })
  }
  await ana.evaluate(() => document.activeElement?.blur())
  amostras.sort((a, b) => a - b)
  medidas.push(`Uma tecla na Ana → visível no Bruno: mediana ${amostras[2]} ms (amostras ${amostras.join(', ')} ms)`)
  if (amostras[2] > 200) throw new Error(`mediana ${amostras[2]} ms acima de 200 ms`)
  await esperarSalvo(ana)
})

await passo('Edição simultânea em camadas diferentes: as duas mudanças ficam (nada se perde)', async () => {
  const [antesTexto, antesForma] = await Promise.all([posicao(ana, idTexto), posicao(ana, idForma)])
  const d0 = await camadas(ana, idProjeto)
  const x0 = d0.find((l) => l.id === idTexto).x
  const y0 = d0.find((l) => l.id === idForma).y
  await canvas(ana).locator(`[data-layer-id="${idTexto}"]`).click({ position: { x: 8, y: 8 } })
  await canvas(bruno).locator(`[data-layer-id="${idForma}"]`).click()
  // ao mesmo tempo: Ana empurra o texto 200 px para a direita, Bruno empurra a forma 100 px para baixo
  await Promise.all([
    (async () => { for (let i = 0; i < 20; i++) await ana.keyboard.press('Shift+ArrowRight') })(),
    (async () => { for (let i = 0; i < 10; i++) await bruno.keyboard.press('Shift+ArrowDown') })(),
  ])
  await Promise.all([esperarSalvo(ana), esperarSalvo(bruno)])
  const d1 = await camadas(bruno, idProjeto)
  const t = d1.find((l) => l.id === idTexto)
  const f = d1.find((l) => l.id === idForma)
  if (t.x !== x0 + 200 || f.y !== y0 + 100) throw new Error(`no banco: texto x=${t.x} (esperado ${x0 + 200}), forma y=${f.y} (esperado ${y0 + 100})`)
  // e as duas telas mostram o mesmo
  const [pa, pb] = await Promise.all([Promise.all([posicao(ana, idTexto), posicao(ana, idForma)]), Promise.all([posicao(bruno, idTexto), posicao(bruno, idForma)])])
  if (JSON.stringify(pa) !== JSON.stringify(pb)) throw new Error(`telas diferentes: ${JSON.stringify(pa)} × ${JSON.stringify(pb)}`)
  if (pa[0].left <= antesTexto.left || pa[1].top <= antesForma.top) throw new Error('as camadas não se moveram no canvas')
})

await passo('Desfazer: o Ctrl+Z da Ana desfaz só o último passo dela; a forma do Bruno fica onde ele pôs', async () => {
  const d0 = await camadas(ana, idProjeto)
  const x = d0.find((l) => l.id === idTexto).x
  const y = d0.find((l) => l.id === idForma).y
  await canvas(ana).click({ position: { x: 5, y: 5 } })
  await ana.keyboard.press('ControlOrMeta+z')
  await Promise.all([esperarSalvo(ana), esperarSalvo(bruno)])
  await bruno.waitForTimeout(300)
  const d1 = await camadas(ana, idProjeto)
  const t = d1.find((l) => l.id === idTexto)
  const f = d1.find((l) => l.id === idForma)
  if (t.x !== x - 10) throw new Error(`o texto deveria voltar 10 px (x=${t.x}, antes ${x})`)
  if (f.y !== y) throw new Error(`a forma do Bruno mudou com o desfazer da Ana (y=${f.y}, antes ${y})`)
  // o Bruno também desfaz só o dele
  await canvas(bruno).click({ position: { x: 5, y: 5 } })
  await bruno.keyboard.press('ControlOrMeta+z')
  await Promise.all([esperarSalvo(ana), esperarSalvo(bruno)])
  const d2 = await camadas(bruno, idProjeto)
  if (d2.find((l) => l.id === idForma).y !== y - 10 || d2.find((l) => l.id === idTexto).x !== x - 10) throw new Error('o desfazer do Bruno mexeu no que não era dele')
})

await passo('Bruno cai da rede: vê "offline", continua editando; a Ana edita também; ao voltar, os dois sincronizam', async () => {
  await ctxB.setOffline(true)
  try {
    await bruno.locator('[data-testid=presenca] [role=status]', { hasText: 'Offline' }).waitFor({ timeout: 10000 })
    // a Ana vê o Bruno sair da sala
    await ana.getByRole('list', { name: 'Pessoas neste projeto' }).getByRole('button', { name: /^Bruno Colab/ }).waitFor({ state: 'detached', timeout: 15000 })
    await bruno.getByRole('tab', { name: 'Blocos' }).click()
    await bruno.getByRole('button', { name: 'Texto', exact: true }).click()
    await bruno.getByLabel('Conteúdo do texto').fill('Feito offline pelo Bruno')
    await bruno.evaluate(() => document.activeElement?.blur())
    await canvas(bruno).getByText('Feito offline pelo Bruno').waitFor()
    // a Ana muda o texto dela enquanto isso (seleciona pela lista de camadas: a forma cobre parte do texto)
    await ana.getByRole('tab', { name: 'Camadas' }).click()
    await ana.getByRole('tree', { name: 'Camadas da tela' }).getByRole('treeitem', { name: /Editado pela Ana/ }).click()
    await ana.getByLabel('Conteúdo do texto').fill('Ana editou com o Bruno fora')
    await ana.evaluate(() => document.activeElement?.blur())
    await esperarSalvo(ana)
    await bruno.screenshot({ path: path.join(SHOTS, 'colab-bruno-offline.png') })
  } finally {
    await ctxB.setOffline(false)
  }
  await canvas(bruno).getByText('Ana editou com o Bruno fora').waitFor({ timeout: 20000 })
  await canvas(ana).getByText('Feito offline pelo Bruno').waitFor({ timeout: 20000 })
  await Promise.all([esperarSalvo(ana), esperarSalvo(bruno)])
  await ana.getByRole('list', { name: 'Pessoas neste projeto' }).getByRole('button', { name: /^Bruno Colab/ }).waitFor({ timeout: 15000 })
})

await passo('Depois de recarregar as duas abas, tudo está salvo no banco', async () => {
  await Promise.all([ana.reload(), bruno.reload()])
  for (const p of [ana, bruno]) {
    await canvas(p).getByText('Ana editou com o Bruno fora').waitFor({ timeout: 30000 })
    await canvas(p).getByText('Feito offline pelo Bruno').waitFor({ timeout: 30000 })
  }
  // direto no banco (sem passar pela sala)
  const [linha] = await db`select content_json from public.project_scenes where project_id = ${idProjeto}::uuid order by order_index limit 1`
  const textos = linha.content_json.layers.filter((l) => l.type === 'text').map((l) => l.text)
  if (!textos.includes('Ana editou com o Bruno fora') || !textos.includes('Feito offline pelo Bruno')) throw new Error(`no banco: ${JSON.stringify(textos)}`)
  const [p] = await db`select current_revision from public.projects where id = ${idProjeto}::uuid`
  medidas.push(`Revisão do projeto no banco depois da sessão: ${p.current_revision} (gravada pela sala, sem nenhum 409)`)
})

await passo('Segurança da sala: sem sessão, de outro site ou fora da equipe não entra', async () => {
  const cookieB = (await ctxB.cookies()).map((c) => `${c.name}=${c.value}`).join('; ')
  const semSessao = await tentar(BASE, idProjeto, { origem: BASE })
  const outroSite = await tentar(BASE, idProjeto, { origem: 'https://malicioso.example', cookie: cookieB })
  const comSessao = await tentar(BASE, idProjeto, { origem: BASE, cookie: cookieB })
  if (semSessao.aberto || outroSite.aberto) throw new Error(`a sala aceitou: ${JSON.stringify({ semSessao, outroSite })}`)
  if (!comSessao.aberto || !comSessao.primeira?.startsWith('{"t":"bemvindo"')) throw new Error(`o Bruno (membro) não entrou: ${JSON.stringify(comSessao)}`)
  // a Ana remove o Bruno da equipe
  await ana.goto(`${BASE}/app/settings#equipe`)
  await ana.getByRole('list', { name: 'Membros' }).getByText(B.email).waitFor({ timeout: 20000 })
  await ana.getByRole('button', { name: `Remover ${B.nome}` }).click()
  await ana.getByText(`${B.nome} saiu do espaço.`).waitFor({ timeout: 15000 })
  const removido = await tentar(BASE, idProjeto, { origem: BASE, cookie: cookieB })
  if (removido.aberto) throw new Error('quem saiu da equipe ainda entra na sala')
  aceitarStatus = 404
  await bruno.reload()
  await bruno.getByText('Projeto não encontrado.').waitFor({ timeout: 30000 })
  aceitarStatus = null
})

await browser.close()
console.log('\n' + passos.join('\n'))
console.log('\n' + medidas.map((m) => `• ${m}`).join('\n'))
console.log(`\nErros de console/página: ${erros.length}${esperados.length ? ` (fora ${esperados.length} esperado(s): 403 da recusa do plano Free e 404 de quem saiu da equipe)` : ''}`)
for (const e of erros.slice(0, 20)) console.log('  ', e)
console.log(`\nUsuários de teste: ${A.email} (id ${A.id || '?'}), ${B.email} (id ${B.id || '?'}) — apague no branch de teste.`)
process.exit(passos.some((p) => p.startsWith('✘')) ? 1 : 0)
