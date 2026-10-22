/**
 * Leitura do pedido em texto livre, sem IA (grátis, igual no navegador e no servidor): o que a pessoa já disse e
 * não precisa repetir em outro campo nem ser adivinhado pelo modelo.
 * - número de telas pedido ("Crie 15 slides", "10 telas");
 * - estrutura explícita ("Slide 01: Capa", "Tela 3 — Funil"), com título, subtítulo, itens e direção visual de cada tela;
 * - cores em hexadecimal com papéis (principal, fundo escuro, fundo claro, cartão, positivo, negativo);
 * - nome da marca/empresa;
 * - se o pedido fala de fotos ou imagens (sem isso, nada de espaço de imagem vazio).
 * Puro: sem rede, sem DOM.
 */
import { RE_HEX, luminanciaRelativa } from './designSystem'

// ---------------------------------------------------------------- número de telas

const NUMEROS_ESCRITOS: Record<string, number> = {
  tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
}
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const PALAVRAS_FRACAS = new Set('a o as os e de da do das dos em no na nos nas para por com um uma que ao aos the se sua seu entre como mais menos muito'.split(' '))
/** Radicais das palavras significativas ("contratos" → "contrat"), para comparar nomes sem acento, plural nem artigo. */
export const radicais = (s: string) => semAcento(s.toLowerCase()).split(/[^a-z0-9]+/).filter((p) => p.length > 1 && !PALAVRAS_FRACAS.has(p)).map((p) => p.replace(/(oes|aes|es|s)$/, '').slice(0, 7))

/** Número de telas citado no texto ("Crie 15 slides", "uma apresentação de dez telas"); null se não houver. */
export function telasCitadas(texto: string): number | null {
  const t = semAcento(texto.toLowerCase())
  // a primeira citação com número plausível ("Crie 15 slides"; ignora "100 telas" e números fora do intervalo)
  for (const r of t.matchAll(/\b(\d{1,3}|[a-z]+)\s+(?:slides?|telas?|laminas?|paginas?|pranchas?)\b/g)) {
    const bruto = r[1]!
    const n = /^\d+$/.test(bruto) ? Number(bruto) : NUMEROS_ESCRITOS[bruto]
    if (n && n >= 3 && n <= 60) return n
  }
  return null
}

// ---------------------------------------------------------------- estrutura explícita

export interface TelaPedida {
  /** Número da tela no pedido (1 = primeira). */
  numero: number
  /** Nome que o pedido dá à tela ("Capa", "Funil comercial"). */
  nome: string
  /** "Título: …" dado no pedido (usar exatamente). */
  titulo: string
  /** "Subtítulo: …" dado no pedido. */
  subtitulo: string
  /** Itens (tópicos e listas numeradas) na ordem do pedido. */
  itens: string[]
  /** Demais linhas: o que mostrar e como (direção visual e de conteúdo). */
  direcao: string[]
}

const RE_CABECALHO_TELA = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:slide|tela|l[aâ]mina|p[aá]gina|prancha)\s*(\d{1,3})\s*(?:\*\*)?\s*(?:[:.\-–—)|]\s*(.*))?$/i
const RE_TOPICO = /^\s*(?:[-*•–]|(\d{1,2})[.)])\s+(.*)$/
/** Cabeçalho de seção do pedido ("4. Regras de qualidade", "## Dados"): fecha a última tela. */
const RE_SECAO = /^\s*(?:#{1,6}\s+.+|\d{1,2}\.\s+[^.]{3,60}|(?:regras|resultado esperado|observa[cç][oõ]es)\b.*)$/i

const limpar = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const semPontoFinal = (s: string) => s.replace(/[.;]+$/, '').trim()

/**
 * Estrutura explícita do pedido: cada "Slide NN: nome" (ou Tela/Lâmina/Página) vira uma tela, com o que vem
 * embaixo até a próxima tela ou o próximo cabeçalho de seção. Menos de 3 telas = sem estrutura (lista vazia).
 */
export function estruturaDoPedido(texto: string): TelaPedida[] {
  const linhas = texto.replace(/\r/g, '').split('\n')
  const telas: TelaPedida[] = []
  let atual: TelaPedida | null = null
  /** Último número de item numerado dentro da tela atual (para não confundir "2." da lista com uma seção). */
  let ultimoNumero = 0
  for (const bruta of linhas) {
    const linha = bruta.trim()
    if (!linha) continue
    const cab = RE_CABECALHO_TELA.exec(linha)
    if (cab) {
      atual = { numero: Number(cab[1]), nome: semPontoFinal(limpar(cab[2] ?? '')), titulo: '', subtitulo: '', itens: [], direcao: [] }
      telas.push(atual)
      ultimoNumero = 0
      continue
    }
    if (!atual) continue
    const topico = RE_TOPICO.exec(linha)
    const numero = topico?.[1] ? Number(topico[1]) : null
    // seção nova (fora da sequência da lista da tela) fecha a tela atual
    if (RE_SECAO.test(linha) && !(numero !== null && numero === ultimoNumero + 1) && !/^(t[ií]tulo|subt[ií]tulo)\s*:/i.test(linha)) {
      atual = null
      continue
    }
    const rotulado = /^(t[ií]tulo|subt[ií]tulo)\s*:\s*(.+)$/i.exec(linha)
    if (rotulado) {
      const valor = semPontoFinal(limpar(rotulado[2]!))
      if (/^sub/i.test(rotulado[1]!)) atual.subtitulo = valor
      else atual.titulo = valor
      continue
    }
    if (topico) {
      if (numero !== null) ultimoNumero = numero
      atual.itens.push(semPontoFinal(limpar(topico[2]!)))
      continue
    }
    atual.direcao.push(limpar(linha))
  }
  // numeração com buracos ou repetida não é uma estrutura confiável; menos de 3 telas também não
  if (telas.length < 3) return []
  return telas
}

// ---------------------------------------------------------------- cores com papéis

export interface PaletaDoPedido {
  /** Cores para a marca, na ordem do kit: principal, fundo escuro (se houver), apoio. */
  cores: string[]
  papeis: PapeisCor
}
export interface PapeisCor {
  principal?: string
  /** Fundo escuro (capa, telas de respiro). */
  escuro?: string
  /** Fundo claro das telas de conteúdo. */
  claro?: string
  /** Superfície de cartões sobre o fundo claro. */
  cartao?: string
  /** Indicadores positivos (crescimento, meta batida). */
  positivo?: string
  /** Indicadores negativos (queda, meta não atingida, alertas). */
  negativo?: string
}

const papelDoNome = (nome: string, hex: string): keyof PapeisCor | null => {
  const n = semAcento(nome.toLowerCase())
  if (/positiv|sucesso|ganho|acima|bom desempenho/.test(n)) return 'positivo'
  if (/negativ|alerta|erro|perda|queda|abaixo|risco/.test(n)) return 'negativo'
  if (/principal|primari|destaque|main|da marca/.test(n)) return 'principal'
  if (/marinho|escur|dark|noturn|preto|fundo escuro/.test(n) && luminanciaRelativa(hex) < 0.2) return 'escuro'
  if (luminanciaRelativa(hex) > 0.8) return /branc|white|fundo/.test(n) ? 'claro' : 'cartao'
  return null
}

/**
 * Cores em hexadecimal citadas no pedido, com o papel de cada uma pelo nome ("Azul principal: #006BFF",
 * "Verde para indicadores positivos: #16A765") e, sem nome, pela luminância. Brancos e cinzas claros viram fundo
 * e cartão; verdes/vermelhos com nome de indicador viram positivo/negativo (fora da paleta da marca).
 */
export function paletaDoPedido(texto: string): PaletaDoPedido | null {
  const achadas: { hex: string; nome: string }[] = []
  for (const linha of texto.replace(/\r/g, '').split('\n')) {
    for (const m of linha.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
      const h = m[1]!
      const hex = `#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h}`.toUpperCase()
      if (!RE_HEX.test(hex) || achadas.some((a) => a.hex === hex)) continue
      // nome: o que vem antes do código na linha ("* Azul principal: #006BFF") ou depois ("#006BFF (azul principal)")
      const antes = linha.slice(0, m.index).replace(/^[\s*•\-–\d.)]+/, '').replace(/[:=\-–—(]\s*$/, '').trim()
      const depois = linha.slice((m.index ?? 0) + m[0].length).replace(/^[\s)(:—–-]+/, '').trim()
      achadas.push({ hex, nome: antes || depois })
    }
  }
  if (!achadas.length) return null
  const papeis: PapeisCor = {}
  const livres: string[] = []
  for (const a of achadas) {
    const p = papelDoNome(a.nome, a.hex)
    if (p && !papeis[p]) papeis[p] = a.hex
    else if (p === 'cartao' || p === 'claro') { if (!papeis.cartao) papeis.cartao = a.hex }
    else livres.push(a.hex)
  }
  // sem nome de papel: a mais escura vira fundo escuro; a mais saturada/escura o bastante, a principal
  if (!papeis.escuro) {
    const k = livres.findIndex((c) => luminanciaRelativa(c) < 0.06)
    if (k >= 0) papeis.escuro = livres.splice(k, 1)[0]!
  }
  if (!papeis.principal) {
    const k = livres.findIndex((c) => luminanciaRelativa(c) < 0.6)
    if (k >= 0) papeis.principal = livres.splice(k, 1)[0]!
    else if (livres.length) papeis.principal = livres.shift()!
  }
  if (!papeis.claro && papeis.cartao && luminanciaRelativa(papeis.cartao) > 0.95) { papeis.claro = papeis.cartao; delete papeis.cartao }
  const cores = [papeis.principal, papeis.escuro, ...livres.filter((c) => luminanciaRelativa(c) < 0.8)].filter((c): c is string => !!c).slice(0, 4)
  if (!cores.length) return null
  return { cores, papeis }
}

// ---------------------------------------------------------------- marca e imagens

/** Nome da empresa ou marca citado no pedido ("… | Nexora Soluções", "a empresa fictícia Nexora Soluções"). */
export function marcaDoPedido(texto: string): string {
  const primeira = texto.replace(/\r/g, '').split('\n').find((l) => l.trim()) ?? ''
  const nomeProprio = /^\p{Lu}[\p{L}&.'-]*(?:\s+(?:de|da|do|&)?\s*\p{Lu}[\p{L}&.'-]*){0,3}$/u
  const lados = primeira.split(/\s[|·—–]\s/)
  if (lados.length > 1) {
    const fim = limpar(lados[lados.length - 1]!)
    if (fim.length <= 40 && nomeProprio.test(fim)) return fim
  }
  const m = texto.match(/\b(?:empresa|marca|startup|companhia|cliente|loja|escrit[oó]rio|ag[eê]ncia)\s+(?:fict[ií]cia\s+|chamada\s+|brasileira\s+)?((?:\p{Lu}[\p{L}&.'-]*)(?:\s+\p{Lu}[\p{L}&.'-]*){0,3})/u)
  return m ? limpar(m[1]!).slice(0, 60) : ''
}

/** O pedido fala de fotos, imagens ou espaço para elas? (sem isso, a IA não cria telas com espaço de imagem vazio) */
export const pedeImagens = (texto: string) => /\b(fotos?|fotografias?|imagens?|ilustra[cç][oõ]es|ilustra[cç][aã]o|prints?|screenshots?|renders?|mockups?|galeria|espa[cç]o para (?:foto|imagem))\b/i.test(texto)

// ---------------------------------------------------------------- tudo junto

export interface AnalisePedido {
  /** Telas pedidas: o número citado no texto ou o tamanho da estrutura explícita (o que for mais confiável). */
  telas: number | null
  estrutura: TelaPedida[]
  paleta: PaletaDoPedido | null
  marca: string
  imagens: boolean
}

export function analisarPedido(texto: string): AnalisePedido {
  const estrutura = estruturaDoPedido(texto)
  const citado = telasCitadas(texto)
  return {
    // a lista explícita manda (é o que a pessoa detalhou); o número citado vale quando não há lista
    telas: estrutura.length >= 3 ? estrutura.length : citado,
    estrutura,
    paleta: paletaDoPedido(texto),
    marca: marcaDoPedido(texto),
    imagens: pedeImagens(texto),
  }
}

/**
 * Direção visual de cada tela pedida, alinhada ao roteiro: só quando o roteiro tem o mesmo número de telas da
 * estrutura (uma para cada); senão, lista vazia (a direção de uma tela não vale para outra).
 */
export function direcoesDoPedido(prompt: string, telas: number): string[] {
  const e = estruturaDoPedido(prompt)
  if (e.length !== telas) return []
  return e.map(direcaoDe)
}
const direcaoDe = (t: TelaPedida) => [t.nome, ...t.direcao].join('. ').replace(/\.\.+/g, '.').slice(0, 400)

/**
 * Direção de cada tela de um roteiro já editado (telas reordenadas, removidas ou novas): cada tela pega a da tela
 * pedida que ela representa (pelo título e rótulo); sem correspondência, nenhuma.
 */
export function direcoesParaRoteiro(prompt: string, telas: { titulo: string; rotulo?: string }[]): string[] {
  const e = estruturaDoPedido(prompt)
  if (!e.length) return []
  return telas.map((t, i) => {
    const alvo = new Set(radicais(`${t.titulo} ${t.rotulo ?? ''}`))
    let melhor = -1
    let nota = 0
    e.forEach((x, k) => {
      if (x.titulo && x.titulo.toLowerCase() === t.titulo.trim().toLowerCase()) { melhor = k; nota = 9; return }
      const q = radicais(`${x.nome} ${x.titulo}`)
      const n = q.length ? q.filter((r) => alvo.has(r)).length / q.length + (k === i ? 0.05 : 0) : 0
      if (n > nota) { nota = n; melhor = k }
    })
    return melhor >= 0 && nota >= 0.5 ? direcaoDe(e[melhor]!) : ''
  })
}
