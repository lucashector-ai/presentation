import { describe, expect, it } from 'vitest'
import { ESTILOS, TEMAS, TEMPLATES, TIPOS_TELA, montarDocumento, type Roteiro } from './roteiro'
import { validarDocumento } from '@/lib/scene/validate'

const todos: Roteiro = { titulo: 'Teste', telas: TIPOS_TELA.map((tipo) => ({ tipo, titulo: `Tela ${tipo}`, texto: 'Um texto de apoio curto.', itens: tipo === 'paleta' ? ['A|#B4532A', 'B|#EEE7DB'] : tipo === 'numeros' ? ['38%|mais', '2×|conversão'] : ['um', 'dois', 'três'], notas: 'nota' })) }

describe('motor de layout do roteiro', () => {
  for (const modo of ['slides', 'story', 'explorar'] as const) {
    for (const estilo of ESTILOS) {
      it(`gera documento válido: ${modo} / ${estilo} com todos os tipos de tela`, () => {
        const doc = montarDocumento(todos, { modo, tema: TEMAS[0].id, estilo })
        expect(doc.scenes).toHaveLength(TIPOS_TELA.length)
        const v = validarDocumento(doc)
        expect(v.erros).toEqual([])
        expect(doc.scenes[0]!.notes).toBe('nota')
      })
    }
  }
  it('modo explorar cria menu de navegação na capa e posições no mapa', () => {
    const doc = montarDocumento(todos, { modo: 'explorar', tema: 'nevoa', estilo: 'minimal' })
    expect(doc.scenes.every((s) => s.map)).toBe(true)
    const menu = doc.scenes[0]!.layers.filter((l) => l.interactions.some((i) => i.do.action === 'goToScene'))
    expect(menu.length).toBeGreaterThan(2)
  })
  it('todos os templates geram documentos válidos', () => {
    for (const t of TEMPLATES) {
      const doc = montarDocumento(t.roteiro, { modo: t.modo, tema: t.tema, estilo: t.estilo })
      expect(validarDocumento(doc).ok).toBe(true)
    }
  })
})
