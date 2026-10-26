/**
 * Dados da empresa nos Termos de uso e na Política de privacidade (/termos e /privacidade). Um lugar só: o que
 * está entre colchetes precisa ser preenchido antes do lançamento (razão social, CNPJ, endereço, encarregado) e
 * os e-mails precisam existir e ser lidos.
 */
export const EMPRESA = {
  marca: 'Mostra',
  site: 'mostra.page',
  razaoSocial: '[Razão social]',
  cnpj: '[CNPJ]',
  endereco: '[Endereço completo]',
  emailContato: 'contato@mostra.page',
  emailPrivacidade: 'privacidade@mostra.page',
  /** Encarregado pelo tratamento de dados pessoais (DPO, art. 41 da LGPD). */
  encarregado: '[Nome do encarregado]',
  /** Cidade do foro, quando a lei permitir escolher (consumidores têm o próprio domicílio). */
  foro: '[Cidade/UF]',
} as const

/** Data da versão em vigor dos textos legais (mostrada no topo das páginas). */
export const VERSAO_LEGAL = { termos: '26 de outubro de 2026', privacidade: '26 de outubro de 2026' } as const
