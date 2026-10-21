import { describe, expect, it } from 'vitest'
import { DocumentoProjetoSchema, novaCena, parseCamada, type DocumentoProjeto } from '@/lib/scene/schema'
import { adicionarEstilo, atualizarEstilo, criarEstilo, desligarEstilo, estilosDo, gravarCor, ligarEstilo, proximoNome, removerEstilo, usosDoEstilo } from './estilosCor'

function doc(): DocumentoProjeto {
  const a = parseCamada({ id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10, fill: '#111111', gradient: { type: 'linear', angle: 90, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 100 }] } })
  const b = parseCamada({ id: 'b', type: 'text', text: 'oi', x: 0, y: 0, width: 10, height: 10, color: '#222222' })
  return { schemaVersion: 2, mode: 'slides', scenes: [novaCena({ id: 's1', size: { width: 100, height: 100 }, layers: [a] }), novaCena({ id: 's2', size: { width: 100, height: 100 }, layers: [b] })] }
}

describe('estilos de cor do documento', () => {
  it('criar guarda no tema (sem tema prévio) e valida no schema', () => {
    const { documento, estilo } = criarEstilo(doc(), 'Argila', '#EEE7DB')
    expect(estilo).toMatchObject({ name: 'Argila', color: '#EEE7DB' })
    expect(estilosDo(documento)).toHaveLength(1)
    expect(() => DocumentoProjetoSchema.parse(documento)).not.toThrow()
    expect(proximoNome(estilosDo(documento))).toBe('Cor 2')
    expect(adicionarEstilo(documento, estilo)).toBe(documento)
  })

  it('ligar aplica a cor, tira o gradiente e guarda o id; editar o estilo atualiza todas as telas', () => {
    const { documento, estilo } = criarEstilo(doc(), '', '#B4532A')
    expect(estilo.name).toBe('Cor 1')
    const d = {
      ...documento,
      scenes: documento.scenes.map((s) => ({ ...s, layers: s.layers.map((l) => ligarEstilo(l, l.type === 'shape' ? 'fill' : 'color', estilo)) })),
    }
    const a = d.scenes[0]!.layers[0]!
    expect(a).toMatchObject({ fill: '#B4532A', gradient: undefined, colorStyleIds: { fill: estilo.id } })
    expect(usosDoEstilo(d, estilo.id)).toBe(2)
    const e = atualizarEstilo(d, estilo.id, { color: '#2B1D16', name: 'Carvão' })
    expect(e.scenes[0]!.layers[0]).toMatchObject({ fill: '#2B1D16' })
    expect(e.scenes[1]!.layers[0]).toMatchObject({ color: '#2B1D16' })
    expect(estilosDo(e)[0]).toMatchObject({ name: 'Carvão', color: '#2B1D16' })
    expect(() => DocumentoProjetoSchema.parse(e)).not.toThrow()
  })

  it('editar a cor direto solta o estilo; com estiloId liga', () => {
    const { estilo } = criarEstilo(doc(), 'X', '#ff0000')
    const l = ligarEstilo(doc().scenes[0]!.layers[0]!, 'fill', estilo)
    const solta = gravarCor(l, 'fill', '#00ff00')
    expect(solta).toMatchObject({ fill: '#00ff00' })
    expect(solta.colorStyleIds).toBeUndefined()
    expect(gravarCor(solta, 'fill', '#ff0000', estilo.id).colorStyleIds).toEqual({ fill: estilo.id })
    expect(desligarEstilo(solta, 'fill')).toBe(solta)
  })

  it('excluir o estilo mantém as cores e remove as ligações', () => {
    const { documento, estilo } = criarEstilo(doc(), 'X', '#ff0000')
    const d = { ...documento, scenes: documento.scenes.map((s) => ({ ...s, layers: s.layers.map((l) => (l.type === 'shape' ? ligarEstilo(l, 'fill', estilo) : l)) })) }
    const r = removerEstilo(d, estilo.id)
    expect(estilosDo(r)).toHaveLength(0)
    expect(r.scenes[0]!.layers[0]).toMatchObject({ fill: '#ff0000' })
    expect(r.scenes[0]!.layers[0]!.colorStyleIds).toBeUndefined()
    expect(r.scenes[1]).toBe(d.scenes[1]) // tela sem ligação não muda
  })
})
