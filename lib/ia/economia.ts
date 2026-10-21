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
import { CUSTO_CREDITOS, DESCONTO_ANUAL, DIVISAO_TELA, MATERIAL_CREDITOS, PACOTES_AVULSOS, PLANOS, custoApresentacao, custoDesenho, custoRoteiro, type PlanoId } from '@/lib/planos'

// ---------------------------------------------------------------- premissas

/** Câmbio de planejamento (R$ por US$): comercial ≈ 5,60 + IOF de 3,5% no cartão internacional + folga de spread. */
export const CAMBIO_BRL_POR_USD = 6.0
/** Quanto de custo de IA cada crédito cobre, no máximo (1 crédito = US$ 0,002). */
export const USD_POR_CREDITO = 0.002
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
    sistema: tokens(INSTRUCOES_SISTEMA),
    /** Pedido, tipo, tom, público, marca. */
    pedido: 350,
    /** Pensamento (esforço médio) e estrutura do JSON. */
    saidaBase: 900,
    /** Título, rótulo, texto, itens e notas de cada tela. */
    saidaPorTela: 330,
  },
  design: {
    sistema: tokens(INSTRUCOES_DESIGN),
    /** Briefing + plano; o roteiro cresce com o número de telas. */
    deckBase: 300,
    deckPorTela: 130,
    sufixo: 60,
    /** Pensamento (esforço médio) + JSON da tela (campos vazios quando o roteiro já serve). */
    saida: 850,
  },
  tela: { sistema: tokens(INSTRUCOES_TELA), entrada: 700, saida: 900 },
  texto: { sistema: tokens(INSTRUCOES_TEXTO), entrada: 600, saida: 600 },
} as const

// ---------------------------------------------------------------- custo por ação (USD)

export interface CustoEtapa { etapa: string; modelo: string; uso: Required<UsoTokens>; usd: number }

/**
 * Roteiro: pior caso com o system escrito no cache (1,25×) — na prática ele é igual para todos os pedidos e
 * costuma vir do cache. O material colado entra como entrada normal.
 */
export function custoRoteiroUsd(telas: number, caracteresMaterial = 0): CustoEtapa {
  const e = ESTIMATIVA.roteiro
  const uso = { entrada: e.pedido + tokens(caracteresMaterial), saida: e.saidaBase + e.saidaPorTela * telas, cacheLeitura: 0, cacheEscrita: e.sistema }
  return { etapa: 'roteiro', modelo: MODELO_POR_ETAPA.roteiro.id, uso, usd: custoUsd(MODELO_POR_ETAPA.roteiro, uso) }
}

/**
 * Design de `telas` telas de um deck de `totalDeck` telas: a primeira chamada escreve o cache (system +
 * roteiro do deck); as demais leem. Por padrão o system também é escrito (pior caso: plataforma ociosa há
 * mais de 5 minutos); com `sistemaQuente`, ele vem do cache, que é o mesmo para todos os pedidos.
 */
export function custoDesenhoUsd(telas: number, totalDeck = telas, opcoes: { sistemaQuente?: boolean } = {}): CustoEtapa {
  const e = ESTIMATIVA.design
  const deck = e.deckBase + e.deckPorTela * totalDeck
  const prefixo = e.sistema + deck
  const escrita = telas > 0 ? (opcoes.sistemaQuente ? deck : prefixo) : 0
  const uso = {
    entrada: e.sufixo * telas,
    saida: e.saida * telas,
    cacheEscrita: escrita,
    cacheLeitura: prefixo * Math.max(0, telas - 1) + (opcoes.sistemaQuente && telas > 0 ? e.sistema : 0),
  }
  return { etapa: 'design', modelo: MODELO_POR_ETAPA.design.id, uso, usd: custoUsd(MODELO_POR_ETAPA.design, uso) }
}

export function custoRefazerTelaUsd(): CustoEtapa {
  const e = ESTIMATIVA.tela
  const uso = { entrada: e.sistema + e.entrada, saida: e.saida, cacheLeitura: 0, cacheEscrita: 0 }
  return { etapa: 'tela', modelo: MODELO_POR_ETAPA.tela.id, uso, usd: custoUsd(MODELO_POR_ETAPA.tela, uso) }
}

export function custoReescreverUsd(): CustoEtapa {
  const e = ESTIMATIVA.texto
  const uso = { entrada: e.sistema + e.entrada, saida: e.saida, cacheLeitura: 0, cacheEscrita: 0 }
  return { etapa: 'texto', modelo: MODELO_POR_ETAPA.texto.id, uso, usd: custoUsd(MODELO_POR_ETAPA.texto, uso) }
}

export const custoApresentacaoUsd = (telas: number, caracteresMaterial = 0) => custoRoteiroUsd(telas, caracteresMaterial).usd + custoDesenhoUsd(telas).usd

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

/** Tabela de custo por ação (para a documentação e o teste). */
export function tabelaAcoes(telasLista = [6, 8, 10, 12, 20]) {
  const linhas = telasLista.map((n) => {
    const r = custoRoteiroUsd(n)
    const d = custoDesenhoUsd(n)
    return { acao: `Gerar apresentação de ${n} telas`, usd: r.usd + d.usd, creditos: custoApresentacao(n), necessarios: creditosNecessarios(r.usd + d.usd), roteiro: { usd: r.usd, creditos: custoRoteiro(n) }, desenho: { usd: d.usd, creditos: custoDesenho(n) } }
  })
  const material = custoRoteiroUsd(10, 60000).usd - custoRoteiroUsd(10).usd
  return {
    apresentacoes: linhas,
    material: { acao: 'Material colado (60 mil caracteres)', usd: material, creditos: custoRoteiro(10, 60000) - custoRoteiro(10), necessarios: creditosNecessarios(material) },
    redesenhar1: { acao: 'Redesenhar 1 tela de um deck de 10', usd: custoDesenhoUsd(1, 10, { sistemaQuente: true }).usd, creditos: DIVISAO_TELA.desenho, necessarios: creditosNecessarios(custoDesenhoUsd(1, 10, { sistemaQuente: true }).usd) },
    redesenhar1Frio: { acao: 'Redesenhar 1 tela com a plataforma ociosa (cache todo frio)', usd: custoDesenhoUsd(1, 10).usd, creditos: DIVISAO_TELA.desenho, necessarios: creditosNecessarios(custoDesenhoUsd(1, 10).usd) },
    refazer: { acao: 'Refazer uma tela', usd: custoRefazerTelaUsd().usd, creditos: CUSTO_CREDITOS.refazerTela, necessarios: creditosNecessarios(custoRefazerTelaUsd().usd) },
    reescrever: { acao: 'Reescrever o texto de uma tela', usd: custoReescreverUsd().usd, creditos: CUSTO_CREDITOS.reescrever, necessarios: creditosNecessarios(custoReescreverUsd().usd) },
    planos: (Object.keys(PLANOS) as PlanoId[]).flatMap((id) => (['mensal', 'anual'] as const).map((c) => margemDoPlano(id, c))),
    pacotes: PACOTES_AVULSOS.map((p) => margemDoPacote(p.creditos, p.precoBRL)),
    premissas: { CAMBIO_BRL_POR_USD, USD_POR_CREDITO, FOLGA, DEDUCOES_RECEITA, TETO_IA_SOBRE_RECEITA, DESCONTO_ANUAL, MATERIAL_CREDITOS, CONFIG_ETAPA },
  }
}
