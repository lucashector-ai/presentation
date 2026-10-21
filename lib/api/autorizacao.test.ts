/**
 * Autorização no servidor (não há RLS): sessão obrigatória, mesma origem nas mutações e TODA consulta de
 * projeto/mídia filtrada pelo workspace da sessão. O banco e o Neon Auth são simulados; o isolamento real
 * entre dois usuários é provado de ponta a ponta contra o Neon (ver db/LEIA-ME.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const consultas: { texto: string; valores: unknown[] }[] = []
let respostas: unknown[][] = []
const sessao = vi.fn<(req: Request) => Promise<{ id: string; email: string; nome: string } | null>>()

vi.mock('@/lib/db/neon', () => ({
  sql: () => (partes: TemplateStringsArray, ...valores: unknown[]) => {
    consultas.push({ texto: partes.join('$'), valores })
    return Promise.resolve(respostas.shift() ?? [])
  },
}))
vi.mock('@/lib/auth/servidor', () => ({ sessaoDaRequisicao: (req: Request) => sessao(req) }))

const { autenticar, ehUuid, ErroHttp, projetoDoWorkspace, verificarOrigem } = await import('./servidor')
const { GET: getMidia } = await import('@/app/api/midias/[id]/route')
const { GET: getProjeto } = await import('@/app/api/projects/[id]/route')

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USUARIO_A = { id: '0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a', email: 'a@x.com', nome: 'A' }
const PROJETO_DE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const pedido = (url: string, init: RequestInit = {}) => new Request(`http://localhost:3000${url}`, init)

beforeEach(() => {
  consultas.length = 0
  respostas = []
  sessao.mockReset()
})

describe('autenticar', () => {
  it('sem sessão do Neon Auth → 401, sem tocar no banco', async () => {
    sessao.mockResolvedValue(null)
    await expect(autenticar(pedido('/api/projects'), 'r')).rejects.toMatchObject({ code: 'nao_autenticado' })
    expect(consultas).toHaveLength(0)
  })
  it('com sessão, resolve o workspace pelo id do usuário (garantir_conta)', async () => {
    sessao.mockResolvedValue(USUARIO_A)
    respostas = [[{ workspace_id: WS_A }]]
    const ctx = await autenticar(pedido('/api/projects'), 'r')
    expect(ctx).toMatchObject({ userId: USUARIO_A.id, workspaceId: WS_A })
    expect(consultas[0]?.texto).toContain('garantir_conta')
    expect(consultas[0]?.valores[0]).toBe(USUARIO_A.id)
  })
  it('mutação vinda de outra origem → 403 antes de ler a sessão (CSRF)', async () => {
    sessao.mockResolvedValue(USUARIO_A)
    await expect(autenticar(pedido('/api/projects', { method: 'POST', headers: { origin: 'https://malicioso.example' } }), 'r')).rejects.toMatchObject({ code: 'sem_permissao' })
    expect(sessao).not.toHaveBeenCalled()
  })
})

describe('verificarOrigem', () => {
  it('aceita GET de qualquer lugar e POST da mesma origem; recusa cross-site sem Origin', () => {
    expect(() => verificarOrigem(pedido('/api/x', { headers: { origin: 'https://outro.example' } }))).not.toThrow()
    expect(() => verificarOrigem(pedido('/api/x', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).not.toThrow()
    expect(() => verificarOrigem(pedido('/api/x', { method: 'DELETE', headers: { 'sec-fetch-site': 'cross-site' } }))).toThrow(ErroHttp)
  })
})

describe('projetoDoWorkspace', () => {
  const ctx = { requestId: 'r', userId: USUARIO_A.id, workspaceId: WS_A }
  it('filtra pelo workspace da sessão: projeto de outro workspace → 404', async () => {
    respostas = [[]]
    await expect(projetoDoWorkspace(ctx, PROJETO_DE_B)).rejects.toMatchObject({ code: 'nao_encontrado' })
    expect(consultas[0]?.texto).toMatch(/workspace_id = \$/)
    expect(consultas[0]?.valores).toEqual([PROJETO_DE_B, WS_A])
  })
  it('id fora do formato → 404 sem consultar', async () => {
    await expect(projetoDoWorkspace(ctx, "1' or 1=1 --")).rejects.toMatchObject({ code: 'nao_encontrado' })
    expect(consultas).toHaveLength(0)
    expect(ehUuid(WS_A)).toBe(true)
  })
})

describe('rotas', () => {
  it('GET /api/projects/:id de outro usuário → 404 (não vaza existência)', async () => {
    sessao.mockResolvedValue(USUARIO_A)
    respostas = [[{ workspace_id: WS_A }], []]
    const r = await getProjeto(pedido(`/api/projects/${PROJETO_DE_B}`), { params: { id: PROJETO_DE_B } })
    expect(r.status).toBe(404)
    expect(consultas[1]?.valores).toContain(WS_A)
  })
  it('GET /api/midias/:id só procura mídia no workspace da sessão; sem sessão → 401', async () => {
    sessao.mockResolvedValue(USUARIO_A)
    respostas = [[{ workspace_id: WS_A }], []]
    const r = await getMidia(pedido(`/api/midias/${PROJETO_DE_B}`), { params: { id: PROJETO_DE_B } })
    expect(r.status).toBe(404)
    expect(consultas[1]?.texto).toMatch(/workspace_id = \$/)
    expect(consultas[1]?.valores).toEqual([PROJETO_DE_B, WS_A])

    sessao.mockResolvedValue(null)
    const anonimo = await getMidia(pedido(`/api/midias/${PROJETO_DE_B}`), { params: { id: PROJETO_DE_B } })
    expect(anonimo.status).toBe(401)
  })
})
