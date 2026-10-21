/**
 * Texto de um PDF → texto estruturado (Markdown leve) para a IA montar a apresentação.
 * Recebe os trechos de texto de cada página já em coordenadas da página (origem no canto superior esquerdo, y na
 * linha de base) e reconstrói linhas, ordem de leitura (inclusive duas colunas), títulos (pelo tamanho da fonte),
 * listas, tabelas simples e parágrafos; tira cabeçalhos/rodapés repetidos e números de página. Números e
 * pontuação são mantidos como estão. Puro: sem DOM, sem pdf.js (quem lê o PDF é `lib/pdf/ler.ts`; as páginas
 * escaneadas chegam do OCR do navegador, `lib/pdf/ocr.ts`, no mesmo formato).
 */

/** Um trecho de texto posicionado (unidades da página, em pontos). `y` = linha de base, medida do topo. */
export interface ItemPdf { texto: string; x: number; y: number; largura: number; tamanho: number }
export interface PaginaPdf {
  numero: number
  largura: number
  altura: number
  itens: ItemPdf[]
  /** Texto reconhecido na imagem da página (OCR), não lido do PDF: o tamanho da fonte é estimado, então o corpo do texto é medido à parte. */
  ocr?: boolean
}

export interface Segmento { texto: string; x: number; xFim: number }
export interface Linha { y: number; x: number; xFim: number; tamanho: number; segmentos: Segmento[]; texto: string }

export interface ResultadoTexto {
  paginas: number
  /** Texto estruturado de todas as páginas, na ordem. */
  texto: string
  /** Texto de cada página (sem o que foi tirado como cabeçalho/rodapé). */
  porPagina: string[]
  caracteres: number
  titulos: number
  itensLista: number
  tabelas: number
  /** Páginas (1…n) praticamente sem texto extraível: escaneadas, só imagem ou em branco. */
  paginasSemTexto: number[]
}

/** Abaixo disto (caracteres visíveis) a página conta como "sem texto". */
export const MIN_CARACTERES_PAGINA = 25

const LIGADURAS: Record<string, string> = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' }
/** Normaliza um trecho: ligaduras, hífen discricionário, espaços especiais, caracteres de controle. */
export function limparTrecho(s: string): string {
  return s
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGADURAS[c] ?? c)
    .replace(/­/g, '')
    .replace(/[  -   　]/g, ' ')
    .replace(/[​-‍⁠﻿]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
}

const RE_MARCADOR = /^\s*(?:[•●▪◦■□▫◆◇➢➤►▶‣⁃∙·*]|[-–—](?=\s))\s*/
const RE_NUMERADO = /^\s*(\d{1,3}|[a-zA-Z])[.)]\s+(?=\S)/
const RE_NUMERO_PAGINA = /^\s*(?:p(?:á|a)g(?:ina)?\.?\s*|page\s*)?\d{1,4}(?:\s*(?:de|of|\/)\s*\d{1,4})?\s*$/i
const ehSoMarcador = (s: string) => /^\s*[•●▪◦■□▫◆◇➢➤►▶‣⁃∙·*–—-]\s*$/.test(s)

/** Agrupa os trechos de uma página em linhas (mesma linha de base) e cada linha em segmentos (separados por vãos largos). */
export function linhasDaPagina(itens: ItemPdf[]): Linha[] {
  const validos = itens
    .map((i) => ({ ...i, texto: limparTrecho(i.texto) }))
    .filter((i) => i.texto.trim() && i.tamanho > 0 && Number.isFinite(i.x) && Number.isFinite(i.y))
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const grupos: (typeof validos)[] = []
  for (const it of validos) {
    const g = grupos[grupos.length - 1]
    const ref = g?.[0]
    if (g && ref && Math.abs(it.y - ref.y) <= 0.45 * Math.max(Math.min(it.tamanho, ref.tamanho), 1)) g.push(it)
    else grupos.push([it])
  }
  return grupos.map((g) => {
    g.sort((a, b) => a.x - b.x)
    const tamanho = Math.max(...g.map((i) => i.tamanho))
    const segmentos: Segmento[] = []
    let atual: Segmento | null = null
    let soMarcador = false
    for (const it of g) {
      const vao = atual ? it.x - atual.xFim : 0
      if (atual && (vao <= 1.6 * tamanho || soMarcador)) {
        const precisaEspaco = vao > 0.12 * tamanho && !/\s$/.test(atual.texto) && !/^\s/.test(it.texto)
        atual.texto += (precisaEspaco || (soMarcador && !/\s$/.test(atual.texto)) ? ' ' : '') + it.texto
        atual.xFim = Math.max(atual.xFim, it.x + it.largura)
      } else {
        atual = { texto: it.texto, x: it.x, xFim: it.x + it.largura }
        segmentos.push(atual)
      }
      soMarcador = ehSoMarcador(atual.texto)
    }
    for (const s of segmentos) s.texto = s.texto.replace(/\s+/g, ' ').trim()
    const limpos = segmentos.filter((s) => s.texto)
    return { y: g[0]!.y, x: limpos[0]?.x ?? 0, xFim: Math.max(...limpos.map((s) => s.xFim)), tamanho, segmentos: limpos, texto: limpos.map((s) => s.texto).join(' ') }
  }).filter((l) => l.segmentos.length)
}

/**
 * Ordem de leitura: em página de duas colunas (muitas linhas com dois segmentos longos separados pelo mesmo vão),
 * lê a coluna da esquerda e depois a da direita, região por região (títulos de largura inteira separam as regiões).
 */
export function ordemDeLeitura(linhas: Linha[], largura: number): Linha[] {
  const duplas = linhas.filter((l) => l.segmentos.length === 2 && l.segmentos.every((s) => s.texto.length >= 18))
  if (duplas.length < 6 || duplas.length < 0.35 * linhas.length) return linhas
  const inicios = duplas.map((l) => l.segmentos[1]!.x).sort((a, b) => a - b)
  const calha = inicios[Math.floor(inicios.length / 2)]!
  if (calha < 0.3 * largura || calha > 0.72 * largura) return linhas
  const tol = 0.02 * largura
  const saida: Linha[] = []
  let esquerda: Linha[] = []
  let direita: Linha[] = []
  const fechar = () => { saida.push(...esquerda, ...direita); esquerda = []; direita = [] }
  const parte = (l: Linha, segs: Segmento[]): Linha => ({ ...l, segmentos: segs, x: segs[0]!.x, xFim: Math.max(...segs.map((s) => s.xFim)), texto: segs.map((s) => s.texto).join(' ') })
  for (const l of linhas) {
    const atravessa = l.segmentos.some((s) => s.x < calha - tol && s.xFim > calha + tol)
    if (atravessa) { fechar(); saida.push(l); continue }
    const esq = l.segmentos.filter((s) => s.xFim <= calha + tol)
    const dir = l.segmentos.filter((s) => s.xFim > calha + tol)
    if (esq.length) esquerda.push(parte(l, esq))
    if (dir.length) direita.push(parte(l, dir))
  }
  fechar()
  return saida
}

const chaveRepeticao = (s: string) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()
const naMargem = (l: Linha, altura: number) => l.y < 0.08 * altura || l.y > 0.92 * altura

/** Tamanho de fonte do corpo do texto: mediana ponderada pelo número de caracteres. */
export function tamanhoDoCorpo(linhas: Linha[]): number {
  const pares = linhas.map((l) => [Math.round(l.tamanho * 2) / 2, l.texto.length] as const).sort((a, b) => a[0] - b[0])
  const total = pares.reduce((s, p) => s + p[1], 0)
  let acc = 0
  for (const [t, n] of pares) { acc += n; if (acc >= total / 2) return t }
  return pares[pares.length - 1]?.[0] ?? 10
}

type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; texto: string; tamanho: number; y: number }
  | { tipo: 'item'; texto: string; x: number; xTexto: number; tamanho: number; y: number }
  | { tipo: 'tabela'; linhas: string[][] }
  | { tipo: 'paragrafo'; texto: string; x: number; xLinha: number; tamanho: number; y: number }

const juntarLinhas = (a: string, b: string) => (/[a-zà-öø-ÿ]-$/i.test(a) && /^[a-zà-öø-ÿ]/.test(b) ? a.slice(0, -1) + b : `${a} ${b}`)
const caixaAlta = (s: string) => { const letras = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, ''); return letras.length >= 4 && letras === letras.toUpperCase() && s.length <= 70 }

/** Linhas consecutivas com 2+ segmentos alinhados viram tabela. */
function tabelaEm(linhas: Linha[], i: number, corpo: number): { fim: number; celulas: string[][] } | null {
  let j = i
  while (j < linhas.length && linhas[j]!.segmentos.length >= 2 && (j === i || linhas[j]!.y - linhas[j - 1]!.y <= 2.6 * Math.max(corpo, linhas[j]!.tamanho))) j++
  if (j - i < 2) return null
  const grupo = linhas.slice(i, j)
  const base = grupo.reduce((m, l) => (l.segmentos.length > m.segmentos.length ? l : m), grupo[0]!)
  const ancoras = base.segmentos.map((s) => s.x)
  const celulas = grupo.map((l) => {
    const linha = ancoras.map(() => '')
    for (const s of l.segmentos) {
      let k = 0
      for (let a = 1; a < ancoras.length; a++) if (Math.abs(ancoras[a]! - s.x) < Math.abs(ancoras[k]! - s.x)) k = a
      linha[k] = linha[k] ? `${linha[k]} ${s.texto}` : s.texto
    }
    return linha
  })
  return { fim: j, celulas }
}

function blocosDe(linhas: Linha[], corpo: number): Bloco[] {
  const blocos: Bloco[] = []
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]!
    const tab = l.segmentos.length >= 2 ? tabelaEm(linhas, i, corpo) : null
    if (tab) { blocos.push({ tipo: 'tabela', linhas: tab.celulas }); i = tab.fim - 1; continue }
    const ant = blocos[blocos.length - 1]
    const proxima = (b: { y: number; tamanho: number }) => l.y - b.y <= 1.75 * Math.max(b.tamanho, l.tamanho) && l.y > b.y
    const razao = l.tamanho / corpo
    if ((razao >= 1.18 && l.texto.length <= 160) || (caixaAlta(l.texto) && razao >= 0.95)) {
      const nivel = razao >= 1.75 ? 1 : razao >= 1.4 ? 2 : 3
      if (ant?.tipo === 'titulo' && ant.nivel === nivel && Math.abs(ant.tamanho - l.tamanho) < 0.5 && proxima(ant)) { ant.texto = `${ant.texto} ${l.texto}`; ant.y = l.y }
      else blocos.push({ tipo: 'titulo', nivel, texto: l.texto, tamanho: l.tamanho, y: l.y })
      continue
    }
    const marcador = RE_MARCADOR.exec(l.texto)
    const numerado = !marcador && RE_NUMERADO.exec(l.texto)
    if (marcador || numerado) {
      const texto = marcador ? l.texto.slice(marcador[0].length) : l.texto
      if (texto.trim()) {
        const recuo = l.segmentos[0]!.x + (marcador ? Math.min(2 * l.tamanho, Math.max(0, l.xFim - l.x) * 0.1) : 0)
        blocos.push({ tipo: 'item', texto: marcador ? `- ${texto.trim()}` : texto.trim(), x: l.x, xTexto: recuo, tamanho: l.tamanho, y: l.y })
        continue
      }
    }
    // continuação de item de lista (linha recuada logo abaixo) ou de parágrafo
    if (ant?.tipo === 'item' && proxima(ant) && l.x > ant.x + 0.5 * l.tamanho) { ant.texto = juntarLinhas(ant.texto, l.texto); ant.y = l.y; continue }
    // recuo de primeira linha depois de um ponto final abre parágrafo novo
    const recuoNovo = /[.!?:]$/.test(ant?.tipo === 'paragrafo' ? ant.texto : '') && ant?.tipo === 'paragrafo' && l.x > ant.xLinha + 0.8 * l.tamanho
    if (ant?.tipo === 'paragrafo' && proxima(ant) && !recuoNovo && Math.abs(ant.tamanho - l.tamanho) <= 0.15 * ant.tamanho && l.x <= ant.xLinha + 3 * l.tamanho) {
      ant.texto = juntarLinhas(ant.texto, l.texto); ant.y = l.y; ant.xLinha = l.x; continue
    }
    blocos.push({ tipo: 'paragrafo', texto: l.texto, x: l.x, xLinha: l.x, tamanho: l.tamanho, y: l.y })
  }
  return blocos
}

const celula = (s: string) => s.replace(/\|/g, '/').trim()
function markdown(blocos: Bloco[]): string {
  const partes: string[] = []
  let lista: string[] = []
  const fecharLista = () => { if (lista.length) partes.push(lista.join('\n')); lista = [] }
  for (const b of blocos) {
    if (b.tipo === 'item') { lista.push(b.texto); continue }
    fecharLista()
    if (b.tipo === 'titulo') partes.push(`${'#'.repeat(b.nivel)} ${b.texto}`)
    else if (b.tipo === 'paragrafo') partes.push(b.texto)
    else {
      const [cab, ...resto] = b.linhas
      partes.push([`| ${cab!.map(celula).join(' | ')} |`, `|${cab!.map(() => ' --- ').join('|')}|`, ...resto.map((r) => `| ${r.map(celula).join(' | ')} |`)].join('\n'))
    }
  }
  fecharLista()
  return partes.join('\n\n')
}

/** Lê todas as páginas e devolve o texto estruturado, com as estatísticas mostradas ao usuário. */
export function estruturarPdf(paginas: PaginaPdf[]): ResultadoTexto {
  const linhasPorPagina = paginas.map((p) => linhasDaPagina(p.itens))
  // cabeçalhos e rodapés: mesma linha (números trocados por #) na margem de metade das páginas ou mais
  const contagem = new Map<string, number>()
  linhasPorPagina.forEach((ls, k) => {
    const vistas = new Set(ls.filter((l) => naMargem(l, paginas[k]!.altura)).map((l) => chaveRepeticao(l.texto)))
    for (const c of vistas) contagem.set(c, (contagem.get(c) ?? 0) + 1)
  })
  const minimo = Math.max(2, Math.ceil(paginas.length / 2))
  const filtradas = linhasPorPagina.map((ls, k) =>
    ls.filter((l) => !(naMargem(l, paginas[k]!.altura) && (RE_NUMERO_PAGINA.test(l.texto) || (paginas.length >= 2 && (contagem.get(chaveRepeticao(l.texto)) ?? 0) >= minimo))))
  )
  // corpo do texto medido à parte nas páginas de OCR (tamanho estimado pela altura da linha na imagem)
  const corpoDe = (ocr: boolean) => tamanhoDoCorpo(filtradas.filter((_, k) => !!paginas[k]!.ocr === ocr).flat())
  const corpos = { pdf: corpoDe(false), ocr: corpoDe(true) }
  let titulos = 0
  let itensLista = 0
  let tabelas = 0
  const blocosPorPagina = filtradas.map((ls, k) => {
    const b = blocosDe(ordemDeLeitura(ls, paginas[k]!.largura), paginas[k]!.ocr ? corpos.ocr : corpos.pdf)
    for (const x of b) { if (x.tipo === 'titulo') titulos++; else if (x.tipo === 'item') itensLista++; else if (x.tipo === 'tabela') tabelas++ }
    return b
  })
  // parágrafo que continua na página seguinte (sem ponto final, próxima começa em minúscula)
  for (let k = 0; k + 1 < blocosPorPagina.length; k++) {
    const fim = blocosPorPagina[k]![blocosPorPagina[k]!.length - 1]
    const inicio = blocosPorPagina[k + 1]![0]
    if (fim?.tipo === 'paragrafo' && inicio?.tipo === 'paragrafo' && !/[.!?:;]$/.test(fim.texto) && /^[a-zà-öø-ÿ]/.test(inicio.texto)) {
      fim.texto = juntarLinhas(fim.texto, inicio.texto)
      blocosPorPagina[k + 1]!.shift()
    }
  }
  const porPagina = blocosPorPagina.map(markdown)
  const texto = porPagina.filter(Boolean).join('\n\n')
  const visiveis = (ls: Linha[]) => ls.reduce((s, l) => s + l.texto.replace(/\s/g, '').length, 0)
  return {
    paginas: paginas.length,
    texto,
    porPagina,
    caracteres: texto.length,
    titulos,
    itensLista,
    tabelas,
    // conta só o conteúdo: página escaneada com cabeçalho/rodapé de texto continua "sem texto"
    paginasSemTexto: filtradas.map((ls, k) => (visiveis(ls) < MIN_CARACTERES_PAGINA ? k + 1 : 0)).filter(Boolean),
  }
}

/** Bloco de texto posicionado (parágrafo, título, item), para virar camada de texto selecionável sobre a página. */
export interface BlocoPosicionado { texto: string; x: number; y: number; largura: number; altura: number; tamanho: number; entrelinha: number }

/**
 * Agrupa as linhas da página em blocos posicionados (linhas próximas, mesmo tamanho e mesma margem esquerda),
 * em coordenadas da página (topo do bloco = linha de base − ascendente). No máximo `max` blocos.
 */
export function blocosPosicionados(itens: ItemPdf[], max = 200): BlocoPosicionado[] {
  const linhas = linhasDaPagina(itens)
  const blocos: (BlocoPosicionado & { ultimaY: number; n: number })[] = []
  for (const l of linhas) {
    const b = blocos[blocos.length - 1]
    const passo = b ? l.y - b.ultimaY : Infinity
    if (b && passo > 0 && passo <= 1.75 * l.tamanho && Math.abs(b.tamanho - l.tamanho) <= 0.15 * b.tamanho && Math.abs(b.x - l.x) <= 2 * l.tamanho) {
      b.texto += `\n${l.texto}`
      b.largura = Math.max(b.x + b.largura, l.xFim) - Math.min(b.x, l.x)
      b.x = Math.min(b.x, l.x)
      b.entrelinha = (b.entrelinha * (b.n - 1) + passo / l.tamanho) / b.n
      b.n++
      b.ultimaY = l.y
      b.altura = l.y - b.y + 0.3 * l.tamanho
    } else {
      blocos.push({ texto: l.texto, x: l.x, y: l.y - 0.85 * l.tamanho, largura: Math.max(1, l.xFim - l.x), altura: 1.15 * l.tamanho, tamanho: l.tamanho, entrelinha: 1.2, ultimaY: l.y, n: 1 })
    }
  }
  const saida = blocos.map(({ ultimaY: _u, n: _n, ...b }) => ({ ...b, entrelinha: Math.min(3, Math.max(0.6, b.entrelinha)) }))
  if (saida.length <= max) return saida
  // muitas caixas (páginas muito densas): junta as excedentes numa só, para não passar do limite de camadas
  const [dentro, fora] = [saida.slice(0, max - 1), saida.slice(max - 1)]
  const x = Math.min(...fora.map((b) => b.x))
  const y = Math.min(...fora.map((b) => b.y))
  return [...dentro, { texto: fora.map((b) => b.texto).join('\n'), x, y, largura: Math.max(...fora.map((b) => b.x + b.largura)) - x, altura: Math.max(...fora.map((b) => b.y + b.altura)) - y, tamanho: fora[0]!.tamanho, entrelinha: 1.2 }]
}
