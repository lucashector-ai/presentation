import 'server-only'
/**
 * Equipe do workspace: membros, convites e o workspace ativo. Só quem é dono do workspace administra a equipe
 * (convidar, mudar papel, remover); qualquer membro pode sair. Os limites de membros vêm do plano (lib/planos.ts).
 */
import type { Contexto } from './servidor'
import { ErroHttp, iso } from './servidor'
import type { Convite, Membro, Papel } from './contratos'
import { sql } from '@/lib/db/neon'

/** "Meu espaço" de outra pessoa aparece como "Espaço de Ana" para quem foi convidado. */
export function nomeDoWorkspace(nome: string, dono: string, proprio: boolean): string {
  if (proprio || nome.trim() !== 'Meu espaço' || !dono.trim()) return nome
  return `Espaço de ${dono.trim().split(/\s+/)[0]}`
}

export function exigirDono(ctx: Contexto) {
  if (ctx.papel !== 'owner') throw new ErroHttp('sem_permissao', 'Só quem administra este espaço pode gerenciar a equipe.')
}

export function urlDoConvite(req: Request, token: string): string {
  let base = new URL(req.url).origin
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try { base = new URL(process.env.NEXT_PUBLIC_APP_URL).origin } catch { /* usa a origem do pedido */ }
  }
  return `${base}/app/convite/${token}`
}

interface LinhaMembro { user_id: string; nome: string; email: string; role: Papel; created_at: Date }
interface LinhaConvite { id: string; email: string | null; role: 'editor' | 'viewer'; created_at: Date; expires_at: Date; project_id: string | null }

export const paraMembro = (l: LinhaMembro, eu: string): Membro => ({ userId: l.user_id, nome: l.nome, email: l.email, papel: l.role, desde: iso(l.created_at) ?? '', voce: l.user_id === eu })
export const paraConvite = (l: LinhaConvite): Convite => ({ id: l.id, email: l.email, papel: l.role, criadoEm: iso(l.created_at) ?? '', expiraEm: iso(l.expires_at) ?? '', projetoId: l.project_id })

export async function membrosDo(workspaceId: string, eu: string): Promise<Membro[]> {
  const linhas = await sql()`
    select m.user_id, coalesce(nullif(nu.name, ''), nullif(u.name, ''), split_part(coalesce(nu.email, u.email), '@', 1)) as nome,
           coalesce(nu.email, u.email) as email, m.role, m.created_at
    from public.workspace_members m
    join public.users u on u.id = m.user_id
    left join neon_auth."user" nu on nu.id = u.id
    where m.workspace_id = ${workspaceId}
    order by (m.role = 'owner') desc, m.created_at`
  return (linhas as LinhaMembro[]).map((l) => paraMembro(l, eu))
}

export async function convitesPendentes(workspaceId: string): Promise<Convite[]> {
  const linhas = await sql()`
    select id, email, role, created_at, expires_at, project_id from public.workspace_invites
    where workspace_id = ${workspaceId} and revoked_at is null and accepted_at is null and expires_at > now()
    order by created_at desc limit 100`
  return (linhas as LinhaConvite[]).map(paraConvite)
}

/** Membros + convites por e-mail pendentes (o que ocupa vaga no plano). */
export async function vagasOcupadas(workspaceId: string): Promise<number> {
  const [l] = await sql()`
    select (select count(*) from public.workspace_members where workspace_id = ${workspaceId})
         + (select count(*) from public.workspace_invites where workspace_id = ${workspaceId} and email is not null and revoked_at is null and accepted_at is null and expires_at > now()) as n`
  return Number(l?.n ?? 0)
}

/** Converte os erros de aceitar_convite em respostas para a pessoa. */
export function traduzirErroConvite(e: unknown): never {
  const msg = e instanceof Error ? e.message : String((e as { message?: string } | null)?.message ?? '')
  if (msg.includes('CONVITE_INVALIDO')) throw new ErroHttp('nao_encontrado', 'Este convite não vale mais (expirou, foi revogado ou já foi usado). Peça um novo.')
  if (msg.includes('CONVITE_OUTRO_EMAIL')) throw new ErroHttp('sem_permissao', 'Este convite é para outro e-mail. Entre com a conta convidada.')
  if (msg.includes('LIMITE_MEMBROS')) throw new ErroHttp('limite_do_plano', 'Este espaço chegou ao limite de membros do plano. Peça a quem administra para liberar uma vaga.')
  throw e instanceof Error ? e : new Error(msg || 'Falha ao aceitar o convite')
}
