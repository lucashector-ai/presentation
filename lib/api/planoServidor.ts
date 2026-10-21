import 'server-only'
import type { Contexto } from './servidor'
import type { ContextoPlano, UsoWorkspace } from '@/lib/planos'
import { sql } from '@/lib/db/neon'

const MAPA_ESTADO: Record<string, ContextoPlano['estado']> = { trial: 'trial', active: 'ativa', past_due: 'inadimplente', canceled: 'cancelada' }

/** Plano e uso atuais do workspace, lidos do banco (os limites valem no servidor, não na UI). */
export async function planoEUso(ctx: Contexto): Promise<{ plano: ContextoPlano; uso: UsoWorkspace }> {
  const [linha] = await sql()`
    select w.plan_id,
           b.status as billing_status,
           (select count(*) from public.projects p where p.workspace_id = w.id and p.deleted_at is null and p.status <> 'archived') as projetos,
           (select coalesce(sum(a.bytes), 0) from public.assets a where a.workspace_id = w.id and a.deleted_at is null and a.status <> 'failed') as bytes
    from public.workspaces w
    left join public.billing_accounts b on b.workspace_id = w.id
    where w.id = ${ctx.workspaceId}`
  const planoId = (linha?.plan_id ?? 'free') as ContextoPlano['planoId']
  const estado = MAPA_ESTADO[(linha?.billing_status as string | null) ?? 'trial'] ?? 'trial'
  return { plano: { planoId, estado }, uso: { projetosAtivos: Number(linha?.projetos ?? 0), armazenamentoBytes: Number(linha?.bytes ?? 0), bandaMesBytes: 0 } }
}
