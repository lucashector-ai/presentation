import { describe, expect, it } from 'vitest'
import { DOC_AURORA } from '@/lib/demo/dados'
import { adaptarAnimacao, aoEntrarNaCena, aoSairHover, cenaAtual, estadoInicialRuntime, executar, irPara, proxima } from './motor'
import type { Camada } from './schema'

const doc = DOC_AURORA
const camada = (sceneId: string, layerId: string): Camada => doc.scenes.find((s) => s.id === sceneId)!.layers.find((l) => l.id === layerId)!

describe('motor de interação', () => {
  it('nextScene avança e registra histórico; não passa do fim', () => {
    let e = estadoInicialRuntime()
    e = proxima(doc, e)
    expect(e.indice).toBe(1)
    expect(e.historico).toEqual([0])
    e = irPara(doc, e, 99)
    expect(e.indice).toBe(doc.scenes.length - 1)
  })

  it('hotspot click goToScene vai para a cena certa com a transição configurada', () => {
    const e = irPara(doc, estadoInicialRuntime(), 1)
    const hs = camada('scene-02', 'hs-marca')
    const r = executar(doc, e, hs, hs.interaction!)
    expect(cenaAtual(doc, r.estado)?.id).toBe('scene-03')
    expect(r.estado.transicao?.type).toBe('zoom')
    expect(r.efeitos).toEqual([])
  })

  it('openLink gera efeito, sem mudar de cena', () => {
    const e = irPara(doc, estadoInicialRuntime(), 5)
    const l = camada('scene-06', 'link')
    const r = executar(doc, e, l, l.interaction!)
    expect(r.estado.indice).toBe(5)
    expect(r.efeitos[0]).toMatchObject({ tipo: 'abrirLink', url: 'https://example.com/briefing' })
  })

  it('hover toggleLayer mostra camada oculta e aoSairHover reverte', () => {
    const e = irPara(doc, estadoInicialRuntime(), 2)
    const hs = camada('scene-03', 'hs-logo')
    const r = executar(doc, e, hs, hs.interaction!)
    expect(r.estado.visiveis['detalhe']).toBe(true)
    const volta = aoSairHover(doc, r.estado, hs)
    expect(volta.visiveis['detalhe']).toBeUndefined()
  })

  it('trocar de cena limpa sobrescritas de visibilidade', () => {
    const e = irPara(doc, estadoInicialRuntime(), 2)
    const hs = camada('scene-03', 'hs-logo')
    const r = executar(doc, e, hs, hs.interaction!)
    expect(irPara(doc, r.estado, 0).visiveis).toEqual({})
  })

  it('conditions.once impede segundo disparo', () => {
    const story = { ...doc, mode: 'story' as const }
    const c: Camada = { ...camada('scene-01', 'cta'), interaction: { trigger: 'click', conditions: { once: true, threshold: 0.5 }, do: { action: 'animate', targetLayerId: 'cta', animation: { type: 'fadeIn', duration: 300, delay: 0, easing: 'ease' } } } }
    const r1 = executar(story, estadoInicialRuntime(), c, c.interaction!)
    expect(r1.estado.animacoes['cta']?.nonce).toBe(1)
    const r2 = executar(story, r1.estado, c, c.interaction!)
    expect(r2.estado.animacoes['cta']?.nonce).toBe(1)
  })

  it('aoEntrarNaCena executa só triggers sceneEnter', () => {
    const r = aoEntrarNaCena(doc, estadoInicialRuntime())
    expect(r.estado.indice).toBe(0)
    expect(r.efeitos).toEqual([])
  })

  it('reduced motion troca por fade curto', () => {
    expect(adaptarAnimacao({ type: 'slideUp', duration: 800, delay: 200, easing: 'easeOut' }, true)).toEqual({ type: 'fadeIn', duration: 150, delay: 0, easing: 'linear' })
    expect(adaptarAnimacao({ type: 'slideUp', duration: 800, delay: 200, easing: 'easeOut' }, false).type).toBe('slideUp')
  })
})
