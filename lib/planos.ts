/**
 * Planos e regras de entitlement (seção 15 do blueprint).
 * Limites são aplicados NO BACKEND por capabilities; a UI só reflete. Valores são hipóteses para validar.
 */
export type PlanoId = 'free' | 'creator' | 'studio'

export interface Limites {
  projetos: number
  armazenamentoBytes: number
  tamanhoArquivoBytes: number
  bandaMensalBytes: number
  membros: number
}

export interface Capacidades {
  marcaDaPlataforma: boolean
  linksPrivados: boolean
  senhaNoLink: boolean
  interacoesCompletas: boolean
  equipe: boolean // Fase 2
  marcaPropria: boolean // Fase 2
}

export interface Plano {
  id: PlanoId
  nome: string
  precoMensalBRL: number
  limites: Limites
  capacidades: Capacidades
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const PLANOS: Record<PlanoId, Plano> = {
  free: {
    id: 'free',
    nome: 'Free',
    precoMensalBRL: 0,
    limites: { projetos: 2, armazenamentoBytes: 500 * MB, tamanhoArquivoBytes: 25 * MB, bandaMensalBytes: 5 * GB, membros: 1 },
    capacidades: { marcaDaPlataforma: true, linksPrivados: true, senhaNoLink: false, interacoesCompletas: false, equipe: false, marcaPropria: false },
  },
  creator: {
    id: 'creator',
    nome: 'Creator',
    precoMensalBRL: 49,
    limites: { projetos: 50, armazenamentoBytes: 20 * GB, tamanhoArquivoBytes: 200 * MB, bandaMensalBytes: 100 * GB, membros: 1 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: true, interacoesCompletas: true, equipe: false, marcaPropria: false },
  },
  studio: {
    id: 'studio',
    nome: 'Studio',
    precoMensalBRL: 149,
    limites: { projetos: 500, armazenamentoBytes: 100 * GB, tamanhoArquivoBytes: 500 * MB, bandaMensalBytes: 500 * GB, membros: 10 },
    capacidades: { marcaDaPlataforma: false, linksPrivados: true, senhaNoLink: true, interacoesCompletas: true, equipe: true, marcaPropria: true },
  },
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

export function podeCriarProjeto(ctx: ContextoPlano, uso: UsoWorkspace): Decisao {
  if (somenteLeitura(ctx)) return { ok: false, motivo: 'Sua assinatura está pausada. Reative para criar projetos.' }
  const plano = PLANOS[ctx.planoId]
  if (uso.projetosAtivos >= plano.limites.projetos) {
    return {
      ok: false,
      motivo: `O plano ${plano.nome} permite até ${plano.limites.projetos} projetos ativos. Arquive um projeto ou faça upgrade.`,
      upgradePara: proximoPlano(ctx.planoId),
    }
  }
  return { ok: true }
}

export function podeEnviarArquivo(ctx: ContextoPlano, uso: UsoWorkspace, bytes: number): Decisao {
  if (somenteLeitura(ctx)) return { ok: false, motivo: 'Sua assinatura está pausada. Reative para enviar arquivos.' }
  const plano = PLANOS[ctx.planoId]
  if (bytes > plano.limites.tamanhoArquivoBytes) {
    return {
      ok: false,
      motivo: `Arquivo acima de ${formatarBytes(plano.limites.tamanhoArquivoBytes)} (limite do plano ${plano.nome}).`,
      upgradePara: proximoPlano(ctx.planoId),
    }
  }
  if (uso.armazenamentoBytes + bytes > plano.limites.armazenamentoBytes) {
    return {
      ok: false,
      motivo: `Armazenamento do plano ${plano.nome} esgotado (${formatarBytes(plano.limites.armazenamentoBytes)}).`,
      upgradePara: proximoPlano(ctx.planoId),
    }
  }
  return { ok: true }
}

export function podeUsarSenhaNoLink(ctx: ContextoPlano): Decisao {
  if (PLANOS[ctx.planoId].capacidades.senhaNoLink) return { ok: true }
  return { ok: false, motivo: 'Links com senha estão disponíveis a partir do plano Creator.', upgradePara: 'creator' }
}

export function proximoPlano(id: PlanoId): PlanoId | undefined {
  if (id === 'free') return 'creator'
  if (id === 'creator') return 'studio'
  return undefined
}

export function formatarBytes(b: number): string {
  if (b >= GB) return `${+(b / GB).toFixed(b % GB === 0 ? 0 : 1)} GB`
  if (b >= MB) return `${Math.round(b / MB)} MB`
  return `${Math.round(b / 1024)} KB`
}

export function percentualUso(usado: number, limite: number): number {
  if (limite <= 0) return 100
  return Math.min(100, Math.round((usado / limite) * 100))
}
