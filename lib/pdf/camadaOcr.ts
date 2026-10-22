/**
 * Camada de texto das páginas escaneadas de um PDF importado como apresentação: o que o OCR reconheceu
 * (`paginaDoOcr`: palavras com caixa e linha de base, em pontos) vira blocos de texto posicionados sobre as
 * palavras da imagem, para a camada invisível e selecionável (como o texto digital do pdf.js).
 *
 * O texto digital sai em parágrafos que quebram na largura da caixa (`blocosPosicionados`); o reconhecido sai uma
 * linha por bloco, porque a fonte da imagem é desconhecida: cada linha ganha o espaçamento entre letras que faz a
 * Arial (a fonte das camadas) ocupar a mesma largura da linha reconhecida, e o topo da caixa é calculado para a
 * linha de base da Arial cair na da imagem. Assim a seleção e a busca marcam as palavras no lugar certo. Puro
 * (sem DOM): a largura da Arial vem da tabela de larguras abaixo (métricas da Helvetica, iguais às da Arial e da
 * Liberation Sans).
 */
import { limitarBlocos, linhasDaPagina, type BlocoPosicionado, type ItemPdf } from './texto'

/** Métricas verticais da Arial (hhea), em frações do tamanho da fonte. */
export const ARIAL = { ascendente: 0.905, descendente: 0.212 } as const
/** Entrelinha das camadas de texto reconhecido. */
export const ENTRELINHA_OCR = 1.15

/** Avanço dos caracteres ASCII 32–126 na Arial, em milésimos do tamanho da fonte. */
const LARGURAS_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // espaço ! " # $ % & ' ( ) * + , - . /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, // 0–9
  278, 278, 584, 584, 584, 556, 1015, // : ; < = > ? @
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, // A–Z
  278, 278, 278, 469, 556, 333, // [ \ ] ^ _ `
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, // a–z
  334, 260, 334, 584, // { | } ~
]
const LARGURAS_OUTROS: Record<string, number> = { '•': 350, '–': 556, '—': 1000, '“': 333, '”': 333, '‘': 222, '’': 222, '…': 1000, 'º': 365, 'ª': 370, '°': 400, '€': 556, 'ß': 611, 'æ': 889, 'Æ': 1000, 'ø': 611, 'Ø': 778, '«': 556, '»': 556, '§': 556, '×': 584 }

/** Avanço de um caractere (milésimos): acentuados usam a letra de base ("ã" = "a"). */
function avanco(ch: string): number {
  const extra = LARGURAS_OUTROS[ch]
  if (extra) return extra
  const base = ch.normalize('NFD').charCodeAt(0)
  return base >= 32 && base <= 126 ? LARGURAS_ASCII[base - 32]! : 556
}

/** Largura do texto na Arial com tamanho `tamanho`, sem espaçamento entre letras. */
export const larguraArial = (texto: string, tamanho: number) => ([...texto].reduce((s, c) => s + avanco(c), 0) * tamanho) / 1000

/**
 * Espaçamento entre letras (mesma unidade de `tamanho`) para a Arial ocupar `largura`. O navegador põe o
 * espaçamento depois de cada caractere, inclusive o último. Limitado para letras não se sobreporem demais nem
 * ficarem soltas quando a medida da linha vier estranha.
 */
export function espacamentoPara(texto: string, largura: number, tamanho: number): number {
  const n = [...texto].length
  if (!n || tamanho <= 0) return 0
  const e = (largura - larguraArial(texto, tamanho)) / n
  return Math.min(0.8 * tamanho, Math.max(-0.2 * tamanho, e))
}

/** Distância do topo da caixa até a linha de base da primeira linha (Arial, entrelinha `entrelinha`). */
export const baseDesdeOTopo = (tamanho: number, entrelinha: number) => ((entrelinha - ARIAL.ascendente - ARIAL.descendente) / 2 + ARIAL.ascendente) * tamanho

/**
 * O Tesseract mede a tinta das letras; a caixa de texto começa no avanço da primeira letra, que tem um respiro
 * antes da tinta (e a última, depois). Média da Arial nas letras e algarismos: ≈ 5% do tamanho de cada lado.
 */
export const RESPIRO_LATERAL = 0.05

/** Folga na largura da caixa: com a Arial ausente (outra fonte de reserva), a linha não quebra em duas. */
const folga = (largura: number, tamanho: number) => 0.04 * largura + 0.6 * tamanho

interface LinhaOcrPosicionada { texto: string; x: number; xFim: number; base: number; tamanho: number }

function blocoDeLinhas(ls: LinhaOcrPosicionada[]): BlocoPosicionado {
  const tamanho = ls.reduce((s, l) => s + l.tamanho, 0) / ls.length
  const passos = ls.slice(1).map((l, i) => (l.base - ls[i]!.base) / tamanho)
  const entrelinha = passos.length ? Math.min(3, Math.max(0.6, passos.reduce((s, p) => s + p, 0) / passos.length)) : ENTRELINHA_OCR
  const x = Math.min(...ls.map((l) => l.x))
  const largura = Math.max(...ls.map((l) => l.xFim)) - x
  // várias linhas num bloco: um espaçamento só, o que faz a linha média ocupar a largura medida
  const chars = ls.reduce((s, l) => s + [...l.texto].length, 0)
  const espacamento = ls.reduce((s, l) => s + espacamentoPara(l.texto, l.xFim - l.x, tamanho) * [...l.texto].length, 0) / Math.max(1, chars)
  return {
    texto: ls.map((l) => l.texto).join('\n'),
    x,
    y: ls[0]!.base - baseDesdeOTopo(tamanho, entrelinha),
    largura: largura + folga(largura, tamanho),
    altura: entrelinha * tamanho * ls.length,
    tamanho,
    entrelinha,
    espacamento: Math.round(espacamento * 1000) / 1000,
  }
}

/**
 * Trechos reconhecidos (pontos da página, `y` na linha de base) → blocos de texto posicionados, um por linha
 * (cada coluna de uma linha é um bloco). Com mais de `max` linhas (página muito densa), linhas seguidas da mesma
 * coluna e do mesmo tamanho viram um bloco de várias linhas; acima disso, as excedentes se juntam numa caixa só.
 */
export function blocosDoOcr(itens: ItemPdf[], max = 200): BlocoPosicionado[] {
  const r = RESPIRO_LATERAL
  const linhas: LinhaOcrPosicionada[] = linhasDaPagina(itens).flatMap((l) => l.segmentos.map((s) => ({ texto: s.texto, x: s.x - r * l.tamanho, xFim: s.xFim + r * l.tamanho, base: l.y, tamanho: l.tamanho })))
  if (linhas.length <= max) return linhas.map((l) => blocoDeLinhas([l]))
  const grupos: LinhaOcrPosicionada[][] = []
  for (const l of linhas) {
    // a linha de cima da mesma coluna, entre os grupos ainda abertos (o de outra coluna pode ter vindo depois)
    const g = grupos.slice(-6).reverse().find((g) => {
      const u = g[g.length - 1]!
      const passo = l.base - u.base
      return passo > 0.9 * l.tamanho && passo <= 1.9 * l.tamanho && Math.abs(u.tamanho - l.tamanho) <= 0.15 * u.tamanho && Math.abs(u.x - l.x) <= 2 * l.tamanho
    })
    if (g) g.push(l)
    else grupos.push([l])
  }
  return limitarBlocos(grupos.map(blocoDeLinhas), max)
}
