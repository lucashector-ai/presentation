import { describe, expect, it } from 'vitest'
import { gerarRoteiroLocal, telasDoTexto, tipoDoPrompt, tituloDoPrompt } from './local'
import { normalizarRoteiro, PedidoRoteiroSchema } from './pedido'
import { mensagemUsuario } from './prompt'
import { montarDocumento, RoteiroSchema } from './roteiro'
import { validarDocumento } from '@/lib/scene/validate'

const pedido = (p: Record<string, unknown>) => PedidoRoteiroSchema.parse(p)

describe('pedido', () => {
  it('exige prompt ou texto', () => {
    expect(PedidoRoteiroSchema.safeParse({ prompt: '' }).success).toBe(false)
    expect(PedidoRoteiroSchema.safeParse({ prompt: 'Pitch da Aurora' }).success).toBe(true)
    expect(PedidoRoteiroSchema.safeParse({ conteudo: 'Um texto longo o suficiente para virar telas.' }).success).toBe(true)
  })
  it('normaliza saída do modelo fora dos limites', () => {
    const r = normalizarRoteiro({ titulo: ' ', telas: [{ tipo: 'lista', titulo: 'x'.repeat(300), texto: '', itens: ['a', 'b', 'c', 'd', 'e', 'f', 'g', ''], notas: '' }] })
    expect(RoteiroSchema.safeParse(r).success).toBe(true)
    expect(r.telas[0]!.titulo.length).toBeLessThanOrEqual(120)
    expect(r.telas[0]!.itens).toHaveLength(6)
    expect(r.titulo).not.toBe('')
  })
  it('mensagem inclui material delimitado', () => {
    const m = mensagemUsuario(pedido({ prompt: 'Proposta', conteudo: 'Texto do cliente com detalhes.', telas: 6 }))
    expect(m).toContain('exatamente 6 telas')
    expect(m).toContain('<material>')
  })
})

describe('gerador local', () => {
  it('extrai título do pedido', () => {
    expect(tituloDoPrompt('Crie uma apresentação de identidade visual para a Café Aurora. Tom quente.')).toBe('Identidade visual para a Café Aurora')
    expect(tituloDoPrompt('')).toBe('Nova apresentação')
  })
  it('reconhece o tipo', () => {
    expect(tipoDoPrompt('pitch para investidores')).toBe('pitch')
    expect(tipoDoPrompt('nova marca da padaria')).toBe('identidade')
    expect(tipoDoPrompt('relatório trimestral')).toBe('geral')
  })
  it.each([3, 6, 8, 12, 20])('gera exatamente %i telas, capa primeiro e encerramento por último', (n) => {
    const r = gerarRoteiroLocal(pedido({ prompt: 'Pitch da Aurora para investidores', telas: n }))
    expect(r.telas).toHaveLength(n)
    expect(r.telas[0]!.tipo).toBe('capa')
    expect(r.telas.at(-1)!.tipo).toBe('encerramento')
  })
  it('organiza texto colado em telas', () => {
    const texto = `# Linha 4\n\nO novo sistema de ônibus da cidade.\n\n## Resultados\n- 38% mais passageiros\n- 12 min de espera\n\n## O que muda\n- Frota elétrica\n- Faixas exclusivas\n- Pagamento por aproximação\n\n“Andar de ônibus virou rotina” — Ana, passageira`
    const telas = telasDoTexto(texto)
    expect(telas.map((t) => t.tipo)).toEqual(['secao', 'conceito', 'numeros', 'lista', 'citacao'])
    expect(telas[2]!.itens).toEqual(['38%|mais passageiros', '12 min|de espera'])
    const r = gerarRoteiroLocal(pedido({ origem: 'texto', conteudo: texto, telas: 6 }))
    expect(r.telas).toHaveLength(6)
  })
  it('vira documento válido em todos os formatos', () => {
    const r = gerarRoteiroLocal(pedido({ prompt: 'Identidade visual da Café Aurora', telas: 10 }))
    for (const modo of ['slides', 'story', 'explorar'] as const) {
      const doc = montarDocumento(r, { modo, tema: 'argila', estilo: 'editorial' })
      expect(validarDocumento(doc).erros).toEqual([])
    }
  })
})

describe('título', () => {
  it('corta na primeira vírgula', () => {
    expect(tituloDoPrompt('Pitch da Aurora, startup de energia solar, para investidores')).toBe('Pitch da Aurora')
  })
})

describe('capa', () => {
  it('usa o resto do pedido como linha de apoio', () => {
    const r = gerarRoteiroLocal(PedidoRoteiroSchema.parse({ prompt: 'Pitch da Aurora, startup de energia solar, para investidores', telas: 6 }))
    expect(r.telas[0]).toMatchObject({ titulo: 'Pitch da Aurora', texto: 'Startup de energia solar, para investidores' })
  })
})
