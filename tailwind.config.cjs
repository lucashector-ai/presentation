/** @type {import('tailwindcss').Config} */
module.exports = {
  // tema escuro por tokens (app/globals.css); a variante dark: só existe para o raro caso em que um token não resolve
  darkMode: ['class', '[data-tema="escuro"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // cursores do Mostra (variáveis em app/cursores.css, geradas de lib/editor/cursores.ts)
      cursor: Object.fromEntries(['default', 'pointer', 'text', 'grab', 'grabbing', 'move', 'crosshair', 'copy', 'not-allowed', 'zoom-in', 'zoom-out', 'help', 'progress', 'wait', 'cell', 'ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize', 'col-resize', 'row-resize'].map((n) => [n, `var(--cursor-${n})`])),
      colors: {
        // Tokens em CSS variables (ver app/globals.css) — permitem tema claro/escuro sem duplicar classes.
        fundo: 'rgb(var(--cor-fundo) / <alpha-value>)',
        superficie: 'rgb(var(--cor-superficie) / <alpha-value>)',
        superficie2: 'rgb(var(--cor-superficie-2) / <alpha-value>)',
        borda: 'rgb(var(--cor-borda) / <alpha-value>)',
        bordaForte: 'rgb(var(--cor-borda-forte) / <alpha-value>)',
        hover: 'rgb(var(--cor-hover) / <alpha-value>)',
        bordaHover: 'rgb(var(--cor-borda-hover) / <alpha-value>)',
        texto3: 'rgb(var(--cor-texto-3) / <alpha-value>)',
        textoCorpo: 'rgb(var(--cor-texto-corpo) / <alpha-value>)',
        // "tinta": o traço da marca (bordas de 2 px, carimbos, hachuras) — grafite no claro, off-white no escuro
        tinta: 'rgb(var(--cor-tinta) / <alpha-value>)',
        acento: 'rgb(var(--cor-acento) / <alpha-value>)',
        acentoHover: 'rgb(var(--cor-acento-hover) / <alpha-value>)',
        acentoTexto: 'rgb(var(--cor-acento-texto) / <alpha-value>)',
        acentoSuave: 'rgb(var(--cor-acento-suave) / <alpha-value>)',
        aviso: 'rgb(var(--cor-aviso) / <alpha-value>)',
        avisoTexto: 'rgb(var(--cor-aviso-texto) / <alpha-value>)',
        avisoFundo: 'rgb(var(--cor-aviso-fundo) / <alpha-value>)',
        guia: 'rgb(var(--cor-guia) / <alpha-value>)',
        selecao: 'rgb(var(--cor-selecao) / <alpha-value>)',
        canvas: 'rgb(var(--cor-canvas) / <alpha-value>)',
        // paleta da marca (pares fundo + tinta)
        argila: '#EEE7DB', carvao: '#2B1D16', terracota: '#B4532A', mare: '#1F3B4D', coral: '#E4572E',
        creme: '#F2E9D8', grafite: '#171717', lima: '#D7F25C', ipe: '#F2C14E', salvia: '#C9D3C0',
        musgo: '#2E3A2C', nevoa: '#E9E9EB', violeta: '#5965F2', ameixa: '#3A2E5C', pessego: '#F1D3B3',
        texto: 'rgb(var(--cor-texto) / <alpha-value>)',
        texto2: 'rgb(var(--cor-texto-2) / <alpha-value>)',
        acao: 'rgb(var(--cor-acao) / <alpha-value>)',
        acaoHover: 'rgb(var(--cor-acao-hover) / <alpha-value>)',
        acaoTexto: 'rgb(var(--cor-acao-texto) / <alpha-value>)',
        destaque: 'rgb(var(--cor-destaque) / <alpha-value>)',
        perigo: 'rgb(var(--cor-perigo) / <alpha-value>)',
        sucesso: 'rgb(var(--cor-sucesso) / <alpha-value>)',
        sucessoTexto: 'rgb(var(--cor-sucesso-texto) / <alpha-value>)',
        sucessoFundo: 'rgb(var(--cor-sucesso-fundo) / <alpha-value>)',
      },
      // md e lg ficam como estão (o editor usa); as telas do painel usam controle (8), cartao (12) e bloco (16)
      borderRadius: { md: '7px', lg: '9px', xl: '12px', '2xl': '16px', controle: '8px', cartao: '12px', bloco: '16px' },
      // largura máxima do conteúdo do painel (12 colunas de 82 px + calhas de 24), ver lib/design-tokens.ts › layout;
      // painel-lg/painel-xl = 1248 + as duas margens (32 e 48), para o main do Shell parar junto com o conteúdo
      maxWidth: { painel: '1248px', 'painel-lg': '1312px', 'painel-xl': '1344px' },
      // carimbo: sombra sólida deslocada na cor da tinta (segue o tema); carimbo-sm para cartões do painel; carimboAcento em violeta fixo
      boxShadow: { suave: '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -16px rgb(0 0 0 / 0.18)', carimbo: '6px 6px 0 0 rgb(var(--cor-tinta))', 'carimbo-sm': '4px 4px 0 0 rgb(var(--cor-tinta))', 'carimbo-lg': '8px 8px 0 0 rgb(var(--cor-tinta))', painel: '0 24px 60px -24px rgb(0 0 0 / .25)' },
      fontFamily: { sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'] },
      transitionDuration: { rapida: '150ms', normal: '250ms', lenta: '450ms' },
    },
  },
  plugins: [],
}
