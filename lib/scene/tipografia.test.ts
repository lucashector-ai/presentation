import { describe, expect, it } from 'vitest'
import { CamadaTextoSchema, parseCamada, type CamadaTexto } from './schema'
import { METRICAS_FONTES, caixaCss, corpoTexto, corteVertical, decoracaoCss, estiloCaixaTexto, kebab, linhasVisiveis, paragrafosDe, recuoLista, temOpcoesDeTexto } from './tipografia'

const texto = (p: Partial<CamadaTexto> = {}): CamadaTexto => CamadaTextoSchema.parse({ id: 't', type: 'text', x: 0, y: 0, width: 400, height: 100, text: 'Olá', fontSize: 100, lineHeight: 1.2, ...p })

describe('corte vertical', () => {
  it('sem corte não tira nada', () => {
    expect(corteVertical(texto())).toEqual({ topo: 0, base: 0 })
  })
  it('Geist: tira meia-entrelinha + (ascendente − maiúsculas) em cima e meia-entrelinha + descendente embaixo', () => {
    const m = METRICAS_FONTES.Geist!
    const c = corteVertical(texto({ leadingTrim: 'cap', fontFamily: 'Geist' }))
    const meia = (120 - (m.ascent + m.descent) * 100) / 2
    expect(c.topo).toBeCloseTo(meia + (m.ascent - m.capHeight) * 100, 1)
    expect(c.base).toBeCloseTo(meia + m.descent * 100, 1)
    // a linha que sobra é exatamente a altura das maiúsculas
    expect(120 - c.topo - c.base).toBeCloseTo(m.capHeight * 100, 1)
  })
  it('fonte fora da biblioteca usa métricas típicas', () => {
    const c = corteVertical(texto({ leadingTrim: 'cap', fontFamily: 'Fonte Qualquer' }))
    expect(120 - c.topo - c.base).toBeCloseTo(70, 1)
  })
})

describe('truncar', () => {
  it('desligado ou altura automática sem máximo: sem limite', () => {
    expect(linhasVisiveis(texto())).toBeUndefined()
    expect(linhasVisiveis(texto({ truncate: true, sizingH: 'hug' }))).toBeUndefined()
  })
  it('máximo de linhas vale; altura fixa sem máximo corta no que couber', () => {
    expect(linhasVisiveis(texto({ truncate: true, maxLines: 2 }))).toBe(2)
    expect(linhasVisiveis(texto({ truncate: true, height: 250 }))).toBe(2)
    expect(linhasVisiveis(texto({ truncate: true, height: 50 }))).toBe(1)
  })
  it('corpo com reticências usa line-clamp', () => {
    expect(corpoTexto(texto({ truncate: true, maxLines: 3 })).estilo).toMatchObject({ display: '-webkit-box', WebkitLineClamp: 3, overflow: 'hidden' })
  })
})

describe('decoração, caixa e caixa do texto', () => {
  it('sublinhado/tachado com estilo, espessura, deslocamento, pular descendentes e cor', () => {
    expect(decoracaoCss(texto())).toEqual({})
    expect(decoracaoCss(texto({ underline: true, decorationStyle: 'wavy', decorationThickness: 3, decorationOffset: 6, decorationSkipInk: false, decorationColor: '#FF0000' }))).toEqual({ textDecorationLine: 'underline', textDecorationStyle: 'wavy', textDecorationThickness: 3, textUnderlineOffset: 6, textDecorationSkipInk: 'none', textDecorationColor: '#FF0000' })
    expect(decoracaoCss(texto({ strikethrough: true, decorationOffset: 6 })).textDecorationLine).toBe('line-through')
    expect(decoracaoCss(texto({ strikethrough: true, decorationOffset: 6 })).textUnderlineOffset).toBeUndefined()
  })
  it('caixa: transformação ou versalete', () => {
    expect(caixaCss('none')).toEqual({})
    expect(caixaCss('capitalize')).toEqual({ textTransform: 'capitalize' })
    expect(caixaCss('smallCaps')).toEqual({ fontVariantCaps: 'small-caps' })
    expect(caixaCss('allSmallCaps')).toEqual({ fontVariantCaps: 'all-small-caps' })
  })
  it('quebra equilibrada só com largura fixa; corte vertical deixa as letras passarem da caixa', () => {
    expect(estiloCaixaTexto(texto({ textWrap: 'balance' }))).toMatchObject({ whiteSpace: 'pre-wrap', textWrap: 'balance' })
    expect(estiloCaixaTexto(texto({ textWrap: 'balance', sizingW: 'hug' })).textWrap).toBeUndefined()
    expect(estiloCaixaTexto(texto({ leadingTrim: 'cap' })).overflow).toBe('visible')
    expect(estiloCaixaTexto(texto({ leadingTrim: 'cap', truncate: true, maxLines: 1 })).overflow).toBe('hidden')
  })
  it('a caixa nunca corta as letras (acentos e descendentes passam dela, como no Figma); só truncar corta', () => {
    expect(estiloCaixaTexto(texto({ lineHeight: 1 })).overflow).toBe('visible')
    expect(estiloCaixaTexto(texto({ sizingH: 'fixed', height: 40 })).overflow).toBe('visible')
    expect(estiloCaixaTexto(texto({ truncate: true, maxLines: 2 })).overflow).toBe('hidden')
  })
  it('documento antigo: mesmo estilo de antes (sem recursos novos)', () => {
    const c = texto({ underline: true, transform: 'uppercase' })
    expect(estiloCaixaTexto(c)).toMatchObject({ textDecorationLine: 'underline', textTransform: 'uppercase', overflow: 'visible', whiteSpace: 'pre-wrap' })
    const corpo = corpoTexto(c)
    expect(corpo.estilo).toEqual({})
    expect(corpo.classe).toBeUndefined()
    expect(corpo.paragrafos).toBeNull()
    expect(temOpcoesDeTexto(c)).toBe(false)
  })
})

describe('listas e parágrafos', () => {
  it('parágrafos só quando há lista ou espaço entre parágrafos', () => {
    expect(paragrafosDe(texto({ text: 'a\nb' }))).toBeNull()
    expect(paragrafosDe(texto({ text: 'a\nb', listStyle: 'bullet' }))).toEqual(['a', 'b'])
    expect(paragrafosDe(texto({ text: 'a\n\nb', paragraphSpacing: 8 }))).toEqual(['a', '', 'b'])
  })
  it('itens com marcador/número, espaço entre parágrafos e recuo', () => {
    const c = corpoTexto(texto({ text: 'a\n\nb', listStyle: 'number', paragraphSpacing: 10 }))
    expect(c.paragrafo(0, 'a')).toMatchObject({ display: 'list-item', listStyleType: 'decimal', marginTop: undefined })
    expect(c.paragrafo(1, '')).toMatchObject({ display: 'block' })
    expect(c.paragrafo(2, 'b')).toMatchObject({ display: 'list-item', marginTop: 10 })
    expect(recuoLista(texto({ listStyle: 'bullet' }))).toBe('1.25em')
    expect(c.estilo).toMatchObject({ counterReset: 'list-item' })
  })
})

describe('schema', () => {
  it('campos novos são opcionais e validados; caixa antiga continua valendo', () => {
    expect(() => parseCamada({ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x', transform: 'lowercase' })).not.toThrow()
    expect(() => parseCamada({ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x', leadingTrim: 'cap', listStyle: 'number', maxLines: 2, truncate: true, transform: 'smallCaps', decorationStyle: 'dotted' })).not.toThrow()
    expect(() => parseCamada({ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x', maxLines: 0 })).toThrow()
    expect(() => parseCamada({ id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x', leadingTrim: 'ascender' })).toThrow()
  })
  it('kebab converte propriedades com prefixo', () => {
    expect(kebab('WebkitLineClamp')).toBe('-webkit-line-clamp')
    expect(kebab('WebkitBoxOrient')).toBe('-webkit-box-orient')
    expect(kebab('--corte-topo')).toBe('--corte-topo')
    expect(kebab('textDecorationSkipInk')).toBe('text-decoration-skip-ink')
  })
})
