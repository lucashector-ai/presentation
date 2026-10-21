import { NextResponse } from 'next/server'
import { DesbloquearShareReq } from '@/lib/api/contratos'
import { auditar, emitirGrant, hashIp, lerJson, limitar, responder, rota, ErroHttp } from '@/lib/api/servidor'
import { supabaseServidor } from '@/lib/supabase/servidor'
import { estadoDoLink, hashToken, tokenValido, verificarSenha, JANELA_BLOQUEIO_MS, MAX_TENTATIVAS_SENHA } from '@/lib/share/token'

export const dynamic = 'force-dynamic'

/** POST /api/share/:token/unlock — verifica a senha, limita tentativas por link+IP e emite grant (cookie HttpOnly). */
export const POST = rota<{ token: string }>(async (req, { params }, requestId) => {
  const ip = await hashIp(req)
  limitar(`unlock:${ip}`, 30, JANELA_BLOQUEIO_MS)
  const { password } = await lerJson(req, DesbloquearShareReq)
  if (!tokenValido(params.token)) throw new ErroHttp('nao_encontrado', 'Link indisponível')
  const sb = supabaseServidor()
  const { data: link } = await sb.from('share_links').select('id, project_id, password_hash, expires_at, revoked_at').eq('token_hash', await hashToken(params.token)).maybeSingle()
  if (!link || !link.password_hash || estadoDoLink({ expiresAt: link.expires_at, revokedAt: link.revoked_at }) !== 'ativo') throw new ErroHttp('nao_encontrado', 'Link indisponível')

  const desde = new Date(Date.now() - JANELA_BLOQUEIO_MS).toISOString()
  const { count } = await sb.from('share_link_attempts').select('id', { count: 'exact', head: true }).eq('share_link_id', link.id).eq('ip_hash', ip).eq('succeeded', false).gte('created_at', desde)
  if ((count ?? 0) >= MAX_TENTATIVAS_SENHA) throw new ErroHttp('muitas_tentativas', 'Muitas tentativas. Aguarde alguns minutos.')

  const certo = await verificarSenha(password, link.password_hash)
  await sb.from('share_link_attempts').insert({ share_link_id: link.id, ip_hash: ip, succeeded: certo })
  await auditar({ sb }, certo ? 'share_link.unlocked' : 'share_link.unlock_failed', link.project_id)
  if (!certo) {
    const restantes = Math.max(0, MAX_TENTATIVAS_SENHA - ((count ?? 0) + 1))
    throw new ErroHttp('sem_permissao', 'Senha incorreta. Tente novamente.', { restantes, bloqueado: restantes === 0 })
  }
  const grant = await emitirGrant(link.id)
  const resposta = responder({ unlocked: true }, requestId)
  ;(resposta as NextResponse).cookies.set(grant.nome, grant.valor, grant.opcoes)
  return resposta
})
