import 'server-only'
import { sql } from '@/lib/db/neon'
import { ErroHttp, type Contexto } from './servidor'

/**
 * Debita (custo > 0) ou estorna (custo < 0) créditos do workspace da SESSÃO, de forma atômica
 * (função SQL `debitar_creditos`, com lock da linha do saldo). Devolve o saldo novo.
 * Saldo insuficiente → ErroHttp limite_do_plano com `mensagemSemSaldo`, e nada muda.
 */
export async function debitarCreditos(ctx: Pick<Contexto, 'workspaceId'>, custo: number, motivo: string, mensagemSemSaldo = 'Créditos insuficientes.'): Promise<number> {
  try {
    const [r] = await sql()`select public.debitar_creditos(${ctx.workspaceId}::uuid, ${custo}::int, ${motivo}) as saldo`
    return Number(r?.saldo ?? 0)
  } catch (e) {
    if (e instanceof Error && e.message.includes('saldo_insuficiente')) throw new ErroHttp('limite_do_plano', mensagemSemSaldo, { custo })
    throw e
  }
}

/** Ação de IA registrada no extrato (para acompanhar custo e margem por ação). */
export type AcaoIa = 'roteiro' | 'design' | 'tela' | 'texto' | 'pdf'

export interface UsoIaRegistro {
  modelo: string
  custoUsd: number
  uso: { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number }
}

export interface CobrancaIa {
  /** Devolve `creditos` (padrão: tudo) ao saldo, com o motivo de estorno. */
  estornar: (creditos?: number) => Promise<void>
  /** Grava no débito o modelo que respondeu, o custo estimado em USD e os tokens (migração 0003). */
  registrar: (u: UsoIaRegistro) => Promise<void>
}

/**
 * Cobra antes de chamar o modelo, já com a previsão de custo em USD e o modelo planejado no extrato
 * (função SQL `debitar_creditos_ia`). Depois da chamada, `registrar` troca a previsão pelo uso medido;
 * se a geração falhar, `estornar` devolve os créditos (o custo do que foi consumido continua registrado).
 */
export async function cobrarIaComUso(
  ctx: Pick<Contexto, 'workspaceId'>,
  custo: number,
  motivos: { debito: string; estorno: string; semSaldo: string },
  previsao: { acao: AcaoIa; modelo: string; custoUsd: number }
): Promise<CobrancaIa> {
  let transacao: number | null = null
  try {
    const [r] = await sql()`select transacao from public.debitar_creditos_ia(${ctx.workspaceId}::uuid, ${custo}::int, ${motivos.debito}, ${previsao.acao}, ${previsao.modelo}, ${previsao.custoUsd.toFixed(6)}::numeric)`
    transacao = r?.transacao == null ? null : Number(r.transacao)
  } catch (e) {
    if (e instanceof Error && e.message.includes('saldo_insuficiente')) throw new ErroHttp('limite_do_plano', motivos.semSaldo, { custo })
    throw e
  }
  let estornado = 0
  return {
    estornar: async (creditos = custo) => {
      const n = Math.min(custo - estornado, Math.max(0, Math.round(creditos)))
      if (n <= 0) return
      estornado += n
      await debitarCreditos(ctx, -n, motivos.estorno)
    },
    registrar: async (u) => {
      if (transacao == null) return
      await sql()`select public.registrar_uso_ia(${ctx.workspaceId}::uuid, ${transacao}::bigint, ${u.modelo}, ${u.custoUsd.toFixed(6)}::numeric, ${Math.round(u.uso.entrada)}::int, ${Math.round(u.uso.saida)}::int, ${Math.round(u.uso.cacheLeitura)}::int, ${Math.round(u.uso.cacheEscrita)}::int)`
    },
  }
}

/** Cobra antes de chamar o modelo e devolve o estorno (para usar se a geração falhar). */
export async function cobrarIa(ctx: Pick<Contexto, 'workspaceId'>, custo: number, motivos: { debito: string; estorno: string; semSaldo: string }): Promise<() => Promise<void>> {
  await debitarCreditos(ctx, custo, motivos.debito, motivos.semSaldo)
  return async () => { await debitarCreditos(ctx, -custo, motivos.estorno) }
}
