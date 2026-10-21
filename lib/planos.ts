/**
 * Planos, entitlements e créditos de IA (Landing v2 do Claude Design).
 * Limites são aplicados NO BACKEND por capabilities; a UI só reflete. Valores são hipóteses para validar no beta.
 * Créditos só são consumidos por recursos de IA; editar, apresentar e compartilhar não consomem nada.
 */
export type PlanoId = 'free' | 'plus' | 'pro' | 'studio'

export interface Limites {
  projetos: number
  armazenamentoBytes: number
  tamanhoArquivoBytes: number
  bandaMensalBytes: number
  membros: number
  telasPorPrompt: number
  dominios: number
  /** Páginas de um PDF importado como apresentação (cada página vira uma tela). */
  paginasPdfImportar: number
  /** Páginas escaneadas que a IA lê de um PDF por vez ("Criar com IA"). */
  paginasPdfIa: number
}

export interface Capacidades {
  marcaDaPlataforma: boolean
  linksPrivados: boolean
  senhaNoLink: boolean
  metricas: boolean
  interacoesCompletas: boolean
  modelos3d: boolean
  imagensIaPremium: boolean
  api: boolean
  equipe: boolean
  marcaPropria: boolean
}

export interface Plano {
  id: PlanoId
  nome: string
  /** Preço por mês no plano mensal. */
  precoMensalBRL: number
  /** Preço por mês quando cobrado anualmente (≈ −20%). */
  precoAnualBRL: number
  /** "por membro" no Studio. */
  porMembro: boolean
  /** Créditos: mensais (renovam) ou únicos no cadastro (Free). */
  creditos: { quantidade: number; recorrencia: 'mensal' | 'cadastro'; compartilhados?: boolean; /** Studio: a quantidade vale por membro e soma no saldo da equipe. */ porMembro?: boolean }
  limites: Limites
  capacidades: Capacidades
}

const MB = 1024 * 1024
const GB = 1024 * MB
const ILIMITADO = Number.MAX_SAFE_INTEGER

export const DESCONTO_ANUAL = 0.2

export const PLANOS: Record<PlanoId, Plano> = {
  free: {
    id: 'free', nome: 'Free', precoMensalBRL: 0, precoAnualBRL: 0, porMembro: false,
    creditos: { quantidade: 450, recorrencia: 'cadastro' },
    limites: { projetos: 3, armazenamentoBytes: 1 * GB, tamanhoArquivoBytes: 50 * MB, bandaMensalBytes: 10 * GB, membros: 1, telasPorPrompt: 10, dominios: 0, paginasPdfImportar: 30, paginasPdfIa: 10 },
    capacidades: { marcaDaPlataforma: true, linksPrivados: true, senhaNoLink: false, metricas: false, interacoesCompletas: true, modelos3d: true, imagensIaPremium: false, api: false, equipe: false, marcaPropria: false },
  },
  plus: {
    id: 'plus', nome: 'Plus', precoMensalBRL: 29, precoAnualBRL: 24, porMembro: false,
    creditos: { quantidade: 800, recorrencia: 'mensal' },
    limites: { projetos: ILIMITADO, armazenamentoBytes: 20 * GB, tamanhoArquivoBytes: 200 * MB, bandaMensalBytes: 100 * GB, membros: 1, telasPorPrompt: 50, dominios: 0, paginasPdfImportar: 150, paginasPdfIa: 25 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: false, metricas: false, interacoesCompletas: true, modelos3d: true, imagensIaPremium: true, api: false, equipe: false, marcaPropria: false },
  },
  pro: {
    id: 'pro', nome: 'Pro', precoMensalBRL: 74, precoAnualBRL: 59, porMembro: false,
    creditos: { quantidade: 2000, recorrencia: 'mensal' },
    limites: { projetos: ILIMITADO, armazenamentoBytes: 50 * GB, tamanhoArquivoBytes: 500 * MB, bandaMensalBytes: 300 * GB, membros: 1, telasPorPrompt: 100, dominios: 10, paginasPdfImportar: 300, paginasPdfIa: 40 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: true, metricas: true, interacoesCompletas: true, modelos3d: true, imagensIaPremium: true, api: true, equipe: false, marcaPropria: true },
  },
  studio: {
    id: 'studio', nome: 'Studio', precoMensalBRL: 149, precoAnualBRL: 119, porMembro: true,
    creditos: { quantidade: 4000, recorrencia: 'mensal', compartilhados: true, porMembro: true },
    limites: { projetos: ILIMITADO, armazenamentoBytes: 50 * GB, tamanhoArquivoBytes: 1024 * MB, bandaMensalBytes: 1024 * GB, membros: 50, telasPorPrompt: 100, dominios: 100, paginasPdfImportar: 300, paginasPdfIa: 40 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: true, metricas: true, interacoesCompletas: true, modelos3d: true, imagensIaPremium: true, api: true, equipe: true, marcaPropria: true },
  },
}

/**
 * Custo em créditos de cada ação de IA (1 crédito cobre até US$ 0,002 de IA; conta completa, margem e câmbio
 * em docs/economia-ia.md, verificados por lib/ia/economia.test.ts). O Mostra gera APRESENTAÇÕES: a ação
 * principal é "Gerar uma apresentação" = roteiro (Claude Sonnet) + o desenho de cada tela (Claude Opus).
 * Ex.: 10 telas = 10 + 10 × 20 = 210 créditos (ver `custoApresentacao`), cobrados em duas etapas:
 * o roteiro (10 + 3 por tela) quando a IA escreve, e o desenho (17 por tela) quando ela desenha.
 * As demais ações acontecem dentro de uma apresentação que já existe.
 * Vídeo foi retirado da tabela: não serve ao ciclo apresentação → link → cliente e distorcia
 * a conta "créditos ≈ apresentações" (ver docs/ux/DIRECAO.md, decisão D2).
 */
export const CUSTO_CREDITOS = {
  /** Parte fixa do roteiro (estrutura, títulos, textos, notas). Cobrada a cada roteiro gerado. */
  roteiro: 10,
  /** Cada tela da apresentação: a parte dela no roteiro + o desenho (ver DIVISAO_TELA). */
  tela: 20,
  /** Refazer uma tela de uma apresentação existente (novo texto no mesmo layout; rota /api/ai/tela). */
  refazerTela: 8,
  /** Reescrever ou traduzir o texto de uma tela (rota /api/ai/texto). */
  reescrever: 1,
  /** Gerar uma imagem para uma tela (ainda indisponível; preço a confirmar com o fornecedor). */
  imagem: 20,
} as const
export type RecursoIa = keyof typeof CUSTO_CREDITOS

/** Como os créditos de cada tela se dividem entre as duas etapas. */
export const DIVISAO_TELA = { roteiro: 3, desenho: 17 } as const satisfies Record<string, number>
/** Material colado/importado longo: 1 crédito a cada 2.500 caracteres (entrada do roteiro). */
export const MATERIAL_CREDITOS = { caracteres: 2500, creditos: 1 } as const

/**
 * Leitura de PDF escaneado (ou com pouco texto extraível) pela IA (rota /api/ai/pdf, Claude lê o PDF como
 * documento: cada página vira imagem + texto). Cobrada só pelas páginas sem texto que a pessoa manda ler:
 * parte fixa + crédito por página (conta em docs/economia-ia.md, coberta pelo teste de economia).
 * PDF com texto e .docx são lidos no navegador, de graça; o material entra no roteiro como texto colado.
 */
export const LEITURA_PDF_CREDITOS = { base: 4, porPagina: 15 } as const

/** Créditos para a IA ler N páginas de PDF (escaneadas). */
export function custoLeituraPdf(paginas: number): number {
  const n = Math.max(0, Math.round(paginas))
  return n > 0 ? LEITURA_PDF_CREDITOS.base + n * LEITURA_PDF_CREDITOS.porPagina : 0
}

/** Tamanho de referência usado para traduzir créditos em apresentações ("≈ 16 apresentações de 10 telas"). */
export const TELAS_REFERENCIA = 10

/** Pacotes avulsos (não expiram). */
export const PACOTES_AVULSOS = [
  { creditos: 500, precoBRL: 19 },
  { creditos: 2000, precoBRL: 69, destaque: true },
  { creditos: 10000, precoBRL: 299 },
] as const
export type PacoteAvulso = (typeof PACOTES_AVULSOS)[number]

/** Ações de IA como a pessoa as entende, todas no contexto de uma apresentação (fonte única para landing, painel e configurações). */
export const ACOES_IA: { id: 'apresentacao' | Exclude<RecursoIa, 'roteiro' | 'tela'>; rotulo: string; detalhe: string; creditos: number; disponivel: boolean }[] = [
  { id: 'apresentacao', rotulo: 'Gerar uma apresentação', detalhe: `roteiro + design de cada tela · ${CUSTO_CREDITOS.roteiro} créditos + ${CUSTO_CREDITOS.tela} por tela`, creditos: CUSTO_CREDITOS.roteiro + TELAS_REFERENCIA * CUSTO_CREDITOS.tela, disponivel: true },
  { id: 'refazerTela', rotulo: 'Refazer uma tela', detalhe: 'novo texto para a tela, no mesmo layout', creditos: CUSTO_CREDITOS.refazerTela, disponivel: true },
  { id: 'reescrever', rotulo: 'Reescrever o texto de uma tela', detalhe: 'mais curto, formal, simples… ou traduzir', creditos: CUSTO_CREDITOS.reescrever, disponivel: true },
  { id: 'imagem', rotulo: 'Gerar imagem para uma tela', detalhe: 'foto, textura ou ilustração', creditos: CUSTO_CREDITOS.imagem, disponivel: false },
]

export function precoComCiclo(plano: Plano, ciclo: 'mensal' | 'anual'): number {
  return ciclo === 'anual' ? plano.precoAnualBRL : plano.precoMensalBRL
}

export interface UsoWorkspace {
  projetosAtivos: number
  armazenamentoBytes: number
  bandaMesBytes: number
}

export type EstadoAssinatura = 'ativa' | 'trial' | 'inadimplente' | 'cancelada'

export interface ContextoPlano {
  planoId: PlanoId
  estado: EstadoAssinatura
}

/** Assinatura expirada/cancelada NÃO apaga nada: workspace entra em modo leitura. */
export function somenteLeitura(ctx: ContextoPlano): boolean {
  return ctx.estado === 'cancelada' || ctx.estado === 'inadimplente'
}

export type Decisao = { ok: true } | { ok: false; motivo: string; upgradePara?: PlanoId }

export function proximoPlano(id: PlanoId): PlanoId | undefined {
  return ({ free: 'plus', plus: 'pro', pro: 'studio', studio: undefined } as const)[id]
}

export function podeCriarProjeto(ctx: ContextoPlano, uso: UsoWorkspace): Decisao {
  if (somenteLeitura(ctx)) return { ok: false, motivo: 'Sua assinatura está pausada. Reative para criar projetos.' }
  const plano = PLANOS[ctx.planoId]
  if (uso.projetosAtivos >= plano.limites.projetos) {
    return { ok: false, motivo: `O plano ${plano.nome} permite até ${plano.limites.projetos} projetos. Arquive um projeto ou faça upgrade.`, upgradePara: proximoPlano(ctx.planoId) }
  }
  return { ok: true }
}

export function podeEnviarArquivo(ctx: ContextoPlano, uso: UsoWorkspace, bytes: number): Decisao {
  if (somenteLeitura(ctx)) return { ok: false, motivo: 'Sua assinatura está pausada. Reative para enviar arquivos.' }
  const plano = PLANOS[ctx.planoId]
  if (bytes > plano.limites.tamanhoArquivoBytes) {
    return { ok: false, motivo: `Arquivo acima de ${formatarBytes(plano.limites.tamanhoArquivoBytes)} (limite do plano ${plano.nome}).`, upgradePara: proximoPlano(ctx.planoId) }
  }
  if (uso.armazenamentoBytes + bytes > plano.limites.armazenamentoBytes) {
    return { ok: false, motivo: `Armazenamento do plano ${plano.nome} esgotado (${formatarBytes(plano.limites.armazenamentoBytes)}).`, upgradePara: proximoPlano(ctx.planoId) }
  }
  return { ok: true }
}

/**
 * Convidar alguém para o workspace: membros atuais + convites por e-mail pendentes não passam do limite do plano.
 * (Convites por link são conferidos na hora do aceite, no banco, com o workspace travado.)
 */
export function podeConvidarMembro(ctx: ContextoPlano, ocupados: number): Decisao {
  if (somenteLeitura(ctx)) return { ok: false, motivo: 'Sua assinatura está pausada. Reative para convidar pessoas.' }
  const plano = PLANOS[ctx.planoId]
  if (ocupados >= plano.limites.membros) {
    const com = (Object.values(PLANOS) as Plano[]).find((p) => p.limites.membros > 1)
    return plano.limites.membros <= 1
      ? { ok: false, motivo: `O plano ${plano.nome} é individual. Para editar em equipe, mude para o plano ${com?.nome ?? 'Studio'}.`, upgradePara: com?.id }
      : { ok: false, motivo: `O plano ${plano.nome} permite até ${plano.limites.membros} membros (contando convites pendentes).`, upgradePara: proximoPlano(ctx.planoId) }
  }
  return { ok: true }
}

export function podeUsarSenhaNoLink(ctx: ContextoPlano): Decisao {
  if (PLANOS[ctx.planoId].capacidades.senhaNoLink) return { ok: true }
  return { ok: false, motivo: 'Links com senha estão disponíveis a partir do plano Pro.', upgradePara: 'pro' }
}

/** Créditos: decide se há saldo para um conjunto de operações de IA. */
export function custoDe(itens: Partial<Record<RecursoIa, number>>): number {
  return (Object.entries(itens) as [RecursoIa, number][]).reduce((s, [k, n]) => s + CUSTO_CREDITOS[k] * n, 0)
}

/** Créditos do roteiro (etapa 1, rota /api/ai/roteiro): parte fixa + parte de cada tela + material longo. */
export function custoRoteiro(telas: number, caracteresMaterial = 0): number {
  const n = Math.max(0, Math.round(telas))
  return CUSTO_CREDITOS.roteiro + n * DIVISAO_TELA.roteiro + Math.ceil(Math.max(0, caracteresMaterial) / MATERIAL_CREDITOS.caracteres) * MATERIAL_CREDITOS.creditos
}

/** Créditos do desenho de N telas (etapa 2, rota /api/ai/design). Só telas novas ou alteradas são redesenhadas. */
export function custoDesenho(telas: number): number {
  return Math.max(0, Math.round(telas)) * DIVISAO_TELA.desenho
}

/** Custo de "Gerar uma apresentação" com N telas (roteiro + desenho de todas as telas). */
export function custoApresentacao(telas: number, caracteresMaterial = 0): number {
  return custoRoteiro(telas, caracteresMaterial) + custoDesenho(telas)
}

/** Como a cobrança funciona, numa frase (configurações, créditos). */
export function resumoCobranca(telas: number = TELAS_REFERENCIA): string {
  return `Uma apresentação de ${telas} telas custa ${CUSTO_CREDITOS.roteiro} + ${telas} × ${CUSTO_CREDITOS.tela} = ${custoApresentacao(telas)} créditos, em duas etapas: o roteiro (${custoRoteiro(telas)}) quando a IA escreve e o design (${DIVISAO_TELA.desenho} por tela) quando ela desenha. Trocar o tema, reordenar e ajustar o texto é grátis; só telas novas ou alteradas são redesenhadas.`
}

/** Quantas apresentações de N telas cabem num saldo (arredonda para baixo). */
export function apresentacoesCom(creditos: number, telas: number = TELAS_REFERENCIA): number {
  const custo = custoApresentacao(telas)
  return custo > 0 ? Math.max(0, Math.floor(creditos / custo)) : 0
}

/** "≈ 16 apresentações" / "≈ 1 apresentação" / "menos de 1 apresentação". */
export function textoApresentacoes(creditos: number, telas: number = TELAS_REFERENCIA): string {
  const n = apresentacoesCom(creditos, telas)
  if (n === 0) return 'menos de 1 apresentação'
  return `≈ ${n.toLocaleString('pt-BR')} ${n === 1 ? 'apresentação' : 'apresentações'}`
}

export function podeGastarCreditos(saldo: number, custo: number): Decisao {
  if (custo <= saldo) return { ok: true }
  return { ok: false, motivo: `Esta apresentação custa ${custo} créditos e você tem ${saldo}. Compre um pacote avulso ou faça upgrade.` }
}

/** Limite de telas por apresentação gerada com IA no plano. */
export function podeGerarTelas(planoId: PlanoId, telas: number): Decisao {
  const plano = PLANOS[planoId]
  if (telas <= plano.limites.telasPorPrompt) return { ok: true }
  return { ok: false, motivo: `O plano ${plano.nome} gera apresentações de até ${plano.limites.telasPorPrompt} telas com IA.`, upgradePara: proximoPlano(planoId) }
}

/** Importar um PDF como apresentação: até `paginasPdfImportar` páginas no plano (as demais ficam de fora). */
export function podeImportarPaginasPdf(planoId: PlanoId, paginas: number): Decisao {
  const plano = PLANOS[planoId]
  if (paginas <= plano.limites.paginasPdfImportar) return { ok: true }
  return { ok: false, motivo: `O plano ${plano.nome} importa até ${plano.limites.paginasPdfImportar} páginas de PDF por vez.`, upgradePara: proximoPlano(planoId) }
}

/** Leitura de PDF escaneado pela IA: até `paginasPdfIa` páginas por vez no plano. */
export function podeLerPdfComIa(planoId: PlanoId, paginas: number): Decisao {
  const plano = PLANOS[planoId]
  if (paginas <= plano.limites.paginasPdfIa) return { ok: true }
  return { ok: false, motivo: `No plano ${plano.nome}, a IA lê até ${plano.limites.paginasPdfIa} páginas escaneadas por vez.`, upgradePara: proximoPlano(planoId) }
}

export function formatarBytes(b: number): string {
  if (b >= GB) return `${+(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`
  if (b >= MB) return `${Math.round(b / MB)} MB`
  return `${Math.round(b / 1024)} KB`
}

export function formatarLimite(n: number): string {
  return n >= ILIMITADO ? 'Ilimitados' : String(n)
}

export function percentualUso(usado: number, limite: number): number {
  if (limite <= 0) return 100
  return Math.min(100, Math.round((usado / limite) * 100))
}
