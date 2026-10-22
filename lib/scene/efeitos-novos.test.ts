import { describe, expect, it } from 'vitest'
import { AnimacaoSchema, CenaSchema, LoopSchema, TransicaoSchema, parseCamada, type Animacao } from './schema'
import { quadrosDasPartes, quadrosNoCiclo } from './parametros'
import { PARTES_SIMULTANEAS_MAX, animacaoDoPreset, atrasosEfetivos, duracaoPrevia, duracaoTotal, fimDaEntrada, fimDasEntradas, linhaDoTempo, tempoSegmentos } from './animacoes'
import { keyframesCursor, quadrosCursor } from './texto-animado'
import { adaptarTransicao } from './motor'
import { TRECHO_ROLAGEM_PADRAO, planoAnimacao } from '@/components/renderer/plano'

const anim = (p: Partial<Animacao> & Pick<Animacao, 'type'>): Animacao => AnimacaoSchema.parse({ duration: 600, ...p })
const texto = (id: string, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'text', text: 'Olá mundo', x: 0, y: 0, width: 600, height: 80, fontSize: 60, ...extra })

describe('schema: campos novos são opcionais e retrocompatíveis', () => {
  it('entrada aceita repetir, rolagem e indicador do contador; loop aceita "até sair da tela"; transição aceita empurrar', () => {
    expect(() => anim({ type: 'counter', repeat: 3, progress: 'circle', progressMax: 100, progressColor: '#5965F2', progressWidth: 8 })).not.toThrow()
    expect(() => anim({ type: 'slideUp', trigger: 'scroll', scrollRange: [0, 40] })).not.toThrow()
    expect(() => LoopSchema.parse({ type: 'float', until: 'offscreen' })).not.toThrow()
    expect(TransicaoSchema.parse({ type: 'push' }).type).toBe('push')
    expect(() => anim({ type: 'slideUp', repeat: 0 })).toThrow()
    expect(() => anim({ type: 'slideUp', scrollRange: [0, 140] })).toThrow()
  })
  it('empurrar vira fade curto com movimento reduzido', () => {
    expect(adaptarTransicao({ type: 'push', duration: 700, easing: 'easeInOut' }, true)).toEqual({ type: 'fade', duration: 150, easing: 'linear' })
  })
})

describe('texto: no máximo PARTES_SIMULTANEAS_MAX partes em movimento, mesma duração total', () => {
  it('parágrafo longo: o passo cresce e a duração total não muda', () => {
    for (const [tipo, n, dur] of [['words', 22, 1400], ['words', 60, 1400], ['letters', 35, 1200], ['cascade', 150, 1200]] as const) {
      const { duracaoParte, passo } = tempoSegmentos(tipo, n, dur)
      expect(duracaoParte + passo * (n - 1)).toBeCloseTo(dur)
      // simultâneas ≈ duração da parte / passo (com o piso de 240 ms por parte em textos muito longos)
      if (duracaoParte > 240) expect(duracaoParte / passo).toBeLessThanOrEqual(PARTES_SIMULTANEAS_MAX + 1e-6)
    }
  })
  it('poucas partes e intervalo definido à mão não mudam', () => {
    expect(tempoSegmentos('words', 6, 1000)).toEqual({ duracaoParte: 550, passo: 90 })
    expect(tempoSegmentos('words', 60, 1400, 20)).toEqual({ duracaoParte: 240, passo: 20 })
  })
  it('decodificar e máquina de escrever ficam como antes (não há movimento a limitar)', () => {
    expect(tempoSegmentos('scramble', 40, 1400).duracaoParte).toBe(700)
    expect(tempoSegmentos('typewriter', 100, 2000).duracaoParte).toBe(20)
  })
})

describe('texto: keyframes das partes (Web Animations API)', () => {
  const parado = (q: Keyframe) => {
    expect(q.opacity ?? 1).toBe(1)
    if (q.transform) expect(String(q.transform)).toMatch(/^(translate\(0px, 0px\) rotate\(0deg\) scale\(1\)|translateY\(0%\))$/)
    if (q.filter) expect(q.filter).toBe('blur(0px)')
    if (q.visibility) expect(q.visibility).toBe('visible')
  }
  it('o último quadro de cada efeito é o estilo parado (soltar no fim não muda nada)', () => {
    for (const tipo of ['words', 'letters', 'lines', 'cascade', 'typewriter', 'scramble'] as const) {
      for (const conjunto of quadrosDasPartes(anim({ type: tipo }), 5)) parado(conjunto[conjunto.length - 1]!)
    }
  })
  it('desfoque vai num conjunto separado do movimento (até 12 palavras ou ajustado à mão)', () => {
    expect(quadrosDasPartes(anim({ type: 'words' }), 8)).toHaveLength(2)
    expect(quadrosDasPartes(anim({ type: 'words' }), 30)).toHaveLength(1)
    expect(quadrosDasPartes(anim({ type: 'letters', blur: 6 }), 30)).toHaveLength(2)
  })
  it('os valores vêm dos ajustes (distância em px, giro, escala, opacidade inicial)', () => {
    const [mov] = quadrosDasPartes(anim({ type: 'cascade', distance: 30, rotate: -10, scale: 0.5 }))
    expect(mov![0]).toMatchObject({ opacity: 0, transform: 'translate(0px, -30px) rotate(-10deg) scale(0.5)' })
  })
  it('repetir: cada parte anima dentro do ciclo da entrada inteira', () => {
    const q = quadrosNoCiclo([{ opacity: 0 }, { opacity: 1 }], 0.25, 0.5, 'ease-out')
    expect(q.map((k) => k.offset)).toEqual([0, 0.25, 0.75, 1])
    expect(q[1]).toMatchObject({ opacity: 0, easing: 'ease-out' })
    expect(q[3]).toMatchObject({ opacity: 1 })
  })
})

describe('repetir a entrada', () => {
  it('a duração total conta as repetições (linha do tempo, em cadeia, prévia)', () => {
    const a = texto('a', { enterAnimation: anim({ type: 'fadeIn', duration: 500, repeat: 3 }) })
    const b = texto('b', { enterAnimation: anim({ type: 'fadeIn', duration: 400, trigger: 'after', after: 'a' }) })
    expect(duracaoTotal(a.enterAnimation!)).toBe(1500)
    expect(fimDaEntrada(a)).toBe(1500)
    expect(atrasosEfetivos([a, b]).get('b')).toBe(1500)
    expect(fimDasEntradas([a, b])).toBe(1900)
    expect(duracaoPrevia([a])).toBe(1500)
    const cena = CenaSchema.parse({ id: 'c', size: { width: 1920, height: 1080 }, layers: [a, b] })
    expect(linhaDoTempo(cena).linhas.find((l) => l.id === 'a')?.fim).toBe(1500)
  })
  it('vira iteration-count na camada; o loop começa depois de todas as repetições', () => {
    const p = planoAnimacao({ entrada: anim({ type: 'slideUp', duration: 600, delay: 200, repeat: 2 }), loop: { type: 'float', duration: 3000, intensity: 1 }, reduzir: false, ehTexto: false })
    expect(p.estilo?.animationIterationCount).toBe('2, infinite')
    expect(String(p.estilo?.animationDelay).split(', ')[1]).toBe('1400ms')
  })
  it('trocar de efeito mantém o repetir e o "quando"', () => {
    const atual = anim({ type: 'fadeIn', repeat: 3, trigger: 'scroll', scrollRange: [0, 25] })
    expect(animacaoDoPreset('slideUp', atual)).toMatchObject({ type: 'slideUp', repeat: 3, trigger: 'scroll', scrollRange: [0, 25] })
  })
})

describe('entrada acompanhando a rolagem (Story)', () => {
  const rolar = anim({ type: 'slideUp', trigger: 'scroll' })
  it('no Story: linha do tempo da rolagem (view()), trecho padrão, sem atraso nem soltar no fim', () => {
    const p = planoAnimacao({ entrada: rolar, reduzir: false, ehTexto: false, rolagem: true })
    const e = p.estilo as Record<string, unknown>
    expect(e.animationTimeline).toBe('view()')
    expect(e.animationRange).toBe(`cover ${TRECHO_ROLAGEM_PADRAO[0]}% cover ${TRECHO_ROLAGEM_PADRAO[1]}%`)
    expect(e.animationDuration).toBe('auto')
    expect(p.soltavel).toBe(false)
    expect(p.classe).toContain('anim-rolagem')
  })
  it('fora do Story (ou sem suporte) toca no tempo, como "ao entrar na tela"', () => {
    const p = planoAnimacao({ entrada: rolar, reduzir: false, ehTexto: false })
    expect((p.estilo as Record<string, unknown>).animationTimeline).toBeUndefined()
    expect(p.estilo?.animationDuration).toBe('600ms')
  })
  it('texto por partes acompanha a rolagem como bloco; destaque com o próprio marcador', () => {
    const p = planoAnimacao({ entrada: anim({ type: 'words', trigger: 'scroll' }), reduzir: false, ehTexto: true, rolagem: true })
    expect(p.texto).toBeUndefined()
    expect(p.estilo?.animationName).toBe('anim-mov')
    const d = planoAnimacao({ entrada: anim({ type: 'highlight', trigger: 'scroll', scrollRange: [10, 50] }), reduzir: false, ehTexto: true, rolagem: true })
    expect(d.texto?.type).toBe('highlight')
    expect(d.rolagem).toBe('cover 10% cover 50%')
  })
  it('movimento reduzido: fade curto, sem rolagem', () => {
    const p = planoAnimacao({ entrada: rolar, reduzir: true, ehTexto: false, rolagem: true })
    expect(p.estilo?.animationDuration).toBe('150ms')
    expect((p.estilo as Record<string, unknown>).animationTimeline).toBeUndefined()
  })
})

describe('cursor da máquina de escrever (Web Animations API)', () => {
  it('os quadros são os mesmos do @keyframes (ordem, degraus, termina invisível)', () => {
    const pontos = [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 8, y: 40 }]
    const { quadros, duracao } = quadrosCursor(pontos, [0, 100, 200], 100)
    expect(duracao).toBe(keyframesCursor('c', pontos, [0, 100, 200], 100).duracao)
    expect(quadros[0]).toEqual({ offset: 0, transform: 'translate(10px, 0px)', visibility: 'visible', easing: 'step-end' })
    expect(quadros[quadros.length - 1]).toMatchObject({ offset: 1, visibility: 'hidden' })
    expect(quadros.every((q, i) => i === 0 || q.offset > quadros[i - 1]!.offset)).toBe(true)
  })
})
