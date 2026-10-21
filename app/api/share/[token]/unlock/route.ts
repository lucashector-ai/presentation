import { NextResponse } from 'next/server'
import { DesbloquearShareReq } from '@/lib/api/contratos'
import { auditar, emitirGrant, hashIp, lerJson, limitar, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { linkAtivo } from '@/lib/api/compartilhamentoServidor'
import { verificarSenha, JANELA_BLOQUEIO_MS, MAX_TENTATIVAS_SENHA } from '@/lib/share/token'
import { sql } from '@/lib/db/neon'

export const dynamic = 'force-dynamic'

/** POST /api/share/:token/unlock — verifica a senha, limita tentativas por link+IP e emite grant (cookie HttpOnly). */
export const POST = rota<{ token: string }>(async (req, { params }, requestId) => {
  const ip = await hashIp(req)
  limitar(`unlock:${ip}`, 30, JANELA_BLOQUEIO_MS)
  const { password } = await lerJson(req, DesbloquearShareReq)
  const link = await linkAtivo(params.token)
  if (!link || !link.password_hash) throw new ErroHttp('nao_encontrado', 'Link indisponível')

  const db = sql()
  const desde = new Date(Date.now() - JANELA_BLOQUEIO_MS).toISOString()
  const [{ falhas } = { falhas: 0 }] = await db`select count(*)::int as falhas from public.share_link_attempts where share_link_id = ${link.id} and ip_hash = ${ip} and succeeded = false and created_at >= ${desde}::timestamptz`
  const count = Number(falhas)
  if (count >= MAX_TENTATIVAS_SENHA) throw new ErroHttp('muitas_tentativas', 'Muitas tentativas. Aguarde alguns minutos.')

  const certo = await verificarSenha(password, link.password_hash)
  await db`insert into public.share_link_attempts (share_link_id, ip_hash, succeeded) values (${link.id}, ${ip}, ${certo})`
  await auditar({ workspaceId: link.workspace_id }, certo ? 'share_link.unlocked' : 'share_link.unlock_failed', link.project_id)
  if (!certo) {
    const restantes = Math.max(0, MAX_TENTATIVAS_SENHA - (count + 1))
    throw new ErroHttp('sem_permissao', 'Senha incorreta. Tente novamente.', { restantes, bloqueado: restantes === 0 })
  }
  const grant = await emitirGrant(link.id)
  const resposta = responder({ unlocked: true }, requestId)
  ;(resposta as NextResponse).cookies.set(grant.nome, grant.valor, grant.opcoes)
  return resposta
})
