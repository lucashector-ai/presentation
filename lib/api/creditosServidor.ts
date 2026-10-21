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

/** Cobra antes de chamar o modelo e devolve o estorno (para usar se a geração falhar). */
export async function cobrarIa(ctx: Pick<Contexto, 'workspaceId'>, custo: number, motivos: { debito: string; estorno: string; semSaldo: string }): Promise<() => Promise<void>> {
  await debitarCreditos(ctx, custo, motivos.debito, motivos.semSaldo)
  return async () => { await debitarCreditos(ctx, -custo, motivos.estorno) }
}
