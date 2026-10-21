import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { ErroDocx, textoDoDocx } from './docx'

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const p = (texto: string, estilo?: string, lista = false) =>
  `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${lista ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}</w:pPr><w:r><w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`
const celula = (t: string) => `<w:tc><w:tcPr/>${p(t)}</w:tc>`
const docx = (corpo: string, styles?: string) =>
  zipSync({
    '[Content_Types].xml': strToU8('<Types/>'),
    'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${corpo}<w:sectPr/></w:body></w:document>`),
    ...(styles ? { 'word/styles.xml': strToU8(`<w:styles ${W}>${styles}</w:styles>`) } : {}),
  })

describe('textoDoDocx', () => {
  it('títulos (pelo nome do estilo, em qualquer idioma), parágrafos, listas e tabela', () => {
    const styles = '<w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/></w:style>'
    const corpo = [
      p('Proposta comercial', 'Ttulo1'),
      p('Investimento de R$ 48.500,00 em 6 semanas &amp; suporte.'),
      p('Entregas', 'Ttulo2'),
      p('Diagnóstico', undefined, true),
      p('Identidade visual', undefined, true),
      `<w:tbl><w:tr>${celula('Etapa')}${celula('Prazo')}</w:tr><w:tr>${celula('Conceito')}${celula('2 semanas')}</w:tr></w:tbl>`,
      `<w:p><w:r><w:t>Texto</w:t></w:r><w:del><w:r><w:delText>apagado</w:delText></w:r></w:del><w:r><w:tab/><w:t>final</w:t></w:r></w:p>`,
    ].join('')
    const r = textoDoDocx(docx(corpo, styles))
    expect(r.texto).toBe(
      '# Proposta comercial\n\nInvestimento de R$ 48.500,00 em 6 semanas & suporte.\n\n## Entregas\n\n- Diagnóstico\n- Identidade visual\n\n| Etapa | Prazo |\n| --- | --- |\n| Conceito | 2 semanas |\n\nTexto final'
    )
    expect(r).toMatchObject({ titulos: 2, itensLista: 2, tabelas: 1, caracteres: r.texto.length })
  })

  it('sem styles.xml, reconhece Heading1/Título pelo id', () => {
    const r = textoDoDocx(docx(p('Capa', 'Title') + p('Seção', 'Heading2') + p('Corpo')))
    expect(r.texto).toBe('# Capa\n\n## Seção\n\nCorpo')
  })

  it('recusa arquivo que não é .docx', () => {
    expect(() => textoDoDocx(new Uint8Array([1, 2, 3, 4]))).toThrow(ErroDocx)
    expect(() => textoDoDocx(zipSync({ 'a.txt': strToU8('oi') }))).toThrow(ErroDocx)
  })
})
