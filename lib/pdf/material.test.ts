import { describe, expect, it } from 'vitest'
import { juntarPaginas, listaDePaginas, paginasParaIa, resumoMaterial } from './material'

describe('material lido', () => {
  it('junta o texto das páginas na ordem (inclusive as lidas pela IA) e corta no teto', () => {
    const paginas = ['# Capa', '', '  texto da IA  ', 'fim']
    expect(juntarPaginas(paginas, 1000)).toEqual({ texto: '# Capa\n\ntexto da IA\n\nfim', cortado: false })
    expect(juntarPaginas(paginas, 10)).toEqual({ texto: '# Capa\n\nte', cortado: true })
  })
  it('páginas para a IA respeitam o limite do plano', () => {
    expect(paginasParaIa([2, 5, 9, 12], 3)).toEqual([2, 5, 9])
    expect(paginasParaIa([2], 0)).toEqual([])
  })
  it('resumo e lista de páginas em português', () => {
    expect(resumoMaterial({ tipo: 'pdf', paginas: 12, caracteres: 18420, titulos: 3, itensLista: 1, tabelas: 2 })).toBe('12 páginas · 18.420 caracteres lidos · 3 títulos · 1 item de lista · 2 tabelas')
    expect(resumoMaterial({ tipo: 'docx', paginas: 0, caracteres: 1, titulos: 0, itensLista: 0, tabelas: 0 })).toBe('1 caractere lido')
    expect(listaDePaginas([3])).toBe('3')
    expect(listaDePaginas([3, 7, 9])).toBe('3, 7 e 9')
    expect(listaDePaginas([4, 5, 6, 7, 8])).toBe('4 a 8')
  })
})
