/**
 * Economia da IA: quanto cada ação custa em USD (estimativa de tokens por etapa × preço do modelo), quanto
 * isso vale em créditos e se os planos cobrem o pior caso (todos os créditos usados) com margem.
 * Fonte única dos números de docs/economia-ia.md (rode `node --import tsx scripts/…` ou veja o teste).
 * Puro: sem rede, sem DOM. Não é importado pela interface (os preços em créditos ficam em lib/planos.ts).
 */
import { INSTRUCOES_DESIGN } from './design'
import { CONFIG_ETAPA, MODELO_POR_ETAPA, custoUsd, type UsoTokens } from './modelos'
import { INSTRUCOES_SISTEMA } from './prompt'
import { INSTRUCOES_TELA } from './tela'
import { INSTRUCOES_TEXTO } from './texto'
import { INSTRUCOES_PDF } from './pdf'
import { INSTRUCOES_MANUAL } from '@/lib/marca/resumo'
import { CUSTO_CREDITOS, DESCONTO_ANUAL, DIVISAO_TELA, LEITURA_PDF_CREDITOS, MANUAL_MARCA_CREDITOS, MATERIAL_CREDITOS, PACOTES_AVULSOS, PLANOS, custoApresentacao, custoDesenho, custoLeituraPdf, custoResumoManual, custoRoteiro, type PlanoId } from '@/lib/planos'

// ---------------------------------------------------------------- premissas

/** Câmbio de planejamento (R$ por US$): comercial ≈ 5,60 + IOF de 3,5% no cartão internacional + folga de spread. */
export const CAMBIO_BRL_POR_USD = 6.0
/**
 * Teto de custo de IA por crédito (1 crédito = 1 tela): usado no pior caso dos planos (todos os créditos gastos
 * no custo estimado mais alto). O custo medido fica bem abaixo (CUSTO_MEDIDO_POR_TELA_USD).
 */
export const USD_POR_CREDITO = 0.0075
/**
 * Custo real medido por tela em produção (21/10/2026, apresentação de 10 telas, roteiro e design no Sonnet 5.5,
 * cache quente): roteiro US$ 0,020 + design ≈ US$ 0,025 = US$ 0,0045 por tela. Reavaliar com ai_margem_diaria.
 */
export const CUSTO_MEDIDO_POR_TELA_USD = 0.0045
/** Lucro mínimo sobre a receita líquida, no crédito mais barato, com o custo medido (regra do dono: 70–80%). */
export const LUCRO_MINIMO_MEDIDO = 0.75
/** Folga sobre a estimativa de tokens (variação de tamanho, retentativas, reserva por recusa). */
export const FOLGA = 0.25
/** Parte da receita que não fica com o Mostra: impostos (Simples ≈ 12%) e meio de pagamento (≈ 5%). */
export const DEDUCOES_RECEITA = 0.17
/** Teto do custo de IA sobre a receita líquida no pior caso (todos os créditos do mês usados). */
export const TETO_IA_SOBRE_RECEITA = 0.5
/** Caracteres por token em português (conservador: menos caracteres por token = mais tokens). */
export const CARACTERES_POR_TOKEN = 3.3

const tokens = (texto: string | number) => Math.ceil((typeof texto === 'number' ? texto : texto.length) / CARACTERES_POR_TOKEN)

/** Tokens estimados por etapa. Os systems são medidos do texto real dos prompts. */
export const ESTIMATIVA = {
  roteiro: {
    /** Medido: 4.161 tokens lidos do cache (instruções + esquema da saída estruturada). */
    sistema: Math.max(tokens(INSTRUCOES_SISTEMA), 4200),
    /** Pedido, tipo, tom, público, marca + instruções do formato de saída. Medido: 1.292. */
    pedido: 1300,
    /** Pensamento (esforço médio) e estrutura do JSON. Medido: 2.170 tokens no total para 10 telas. */
    saidaBase: 300,
    /** Título, rótulo, texto, itens e notas de cada tela. */
    saidaPorTela: 200,
  },
  design: {
    /** Medido: ≈ 5.100 tokens (catálogo + esquema da saída estruturada; o prefixo com o deck de 10 telas deu 6.717). */
    sistema: Math.max(tokens(INSTRUCOES_DESIGN), 5100),
    /** Briefing + plano; o roteiro cresce com o número de telas. */
    deckBase: 300,
    deckPorTela: 130,
    sufixo: 60,
    /** Pensamento (esforço médio) + JSON da tela (campos vazios quando o roteiro já serve). Medido: 113–236 por tela. */
    saida: 250,
  },
  tela: { sistema: tokens(INSTRUCOES_TELA), entrada: 700, saida: 900 },
  texto: { sistema: tokens(INSTRUCOES_TEXTO), entrada: 600, saida: 600 },
  /**
   * Leitura de PDF escaneado: o Claude converte cada página em imagem e extrai o texto que houver. Imagem: até
   * 4.784 tokens visuais por página (teto do nível de alta resolução, modelos 4.7+; página A4 a 2.000 px já bate
   * no teto); texto: a página que mandamos não tem camada de texto, mas contamos 1.600 (o mínimo da faixa de
   * 1.500–3.000 da documentação) como folga para o que a API extrair. Saída: a transcrição (≈ 400–900 tokens
   * numa página cheia de texto) + o pensamento em esforço baixo + o JSON por página.
   */
  pdf: { sistema: tokens(INSTRUCOES_PDF), pedido: 120, imagemPorPagina: 4784, textoPorPagina: 1600, saidaBase: 200, saidaPorPagina: 1100 },
  /**
   * Resumo do manual da marca (Haiku, esforço baixo): system + o que já foi achado sem IA + os trechos do manual
   * (até 24 mil caracteres); saída = o perfil em JSON (≈ 1.200 tokens) + pensamento curto. Sem cache (cada
   * manual é resumido uma vez).
   */
  marca: { sistema: Math.max(tokens(INSTRUCOES_MANUAL), 900), pedido: 400, saida: 2500 },
} as const

// ---------------------------------------------------------------- custo por ação (USD)

export interface CustoEtapa { etapa: string; modelo: string; uso: Required<UsoTokens>; usd: number }

/**
 * Roteiro: o system é igual para todos os pedidos e fica no cache de 1 hora, então vem do cache. Com
 * `sistemaFrio` (plataforma parada há mais de 1 hora), ele é gravado no cache de 1 hora (2×). O material
 * colado entra como entrada normal.
 */
export function custoRoteiroUsd(telas: number, caracteresMaterial = 0, opcoes: { sistemaFrio?: boolean } = {}): CustoEtapa {
  const e = ESTIMATIVA.roteiro
  const frio = !!opcoes.sistemaFrio
  const uso = { entrada: e.pedido + tokens(caracteresMaterial), saida: e.saidaBase + e.saidaPorTela * telas, cacheLeitura: frio ? 0 : e.sistema, cacheEscrita: frio ? e.sistema : 0, cacheEscrita1h: frio ? e.sistema : 0 }
  return { etapa: 'roteiro', modelo: MODELO_POR_ETAPA.roteiro.id, uso, usd: custoUsd(MODELO_POR_ETAPA.roteiro, uso) }
}

/**
 * Design de `telas` telas de um deck de `totalDeck` telas: a primeira chamada grava o roteiro do deck no
 * cache de 5 minutos; as demais leem. O system (catálogo, igual para todos os decks) fica no cache de 1 hora
 * e vem do cache; com `sistemaFrio` (plataforma parada há mais de 1 hora), ele é gravado no de 1 hora (2×).
 */
export function custoDesenhoUsd(telas: number, totalDeck = telas, opcoes: { sistemaFrio?: boolean } = {}): CustoEtapa {
  const e = ESTIMATIVA.design
  const deck = e.deckBase + e.deckPorTela * totalDeck
  const prefixo = e.sistema + deck
  const frio = !!opcoes.sistemaFrio && telas > 0
  const uso = {
    entrada: e.sufixo * telas,
    saida: e.saida * telas,
    cacheEscrita: telas > 0 ? deck + (frio ? e.sistema : 0) : 0,
    cacheEscrita1h: frio ? e.sistema : 0,
    cacheLeitura: prefixo * Math.max(0, telas - 1) + (telas > 0 && !frio ? e.sistema : 0),
  }
  return { etapa: 'design', modelo: MODELO_POR_ETAPA.design.id, uso, usd: custoUsd(MODELO_POR_ETAPA.design, uso) }
}

export function custoRefazerTelaUsd(): CustoEtapa {
  const e = ESTIMATIVA.tela
  const uso = { entrada: e.sistema + e.entrada, saida: e.saida, cacheLeitura: 0, cacheEscrita: 0, cacheEscrita1h: 0 }
  return { etapa: 'tela', modelo: MODELO_POR_ETAPA.tela.id, uso, usd: custoUsd(MODELO_POR_ETAPA.tela, uso) }
}

export function custoReescreverUsd(): CustoEtapa {
  const e = ESTIMATIVA.texto
  const uso = { entrada: e.sistema + e.entrada, saida: e.saida, cacheLeitura: 0, cacheEscrita: 0, cacheEscrita1h: 0 }
  return { etapa: 'texto', modelo: MODELO_POR_ETAPA.texto.id, uso, usd: custoUsd(MODELO_POR_ETAPA.texto, uso) }
}

/** Leitura de N páginas escaneadas pelo Claude (documento PDF na mensagem; sem cache: cada PDF é lido uma vez). */
export function custoLeituraPdfUsd(paginas: number): CustoEtapa {
  const e = ESTIMATIVA.pdf
  const uso = { entrada: e.sistema + e.pedido + (e.imagemPorPagina + e.textoPorPagina) * paginas, saida: e.saidaBase + e.saidaPorPagina * paginas, cacheLeitura: 0, cacheEscrita: 0, cacheEscrita1h: 0 }
  return { etapa: 'pdf', modelo: MODELO_POR_ETAPA.pdf.id, uso, usd: custoUsd(MODELO_POR_ETAPA.pdf, uso) }
}

/** Resumo do manual da marca pelo Claude com `caracteres` de trechos enviados. */
export function custoResumoManualUsd(caracteres: number): CustoEtapa {
  const e = ESTIMATIVA.marca
  const uso = { entrada: e.sistema + e.pedido + tokens(Math.min(caracteres, MANUAL_MARCA_CREDITOS.maxCaracteres)), saida: e.saida, cacheLeitura: 0, cacheEscrita: 0, cacheEscrita1h: 0 }
  return { etapa: 'marca', modelo: MODELO_POR_ETAPA.marca.id, uso, usd: custoUsd(MODELO_POR_ETAPA.marca, uso) }
}

export const custoApresentacaoUsd =(telas: number, caracteresMaterial = 0) => custoRoteiroUsd(telas, caracteresMaterial).usd + custoDesenhoUsd(telas).usd

/** Créditos mínimos para cobrir um custo em USD com a folga. */
export const creditosNecessarios = (usd: number) => Math.ceil((usd * (1 + FOLGA)) / USD_POR_CREDITO)

/** Créditos cobrados × valor de custo do crédito: o que a ação pode gastar de IA sem prejuízo. */
export const coberturaUsd = (creditos: number) => creditos * USD_POR_CREDITO

// ---------------------------------------------------------------- planos

export interface MargemPlano {
  plano: PlanoId
  ciclo: 'mensal' | 'anual'
  precoBRL: number
  receitaLiquidaBRL: number
  creditos: number
  /** Custo de IA se todos os créditos forem usados (pelo teto de custo do crédito). */
  custoIaMaxBRL: number
  /** Parte da receita líquida que vai para a IA no pior caso. */
  pesoIa: number
  margemBrutaMin: number
}

export function margemDoPlano(plano: PlanoId, ciclo: 'mensal' | 'anual'): MargemPlano {
  const p = PLANOS[plano]
  const preco = ciclo === 'anual' ? p.precoAnualBRL : p.precoMensalBRL
  const receitaLiquida = preco * (1 - DEDUCOES_RECEITA)
  const custoIaMax = p.creditos.quantidade * USD_POR_CREDITO * CAMBIO_BRL_POR_USD
  const pesoIa = receitaLiquida > 0 ? custoIaMax / receitaLiquida : Infinity
  return { plano, ciclo, precoBRL: preco, receitaLiquidaBRL: receitaLiquida, creditos: p.creditos.quantidade, custoIaMaxBRL: custoIaMax, pesoIa, margemBrutaMin: 1 - pesoIa }
}

/** Créditos que um preço comporta respeitando o teto de IA sobre a receita líquida. */
export const creditosQueCabem = (precoBRL: number) => Math.floor((precoBRL * (1 - DEDUCOES_RECEITA) * TETO_IA_SOBRE_RECEITA) / (USD_POR_CREDITO * CAMBIO_BRL_POR_USD))

export function margemDoPacote(creditos: number, precoBRL: number) {
  const receitaLiquida = precoBRL * (1 - DEDUCOES_RECEITA)
  const custoIaMax = creditos * USD_POR_CREDITO * CAMBIO_BRL_POR_USD
  return { creditos, precoBRL, custoIaMaxBRL: custoIaMax, pesoIa: custoIaMax / receitaLiquida, margemBrutaMin: 1 - custoIaMax / receitaLiquida }
}

/** Menor receita líquida por crédito entre planos (mensal e anual) e pacotes: o pior caso para a margem. */
export function valorLiquidoMinimoCreditoBRL(): number {
  const planos = (Object.values(PLANOS) as (typeof PLANOS)[PlanoId][]).filter((p) => p.precoMensalBRL > 0)
  const valores = [
    ...planos.flatMap((p) => [p.precoMensalBRL, p.precoAnualBRL].map((preco) => (preco * (1 - DEDUCOES_RECEITA)) / p.creditos.quantidade)),
    ...PACOTES_AVULSOS.map((p) => (p.precoBRL * (1 - DEDUCOES_RECEITA)) / p.creditos),
  ]
  return Math.min(...valores)
}

/** Lucro sobre a receita líquida de uma ação que cobra `creditos` e custa `usd` de IA, no crédito mais barato. */
export const lucroDaAcao = (creditos: number, usd: number) => (creditos > 0 ? 1 - (usd * CAMBIO_BRL_POR_USD) / (creditos * valorLiquidoMinimoCreditoBRL()) : -Infinity)

/** Tabela de custo por ação (para a documentação e o teste). */
export function tabelaAcoes(telasLista = [6, 8, 10, 12, 20]) {
  const linhas = telasLista.map((n) => {
    const r = custoRoteiroUsd(n)
    const d = custoDesenhoUsd(n)
    return { acao: `Gerar apresentação de ${n} telas`, usd: r.usd + d.usd, creditos: custoApresentacao(n), necessarios: creditosNecessarios(r.usd + d.usd), roteiro: { usd: r.usd, creditos: custoRoteiro(n) }, desenho: { usd: d.usd, creditos: custoDesenho(n) } }
  })
  const material = custoRoteiroUsd(10, 60000).usd - custoRoteiroUsd(10).usd
  // uma tela a mais num deck de 10 com o cache quente (o redesenho avulso com o cache frio está em redesenhar1Frio)
  const marginal = custoDesenhoUsd(10, 10).usd - custoDesenhoUsd(9, 10).usd
  return {
    apresentacoes: linhas,
    material: { acao: 'Material colado (60 mil caracteres)', usd: material, creditos: custoRoteiro(10, 60000) - custoRoteiro(10), necessarios: creditosNecessarios(material) },
    redesenhar1: { acao: 'Redesenhar 1 tela de um deck de 10 (roteiro do deck ainda no cache)', usd: marginal, creditos: DIVISAO_TELA.desenho, necessarios: creditosNecessarios(marginal) },
    redesenhar1Deck: { acao: 'Redesenhar 1 tela depois de 5 minutos (grava o roteiro do deck de novo)', usd: custoDesenhoUsd(1, 10).usd, creditos: DIVISAO_TELA.desenho, necessarios: creditosNecessarios(custoDesenhoUsd(1, 10).usd) },
    redesenhar1Frio: { acao: 'Redesenhar 1 tela com a plataforma parada há mais de 1 hora (cache todo frio)', usd: custoDesenhoUsd(1, 10, { sistemaFrio: true }).usd, creditos: DIVISAO_TELA.desenho, necessarios: creditosNecessarios(custoDesenhoUsd(1, 10, { sistemaFrio: true }).usd) },
    refazer: { acao: 'Refazer uma tela', usd: custoRefazerTelaUsd().usd, creditos: CUSTO_CREDITOS.refazerTela, necessarios: creditosNecessarios(custoRefazerTelaUsd().usd) },
    reescrever: { acao: 'Reescrever o texto de uma tela', usd: custoReescreverUsd().usd, creditos: CUSTO_CREDITOS.reescrever, necessarios: creditosNecessarios(custoReescreverUsd().usd) },
    resumoManual: [4000, 12000, 24000].map((n) => ({ acao: `Resumir manual da marca (${n.toLocaleString('pt-BR')} caracteres)`, usd: custoResumoManualUsd(n).usd, creditos: custoResumoManual(n), necessarios: creditosNecessarios(custoResumoManualUsd(n).usd) })),
    leituraPdf: [1, 5, 10, 20, 40].map((n) => ({ acao: `Ler ${n} ${n === 1 ? 'página escaneada' : 'páginas escaneadas'} de PDF`, usd: custoLeituraPdfUsd(n).usd, creditos: custoLeituraPdf(n), necessarios: creditosNecessarios(custoLeituraPdfUsd(n).usd) })),
    planos: (Object.keys(PLANOS) as PlanoId[]).flatMap((id) => (['mensal', 'anual'] as const).map((c) => margemDoPlano(id, c))),
    pacotes: PACOTES_AVULSOS.map((p) => margemDoPacote(p.creditos, p.precoBRL)),
    premissas: { CAMBIO_BRL_POR_USD, USD_POR_CREDITO, FOLGA, DEDUCOES_RECEITA, TETO_IA_SOBRE_RECEITA, DESCONTO_ANUAL, MATERIAL_CREDITOS, LEITURA_PDF_CREDITOS, MANUAL_MARCA_CREDITOS, CONFIG_ETAPA },
  }
}
