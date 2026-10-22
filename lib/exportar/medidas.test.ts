import { describe, expect, it } from 'vitest'
import { novaCena, parseCamada } from '@/lib/scene/schema'
import { AREA_MAXIMA, LADO_MAXIMO, caixaVisivel, cenaDaSelecao, escalaSegura, nomeArquivo, paginaPdf } from './medidas'

describe('páginas do PDF', () => {
  it('uma página do tamanho da tela (px → pt a 72/96)', () => {
    expect(paginaPdf({ width: 1920, height: 1080 })).toEqual({ largura: 1440, altura: 810, orientacao: 'landscape' })
    expect(paginaPdf({ width: 1080, height: 1920 })).toEqual({ largura: 810, altura: 1440, orientacao: 'portrait' })
    expect(paginaPdf({ width: 1080, height: 1080 }).orientacao).toBe('landscape')
  })
})

describe('escala segura do canvas', () => {
  it('mantém 1–3× em telas normais', () => {
    expect(escalaSegura({ width: 1920, height: 1080 }, 3)).toBe(3)
  })
  it('reduz quando passaria do lado ou da área máxima', () => {
    const s = escalaSegura({ width: 8192, height: 8192 }, 3)
    expect(8192 * s).toBeLessThanOrEqual(LADO_MAXIMO)
    expect(8192 * s * 8192 * s).toBeLessThanOrEqual(AREA_MAXIMA + 1)
  })
})

describe('exportar seleção', () => {
  const cena = novaCena({
    id: 's',
    size: { width: 1920, height: 1080 },
    background: '#EEE7DB',
    layers: [
      parseCamada({ id: 'f', type: 'frame', x: 100, y: 100, width: 400, height: 300, fill: '#ffffff' }),
      parseCamada({ id: 'c', type: 'shape', x: 120, y: 120, width: 50, height: 50, parentId: 'f' }),
      parseCamada({ id: 'o', type: 'shape', x: 1000, y: 800, width: 100, height: 100 }),
    ],
  })
  it('recorta na caixa da seleção, com fundo transparente e o conteúdo dos frames', () => {
    const sub = cenaDaSelecao(cena, ['f'])!
    expect(sub.size).toEqual({ width: 400, height: 300 })
    expect(sub.background).toBe('#00000000')
    expect(sub.layers.map((l) => l.id)).toEqual(['f', 'c'])
    expect(sub.layers.find((l) => l.id === 'c')).toMatchObject({ x: 20, y: 20, parentId: 'f' })
  })
  it('filho selecionado sai do frame (vira raiz)', () => {
    const sub = cenaDaSelecao(cena, ['c'])!
    expect(sub.layers).toHaveLength(1)
    expect(sub.layers[0]).toMatchObject({ x: 0, y: 0, parentId: undefined })
  })
  it('texto com corte vertical exporta a linha inteira (acentos e descendentes não são cortados)', () => {
    const t = parseCamada({ id: 't', type: 'text', x: 100, y: 100, width: 400, height: 71, text: 'Hgj', fontFamily: 'Geist', fontSize: 100, lineHeight: 1.2, leadingTrim: 'cap' })
    const sub = cenaDaSelecao(novaCena({ id: 's', size: { width: 1920, height: 1080 }, layers: [t] }), ['t'])!
    expect(sub.size.height).toBeGreaterThanOrEqual(120)
    expect(sub.layers[0]!.y).toBeGreaterThan(0)
  })
  it('texto com entrelinha justa exporta a tinta toda (descendentes de "pçg" passam da caixa)', () => {
    const t = parseCamada({ id: 't', type: 'text', x: 100, y: 100, width: 1400, height: 280, text: 'O próximo resultado\ncomeça agora', fontFamily: 'Geist', fontSize: 140, lineHeight: 1 })
    const sub = cenaDaSelecao(novaCena({ id: 's', size: { width: 1920, height: 1080 }, layers: [t] }), ['t'])!
    // Geist: ascendente 1,005 + descendente 0,295 = 1,3em; com entrelinha 1,0 sobram .15em em cima e embaixo
    expect(sub.size.height).toBe(280 + 2 * 21)
    expect(sub.layers[0]!.y).toBe(21)
    // entrelinha folgada (≥ 1,3): a caixa já contém a tinta
    const folgado = parseCamada({ id: 'f', type: 'text', x: 0, y: 0, width: 400, height: 150, text: 'Hgj', fontFamily: 'Geist', fontSize: 100, lineHeight: 1.5 })
    expect(cenaDaSelecao(novaCena({ id: 's', size: { width: 1920, height: 1080 }, layers: [folgado] }), ['f'])!.size).toEqual({ width: 400, height: 150 })
  })
  it('várias camadas: caixa que envolve todas; ocultas não contam', () => {
    expect(cenaDaSelecao(cena, ['c', 'o'])!.size).toEqual({ width: 980, height: 780 })
    const oculta = { ...cena, layers: cena.layers.map((l) => (l.id === 'o' ? { ...l, hidden: true } : l)) }
    expect(cenaDaSelecao(oculta, ['o'])).toBeNull()
  })
  it('a máscara da camada exportada vai junto (sem entrar na caixa)', () => {
    const m = parseCamada({ id: 'm', type: 'text', text: 'FOTO', x: 0, y: 0, width: 2000, height: 50, isMask: true })
    const foto = parseCamada({ id: 'p', type: 'image', assetId: 'a', x: 100, y: 100, width: 200, height: 100, maskId: 'm' })
    const sub = cenaDaSelecao(novaCena({ id: 's', size: { width: 1920, height: 1080 }, layers: [m, foto] }), ['p'])!
    expect(sub.size).toEqual({ width: 200, height: 100 })
    expect(sub.layers.map((l) => l.id)).toEqual(['m', 'p'])
  })
  it('rotação aumenta a caixa', () => {
    const r = caixaVisivel({ x: 0, y: 0, width: 100, height: 100, rotation: 45 })
    expect(r.width).toBeCloseTo(141.42, 1)
  })
})

describe('nome do arquivo', () => {
  it('sem acentos e caracteres proibidos, com sufixo de escala', () => {
    expect(nomeArquivo(['Atlas Cerâmica — Identidade', '03 Capa/Final'], 2, 'png')).toBe('Atlas Ceramica - Identidade - 03 Capa Final@2x.png')
    expect(nomeArquivo([undefined, ''], 1, 'pdf')).toBe('mostra.pdf')
  })
})
