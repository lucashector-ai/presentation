import { describe, expect, it } from 'vitest'
import { CUSTO_CREDITOS, apresentacoesCom, DIVISAO_TELA, LEITURA_PDF_CREDITOS, PACOTES_AVULSOS, PLANOS, custoDesenho, custoLeituraPdf, custoRoteiro, podeImportarPaginasPdf, podeLerPdfComIa, type PlanoId } from '@/lib/planos'
import { INSTRUCOES_DESIGN } from './design'
import { CUSTO_MEDIDO_POR_TELA_USD, ESTIMATIVA, LUCRO_MINIMO_MEDIDO, TETO_IA_SOBRE_RECEITA, USD_POR_CREDITO, lucroDaAcao, valorLiquidoMinimoCreditoBRL, custoDesenhoUsd, custoLeituraPdfUsd, custoRefazerTelaUsd, custoReescreverUsd, custoRoteiroUsd, margemDoPacote, margemDoPlano, tabelaAcoes } from './economia'
import { INSTRUCOES_PDF, LEITURA_PDF } from './pdf'
import { MODELOS, MODELO_POR_ETAPA, custoDaResposta, custoUsd, modeloDoDesenho, modeloPorId } from './modelos'
import { INSTRUCOES_SISTEMA } from './prompt'

describe('custo em USD por chamada', () => {
  it('soma entrada, saída e cache pelos preços do modelo', () => {
    expect(custoUsd(MODELOS.opus, { entrada: 1_000_000, saida: 0 })).toBe(4)
    expect(custoUsd(MODELOS.opus, { entrada: 0, saida: 1_000_000 })).toBe(20)
    expect(custoUsd(MODELOS.sonnet, { entrada: 0, saida: 0, cacheLeitura: 1_000_000, cacheEscrita: 1_000_000 })).toBeCloseTo(0.2 + 2.5)
    expect(custoUsd(MODELOS.haiku, { entrada: 1_000_000, saida: 1_000_000 })).toBeCloseTo(0.6)
  })
  it('resposta com reserva no servidor cobra cada iteração pelo modelo que a rodou', () => {
    const usage = { input_tokens: 2000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    expect(custoDaResposta(usage, MODELOS.opus).usd).toBeCloseTo((2000 * 4 + 1000 * 20) / 1e6)
    const comReserva = { ...usage, iterations: [
      { type: 'message', model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      { type: 'fallback_message', model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 900, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      { type: 'compaction' },
    ] }
    expect(custoDaResposta(comReserva, MODELOS.opus).usd).toBeCloseTo((1000 * 4 + 100 * 20 + 1000 * 2 + 900 * 10) / 1e6)
    expect(modeloPorId('claude-sonnet-5-5')).toBe(MODELOS.sonnet)
    expect(modeloPorId('modelo-novo')).toBe(MODELOS.opus)
  })
  it('roteamento por etapa: roteiro, design e tela no Sonnet, texto no Haiku; Opus só no design premium', () => {
    expect(MODELO_POR_ETAPA).toMatchObject({ roteiro: MODELOS.sonnet, design: MODELOS.sonnet, tela: MODELOS.sonnet, texto: MODELOS.haiku })
    expect(modeloDoDesenho('premium')).toBe(MODELOS.opus)
    expect(modeloDoDesenho()).toBe(MODELOS.sonnet)
  })
})

describe('estimativas de tokens', () => {
  it('os systems medidos dos prompts reais ficam acima do mínimo de cache (512 tokens)', () => {
    expect(ESTIMATIVA.roteiro.sistema).toBeGreaterThan(512)
    expect(ESTIMATIVA.design.sistema).toBeGreaterThan(512)
    // estimativa conservadora: no máximo 3,3 caracteres por token
    expect(ESTIMATIVA.design.sistema).toBeGreaterThanOrEqual(Math.ceil(INSTRUCOES_DESIGN.length / 3.3))
    expect(ESTIMATIVA.roteiro.sistema).toBeGreaterThanOrEqual(Math.ceil(INSTRUCOES_SISTEMA.length / 3.3))
  })
  it('o cache do design barateia cada tela depois da primeira', () => {
    const uma = custoDesenhoUsd(1, 10).usd
    const dez = custoDesenhoUsd(10, 10).usd
    expect(dez).toBeLessThan(uma * 10)
    // com a plataforma parada há mais de 1 hora, o catálogo é gravado de novo no cache de 1 hora (2×)
    expect(uma).toBeLessThan(custoDesenhoUsd(1, 10, { sistemaFrio: true }).usd)
  })
})

describe('1 crédito = 1 tela, com lucro no crédito mais barato', () => {
  it('apresentação de N telas custa N créditos; roteiro grátis; material só acima de 20 mil caracteres', () => {
    for (const n of [6, 10, 20, 30]) expect(custoRoteiro(n) + custoDesenho(n)).toBe(n)
    expect(custoRoteiro(10, 20000)).toBe(0)
    expect(custoRoteiro(10, 20001)).toBe(1)
    expect(custoRoteiro(10, 60000)).toBe(2)
    expect(CUSTO_CREDITOS.reescrever).toBe(0)
  })
  it.each([6, 8, 10, 12, 15, 20, 25, 30])('apresentação de %i telas: lucro ≥ 75%% com o custo medido e ≥ 55%% na estimativa conservadora', (n) => {
    const creditos = custoRoteiro(n) + custoDesenho(n)
    expect(lucroDaAcao(creditos, CUSTO_MEDIDO_POR_TELA_USD * n)).toBeGreaterThanOrEqual(LUCRO_MINIMO_MEDIDO)
    expect(lucroDaAcao(creditos, custoRoteiroUsd(n).usd + custoDesenhoUsd(n).usd)).toBeGreaterThanOrEqual(0.55)
  })
  it('a estimativa conservadora fica acima do custo medido (não subestima)', () => {
    expect(custoRoteiroUsd(10).usd + custoDesenhoUsd(10).usd).toBeGreaterThan(CUSTO_MEDIDO_POR_TELA_USD * 10)
  })
  it('redesenhar uma tela com o deck no cache e refazer tela custam 1 crédito', () => {
    const marginal = custoDesenhoUsd(10, 10).usd - custoDesenhoUsd(9, 10).usd
    expect(lucroDaAcao(DIVISAO_TELA.desenho, marginal)).toBeGreaterThanOrEqual(0.7)
    // refazer tela (Sonnet) ainda sem medição: estimativa conservadora acima de 40% de lucro; medir em ai_margem_diaria
    expect(lucroDaAcao(CUSTO_CREDITOS.refazerTela, custoRefazerTelaUsd().usd)).toBeGreaterThanOrEqual(0.4)
  })
  it('leitura de PDF escaneado: cada quantidade de páginas até o máximo por pedido cobre o custo com folga', () => {
    // a página vai como imagem: a estimativa usa o teto de 4.784 tokens visuais, então 4 créditos por página dão
    // ≥ 65% de lucro mesmo nesse teto (o real tende a ficar acima de 70%; medir em ai_margem_diaria)
    for (let n = 1; n <= LEITURA_PDF.maxPaginas; n++) expect(lucroDaAcao(custoLeituraPdf(n), custoLeituraPdfUsd(n).usd)).toBeGreaterThanOrEqual(0.65)
    expect(custoLeituraPdf(0)).toBe(0)
    expect(custoLeituraPdf(10)).toBe(LEITURA_PDF_CREDITOS.base + 10 * LEITURA_PDF_CREDITOS.porPagina)
    // a página pesa o teto de imagem do nível de alta resolução + o texto: ≈ US$ 0,024 por página no Sonnet 5.5
    const porPagina = custoLeituraPdfUsd(11).usd - custoLeituraPdfUsd(10).usd
    expect(porPagina).toBeGreaterThan(0.02)
    expect(porPagina).toBeLessThan(LEITURA_PDF_CREDITOS.porPagina * USD_POR_CREDITO)
    expect(MODELO_POR_ETAPA.pdf).toBe(MODELOS.sonnet)
    expect(ESTIMATIVA.pdf.sistema).toBeGreaterThanOrEqual(Math.ceil(INSTRUCOES_PDF.length / 3.3))
  })
  it('limites de páginas de PDF por plano: a leitura pela IA cabe num pedido e o plano maior nunca tem menos', () => {
    const ordem: PlanoId[] = ['free', 'plus', 'pro', 'studio']
    for (const [i, id] of ordem.entries()) {
      const l = PLANOS[id].limites
      expect(l.paginasPdfIa).toBeLessThanOrEqual(LEITURA_PDF.maxPaginas)
      expect(l.paginasPdfImportar).toBeLessThanOrEqual(300) // máximo de telas de um documento
      if (i > 0) {
        expect(l.paginasPdfIa).toBeGreaterThanOrEqual(PLANOS[ordem[i - 1]!].limites.paginasPdfIa)
        expect(l.paginasPdfImportar).toBeGreaterThanOrEqual(PLANOS[ordem[i - 1]!].limites.paginasPdfImportar)
      }
    }
    expect(podeLerPdfComIa('free', 10).ok).toBe(true)
    expect(podeLerPdfComIa('free', 11).ok).toBe(false)
    expect(podeImportarPaginasPdf('plus', 151)).toMatchObject({ ok: false, upgradePara: 'pro' })
  })
})

describe('planos e pacotes com margem', () => {
  it.each(['plus', 'pro', 'studio'] as PlanoId[])('%s: no pior caso (todos os créditos usados) a IA custa até o teto da receita líquida', (id) => {
    for (const ciclo of ['mensal', 'anual'] as const) {
      const m = margemDoPlano(id, ciclo)
      expect(m.pesoIa).toBeLessThanOrEqual(TETO_IA_SOBRE_RECEITA)
      expect(m.margemBrutaMin).toBeGreaterThanOrEqual(1 - TETO_IA_SOBRE_RECEITA)
    }
  })
  it.each(['plus', 'pro', 'studio'] as PlanoId[])('%s: lucro ≥ 75%% com o custo medido, mesmo usando todos os créditos', (id) => {
    for (const ciclo of ['mensal', 'anual'] as const) {
      const p = PLANOS[id]
      const receita = (ciclo === 'anual' ? p.precoAnualBRL : p.precoMensalBRL) * 0.83
      expect(1 - (p.creditos.quantidade * CUSTO_MEDIDO_POR_TELA_USD * 6) / receita).toBeGreaterThanOrEqual(LUCRO_MINIMO_MEDIDO)
    }
    expect(valorLiquidoMinimoCreditoBRL()).toBeGreaterThan(0.1)
  })
  it('free: custo de aquisição limitado (50 telas, no máximo R$ 3 de IA)', () => {
    expect(apresentacoesCom(PLANOS.free.creditos.quantidade)).toBeLessThanOrEqual(5)
    expect(margemDoPlano('free', 'mensal').custoIaMaxBRL).toBeLessThan(3)
  })
  it('pacotes avulsos: margem mínima e preço por crédito decrescente', () => {
    for (const p of PACOTES_AVULSOS) expect(margemDoPacote(p.creditos, p.precoBRL).pesoIa).toBeLessThanOrEqual(TETO_IA_SOBRE_RECEITA)
    const porCredito = PACOTES_AVULSOS.map((p) => p.precoBRL / p.creditos)
    expect([...porCredito].sort((a, b) => b - a)).toEqual(porCredito)
  })
})
