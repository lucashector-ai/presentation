import { describe, expect, it } from 'vitest'
import { CUSTO_CREDITOS, DIVISAO_TELA, LEITURA_PDF_CREDITOS, PACOTES_AVULSOS, PLANOS, custoDesenho, custoLeituraPdf, custoRoteiro, podeImportarPaginasPdf, podeLerPdfComIa, type PlanoId } from '@/lib/planos'
import { INSTRUCOES_DESIGN } from './design'
import { ESTIMATIVA, TETO_IA_SOBRE_RECEITA, USD_POR_CREDITO, coberturaUsd, creditosNecessarios, custoDesenhoUsd, custoLeituraPdfUsd, custoRefazerTelaUsd, custoReescreverUsd, custoRoteiroUsd, margemDoPacote, margemDoPlano, tabelaAcoes } from './economia'
import { INSTRUCOES_PDF, LEITURA_PDF } from './pdf'
import { MODELOS, MODELO_POR_ETAPA, custoDaResposta, custoUsd, modeloPorId } from './modelos'
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
  it('roteamento por etapa: roteiro e tela no Sonnet, design no Opus, texto no Haiku', () => {
    expect(MODELO_POR_ETAPA).toMatchObject({ roteiro: MODELOS.sonnet, design: MODELOS.opus, tela: MODELOS.sonnet, texto: MODELOS.haiku })
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
    expect(custoDesenhoUsd(1, 10, { sistemaQuente: true }).usd).toBeLessThan(uma)
  })
})

describe('preço em créditos cobre o custo com folga', () => {
  it.each([3, 6, 8, 10, 12, 15, 20])('apresentação de %i telas: roteiro e design, com e sem material', (n) => {
    for (const material of [0, 2500, 20000, 60000]) {
      expect(coberturaUsd(custoRoteiro(n, material))).toBeGreaterThanOrEqual(creditosNecessarios(custoRoteiroUsd(n, material).usd) * USD_POR_CREDITO)
    }
    expect(coberturaUsd(custoDesenho(n))).toBeGreaterThanOrEqual(creditosNecessarios(custoDesenhoUsd(n).usd) * USD_POR_CREDITO)
  })
  it('redesenhar uma tela (system em cache), refazer tela e reescrever texto', () => {
    // deck de 10 telas; num deck de 20 o redesenho avulso fica ~4 créditos abaixo, coberto pela sobra da geração (docs/economia-ia.md)
    expect(DIVISAO_TELA.desenho).toBeGreaterThanOrEqual(creditosNecessarios(custoDesenhoUsd(1, 10, { sistemaQuente: true }).usd))
    expect(CUSTO_CREDITOS.refazerTela).toBeGreaterThanOrEqual(creditosNecessarios(custoRefazerTelaUsd().usd))
    expect(CUSTO_CREDITOS.reescrever).toBeGreaterThanOrEqual(creditosNecessarios(custoReescreverUsd().usd))
  })
  it('tabela da documentação: tudo cobrado ≥ necessário', () => {
    const t = tabelaAcoes()
    for (const a of t.apresentacoes) expect(a.creditos).toBeGreaterThanOrEqual(a.necessarios)
    for (const a of [t.material, t.redesenhar1, t.refazer, t.reescrever, ...t.leituraPdf]) expect(a.creditos).toBeGreaterThanOrEqual(a.necessarios)
  })
  it('leitura de PDF escaneado: cada quantidade de páginas até o máximo por pedido cobre o custo com folga', () => {
    for (let n = 1; n <= LEITURA_PDF.maxPaginas; n++) expect(custoLeituraPdf(n)).toBeGreaterThanOrEqual(creditosNecessarios(custoLeituraPdfUsd(n).usd))
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
  it('free: custo de aquisição limitado a 2 apresentações de 10 telas', () => {
    expect(PLANOS.free.creditos.quantidade).toBeLessThanOrEqual(2 * (10 + 10 * CUSTO_CREDITOS.tela) + 50)
    expect(margemDoPlano('free', 'mensal').custoIaMaxBRL).toBeLessThan(6)
  })
  it('pacotes avulsos: margem mínima e preço por crédito decrescente', () => {
    for (const p of PACOTES_AVULSOS) expect(margemDoPacote(p.creditos, p.precoBRL).pesoIa).toBeLessThanOrEqual(TETO_IA_SOBRE_RECEITA)
    const porCredito = PACOTES_AVULSOS.map((p) => p.precoBRL / p.creditos)
    expect([...porCredito].sort((a, b) => b - a)).toEqual(porCredito)
  })
})
