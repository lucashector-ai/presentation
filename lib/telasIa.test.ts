import { describe, expect, it } from 'vitest'
import { PLANOS, apresentacoesCom, custoApresentacao } from './planos'
import { CUSTO_MEDIDO_POR_TELA_USD, LUCRO_MINIMO_MEDIDO, custoDesenhoUsd, custoRoteiroUsd, lucroDaAcao } from './ia/economia'
import { ATALHOS_TELAS, MAX_TELAS_IA, MIN_TELAS_IA, creditosPorTela, exemploApresentacoes, limitarTelas, saldoBaixo, telasCom, textoCreditos, textoTelas } from './telasIa'

// os valores vêm das funções de preço: os testes valem para qualquer tabela de créditos
describe('tamanho e saldo explicados em telas', () => {
  it('atalhos de 6 a 30 e todo plano dentro do intervalo', () => {
    expect(ATALHOS_TELAS[0]).toBe(MIN_TELAS_IA)
    expect(ATALHOS_TELAS[ATALHOS_TELAS.length - 1]).toBe(MAX_TELAS_IA)
    for (const p of Object.values(PLANOS)) {
      expect(p.limites.telasPorPrompt).toBeGreaterThanOrEqual(MIN_TELAS_IA)
      expect(p.limites.telasPorPrompt).toBeLessThanOrEqual(MAX_TELAS_IA)
    }
    expect(limitarTelas(3, 12)).toBe(6)
    expect(limitarTelas(40, 20)).toBe(20)
    expect(limitarTelas(Number.NaN, 20)).toBe(6)
  })
  it('o custo cresce o mesmo por tela até 30 telas (nada de preço fixo por "apresentação de 10")', () => {
    const passo = custoApresentacao(11) - custoApresentacao(10)
    for (const n of [6, 12, 20, 25, 29]) expect(custoApresentacao(n + 1) - custoApresentacao(n)).toBe(passo)
    expect(custoApresentacao(30)).toBeGreaterThan(custoApresentacao(20))
  })
  it.each([25, 30])('apresentação de %i telas: lucro ≥ 75%% com o custo medido no crédito mais barato', (n) => {
    expect(lucroDaAcao(custoApresentacao(n), CUSTO_MEDIDO_POR_TELA_USD * n)).toBeGreaterThanOrEqual(LUCRO_MINIMO_MEDIDO)
    expect(lucroDaAcao(custoApresentacao(n), custoRoteiroUsd(n).usd + custoDesenhoUsd(n).usd)).toBeGreaterThanOrEqual(0.55)
  })
  it('telas com o saldo e exemplo com 10 e 20 telas', () => {
    const saldo = PLANOS.free.creditos.quantidade
    expect(telasCom(saldo)).toBe(Math.floor(saldo / creditosPorTela() + 1e-9))
    expect(textoTelas(saldo)).toBe(`≈ ${telasCom(saldo)} telas com IA`)
    expect(textoTelas(0)).toBe('nenhuma tela com IA')
    const ex = exemploApresentacoes(custoApresentacao(20) * 2)
    expect(ex).toContain(`de 10 telas ou ${apresentacoesCom(custoApresentacao(20) * 2, 20)} de 20`)
    expect(exemploApresentacoes(0)).toBe('não dá para uma apresentação de 6 telas')
    expect(saldoBaixo(custoApresentacao(10) - 1)).toBe(true)
    expect(saldoBaixo(custoApresentacao(10))).toBe(false)
    expect(textoCreditos(0)).toBe('grátis')
    expect(textoCreditos(1)).toBe('1 crédito')
  })
})
