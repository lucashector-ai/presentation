/**
 * Entrada da sala (handshake do WebSocket no Worker): origem, sessão e participação no workspace são conferidas
 * no servidor; a identidade vai ao Durable Object num cabeçalho montado aqui (o do cliente é descartado).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessao = vi.fn<(req: Request) => Promise<{ id: string; email: string; nome: string } | null>>()
const acesso = vi.fn<(userId: string, projetoId: string) => Promise<{ workspaceId: string; papel: 'owner' | 'editor' | 'viewer' } | null>>()
vi.mock('@/lib/auth/servidor', () => ({ sessaoDaRequisicao: (req: Request) => sessao(req) }))
vi.mock('./salaServidor', () => ({ acessoAoProjeto: (u: string, p: string) => acesso(u, p) }))
vi.mock('@/lib/db/neon', () => ({ sql: () => () => Promise.resolve([]) }))

const { entrarNaSala, ROTA_SALA } = await import('./entrada')
const { CABECALHO_ENTRADA } = await import('./protocolo')

const PROJETO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USUARIO = { id: '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', email: 'ana@x.com', nome: 'Ana' }
const pedido = (headers: Record<string, string> = {}, cliente = 'cliente-123456') =>
  new Request(`http://localhost:3000/api/projects/${PROJETO}/sala?cliente=${cliente}`, { headers: { upgrade: 'websocket', origin: 'http://localhost:3000', ...headers } })

let repassado: Request | null = null
const salas = { getByName: (nome: string) => ({ fetch: async (req: Request) => { repassado = req; return new Response(`sala ${nome}`, { status: 200 }) } }) }

beforeEach(() => {
  sessao.mockReset()
  acesso.mockReset()
  repassado = null
})

describe('entrarNaSala', () => {
  it('a rota casa só /api/projects/:uuid/sala', () => {
    expect(`/api/projects/${PROJETO}/sala`.match(ROTA_SALA)?.[1]).toBe(PROJETO)
    expect('/api/projects/x/sala'.match(ROTA_SALA)).toBeNull()
  })
  it('sem Upgrade: websocket → 426', async () => {
    const r = await entrarNaSala(new Request(`http://localhost:3000/api/projects/${PROJETO}/sala`), salas, PROJETO)
    expect(r.status).toBe(426)
  })
  it('origem de outro site → 403, sem ler a sessão (cross-site WebSocket hijacking)', async () => {
    const r = await entrarNaSala(pedido({ origin: 'https://malicioso.example' }), salas, PROJETO)
    expect(r.status).toBe(403)
    expect(sessao).not.toHaveBeenCalled()
  })
  it('sem sessão → 401; sessão de quem não é membro → 404 (não revela o projeto)', async () => {
    sessao.mockResolvedValue(null)
    expect((await entrarNaSala(pedido(), salas, PROJETO)).status).toBe(401)
    sessao.mockResolvedValue(USUARIO)
    acesso.mockResolvedValue(null)
    expect((await entrarNaSala(pedido(), salas, PROJETO)).status).toBe(404)
    expect(acesso).toHaveBeenCalledWith(USUARIO.id, PROJETO)
    expect(repassado).toBeNull()
  })
  it('cliente fora do formato → 400', async () => {
    expect((await entrarNaSala(pedido({}, '../x'), salas, PROJETO)).status).toBe(400)
  })
  it('membro: repassa ao DO do projeto com a identidade do servidor (o cabeçalho do cliente é trocado)', async () => {
    sessao.mockResolvedValue(USUARIO)
    acesso.mockResolvedValue({ workspaceId: 'ws-1', papel: 'viewer' })
    const forjado = JSON.stringify({ userId: 'outro', papel: 'owner' })
    const r = await entrarNaSala(pedido({ [CABECALHO_ENTRADA]: forjado }), salas, PROJETO)
    expect(await r.text()).toBe(`sala ${PROJETO}`)
    const info = JSON.parse(repassado!.headers.get(CABECALHO_ENTRADA)!)
    expect(info).toMatchObject({ userId: USUARIO.id, papel: 'viewer', workspaceId: 'ws-1', projetoId: PROJETO, clienteId: 'cliente-123456' })
  })
})
