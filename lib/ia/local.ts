/**
 * Gerador de roteiro local e determinístico. Roda quando não há chave da API configurada
 * (modo demo) e como reserva se o modelo falhar: organiza o texto do usuário em telas ou,
 * sem texto, monta uma estrutura-guia pelo tipo de apresentação. Puro: sem rede, sem DOM.
 */
import type { PedidoRoteiro, RoteiroModelo } from './pedido'
import { normalizarRoteiro } from './pedido'
import type { Roteiro, TipoTela } from './roteiro'

type Tela = RoteiroModelo['telas'][number]
const tela = (tipo: TipoTela, titulo: string, texto = '', itens: string[] = [], notas = ''): Tela => ({ tipo, titulo, texto, itens, notas })

const palavras = (s: string, n: number) => {
  const p = s.split(/\s+/).filter(Boolean)
  return p.length > n ? `${p.slice(0, n).join(' ')}…` : p.join(' ')
}
const capitalizar = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
const semPontoFinal = (s: string) => s.replace(/[.:;,]+$/, '')

/** "Uma apresentação de identidade visual para a Café Aurora" → "Identidade visual para a Café Aurora" */
export function tituloDoPrompt(prompt: string): string {
  const frase = prompt.split(/[.\n!?]/)[0] ?? ''
  // "Pitch da Aurora, startup de energia solar" → "Pitch da Aurora"
  const [antesDaVirgula] = frase.split(',')
  const primeira = antesDaVirgula && antesDaVirgula.trim().split(/\s+/).length >= 2 ? antesDaVirgula : frase
  const limpo = primeira
    .replace(/^\s*(crie|cria|criar|fa[cç]a|monte|gere|quero|preciso de|escreva)\s+/i, '')
    .replace(/^\s*(uma?|o|a)\s+/i, '')
    .replace(/^\s*(apresenta[cç][aã]o|deck|pitch deck|slides?|story)\s+(de|da|do|sobre|para)\s+/i, '')
    .trim()
  return capitalizar(semPontoFinal(palavras(limpo || 'Nova apresentação', 8)))
}

type Tipo = 'identidade' | 'pitch' | 'portfolio' | 'campanha' | 'geral'
export function tipoDoPrompt(texto: string): Tipo {
  const t = texto.toLowerCase()
  if (/identidade|marca|branding|logo/.test(t)) return 'identidade'
  if (/pitch|investidor|startup|rodada|seed|s[eé]rie a/.test(t)) return 'pitch'
  if (/portf[oó]lio|cases?|trabalhos/.test(t)) return 'portfolio'
  if (/campanha|lan[cç]amento|ve[ií]culo|m[ií]dia/.test(t)) return 'campanha'
  return 'geral'
}

/** Estruturas-guia: telas obrigatórias (meio) em ordem de prioridade, e extras para completar. */
const ESTRUTURAS: Record<Tipo, { meio: Tela[]; extras: Tela[] }> = {
  identidade: {
    meio: [
      tela('conceito', 'O ponto de partida', 'O que a marca precisa dizer, em uma frase.', [], 'Comece pelo problema que a identidade resolve, antes de mostrar qualquer forma.'),
      tela('paleta', 'Paleta', '', ['Principal|#B4532A', 'Fundo|#EEE7DB', 'Tinta|#2B1D16'], 'Explique de onde vêm as cores e como elas se combinam.'),
      tela('tipografia', 'Tipografia', '', [], 'Mostre a hierarquia: títulos, textos e números.'),
      tela('imagem', 'Aplicações', 'Embalagem, sinalização e digital.', [], 'Mostre a marca funcionando no mundo real.'),
      tela('secao', 'A ideia', 'Como o conceito vira forma.', [], ''),
      tela('lista', 'Próximos passos', '', ['Aprovação do conceito', 'Manual da marca', 'Aplicações prioritárias'], 'Feche com o que precisa ser decidido hoje.'),
    ],
    extras: [tela('imagem', 'Em uso', 'Mais uma aplicação.'), tela('comparacao', 'Antes e depois', '', ['Antes', 'Depois'])],
  },
  pitch: {
    meio: [
      tela('conceito', 'O problema', 'Quem sofre com ele e quanto custa hoje.', [], 'Conte uma história real de um cliente.'),
      tela('conceito', 'A solução', 'O que o produto faz, em uma frase.', [], ''),
      tela('lista', 'Como funciona', '', ['Passo um', 'Passo dois', 'Passo três'], ''),
      tela('imagem', 'O produto', 'Tela ou foto do produto em uso.', [], 'Mostre, não explique.'),
      tela('lista', 'Modelo de negócio', '', ['Quem paga', 'Quanto paga', 'Como cresce'], ''),
      tela('comparacao', 'Por que agora', '', ['Como é hoje', 'Como fica com a gente'], ''),
      tela('lista', 'O pedido', '', ['Quanto estamos captando', 'Para que vamos usar', 'Em quanto tempo'], 'Seja direto sobre o valor e o prazo.'),
    ],
    extras: [tela('secao', 'Time', 'Quem está construindo.'), tela('citacao', 'O que os clientes dizem', 'Nome, cargo')],
  },
  portfolio: {
    meio: [
      tela('conceito', 'Como eu trabalho', 'Seu jeito de resolver problemas, em uma frase.', [], ''),
      tela('imagem', 'Projeto um', 'Cliente, ano e o que foi feito.', [], 'Fale do problema e do resultado, não só da estética.'),
      tela('imagem', 'Projeto dois', 'Cliente, ano e o que foi feito.'),
      tela('imagem', 'Projeto três', 'Cliente, ano e o que foi feito.'),
      tela('lista', 'O que eu faço', '', ['Identidade visual', 'Direção de arte', 'Produto digital']),
    ],
    extras: [tela('citacao', 'O que dizem sobre o trabalho', 'Nome, cargo'), tela('imagem', 'Projeto quatro', 'Cliente, ano e o que foi feito.')],
  },
  campanha: {
    meio: [
      tela('conceito', 'O desafio', 'O que a campanha precisa mudar.', [], ''),
      tela('secao', 'A grande ideia', 'O conceito em uma frase.', [], 'Leia o conceito em voz alta e faça uma pausa.'),
      tela('imagem', 'Peça principal', 'Filme, cartaz ou post de lançamento.'),
      tela('lista', 'Onde aparece', '', ['Digital', 'Rua', 'Ponto de venda']),
      tela('lista', 'Cronograma', '', ['Pré-lançamento', 'Lançamento', 'Sustentação']),
    ],
    extras: [tela('imagem', 'Desdobramentos', 'Outras peças da campanha.'), tela('comparacao', 'Antes e depois', '', ['Hoje', 'Depois da campanha'])],
  },
  geral: {
    meio: [
      tela('conceito', 'Contexto', 'Onde estamos e por que isso importa.', [], 'Situe a plateia antes de propor qualquer coisa.'),
      tela('secao', 'A proposta', 'O que muda, em uma frase.'),
      tela('lista', 'O que vamos fazer', '', ['Primeira frente', 'Segunda frente', 'Terceira frente']),
      tela('imagem', 'Como fica', 'Uma imagem que mostre o resultado.'),
      tela('comparacao', 'Hoje e depois', '', ['Hoje', 'Depois']),
      tela('lista', 'Cronograma', '', ['Etapa um', 'Etapa dois', 'Etapa três']),
    ],
    extras: [tela('citacao', 'Uma frase que resume tudo', 'Quem disse'), tela('conceito', 'Por que nós', 'O que nos diferencia.')],
  },
}

// ---------- organizar texto colado ----------

const RE_TOPICO = /^\s*(?:[-*•–]|\d+[.)])\s+/
const RE_TITULO = /^\s*#{1,6}\s+/
const RE_NUMERO = /(?:R\$\s?)?\d[\d.,]*(?:\s?(?:%|x\b|k\b|mil\b|mi\b|bi\b|min\b|h\b|dias\b|meses\b|anos\b))?/i

/** Divide o texto em blocos (por linha em branco ou cabeçalho) e transforma cada bloco numa tela. */
export function telasDoTexto(conteudo: string): Tela[] {
  const blocos: string[][] = []
  let atual: string[] = []
  for (const linha of conteudo.replace(/\r/g, '').split('\n')) {
    if (!linha.trim()) {
      if (atual.length) blocos.push(atual), (atual = [])
      continue
    }
    if (RE_TITULO.test(linha) && atual.length) blocos.push(atual), (atual = [])
    atual.push(linha.trim())
  }
  if (atual.length) blocos.push(atual)

  return blocos.map((linhas) => {
    const cabecalho = RE_TITULO.test(linhas[0]!) ? linhas.shift()!.replace(RE_TITULO, '') : null
    const topicos = linhas.filter((l) => RE_TOPICO.test(l)).map((l) => l.replace(RE_TOPICO, ''))
    const prosa = linhas.filter((l) => !RE_TOPICO.test(l)).join(' ')
    if (!linhas.length && cabecalho) return tela('secao', palavras(cabecalho, 8))
    if (topicos.length >= 2) {
      const comNumero = topicos.filter((t) => RE_NUMERO.test(t) && t.length < 90)
      if (comNumero.length === topicos.length && topicos.length <= 3) {
        const itens = topicos.map((t) => {
          const m = t.match(RE_NUMERO)!
          return `${m[0].trim()}|${t.replace(m[0], '').replace(/^[\s:—–-]+/, '').trim()}`
        })
        return tela('numeros', palavras(cabecalho ?? 'Em números', 8), '', itens)
      }
      return tela('lista', palavras(cabecalho ?? semPontoFinal(prosa) ?? 'Pontos principais', 8) || 'Pontos principais', '', topicos.slice(0, 5).map((t) => palavras(t, 16)))
    }
    const citacao = prosa.match(/^[“"](.+)[”"]\s*[—–-]?\s*(.*)$/)
    if (citacao) return tela('citacao', palavras(citacao[1]!, 20), citacao[2] ?? '')
    const frases = prosa.split(/(?<=[.!?])\s+/).filter(Boolean)
    const titulo = cabecalho ?? semPontoFinal(frases.shift() ?? 'Ideia')
    return tela('conceito', palavras(titulo, 8), frases.join(' '), [], '')
  })
}

/** Ajusta a lista do meio a `n` telas: corta pela prioridade (ordem) ou completa com extras. */
function ajustar(meio: Tela[], extras: Tela[], n: number): Tela[] {
  if (n <= 0) return []
  if (meio.length >= n) return meio.slice(0, n)
  const saida = [...meio]
  for (let i = 0; saida.length < n; i++) {
    const extra = extras[i % Math.max(1, extras.length)] ?? tela('conceito', 'Mais um ponto', 'Complete com o que faltar.')
    saida.push({ ...extra, titulo: i >= extras.length ? `${extra.titulo} (${Math.floor(i / extras.length) + 1})` : extra.titulo })
  }
  return saida
}

/** Evita dois tipos iguais seguidos (exceto lista), trocando a ordem quando possível. */
function variar(telas: Tela[]): Tela[] {
  const t = [...telas]
  for (let i = 1; i < t.length; i++) {
    if (t[i]!.tipo !== t[i - 1]!.tipo || t[i]!.tipo === 'lista') continue
    const j = t.findIndex((x, k) => k > i && x.tipo !== t[i]!.tipo && x.tipo !== t[i - 1]!.tipo)
    if (j > 0) [t[i], t[j]] = [t[j]!, t[i]!]
  }
  return t
}

export function gerarRoteiroLocal(p: PedidoRoteiro): Roteiro {
  const base = p.prompt || p.conteudo.split('\n').find((l) => l.trim()) || ''
  const titulo = tituloDoPrompt(base.replace(RE_TITULO, ''))
  const meioN = Math.max(1, p.telas - 2)
  const estrutura = ESTRUTURAS[tipoDoPrompt(`${p.prompt} ${p.conteudo.slice(0, 2000)}`)]
  let meio: Tela[]
  if (p.conteudo) {
    const doTexto = telasDoTexto(p.conteudo)
    // a primeira linha costuma ser o título do documento: não vira tela própria
    if (doTexto[0] && !p.prompt && doTexto[0].texto === '' && doTexto[0].itens.length === 0) doTexto.shift()
    meio = doTexto.length > meioN ? doTexto.slice(0, meioN) : ajustar(doTexto, estrutura.meio, meioN)
  } else {
    meio = ajustar(estrutura.meio, estrutura.extras, meioN)
  }
  // linha de apoio da capa: o resto da primeira frase depois da vírgula, ou a segunda frase
  const [primeiraFrase = '', ...outras] = p.prompt.split(/[.\n!?]/).map((f) => f.trim()).filter(Boolean)
  const restoDaFrase = primeiraFrase.includes(',') ? primeiraFrase.slice(primeiraFrase.indexOf(',') + 1).trim() : ''
  const apoio = p.publico ? `Para ${p.publico}` : capitalizar(semPontoFinal(palavras(restoDaFrase || outras[0] || '', 18)))
  return normalizarRoteiro({
    titulo,
    telas: [
      tela('capa', titulo, apoio, [], 'Apresente-se e diga em uma frase o que a plateia vai ver.'),
      ...variar(meio),
      tela('encerramento', 'Obrigado', 'seu@email.com', [], 'Repita o próximo passo e abra para perguntas.'),
    ],
  }, p.telas)
}
