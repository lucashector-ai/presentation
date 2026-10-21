import { describe, expect, it } from 'vitest'
import { DOC_ATLAS } from '@/lib/demo/dados'
import { parseDocumento } from './migrar'
import { adaptarAnimacao, adaptarTransicao, aoEntrarNaCena, aoSairHover, cenaAtual, estadoInicialRuntime, executar, executarTodas, irPara, proxima } from './motor'
import type { Camada } from './schema'

const doc = DOC_ATLAS
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

  it('clique no botão vai para Aplicações com transição morph', () => {
    const cta = camada('capa', 'cta')
    const r = executar(doc, estadoInicialRuntime(), cta, cta.interactions[0]!)
    expect(cenaAtual(doc, r.estado)?.id).toBe('aplicacoes')
    expect(r.estado.transicao?.type).toBe('morph')
    expect(r.efeitos).toEqual([])
  })

  it('openLink gera efeito, sem mudar de tela', () => {
    const d = parseDocumento({ schemaVersion: 2, mode: 'slides', scenes: [{ id: 'a', size: { width: 100, height: 100 }, layers: [{ id: 'l', type: 'text', text: 'site', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'click', do: { action: 'openLink', url: 'https://example.com' } }] }] }] })
    const l = d.scenes[0]!.layers[0]!
    const r = executar(d, estadoInicialRuntime(), l, l.interactions[0]!)
    expect(r.estado.indice).toBe(0)
    expect(r.efeitos[0]).toMatchObject({ tipo: 'abrirLink', url: 'https://example.com' })
  })

  it('hover revela a legenda e aoSairHover reverte', () => {
    const foto = camada('capa', 'foto')
    const r = executarTodas(doc, estadoInicialRuntime(), foto, 'hover')
    expect(r.estado.visiveis['legenda']).toBe(true)
    expect(aoSairHover(doc, r.estado, foto).visiveis['legenda']).toBeUndefined()
  })

  it('várias interações no mesmo clique rodam em sequência', () => {
    const d = parseDocumento({ schemaVersion: 2, mode: 'slides', scenes: [{ id: 'a', size: { width: 100, height: 100 }, layers: [
      { id: 'alvo', type: 'text', text: 'x', x: 0, y: 0, width: 10, height: 10, hidden: true },
      { id: 'b', type: 'text', text: 'botão', x: 0, y: 0, width: 10, height: 10, interactions: [
        { trigger: 'click', do: { action: 'toggleLayer', targetLayerId: 'alvo', mode: 'show' } },
        { trigger: 'click', do: { action: 'animate', targetLayerId: 'alvo', animation: { type: 'scaleIn' } } },
      ] },
    ] }] })
    const r = executarTodas(d, estadoInicialRuntime(), d.scenes[0]!.layers[1]!, 'click')
    expect(r.estado.visiveis['alvo']).toBe(true)
    expect(r.estado.animacoes['alvo']?.nonce).toBe(1)
  })

  it('trocar de tela limpa sobrescritas de visibilidade', () => {
    const r = executarTodas(doc, estadoInicialRuntime(), camada('capa', 'foto'), 'hover')
    expect(irPara(doc, r.estado, 2).visiveis).toEqual({})
  })

  it('conditions.once impede segundo disparo', () => {
    const c: Camada = { ...camada('capa', 'cta'), interactions: [{ trigger: 'click', conditions: { once: true, threshold: 0.5 }, do: { action: 'animate', targetLayerId: 'cta', animation: { type: 'fadeIn', duration: 300, delay: 0, easing: 'ease' } } }] }
    const r1 = executar(doc, estadoInicialRuntime(), c, c.interactions[0]!)
    expect(r1.estado.animacoes['cta']?.nonce).toBe(1)
    const r2 = executar(doc, r1.estado, c, c.interactions[0]!)
    expect(r2.estado.animacoes['cta']?.nonce).toBe(1)
  })

  it('aoEntrarNaCena executa só triggers sceneEnter', () => {
    const r = aoEntrarNaCena(doc, estadoInicialRuntime())
    expect(r.estado.indice).toBe(0)
    expect(r.efeitos).toEqual([])
  })

  it('reduced motion troca animações e transições por fade curto (inclusive morph)', () => {
    expect(adaptarAnimacao({ type: 'slideUp', duration: 800, delay: 200, easing: 'easeOut' }, true)).toEqual({ type: 'fadeIn', duration: 150, delay: 0, easing: 'linear' })
    expect(adaptarAnimacao({ type: 'slideUp', duration: 800, delay: 200, easing: 'easeOut' }, false).type).toBe('slideUp')
    expect(adaptarTransicao({ type: 'morph', duration: 800, easing: 'easeInOut' }, true)?.type).toBe('fade')
  })
})
