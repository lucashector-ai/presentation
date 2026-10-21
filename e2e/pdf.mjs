import { chromium } from 'playwright'
import { createCanvas } from '@napi-rs/canvas'
import { jsPDF } from 'jspdf'
import { strToU8, zipSync } from 'fflate'
import fs from 'node:fs'

/**
 * PDF ponta a ponta (modo demo): "Criar com IA" lê um PDF no navegador (resumo do que foi lido, aviso das páginas
 * sem texto com o custo da leitura opcional pela IA), gera o roteiro e a apresentação; um PDF escaneado (só
 * imagem) é lido por OCR no navegador (tesseract.js), sem créditos e sem chamar a IA, e o OCR pode ser cancelado;
 * "Novo projeto" importa um PDF de 3 páginas como apresentação (uma tela por página, texto selecionável) e abre
 * no editor e na apresentação.
 * Rodar com o app no ar: E2E_BASE_URL=http://localhost:8787 node e2e/pdf.mjs  (capturas em E2E_SHOTS ou e2e/capturas/)
 */
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'
const SHOTS = process.env.E2E_SHOTS || new URL('./capturas/', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const erros = []
const passos = []

// ---------- PDFs de teste ----------
function relatorio() {
  const d = new jsPDF({ unit: 'pt', format: 'a4' })
  const cab = (p) => { d.setFontSize(9); d.setTextColor(120); d.text('Atlas Cerâmica · Relatório 2025', 50, 30); d.text(`Página ${p} de 3`, 270, 815); d.setTextColor(20) }
  cab(1)
  d.setFontSize(26); d.text('Relatório anual 2025', 50, 90)
  d.setFontSize(11)
  d.text('A receita cresceu 23,5% e chegou a R$ 1.234.567,89 no ano, com a abertura de três lo-', 50, 130)
  d.text('jas e margem de 18%. O time passou de 12 para 19 pessoas e a exportação começou.', 50, 144)
  d.setFontSize(16); d.text('Destaques', 50, 190)
  d.setFontSize(11)
  d.text('• Exportação para 4 países', 60, 215)
  d.text('• NPS de 72 pontos', 60, 229)
  d.text('• Novo forno elétrico reduziu 30% do gás', 60, 243)
  d.addPage(); cab(2)
  d.setFontSize(16); d.text('Resultados por região', 50, 90)
  d.setFontSize(11)
  ;[['Região', 'Receita', 'Margem'], ['Sul', 'R$ 300 mil', '12%'], ['Sudeste', 'R$ 640 mil', '21%'], ['Norte', 'R$ 120 mil', '9,5%']].forEach((l, i) => l.forEach((c, k) => d.text(c, 50 + k * 150, 120 + i * 16)))
  d.text('Para 2026, a prioridade é o Sudeste, com duas lojas novas e venda on-line.', 50, 200)
  d.addPage(); cab(3)
  // página "escaneada": só desenho, sem texto
  d.setFillColor(60, 60, 60); d.rect(60, 80, 470, 300, 'F'); d.setFillColor(200, 180, 120); d.rect(90, 110, 200, 120, 'F')
  return Buffer.from(d.output('arraybuffer'))
}
function deck() {
  const d = new jsPDF({ unit: 'pt', format: [960, 540], orientation: 'landscape' })
  const telas = [['Proposta Atlas', '#1F3B4D', 'Identidade visual para a nova linha de cerâmica'], ['Cronograma em 6 semanas', '#E4572E', 'Diagnóstico, conceito, sistema e entrega'], ['Investimento de R$ 48 mil', '#5965F2', 'Em três parcelas, com suporte de 3 meses']]
  telas.forEach(([t, cor, sub], i) => {
    if (i) d.addPage([960, 540], 'landscape')
    d.setFillColor(cor); d.rect(0, 0, 960, 540, 'F')
    d.setFillColor('#F2C14E'); d.circle(820, 120, 70, 'F')
    d.setTextColor('#FFFFFF'); d.setFontSize(46); d.text(t, 70, 260)
    d.setFontSize(20); d.text(sub, 70, 310)
    d.setFontSize(12); d.text(`${i + 1} / 3`, 70, 500)
  })
  return Buffer.from(d.output('arraybuffer'))
}
/** Página "escaneada": texto desenhado num canvas (200 dpi, fundo de papel, poeira, leve inclinação) e embutido como JPEG. */
function paginaEscaneada(linhas) {
  const k = 200 / 72
  const c = createCanvas(Math.round(595.28 * k), Math.round(841.89 * k))
  const g = c.getContext('2d')
  g.fillStyle = '#F3F1EC'; g.fillRect(0, 0, c.width, c.height)
  let s = 11
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  g.fillStyle = 'rgba(0,0,0,0.2)'
  for (let i = 0; i < 3000; i++) g.fillRect(r() * c.width, r() * c.height, 2, 2)
  g.rotate((0.3 * Math.PI) / 180)
  g.fillStyle = '#1C1C1C'
  for (const [texto, pt, x, y, negrito] of linhas) { g.font = `${negrito ? 'bold ' : ''}${pt * k}px sans-serif`; g.fillText(texto, x * k, y * k) }
  return new Uint8Array(c.toBuffer('image/jpeg', 80))
}
function escaneado(paginas) {
  const d = new jsPDF({ unit: 'pt', format: 'a4' })
  paginas.forEach((linhas, i) => { if (i) d.addPage(); d.addImage(paginaEscaneada(linhas), 'JPEG', 0, 0, 595.28, 841.89) })
  return Buffer.from(d.output('arraybuffer'))
}
const PAGINA_ESCANEADA = [
  ['Plano de expansão 2026', 24, 60, 100, true],
  ['A Cooperativa Serra Verde vai abrir duas lojas em Minas Gerais e', 11, 60, 150],
  ['dobrar a produção de café especial, com investimento de R$ 2,4 milhões.', 11, 60, 166],
  ['Prioridades', 16, 60, 215, true],
  ['•  Certificação orgânica até junho', 11, 70, 245],
  ['•  Exportação para Portugal e Japão', 11, 70, 263],
]
const pdfRelatorio = `${SHOTS}/teste-relatorio.pdf`
const pdfDeck = `${SHOTS}/teste-deck-3-paginas.pdf`
fs.writeFileSync(pdfRelatorio, relatorio())
fs.writeFileSync(pdfDeck, deck())
const pdfEscaneado = `${SHOTS}/teste-escaneado.pdf`
const pdfEscaneadoLongo = `${SHOTS}/teste-escaneado-6-paginas.pdf`
fs.writeFileSync(pdfEscaneado, escaneado([PAGINA_ESCANEADA, [['Cronograma', 20, 60, 100, true], ['A primeira loja abre em março, em Belo Horizonte, e a segunda em agosto.', 11, 60, 140]]]))
fs.writeFileSync(pdfEscaneadoLongo, escaneado(Array.from({ length: 6 }, (_, i) => [[`Capítulo ${i + 1}`, 22, 60, 100, true], ['Texto escaneado de exemplo para medir o cancelamento do OCR.', 11, 60, 140]])))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
const page = await ctx.newPage()
page.on('pageerror', (e) => erros.push(`pageerror (${page.url()}): ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to fetch RSC payload')) erros.push(`console (${page.url()}): ${m.text()}`) })
// o pdf.js e o OCR têm de rodar no Web Worker deles (não na thread principal)
const workers = []
page.on('worker', (w) => workers.push(w.url()))
// nada de CDN externo nem leitura pela IA sem o usuário pedir
const pedidos = []
page.on('request', (r) => pedidos.push(r.url()))
const saldo = async () => Number((await page.getByText(/^[\d.]+ créditos$/).first().innerText()).replace(/\D/g, ''))
async function passo(nome, fn) {
  try { await fn(); passos.push(`✔ ${nome}`); console.log('✔', nome) } catch (e) { passos.push(`✘ ${nome}: ${e?.message ?? e}`); console.log('✘', nome, e?.message ?? e); await page.screenshot({ path: `${SHOTS}/pdf-falha-${passos.length}.png` }).catch(() => {}) }
}
const esperarTelas = async (n) => {
  const telas = page.getByRole('listbox', { name: 'Telas' }).getByRole('option')
  for (let t = 0; t < 15000; t += 100) { if ((await telas.count()) === n) return; await page.waitForTimeout(100) }
  throw new Error(`esperava ${n} telas, há ${await telas.count()}`)
}

await passo('Cadastro (demo)', async () => {
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.getByLabel('Nome').fill('Teste PDF')
  await page.getByLabel('E-mail').fill('pdf@exemplo.com')
  await page.getByLabel('Senha').fill('senhaforte123')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.getByRole('button', { name: 'Continuar para o painel' }).click()
  await page.waitForURL(`${BASE}/app`)
})

await passo('Criar com IA: anexar PDF mostra o que foi lido e o custo', async () => {
  await page.goto(`${BASE}/app/criar`, { waitUntil: 'networkidle' })
  await page.getByRole('radio', { name: 'Importar arquivo' }).click()
  await page.getByLabel('Arquivo de material').setInputFiles(pdfRelatorio)
  const resumo = page.getByTestId('resumo-material')
  await resumo.waitFor({ timeout: 20000 })
  const t = await resumo.innerText()
  for (const esperado of ['3 páginas', 'caracteres lidos', 'títulos', 'itens de lista', '1 tabela', '1 página continua sem texto (página 3)', 'No roteiro, este material soma']) if (!t.includes(esperado)) throw new Error(`resumo sem "${esperado}": ${t}`)
  // a página só com desenho passou pelo OCR (nada legível) e a leitura pela IA fica como opção, com o custo à vista
  if (!/Ler com IA \(melhor para gráficos, tabelas complexas e manuscrito\)\s*·\s*\d+\s*créditos/.test(t)) throw new Error(`opção da IA/custo não aparece: ${t}`)
  if (!t.includes('a IA lê a imagem da página 3')) throw new Error(`páginas da IA: ${t}`)
  const texto = await page.locator('#criar-prompt').inputValue()
  for (const esperado of ['# Relatório anual 2025', 'R$ 1.234.567,89', 'três lojas', '- NPS de 72 pontos', '| Sudeste | R$ 640 mil | 21% |']) if (!texto.includes(esperado)) throw new Error(`texto sem "${esperado}"`)
  if (texto.includes('Página 1 de 3') || texto.includes('Relatório 2025\n')) throw new Error('rodapé/cabeçalho não foi removido')
  if (!workers.some((u) => /pdf\.worker\.min(\.[\w-]+)?\.mjs$/.test(u))) throw new Error(`worker do pdf.js não subiu: ${workers.join(', ')}`)
  await page.screenshot({ path: `${SHOTS}/pdf-1-criar-resumo.png` })
})

await passo('Criar com IA: gerar roteiro e apresentação a partir do PDF', async () => {
  await page.getByRole('radio', { name: '6 telas', exact: true }).click()
  await page.getByRole('button', { name: 'Gerar roteiro →' }).click()
  await page.getByText('Roteiro · 6 telas').waitFor({ timeout: 30000 })
  await page.screenshot({ path: `${SHOTS}/pdf-2-criar-roteiro.png` })
  await page.getByRole('button', { name: 'Gerar apresentação' }).click()
  await page.getByText('Pronto · 6 telas').waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/pdf-3-criar-apresentacao.png` })
})

await passo('Criar com IA: anexar .docx lê títulos, lista e tabela', async () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
  const p = (t, estilo, lista) => `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${lista ? '<w:numPr><w:numId w:val="1"/></w:numPr>' : ''}</w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`
  const corpo = p('Briefing da campanha', 'Heading1') + p('Lançamento do app Rota em março, com verba de R$ 80 mil.') + p('Canais', 'Heading2') + p('Instagram', null, true) + p('Rádio local', null, true)
  fs.writeFileSync(`${SHOTS}/teste-briefing.docx`, zipSync({ 'word/document.xml': strToU8(`<w:document ${W}><w:body>${corpo}</w:body></w:document>`) }))
  await page.goto(`${BASE}/app/criar`, { waitUntil: 'networkidle' })
  await page.getByRole('radio', { name: 'Importar arquivo' }).click()
  await page.getByLabel('Arquivo de material').setInputFiles(`${SHOTS}/teste-briefing.docx`)
  const t = await page.getByTestId('resumo-material').innerText()
  if (!/2 títulos · 2 itens de lista/.test(t)) throw new Error(`resumo do docx: ${t}`)
  const texto = await page.locator('#criar-prompt').inputValue()
  if (!texto.startsWith('# Briefing da campanha') || !texto.includes('- Rádio local') || !texto.includes('R$ 80 mil')) throw new Error(`texto do docx: ${texto}`)
})

await passo('Criar com IA: PDF escaneado é lido por OCR no navegador, sem créditos e sem a IA', async () => {
  await page.goto(`${BASE}/app/criar`, { waitUntil: 'networkidle' })
  const antes = await saldo()
  const inicio = pedidos.length
  await page.getByRole('radio', { name: 'Importar arquivo' }).click()
  await page.getByLabel('Arquivo de material').setInputFiles(pdfEscaneado)
  // progresso por página
  await page.getByText(/Reconhecendo o texto da página \d \(\d de 2\)|Preparando o leitor de texto/).first().waitFor({ timeout: 20000 })
  const resumo = page.getByTestId('resumo-material')
  await resumo.waitFor({ timeout: 90000 })
  const t = await resumo.innerText()
  for (const esperado of ['2 páginas', 'O PDF é escaneado', 'reconhecimento de texto (OCR), sem gastar créditos', '3 títulos', '2 itens de lista']) if (!t.includes(esperado)) throw new Error(`resumo sem "${esperado}": ${t}`)
  if (!/Ler com IA \(melhor para gráficos, tabelas complexas e manuscrito\)\s*·\s*\d+\s*créditos/.test(t)) throw new Error(`sem a opção da IA: ${t}`)
  if (t.includes('continua sem texto') || t.includes('continuam sem texto')) throw new Error(`OCR deixou página sem texto: ${t}`)
  const texto = await page.locator('#criar-prompt').inputValue()
  for (const esperado of ['# Plano de expansão 2026', 'Cooperativa Serra Verde', 'R$ 2,4 milhões', '- Certificação orgânica até junho', '- Exportação para Portugal e Japão', 'Cronograma', 'Belo Horizonte']) if (!texto.includes(esperado)) throw new Error(`texto do OCR sem "${esperado}": ${texto}`)
  if (!/dobrar a produção/.test(texto)) throw new Error(`parágrafo não juntou as linhas: ${texto}`)
  if (!workers.some((u) => /\/_next\/static\/ocr\/[0-9a-f]+\/worker\.min\.js$/.test(u))) throw new Error(`worker do OCR não subiu: ${workers.join(', ')}`)
  const novos = pedidos.slice(inicio)
  if (novos.some((u) => u.includes('/api/ai/pdf'))) throw new Error('a IA foi chamada sem o usuário pedir')
  const externos = novos.filter((u) => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:'))
  if (externos.length) throw new Error(`pedidos a outros domínios: ${externos.slice(0, 3).join(', ')}`)
  for (const arq of ['por.traineddata.gz', 'eng.traineddata.gz', 'lstm.wasm']) if (!novos.some((u) => u.includes('/_next/static/ocr/') && u.endsWith(arq))) throw new Error(`não carregou ${arq} do próprio app`)
  if ((await saldo()) !== antes) throw new Error(`o saldo mudou: ${antes} → ${await saldo()}`)
  await page.screenshot({ path: `${SHOTS}/pdf-4-ocr-escaneado.png` })
  // o material do OCR gera o roteiro como qualquer texto
  await page.getByRole('radio', { name: '6 telas', exact: true }).click()
  await page.getByRole('button', { name: 'Gerar roteiro →' }).click()
  await page.getByText('Roteiro · 6 telas').waitFor({ timeout: 30000 })
})

await passo('Criar com IA: cancelar o OCR fica com as páginas já lidas', async () => {
  await page.goto(`${BASE}/app/criar`, { waitUntil: 'networkidle' })
  await page.getByRole('radio', { name: 'Importar arquivo' }).click()
  await page.getByLabel('Arquivo de material').setInputFiles(pdfEscaneadoLongo)
  await page.getByText(/Reconhecendo o texto da página 3 \(3 de 6\)/).waitFor({ timeout: 60000 })
  await page.getByRole('status').getByRole('button', { name: 'Cancelar' }).click()
  const resumo = page.getByTestId('resumo-material')
  await resumo.waitFor({ timeout: 15000 })
  await page.getByText(/Reconhecimento cancelado: [23] páginas lidas por OCR/).waitFor({ timeout: 5000 })
  const t = await resumo.innerText()
  if (!/Páginas 1 (e|a) [23]/.test(t) && !/Páginas 1, 2 e 3/.test(t)) throw new Error(`páginas lidas: ${t}`)
  if (!/páginas continuam sem texto/.test(t)) throw new Error(`as não lidas deviam continuar sem texto: ${t}`)
  const texto = await page.locator('#criar-prompt').inputValue()
  if (!texto.includes('Capítulo 1') || !texto.includes('Capítulo 2') || texto.includes('Capítulo 6')) throw new Error(`texto depois de cancelar: ${texto}`)
  await page.screenshot({ path: `${SHOTS}/pdf-5-ocr-cancelado.png` })
})

let projeto = ''
await passo('Novo projeto: importar PDF de 3 páginas como apresentação e abrir no editor', async () => {
  await page.goto(`${BASE}/app/novo?passo=arquivos`, { waitUntil: 'networkidle' })
  await page.getByLabel('Arquivos do projeto').setInputFiles(pdfDeck)
  await page.getByText('Texto selecionável nas páginas do PDF').waitFor()
  await page.screenshot({ path: `${SHOTS}/pdf-6-novo-projeto.png` })
  await page.getByRole('button', { name: 'Criar projeto' }).click()
  await page.waitForURL(/\/app\/projects\/.+\/edit/, { timeout: 30000 })
  projeto = /projects\/([^/]+)\/edit/.exec(page.url())[1]
  await esperarTelas(3)
  const nomes = await page.getByRole('listbox', { name: 'Telas' }).getByRole('option').allInnerTexts()
  for (const [i, t] of ['Proposta Atlas', 'Cronograma em 6 semanas', 'Investimento de R$ 48 mil'].entries()) if (!nomes[i]?.includes(t)) throw new Error(`tela ${i + 1}: ${nomes[i]}`)
  if ((await page.getByLabel('Nome do projeto').inputValue()) !== 'teste-deck-3-paginas') throw new Error('nome do projeto não veio do arquivo')
  const img = page.getByTestId('canvas').locator('img').first()
  await img.waitFor()
  const dims = await img.evaluate((el) => ({ ok: el.complete && el.naturalWidth > 0, w: el.naturalWidth, h: el.naturalHeight }))
  if (!dims.ok || dims.w < 1900) throw new Error(`imagem da página não carregou em alta resolução: ${JSON.stringify(dims)}`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/pdf-7-editor.png` })
})

await passo('Apresentar: página do PDF com texto selecionável', async () => {
  await page.goto(`${BASE}/app/projects/${projeto}/apresentar`, { waitUntil: 'networkidle' })
  const camada = page.getByText('Proposta Atlas', { exact: true }).first()
  await camada.waitFor({ timeout: 15000 })
  const estilo = await camada.evaluate((el) => { const d = el.closest('div'); const s = getComputedStyle(d); return { sel: s.userSelect, cor: s.color } })
  if (estilo.sel !== 'text' || !/rgba\(0, 0, 0, 0\)/.test(estilo.cor)) throw new Error(`texto da página: ${JSON.stringify(estilo)}`)
  await camada.selectText()
  const sel = await page.evaluate(() => window.getSelection()?.toString())
  if (!sel?.includes('Proposta Atlas')) throw new Error(`seleção: ${sel}`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${SHOTS}/pdf-8-apresentar.png` })
})

await browser.close()
console.log('\n' + passos.join('\n'))
console.log(`\nErros de console/página: ${erros.length}`)
erros.slice(0, 20).forEach((e) => console.log('  ', e))
process.exit(passos.some((p) => p.startsWith('✘')) || erros.length ? 1 : 0)
