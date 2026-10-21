import { describe, expect, it } from 'vitest'
import { aposLeituraIa, juntarPaginas, listaDePaginas, paginasParaIa, resumoMaterial, type MaterialLido } from './material'

describe('material lido', () => {
  it('junta o texto das páginas na ordem (inclusive as lidas pela IA) e corta no teto', () => {
    const paginas = ['# Capa', '', '  texto da IA  ', 'fim']
    expect(juntarPaginas(paginas, 1000)).toEqual({ texto: '# Capa\n\ntexto da IA\n\nfim', cortado: false })
    expect(juntarPaginas(paginas, 10)).toEqual({ texto: '# Capa\n\nte', cortado: true })
  })
  it('páginas para a IA: primeiro as sem texto, depois as lidas por OCR, no limite do plano e em ordem', () => {
    expect(paginasParaIa({ semTexto: [2, 5, 9, 12] }, 3)).toEqual([2, 5, 9])
    expect(paginasParaIa({ semTexto: [2] }, 0)).toEqual([])
    expect(paginasParaIa({ semTexto: [9], lidasPorOcr: [2, 4, 6] }, 3)).toEqual([2, 4, 9])
    expect(paginasParaIa({ semTexto: [], lidasPorOcr: [3, 4] }, 10)).toEqual([3, 4])
  })
  it('depois da IA, as páginas pedidas saem de "sem texto" e de "lidas por OCR"', () => {
    const m: MaterialLido = { arquivo: 'a.pdf', tipo: 'pdf', paginas: 6, caracteres: 10, titulos: 0, itensLista: 0, tabelas: 0, semTexto: [5, 6], lidasPorOcr: [2, 3], ocrIncerto: [3], lidasPelaIa: [], emBranco: [], cortado: false }
    const r = aposLeituraIa(m, [3, 5, 6], [3, 5], [6])
    expect(r).toMatchObject({ semTexto: [], lidasPorOcr: [2], ocrIncerto: [], lidasPelaIa: [3, 5], emBranco: [6] })
  })
  it('resumo e lista de páginas em português', () => {
    expect(resumoMaterial({ tipo: 'pdf', paginas: 12, caracteres: 18420, titulos: 3, itensLista: 1, tabelas: 2 })).toBe('12 páginas · 18.420 caracteres lidos · 3 títulos · 1 item de lista · 2 tabelas')
    expect(resumoMaterial({ tipo: 'docx', paginas: 0, caracteres: 1, titulos: 0, itensLista: 0, tabelas: 0 })).toBe('1 caractere lido')
    expect(listaDePaginas([3])).toBe('3')
    expect(listaDePaginas([3, 7, 9])).toBe('3, 7 e 9')
    expect(listaDePaginas([4, 5, 6, 7, 8])).toBe('4 a 8')
  })
})
