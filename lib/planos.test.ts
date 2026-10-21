import { describe, expect, it } from 'vitest'
import { ACOES_IA, CUSTO_CREDITOS, PACOTES_AVULSOS, PLANOS, apresentacoesCom, custoApresentacao, custoDe, formatarBytes, podeCriarProjeto, podeEnviarArquivo, podeGastarCreditos, podeGerarTelas, podeUsarSenhaNoLink, precoComCiclo, somenteLeitura, textoApresentacoes } from './planos'

describe('planos', () => {
  const uso = { projetosAtivos: 0, armazenamentoBytes: 0, bandaMesBytes: 0 }
  it('free limita a 3 projetos e sugere Plus', () => {
    expect(podeCriarProjeto({ planoId: 'free', estado: 'ativa' }, { ...uso, projetosAtivos: 2 }).ok).toBe(true)
    const d = podeCriarProjeto({ planoId: 'free', estado: 'ativa' }, { ...uso, projetosAtivos: 3 })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.upgradePara).toBe('plus')
  })
  it('plus tem projetos ilimitados', () => {
    expect(podeCriarProjeto({ planoId: 'plus', estado: 'ativa' }, { ...uso, projetosAtivos: 9999 }).ok).toBe(true)
  })
  it('assinatura cancelada vira modo leitura, sem apagar', () => {
    expect(somenteLeitura({ planoId: 'pro', estado: 'cancelada' })).toBe(true)
    expect(podeCriarProjeto({ planoId: 'pro', estado: 'cancelada' }, uso).ok).toBe(false)
  })
  it('arquivo acima do limite por arquivo é recusado; armazenamento total é respeitado', () => {
    expect(podeEnviarArquivo({ planoId: 'free', estado: 'ativa' }, uso, PLANOS.free.limites.tamanhoArquivoBytes + 1).ok).toBe(false)
    const quaseCheio = { ...uso, armazenamentoBytes: PLANOS.free.limites.armazenamentoBytes - 10 }
    expect(podeEnviarArquivo({ planoId: 'free', estado: 'ativa' }, quaseCheio, 100).ok).toBe(false)
    expect(podeEnviarArquivo({ planoId: 'free', estado: 'ativa' }, quaseCheio, 5).ok).toBe(true)
  })
  it('senha no link só a partir do Pro', () => {
    expect(podeUsarSenhaNoLink({ planoId: 'plus', estado: 'ativa' }).ok).toBe(false)
    expect(podeUsarSenhaNoLink({ planoId: 'pro', estado: 'ativa' }).ok).toBe(true)
  })
  it('créditos: custo de roteiro + 8 telas e checagem de saldo', () => {
    const custo = custoDe({ roteiro: 1, tela: 8 })
    expect(custo).toBe(CUSTO_CREDITOS.roteiro + 8 * CUSTO_CREDITOS.tela)
    expect(podeGastarCreditos(49, custo).ok).toBe(false)
    expect(podeGastarCreditos(50, custo).ok).toBe(true)
  })
  it('créditos falam em apresentações: 10 telas = 60 créditos', () => {
    expect(custoApresentacao(10)).toBe(60)
    expect(custoApresentacao(6)).toBe(40)
    expect(custoApresentacao(10)).toBe(custoDe({ roteiro: 1, tela: 10 }))
    expect(ACOES_IA[0]).toMatchObject({ id: 'apresentacao', creditos: 60 })
  })
  it('planos e pacotes traduzidos em apresentações de 10 telas', () => {
    expect(apresentacoesCom(PLANOS.free.creditos.quantidade)).toBe(6)
    expect(apresentacoesCom(PLANOS.plus.creditos.quantidade)).toBe(16)
    expect(apresentacoesCom(PLANOS.pro.creditos.quantidade)).toBe(66)
    expect(apresentacoesCom(PLANOS.studio.creditos.quantidade)).toBe(333)
    expect(PACOTES_AVULSOS.map((p) => apresentacoesCom(p.creditos))).toEqual([8, 33, 166])
    expect(apresentacoesCom(59)).toBe(0)
    expect(textoApresentacoes(1000)).toBe('≈ 16 apresentações')
    expect(textoApresentacoes(60)).toBe('≈ 1 apresentação')
    expect(textoApresentacoes(10)).toBe('menos de 1 apresentação')
  })
  it('vídeo não faz parte da tabela de créditos', () => {
    expect(Object.keys(CUSTO_CREDITOS)).not.toContain('video')
  })
  it('limite de telas por apresentação gerada depende do plano', () => {
    expect(podeGerarTelas('free', 10).ok).toBe(true)
    const d = podeGerarTelas('free', 12)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.upgradePara).toBe('plus')
    expect(podeGerarTelas('plus', 12).ok).toBe(true)
  })
  it('anual sai cerca de 20% mais barato que o mensal', () => {
    expect(precoComCiclo(PLANOS.pro, 'anual')).toBe(59)
    expect(precoComCiclo(PLANOS.pro, 'mensal')).toBe(74)
    for (const p of Object.values(PLANOS)) if (p.precoMensalBRL) expect(p.precoAnualBRL / p.precoMensalBRL).toBeLessThan(0.85)
  })
  it('formata bytes', () => {
    expect(formatarBytes(500 * 1024 * 1024)).toBe('500 MB')
    expect(formatarBytes(20 * 1024 ** 3)).toBe('20 GB')
  })
})
