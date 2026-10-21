/**
 * Extração e normalização do texto de PDFs: PDFs pequenos gerados aqui mesmo (jsPDF) e lidos pelo pdf.js (build
 * "legacy", o que roda no Node), passando pelo mesmo `extrairPaginas` do navegador.
 */
import { jsPDF } from 'jspdf'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import { extrairPaginas } from './ler'
import { blocosPosicionados, estruturarPdf, limparTrecho, linhasDaPagina, ordemDeLeitura, type ItemPdf } from './texto'

async function ler(doc: jsPDF) {
  const bytes = new Uint8Array(doc.output('arraybuffer'))
  const tarefa = pdfjs.getDocument({ data: bytes, verbosity: 0 })
  try {
    return await extrairPaginas(await tarefa.promise, (a, b) => pdfjs.Util.transform(a, b) as number[])
  } finally {
    await tarefa.destroy()
  }
}

/** Relatório de 3 páginas: título, parágrafo com hifenização, lista, tabela, cabeçalho e rodapé repetidos. */
function relatorio() {
  const d = new jsPDF({ unit: 'pt', format: 'a4' })
  for (let p = 1; p <= 3; p++) {
    if (p > 1) d.addPage()
    d.setFontSize(9)
    d.text('Atlas Cerâmica · Relatório confidencial', 50, 30)
    d.text(`Página ${p} de 3`, 270, 815)
    if (p === 1) {
      d.setFontSize(26)
      d.text('Relatório anual 2025', 50, 90)
      d.setFontSize(11)
      d.text('A receita cresceu 23,5% e chegou a R$ 1.234.567,89 no ano, com a abertura de três lo-', 50, 130)
      d.text('jas e margem de 18%. O time passou de 12 para 19 pessoas.', 50, 144)
      d.setFontSize(16)
      d.text('Destaques', 50, 190)
      d.setFontSize(11)
      d.text('• Exportação para 4 países', 60, 215)
      d.text('• NPS de 72 pontos', 60, 229)
      d.text('1. Novo forno elétrico', 60, 243)
    }
    if (p === 2) {
      d.setFontSize(16)
      d.text('Resultados por região', 50, 90)
      d.setFontSize(11)
      d.text('Região', 50, 120); d.text('Receita', 200, 120); d.text('Margem', 350, 120)
      d.text('Sul', 50, 136); d.text('R$ 300 mil', 200, 136); d.text('12%', 350, 136)
      d.text('Norte', 50, 152); d.text('R$ 120 mil', 200, 152); d.text('9,5%', 350, 152)
      d.text('O Sul respondeu pela maior parte do crescimento e', 50, 190)
    }
    if (p === 3) {
      d.setFontSize(11)
      d.text('continua sendo a prioridade para 2026.', 50, 90)
    }
  }
  return d
}

describe('estruturarPdf (PDF gerado)', () => {
  it('reconstrói títulos, parágrafos, listas e tabela e mantém os números', async () => {
    const r = estruturarPdf(await ler(relatorio()))
    expect(r.paginas).toBe(3)
    expect(r.texto).toContain('# Relatório anual 2025')
    expect(r.texto).toContain('## Destaques')
    // hifenização desfeita, parágrafo numa linha, números intactos
    expect(r.texto).toContain('A receita cresceu 23,5% e chegou a R$ 1.234.567,89 no ano, com a abertura de três lojas e margem de 18%. O time passou de 12 para 19 pessoas.')
    expect(r.texto).toContain('- Exportação para 4 países\n- NPS de 72 pontos\n1. Novo forno elétrico')
    expect(r.texto).toContain('| Região | Receita | Margem |\n| --- | --- | --- |\n| Sul | R$ 300 mil | 12% |\n| Norte | R$ 120 mil | 9,5% |')
    expect(r.tabelas).toBe(1)
    expect(r.itensLista).toBe(3)
    expect(r.titulos).toBe(3)
    // parágrafo que atravessa a página vira um só
    expect(r.texto).toContain('O Sul respondeu pela maior parte do crescimento e continua sendo a prioridade para 2026.')
    // cabeçalho repetido e número de página saem
    expect(r.texto).not.toContain('confidencial')
    expect(r.texto).not.toMatch(/Página \d de 3/)
    expect(r.paginasSemTexto).toEqual([])
    expect(r.caracteres).toBe(r.texto.length)
  })

  it('ordem de leitura em duas colunas: a esquerda inteira antes da direita', async () => {
    const d = new jsPDF({ unit: 'pt', format: 'a4' })
    d.setFontSize(20)
    d.text('Artigo em duas colunas', 50, 70)
    d.setFontSize(10)
    for (let i = 0; i < 8; i++) {
      d.text(`Coluna esquerda linha ${i + 1} com texto corrido`, 50, 110 + i * 13)
      d.text(`Coluna direita linha ${i + 1} com mais texto aqui`, 310, 110 + i * 13)
    }
    const r = estruturarPdf(await ler(d))
    const esq = r.texto.indexOf('Coluna esquerda linha 8')
    const dir = r.texto.indexOf('Coluna direita linha 1')
    expect(esq).toBeGreaterThan(0)
    expect(dir).toBeGreaterThan(esq)
    expect(r.texto.startsWith('# Artigo em duas colunas')).toBe(true)
    expect(r.tabelas).toBe(0)
  })

  it('página sem texto (escaneada ou só imagem) é apontada', async () => {
    const d = new jsPDF({ unit: 'pt', format: 'a4' })
    d.setFontSize(12)
    d.text('Capa com texto suficiente para contar como página lida.', 50, 80)
    d.addPage()
    d.setFillColor(40, 40, 40)
    d.rect(40, 40, 500, 700, 'F')
    const r = estruturarPdf(await ler(d))
    expect(r.paginasSemTexto).toEqual([2])
  })
})

describe('normalização (unidades)', () => {
  const it_ = (texto: string, x: number, y: number, tamanho = 10, largura = texto.length * tamanho * 0.5): ItemPdf => ({ texto, x, y, largura, tamanho })

  it('limpa ligaduras, hífen discricionário e espaços especiais', () => {
    expect(limparTrecho('eﬁciência ﬂuxo co­me​ço')).toBe('eficiência fluxo começo')
  })

  it('junta trechos da mesma linha e separa vãos largos em segmentos', () => {
    const linhas = linhasDaPagina([it_('Total', 50, 100), it_('R$ 10', 200, 100.5), it_('Olá', 50, 120), it_('mundo', 68, 120)])
    expect(linhas).toHaveLength(2)
    expect(linhas[0]!.segmentos.map((s) => s.texto)).toEqual(['Total', 'R$ 10'])
    expect(linhas[1]!.texto).toBe('Olá mundo')
  })

  it('marcador solto ("•" e o texto com vão) continua no mesmo segmento', () => {
    const [l] = linhasDaPagina([it_('•', 60, 100, 10, 4), it_('Primeiro item', 90, 100)])
    expect(l!.segmentos).toHaveLength(1)
    expect(l!.texto).toBe('• Primeiro item')
  })

  it('tabela com 2 colunas não é confundida com duas colunas de texto', () => {
    const linhas = linhasDaPagina(Array.from({ length: 8 }, (_, i) => [it_(`Item ${i}`, 50, 100 + i * 14), it_(`${i * 10}%`, 400, 100 + i * 14)]).flat())
    expect(ordemDeLeitura(linhas, 595)).toEqual(linhas)
    const r = estruturarPdf([{ numero: 1, largura: 595, altura: 842, itens: linhas.flatMap((l) => l.segmentos.map((s) => it_(s.texto, s.x, l.y))) }])
    expect(r.tabelas).toBe(1)
    expect(r.texto).toContain('| Item 7 | 70% |')
  })

  it('blocos posicionados agrupam linhas do mesmo parágrafo e respeitam o máximo', () => {
    const itens = [it_('Título', 50, 60, 24), it_('linha um do texto', 50, 100), it_('linha dois do texto', 50, 113), it_('outro bloco', 50, 200)]
    const b = blocosPosicionados(itens)
    expect(b.map((x) => x.texto)).toEqual(['Título', 'linha um do texto\nlinha dois do texto', 'outro bloco'])
    expect(b[1]!.entrelinha).toBeCloseTo(1.3, 1)
    expect(b[0]!.y).toBeLessThan(60)
    const muitos = blocosPosicionados(Array.from({ length: 50 }, (_, i) => it_(`l${i}`, 50, 100 + i * 40)), 10)
    expect(muitos).toHaveLength(10)
    expect(muitos[9]!.texto.split('\n')).toHaveLength(41)
  })
})
