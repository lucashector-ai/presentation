/**
 * Tokens de design (seção 16). Espelham as CSS variables de app/globals.css.
 * Use `T.cor.acao` etc. em código JS; em classes Tailwind use as cores nomeadas (bg-acao, text-texto2...).
 */
export const T = {
  cor: {
    claro: {
      fundo: '#F6F7F5',
      superficie: '#FFFFFF',
      superficie2: '#EEF1EC',
      borda: '#E2E6DF',
      texto: '#101820',
      texto2: '#5B6670',
      acao: '#101820',
      acaoTexto: '#FFFFFF',
      destaque: '#D9F99D',
      perigo: '#C2410C',
      sucesso: '#15803D',
    },
    escuro: {
      fundo: '#0F1620',
      superficie: '#17202B',
      superficie2: '#1F2A36',
      borda: '#2A3642',
      texto: '#F3F5F2',
      texto2: '#9AA6B2',
      acao: '#D9F99D',
      acaoTexto: '#101820',
      destaque: '#B5D8C2',
      perigo: '#FB923C',
      sucesso: '#4ADE80',
    },
  },
  raio: { sm: 8, md: 12, lg: 14, xl: 20, pill: 999 },
  sombra: { suave: '0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px -12px rgb(0 0 0 / 0.15)' },
  espaco: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
  duracao: { rapida: 150, normal: 250, lenta: 450 },
  z: { canvas: 0, selecao: 10, painel: 20, barra: 30, modal: 50, toast: 60 },
  tipografia: { interface: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif' },
} as const

export const FONTES_APRESENTACAO = ['system-ui', 'Georgia', 'Helvetica Neue', 'Inter', 'Times New Roman', 'Courier New'] as const
