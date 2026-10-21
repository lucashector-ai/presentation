import { describe, expect, it } from 'vitest'
import { CamadaSchema, DocumentoProjetoSchema, InteracaoSchema, SCHEMA_VERSION } from './schema'
import { migrarDocumento, parseDocumento } from './migrar'

const cenaMinima = { id: 'scene-01', size: { width: 1920, height: 1080 }, layers: [] }

describe('schema de cena', () => {
  it('aplica defaults a um documento mínimo', () => {
    const doc = parseDocumento({ schemaVersion: SCHEMA_VERSION, mode: 'slides', scenes: [cenaMinima] })
    expect(doc.scenes[0]?.background).toBe('#FAFAF9')
    expect(doc.scenes[0]?.title).toBe('')
  })

  it('rejeita documento sem cenas', () => {
    expect(DocumentoProjetoSchema.safeParse({ schemaVersion: 2, mode: 'slides', scenes: [] }).success).toBe(false)
  })

  it('rejeita versão de schema desconhecida', () => {
    expect(DocumentoProjetoSchema.safeParse({ schemaVersion: 99, mode: 'slides', scenes: [cenaMinima] }).success).toBe(false)
  })

  it('exige ariaLabel em hotspot', () => {
    const semRotulo = CamadaSchema.safeParse({ id: 'h1', type: 'hotspot', x: 0, y: 0, width: 10, height: 10 })
    expect(semRotulo.success).toBe(false)
    const comRotulo = CamadaSchema.safeParse({ id: 'h1', type: 'hotspot', ariaLabel: 'Ver marca', x: 0, y: 0, width: 10, height: 10 })
    expect(comRotulo.success).toBe(true)
  })

  it('aceita o exemplo de contrato do blueprint (7.4)', () => {
    const cena = {
      id: 'scene-04',
      size: { width: 1920, height: 1080 },
      background: '#101820',
      layers: [
        { id: 'logo', type: 'image', assetId: 'asset-a1', x: 240, y: 180, width: 920, height: 620, z: 1 },
        {
          id: 'hotspot-1',
          type: 'hotspot',
          x: 240,
          y: 180,
          width: 920,
          height: 620,
          z: 2,
          ariaLabel: 'Ver aplicacoes da marca',
          interaction: { trigger: 'click', do: { action: 'goToScene', targetSceneId: 'scene-05' } },
        },
      ],
    }
    const r = DocumentoProjetoSchema.safeParse(migrarDocumento({ schemaVersion: 1, mode: 'slides', scenes: [cena] }))
    expect(r.success).toBe(true)
  })

  it('bloqueia javascript: e data: em openLink já no schema', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,oi', 'file:///etc/passwd', 'ftp://x']) {
      expect(InteracaoSchema.safeParse({ trigger: 'click', do: { action: 'openLink', url } }).success).toBe(false)
    }
    expect(InteracaoSchema.safeParse({ trigger: 'click', do: { action: 'openLink', url: 'https://exemplo.com' } }).success).toBe(true)
  })

  it('limita duração de animação a 100–3000 ms', () => {
    expect(InteracaoSchema.safeParse({ trigger: 'sceneEnter', do: { action: 'animate', targetLayerId: 'a', animation: { type: 'fadeIn', duration: 50 } } }).success).toBe(false)
    expect(InteracaoSchema.safeParse({ trigger: 'sceneEnter', do: { action: 'animate', targetLayerId: 'a', animation: { type: 'fadeIn', duration: 800 } } }).success).toBe(true)
  })

  it('migra v1: interaction única, shadow booleano e transição zoom', () => {
    const v1 = { schemaVersion: 1, mode: 'slides', scenes: [{ id: 'a', size: { width: 1920, height: 1080 }, transition: { type: 'zoom', duration: 300 }, layers: [
      { id: 'i', type: 'image', assetId: 'x', x: 0, y: 0, width: 10, height: 10, shadow: true, interaction: { trigger: 'click', do: { action: 'nextScene' }, transition: { type: 'zoom', duration: 300 } } },
    ] }, { id: 'b', size: { width: 1920, height: 1080 }, layers: [] }] }
    const doc = parseDocumento(v1)
    expect(doc.schemaVersion).toBe(2)
    expect(doc.scenes[0]?.transition?.type).toBe('scale')
    const l = doc.scenes[0]!.layers[0]!
    expect(l.interactions).toHaveLength(1)
    expect(l.interactions[0]?.transition?.type).toBe('scale')
    expect(l.effects?.shadow).toBeDefined()
    expect(parseDocumento(doc)).toEqual(doc) // idempotente
  })

  it('aceita camadas novas: svg, 3D, lottie e embed (só hosts permitidos)', () => {
    const base = { x: 0, y: 0, width: 10, height: 10 }
    expect(CamadaSchema.safeParse({ ...base, id: 's', type: 'svg', markup: '<svg></svg>' }).success).toBe(true)
    expect(CamadaSchema.safeParse({ ...base, id: 's', type: 'svg' }).success).toBe(false)
    expect(CamadaSchema.safeParse({ ...base, id: 'm', type: 'model3d', assetId: 'vaso' }).success).toBe(true)
    expect(CamadaSchema.safeParse({ ...base, id: 'l', type: 'lottie', data: '{}' }).success).toBe(true)
    expect(CamadaSchema.safeParse({ ...base, id: 'e', type: 'embed', url: 'https://www.youtube.com/embed/x' }).success).toBe(true)
    expect(CamadaSchema.safeParse({ ...base, id: 'e', type: 'embed', url: 'https://evil.com/x' }).success).toBe(false)
    expect(CamadaSchema.safeParse({ ...base, id: 'e', type: 'embed', url: 'http://www.youtube.com/embed/x' }).success).toBe(false)
  })

  it('modo explorar e transição morph', () => {
    const r = DocumentoProjetoSchema.safeParse({ schemaVersion: 2, mode: 'explorar', scenes: [{ ...cenaMinima, map: { x: 0, y: 0 }, transition: { type: 'morph' } }] })
    expect(r.success).toBe(true)
  })
})
