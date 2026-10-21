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
  creditos: { quantidade: number; recorrencia: 'mensal' | 'cadastro'; compartilhados?: boolean }
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
    creditos: { quantidade: 400, recorrencia: 'cadastro' },
    limites: { projetos: 3, armazenamentoBytes: 1 * GB, tamanhoArquivoBytes: 50 * MB, bandaMensalBytes: 10 * GB, membros: 1, telasPorPrompt: 10, dominios: 0 },
    capacidades: { marcaDaPlataforma: true, linksPrivados: true, senhaNoLink: false, metricas: false, interacoesCompletas: true, modelos3d: true, imagensIaPremium: false, api: false, equipe: false, marcaPropria: false },
  },
  plus: {
    id: 'plus', nome: 'Plus', precoMensalBRL: 29, precoAnualBRL: 24, porMembro: false,
    creditos: { quantidade: 1000, recorrencia: 'mensal' },
    limites: { projetos: ILIMITADO, armazenamentoBytes: 20 * GB, tamanhoArquivoBytes: 200 * MB, bandaMensalBytes: 100 * GB, membros: 1, telasPorPrompt: 50, dominios: 0 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: false, metricas: false, interacoesCompletas: true, modelos3d: true, imagensIaPremium: true, api: false, equipe: false, marcaPropria: false },
  },
  pro: {
    id: 'pro', nome: 'Pro', precoMensalBRL: 74, precoAnualBRL: 59, porMembro: false,
    creditos: { quantidade: 4000, recorrencia: 'mensal' },
    limites: { projetos: ILIMITADO, armazenamentoBytes: 50 * GB, tamanhoArquivoBytes: 500 * MB, bandaMensalBytes: 300 * GB, membros: 1, telasPorPrompt: 100, dominios: 10 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: true, metricas: true, interacoesCompletas: true, modelos3d: true, imagensIaPremium: true, api: true, equipe: false, marcaPropria: true },
  },
  studio: {
    id: 'studio', nome: 'Studio', precoMensalBRL: 149, precoAnualBRL: 119, porMembro: true,
    creditos: { quantidade: 20000, recorrencia: 'mensal', compartilhados: true },
    limites: { projetos: ILIMITADO, armazenamentoBytes: 50 * GB, tamanhoArquivoBytes: 1024 * MB, bandaMensalBytes: 1024 * GB, membros: 50, telasPorPrompt: 100, dominios: 100 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: true, metricas: true, interacoesCompletas: true, modelos3d: true, imagensIaPremium: true, api: true, equipe: true, marcaPropria: true },
  },
}

/**
 * Custo em créditos de cada ação de IA. O Mostra gera APRESENTAÇÕES: a ação principal é
 * "Gerar uma apresentação" = roteiro (estrutura e textos) + cada tela desenhada.
 * Ex.: 10 telas = 10 + 10 × 5 = 60 créditos (ver `custoApresentacao`).
 * As demais ações acontecem dentro de uma apresentação que já existe.
 * Vídeo foi retirado da tabela: não serve ao ciclo apresentação → link → cliente e distorcia
 * a conta "créditos ≈ apresentações" (ver docs/ux/DIRECAO.md, decisão D2).
 */
export const CUSTO_CREDITOS = {
  /** Roteiro da apresentação (estrutura, títulos, textos, notas). Cobrado uma vez por geração. */
  roteiro: 10,
  /** Cada tela desenhada a partir do roteiro. */
  tela: 5,
  /** Refazer uma tela de uma apresentação existente (novo texto no mesmo layout; rota /api/ai/tela). */
  refazerTela: 5,
  /** Reescrever ou traduzir o texto de uma tela (rota /api/ai/texto). */
  reescrever: 2,
  /** Gerar uma imagem para uma tela. */
  imagem: 20,
} as const
export type RecursoIa = keyof typeof CUSTO_CREDITOS

/** Tamanho de referência usado para traduzir créditos em apresentações ("≈ 16 apresentações de 10 telas"). */
export const TELAS_REFERENCIA = 10

/** Pacotes avulsos (não expiram). */
export const PACOTES_AVULSOS = [
  { creditos: 500, precoBRL: 19 },
  { creditos: 2000, precoBRL: 59, destaque: true },
  { creditos: 10000, precoBRL: 229 },
] as const
export type PacoteAvulso = (typeof PACOTES_AVULSOS)[number]

/** Ações de IA como a pessoa as entende, todas no contexto de uma apresentação (fonte única para landing, painel e configurações). */
export const ACOES_IA: { id: 'apresentacao' | Exclude<RecursoIa, 'roteiro' | 'tela'>; rotulo: string; detalhe: string; creditos: number; disponivel: boolean }[] = [
  { id: 'apresentacao', rotulo: 'Gerar uma apresentação', detalhe: `roteiro + telas · ${CUSTO_CREDITOS.roteiro} créditos + ${CUSTO_CREDITOS.tela} por tela`, creditos: CUSTO_CREDITOS.roteiro + TELAS_REFERENCIA * CUSTO_CREDITOS.tela, disponivel: true },
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

export function podeUsarSenhaNoLink(ctx: ContextoPlano): Decisao {
  if (PLANOS[ctx.planoId].capacidades.senhaNoLink) return { ok: true }
  return { ok: false, motivo: 'Links com senha estão disponíveis a partir do plano Pro.', upgradePara: 'pro' }
}

/** Créditos: decide se há saldo para um conjunto de operações de IA. */
export function custoDe(itens: Partial<Record<RecursoIa, number>>): number {
  return (Object.entries(itens) as [RecursoIa, number][]).reduce((s, [k, n]) => s + CUSTO_CREDITOS[k] * n, 0)
}

/** Custo de "Gerar uma apresentação" com N telas (roteiro + telas). É o que a rota /api/ai/roteiro debita. */
export function custoApresentacao(telas: number): number {
  return custoDe({ roteiro: 1, tela: Math.max(0, Math.round(telas)) })
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
