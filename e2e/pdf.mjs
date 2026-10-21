import { chromium } from 'playwright'
import { jsPDF } from 'jspdf'
import { strToU8, zipSync } from 'fflate'
import fs from 'node:fs'

/**
 * PDF ponta a ponta (modo demo): "Criar com IA" lê um PDF no navegador (resumo do que foi lido, aviso das páginas
 * escaneadas com o custo da leitura pela IA), gera o roteiro e a apresentação; "Novo projeto" importa um PDF de
 * 3 páginas como apresentação (uma tela por página, texto selecionável) e abre no editor e na apresentação.
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
const pdfRelatorio = `${SHOTS}/teste-relatorio.pdf`
const pdfDeck = `${SHOTS}/teste-deck-3-paginas.pdf`
fs.writeFileSync(pdfRelatorio, relatorio())
fs.writeFileSync(pdfDeck, deck())

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' })
const page = await ctx.newPage()
page.on('pageerror', (e) => erros.push(`pageerror (${page.url()}): ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to fetch RSC payload')) erros.push(`console (${page.url()}): ${m.text()}`) })
// o pdf.js tem de rodar no Web Worker dele (não no "fake worker" da thread principal)
const workers = []
page.on('worker', (w) => workers.push(w.url()))
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
  for (const esperado of ['3 páginas', 'caracteres lidos', 'títulos', 'itens de lista', '1 tabela', 'página 3', 'Ler 1 página com a IA', 'No roteiro, este material soma']) if (!t.includes(esperado)) throw new Error(`resumo sem "${esperado}": ${t}`)
  // custo da leitura pela IA mostrado antes: 4 + 15 por página
  if (!/Ler 1 página com a IA\s*·\s*19\s*créditos/.test(t)) throw new Error(`custo da leitura não aparece: ${t}`)
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

let projeto = ''
await passo('Novo projeto: importar PDF de 3 páginas como apresentação e abrir no editor', async () => {
  await page.goto(`${BASE}/app/novo?passo=arquivos`, { waitUntil: 'networkidle' })
  await page.getByLabel('Arquivos do projeto').setInputFiles(pdfDeck)
  await page.getByText('Texto selecionável nas páginas do PDF').waitFor()
  await page.screenshot({ path: `${SHOTS}/pdf-4-novo-projeto.png` })
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
  await page.screenshot({ path: `${SHOTS}/pdf-5-editor.png` })
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
  await page.screenshot({ path: `${SHOTS}/pdf-6-apresentar.png` })
})

await browser.close()
console.log('\n' + passos.join('\n'))
console.log(`\nErros de console/página: ${erros.length}`)
erros.slice(0, 20).forEach((e) => console.log('  ', e))
process.exit(passos.some((p) => p.startsWith('✘')) || erros.length ? 1 : 0)
