/**
 * Dados da empresa nos Termos de uso e na Política de privacidade (/termos e /privacidade). Um lugar só. Campos
 * vazios ('') não aparecem no texto: quando a empresa for aberta, preencher razão social, CNPJ e endereço (e o
 * encarregado, se for outra pessoa) faz as frases de identificação aparecerem sozinhas. Os e-mails precisam existir.
 */
export const EMPRESA = {
  marca: 'Mostra',
  site: 'mostra.page',
  razaoSocial: '',
  cnpj: '',
  endereco: '',
  emailContato: 'contato@mostra.page',
  emailPrivacidade: 'privacidade@mostra.page',
  /** Encarregado pelo tratamento de dados pessoais (DPO, art. 41 da LGPD). */
  encarregado: '',
  /** Cidade do foro, quando a lei permitir escolher (consumidores têm o próprio domicílio). */
  foro: 'São Paulo/SP',
} as const

/** Data da versão em vigor dos textos legais (mostrada no topo das páginas). */
export const VERSAO_LEGAL = { termos: '26 de outubro de 2026', privacidade: '26 de outubro de 2026' } as const
