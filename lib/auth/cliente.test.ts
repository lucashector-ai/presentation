import { describe, expect, it } from 'vitest'
import { mensagemErroAuth } from './cliente'

describe('mensagemErroAuth', () => {
  it('traduz os códigos lançados pelo SDK (AuthApiError) e os do Better Auth', () => {
    expect(mensagemErroAuth({ code: 'invalid_credentials', status: 401 })).toBe('E-mail ou senha incorretos.')
    expect(mensagemErroAuth({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 })).toBe('E-mail ou senha incorretos.')
    expect(mensagemErroAuth({ code: 'user_already_exists', status: 422 })).toMatch(/Já existe uma conta/)
    expect(mensagemErroAuth({ code: 'weak_password' })).toMatch(/8 caracteres/)
    expect(mensagemErroAuth({ code: 'over_request_rate_limit', status: 429 })).toMatch(/Muitas tentativas/)
  })
  it('erro sem código (rede, exceção qualquer) vira mensagem genérica', () => {
    expect(mensagemErroAuth(new TypeError('fetch failed'))).toMatch(/Tente de novo/)
    expect(mensagemErroAuth(null)).toMatch(/Tente de novo/)
  })
})
