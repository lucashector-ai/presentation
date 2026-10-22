/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-tema="escuro"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens em CSS variables (ver app/globals.css) — permitem tema claro/escuro sem duplicar classes.
        fundo: 'rgb(var(--cor-fundo) / <alpha-value>)',
        superficie: 'rgb(var(--cor-superficie) / <alpha-value>)',
        superficie2: 'rgb(var(--cor-superficie-2) / <alpha-value>)',
        borda: 'rgb(var(--cor-borda) / <alpha-value>)',
        bordaForte: 'rgb(var(--cor-borda-forte) / <alpha-value>)',
        hover: 'rgb(var(--cor-hover) / <alpha-value>)',
        texto3: 'rgb(var(--cor-texto-3) / <alpha-value>)',
        acento: 'rgb(var(--cor-acento) / <alpha-value>)',
        acentoSuave: 'rgb(var(--cor-acento-suave) / <alpha-value>)',
        aviso: 'rgb(var(--cor-aviso) / <alpha-value>)',
        guia: 'rgb(var(--cor-guia) / <alpha-value>)',
        canvas: 'rgb(var(--cor-canvas) / <alpha-value>)',
        // paleta da marca (pares fundo + tinta)
        argila: '#EEE7DB', carvao: '#2B1D16', terracota: '#B4532A', mare: '#1F3B4D', coral: '#E4572E',
        creme: '#F2E9D8', grafite: '#171717', lima: '#D7F25C', ipe: '#F2C14E', salvia: '#C9D3C0',
        musgo: '#2E3A2C', nevoa: '#E9E9EB', violeta: '#5965F2', ameixa: '#3A2E5C', pessego: '#F1D3B3',
        texto: 'rgb(var(--cor-texto) / <alpha-value>)',
        texto2: 'rgb(var(--cor-texto-2) / <alpha-value>)',
        acao: 'rgb(var(--cor-acao) / <alpha-value>)',
        acaoTexto: 'rgb(var(--cor-acao-texto) / <alpha-value>)',
        destaque: 'rgb(var(--cor-destaque) / <alpha-value>)',
        perigo: 'rgb(var(--cor-perigo) / <alpha-value>)',
        sucesso: 'rgb(var(--cor-sucesso) / <alpha-value>)',
      },
      // md e lg ficam como estão (o editor usa); as telas do painel usam controle (8), cartao (12) e bloco (16)
      borderRadius: { md: '7px', lg: '9px', xl: '12px', '2xl': '16px', controle: '8px', cartao: '12px', bloco: '16px' },
      // largura máxima do conteúdo do painel (12 colunas de 82 px + calhas de 24), ver lib/design-tokens.ts › layout
      maxWidth: { painel: '1248px' },
      boxShadow: { suave: '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -16px rgb(0 0 0 / 0.18)', carimbo: '6px 6px 0 0 #171717', painel: '0 24px 60px -24px rgb(0 0 0 / .25)' },
      fontFamily: { sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'] },
      transitionDuration: { rapida: '150ms', normal: '250ms', lenta: '450ms' },
    },
  },
  plugins: [],
}
