/**
 * Implementação real da camada de dados com as rotas simuladas: conversão do contrato da API para o modelo da UI,
 * erros viram ErroDados (409 com a revisão atual) e respostas atrasadas não desfazem mudanças locais.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjetoResumo } from '@/lib/api/contratos'
import { ErroApiCliente } from '@/lib/api/cliente'
import { documentoInicial } from './comum'
import { ErroDados } from './tipos'

const api = vi.hoisted(() => ({
  conta: { obter: vi.fn() },
  projetos: { listar: vi.fn(), obter: vi.fn(), salvarCenas: vi.fn(), publicar: vi.fn(), atualizar: vi.fn(), criar: vi.fn(), excluir: vi.fn(), excluirDefinitivo: vi.fn(), restaurar: vi.fn() },
  assets: { listar: vi.fn(), enviar: vi.fn(), excluir: vi.fn() },
  links: { listarTodos: vi.fn(), criar: vi.fn(), revogar: vi.fn() },
  share: { resolver: vi.fn(), desbloquear: vi.fn() },
  ia: { roteiro: vi.fn(), texto: vi.fn(), tela: vi.fn() },
}))
vi.mock('@/lib/api/cliente', async (original) => ({ ...(await original<typeof import('@/lib/api/cliente')>()), api }))
vi.mock('@/lib/sessao', () => ({ MODO_DEMO: false, carregarAuth: vi.fn(), sair: vi.fn(async () => {}) }))

const { fonteReal: dados } = await import('./real')

const ID = '11111111-1111-4111-8111-111111111111'
const cena = documentoInicial('slides').scenes[0]!
const resumo = (extra: Partial<ProjetoResumo> = {}): ProjetoResumo => ({
  id: ID, workspaceId: 'ws', name: 'Projeto', slug: 'projeto', mode: 'slides', status: 'draft', coverUrl: null,
  currentRevision: 3, publishedRevision: null, sceneCount: 4, activeLinks: 0, createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z', coverScene: cena, ...extra,
})

beforeEach(async () => {
  vi.clearAllMocks()
  api.projetos.listar.mockResolvedValue({ items: [], nextCursor: null, total: 0 })
  await dados.sair()
})

describe('dados reais', () => {
  it('a listagem vira projetos com a capa e a contagem de telas (documento parcial)', async () => {
    api.projetos.listar.mockImplementation(async (q: { status: string }) => ({ items: q.status === 'all' ? [resumo()] : [], nextCursor: null, total: 1 }))
    await dados.carregar(['projetos'])
    const [p] = dados.estado().projetos
    expect(p).toMatchObject({ id: ID, nome: 'Projeto', revisaoAtual: 3, totalTelas: 4, documentoParcial: true })
    expect(p!.documento.scenes).toHaveLength(1)
    expect(dados.estado().situacao.projetos.estado).toBe('pronto')
  })

  it('abrirProjeto traz o documento inteiro; 404 vira null', async () => {
    api.projetos.obter.mockResolvedValueOnce({ ...resumo(), description: 'd', scenes: [cena, { ...cena, id: 'tela-02' }] })
    const p = await dados.abrirProjeto(ID)
    expect(p).toMatchObject({ documentoParcial: false, totalTelas: 2, descricao: 'd' })
    api.projetos.obter.mockRejectedValueOnce(new ErroApiCliente('nao_encontrado', 'Projeto não encontrado'))
    expect(await dados.abrirProjeto('outro', { forcar: true })).toBeNull()
  })

  it('409 ao salvar vira ErroDados conflito_revisao com a revisão do servidor', async () => {
    api.projetos.salvarCenas.mockRejectedValueOnce(new ErroApiCliente('conflito_revisao', 'Há uma versão mais recente.', { currentRevision: 7 }, 409))
    const erro = await dados.salvarDocumento(ID, documentoInicial('slides'), 3).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroDados)
    expect(erro).toMatchObject({ code: 'conflito_revisao', details: { currentRevision: 7 } })
  })

  it('uma listagem que saiu antes de publicar não desfaz a publicação no cache', async () => {
    api.projetos.listar.mockImplementation(async (q: { status: string }) => ({ items: q.status === 'all' ? [resumo()] : [], nextCursor: null, total: 1 }))
    await dados.carregar(['projetos'])
    let soltar: (v: unknown) => void = () => {}
    api.projetos.listar.mockImplementation((q: { status: string }) => (q.status === 'all' ? new Promise((r) => { soltar = r }) : Promise.resolve({ items: [], nextCursor: null, total: 0 })))
    const recarga = dados.carregar(['projetos'], { forcar: true })
    api.projetos.publicar.mockResolvedValueOnce({ publishedRevision: 3, publishedAt: '2026-10-20T10:05:00.000Z' })
    await dados.publicar(ID, 3)
    soltar({ items: [resumo()], nextCursor: null, total: 1 }) // estado de antes da publicação
    await recarga
    expect(dados.estado().projetos[0]).toMatchObject({ revisaoPublicada: 3, status: 'published' })
  })

  it('sem conexão e sessão expirada viram ErroDados com código próprio', async () => {
    api.links.revogar.mockRejectedValueOnce(new ErroApiCliente('sem_conexao', 'Sem conexão com o servidor.'))
    await expect(dados.revogarLink('x')).rejects.toMatchObject({ code: 'sem_conexao' })
    api.conta.obter.mockRejectedValueOnce(new ErroApiCliente('nao_autenticado', 'Faça login para continuar', undefined, 401))
    await expect(dados.iniciarSessao()).rejects.toMatchObject({ code: 'nao_autenticado' })
  })

  it('compra e troca de plano recusam com mensagem clara (sem checkout no modo real)', async () => {
    await expect(dados.comprarPacote(500)).rejects.toMatchObject({ code: 'indisponivel' })
    await expect(dados.trocarPlano('pro')).rejects.toMatchObject({ code: 'indisponivel' })
  })
})
