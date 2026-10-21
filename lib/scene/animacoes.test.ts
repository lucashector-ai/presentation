import { describe, expect, it } from 'vitest'
import { DOC_ATLAS } from '@/lib/demo/dados'
import { CamadaSchema, novaCena, parseCamada, type Camada } from './schema'
import { parseDocumento } from './migrar'
import {
  ESTILOS_TELA,
  EXPO,
  PRESETS_ENTRADA,
  animarTelaInteira,
  curvaCss,
  curvaDe,
  dividirTexto,
  duracaoPorVelocidade,
  duracaoPrevia,
  escalonar,
  linhaDoTempo,
  nomeAnimacao,
  ordenarParaSequencia,
  removerAnimacoes,
  tempoSaida,
  tempoSegmentos,
  velocidadeDe,
} from './animacoes'

const forma = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'shape', x, y, width: 100, height: 100, ...extra })
const texto = (id: string, x: number, y: number, fontSize: number, text = 'Olá mundo') => parseCamada({ id, type: 'text', text, x, y, width: 600, height: fontSize * 1.2, fontSize })

describe('schema: campos novos de animação', () => {
  it('documentos antigos (sem loop/saída/presets novos) continuam válidos', () => {
    expect(() => parseDocumento(DOC_ATLAS)).not.toThrow()
  })
  it('aceita presets novos, loop, saída e curva personalizada', () => {
    const r = CamadaSchema.safeParse({
      id: 't', type: 'text', text: 'Oi', x: 0, y: 0, width: 10, height: 10,
      enterAnimation: { type: 'words', duration: 900, easing: 'easeOut', bezier: [0.2, 1.4, 0.4, 1] },
      loopAnimation: { type: 'float' },
      exitAnimation: { type: 'slideOutUp', duration: 400 },
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.loopAnimation).toEqual({ type: 'float', duration: 3000, intensity: 1 })
      expect(r.data.exitAnimation?.delay).toBe(0)
    }
  })
  it('recusa loop desconhecido e bezier fora do intervalo', () => {
    expect(CamadaSchema.safeParse({ id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1, loopAnimation: { type: 'dançar' } }).success).toBe(false)
    expect(CamadaSchema.safeParse({ id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1, enterAnimation: { type: 'fadeIn', bezier: [2, 0, 1, 1] } }).success).toBe(false)
  })
})

describe('catálogo', () => {
  it('todo preset tem nome em português e duração no intervalo do schema', () => {
    for (const p of PRESETS_ENTRADA) {
      expect(nomeAnimacao(p.id)).not.toBe(p.id)
      expect(p.duracao).toBeGreaterThanOrEqual(100)
      expect(p.duracao).toBeLessThanOrEqual(3000)
    }
  })
  it('velocidade ↔ duração', () => {
    expect(duracaoPorVelocidade('pop', 'normal')).toBe(600)
    expect(duracaoPorVelocidade('pop', 'rapida')).toBe(350)
    expect(duracaoPorVelocidade('pop', 'lenta')).toBe(950)
    expect(velocidadeDe('pop', 950)).toBe('lenta')
    expect(velocidadeDe('pop', 777)).toBeNull()
  })
  it('curvas nomeadas e personalizada', () => {
    expect(curvaDe({ easing: 'spring' })).toBe('elastica')
    expect(curvaDe({ easing: 'easeInOut' })).toBe('equilibrada')
    expect(curvaDe({ easing: 'ease' })).toBe('personalizada')
    expect(curvaDe({ easing: 'easeOut', bezier: [0.34, 1.35, 0.6, 1] })).toBe('quique')
    expect(curvaDe({ easing: 'easeOut', bezier: [0, 0, 1, 1] })).toBe('personalizada')
    expect(curvaCss({ easing: 'easeOut', bezier: [0.1, 1.2, 0.3, 1] })).toBe('cubic-bezier(0.1, 1.2, 0.3, 1)')
    expect(curvaCss({ easing: 'easeOut', bezier: EXPO })).toBe('cubic-bezier(0.16, 1, 0.3, 1)')
    expect(curvaDe({ easing: 'easeOut', bezier: [0.16, 1, 0.3, 1] })).toBe('rapida')
  })
})

describe('texto dividido', () => {
  it('divide por palavra preservando espaços e quebras', () => {
    const { palavras, total } = dividirTexto('Forma,  fogo\ne tempo', 'palavra')
    expect(total).toBe(4)
    expect(palavras.map((p) => p.partes.map((s) => s.texto).join('') + p.separador).join('')).toBe('Forma,  fogo\ne tempo')
  })
  it('divide por letra com índices contínuos (sem contar espaços)', () => {
    const { palavras, total } = dividirTexto('ab cd', 'letra')
    expect(total).toBe(4)
    expect(palavras[1]!.partes.map((p) => p.indice)).toEqual([2, 3])
  })
  it('letra por letra divide por grafema (acento combinado e emoji ficam inteiros)', () => {
    const { palavras, total } = dividirTexto('São 👍🏽', 'letra')
    expect(total).toBe(4)
    expect(palavras[0]!.partes.map((p) => p.texto)).toEqual(['S', 'ã', 'o'])
    expect(palavras[1]!.partes.map((p) => p.texto)).toEqual(['👍🏽'])
  })
  it('a última parte termina exatamente na duração total', () => {
    for (const tipo of ['words', 'letters', 'typewriter'] as const) {
      const { duracaoParte, passo } = tempoSegmentos(tipo, 12, 1000)
      expect(passo * 11 + duracaoParte).toBeCloseTo(1000)
    }
    expect(tempoSegmentos('words', 1, 800)).toEqual({ duracaoParte: 800, passo: 0 })
  })
})

describe('animar tela inteira', () => {
  const cena = novaCena({
    id: 'c', size: { width: 1920, height: 1080 },
    layers: [
      parseCamada({ id: 'fundo', type: 'shape', x: 0, y: 0, width: 1920, height: 1080, z: 0 }),
      texto('titulo', 100, 100, 160, 'Atlas'),
      texto('sub', 100, 400, 40),
      forma('a', 1200, 600, { groupId: 'g' }),
      forma('b', 1300, 610, { groupId: 'g' }),
      parseCamada({ id: 'h', type: 'hotspot', ariaLabel: 'x', x: 0, y: 0, width: 10, height: 10 }),
      forma('oculta', 0, 0, { hidden: true }),
    ],
  })

  it('fundo primeiro, depois de cima para baixo com intervalo do estilo; grupo entra junto', () => {
    const out = animarTelaInteira(cena, 'editorial', 'topo')
    const a = (id: string) => out.find((c) => c.id === id)!.enterAnimation
    const passo = ESTILOS_TELA.find((e) => e.id === 'editorial')!.intervalo
    expect(a('fundo')).toMatchObject({ type: 'fadeIn', delay: 0 })
    expect(a('titulo')).toMatchObject({ type: 'words', delay: 200 })
    // texto de apoio curto (uma linha) sobe de trás da própria borda (máscara); com várias linhas, linha por linha
    expect(a('sub')).toMatchObject({ type: 'mask', delay: 200 + passo })
    expect(a('a')!.delay).toBe(200 + 2 * passo)
    expect(a('b')!.delay).toBe(a('a')!.delay)
    expect(a('a')!.type).toBe('reveal')
    expect(a('h')).toBeUndefined()
    expect(a('oculta')).toBeUndefined()
  })

  it('ordem de leitura (padrão): fundo na hora, título, texto e linhas, depois imagens; cartão entra com o seu texto', () => {
    const c = novaCena({
      id: 'l', size: { width: 1920, height: 1080 },
      layers: [
        parseCamada({ id: 'fundo', type: 'shape', x: 0, y: 0, width: 1920, height: 1080, z: 0 }),
        texto('rotulo', 100, 60, 22, '01 — Rótulo'),
        forma('deco', 1500, 40, { z: 1 }),
        texto('titulo', 100, 300, 140, 'Título'),
        parseCamada({ id: 'linha', type: 'shape', shape: 'line', x: 100, y: 520, width: 800, height: 2, z: 2 }),
        parseCamada({ id: 'cartao', type: 'shape', x: 1000, y: 600, width: 700, height: 300, z: 3 }),
        { ...texto('dentro', 1040, 640, 32, 'No cartão'), z: 4 } as Camada,
        texto('apoio', 100, 560, 34, 'Texto de apoio'),
      ],
    })
    const out = animarTelaInteira(c, 'suave')
    const d = (id: string) => out.find((x) => x.id === id)!.enterAnimation!.delay
    expect(d('fundo')).toBe(0)
    const ordem = ['titulo', 'rotulo', 'linha', 'apoio', 'dentro', 'deco']
    for (let i = 1; i < ordem.length; i++) expect(d(ordem[i]!)).toBeGreaterThan(d(ordem[i - 1]!))
    expect(d('cartao')).toBe(d('dentro'))
    // linhas finas ganham a receita própria (não a de forma)
    expect(animarTelaInteira(c, 'dinamico').find((x) => x.id === 'linha')!.enterAnimation!.type).toBe('reveal')
  })

  it('ordem da esquerda para a direita e pela ordem das camadas', () => {
    const itens = [{ id: 'x', x: 500, y: 0, z: 1 }, { id: 'y', x: 0, y: 500, z: 2 }, { id: 'z', x: 0, y: 0, z: 0 }]
    expect(ordenarParaSequencia(itens, 'topo').map((i) => i.id)).toEqual(['z', 'x', 'y'])
    expect(ordenarParaSequencia(itens, 'esquerda').map((i) => i.id)).toEqual(['z', 'y', 'x'])
    expect(ordenarParaSequencia(itens, 'camadas').map((i) => i.id)).toEqual(['z', 'x', 'y'])
  })

  it('entradas de texto nunca vão para camadas que não são texto e o resultado valida', () => {
    for (const e of ESTILOS_TELA) {
      const out = animarTelaInteira(cena, e.id, 'topo')
      for (const c of out) {
        expect(CamadaSchema.safeParse(c).success).toBe(true)
        if (c.type !== 'text') expect(['typewriter', 'words', 'letters']).not.toContain(c.enterAnimation?.type)
      }
    }
  })

  it('remover animações limpa entrada, loop e saída', () => {
    const com: Camada[] = [forma('a', 0, 0, { enterAnimation: { type: 'pop' }, loopAnimation: { type: 'pulse' }, exitAnimation: { type: 'fadeOut' } })]
    const out = removerAnimacoes(com)
    expect(out[0]!.enterAnimation).toBeUndefined()
    expect(out[0]!.loopAnimation).toBeUndefined()
    expect(out[0]!.exitAnimation).toBeUndefined()
  })
})

describe('escalonar, linha do tempo e tempos', () => {
  it('escalonar na ordem visual', () => {
    const m = escalonar([forma('baixo', 0, 500), forma('cima', 0, 0)], 100, 80)
    expect(m.get('cima')).toBe(100)
    expect(m.get('baixo')).toBe(180)
  })
  it('linha do tempo usa delay → delay + duração e arredonda a escala', () => {
    const cena = novaCena({ id: 'c', size: { width: 100, height: 100 }, layers: [forma('a', 0, 0, { z: 1, enterAnimation: { type: 'fadeIn', delay: 300, duration: 1000 } }), forma('b', 0, 0, { z: 2 })] })
    const { linhas, total } = linhaDoTempo(cena)
    expect(linhas.map((l) => l.id)).toEqual(['b', 'a'])
    expect(linhas[1]).toMatchObject({ inicio: 300, fim: 1300, tipo: 'fadeIn' })
    expect(total).toBe(2000)
  })
  it('duração da prévia e tempo de saída', () => {
    const cs = [forma('a', 0, 0, { enterAnimation: { type: 'fadeIn', delay: 500, duration: 600 } }), forma('b', 0, 0, { exitAnimation: { type: 'fadeOut', duration: 400, delay: 100 } })]
    expect(duracaoPrevia(cs)).toBe(1100)
    expect(duracaoPrevia(cs, true)).toBe(600)
    expect(tempoSaida(novaCena({ id: 'c', size: { width: 100, height: 100 }, layers: cs }))).toBe(500)
  })
})
