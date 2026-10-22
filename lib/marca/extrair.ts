/**
 * Leitura do manual da marca SEM IA (grátis): do texto do manual (PDF lido no navegador, com OCR nas páginas
 * escaneadas, ou de imagens) tira
 * - as cores: #hex, "HEX 1F3B4D", RGB, CMYK (convertido em hex) e Pantone, com o rótulo mais próximo
 *   ("Primária", "Azul Aurora", "Fundo escuro") virando o papel da cor;
 * - as fontes: nomes casados com o catálogo do Google (e as comerciais trocadas pela mais parecida, com aviso),
 *   com o nível pelo contexto ("Títulos", "Textos", "Números");
 * - as regras: área de proteção, tamanho mínimo, "não usar", tom de voz, fotos, ícones, grafismos, termos e
 *   densidade, pelas seções do manual e por palavras-chave.
 * Puro: sem rede, sem DOM (o catálogo de fontes chega por parâmetro).
 */
import type { Catalogo } from '@/lib/fontes/catalogo'
import { contraste, luminanciaRelativa, paraHex } from '@/lib/ia/designSystem'
import { distancia, hsl } from '@/lib/ia/marca'
import { fontesNaLinha, type FonteReconhecida } from './fontes'
import { PerfilMarcaSchema, type CorPerfil, type DensidadeMarca, type NivelFonte, type PapelCor, type PerfilMarca } from './perfil'

// ---------------------------------------------------------------- cores

export interface CorEncontrada {
  hex: string
  /** Rótulo do manual ao lado da cor ("Primária", "Azul Aurora"). */
  rotulo: string
  pantone: string
  /** Papel lido do rótulo ou da seção (null = decidir pela cor). */
  papel: PapelCor | null
  /** De onde o hex veio (hex é exato; RGB e CMYK, convertidos). */
  fonte: 'hex' | 'rgb' | 'cmyk'
}

const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
export const cmykParaHex = (c: number, m: number, y: number, k: number) => {
  const [cc, mm, yy, kk] = [c, m, y, k].map((v) => Math.max(0, Math.min(100, v)) / 100) as [number, number, number, number]
  return paraHex(byte(255 * (1 - cc) * (1 - kk)), byte(255 * (1 - mm) * (1 - kk)), byte(255 * (1 - yy) * (1 - kk)))
}

interface Codigo { tipo: 'hex' | 'rgb' | 'cmyk' | 'pantone'; valor: string; inicio: number; fim: number }

const SEP = String.raw`\s*[,;/ ]\s*`
const RE_CODIGOS: [Codigo['tipo'], RegExp, (m: RegExpMatchArray) => string | null][] = [
  ['hex', /#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z])/gi, (m) => { const h = m[1]!; return `#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h}`.toUpperCase() }],
  ['hex', /\b(?:hex|html|web|hexadecimal)\s*[:=]?\s*([0-9a-f]{6})(?![0-9a-z])/gi, (m) => `#${m[1]!}`.toUpperCase()],
  ['rgb', new RegExp(String.raw`\brgba?\s*[:=(]?\s*(\d{1,3})${SEP}(\d{1,3})${SEP}(\d{1,3})`, 'gi'), (m) => ([m[1], m[2], m[3]].every((v) => Number(v) <= 255) ? paraHex(Number(m[1]), Number(m[2]), Number(m[3])) : null)],
  ['rgb', /\bR\s*[:=]?\s*(\d{1,3})\s*[,;/]?\s*G\s*[:=]?\s*(\d{1,3})\s*[,;/]?\s*B\s*[:=]?\s*(\d{1,3})\b/g, (m) => ([m[1], m[2], m[3]].every((v) => Number(v) <= 255) ? paraHex(Number(m[1]), Number(m[2]), Number(m[3])) : null)],
  ['cmyk', new RegExp(String.raw`\bcmyk\s*[:=(]?\s*(\d{1,3})%?${SEP}(\d{1,3})%?${SEP}(\d{1,3})%?${SEP}(\d{1,3})%?`, 'gi'), (m) => ([m[1], m[2], m[3], m[4]].every((v) => Number(v) <= 100) ? cmykParaHex(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])) : null)],
  ['cmyk', /\bC\s*[:=]?\s*(\d{1,3})\s*[,;/]?\s*M\s*[:=]?\s*(\d{1,3})\s*[,;/]?\s*Y\s*[:=]?\s*(\d{1,3})\s*[,;/]?\s*K\s*[:=]?\s*(\d{1,3})\b/g, (m) => ([m[1], m[2], m[3], m[4]].every((v) => Number(v) <= 100) ? cmykParaHex(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])) : null)],
  ['pantone', /\b(?:pantone|pms)\s*[:=]?\s*((?:\d{2,4}|[A-Za-z][A-Za-z-]{2,18})(?:\s?(?:C|U|CP|UP|TCX|TPX|XGC))?)(?![\p{L}\d])/giu, (m) => `Pantone ${m[1]!.trim()}`],
]

function codigosDaLinha(linha: string): Codigo[] {
  const achados: Codigo[] = []
  for (const [tipo, re, valor] of RE_CODIGOS) {
    for (const m of linha.matchAll(re)) {
      const v = valor(m)
      const inicio = m.index ?? 0
      const fim = inicio + m[0].length
      if (!v || achados.some((a) => inicio < a.fim && fim > a.inicio)) continue
      achados.push({ tipo, valor: v, inicio, fim })
    }
  }
  return achados.sort((a, b) => a.inicio - b.inicio)
}

/** Papel pelo rótulo ou pelo título da seção. A ordem importa ("fundo escuro" antes de "fundo"). */
const PAPEIS_POR_PALAVRA: [RegExp, PapelCor][] = [
  [/fundo[s]? escuro|dark background|background dark|cor escura de fundo/, 'fundoEscuro'],
  [/fundo[s]? claro|light background|background light|off[- ]?white/, 'fundoClaro'],
  [/cart[õoã]es?|cards?\b|superf[ií]cie|surface/, 'cartao'],
  [/sucesso|success|positiv|aprovad/, 'positivo'],
  [/\berro\b|error|alerta|negativ|danger|perigo|aten[cç][aã]o/, 'negativo'],
  [/prim[aá]ri[ao]|principal|primary|institucional|cor da marca|brand color|cor-m[aã]e/, 'principal'],
  [/secund[aá]ri[ao]|secondary/, 'secundaria'],
  [/destaque|acento|accent|highlight|complementar/, 'destaque'],
  [/\bapoio\b|suporte|support|terci[aá]ri|auxiliar|neutr/, 'apoio'],
  [/\btextos?\b|\btext\b|foreground|tinta/, 'texto'],
  [/\bfundos?\b|background/, 'fundoClaro'],
  [/escur[oa]|\bdark\b/, 'fundoEscuro'],
]
export function papelDoRotulo(rotulo: string): PapelCor | null {
  const t = rotulo.toLowerCase()
  for (const [re, p] of PAPEIS_POR_PALAVRA) if (re.test(t)) return p
  return null
}

const limparRotulo = (s: string) =>
  s.replace(/^[#>*\-•·|\s]+/, '').replace(/\b(?:hex|html|web|rgb|rgba|cmyk|hexadecimal|pantone|pms|c[oó]digo)\b\s*[:=]?/gi, ' ').replace(/[|:=·•–—]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

/** Linha de título de seção (Markdown do leitor de PDF ou linha curta sem ponto final). */
const ehTitulo = (l: string) => /^#{1,4}\s/.test(l) || (l.length <= 42 && !/[.;,]$/.test(l) && !/\d{2,}/.test(l) && l.split(/\s+/).length <= 6 && /^[\p{Lu}\d]/u.test(l))
const semMarcador = (l: string) => l.replace(/^#{1,4}\s+/, '').replace(/^\s*(?:[-•*·▪︎–]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim()

/**
 * Cores do texto do manual, agrupadas por bloco (o hex, o RGB, o CMYK e o Pantone de uma mesma cor ficam numa
 * cor só) e com o rótulo mais próximo: o texto antes do código na mesma linha (ou na mesma célula de tabela) ou
 * a linha logo acima. Prefere o hex exato ao convertido.
 */
export function coresDoManual(texto: string): CorEncontrada[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim())
  interface Grupo { codigos: Codigo[]; rotulo: string; ultima: number; secao: string }
  const grupos: Grupo[] = []
  let atual: Grupo | null = null
  let rotuloPendente = ''
  let linhaRotulo = -10
  let secao = ''
  linhas.forEach((linhaBruta, i) => {
    if (!linhaBruta) { if (atual && i - atual.ultima > 1) atual = null; return }
    const tabela = linhaBruta.startsWith('|')
    if (tabela && /^\|[\s:|-]+\|?$/.test(linhaBruta)) return
    const celulas = tabela ? linhaBruta.split('|').map((c) => c.trim()).filter(Boolean) : [linhaBruta]
    const codigos = celulas.flatMap((c) => codigosDaLinha(c).map((x) => ({ ...x, celula: c })))
    if (!codigos.length) {
      const l = semMarcador(linhaBruta)
      if (ehTitulo(linhaBruta) && /cor|paleta|palette|colou?r/i.test(l) && l.split(/\s+/).length <= 5) secao = l
      if (l.length <= 60) { rotuloPendente = l; linhaRotulo = i }
      atual = null
      return
    }
    if (tabela) {
      // uma linha de tabela = uma cor; o rótulo vem das células sem código
      const rotulo = limparRotulo(celulas.filter((c) => !codigosDaLinha(c).length).join(' '))
      grupos.push({ codigos, rotulo, ultima: i, secao })
      atual = null
      return
    }
    let fimAnterior = 0
    for (const c of codigos) {
      const antes = limparRotulo(linhaBruta.slice(fimAnterior, c.inicio))
      fimAnterior = c.fim
      const repetido = !!atual && atual.codigos.some((x) => x.tipo === c.tipo)
      if (!atual || repetido || i - atual.ultima > 2 || (antes && antes.length > 2 && c.tipo === 'hex' && atual.codigos.some((x) => x.tipo !== 'pantone'))) {
        const rotulo = antes && antes.length > 1 ? antes : i - linhaRotulo <= 2 ? rotuloPendente : ''
        atual = { codigos: [], rotulo, ultima: i, secao }
        grupos.push(atual)
        rotuloPendente = ''
      }
      atual.codigos.push(c)
      atual.ultima = i
    }
  })
  const saida: CorEncontrada[] = []
  for (const g of grupos) {
    const melhor = g.codigos.find((c) => c.tipo === 'hex') ?? g.codigos.find((c) => c.tipo === 'rgb') ?? g.codigos.find((c) => c.tipo === 'cmyk')
    if (!melhor) continue
    const hex = melhor.valor
    const pantone = g.codigos.find((c) => c.tipo === 'pantone')?.valor ?? ''
    const papel = papelDoRotulo(g.rotulo) ?? papelDoRotulo(g.secao)
    const igual = saida.find((s) => distancia(s.hex, hex) < 14)
    if (igual) { if (!igual.papel && papel) igual.papel = papel; if (!igual.pantone && pantone) igual.pantone = pantone; continue }
    saida.push({ hex, rotulo: g.rotulo, pantone, papel, fonte: melhor.tipo as CorEncontrada['fonte'] })
  }
  return saida.slice(0, 12)
}

/**
 * Papéis finais da paleta: os lidos do manual ficam; papéis únicos repetidos viram apoio; o resto é decidido
 * pela cor (a mais saturada vira a principal, a bem escura o fundo escuro, a bem clara o fundo claro).
 */
export function atribuirPapeis(cores: { hex: string; papel: PapelCor | null; nome: string }[]): CorPerfil[] {
  const unicos: PapelCor[] = ['principal', 'fundoEscuro', 'fundoClaro', 'cartao', 'texto', 'positivo', 'negativo']
  const usados = new Set<PapelCor>()
  const saida: (CorPerfil & { livre?: boolean })[] = cores.map((c) => {
    let papel = c.papel
    if (papel && unicos.includes(papel)) { if (usados.has(papel)) papel = 'apoio'; else usados.add(papel) }
    return { hex: c.hex.toUpperCase(), papel: papel ?? 'apoio', nome: c.nome, livre: !papel }
  })
  const livres = saida.filter((c) => c.livre)
  const nota = (hex: string) => hsl(hex).s * 2 + Math.min(contraste(hex, '#FFFFFF'), contraste(hex, '#000000')) / 10
  if (!usados.has('principal')) {
    const candidata = [...(livres.length ? livres : saida.filter((c) => c.papel === 'secundaria' || c.papel === 'destaque' || c.papel === 'apoio'))]
      .filter((c) => luminanciaRelativa(c.hex) > 0.03 && luminanciaRelativa(c.hex) < 0.85)
      .sort((a, b) => nota(b.hex) - nota(a.hex))[0]
    if (candidata) { candidata.papel = 'principal'; candidata.livre = false; usados.add('principal') }
  }
  for (const c of saida.filter((x) => x.livre)) {
    const l = luminanciaRelativa(c.hex)
    if (l < 0.04 && !usados.has('fundoEscuro')) { c.papel = 'fundoEscuro'; usados.add('fundoEscuro') }
    else if (l > 0.85 && !usados.has('fundoClaro')) { c.papel = 'fundoClaro'; usados.add('fundoClaro') }
    else if (!saida.some((x) => x.papel === 'secundaria')) c.papel = 'secundaria'
    else if (!saida.some((x) => x.papel === 'destaque')) c.papel = 'destaque'
    else c.papel = 'apoio'
    c.livre = false
  }
  return saida.map(({ livre: _l, ...c }) => c)
}

// ---------------------------------------------------------------- fontes

const RE_CONTEXTO_FONTE = /tipograf|\bfontes?\b|\bfonts?\b|typeface|fam[ií]lia tipogr|\bletras?\b|typography/i
const NIVEL_POR_PALAVRA: [RegExp, NivelFonte][] = [
  [/n[uú]meros?|\bdados\b|algarism|numera|figuras? num|\bkpis?\b|tabelas?|numbers?|figures/i, 'numeros'],
  [/t[ií]tulos?|headlines?|headings?|chamadas?|display|manchete|destaques?/i, 'titulos'],
  [/textos?|corpo|body|par[aá]grafo|leitura|copy|apoio|secund[aá]ri|complementar/i, 'textos'],
  [/prim[aá]ri|principal|institucional|primary/i, 'titulos'],
]
const nivelDe = (t: string): NivelFonte | null => NIVEL_POR_PALAVRA.find(([re]) => re.test(t))?.[1] ?? null
/** O nível citado mais perto do fim do trecho ("Títulos: Montserrat · Textos: |Lato" → textos). */
function nivelProximo(t: string): NivelFonte | null {
  let melhor: { i: number; n: NivelFonte } | null = null
  for (const [re, n] of NIVEL_POR_PALAVRA) {
    for (const m of t.matchAll(new RegExp(re.source, 'gi'))) if (!melhor || (m.index ?? 0) > melhor.i) melhor = { i: m.index ?? 0, n }
  }
  return melhor?.n ?? null
}

export interface FontesEncontradas { titulos: FonteReconhecida | null; textos: FonteReconhecida | null; numeros: FonteReconhecida | null; outras: FonteReconhecida[] }

/**
 * Fontes do manual: procura nomes de fonte só nas linhas que falam de tipografia (a seção "Tipografia" inteira e
 * as linhas com "fonte", "typeface"…), para não confundir palavras comuns com famílias do Google. O nível vem da
 * própria linha ou das duas de cima; sem pista, a 1ª fonte vai para os títulos e a 2ª para os textos.
 */
export function fontesDoManual(texto: string, cat: Catalogo): FontesEncontradas {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim())
  const achadas: { f: FonteReconhecida; nivel: NivelFonte | null }[] = []
  let naSecao = false
  linhas.forEach((l, i) => {
    if (!l) return
    const limpa = semMarcador(l)
    // título de seção (Markdown ou linha de até 3 palavras): "Tipografia" abre; "Títulos"/"Números" dentro dela não fecham
    if (/^#{1,4}\s/.test(l) || (ehTitulo(l) && limpa.split(/\s+/).length <= 3)) naSecao = RE_CONTEXTO_FONTE.test(limpa) || (naSecao && !!nivelDe(limpa) && limpa.split(/\s+/).length <= 3)
    if (!naSecao && !RE_CONTEXTO_FONTE.test(limpa)) return
    const fontes = fontesNaLinha(cat, limpa, true)
    if (!fontes.length) return
    const contexto = [linhas[i - 2] ?? '', linhas[i - 1] ?? ''].join(' ')
    for (const f of fontes) {
      // o nível mais perto do nome: o trecho da linha antes dele, a linha inteira, as linhas acima
      const pos = limpa.indexOf(f.original.split(' ')[0]!)
      const nivel = nivelProximo(limpa.slice(Math.max(0, pos - 40), pos)) ?? (fontes.length === 1 ? nivelDe(limpa) : null) ?? (fontes.length === 1 ? nivelProximo(contexto) : null)
      if (!achadas.some((a) => a.f.familia === f.familia && a.nivel === nivel)) achadas.push({ f, nivel })
    }
  })
  const r: FontesEncontradas = { titulos: null, textos: null, numeros: null, outras: [] }
  for (const a of achadas) if (a.nivel && !r[a.nivel]) r[a.nivel] = a.f
  for (const a of achadas) {
    if ([r.titulos, r.textos, r.numeros].some((x) => x?.familia === a.f.familia)) continue
    if (!r.titulos) r.titulos = a.f
    else if (!r.textos) r.textos = a.f
    else if (!r.outras.some((x) => x.familia === a.f.familia)) r.outras.push(a.f)
  }
  return r
}

// ---------------------------------------------------------------- regras

type Categoria = 'logo' | 'tom' | 'imagens' | 'icones' | 'grafismos' | 'naoFaz' | 'faz' | 'cores' | 'tipografia' | null

const SECOES: [RegExp, Categoria][] = [
  [/usos? (?:incorret|indevid|proibid)|o que n[aã]o fazer|n[aã]o fa[cç]a|don'?ts?\b|proibi/i, 'naoFaz'],
  [/tom de voz|voz da marca|nossa voz|personalidade|tone of voice|linguagem|comunica[cç][aã]o verbal|como falamos/i, 'tom'],
  [/fotografi|imagens?|photo|ilustra/i, 'imagens'],
  [/[ií]cones?|iconografia|icons?/i, 'icones'],
  [/grafismos?|padr(?:ão|ões|oes)|patterns?|elementos? gr[aá]ficos?|texturas?|formas gr[aá]ficas/i, 'grafismos'],
  [/\blogo|logotipo|logomarca|assinatura visual|s[ií]mbolo|marca gr[aá]fica/i, 'logo'],
  [/\bcores?\b|paleta|palette|colou?rs?/i, 'cores'],
  [/tipograf|typograph|\bfontes?\b/i, 'tipografia'],
  [/boas pr[aá]ticas|fa[cç]a\b|do'?s\b|recomenda/i, 'faz'],
]
const RE_NEGATIVA = /^(?:n[aã]o\b|nunca\b|evite|evitar|jamais|proibido|é proibido|sem\b|don'?t|never|avoid|do not)|\b(?:n[aã]o (?:use|usar|deve|distor|aplique|altere|mude|coloque|gire|estique)|nunca\b|evite|jamais|proibid[oa])/i
const RE_POSITIVA = /^(?:use|usar|utilize|sempre|prefira|priorize|mantenha|aplique|respeite|deixe|garanta|do\b|always)/i
const RE_PROTECAO = /[áa]rea de (?:prote[cç][aã]o|respiro|seguran[cç]a|n[aã]o interfer[eê]ncia)|clear ?space|zona de exclus[aã]o|espa[cç]o de respiro/i
const RE_MINIMO = /tamanho m[ií]nimo|redu[cç][aã]o m[ií]nima|minimum size|menor tamanho|largura m[ií]nima|m[ií]nimo de \d/i
const RE_TOM = /tom de voz|voz da marca|nossa voz|falamos|tone of voice|\bsomos\b|linguagem|escrevemos|nosso jeito de/i
const RE_IMAGEM = /fotografi|\bfotos?\b|imagens?|ilustra[cç]/i
const RE_ICONE = /[ií]cones?|iconografia/i
const RE_GRAFISMO = /grafismos?|padr(?:ão|ões|oes) gr[aá]fic|patterns?|elementos? gr[aá]ficos?|texturas?|formas gr[aá]ficas|linhas finas|degrad[eê]|gradiente/i
const RE_ASPAS = /[“"«]([^”"»]{2,40})[”"»]/g

const frase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/^[-–—:]\s*/, '').slice(0, 240)

export interface RegrasEncontradas {
  tom: string[]
  termos: { usar: string[]; evitar: string[] }
  faz: string[]
  naoFaz: string[]
  logo: { areaProtecao: string; tamanhoMinimo: string; regras: string[] }
  imagens: string[]
  icones: string[]
  grafismos: string[]
  densidade: DensidadeMarca | null
}

const empurrar = (lista: string[], x: string, max: number) => { const k = x.toLowerCase(); if (x && lista.length < max && !lista.some((y) => y.toLowerCase() === k)) lista.push(x) }

/**
 * Regras do manual pelas seções (título "Tom de voz", "Fotografia", "Usos incorretos"…) e por palavras-chave em
 * cada frase. Linhas de cor e de fonte ficam de fora (elas já viram a paleta e a tipografia).
 */
export function regrasDoManual(texto: string): RegrasEncontradas {
  const r: RegrasEncontradas = { tom: [], termos: { usar: [], evitar: [] }, faz: [], naoFaz: [], logo: { areaProtecao: '', tamanhoMinimo: '', regras: [] }, imagens: [], icones: [], grafismos: [], densidade: null }
  let secao: Categoria = null
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  // frases: uma linha pode ter várias ("Use fotos naturais. Evite banco de imagens.")
  for (const bruta of linhas) {
    if (bruta.startsWith('|')) continue
    const l = semMarcador(bruta)
    if (!l) continue
    // título de seção: Markdown do leitor de PDF ou linha curta que nomeia uma seção conhecida
    if (ehTitulo(bruta) && l.split(/\s+/).length <= 5 && !RE_NEGATIVA.test(l) && !RE_POSITIVA.test(l)) {
      const s = SECOES.find(([re]) => re.test(l))?.[1]
      if (s !== undefined || /^#{1,4}\s/.test(bruta)) { secao = s ?? null; continue }
    }
    for (const f0 of l.split(/(?<=[.!?;])\s+(?=[\p{Lu}"“])/u)) {
      const f = frase(f0)
      if (f.length < 8 || codigosDaLinha(f).some((c) => c.tipo !== 'pantone')) continue
      const negativa = RE_NEGATIVA.test(f) || secao === 'naoFaz'
      if (RE_PROTECAO.test(f)) { if (!r.logo.areaProtecao) r.logo.areaProtecao = f; continue }
      if (RE_MINIMO.test(f)) { if (!r.logo.tamanhoMinimo) r.logo.tamanhoMinimo = f; continue }
      // termos entre aspas numa regra de texto ("evite “barato”", "diga “investimento”")
      if (secao === 'tom' || RE_TOM.test(f) || /\b(?:palavras?|termos?|express[õo]es|diga|escreva)\b/i.test(f)) {
        for (const m of f.matchAll(RE_ASPAS)) empurrar(negativa ? r.termos.evitar : r.termos.usar, m[1]!.trim(), 20)
      }
      if (secao === 'logo' || /\blogo|logotipo|assinatura|s[ií]mbolo/i.test(f)) {
        empurrar(r.logo.regras, f, 8)
        if (negativa) empurrar(r.naoFaz, f, 15)
        continue
      }
      if (secao === 'tom' || (RE_TOM.test(f) && !secao)) { empurrar(r.tom, f, 8); if (negativa) empurrar(r.naoFaz, f, 15); continue }
      if (secao === 'imagens' || RE_IMAGEM.test(f)) { empurrar(r.imagens, f, 6); if (negativa) empurrar(r.naoFaz, f, 15); continue }
      if (secao === 'icones' || RE_ICONE.test(f)) { empurrar(r.icones, f, 4); if (negativa) empurrar(r.naoFaz, f, 15); continue }
      if (secao === 'grafismos' || RE_GRAFISMO.test(f)) { empurrar(r.grafismos, f, 6); if (negativa) empurrar(r.naoFaz, f, 15); continue }
      if (secao === 'cores' || secao === 'tipografia') { if (negativa) empurrar(r.naoFaz, f, 15); else if (RE_POSITIVA.test(f)) empurrar(r.faz, f, 15); continue }
      if (secao === 'naoFaz' || negativa) { empurrar(r.naoFaz, f, 15); continue }
      if (secao === 'faz' || RE_POSITIVA.test(f)) empurrar(r.faz, f, 15)
    }
  }
  const tudo = texto.toLowerCase()
  if (/pouco texto|menos [ée] mais|muito respiro|espa[cç]o em branco|minimalista|telas? limpas?|uma ideia por (?:tela|slide|p[aá]gina)|textos? curtos?/.test(tudo)) r.densidade = 'baixa'
  else if (/alta densidade|bastante informa[cç][aã]o|telas? densas?|detalhad[oa]s? em cada|muitos dados/.test(tudo)) r.densidade = 'alta'
  else if (/densidade m[eé]dia|equil[ií]brio entre texto e imagem/.test(tudo)) r.densidade = 'media'
  return r
}

// ---------------------------------------------------------------- tudo junto

/**
 * Perfil de marca a partir do texto do manual, sem IA: paleta com papéis, fontes por nível e regras.
 * `arquivo` entra na origem (para mostrar de onde veio).
 */
export function perfilDoTexto(texto: string, cat: Catalogo, arquivo = ''): PerfilMarca {
  const cores = coresDoManual(texto)
  const fontes = fontesDoManual(texto, cat)
  const regras = regrasDoManual(texto)
  const nome = (c: CorEncontrada) => [c.rotulo && !/^(?:cor|cores|color)$/i.test(c.rotulo) ? c.rotulo : '', c.pantone].filter(Boolean).join(' · ').slice(0, 80)
  return PerfilMarcaSchema.parse({
    origem: { arquivos: arquivo ? [arquivo.slice(0, 120)] : [], resumidoPorIa: false },
    cores: atribuirPapeis(cores.map((c) => ({ hex: c.hex, papel: c.papel, nome: nome(c) }))),
    fontes: { titulos: fontes.titulos, textos: fontes.textos, numeros: fontes.numeros },
    ...regras,
  })
}
