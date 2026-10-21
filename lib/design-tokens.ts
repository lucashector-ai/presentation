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

export const T = {
  cor: {
    fundo: '#FAFAF9',
    superficie: '#FFFFFF',
    superficie2: '#F5F5F4',
    hover: '#F3F2F0',
    borda: '#EDECEA',
    bordaForte: '#E2E1DE',
    texto: '#171717',
    texto2: '#737373',
    texto3: '#A3A3A3',
    acento: '#5965F2',
    acentoSuave: '#F0F1FE',
    sucesso: '#22A06B',
    aviso: '#F2C14E',
    perigo: '#E4572E',
    guia: '#F25987',
    canvas: '#F0EFED',
  },
  raio: { sm: 4, md: 7, lg: 9, xl: 12, pill: 99 },
  sombra: { suave: '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -16px rgb(0 0 0 / 0.18)', carimbo: '6px 6px 0 0 #171717' },
  duracao: { rapida: 150, normal: 250, lenta: 450 },
  z: { canvas: 0, selecao: 10, painel: 20, barra: 30, modal: 50, toast: 60 },
} as const

/** Fontes oferecidas para o conteúdo das apresentações (o design usa Geist na interface). */
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

/** Fontes que precisam ser carregadas do Google Fonts no editor/visualizador. */
export const FONTES_GOOGLE: Record<string, string> = {
  Inter: 'Inter:wght@300..800',
  Fraunces: 'Fraunces:opsz,wght@9..144,300..800',
  'Instrument Serif': 'Instrument+Serif',
  'Space Grotesk': 'Space+Grotesk:wght@300..700',
  'DM Serif Display': 'DM+Serif+Display',
  'Playfair Display': 'Playfair+Display:wght@400..800',
  'IBM Plex Sans': 'IBM+Plex+Sans:wght@300;400;500;600;700',
  'Archivo Black': 'Archivo+Black',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400..700;1,400..700',
  Syne: 'Syne:wght@400..800',
  Fredoka: 'Fredoka:wght@300..700',
  'Source Serif 4': 'Source+Serif+4:ital,opsz,wght@0,8..60,300..800;1,8..60,300..800',
  Unbounded: 'Unbounded:wght@300..800',
  'Bebas Neue': 'Bebas+Neue',
  Manrope: 'Manrope:wght@300..800',
}

/** Resolve o nome de fonte do conteúdo para a pilha CSS (Geist vem das variáveis do next/font). */
export function pilhaFonte(nome: string): string {
  if (nome === 'Geist') return 'var(--font-geist-sans), system-ui, sans-serif'
  if (nome === 'Geist Mono') return 'var(--font-geist-mono), ui-monospace, monospace'
  if (nome === 'system-ui') return 'system-ui, sans-serif'
  return `"${nome}", var(--font-geist-sans), system-ui, sans-serif`
}
