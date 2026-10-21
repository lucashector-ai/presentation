import { describe, expect, it } from 'vitest'
import { ACOES_IA, CUSTO_CREDITOS, DIVISAO_TELA, custoDesenho, custoRoteiro, resumoCobranca, PACOTES_AVULSOS, PLANOS, apresentacoesCom, custoApresentacao, custoDe, formatarBytes, podeConvidarMembro, podeCriarProjeto, podeEnviarArquivo, podeGastarCreditos, podeGerarTelas, podeUsarSenhaNoLink, precoComCiclo, somenteLeitura, textoApresentacoes } from './planos'

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
    expect(podeGastarCreditos(custo - 1, custo).ok).toBe(false)
    expect(podeGastarCreditos(custo, custo).ok).toBe(true)
  })
  it('1 crédito = 1 tela: 10 telas = 10 créditos, cobrados no design', () => {
    expect(custoApresentacao(10)).toBe(10)
    expect(custoApresentacao(6)).toBe(6)
    expect(custoApresentacao(30)).toBe(30)
    expect(custoApresentacao(10)).toBe(custoDe({ roteiro: 1, tela: 10 }))
    expect(custoRoteiro(10) + custoDesenho(10)).toBe(custoApresentacao(10))
    expect(custoRoteiro(10)).toBe(0)
    expect(DIVISAO_TELA.roteiro + DIVISAO_TELA.desenho).toBe(CUSTO_CREDITOS.tela)
    expect(ACOES_IA[0]).toMatchObject({ id: 'apresentacao', creditos: 10 })
  })
  it('material colado: grátis até 20 mil caracteres, depois 1 crédito a cada 20 mil', () => {
    expect(custoRoteiro(10, 0)).toBe(0)
    expect(custoRoteiro(10, 20000)).toBe(0)
    expect(custoRoteiro(10, 20001)).toBe(1)
    expect(custoRoteiro(10, 60000)).toBe(2)
    expect(custoApresentacao(10, 60000) - custoApresentacao(10)).toBe(2)
  })
  it('resumo da cobrança explica 1 crédito = 1 tela', () => {
    expect(resumoCobranca(10)).toContain('1 crédito = 1 tela')
    expect(resumoCobranca(10)).toContain('10 créditos')
  })
  it('planos e pacotes traduzidos em apresentações de 10 telas', () => {
    expect(apresentacoesCom(PLANOS.free.creditos.quantidade)).toBe(5)
    expect(apresentacoesCom(PLANOS.plus.creditos.quantidade)).toBe(15)
    expect(apresentacoesCom(PLANOS.pro.creditos.quantidade)).toBe(40)
    expect(apresentacoesCom(PLANOS.studio.creditos.quantidade)).toBe(80)
    expect(PACOTES_AVULSOS.map((p) => apresentacoesCom(p.creditos))).toEqual([10, 40, 200])
    expect(apresentacoesCom(9)).toBe(0)
    expect(textoApresentacoes(1000)).toBe('≈ 100 apresentações')
    expect(textoApresentacoes(10)).toBe('≈ 1 apresentação')
    expect(textoApresentacoes(9)).toBe('menos de 1 apresentação')
  })
  it('vídeo não faz parte da tabela de créditos', () => {
    expect(Object.keys(CUSTO_CREDITOS)).not.toContain('video')
  })
  it('limite de telas por apresentação gerada depende do plano: Free 12, Plus 20, Pro e Studio 30', () => {
    expect([PLANOS.free, PLANOS.plus, PLANOS.pro, PLANOS.studio].map((p) => p.limites.telasPorPrompt)).toEqual([12, 20, 30, 30])
    expect(podeGerarTelas('free', 12).ok).toBe(true)
    const d = podeGerarTelas('free', 13)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.upgradePara).toBe('plus')
    expect(podeGerarTelas('plus', 20).ok).toBe(true)
    expect(podeGerarTelas('plus', 21)).toMatchObject({ ok: false, upgradePara: 'pro' })
    expect(podeGerarTelas('pro', 30).ok).toBe(true)
    expect(podeGerarTelas('studio', 31).ok).toBe(false)
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

  it('convidar membros respeita o limite do plano (Free/Plus/Pro são individuais)', () => {
    const free = podeConvidarMembro({ planoId: 'free', estado: 'ativa' }, 1)
    expect(free.ok).toBe(false)
    expect(!free.ok && free.upgradePara).toBe('studio')
    expect(podeConvidarMembro({ planoId: 'pro', estado: 'ativa' }, 1).ok).toBe(false)
    expect(podeConvidarMembro({ planoId: 'studio', estado: 'ativa' }, 1).ok).toBe(true)
    expect(podeConvidarMembro({ planoId: 'studio', estado: 'ativa' }, PLANOS.studio.limites.membros).ok).toBe(false)
    expect(podeConvidarMembro({ planoId: 'studio', estado: 'cancelada' }, 1).ok).toBe(false)
  })
})
