import { describe, expect, it } from 'vitest'
import { ajustarTrechos, aplicarTrecho, limparTrecho, segmentar, valorNoIntervalo } from './trechos'
import { parseCamada, type CamadaTexto } from './schema'

const T = 'Lucas Hector'

describe('trechos (estilo em parte do texto)', () => {
  it('aplica cor só no trecho e junta vizinhos iguais', () => {
    let ts = aplicarTrecho([], 6, 12, { color: '#5965F2' }, T.length)
    expect(ts).toEqual([{ inicio: 6, fim: 12, color: '#5965F2' }])
    ts = aplicarTrecho(ts, 8, 10, { fontWeight: 900 }, T.length)
    expect(ts).toEqual([{ inicio: 6, fim: 8, color: '#5965F2' }, { inicio: 8, fim: 10, color: '#5965F2', fontWeight: 900 }, { inicio: 10, fim: 12, color: '#5965F2' }])
    expect(limparTrecho(ts, 0, T.length, T.length)).toEqual([])
  })
  it('segmenta o texto com o estilo de cada pedaço', () => {
    const ts = aplicarTrecho([], 6, 12, { fontFamily: 'Inter', italic: true }, T.length)
    expect(segmentar(T, ts).map((p) => [p.texto, p.estilo.fontFamily ?? null])).toEqual([['Lucas ', null], ['Hector', 'Inter']])
  })
  it('acompanha a digitação: inserir antes empurra, apagar dentro encolhe', () => {
    const ts = [{ inicio: 6, fim: 12, color: '#FF0000' }]
    expect(ajustarTrechos(ts, T, 'Sr. Lucas Hector')).toEqual([{ inicio: 10, fim: 16, color: '#FF0000' }])
    expect(ajustarTrechos(ts, T, 'Lucas Hec')).toEqual([{ inicio: 6, fim: 9, color: '#FF0000' }])
    expect(ajustarTrechos(ts, T, 'Lucas')).toEqual([])
  })
  it('valor do intervalo: igual em tudo ou misto', () => {
    const c = parseCamada({ id: 't', type: 'text', text: T, x: 0, y: 0, width: 100, height: 20, color: '#111111', trechos: [{ inicio: 6, fim: 12, color: '#5965F2' }] }) as CamadaTexto
    expect(valorNoIntervalo(c, 6, 12, 'color')).toBe('#5965F2')
    expect(valorNoIntervalo(c, 0, 12, 'color')).toBeUndefined()
    expect(valorNoIntervalo(c, 0, 5, 'color')).toBe('#111111')
  })
})
