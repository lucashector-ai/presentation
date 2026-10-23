/**
 * Tokens de design da Mostra (fonte: Claude Design, "Mostra — logotipo" e telas do produto).
 * Espelham as CSS variables de app/globals.css. Em classes Tailwind use as cores nomeadas
 * (bg-acento, text-texto3, bg-argila...).
 */

/** Paleta da marca: 15 cores, sempre em pares fundo + tinta. */
export const PALETA = [
  { id: 'argila', nome: 'Argila', fundo: '#EEE7DB', tinta: '#2B1D16' },
  { id: 'carvao', nome: 'Carvão', fundo: '#2B1D16', tinta: '#EEE7DB' },
  { id: 'terracota', nome: 'Terracota', fundo: '#B4532A', tinta: '#EEE7DB' },
  { id: 'mare', nome: 'Maré', fundo: '#1F3B4D', tinta: '#F2E9D8' },
  { id: 'coral', nome: 'Coral', fundo: '#E4572E', tinta: '#FFF4EC' },
  { id: 'creme', nome: 'Creme', fundo: '#F2E9D8', tinta: '#1F3B4D' },
  { id: 'grafite', nome: 'Grafite', fundo: '#171717', tinta: '#D7F25C' },
  { id: 'lima', nome: 'Lima', fundo: '#D7F25C', tinta: '#171717' },
  { id: 'ipe', nome: 'Ipê', fundo: '#F2C14E', tinta: '#2A2118' },
  { id: 'salvia', nome: 'Sálvia', fundo: '#C9D3C0', tinta: '#2E3A2C' },
  { id: 'musgo', nome: 'Musgo', fundo: '#2E3A2C', tinta: '#C9D3C0' },
  { id: 'nevoa', nome: 'Névoa', fundo: '#E9E9EB', tinta: '#171717' },
  { id: 'violeta', nome: 'Violeta', fundo: '#5965F2', tinta: '#FFFFFF' },
  { id: 'ameixa', nome: 'Ameixa', fundo: '#3A2E5C', tinta: '#F1D3B3' },
  { id: 'pessego', nome: 'Pêssego', fundo: '#F1D3B3', tinta: '#3A2E5C' },
] as const

export type CorPaleta = (typeof PALETA)[number]

/**
 * Cores de interface por tema (espelho das CSS variables `--cor-*` de app/globals.css; lib/tema.test.ts confere).
 * O escuro é um quase-preto quente (não cinza azulado), com duas superfícies, bordas sutis, off-white e o violeta
 * clareado para contraste AA. O conteúdo das apresentações nunca usa estas cores.
 */
export const CORES_TEMA = {
  claro: {
    fundo: '#FAFAF9', superficie: '#FFFFFF', superficie2: '#F5F5F4', hover: '#F3F2F0',
    borda: '#EDECEA', bordaForte: '#E2E1DE', bordaHover: '#D4D4D4',
    texto: '#171717', textoCorpo: '#525252', texto2: '#737373', texto3: '#A3A3A3', tinta: '#171717',
    acao: '#171717', acaoHover: '#2A2A2A', acaoTexto: '#FAFAF9',
    acento: '#5965F2', acentoHover: '#4A55E0', acentoTexto: '#FFFFFF', acentoSuave: '#F0F1FE',
    destaque: '#D7F25C', perigo: '#E4572E', sucesso: '#22A06B', sucessoTexto: '#2F6B45', sucessoFundo: '#EEF5EC',
    aviso: '#F2C14E', avisoTexto: '#7A5A12', avisoFundo: '#FFF8E6', guia: '#F25987', selecao: '#0D99FF', canvas: '#F0EFED',
  },
  escuro: {
    fundo: '#121110', superficie: '#1A1918', superficie2: '#232120', hover: '#2A2826',
    borda: '#2C2A28', bordaForte: '#3A3734', bordaHover: '#4A4642',
    texto: '#F2EFEA', textoCorpo: '#C9C4BC', texto2: '#A39E96', texto3: '#8F8A82', tinta: '#F2EFEA',
    acao: '#F2EFEA', acaoHover: '#FFFFFF', acaoTexto: '#121110',
    acento: '#7F89FF', acentoHover: '#99A1FF', acentoTexto: '#121110', acentoSuave: '#23263F',
    destaque: '#D7F25C', perigo: '#FF7A57', sucesso: '#4CC48F', sucessoTexto: '#6FD39E', sucessoFundo: '#16291F',
    aviso: '#F2C14E', avisoTexto: '#F2C14E', avisoFundo: '#2E2612', guia: '#F25987', selecao: '#0D99FF', canvas: '#0E0D0C',
  },
} as const

export const T = {
  /** Tema claro (o padrão do design); o escuro está em CORES_TEMA.escuro. */
  cor: CORES_TEMA.claro,
  // md 7 e lg 9 continuam por compatibilidade do editor; nas telas do painel use controle, cartao e bloco
  raio: { sm: 4, md: 7, lg: 9, xl: 12, controle: 8, cartao: 12, bloco: 16, pill: 99 },
  /** Alturas de controle: sm (ações em cartões e listas), md (padrão), lg (ação principal da tela). */
  controle: { sm: 32, md: 40, lg: 48 },
  /**
   * Grid do painel (components/app/Layout.tsx): 4 colunas no celular, 8 no tablet e com a barra lateral (lg),
   * 12 a partir de xl, largura máxima de 1248 alinhada à barra lateral (a 48 dela; 32 no lg). Todo espaçamento de layout sai de `espaco`
   * (múltiplos de 8); 4 só dentro de componentes (ícone e texto, título e meta de uma linha, badge).
   */
  layout: {
    colunas: { base: 4, sm: 8, lg: 8, xl: 12 },
    calha: { base: 16, sm: 24 },
    margem: { base: 16, sm: 32, xl: 48 },
    larguraMax: 1248,
    espaco: [8, 16, 24, 32, 40, 48, 56, 64, 80, 96],
    cartao: { base: 16, sm: 24 },
    secao: 48,
    cabecalho: 32,
    tituloSecao: 16,
  },
  sombra: { suave: '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -16px rgb(0 0 0 / 0.18)', carimbo: '6px 6px 0 0 rgb(var(--cor-tinta))' },
  duracao: { rapida: 150, normal: 250, lenta: 450 },
  z: { canvas: 0, selecao: 10, painel: 20, barra: 30, modal: 50, toast: 60 },
} as const

/**
 * Biblioteca curada de fontes (estilos do Criar com IA, métricas em lib/scene/tipografia.ts). O seletor de fonte
 * oferece o catálogo completo do Google Fonts (lib/fontes/catalogo.ts); estas continuam sendo as sugeridas.
 */
export const FONTES_APRESENTACAO = [
  'Geist',
  'Geist Mono',
  'Inter',
  'Fraunces',
  'Instrument Serif',
  'Space Grotesk',
  'DM Serif Display',
  'Playfair Display',
  'IBM Plex Sans',
  'Archivo Black',
  'Cormorant Garamond',
  'Syne',
  'Fredoka',
  'Source Serif 4',
  'Unbounded',
  'Bebas Neue',
  'Manrope',
  'Georgia',
  'system-ui',
] as const

/** Resolve o nome de fonte do conteúdo para a pilha CSS (Geist vem das variáveis do next/font). */
export function pilhaFonte(nome: string): string {
  if (nome === 'Geist') return 'var(--font-geist-sans), system-ui, sans-serif'
  if (nome === 'Geist Mono') return 'var(--font-geist-mono), ui-monospace, monospace'
  if (nome === 'system-ui') return 'system-ui, sans-serif'
  return `"${nome}", var(--font-geist-sans), system-ui, sans-serif`
}
