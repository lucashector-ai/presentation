import { describe, expect, it } from 'vitest'
import { validarDocumento } from './validate'

function doc(mode: 'slides' | 'story', scenes: unknown[]) {
  return { schemaVersion: 1, mode, scenes }
}
const tam = { width: 1920, height: 1080 }

describe('validação semântica', () => {
  it('aceita documento válido com hotspot navegando para cena existente', () => {
    const r = validarDocumento(
      doc('slides', [
        { id: 'a', size: tam, layers: [{ id: 'h', type: 'hotspot', ariaLabel: 'Ir', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'click', do: { action: 'goToScene', targetSceneId: 'b' } }] }] },
        { id: 'b', size: tam, layers: [] },
      ])
    )
    expect(r.ok).toBe(true)
    expect(r.erros).toEqual([])
  })

  it('erro quando cena alvo não existe', () => {
    const r = validarDocumento(
      doc('slides', [{ id: 'a', size: tam, layers: [{ id: 'h', type: 'hotspot', ariaLabel: 'Ir', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'click', do: { action: 'goToScene', targetSceneId: 'zzz' } }] }] }])
    )
    expect(r.ok).toBe(false)
    expect(r.erros.map((e) => e.codigo)).toContain('cena_alvo_inexistente')
  })

  it('erro quando trigger e ação são incompatíveis (sceneEnter + goToScene evita ciclos)', () => {
    const r = validarDocumento(
      doc('slides', [
        { id: 'a', size: tam, layers: [{ id: 't', type: 'text', text: 'x', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'sceneEnter', do: { action: 'goToScene', targetSceneId: 'b' } }] }] },
        { id: 'b', size: tam, layers: [] },
      ])
    )
    expect(r.erros.map((e) => e.codigo)).toContain('acao_incompativel')
  })

  it('scrollThreshold só no modo story', () => {
    const camada = { id: 't', type: 'text', text: 'x', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'scrollThreshold', do: { action: 'animate', targetLayerId: 't', animation: { type: 'fadeIn' } } }] }
    expect(validarDocumento(doc('slides', [{ id: 'a', size: tam, layers: [camada] }])).erros.map((e) => e.codigo)).toContain('scroll_fora_do_story')
    expect(validarDocumento(doc('story', [{ id: 'a', size: tam, layers: [camada] }])).ok).toBe(true)
  })

  it('erro quando toggleVideo aponta para camada que não é vídeo', () => {
    const r = validarDocumento(
      doc('slides', [{ id: 'a', size: tam, layers: [
        { id: 'img', type: 'image', assetId: 'x', x: 0, y: 0, width: 10, height: 10 },
        { id: 'h', type: 'hotspot', ariaLabel: 'Play', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'click', do: { action: 'toggleVideo', targetLayerId: 'img' } }] },
      ] }])
    )
    expect(r.erros.map((e) => e.codigo)).toContain('alvo_nao_e_video')
  })

  it('erro quando asset referenciado não pertence ao workspace', () => {
    const r = validarDocumento(doc('slides', [{ id: 'a', size: tam, layers: [{ id: 'img', type: 'image', assetId: 'alheio', x: 0, y: 0, width: 10, height: 10 }] }]), { assetsExistentes: new Set(['meu']) })
    expect(r.erros.map((e) => e.codigo)).toContain('asset_inexistente')
  })

  it('aviso de acessibilidade para forma clicável sem rótulo', () => {
    const r = validarDocumento(
      doc('slides', [
        { id: 'a', size: tam, layers: [{ id: 's', type: 'shape', x: 0, y: 0, width: 10, height: 10, interactions: [{ trigger: 'click', do: { action: 'nextScene' } }] }] },
        { id: 'b', size: tam, layers: [] },
      ])
    )
    expect(r.ok).toBe(true)
    expect(r.avisos.map((a) => a.codigo)).toContain('sem_rotulo')
  })

  it('erro de schema vira lista de problemas legível', () => {
    const r = validarDocumento({ schemaVersion: 1, mode: 'slides', scenes: [{ id: 'a', size: tam, layers: [{ id: 'x', type: 'text' }] }] })
    expect(r.ok).toBe(false)
    expect(r.erros[0]?.codigo).toBe('schema')
  })
})
