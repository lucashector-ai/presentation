import { CriarConviteReq } from '@/lib/api/contratos'
import { auditar, autenticar, ehUuid, ErroHttp, lerJson, limitar, responder, rota } from '@/lib/api/servidor'
import { exigirDono, paraConvite, urlDoConvite, vagasOcupadas } from '@/lib/api/equipeServidor'
import { planoEUso } from '@/lib/api/planoServidor'
import { podeConvidarMembro } from '@/lib/planos'
import { gerarToken, hashToken } from '@/lib/share/token'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/**
 * POST /api/equipe/convites — cria um convite (com e-mail: só aquela conta aceita; sem e-mail: link).
 * O token é aleatório (32 bytes); só o hash vai para o banco e a URL é devolvida uma única vez.
 * Não há e-mail transacional ainda: quem convida copia o link e envia.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await autenticar(req, requestId)
  exigirDono(ctx)
  limitar(`convite:${ctx.userId}`, 30, 60 * 60 * 1000)
  const entrada = await lerJson(req, CriarConviteReq)
  const [{ plano }, ocupadas] = await Promise.all([planoEUso(ctx), vagasOcupadas(ctx.workspaceId)])
  const d = podeConvidarMembro(plano, ocupadas)
  if (!d.ok) throw new ErroHttp('limite_do_plano', d.motivo, { upgradePara: d.upgradePara })
  if (entrada.email) {
    const [ja] = await sql()`
      select 1 from public.workspace_members m join public.users u on u.id = m.user_id
      left join neon_auth."user" nu on nu.id = u.id
      where m.workspace_id = ${ctx.workspaceId} and lower(coalesce(nu.email, u.email)) = ${entrada.email}`
    if (ja) throw new ErroHttp('entrada_invalida', 'Esta pessoa já faz parte do espaço.')
  }
  let projetoId: string | null = null
  if (entrada.projetoId) {
    if (!ehUuid(entrada.projetoId)) throw new ErroHttp('entrada_invalida', 'Projeto inválido')
    const [p] = await sql()`select id from public.projects where id = ${entrada.projetoId} and workspace_id = ${ctx.workspaceId} and deleted_at is null`
    if (!p) throw new ErroHttp('entrada_invalida', 'Projeto inválido')
    projetoId = p.id as string
  }
  const token = gerarToken()
  const [linha] = await sql()`
    insert into public.workspace_invites (workspace_id, email, role, token_hash, project_id, created_by)
    values (${ctx.workspaceId}, ${entrada.email ?? null}, ${entrada.papel}::workspace_role, ${await hashToken(token)}, ${projetoId}::uuid, ${ctx.userId})
    returning id, email, role, created_at, expires_at, project_id`
  await auditar(ctx, 'workspace.invite_created', projetoId, { porEmail: !!entrada.email, papel: entrada.papel })
  return responder({ ...paraConvite(linha as Parameters<typeof paraConvite>[0]), url: urlDoConvite(req, token) }, requestId, 201)
})
