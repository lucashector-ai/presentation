import { describe, expect, it } from 'vitest'
import { mensagemDecisoes, mensagemEntendimento, mensagemPlano, mensagemPronta } from './chat'

describe('mensagens do agente no Criar com IA', () => {
  it('diz o que entendeu do pedido (telas, tipo, marca, estrutura e cores)', () => {
    const t = mensagemEntendimento({ telas: 15, tipo: 'Relatório', marca: 'Nexora Soluções', publico: '', estrutura: 15, cores: ['#006BFF', '#071A3D'], temLogo: false, temKit: false, material: false })
    expect(t).toContain('15 telas (relatório) para Nexora Soluções')
    expect(t).toContain('a estrutura tela a tela (15 telas) e as cores (#006BFF, #071A3D)')
  })

  it('pede só as decisões que faltam e não inventa símbolo sem logo', () => {
    const t = mensagemDecisoes({ temLogo: false, temKit: false, cores: ['#006BFF'], marca: 'Nexora', temFontes: false })
    expect(t).toContain('o logo (não veio anexado) e as fontes')
    expect(t).not.toContain('identidade visual')
    expect(t).toContain('“Nexora” como assinatura em texto')
    expect(mensagemDecisoes({ temLogo: true, temKit: true, cores: [], marca: '', temFontes: true })).toContain('kit de marca')
  })

  it('plano e apresentação prontos', () => {
    expect(mensagemPlano({ titulo: 'X', telas: ['Capa', 'Meio', 'Fim'], nota: '' })).toContain('3 telas, abrindo com “Capa” e fechando com “Fim”')
    expect(mensagemPronta({ telas: 10, limitado: { limite: 10, pedidas: 15 } })).toContain('pedido de 15 foi condensado')
    expect(mensagemPronta({ telas: 10, limitado: null })).not.toContain('condensado')
  })
})
