/**
 * Tipografia das camadas de texto — a MESMA regra para o renderizador (editor, visualizador, miniaturas,
 * exportação PNG/PDF) e para a medição de largura/altura automática do editor (lib/editor/medirTexto.ts).
 *
 * Estrutura no DOM (renderizador e medidor):
 *   caixa (flex em coluna: padding, alinhamento vertical, fonte, decoração, caixa, quebra)
 *     └ corpo (o texto; corte vertical, truncar, recuo de lista)
 *         └ parágrafos (só com lista ou espaço entre parágrafos; um por linha separada por Enter)
 *
 * Corte vertical ("Vertical trim" do Figma, "cap height to baseline"): onde o navegador suporta
 * `text-box: trim-both cap alphabetic` ele é usado (exato, com as métricas reais da fonte). Nos outros, a
 * classe `.texto-corte` (app/globals.css) aplica margens negativas calculadas aqui com as métricas das fontes
 * da biblioteca (ascendente, descendente e altura das maiúsculas lidas dos arquivos das fontes, ÷ unidades do em).
 */
import type { CSSProperties } from 'react'
import type { CamadaTexto } from './schema'
import { pilhaFonte } from '@/lib/design-tokens'

export interface MetricasFonte {
  /** Ascendente usado no layout de linha (hhea, ou OS/2 typo quando a fonte pede USE_TYPO_METRICS). */
  ascent: number
  /** Descendente (positivo). */
  descent: number
  /** Altura das maiúsculas (OS/2 sCapHeight). */
  capHeight: number
}

/** Métricas das fontes da biblioteca (FONTES_APRESENTACAO), em frações do tamanho da fonte. */
export const METRICAS_FONTES: Record<string, MetricasFonte> = {
  Geist: { ascent: 1.005, descent: 0.295, capHeight: 0.71 },
  'Geist Mono': { ascent: 1.005, descent: 0.295, capHeight: 0.71 },
  Inter: { ascent: 0.9688, descent: 0.2412, capHeight: 0.7275 },
  Fraunces: { ascent: 0.978, descent: 0.255, capHeight: 0.7 },
  'Instrument Serif': { ascent: 0.99, descent: 0.31, capHeight: 0.72 },
  'Space Grotesk': { ascent: 0.984, descent: 0.292, capHeight: 0.7 },
  'DM Serif Display': { ascent: 1.036, descent: 0.335, capHeight: 0.66 },
  'Playfair Display': { ascent: 1.082, descent: 0.251, capHeight: 0.708 },
  'IBM Plex Sans': { ascent: 1.025, descent: 0.275, capHeight: 0.698 },
  'Archivo Black': { ascent: 0.878, descent: 0.21, capHeight: 0.688 },
  Georgia: { ascent: 0.917, descent: 0.219, capHeight: 0.692 },
}
/** Fontes fora da biblioteca (coladas do Figma, system-ui): valores típicos de uma sem serifa. */
export const METRICAS_PADRAO: MetricasFonte = { ascent: 0.95, descent: 0.25, capHeight: 0.7 }

export function metricasDaFonte(nome: string): MetricasFonte {
  return METRICAS_FONTES[nome] ?? METRICAS_PADRAO
}

type Fonte = Pick<CamadaTexto, 'fontFamily' | 'fontSize' | 'lineHeight' | 'leadingTrim'>

/**
 * Quanto o corte vertical tira (px) acima da primeira linha e abaixo da última:
 * meia-entrelinha + (ascendente − maiúsculas) em cima; meia-entrelinha + descendente embaixo.
 */
export function corteVertical(c: Fonte): { topo: number; base: number } {
  if (c.leadingTrim !== 'cap') return { topo: 0, base: 0 }
  const m = metricasDaFonte(c.fontFamily)
  const fs = c.fontSize
  const meia = (c.lineHeight * fs - (m.ascent + m.descent) * fs) / 2
  return { topo: arred(meia + (m.ascent - m.capHeight) * fs), base: arred(meia + m.descent * fs) }
}

const arred = (v: number) => Math.round(v * 100) / 100

/**
 * Quanto as letras passam da caixa (px) em cima e embaixo, pelas métricas da fonte: a área de conteúdo
 * (ascendente + descendente) que não cabe na entrelinha — com entrelinha 1,0 na Geist, .15em de cada lado —, mais
 * o que o corte vertical tirou. Usado para exportar a camada de texto sem cortar acentos e descendentes.
 */
export function tintaAlemDaCaixa(c: Fonte): { topo: number; base: number } {
  const m = metricasDaFonte(c.fontFamily)
  const extra = Math.max(0, ((m.ascent + m.descent) * c.fontSize - c.lineHeight * c.fontSize) / 2)
  const k = corteVertical(c)
  return { topo: arred(k.topo + extra), base: arred(k.base + extra) }
}

/**
 * Folga (px) para a tinta das letras passar da caixa onde algo PRECISA recortar o texto (animações que revelam,
 * área de edição): com entrelinha 1,0 a tinta passa ~.15em da linha (ascendente + descendente ≈ 1,3em) e os
 * acentos das maiúsculas um pouco mais; .35em cobre as fontes da biblioteca até entrelinha ~0,8.
 */
export function folgaTinta(c: Pick<CamadaTexto, 'fontSize'>): number {
  return Math.ceil(c.fontSize * 0.35)
}

/** Parágrafos (linhas separadas por Enter) quando a camada precisa deles; null = texto corrido (o caso comum). */
export function paragrafosDe(c: Pick<CamadaTexto, 'text' | 'listStyle' | 'paragraphSpacing'>): string[] | null {
  const lista = !!c.listStyle && c.listStyle !== 'none'
  if (!lista && !c.paragraphSpacing) return null
  return c.text.split('\n')
}

/** Linhas visíveis com "Truncar texto" (undefined = sem limite). Altura fixa sem máximo: o que couber na caixa. */
export function linhasVisiveis(c: Pick<CamadaTexto, 'truncate' | 'maxLines' | 'sizingH' | 'height' | 'padding' | 'fontSize' | 'lineHeight' | 'fontFamily' | 'leadingTrim'>): number | undefined {
  if (!c.truncate) return undefined
  if (c.maxLines) return c.maxLines
  if (c.sizingH === 'hug') return undefined
  const corte = corteVertical(c)
  const disponivel = c.height - 2 * c.padding + corte.topo + corte.base
  return Math.max(1, Math.floor((disponivel + 0.5) / (c.lineHeight * c.fontSize)))
}

/** Recuo do texto numa lista (o marcador fica pendurado à esquerda). */
export function recuoLista(c: Pick<CamadaTexto, 'listStyle' | 'text'>): string | undefined {
  if (c.listStyle === 'bullet') return '1.25em'
  if (c.listStyle === 'number') {
    const n = c.text.split('\n').length
    return `${(0.6 * String(n).length + 0.85).toFixed(2)}em`
  }
  return undefined
}

/** Sublinhado/tachado com estilo, espessura, deslocamento, pular descendentes e cor. */
export function decoracaoCss(c: Pick<CamadaTexto, 'underline' | 'strikethrough' | 'decorationStyle' | 'decorationThickness' | 'decorationOffset' | 'decorationSkipInk' | 'decorationColor'>): CSSProperties {
  const linha = [c.underline ? 'underline' : '', c.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ')
  if (!linha) return {}
  return {
    textDecorationLine: linha,
    textDecorationStyle: c.decorationStyle && c.decorationStyle !== 'solid' ? c.decorationStyle : undefined,
    textDecorationThickness: c.decorationThickness !== undefined ? c.decorationThickness : undefined,
    textUnderlineOffset: c.underline && c.decorationOffset !== undefined ? c.decorationOffset : undefined,
    textDecorationSkipInk: c.decorationSkipInk === false ? 'none' : undefined,
    textDecorationColor: c.decorationColor,
  }
}

/** Caixa: transformação do texto ou versalete. */
export function caixaCss(t: CamadaTexto['transform']): CSSProperties {
  switch (t) {
    case 'uppercase':
    case 'lowercase':
    case 'capitalize':
      return { textTransform: t }
    case 'smallCaps':
      return { fontVariantCaps: 'small-caps' }
    case 'allSmallCaps':
      return { fontVariantCaps: 'all-small-caps' }
    default:
      return {}
  }
}

/**
 * Estilo da caixa do texto (sem tamanho, cor, fundo e efeitos, que o renderizador põe por cima).
 * `hug` = largura automática: não quebra linha.
 */
export function estiloCaixaTexto(c: CamadaTexto): CSSProperties {
  const hug = c.sizingW === 'hug'
  const trunca = linhasVisiveis(c) !== undefined
  return {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: c.valign === 'middle' ? 'center' : c.valign === 'bottom' ? 'flex-end' : 'flex-start',
    padding: c.padding,
    // as letras podem passar da caixa (acentos em cima, descendentes embaixo, itálico de lado), como no Figma:
    // com entrelinha justa (≤ 1,2) a tinta da fonte é maior que a linha. Só "Truncar texto" corta.
    overflow: trunca ? 'hidden' : 'visible',
    fontFamily: pilhaFonte(c.fontFamily),
    fontWeight: c.fontWeight,
    fontStyle: c.italic ? 'italic' : undefined,
    ...decoracaoCss(c),
    ...caixaCss(c.transform),
    fontVariantNumeric: c.tabularNums ? 'tabular-nums' : undefined,
    fontVariantLigatures: c.ligatures === false ? 'none' : undefined,
    textAlign: c.align,
    lineHeight: c.lineHeight,
    // largura automática (hug) não quebra linha; senão quebra na largura da caixa
    whiteSpace: hug ? 'pre' : 'pre-wrap',
    wordBreak: 'break-word',
    // depois de white-space: o atalho text-wrap também define o modo de quebra (aqui sempre "quebra")
    ...(!hug && c.textWrap && c.textWrap !== 'auto' ? ({ textWrap: c.textWrap } as CSSProperties) : {}),
  }
}

export interface CorpoTexto {
  estilo: CSSProperties
  classe?: string
  paragrafos: string[] | null
  /** Estilo do parágrafo `i` (lista: item com marcador; espaço entre parágrafos). */
  paragrafo: (i: number, texto: string) => CSSProperties
}

/** Elemento com o texto: corte vertical, truncar com reticências e recuo de lista. */
export function corpoTexto(c: CamadaTexto): CorpoTexto {
  const estilo: CSSProperties = {}
  const corte = corteVertical(c)
  const linhas = linhasVisiveis(c)
  const paragrafos = paragrafosDe(c)
  const lista = c.listStyle === 'bullet' || c.listStyle === 'number' ? c.listStyle : null
  if (c.leadingTrim === 'cap') Object.assign(estilo, { '--corte-topo': `${corte.topo}px`, '--corte-base': `${corte.base}px` })
  if (linhas !== undefined) Object.assign(estilo, { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: linhas, overflow: 'hidden' })
  if (lista) Object.assign(estilo, { paddingLeft: recuoLista(c), counterReset: 'list-item' })
  return {
    estilo,
    classe: c.leadingTrim === 'cap' ? 'texto-corte' : undefined,
    paragrafos,
    paragrafo: (i, texto) => ({
      display: lista && texto.trim() ? 'list-item' : 'block',
      listStyleType: lista ? (lista === 'bullet' ? 'disc' : 'decimal') : undefined,
      marginTop: i > 0 && c.paragraphSpacing ? c.paragraphSpacing : undefined,
    }),
  }
}

/** Parágrafo vazio ainda ocupa uma linha. */
export const LINHA_VAZIA = '​'

/** Algum recurso do painel "Opções de texto" ligado (para o botão do inspetor mostrar que há algo ativo). */
export function temOpcoesDeTexto(c: CamadaTexto): boolean {
  return !!(c.strikethrough || c.leadingTrim === 'cap' || (c.listStyle && c.listStyle !== 'none') || c.paragraphSpacing || c.truncate || (c.textWrap && c.textWrap !== 'auto') || c.tabularNums || c.ligatures === false || c.decorationStyle || c.decorationThickness !== undefined || c.decorationOffset !== undefined || c.decorationSkipInk === false || c.decorationColor || c.transform === 'capitalize' || c.transform === 'smallCaps' || c.transform === 'allSmallCaps')
}

// ---------- aplicar no DOM (medidor do editor) ----------

const SEM_UNIDADE = new Set(['lineHeight', 'fontWeight', 'WebkitLineClamp', 'flexGrow', 'flexShrink', 'opacity', 'zIndex'])
/** camelCase do React → propriedade CSS ("WebkitLineClamp" → "-webkit-line-clamp"). */
export const kebab = (k: string) => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))

/** Aplica um objeto de estilo do React num elemento (números viram px, como no React). */
export function aplicarEstilo(el: HTMLElement, estilo: CSSProperties): void {
  for (const [k, v] of Object.entries(estilo)) {
    if (v === undefined || v === null || v === '') continue
    el.style.setProperty(kebab(k), typeof v === 'number' && !SEM_UNIDADE.has(k) ? `${v}px` : String(v))
  }
}

/** Objeto de estilo do React → texto CSS para o atributo `style` (números viram px, como no React). */
export function estiloParaCss(estilo: CSSProperties): string {
  const partes: string[] = []
  for (const [k, v] of Object.entries(estilo)) {
    if (v === undefined || v === null || v === '') continue
    partes.push(`${kebab(k)}:${typeof v === 'number' && !SEM_UNIDADE.has(k) ? `${v}px` : String(v)}`)
  }
  return partes.join(';')
}

/** Monta o corpo do texto no DOM (filhos do medidor), igual ao que o renderizador desenha. */
export function montarCorpo(doc: Document, c: CamadaTexto): HTMLElement {
  const t = corpoTexto(c)
  const corpo = doc.createElement('span')
  if (t.classe) corpo.className = t.classe
  aplicarEstilo(corpo, { display: 'block', ...t.estilo })
  if (t.paragrafos) {
    t.paragrafos.forEach((p, i) => {
      const el = doc.createElement('span')
      el.dataset.paragrafo = String(i)
      aplicarEstilo(el, t.paragrafo(i, p))
      el.textContent = p || LINHA_VAZIA
      corpo.appendChild(el)
    })
  } else {
    // linha vazia (ou terminada em \n) ainda ocupa uma linha
    corpo.textContent = !c.text ? LINHA_VAZIA : c.text.endsWith('\n') ? `${c.text}${LINHA_VAZIA}` : c.text
  }
  return corpo
}
