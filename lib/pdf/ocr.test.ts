/**
 * OCR das páginas escaneadas.
 * 1. A conversão do resultado do Tesseract em trechos posicionados (dados sintéticos): tamanho, linha de base,
 *    marcadores de lista, ruído e confiança.
 * 2. Ponta a ponta no Node: um PDF de 2 páginas em que a segunda é "escaneada" de verdade (texto desenhado num
 *    canvas, com ruído e leve inclinação, embutido como JPEG pelo jsPDF; nenhum texto no PDF). O pdf.js não acha
 *    texto nela; a página é renderizada e reconhecida pelo mesmo tesseract.js e pelos mesmos dados de idioma
 *    (português + inglês) que o navegador usa, e o resultado passa pela normalização do texto extraído.
 */
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { jsPDF } from 'jspdf'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createWorker } from 'tesseract.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { extrairPaginas } from './ler'
import { comTextoDigital, escalaOcr, juntarOcr, OCR, paginaDoOcr, paginasParaOcr, type BlocoOcr, type LinhaOcr } from './ocr'
import { estruturarPdf } from './texto'

/** Linha sintética no formato do tesseract.js: palavras com 1 px de vão por caractere de largura. */
function linha(texto: string, x: number, base: number, altura: number, confianca = 95): LinhaOcr {
  let cx = x
  const words = texto.split(' ').map((w) => {
    const largura = w.length * altura * 0.5
    const p = { text: w, confidence: confianca, bbox: { x0: cx, y0: base - altura * 0.8, x1: cx + largura, y1: base + altura * 0.2 } }
    cx += largura + altura * 0.3
    return p
  })
  return { text: texto, confidence: confianca, bbox: { x0: x, y0: base - altura * 0.8, x1: cx, y1: base + altura * 0.2 }, baseline: { x0: x, y0: base, x1: cx, y1: base, has_baseline: true }, rowAttributes: { rowHeight: altura, ascenders: altura * 0.2, descenders: altura * 0.2 }, words }
}
const bloco = (...ls: LinhaOcr[][]): BlocoOcr => ({ paragraphs: ls.map((lines) => ({ lines })) })

describe('resultado do Tesseract → trechos posicionados', () => {
  it('converte para pontos, estima o tamanho pela altura da linha e passa pela mesma normalização', () => {
    // página A4 renderizada a 2 px por ponto
    const r = paginaDoOcr(1, 595, 842, 2, [
      bloco([linha('Relatório de produção', 100, 200, 52)]),
      bloco([linha('A fábrica produziu 48.200 peças no ano, com', 100, 300, 26), linha('aumento de 12% sobre 2024.', 100, 340, 24)]),
      bloco([linha('* Exportação para o Chile', 120, 420, 26), linha('+ Treinamento da equipe', 120, 460, 26)]),
      // ruído de foto: confiança baixa ou sem letras
      bloco([linha('~~ ;; ,,', 100, 600, 26, 30), linha('| .', 100, 640, 26, 90)]),
    ])
    expect(r.pagina.ocr).toBe(true)
    expect(r.palavras).toBe(25)
    expect(r.confianca).toBe(95)
    const t = r.pagina.itens[0]!
    expect(t.texto).toBe('Relatório')
    expect(t.x).toBe(50)
    expect(t.y).toBe(100)
    expect(t.tamanho).toBeCloseTo(52 / 0.93 / 2, 5)
    // a linha de 24 px do mesmo parágrafo fica com o tamanho do parágrafo (26)
    expect(new Set(r.pagina.itens.filter((i) => i.y > 140 && i.y < 180).map((i) => i.tamanho)).size).toBe(1)
    const e = estruturarPdf([r.pagina])
    expect(e.texto).toBe('# Relatório de produção\n\nA fábrica produziu 48.200 peças no ano, com aumento de 12% sobre 2024.\n\n- Exportação para o Chile\n- Treinamento da equipe')
    expect(e.paginasSemTexto).toEqual([])
  })

  it('página só com ruído não conta como lida; sem blocos, sem itens', () => {
    expect(paginaDoOcr(1, 100, 100, 1, [bloco([linha('xx yy', 0, 50, 20, 20)])]).pagina.itens).toEqual([])
    expect(paginaDoOcr(1, 100, 100, 1, null)).toMatchObject({ confianca: 0, palavras: 0 })
  })

  it('limites: páginas por leitura e escala da imagem', () => {
    expect(paginasParaOcr(Array.from({ length: 50 }, (_, i) => i + 1))).toHaveLength(OCR.maxPaginas)
    expect(escalaOcr(595, 842)).toBeCloseTo(OCR.ladoMaxPx / 842, 5)
    expect(escalaOcr(100, 100)).toBe(OCR.escalaMax)
  })

  it('junta o OCR ao texto extraído: páginas lidas, incertas, em branco e as que faltaram', () => {
    const digital = { numero: 1, largura: 595, altura: 842, itens: [{ texto: 'Capa do relatório com texto digital suficiente', x: 50, y: 100, largura: 300, tamanho: 12 }] }
    const vazia = (numero: number) => ({ numero, largura: 595, altura: 842, itens: [] })
    const boa = paginaDoOcr(2, 595, 842, 2, [bloco([linha('Página escaneada lida pelo reconhecimento', 100, 200, 26)])])
    const incerta = paginaDoOcr(3, 595, 842, 2, [bloco([linha('Outra página com leitura duvidosa aqui', 100, 200, 26, 60)])])
    const r = juntarOcr([digital, vazia(2), vazia(3), vazia(4), vazia(5)], [2, 3, 4, 5], { paginas: [boa, incerta], emBranco: [4] })
    expect(r.lidasPorOcr).toEqual([2, 3])
    expect(r.ocrIncerto).toEqual([3])
    expect(r.semTexto).toEqual([5])
    expect(r.faltam).toEqual([5])
    expect(r.resultado.porPagina[1]).toBe('Página escaneada lida pelo reconhecimento')
    expect(r.resultado.texto).toContain('Capa do relatório')
  })
})

describe('página com um pouco de texto digital e o resto em imagem', () => {
  it('fica o texto digital; do OCR, só as palavras fora dele', () => {
    const digital = { numero: 1, largura: 595, altura: 842, itens: [{ texto: 'Atlas Cerâmica · Relatório', x: 50, y: 30, largura: 150, tamanho: 9 }] }
    const ocr = paginaDoOcr(1, 595, 842, 2, [bloco([linha('Atlas Cerâmica - Relatério', 100, 60, 17)]), bloco([linha('Texto da imagem escaneada', 100, 400, 26)])])
    const r = comTextoDigital(digital, ocr.pagina)
    expect(r.ocr).toBe(true)
    expect(r.itens.map((i) => i.texto)).toEqual(['Atlas Cerâmica · Relatório', 'Texto', 'da', 'imagem', 'escaneada'])
    expect(comTextoDigital({ ...digital, itens: [] }, ocr.pagina)).toBe(ocr.pagina)
  })
})

// ---------- ponta a ponta: PDF escaneado → pdf.js → Tesseract (por + eng) → texto normalizado ----------

const ESPERADO = [
  'Relatório de produção 2025',
  'A fábrica de Cerâmica Atlas produziu 48.200 peças no ano, com aumento de 12% sobre 2024 e redução de 30% no consumo de gás.',
  'Próximos passos',
  'Expansão da exportação para o Chile e o Uruguai',
  'Treinamento da equipe de acabamento',
  'Revisão dos preços em março',
]

/** Página escaneada a 200 dpi: fundo levemente cinza, ruído e inclinação de 0,4°, como um scanner de mesa. */
function imagemEscaneada(): Buffer {
  const pxPorPt = 200 / 72
  const c = createCanvas(Math.round(595.28 * pxPorPt), Math.round(841.89 * pxPorPt))
  const g = c.getContext('2d')
  g.fillStyle = '#F4F2EE'
  g.fillRect(0, 0, c.width, c.height)
  let semente = 7
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647)
  g.fillStyle = 'rgba(0,0,0,0.25)'
  for (let i = 0; i < 4000; i++) g.fillRect(aleatorio() * c.width, aleatorio() * c.height, 2, 2)
  g.save()
  g.rotate((0.4 * Math.PI) / 180)
  g.fillStyle = '#1A1A1A'
  const texto = (s: string, pt: number, x: number, y: number, negrito = false) => { g.font = `${negrito ? 'bold ' : ''}${pt * pxPorPt}px sans-serif`; g.fillText(s, x * pxPorPt, y * pxPorPt) }
  texto(ESPERADO[0]!, 24, 60, 100, true)
  texto('A fábrica de Cerâmica Atlas produziu 48.200 peças no ano, com', 11, 60, 150)
  texto('aumento de 12% sobre 2024 e redução de 30% no consumo de gás.', 11, 60, 166)
  texto(ESPERADO[2]!, 16, 60, 215, true)
  ESPERADO.slice(3).forEach((s, i) => texto(`•  ${s}`, 11, 70, 245 + i * 18))
  g.restore()
  return c.toBuffer('image/jpeg', 80)
}

function pdfComPaginaEscaneada(): Uint8Array {
  const d = new jsPDF({ unit: 'pt', format: 'a4' })
  d.setFontSize(20)
  d.text('Apresentação da empresa', 60, 100)
  d.setFontSize(11)
  d.text('Esta primeira página tem texto digital, lido direto do PDF.', 60, 140)
  d.addPage()
  d.addImage(new Uint8Array(imagemEscaneada()), 'JPEG', 0, 0, 595.28, 841.89)
  return new Uint8Array(d.output('arraybuffer'))
}

/** Distância de edição (caracteres) entre dois textos. */
function distancia(a: string, b: string): number {
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const at = [i]
    for (let j = 1; j <= b.length; j++) at[j] = Math.min(ant[j]! + 1, at[j - 1]! + 1, ant[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    ant = at
  }
  return ant[b.length]!
}

const require = createRequire(import.meta.url)
let pastaIdiomas = ''
beforeAll(() => {
  // os mesmos arquivos que o vite.config.ts serve ao navegador, numa pasta só (o tesseract.js lê `<pasta>/<idioma>.traineddata.gz`)
  pastaIdiomas = mkdtempSync(join(tmpdir(), 'mostra-ocr-'))
  for (const l of OCR.idiomas) copyFileSync(join(dirname(require.resolve(`@tesseract.js-data/${l}/package.json`)), '4.0.0_best_int', `${l}.traineddata.gz`), join(pastaIdiomas, `${l}.traineddata.gz`))
})
afterAll(() => { if (pastaIdiomas) rmSync(pastaIdiomas, { recursive: true, force: true }) })

describe('PDF escaneado lido por OCR (tesseract.js, português)', () => {
  it('a página sem texto é reconhecida com fidelidade e vira título, parágrafo e lista', async () => {
    const tarefa = pdfjs.getDocument({ data: pdfComPaginaEscaneada(), verbosity: 0 })
    const worker = await createWorker([...OCR.idiomas], 1, { langPath: pastaIdiomas, cacheMethod: 'none', gzip: true })
    try {
      const doc = await tarefa.promise
      const extraidas = await extrairPaginas(doc, (a, b) => pdfjs.Util.transform(a, b) as number[])
      const antes = estruturarPdf(extraidas)
      expect(antes.paginasSemTexto).toEqual([2])

      // renderiza como no navegador (lado maior OCR.ladoMaxPx) e reconhece
      const pagina = await doc.getPage(2)
      const base = pagina.getViewport({ scale: 1 })
      const escala = escalaOcr(base.width, base.height)
      const vp = pagina.getViewport({ scale: escala })
      const fabrica = doc.canvasFactory as unknown as { create: (w: number, h: number) => { canvas: { toBuffer: (t: string) => Buffer }; context: unknown } }
      const { canvas, context } = fabrica.create(Math.round(vp.width), Math.round(vp.height))
      await pagina.render({ canvas: canvas as never, canvasContext: context as never, viewport: vp }).promise
      await worker.setParameters({ user_defined_dpi: String(Math.round(72 * escala)) })
      const r = await worker.recognize(canvas.toBuffer('image/png'), { rotateAuto: true }, { blocks: true, text: false })
      const ocr = paginaDoOcr(2, base.width, base.height, escala, r.data.blocks as unknown as BlocoOcr[])
      const { resultado, lidasPorOcr, semTexto, ocrIncerto } = juntarOcr(extraidas, antes.paginasSemTexto, { paginas: [ocr], emBranco: [] })

      expect(lidasPorOcr).toEqual([2])
      expect(semTexto).toEqual([])
      expect(ocrIncerto).toEqual([])
      expect(ocr.confianca).toBeGreaterThanOrEqual(OCR.confiancaBoa)
      const lido = resultado.porPagina[1]!
      // estrutura: título maior, subtítulo, parágrafo juntado (2 linhas) e lista de 3 itens (a fidelidade letra a letra vem abaixo)
      const blocos = lido.split('\n\n')
      expect(blocos).toHaveLength(4)
      expect(blocos[0]).toMatch(/^# Relat.rio de produ..o 2025$/)
      expect(blocos[1]).toMatch(/^A f.brica de Cer.mica Atlas produziu 48\.200 pe.as no ano, com aumento de 12% sobre 2024 e redu..o de 30% no consumo de g.?s\.$/)
      expect(blocos[2]).toMatch(/^##+ Pr.ximos passos$/)
      expect(blocos[3]!.split('\n')).toHaveLength(3)
      for (const item of ESPERADO.slice(3)) expect(lido).toContain(`- ${item}`)
      // fidelidade: caracteres certos (com acentos), sem a marcação
      const plano = lido.replace(/^#+ |^- /gm, '').replace(/\s+/g, ' ').trim()
      const certo = ESPERADO.join(' ')
      const acerto = 1 - distancia(plano, certo) / certo.length
      console.log(`OCR (por+eng) da página escaneada: ${(acerto * 100).toFixed(1)}% dos caracteres certos · confiança ${ocr.confianca} · ${ocr.palavras} palavras`)
      expect(acerto).toBeGreaterThanOrEqual(0.97)
      // a página digital continua lida do PDF
      expect(resultado.porPagina[0]).toContain('Apresentação da empresa')
    } finally {
      await worker.terminate()
      await tarefa.destroy()
    }
  }, 120_000)
})
