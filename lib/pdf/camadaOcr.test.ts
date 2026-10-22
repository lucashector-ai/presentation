/**
 * Camada de texto das páginas escaneadas importadas como apresentação.
 * 1. Resultado do OCR (sintético, no formato do tesseract.js) → blocos posicionados → camadas da tela: uma camada
 *    por linha, topo calculado para a linha de base da Arial cair na da imagem, espaçamento entre letras que faz a
 *    Arial ocupar a largura da linha, colunas separadas, página densa dentro do limite de camadas, notas.
 * 2. Com o Tesseract de verdade: uma página "escaneada" desenhada num canvas é reconhecida e cada camada cai sobre
 *    a linha desenhada (posição, linha de base e largura medidas no próprio canvas).
 */
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { createWorker } from 'tesseract.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DocumentoProjetoSchema, type CamadaTexto } from '@/lib/scene/schema'
import { validarDocumento } from '@/lib/scene/validate'
import { ARIAL, baseDesdeOTopo, blocosDoOcr, ENTRELINHA_OCR, espacamentoPara, larguraArial, RESPIRO_LATERAL } from './camadaOcr'
import { OCR, paginaDoOcr, type BlocoOcr, type LinhaOcr } from './ocr'
import { cenaDaPagina, documentoDePaginas, ehTextoInvisivel, MAX_BLOCOS_TEXTO, tamanhoDaTela } from './paginas'
import { linhasDaPagina } from './texto'

/** Linha sintética no formato do tesseract.js (px da imagem): palavras com a largura dada por caractere. */
function linha(texto: string, x: number, base: number, altura: number, porCaractere = altura * 0.5, confianca = 95): LinhaOcr {
  let cx = x
  const words = texto.split(' ').map((w) => {
    const largura = w.length * porCaractere
    const p = { text: w, confidence: confianca, bbox: { x0: cx, y0: base - altura * 0.8, x1: cx + largura, y1: base + altura * 0.2 } }
    cx += largura + altura * 0.3
    return p
  })
  const fim = words[words.length - 1]!.bbox.x1
  return { text: texto, confidence: confianca, bbox: { x0: x, y0: base - altura * 0.8, x1: fim, y1: base + altura * 0.2 }, baseline: { x0: x, y0: base, x1: fim, y1: base, has_baseline: true }, rowAttributes: { rowHeight: altura, ascenders: altura * 0.2, descenders: altura * 0.2 }, words }
}
const bloco = (...ls: LinhaOcr[][]): BlocoOcr => ({ paragraphs: ls.map((lines) => ({ lines })) })
const textos = (c: { layers: { type: string }[] }) => c.layers.filter((l): l is CamadaTexto => l.type === 'text')

describe('larguras da Arial', () => {
  it('soma os avanços; acentuados valem a letra de base; espaçamento fecha a largura medida', () => {
    expect(larguraArial('Ai', 1000)).toBe(667 + 222)
    expect(larguraArial('ação', 100)).toBeCloseTo(larguraArial('acao', 100), 6)
    const e = espacamentoPara('Plano', 200, 40)
    expect(larguraArial('Plano', 40) + 5 * e).toBeCloseTo(200, 6)
    // medida absurda: limitado (letras não se atropelam nem se espalham pela página)
    expect(espacamentoPara('Plano', 10_000, 40)).toBe(32)
    expect(espacamentoPara('Plano', 1, 40)).toBe(-8)
    expect(espacamentoPara('', 100, 40)).toBe(0)
  })
})

describe('resultado do OCR → camada de texto posicionada', () => {
  // A4 renderizada a 2 px por ponto
  const k = 2
  const pagina = paginaDoOcr(1, 595, 842, k, [
    bloco([linha('Plano de expansão 2026', 120, 200, 52, 30)]),
    bloco([linha('A cooperativa vai abrir duas lojas', 120, 300, 26), linha('e dobrar a produção de café.', 120, 340, 26)]),
    // duas colunas na mesma altura
    bloco([linha('Coluna da esquerda', 120, 500, 26)]),
    bloco([linha('Coluna da direita', 700, 500, 26)]),
  ]).pagina

  it('uma camada por linha (e por coluna), com o texto reconhecido', () => {
    const b = blocosDoOcr(pagina.itens)
    expect(b.map((x) => x.texto)).toEqual(['Plano de expansão 2026', 'A cooperativa vai abrir duas lojas', 'e dobrar a produção de café.', 'Coluna da esquerda', 'Coluna da direita'])
  })

  it('topo da caixa põe a linha de base da Arial na da imagem; largura e espaçamento batem com a linha', () => {
    const [titulo] = blocosDoOcr(pagina.itens)
    const linhaLida = linhasDaPagina(pagina.itens)[0]!
    // começa no avanço da primeira letra: um respiro antes da tinta medida pelo Tesseract (60 pt)
    expect(titulo!.tamanho).toBeCloseTo(52 / 0.93 / k, 6)
    expect(titulo!.x).toBeCloseTo(60 - RESPIRO_LATERAL * titulo!.tamanho, 6)
    expect(titulo!.entrelinha).toBe(ENTRELINHA_OCR)
    // linha de base: 200 px ÷ 2 = 100 pt
    expect(titulo!.y + baseDesdeOTopo(titulo!.tamanho, titulo!.entrelinha)).toBeCloseTo(100, 6)
    expect(baseDesdeOTopo(10, 1.15)).toBeCloseTo(((1.15 - ARIAL.ascendente - ARIAL.descendente) / 2 + ARIAL.ascendente) * 10, 9)
    // a Arial com o espaçamento ocupa a largura reconhecida (a caixa tem uma folga para não quebrar a linha)
    const medida = linhaLida.xFim - linhaLida.x + 2 * RESPIRO_LATERAL * titulo!.tamanho
    const n = [...titulo!.texto].length
    expect(larguraArial(titulo!.texto, titulo!.tamanho) + n * titulo!.espacamento!).toBeCloseTo(medida, 1)
    expect(titulo!.largura).toBeGreaterThan(medida)
    expect(titulo!.largura).toBeLessThan(medida * 1.04 + titulo!.tamanho)
    expect(titulo!.altura).toBeCloseTo(ENTRELINHA_OCR * titulo!.tamanho, 6)
  })

  it('vira camadas invisíveis da tela, em px da tela, com espaçamento e notas', () => {
    const blocos = blocosDoOcr(pagina.itens)
    const doc = documentoDePaginas([{ numero: 1, assetId: 'a1', larguraPt: 595, alturaPt: 842, blocos, notas: 'Plano de expansão 2026\n\nA cooperativa…' }], 'slides', { textoSelecionavel: true })
    expect(DocumentoProjetoSchema.parse(doc)).toBeTruthy()
    expect(validarDocumento(doc, { assetsExistentes: new Set(['a1']) })).toMatchObject({ ok: true, erros: [] })
    const c = doc.scenes[0]!
    expect(c.title).toBe('Plano de expansão 2026')
    expect(c.notes).toBe('Plano de expansão 2026\n\nA cooperativa…')
    const t = textos(c)
    expect(t).toHaveLength(5)
    expect(t.every((l) => ehTextoInvisivel(l) && l.fontFamily === 'Arial')).toBe(true)
    // A4 retrato → tela 1357×1920: escala = largura da tela ÷ largura da página
    expect(c.size).toEqual(tamanhoDaTela(595, 842, 'slides'))
    const e = c.size.width / 595
    expect(t[0]!.x).toBe(Math.round(blocos[0]!.x * e))
    expect(t[0]!.letterSpacing).toBeCloseTo(blocos[0]!.espacamento! * e, 1)
    expect(t[0]!.lineHeight).toBe(ENTRELINHA_OCR)
    // linha de base do texto na tela = linha de base da imagem (± arredondamento a 1 px)
    expect(Math.abs(t[0]!.y + baseDesdeOTopo(t[0]!.fontSize, t[0]!.lineHeight) - 100 * e)).toBeLessThanOrEqual(1)
    // colunas: a da direita começa onde foi reconhecida
    expect(t[4]!.x).toBe(Math.round((350 - RESPIRO_LATERAL * blocos[4]!.tamanho) * e))
    // sem notas: tela sem notas
    expect(cenaDaPagina({ numero: 2, assetId: 'a1', larguraPt: 595, alturaPt: 842, blocos }, 1, 'slides', { textoSelecionavel: true }).notes).toBe('')
  })

  it('página densa: linhas da mesma coluna se juntam em blocos, dentro do limite de camadas, sem perder texto', () => {
    const linhas = Array.from({ length: 260 }, (_, i) => linha(`Linha ${i + 1} do texto denso`, i % 2 ? 700 : 100, 40 + Math.floor(i / 2) * 26, 20, 10))
    const p = paginaDoOcr(1, 595, 842, 0.5, [bloco(linhas)]).pagina
    const b = blocosDoOcr(p.itens, MAX_BLOCOS_TEXTO)
    expect(b.length).toBeLessThanOrEqual(MAX_BLOCOS_TEXTO)
    expect(b.length).toBeLessThan(20)
    const todas = b.flatMap((x) => x.texto.split('\n'))
    expect(todas).toHaveLength(260)
    // cada bloco é uma coluna: só linhas pares ou só ímpares, em ordem
    for (const x of b) {
      const nums = x.texto.split('\n').map((s) => Number(/Linha (\d+)/.exec(s)![1]))
      expect(new Set(nums.map((n) => n % 2)).size).toBe(1)
      expect(nums).toEqual([...nums].sort((a, z) => a - z))
    }
    // a entrelinha do bloco é a das linhas (26 px de passo ÷ tamanho)
    expect(b[0]!.entrelinha).toBeCloseTo(26 / (20 / 0.93), 2)
    const c = cenaDaPagina({ numero: 1, assetId: 'a', larguraPt: 595, alturaPt: 842, blocos: b }, 0, 'slides', { textoSelecionavel: true })
    expect(c.layers.length).toBeLessThanOrEqual(1 + MAX_BLOCOS_TEXTO)
  })

  it('sem nada reconhecido: nenhuma camada de texto', () => {
    expect(blocosDoOcr([])).toEqual([])
    expect(blocosDoOcr(paginaDoOcr(1, 100, 100, 1, null).pagina.itens)).toEqual([])
  })
})

// ---------- com o Tesseract de verdade ----------

const PX_POR_PT = 200 / 72
const LINHAS: [string, number, number, number][] = [
  ['Plano de expansão 2026', 24, 60, 100],
  ['A Cooperativa Serra Verde vai abrir duas lojas em Minas Gerais e', 11, 60, 150],
  ['dobrar a produção de café especial, com investimento de R$ 2,4 milhões.', 11, 60, 166],
  ['Prioridades para o próximo ano', 16, 300, 260],
]

const require = createRequire(import.meta.url)
let pastaIdiomas = ''
beforeAll(() => {
  pastaIdiomas = mkdtempSync(join(tmpdir(), 'mostra-camada-ocr-'))
  for (const l of OCR.idiomas) copyFileSync(join(dirname(require.resolve(`@tesseract.js-data/${l}/package.json`)), '4.0.0_best_int', `${l}.traineddata.gz`), join(pastaIdiomas, `${l}.traineddata.gz`))
})
afterAll(() => { if (pastaIdiomas) rmSync(pastaIdiomas, { recursive: true, force: true }) })

describe('página escaneada reconhecida pelo Tesseract → camada sobre as linhas desenhadas', () => {
  it('cada camada começa na linha, com a linha de base e a largura da linha desenhada', async () => {
    const c = createCanvas(Math.round(595.28 * PX_POR_PT), Math.round(841.89 * PX_POR_PT))
    const g = c.getContext('2d')
    g.fillStyle = '#F3F1EC'
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = '#1C1C1C'
    // larguras medidas no próprio canvas (pontos), para conferir a camada
    const medidas = LINHAS.map(([texto, pt, x, y]) => { g.font = `${pt * PX_POR_PT}px sans-serif`; g.fillText(texto, x * PX_POR_PT, y * PX_POR_PT); return { texto, x, y, largura: g.measureText(texto).width / PX_POR_PT } })
    const worker = await createWorker([...OCR.idiomas], 1, { langPath: pastaIdiomas, cacheMethod: 'none', gzip: true })
    try {
      await worker.setParameters({ user_defined_dpi: '200' })
      const r = await worker.recognize(c.toBuffer('image/png'), { rotateAuto: true }, { blocks: true, text: false })
      const pagina = paginaDoOcr(1, 595.28, 841.89, PX_POR_PT, r.data.blocks as unknown as BlocoOcr[]).pagina
      const blocos = blocosDoOcr(pagina.itens)
      expect(blocos).toHaveLength(LINHAS.length)
      const desvios = { x: 0, base: 0, largura: 0 }
      for (const [i, m] of medidas.entries()) {
        const b = blocos[i]!
        expect(b.texto.replace(/\s+/g, ' ')).toBe(m.texto)
        // começa na linha (o Tesseract mede a tinta; o avanço da fonte tem um respiro de ~1 pt)
        expect(Math.abs(b.x - m.x)).toBeLessThan(1.5)
        // linha de base da Arial na da imagem
        expect(Math.abs(b.y + baseDesdeOTopo(b.tamanho, b.entrelinha) - m.y)).toBeLessThan(1.5)
        // com o espaçamento, a Arial ocupa a largura desenhada (±3%)
        const largura = larguraArial(b.texto, b.tamanho) + [...b.texto].length * (b.espacamento ?? 0)
        expect(Math.abs(largura - m.largura) / m.largura).toBeLessThan(0.03)
        desvios.x = Math.max(desvios.x, Math.abs(b.x - m.x))
        desvios.base = Math.max(desvios.base, Math.abs(b.y + baseDesdeOTopo(b.tamanho, b.entrelinha) - m.y))
        desvios.largura = Math.max(desvios.largura, Math.abs(largura - m.largura) / m.largura)
      }
      console.log(`Camada do OCR sobre a página: desvio máximo de ${desvios.x.toFixed(2)} pt no início da linha, ${desvios.base.toFixed(2)} pt na linha de base, ${(desvios.largura * 100).toFixed(1)}% na largura`)
    } finally {
      await worker.terminate()
    }
  }, 120_000)
})
