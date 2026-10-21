import 'server-only'
import type { Contexto } from './servidor'
import type { ContextoPlano, UsoWorkspace } from '@/lib/planos'

const MAPA_ESTADO: Record<string, ContextoPlano['estado']> = { trial: 'trial', active: 'ativa', past_due: 'inadimplente', canceled: 'cancelada' }

/** Plano e uso atuais do workspace, lidos do banco (os limites valem no servidor, não na UI). */
export async function planoEUso(ctx: Contexto): Promise<{ plano: ContextoPlano; uso: UsoWorkspace }> {
  const [{ data: ws }, { data: billing }, { count: projetos }, { data: somaAssets }] = await Promise.all([
    ctx.sb.from('workspaces').select('plan_id').eq('id', ctx.workspaceId).single(),
    ctx.sb.from('billing_accounts').select('status').eq('workspace_id', ctx.workspaceId).maybeSingle(),
    ctx.sb.from('projects').select('id', { count: 'exact', head: true }).eq('workspace_id', ctx.workspaceId).is('deleted_at', null).neq('status', 'archived'),
    ctx.sb.from('assets').select('bytes').eq('workspace_id', ctx.workspaceId).is('deleted_at', null),
  ])
  const planoId = (ws?.plan_id ?? 'free') as ContextoPlano['planoId']
  const estado = MAPA_ESTADO[billing?.status ?? 'trial'] ?? 'trial'
  const armazenamentoBytes = (somaAssets ?? []).reduce((s, a) => s + Number(a.bytes ?? 0), 0)
  return { plano: { planoId, estado }, uso: { projetosAtivos: projetos ?? 0, armazenamentoBytes, bandaMesBytes: 0 } }
}
