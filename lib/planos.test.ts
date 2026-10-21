import { describe, expect, it } from 'vitest'
import { PLANOS, formatarBytes, podeCriarProjeto, podeEnviarArquivo, podeUsarSenhaNoLink, somenteLeitura } from './planos'

describe('planos', () => {
  const uso = { projetosAtivos: 0, armazenamentoBytes: 0, bandaMesBytes: 0 }
  it('free limita a 2 projetos', () => {
    expect(podeCriarProjeto({ planoId: 'free', estado: 'ativa' }, { ...uso, projetosAtivos: 1 }).ok).toBe(true)
    const d = podeCriarProjeto({ planoId: 'free', estado: 'ativa' }, { ...uso, projetosAtivos: 2 })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.upgradePara).toBe('creator')
  })
  it('assinatura cancelada vira modo leitura, sem apagar', () => {
    expect(somenteLeitura({ planoId: 'creator', estado: 'cancelada' })).toBe(true)
    expect(podeCriarProjeto({ planoId: 'creator', estado: 'cancelada' }, uso).ok).toBe(false)
  })
  it('arquivo acima do limite por arquivo é recusado', () => {
    const d = podeEnviarArquivo({ planoId: 'free', estado: 'ativa' }, uso, PLANOS.free.limites.tamanhoArquivoBytes + 1)
    expect(d.ok).toBe(false)
  })
  it('armazenamento total é respeitado', () => {
    const quaseCheio = { ...uso, armazenamentoBytes: PLANOS.free.limites.armazenamentoBytes - 10 }
    expect(podeEnviarArquivo({ planoId: 'free', estado: 'ativa' }, quaseCheio, 100).ok).toBe(false)
    expect(podeEnviarArquivo({ planoId: 'free', estado: 'ativa' }, quaseCheio, 5).ok).toBe(true)
  })
  it('senha no link só a partir do Creator', () => {
    expect(podeUsarSenhaNoLink({ planoId: 'free', estado: 'ativa' }).ok).toBe(false)
    expect(podeUsarSenhaNoLink({ planoId: 'creator', estado: 'ativa' }).ok).toBe(true)
  })
  it('formata bytes', () => {
    expect(formatarBytes(500 * 1024 * 1024)).toBe('500 MB')
    expect(formatarBytes(20 * 1024 ** 3)).toBe('20 GB')
  })
})
