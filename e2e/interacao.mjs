import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'

/**
 * Fluidez das interações (cliques, navegação e gestos do editor) com CPU throttling (CDP, 4× por padrão).
 * Mede, no modo demonstração:
 *  - cliques: latência clique → próxima pintura (Event Timing, como o INP) em seleção, telas, abas, menu e modais;
 *  - gestos no canvas (mover, redimensionar, girar, pan e zoom com a roda) com eventos a 60 Hz: tempo do evento
 *    até a pintura seguinte (p95), quadros, long tasks e quantos commits/componentes o React renderiza por evento;
 *  - navegação: painel → editor → painel → Criar com IA e o visualizador /p/… (clique até o conteúdo na tela).
 *
 * Rodar com o app no ar em modo demo (NEXT_PUBLIC_DEMO=1 npm run build && npm run preview):
 *   E2E_BASE_URL=http://localhost:8787 node e2e/interacao.mjs
 * Variáveis: INTERACAO_TAXA=4 (throttling), INTERACAO_JSON=arquivo.json (grava os números),
 * INTERACAO_SEM_LIMITES=1 (só mede, não reprova),
 * INTERACAO_REPETICOES=3 (passadas de cada gesto; vale a mediana).
 * Sai com código 1 se algum número passar do orçamento (LIMITES, abaixo) — eles valem para 4×.
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const TAXA = Number(process.env.INTERACAO_TAXA || 4)
const JSON_SAIDA = process.env.INTERACAO_JSON
const SEM_LIMITES = !!process.env.INTERACAO_SEM_LIMITES
const REPETICOES = Math.max(1, Number(process.env.INTERACAO_REPETICOES || 3))

/**
 * Orçamentos com 4× (com folga para máquina ocupada). Referência antes das otimizações, no mesmo ambiente:
 * selecionar no canvas ~170 ms; arrastar com quadro p95 33 ms (30 fps), evento → pintura p95 ~75–100 ms e ~500
 * componentes por pointermove; pan/zoom ~390/750 componentes por evento.
 */
const LIMITES = {
  clique: 200, // ms, clique → pintura (o INP "bom" é ≤ 200 ms)
  cliqueCanvas: 120, // ms, selecionar/tirar seleção no canvas e trocar de tela (o canvas responde sozinho; painéis vêm depois)
  gestoP95: 80, // ms, evento do ponteiro/roda → pintura (p95)
  quadroP95: 25, // ms, intervalo entre quadros durante o gesto (p95): sem quadro perdido a 60 Hz
  componentesGesto: 200, // componentes renderizados por pointermove ao mover/redimensionar/girar
  componentesViewport: 120, // idem por evento de pan/zoom
  navegacao: 1000, // ms, clique num link → conteúdo da página nova
}
const CLIQUES_CANVAS = /canvas|vazio|selecionar de novo|trocar de tela/

// ---------- instrumentação (antes de qualquer script da página) ----------
function instrumentar() {
  // gancho do React DevTools: conta commits e (quando ligado) componentes que renderizaram de verdade
  const vistos = { atual: new WeakSet() }
  window.__perf = { commits: 0, componentes: 0, contarComponentes: false, nomes: new Map() }
  const TIPOS = new Set([0, 1, 11, 14, 15]) // função, classe, forwardRef, memo, memo simples
  const percorrer = (raiz) => {
    const novos = new WeakSet()
    // região da tela (para saber quem renderiza): o elemento com aria-label/data-testid mais próximo acima
    const pilha = [[raiz, 'raiz']]
    while (pilha.length) {
      const [f, regiao] = pilha.pop()
      novos.add(f)
      const pr = f.tag === 5 ? f.memoizedProps : null
      const aqui = pr && (pr['aria-label'] === 'Painel esquerdo' || pr['aria-label'] === 'Propriedades' || pr['data-testid'] === 'canvas-area' || pr['data-testid'] === 'canvas' || f.type === 'header' || f.type === 'footer') ? (pr['aria-label'] || pr['data-testid'] || f.type) : regiao
      // fibra trocada neste commit (não estava na árvore anterior) com PerformedWork = renderizou
      if (TIPOS.has(f.tag) && !vistos.atual.has(f) && (f.flags & 1)) {
        window.__perf.componentes++
        window.__perf.nomes.set(aqui, (window.__perf.nomes.get(aqui) ?? 0) + 1)
      }
      if (f.sibling) pilha.push([f.sibling, regiao])
      if (f.child) pilha.push([f.child, aqui])
    }
    vistos.atual = novos
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(), supportsFiber: true, isDisabled: false,
    inject(r) { this.renderers.set(this.renderers.size + 1, r); return this.renderers.size },
    onCommitFiberRoot(_id, raiz) { window.__perf.commits++; if (window.__perf.contarComponentes) percorrer(raiz.current) },
    onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, onScheduleFiberRoot() {}, checkDCE() {},
  }
  // Event Timing (latência de interação, como o INP)
  window.__eventos = []
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__eventos.push({ nome: e.name, id: e.interactionId, dur: e.duration, ini: e.startTime }) }).observe({ type: 'event', durationThreshold: 16, buffered: true }) } catch { /* sem suporte */ }
  // long tasks
  window.__longas = []
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longas.push({ ini: e.startTime, dur: e.duration }) }).observe({ type: 'longtask', buffered: true }) } catch { /* sem suporte */ }
  // gestos: tempo de cada pointermove/wheel até a pintura seguinte (rAF + mensagem = depois do quadro)
  window.__gesto = null
  const canal = new MessageChannel()
  const fila = []
  canal.port1.onmessage = () => { const t = fila.shift(); if (t != null && window.__gesto) window.__gesto.lat.push(performance.now() - t) }
  const registrar = (ev) => {
    const g = window.__gesto
    if (!g) return
    g.eventos++
    const t = ev.timeStamp
    requestAnimationFrame(() => { fila.push(t); canal.port2.postMessage(0) })
  }
  window.addEventListener('pointermove', registrar, { capture: true, passive: true })
  window.addEventListener('wheel', registrar, { capture: true, passive: true })
  const quadro = (t) => { if (window.__gesto) window.__gesto.quadros.push(t); requestAnimationFrame(quadro) }
  requestAnimationFrame(quadro)
  // navegação: momento do clique (pointerdown) para medir até o conteúdo novo aparecer
  window.addEventListener('pointerdown', () => { window.__cliqueEm = performance.now() }, { capture: true })
}

const p95 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0 }
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0 }
const r1 = (x) => Math.round(x * 10) / 10
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
await ctx.addInitScript(instrumentar)
const page = await ctx.newPage()
const erros = []
page.on('pageerror', (e) => erros.push(e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to fetch RSC payload')) erros.push(m.text()) })
const cdp = await ctx.newCDPSession(page)
const throttle = (rate) => cdp.send('Emulation.setCPUThrottlingRate', { rate })

await page.goto(`${BASE}/`)
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('apresentacoes.sessao', JSON.stringify({ email: 'interacao@exemplo.com', em: Date.now() })) })

const resultados = { cliques: [], gestos: [], navegacao: [] }

// ---------- cliques ----------
/** Executa a ação e devolve a maior latência de interação (Event Timing) que ela gerou. */
async function clique(nome, acao, { espera = 400 } = {}) {
  await page.evaluate(() => { window.__eventos = []; window.__perf.commits = 0 })
  await throttle(TAXA)
  await acao()
  await page.waitForTimeout(espera)
  await throttle(1)
  const r = await page.evaluate(() => ({ eventos: window.__eventos, commits: window.__perf.commits }))
  const porInteracao = new Map()
  for (const e of r.eventos) porInteracao.set(e.id, Math.max(porInteracao.get(e.id) ?? 0, e.dur))
  const ms = Math.max(0, ...porInteracao.values())
  resultados.cliques.push({ nome, ms, commits: r.commits })
  console.log(`clique  ${nome.padEnd(34)} ${String(ms).padStart(5)} ms · commits ${r.commits}`)
}

// ---------- gestos ----------
await cdp.send('Performance.enable')
/** Tempo acumulado (s) de script, layout, recálculo de estilo e tarefas do processo da página. */
async function metricas() {
  const { metrics } = await cdp.send('Performance.getMetrics')
  const v = (n) => metrics.find((m) => m.name === n)?.value ?? 0
  return { scriptMs: v('ScriptDuration'), layoutMs: v('LayoutDuration'), estiloMs: v('RecalcStyleDuration'), tarefasMs: v('TaskDuration') }
}
/** Envia eventos a 60 Hz sem esperar o navegador (como a mão do usuário) e mede pintura, quadros e long tasks. */
async function gesto(nome, { inicio, passos, fim, tipo = 'mouse' }) {
  // 1ª passada: conta componentes renderizados por evento (percorrer a árvore pesa: os tempos vêm das seguintes)
  // todas com throttling: o que o React adia para quando sobra tempo não entra na conta se não sobrar
  const medidas = {}
  const tempos = []
  for (const contar of [true, ...Array(REPETICOES).fill(false)]) {
    await inicio()
    await page.evaluate((c) => { window.__perf.commits = 0; window.__perf.componentes = 0; window.__perf.nomes = new Map(); window.__perf.contarComponentes = c; window.__longas = []; window.__gesto = { lat: [], quadros: [], eventos: 0, t0: performance.now() } }, contar)
    const lista = typeof passos === 'function' ? passos() : passos
    await throttle(TAXA)
    const m0 = await metricas()
    const pendentes = []
    const t0 = Date.now()
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i]
      pendentes.push(tipo === 'roda'
        ? cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: p.dx ?? 0, deltaY: p.dy ?? 0, modifiers: p.mod ?? 0 })
        : cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 }))
      const alvo = t0 + (i + 1) * (1000 / 60)
      await dormir(Math.max(0, alvo - Date.now()))
    }
    await Promise.all(pendentes)
    await fim()
    await page.waitForTimeout(300)
    const m1 = await metricas()
    await throttle(1)
    const custo = Object.fromEntries(Object.keys(m1).map((k) => [k, Math.round((m1[k] - m0[k]) * 1000)]))
    const r = await page.evaluate(() => {
      const g = window.__gesto
      window.__gesto = null
      window.__perf.contarComponentes = false
      const intervalos = g.quadros.slice(1).map((t, i) => t - g.quadros[i])
      return { lat: g.lat, intervalos, eventos: g.eventos, commits: window.__perf.commits, componentes: window.__perf.componentes, nomes: [...window.__perf.nomes].sort((a, b) => b[1] - a[1]).slice(0, 8), longas: window.__longas.filter((l) => l.ini >= g.t0) }
    })
    if (contar) Object.assign(medidas, { componentesPorEvento: r1(r.componentes / Math.max(1, r.eventos)), commitsPorEvento: r1(r.commits / Math.max(1, r.eventos)), quemRenderiza: r.nomes })
    else tempos.push({ ...custo, eventos: r.eventos, p50: r1(mediana(r.lat)), p95: r1(p95(r.lat)), max: r1(Math.max(0, ...r.lat)), quadroP95: r1(p95(r.intervalos)), longas: r.longas.length, longasMs: Math.round(r.longas.reduce((s, l) => s + l.dur, 0)) })
  }
  // mediana das repetições (uma passada atrapalhada pela máquina ocupada não decide sozinha)
  for (const k of Object.keys(tempos[0])) medidas[k] = mediana(tempos.map((t) => t[k]))
  resultados.gestos.push({ nome, ...medidas })
  console.log(`gesto   ${nome.padEnd(14)} p50 ${String(medidas.p50).padStart(6)} · p95 ${String(medidas.p95).padStart(6)} · máx ${String(medidas.max).padStart(6)} ms · quadro p95 ${String(medidas.quadroP95).padStart(5)} · long tasks ${medidas.longas} (${medidas.longasMs} ms) · eventos ${medidas.eventos} · commits/evento ${medidas.commitsPorEvento} · componentes/evento ${medidas.componentesPorEvento} · script ${medidas.scriptMs} ms · layout ${medidas.layoutMs} ms · estilo ${medidas.estiloMs} ms · tarefas ${medidas.tarefasMs} ms`)
  console.log(`        quem renderiza: ${medidas.quemRenderiza.map(([n, c]) => `${n}×${c}`).join(' ')}`)
}

// ---------- navegação ----------
/** Clica e mede até o seletor aparecer (desde o pointerdown, no relógio da página). */
async function navegar(nome, alvo, seletor) {
  await throttle(TAXA)
  // também o primeiro quadro em que algo mudou na página (resposta visível ao clique) e a troca de URL
  const espera = page.evaluate((sel) => new Promise((ok) => {
    const url0 = location.href
    let mudou = null
    let urlEm = null
    const obs = new MutationObserver(() => { if (window.__cliqueEm != null && mudou == null) mudou = performance.now() - window.__cliqueEm })
    obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    const t = () => {
      if (window.__cliqueEm != null && urlEm == null && location.href !== url0) urlEm = performance.now() - window.__cliqueEm
      if (window.__cliqueEm != null && document.querySelector(sel)) { obs.disconnect(); ok({ ms: performance.now() - window.__cliqueEm, resposta: mudou, url: urlEm }) } else requestAnimationFrame(t)
    }
    window.__cliqueEm = null
    requestAnimationFrame(t)
  }), seletor)
  await alvo.click()
  const r = await espera
  const ms = Math.round(r.ms)
  await throttle(1)
  resultados.navegacao.push({ nome, ms, respostaMs: Math.round(r.resposta ?? r.ms), urlMs: Math.round(r.url ?? r.ms) })
  console.log(`navega  ${nome.padEnd(34)} ${String(ms).padStart(5)} ms · 1ª resposta visível ${Math.round(r.resposta ?? r.ms)} ms · URL ${Math.round(r.url ?? r.ms)} ms`)
}

// ---------- roteiro ----------
await page.goto(`${BASE}/app`)
await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30000 })
await page.waitForTimeout(1500) // prefetch dos links visíveis

await navegar('painel → editor', page.getByRole('link', { name: 'Abrir no editor' }).first(), '[data-testid=canvas] [data-layer-id]')
await page.getByRole('button', { name: 'Compartilhar' }).waitFor()
await page.waitForTimeout(1200)
const area = page.getByTestId('canvas-area')

// camada de tamanho médio, visível e sem trava, para clicar e arrastar
async function escolherCamada() {
  return page.evaluate(() => {
    const tela = document.querySelector('[data-testid=canvas]').getBoundingClientRect()
    const els = [...document.querySelectorAll('[data-testid=canvas] [data-layer-id]')]
    const cand = els.map((el) => ({ id: el.dataset.layerId, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 60 && r.height > 30 && r.width < tela.width * 0.6 && r.left > tela.left && r.top > tela.top && r.right < tela.right && r.bottom < tela.bottom)
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)
    const c = cand[Math.floor(cand.length / 2)] ?? cand[0]
    return c ? { id: c.id, x: c.r.left + c.r.width / 2, y: c.r.top + c.r.height / 2, w: c.r.width, h: c.r.height } : null
  })
}
const camada = await escolherCamada()
if (!camada) throw new Error('nenhuma camada adequada no canvas')
const vazio = await area.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + 30, y: r.bottom - 30 } })

await clique('selecionar camada no canvas', () => page.mouse.click(camada.x, camada.y))
await clique('clicar no vazio (tirar seleção)', () => page.mouse.click(vazio.x, vazio.y))
await clique('selecionar de novo', () => page.mouse.click(camada.x, camada.y))
await clique('aba Animação (inspetor)', () => page.getByRole('tab', { name: 'Animação' }).click())
await clique('aba Design (inspetor)', () => page.getByRole('tab', { name: 'Design' }).click())
await clique('aba Camadas', () => page.getByRole('tab', { name: 'Camadas' }).click())
await clique('item no painel de camadas', () => page.getByRole('tree', { name: 'Camadas da tela' }).getByRole('treeitem').nth(1).locator('> div').click())
await clique('aba Telas', () => page.getByRole('tab', { name: 'Telas' }).click())
await clique('trocar de tela (2ª)', () => page.getByRole('listbox', { name: 'Telas' }).getByRole('option').nth(1).click())
await clique('trocar de tela (1ª)', () => page.getByRole('listbox', { name: 'Telas' }).getByRole('option').nth(0).click())
await clique('abrir menu Mais opções', () => page.getByRole('button', { name: 'Mais opções' }).first().click())
await clique('fechar menu (Esc)', () => page.keyboard.press('Escape'))
await page.mouse.click(vazio.x, vazio.y)
await clique('abrir Compartilhar', () => page.getByRole('button', { name: 'Compartilhar' }).click(), { espera: 700 })
await clique('fechar Compartilhar (Esc)', () => page.keyboard.press('Escape'))
await page.mouse.click(camada.x, camada.y)
await page.waitForTimeout(300)
const campoX = page.getByRole('complementary', { name: 'Propriedades' }).getByLabel('Posição X', { exact: true }).first()
if (await campoX.count()) {
  await campoX.click()
  await clique('seta ↑ no campo X do inspetor', () => page.keyboard.press('ArrowUp'))
  await clique('digitar no campo X', () => page.keyboard.type('12'))
  await page.keyboard.press('Escape')
}
await page.mouse.click(camada.x, camada.y)

// gestos: 60 eventos a 60 Hz (1 s)
const reta = (de, dx, dy, n = 60) => Array.from({ length: n }, (_, i) => ({ x: de.x + (dx * (i + 1)) / n, y: de.y + (dy * (i + 1)) / n }))
await gesto('mover', {
  inicio: async () => { const c = await escolherCamada(); camada.x = c.x; camada.y = c.y; await page.mouse.move(camada.x, camada.y); await page.mouse.down() },
  passos: () => reta(camada, 160, 90),
  fim: async () => { await page.mouse.up(); await page.keyboard.press('Control+z') },
})
async function alca(seletor) {
  await page.mouse.click(camada.x, camada.y)
  await page.waitForTimeout(200)
  const b = await page.locator(seletor).first().boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
let pontoAlca
await gesto('redimensionar', {
  inicio: async () => { pontoAlca = await alca('[data-alca=se]'); await page.mouse.move(pontoAlca.x, pontoAlca.y); await page.mouse.down() },
  passos: () => reta(pontoAlca, 120, 70),
  fim: async () => { await page.mouse.up(); await page.keyboard.press('Control+z') },
})
await gesto('girar', {
  inicio: async () => { pontoAlca = await alca('[data-testid=zona-girar-ne]'); await page.mouse.move(pontoAlca.x, pontoAlca.y); await page.mouse.down() },
  passos: () => Array.from({ length: 60 }, (_, i) => ({ x: pontoAlca.x + Math.sin((i / 60) * Math.PI) * 140, y: pontoAlca.y + (1 - Math.cos((i / 60) * Math.PI)) * 80 })),
  fim: async () => { await page.mouse.up(); await page.keyboard.press('Control+z') },
})
const centro = await area.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
await gesto('pan (roda)', {
  tipo: 'roda',
  inicio: async () => { await page.mouse.move(centro.x, centro.y) },
  passos: Array.from({ length: 60 }, (_, i) => ({ ...centro, dx: i % 20 < 10 ? 6 : -6, dy: 8 })),
  fim: async () => {},
})
await gesto('zoom (ctrl+roda)', {
  tipo: 'roda',
  inicio: async () => { await page.mouse.move(centro.x, centro.y) },
  passos: Array.from({ length: 60 }, (_, i) => ({ ...centro, dy: i < 30 ? -12 : 12, mod: 2 })),
  fim: async () => { await page.keyboard.press('Shift+1') },
})

// navegação
await page.waitForTimeout(1000) // autosave
await navegar('editor → painel (Início)', page.getByRole('link', { name: 'Início' }).first(), 'main h1')
await page.waitForTimeout(1200)
await navegar('painel → Criar com IA', page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Criar com IA' }), 'main textarea, main [role=textbox]')
await page.waitForTimeout(800)
await navegar('Criar com IA → painel', page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início' }), 'main h1')
await page.waitForTimeout(800)
{
  await throttle(TAXA)
  const t0 = Date.now()
  await page.goto(`${BASE}/p/demo_cafe_aurora_proposta_01_token_fixo_xx`)
  await page.locator('[data-layer-id]').first().waitFor({ timeout: 30000 })
  const ms = Date.now() - t0
  await throttle(1)
  resultados.navegacao.push({ nome: 'abrir visualizador /p/… (carga)', ms })
  console.log(`navega  ${'abrir visualizador /p/… (carga)'.padEnd(34)} ${String(ms).padStart(5)} ms`)
}

await browser.close()

console.log(`\nCPU ${TAXA}× · carga da máquina: ${os.loadavg().map((x) => x.toFixed(1)).join(' / ')} (${os.cpus().length} CPUs)`)
if (JSON_SAIDA) fs.writeFileSync(JSON_SAIDA, JSON.stringify(resultados, null, 2))
if (erros.length) console.log('Erros na página:', erros.slice(0, 5))

const falhas = []
for (const c of resultados.cliques) {
  const limite = CLIQUES_CANVAS.test(c.nome) ? LIMITES.cliqueCanvas : LIMITES.clique
  if (c.ms > limite) falhas.push(`clique "${c.nome}": ${c.ms} ms > ${limite}`)
}
for (const g of resultados.gestos) {
  if (g.p95 > LIMITES.gestoP95) falhas.push(`gesto "${g.nome}": p95 ${g.p95} ms > ${LIMITES.gestoP95}`)
  if (g.quadroP95 > LIMITES.quadroP95) falhas.push(`gesto "${g.nome}": quadro p95 ${g.quadroP95} ms > ${LIMITES.quadroP95}`)
  const limite = ['mover', 'redimensionar', 'girar'].includes(g.nome) ? LIMITES.componentesGesto : LIMITES.componentesViewport
  if (g.componentesPorEvento > limite) falhas.push(`gesto "${g.nome}": ${g.componentesPorEvento} componentes/evento > ${limite}`)
}
for (const n of resultados.navegacao) if (n.ms > LIMITES.navegacao) falhas.push(`navegação "${n.nome}": ${n.ms} ms > ${LIMITES.navegacao}`)
if (erros.length) falhas.push(`${erros.length} erro(s) na página`)
if (falhas.length && !SEM_LIMITES) {
  console.log(`\n✘ fora do orçamento:\n  ${falhas.join('\n  ')}`)
  process.exit(1)
}
console.log(falhas.length ? `\n(fora do orçamento, ignorado: ${falhas.length})` : '\n✔ interações dentro do orçamento')
