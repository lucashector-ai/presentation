/**
 * Importar PDF como apresentação: um PDF de 3 páginas (jsPDF) lido pelo mesmo `extrairPaginas` do navegador
 * vira 3 telas válidas, com a imagem da página e o texto invisível no lugar certo.
 */
import { jsPDF } from 'jspdf'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { DocumentoProjetoSchema } from '@/lib/scene/schema'
import { validarDocumento } from '@/lib/scene/validate'
import { extrairPaginas } from './ler'
import { COR_TEXTO_INVISIVEL, cenaDaPagina, documentoDePaginas, ehTextoInvisivel, ladoDaImagem, MAX_BLOCOS_TEXTO, tamanhoDaTela, type PaginaImportada } from './paginas'
import { blocosPosicionados } from './texto'

async function paginasDe(d: jsPDF) {
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(d.output('arraybuffer')), verbosity: 0 })
  try { return await extrairPaginas(await tarefa.promise, (a, b) => pdfjs.Util.transform(a, b) as number[]) } finally { await tarefa.destroy() }
}

describe('tamanho da tela', () => {
  it('slides 16:9 → 1920×1080; A4 retrato → lado maior 1920; Story → largura 1080', () => {
    expect(tamanhoDaTela(960, 540, 'slides')).toEqual({ width: 1920, height: 1080 })
    expect(tamanhoDaTela(595.28, 841.89, 'slides')).toEqual({ width: 1358, height: 1920 })
    expect(tamanhoDaTela(595.28, 841.89, 'story')).toEqual({ width: 1080, height: 1527 })
    expect(tamanhoDaTela(10000, 1, 'slides').height).toBeGreaterThanOrEqual(16)
    expect(ladoDaImagem({ width: 1920, height: 1080 }, 2)).toBe(3840)
  })
})

describe('PDF de 3 páginas → apresentação', () => {
  it('uma tela por página, imagem cobrindo a tela e texto invisível sobre as palavras', async () => {
    const d = new jsPDF({ unit: 'pt', format: [960, 540], orientation: 'landscape' })
    const titulos = ['Proposta Atlas', 'Cronograma em 6 semanas', 'Investimento de R$ 48 mil']
    titulos.forEach((t, i) => {
      if (i) d.addPage([960, 540], 'landscape')
      d.setFontSize(40)
      d.text(t, 80, 140)
      d.setFontSize(18)
      d.text(`Linha de apoio da página ${i + 1}`, 80, 200)
      d.text('com uma segunda linha', 80, 224)
    })
    const lidas = await paginasDe(d)
    const paginas: PaginaImportada[] = lidas.map((p, i) => ({ numero: p.numero, assetId: `asset-${i + 1}`, larguraPt: p.largura, alturaPt: p.altura, blocos: blocosPosicionados(p.itens) }))
    const doc = documentoDePaginas(paginas, 'slides', { textoSelecionavel: true })
    expect(DocumentoProjetoSchema.parse(doc)).toBeTruthy()
    expect(validarDocumento(doc, { assetsExistentes: new Set(['asset-1', 'asset-2', 'asset-3']) })).toMatchObject({ ok: true, erros: [] })
    expect(doc.scenes).toHaveLength(3)
    expect(doc.scenes.map((c) => c.title)).toEqual(titulos)
    const [c1] = doc.scenes
    expect(c1!.size).toEqual({ width: 1920, height: 1080 })
    expect(c1!.layers[0]).toMatchObject({ type: 'image', assetId: 'asset-1', x: 0, y: 0, width: 1920, height: 1080, fit: 'fill' })
    const textos = c1!.layers.filter((l) => l.type === 'text')
    expect(textos.map((l) => (l.type === 'text' ? l.text : ''))).toEqual(['Proposta Atlas', 'Linha de apoio da página 1\ncom uma segunda linha'])
    // escala pontos → px da tela (×2): título de 40 pt vira 80 px, na posição da página
    const t = textos[0]!
    expect(t.type === 'text' && t.fontSize).toBe(80)
    expect(t.x).toBe(160)
    expect(t.y).toBeGreaterThan(200)
    expect(t.y).toBeLessThan(280)
    expect(textos.every((l) => l.type === 'text' && l.color === COR_TEXTO_INVISIVEL && ehTextoInvisivel(l))).toBe(true)
    // transição suave entre as páginas
    expect(doc.scenes[1]!.transition).toMatchObject({ type: 'fade' })
  })

  it('sem texto selecionável: só a imagem; Explorar ganha posições no mapa', () => {
    const p: PaginaImportada = { numero: 7, assetId: 'a', larguraPt: 595, alturaPt: 842, blocos: [] }
    const c = cenaDaPagina(p, 4, 'explorar', { textoSelecionavel: false })
    expect(c.layers).toHaveLength(1)
    expect(c.title).toBe('Página 7')
    expect(c.map).toEqual({ x: 0, y: 2280 })
  })

  it('página densa: no máximo 1 imagem + MAX_BLOCOS_TEXTO camadas (abaixo do limite de 400 do schema)', () => {
    const blocos = Array.from({ length: 500 }, (_, i) => ({ texto: `b${i}`, x: 10, y: i, largura: 50, altura: 10, tamanho: 8, entrelinha: 1.2 }))
    const c = cenaDaPagina({ numero: 1, assetId: 'a', larguraPt: 595, alturaPt: 842, blocos }, 0, 'slides', { textoSelecionavel: true })
    expect(c.layers).toHaveLength(1 + MAX_BLOCOS_TEXTO)
  })
})
