import { describe, expect, it } from 'vitest'
import { AnimacaoSchema, TIPOS_ANIMACAO, parseCamada, type Animacao } from './schema'
import { ajustesDeIntensidade, ajustesQueServem, aplicarIntensidade, cssDaAnimacao, definicao, divisao, intensidadeDe, keyframeDaParte, parametros, semAjustesPadrao, temIntensidade } from './parametros'
import { agruparLinhas, analisarNumero, curvaBezier, formatarNumero, ordemDasPartes, passosDaOrdem } from './texto-animado'
import { PRESETS_ENTRADA, PRESETS_SAIDA, animacaoDoPreset, atrasosEfetivos, ehNumeroDestaque, esperaGatilho, interacoesDosGatilhos, presetSelecionado, tempoSegmentos } from './animacoes'

const anim = (p: Partial<Animacao> & Pick<Animacao, 'type'>): Animacao => AnimacaoSchema.parse({ duration: 600, ...p })

describe('parâmetros: padrões reproduzem o visual de antes', () => {
  it('slides: 40 px no sentido do movimento (entrada começa do lado oposto; saída termina no sentido)', () => {
    expect(cssDaAnimacao(anim({ type: 'slideUp' }), false).vars).toMatchObject({ '--anim-dx': '0px', '--anim-dy': '40px', '--anim-op': 0 })
    expect(cssDaAnimacao(anim({ type: 'slideLeft' }), false).vars).toMatchObject({ '--anim-dx': '40px', '--anim-dy': '0px' })
    expect(cssDaAnimacao(anim({ type: 'slideRight' }), false).vars).toMatchObject({ '--anim-dx': '-40px' })
    expect(cssDaAnimacao(anim({ type: 'slideOutUp' }), false).vars).toMatchObject({ '--anim-dy': '-40px' })
    expect(cssDaAnimacao(anim({ type: 'slideUp' }), false).keyframe).toBe('anim-mov')
    expect(cssDaAnimacao(anim({ type: 'slideOutDown' }), false).keyframe).toBe('anim-movSai')
  })
  it('escala, giro e desfoque padrão de cada preset', () => {
    expect(cssDaAnimacao(anim({ type: 'scaleIn' }), false).vars).toMatchObject({ '--anim-sx': 0.92, '--anim-sy': 0.92 })
    expect(cssDaAnimacao(anim({ type: 'rotateIn' }), false).vars).toMatchObject({ '--anim-rot': '-12deg', '--anim-sx': 0.94 })
    const zoom = cssDaAnimacao(anim({ type: 'zoomOut' }), false)
    expect(zoom.keyframe).toBe('anim-movBlur')
    expect(zoom.vars).toMatchObject({ '--anim-sx': 1.25, '--anim-blur': '6px' })
    expect(cssDaAnimacao(anim({ type: 'pop' }), false)).toMatchObject({ keyframe: 'anim-pop', vars: { '--anim-sx': 0.5 } })
  })
  it('todo tipo do schema tem definição, e keyframe (ou é texto/nenhuma)', () => {
    for (const t of TIPOS_ANIMACAO) {
      const d = definicao(t)
      expect(d).toBeTruthy()
      const r = cssDaAnimacao(anim({ type: t }), true)
      if (d.familia !== 'texto' && d.familia !== 'nenhuma') expect(r.keyframe).toMatch(/^anim-/)
    }
  })
  it('documentos antigos (sem ajustes) continuam válidos e sem campos novos', () => {
    const a = anim({ type: 'slideUp' })
    expect(a.distance).toBeUndefined()
    expect(parametros(a)).toMatchObject({ distance: 40, direction: 'up', opacity: 0, origin: 'center' })
  })
})

describe('parâmetros: ajustes', () => {
  it('distância e direção diagonal', () => {
    const v = cssDaAnimacao(anim({ type: 'slideUp', distance: 100, direction: 'up-right' }), false).vars
    expect(v['--anim-dx']).toBe('-70.71px')
    expect(v['--anim-dy']).toBe('70.71px')
  })
  it('diagonal em tipo que não aceita vira o eixo principal', () => {
    expect(parametros(anim({ type: 'reveal', direction: 'down-left' })).direction).toBe('down')
  })
  it('origem vira deslocamento a partir do centro', () => {
    expect(cssDaAnimacao(anim({ type: 'scaleIn', origin: 'top-left' }), false).vars).toMatchObject({ '--anim-ox': '-50%', '--anim-oy': '-50%' })
  })
  it('expandir e desdobrar escalam um eixo só', () => {
    expect(cssDaAnimacao(anim({ type: 'expand' }), false).vars).toMatchObject({ '--anim-sx': 0, '--anim-sy': 1 })
    expect(cssDaAnimacao(anim({ type: 'unfold' }), false).vars).toMatchObject({ '--anim-sx': 1, '--anim-sy': 0, '--anim-oy': '-50%' })
  })
  it('cortina: o lado para onde ela anda vai de 100% a 0 (saída: o lado de trás de 0 a 100%)', () => {
    expect(cssDaAnimacao(anim({ type: 'reveal' }), false).vars).toMatchObject({ '--clip-de': 'inset(-50% 100% -50% -50%)', '--clip-ate': 'inset(-50% 0% -50% -50%)' })
    expect(cssDaAnimacao(anim({ type: 'reveal', direction: 'up' }), false).vars['--clip-de']).toBe('inset(100% -50% -50% -50%)')
    expect(cssDaAnimacao(anim({ type: 'wipeOut' }), false).vars).toMatchObject({ '--clip-de': 'inset(-50% -50% -50% 0%)', '--clip-ate': 'inset(-50% -50% -50% 100%)' })
  })
  it('máscara: conteúdo começa uma altura inteira abaixo', () => {
    expect(cssDaAnimacao(anim({ type: 'mask' }), false).vars).toMatchObject({ '--mask-x': '0%', '--mask-y': '100%' })
  })
  it('valores fora da faixa são limitados; iguais ao padrão são removidos', () => {
    expect(parametros({ type: 'slideUp', distance: 5000 }).distance).toBe(800)
    expect(semAjustesPadrao(anim({ type: 'slideUp', distance: 40, blur: 3 }))).not.toHaveProperty('distance')
    expect(semAjustesPadrao(anim({ type: 'slideUp', distance: 40, blur: 3 })).blur).toBe(3)
  })
  it('ao trocar de preset, só ficam os ajustes que valem para o novo tipo', () => {
    expect(ajustesQueServem({ distance: 90, rotate: 30, blur: 4 }, 'slideUp')).toEqual({ distance: 90, blur: 4 })
  })
  it('entradas de texto em camada que não é texto viram fade', () => {
    expect(cssDaAnimacao(anim({ type: 'words' }), false).keyframe).toBe('anim-mov')
  })
})

describe('texto profissional', () => {
  it('divisão efetiva e keyframe das partes', () => {
    expect(divisao(anim({ type: 'words' }))).toBe('word')
    expect(divisao(anim({ type: 'words', split: 'line' }))).toBe('line')
    expect(divisao(anim({ type: 'lines' }))).toBe('line')
    expect(divisao(anim({ type: 'typewriter', split: 'word' }))).toBe('letter')
    expect(keyframeDaParte(anim({ type: 'words' }))).toBe('seg-movBlur')
    // parágrafo: o desfoque padrão sai (pesado demais por palavra); o ajustado à mão fica
    expect(keyframeDaParte(anim({ type: 'words' }), 12)).toBe('seg-movBlur')
    expect(keyframeDaParte(anim({ type: 'words' }), 13)).toBe('seg-mov')
    expect(keyframeDaParte(anim({ type: 'words', blur: 8 }), 60)).toBe('seg-movBlur')
    expect(keyframeDaParte(anim({ type: 'letters' }))).toBe('seg-mov')
    expect(keyframeDaParte(anim({ type: 'lines' }))).toBe('seg-linha')
  })
  it('ordens: início, fim, centro para fora, bordas para o centro, aleatória estável', () => {
    expect(ordemDasPartes(5, 'start')).toEqual([0, 1, 2, 3, 4])
    expect(ordemDasPartes(5, 'end')).toEqual([4, 3, 2, 1, 0])
    expect(ordemDasPartes(5, 'center')).toEqual([2, 1, 0, 1, 2])
    expect(ordemDasPartes(5, 'edges')).toEqual([0, 1, 2, 1, 0])
    const r = ordemDasPartes(8, 'random', 'Olá')
    expect([...r].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(ordemDasPartes(8, 'random', 'Olá')).toEqual(r)
    expect(passosDaOrdem(ordemDasPartes(5, 'center'))).toBe(3)
  })
  it('intervalo fixo entre partes', () => {
    expect(tempoSegmentos('words', 5, 1000, 100)).toEqual({ duracaoParte: 600, passo: 100 })
    expect(tempoSegmentos('words', 20, 1000, 100).duracaoParte).toBe(240)
  })
  it('linhas renderizadas a partir do topo de cada palavra', () => {
    expect(agruparLinhas([0, 0, 1, 40, 41, 80])).toEqual([[0, 1, 2], [3, 4], [5]])
  })
})

describe('contador', () => {
  it.each([
    ['38%', 38, 0, '19%'],
    ['R$ 2,4 mi', 2.4, 1, 'R$ 1,2 mi'],
    ['1.250 lojas', 1250, 0, '625 lojas'],
    ['3.5x', 3.5, 1, '1.8x'],
    ['+12', 12, 0, '+6'],
  ])('%s', (texto, valor, casas, metade) => {
    const n = analisarNumero(texto)!
    expect(n.valor).toBe(valor)
    expect(n.casas).toBe(casas)
    expect(formatarNumero(n, n.valor)).toBe(texto)
    expect(formatarNumero(n, n.valor / 2)).toBe(metade)
  })
  it('milhar com ponto e decimal com vírgula', () => {
    const n = analisarNumero('12.345,67 km')!
    expect(n.valor).toBeCloseTo(12345.67)
    expect(formatarNumero(n, 1000)).toBe('1.000,00 km')
  })
  it('sem número', () => expect(analisarNumero('Obrigado')).toBeNull())
  it('números em destaque viram candidatos a contador', () => {
    expect(ehNumeroDestaque('38%')).toBe(true)
    expect(ehNumeroDestaque('R$ 2,4 mi')).toBe(true)
    expect(ehNumeroDestaque('Lançamento 21.12')).toBe(false)
    expect(ehNumeroDestaque('Proposta para o cliente')).toBe(false)
  })
  it('curva cúbica', () => {
    expect(curvaBezier(0.5, [0, 0, 1, 1])).toBeCloseTo(0.5, 3)
    expect(curvaBezier(0.5, [0.16, 1, 0.3, 1])).toBeGreaterThan(0.9)
    expect(curvaBezier(0.6, [0.34, 1.56, 0.64, 1])).toBeGreaterThan(1)
  })
})

describe('galeria e gatilhos', () => {
  it('variações aplicam os próprios ajustes e são reconhecidas', () => {
    const fb = PRESETS_ENTRADA.find((p) => p.chave === 'fade-blur')!
    const a = animacaoDoPreset(fb.id, undefined, fb)
    expect(a).toMatchObject({ type: 'blurIn', blur: 12 })
    expect(presetSelecionado(fb, a, PRESETS_ENTRADA)).toBe(true)
    const base = PRESETS_ENTRADA.find((p) => p.id === 'blurIn' && !p.chave)!
    expect(presetSelecionado(base, a, PRESETS_ENTRADA)).toBe(false)
    expect(PRESETS_SAIDA.every((p) => AnimacaoSchema.safeParse(animacaoDoPreset(p.id, undefined, p)).success)).toBe(true)
  })
  it('em cadeia: começa quando a anterior termina (+ o próprio atraso), sem laço infinito', () => {
    const a = parseCamada({ id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'fadeIn', duration: 500, delay: 100 } })
    const b = parseCamada({ id: 'b', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'fadeIn', duration: 300, delay: 50, trigger: 'after', after: 'a' } })
    const c = parseCamada({ id: 'c', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'fadeIn', duration: 300, trigger: 'after', after: 'b' } })
    const m = atrasosEfetivos([a, b, c])
    expect(m.get('b')).toBe(650)
    expect(m.get('c')).toBe(950)
    const x = parseCamada({ id: 'x', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'fadeIn', trigger: 'after', after: 'y' } })
    const y = parseCamada({ id: 'y', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'fadeIn', trigger: 'after', after: 'x' } })
    expect(() => atrasosEfetivos([x, y])).not.toThrow()
  })
  it('clique em outra camada vira um "Tocar animação" nela', () => {
    const botao = parseCamada({ id: 'botao', type: 'shape', x: 0, y: 0, width: 1, height: 1 })
    const alvo = parseCamada({ id: 'alvo', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'pop', trigger: 'click', on: 'botao' } })
    expect(esperaGatilho(alvo.enterAnimation)).toBe(true)
    const m = interacoesDosGatilhos([botao, alvo])
    const it0 = m.get('botao')!.click[0]!
    expect(it0.do).toMatchObject({ action: 'animate', targetLayerId: 'alvo', animation: { type: 'pop' } })
    expect((it0.do as { animation: Animacao }).animation.trigger).toBeUndefined()
  })
})

describe('intensidade', () => {
  it('fraca/média/forte escalam o quanto o efeito se afasta do final; média = padrão', () => {
    expect(ajustesDeIntensidade('scaleIn', 2)).toEqual({ scale: 0.84 })
    expect(ajustesDeIntensidade('blurIn', 0.5)).toEqual({ blur: 12 })
    expect(ajustesDeIntensidade('rotateIn', 2)).toEqual({ scale: 0.88, rotate: -24 })
    expect(ajustesDeIntensidade('flip', 2)).toEqual({ rotate: 160 })
    expect(aplicarIntensidade('zoomIn', 'media')).toEqual({ patch: {}, remover: ['scale', 'blur'] })
    expect(intensidadeDe(anim({ type: 'zoomIn' }))).toBe('media')
    expect(intensidadeDe(anim({ type: 'zoomIn', ...ajustesDeIntensidade('zoomIn', 2) }))).toBe('forte')
    expect(intensidadeDe(anim({ type: 'zoomIn', scale: 0.33 }))).toBeNull()
  })
  it('só aparece onde muda algo (não em texto, fade, máscara nem expandir)', () => {
    expect(temIntensidade('pop')).toBe(true)
    expect(temIntensidade('zoomAway')).toBe(true)
    for (const t of ['fadeIn', 'words', 'mask', 'expand', 'reveal'] as const) expect(temIntensidade(t)).toBe(false)
    for (const t of TIPOS_ANIMACAO) for (const i of [0.5, 1, 2]) expect(AnimacaoSchema.safeParse({ type: t, ...ajustesDeIntensidade(t, i) }).success).toBe(true)
  })
})
