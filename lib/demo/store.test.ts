import { beforeEach, describe, expect, it } from 'vitest'
import { comprarPacote, criarLink, criarProjeto, definirUsuario, desbloquear, ErroDemo, estado, gastarCreditos, publicar, reiniciarDemo, resolverToken, revogarLink, salvarDocumento, trocarPlano } from './store'
import { TOKEN_DEMO } from './dados'
import { PLANOS } from '@/lib/planos'

describe('store de demonstração (contratos do backend)', () => {
  beforeEach(() => reiniciarDemo())

  it('salvar exige baseRevision correta (409 em conflito)', () => {
    const p = estado().projetos[0]!
    const r = salvarDocumento(p.id, p.documento, p.revisaoAtual)
    expect(r.revision).toBe(p.revisaoAtual + 1)
    expect(() => salvarDocumento(p.id, p.documento, p.revisaoAtual)).toThrowError(ErroDemo)
    try {
      salvarDocumento(p.id, p.documento, p.revisaoAtual)
    } catch (e) {
      expect((e as ErroDemo).code).toBe('conflito_revisao')
    }
  })

  it('rascunho não aparece no link até publicar nova revisão', async () => {
    const p = estado().projetos[0]!
    const doc = structuredClone(p.documento)
    doc.scenes[0]!.title = 'Capa editada'
    salvarDocumento(p.id, doc, p.revisaoAtual)
    const antes = await resolverToken(TOKEN_DEMO)
    expect(antes.state).toBe('ready')
    if (antes.state === 'ready') expect(antes.documento.scenes[0]!.title).toBe('Capa')
    publicar(p.id, p.revisaoAtual + 1)
    const depois = await resolverToken(TOKEN_DEMO)
    if (depois.state === 'ready') expect(depois.documento.scenes[0]!.title).toBe('Capa editada')
  })

  it('link revogado passa a indisponível imediatamente, sem revelar motivo', async () => {
    const l = estado().links.find((x) => x.tokenDemo === TOKEN_DEMO)!
    revogarLink(l.id)
    expect(await resolverToken(TOKEN_DEMO)).toEqual({ state: 'unavailable' })
    expect(await resolverToken('token-inexistente')).toEqual({ state: 'unavailable' })
  })

  it('link com senha: bloqueado, desbloqueia com senha certa, limita tentativas', async () => {
    const p = estado().projetos[0]!
    const { token } = await criarLink(p.id, { senha: 'cliente' })
    const r = await resolverToken(token)
    expect(r.state).toBe('locked')
    for (let i = 0; i < 5; i++) {
      const t = await desbloquear(token, 'errada')
      expect(t.ok).toBe(false)
    }
    await expect(desbloquear(token, 'cliente')).rejects.toMatchObject({ code: 'muitas_tentativas' })
  })

  it('link com senha certa libera o conteúdo', async () => {
    const p = estado().projetos[0]!
    const { token, link } = await criarLink(p.id, { senha: 'cliente' })
    const t = await desbloquear(token, 'cliente')
    expect(t.ok).toBe(true)
    const r = await resolverToken(token, new Set([link.id]))
    expect(r.state).toBe('ready')
  })

  it('não cria link para projeto nunca publicado', async () => {
    const novo = criarProjeto({ nome: 'Teste', modo: 'slides' })
    await expect(criarLink(novo.id, {})).rejects.toMatchObject({ code: 'entrada_invalida' })
  })

  it('respeita limite de projetos do plano', () => {
    const e = estado()
    e.workspace.planoId = 'free'
    expect(() => criarProjeto({ nome: 'Terceiro', modo: 'slides' })).toThrowError(/plano Free/)
  })

  it('créditos: gastar debita, sem saldo recusa; pacote avulso credita e entra no extrato', () => {
    const antes = estado().creditos.saldo
    gastarCreditos(60, 'Apresentação com IA · 10 telas')
    expect(estado().creditos.saldo).toBe(antes - 60)
    expect(() => gastarCreditos(10_000_000, 'grande demais')).toThrowError(ErroDemo)
    comprarPacote(2000)
    expect(estado().creditos.saldo).toBe(antes - 60 + 2000)
    expect(estado().creditos.movimentos[0]).toMatchObject({ quantidade: 2000 })
    expect(() => comprarPacote(123)).toThrowError(ErroDemo)
  })

  it('trocar de plano: upgrade credita os créditos do mês; downgrade não apaga nada', () => {
    reiniciarDemo({ vazio: true })
    expect(estado().workspace.planoId).toBe('free')
    expect(estado().creditos.saldo).toBe(PLANOS.free.creditos.quantidade)
    trocarPlano('plus')
    expect(estado().workspace.planoId).toBe('plus')
    expect(estado().creditos.saldo).toBe(PLANOS.free.creditos.quantidade + PLANOS.plus.creditos.quantidade)
    trocarPlano('free')
    expect(estado().workspace.planoId).toBe('free')
    expect(estado().creditos.saldo).toBe(PLANOS.free.creditos.quantidade + PLANOS.plus.creditos.quantidade)
  })

  it('espaço vazio simula conta nova; cadastro define o nome', () => {
    reiniciarDemo({ vazio: true })
    expect(estado().projetos).toHaveLength(0)
    definirUsuario({ nome: 'Ana Lima', email: 'ana@estudio.com' })
    expect(estado().usuario).toMatchObject({ nome: 'Ana Lima', email: 'ana@estudio.com' })
    reiniciarDemo()
    expect(estado().projetos.find((p) => p.id === 'pr-atlas')).toBeTruthy()
  })
})
