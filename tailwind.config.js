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
        texto: 'rgb(var(--cor-texto) / <alpha-value>)',
        texto2: 'rgb(var(--cor-texto-2) / <alpha-value>)',
        acao: 'rgb(var(--cor-acao) / <alpha-value>)',
        acaoTexto: 'rgb(var(--cor-acao-texto) / <alpha-value>)',
        destaque: 'rgb(var(--cor-destaque) / <alpha-value>)',
        perigo: 'rgb(var(--cor-perigo) / <alpha-value>)',
        sucesso: 'rgb(var(--cor-sucesso) / <alpha-value>)',
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: { suave: '0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px -12px rgb(0 0 0 / 0.15)' },
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'] },
      transitionDuration: { rapida: '150ms', normal: '250ms', lenta: '450ms' },
    },
  },
  plugins: [],
}
