/**
 * Entrada na sala (no Worker, antes do Durable Object): GET /api/projects/:id/sala com Upgrade: websocket.
 *
 * Nunca confia no cliente: confere a origem (o navegador manda cookies no handshake de WebSocket, então sem isso
 * outro site poderia abrir a sala em nome da pessoa), a sessão do Neon Auth pelo cookie e se a pessoa é membro do
 * workspace do projeto, com o papel atual. Só então repassa ao DO, com a identidade num cabeçalho interno.
 */
import { AuthIndisponivel, sessaoDaRequisicao } from '@/lib/auth/servidor'
import { ErroHttp, ehUuid, limitar } from '@/lib/api/servidor'
import { ORIGENS_DO_APP } from '@/lib/site'
import { acessoAoProjeto } from './salaServidor'
import { CABECALHO_ENTRADA, type InfoEntrada } from './protocolo'

/** Só o necessário do namespace do DO (o tipo do workers-types usa Request/Response do runtime, não os do DOM). */
export interface NamespaceSalas {
  getByName(nome: string): { fetch(req: Request): Promise<Response> }
}

export const ROTA_SALA = /^\/api\/projects\/([0-9a-f-]{36})\/sala$/i
const RE_CLIENTE = /^[A-Za-z0-9_-]{8,64}$/

function recusar(status: number, texto: string) {
  return new Response(texto, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}

function origemPermitida(req: Request): boolean {
  const origem = req.headers.get('origin')
  if (!origem) return false
  // a origem do próprio pedido + as origens em que o app está no ar (lib/site.ts: domínio e workers.dev)
  return origem === new URL(req.url).origin || ORIGENS_DO_APP.has(origem)
}

export async function entrarNaSala(req: Request, salas: NamespaceSalas | undefined, projetoId: string): Promise<Response> {
  if (req.method !== 'GET' || req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return recusar(426, 'Esperava uma conexão WebSocket')
  if (!salas) return recusar(503, 'Colaboração indisponível neste ambiente')
  if (!ehUuid(projetoId)) return recusar(404, 'Projeto não encontrado')
  if (!origemPermitida(req)) return recusar(403, 'Origem não permitida')
  const clienteId = new URL(req.url).searchParams.get('cliente') ?? ''
  if (!RE_CLIENTE.test(clienteId)) return recusar(400, 'Cliente inválido')

  let usuario
  try {
    usuario = await sessaoDaRequisicao(req)
  } catch (e) {
    // o Neon Auth não respondeu: não é "sem sessão" (o cliente segue tentando reconectar, sem ir ao login)
    if (e instanceof AuthIndisponivel) return recusar(503, 'Não foi possível confirmar a sessão agora')
    throw e
  }
  if (!usuario) return recusar(401, 'Faça login para continuar')
  try {
    limitar(`sala:${usuario.id}`, 60, 60_000)
  } catch (e) {
    if (e instanceof ErroHttp) return recusar(429, e.message)
    throw e
  }
  const acesso = await acessoAoProjeto(usuario.id, projetoId)
  // 404 também para quem não é membro: não revela que o projeto existe
  if (!acesso) return recusar(404, 'Projeto não encontrado')

  const info: InfoEntrada = { userId: usuario.id, nome: usuario.nome.trim() || usuario.email.split('@')[0] || 'Alguém', papel: acesso.papel, workspaceId: acesso.workspaceId, projetoId, clienteId }
  const cabecalhos = new Headers(req.headers)
  cabecalhos.set(CABECALHO_ENTRADA, JSON.stringify(info))
  return salas.getByName(projetoId).fetch(new Request(req.url, { method: 'GET', headers: cabecalhos }))
}
