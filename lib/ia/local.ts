/**
 * Gerador de roteiro local e determinístico. Roda quando não há chave da API configurada (modo demo) e
 * como reserva se o modelo falhar: organiza o texto do usuário em telas ou, sem texto, monta o arco
 * narrativo do tipo de apresentação (lib/ia/tiposApresentacao.ts) com textos-guia. Puro: sem rede, sem DOM.
 */
import type { TemaId, TipoTela } from './designSystem'
import { normalizarRoteiro, tipoEfetivo, type PedidoRoteiro, type RoteiroBruto } from './pedido'
import type { Roteiro } from './roteiro'
import { roteiroDaEstrutura } from './estruturaLocal'
import { ajustarRoteiroAoPedido } from './fidelidade'
import { TIPOS, tipoDoPedido, type Momento, type TipoApresentacao } from './tiposApresentacao'

type Tela = RoteiroBruto['telas'][number]
const tela = (tipo: TipoTela, titulo: string, texto = '', itens: string[] = [], notas = '', rotulo = ''): Tela => ({ tipo, rotulo, titulo, texto, itens, notas })
const deMomento = (m: Momento): Tela => tela(m.tipo, m.titulo, m.texto ?? '', m.itens ?? [], m.notas ?? '', m.rotulo)

const palavras = (s: string, n: number) => {
  const p = s.split(/\s+/).filter(Boolean)
  return p.length > n ? `${p.slice(0, n).join(' ')}…` : p.join(' ')
}
const capitalizar = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)
/** Até `n` palavras, sem reticências e sem terminar em palavra solta ("para o"). */
const semCauda = (s: string, n: number) => {
  const p = s.split(/\s+/).filter(Boolean).slice(0, n)
  while (p.length > 2 && /^(e|de|da|do|das|dos|a|o|as|os|em|no|na|para|por|com|que|um|uma|à|ao)$/i.test(p[p.length - 1]!)) p.pop()
  return p.join(' ')
}
const semPontoFinal = (s: string) => s.replace(/[.:;,]+$/, '')

/** "Uma apresentação de identidade visual para a Café Aurora" → "Identidade visual para a Café Aurora" */
export function tituloDoPrompt(prompt: string): string {
  const frase = prompt.split(/[.\n!?:]|\s[—–]\s/)[0] ?? ''
  // "Pitch da Aurora, startup de energia solar" → "Pitch da Aurora"
  const [antesDaVirgula] = frase.split(',')
  const primeira = antesDaVirgula && antesDaVirgula.trim().split(/\s+/).length >= 2 ? antesDaVirgula : frase
  const limpo = primeira
    .replace(/^\s*(crie|cria|criar|fa[cç]a|monte|gere|quero|preciso de|escreva)\s+/i, '')
    .replace(/^\s*(uma?|o|a)\s+/i, '')
    .replace(/^\s*(apresenta[cç][aã]o|deck|pitch deck|slides?|story)\s+(de|da|do|sobre|para)\s+/i, '')
    .trim()
  return capitalizar(semPontoFinal(semCauda(limpo || 'Nova apresentação', 10)))
}

/** Tipo de apresentação reconhecido num texto livre. */
export const tipoDoPrompt = (texto: string): TipoApresentacao => tipoDoPedido(texto)

/** Tema sugerido para o tipo (o primeiro da lista do tipo). */
export const temaSugerido = (tipo: TipoApresentacao): TemaId => TIPOS[tipo].temas[0]!

// ---------- organizar texto colado ----------

const RE_TOPICO = /^\s*(?:[-*•–]|\d+[.)])\s+/
const RE_TITULO = /^\s*#{1,6}\s+/
const RE_NUMERO = /(?:R\$\s?)?\d[\d.,]*(?:\s?(?:%|x\b|×|k\b|mil\b|mi\b|bi\b|min\b|h\b|dias\b|meses\b|anos\b))?/i

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
      if (comNumero.length === topicos.length && topicos.length <= 4) {
        const itens = topicos.map((t) => {
          const m = t.match(RE_NUMERO)!
          return `${m[0].trim()}|${t.replace(m[0], '').replace(/^[\s:—–-]+/, '').trim()}`
        })
        return tela('numeros', palavras(cabecalho ?? 'Em números', 8), '', itens)
      }
      // tópicos "Título: descrição" viram cartões
      const pares = topicos.map((t) => t.match(/^([^:—–]{2,40})[:—–]\s+(.+)$/))
      if (pares.every(Boolean) && topicos.length <= 4) return tela('cartoes', palavras(cabecalho ?? 'Pontos principais', 8), '', pares.map((m) => `${m![1]!.trim()}|${palavras(m![2]!.trim(), 18)}`))
      return tela('lista', palavras(cabecalho ?? semPontoFinal(prosa) ?? 'Pontos principais', 8) || 'Pontos principais', '', topicos.slice(0, 5).map((t) => palavras(t, 16)))
    }
    const citacao = prosa.match(/^[“"](.+)[”"]\s*[—–-]?\s*(.*)$/)
    if (citacao) return tela('citacao', palavras(citacao[1]!, 20), citacao[2] ?? '')
    const frases = prosa.split(/(?<=[.!?])\s+/).filter(Boolean)
    const titulo = cabecalho ?? semPontoFinal(frases.shift() ?? 'Ideia')
    return tela('conceito', palavras(titulo, 8), frases.join(' '), [], '')
  })
}

/** Telas extras para apresentações mais longas que o arco do tipo. */
const EXTRAS: Momento[] = [
  { tipo: 'secao', rotulo: 'Parte 2', titulo: 'Aprofundando', texto: 'O que vem a seguir, em detalhe.' },
  { tipo: 'conceito', rotulo: 'Insight', titulo: 'Um ponto que merece atenção', texto: 'Explique por que isso muda a forma de ver o assunto.' },
  { tipo: 'imagem', rotulo: 'Na prática', titulo: 'Como isso aparece no dia a dia', texto: 'Uma imagem que mostre o resultado.' },
  { tipo: 'citacao', rotulo: 'Quem viveu', titulo: '“Uma frase que resume a experiência.”', texto: 'Nome, cargo' },
  { tipo: 'lista', rotulo: 'Resumo', titulo: 'Para levar daqui', itens: ['Primeira ideia principal', 'Segunda ideia principal', 'Terceira ideia principal'] },
  { tipo: 'cartoes', rotulo: 'Detalhes', titulo: 'Três pontos de atenção', itens: ['Primeiro|uma frase de explicação', 'Segundo|uma frase de explicação', 'Terceiro|uma frase de explicação'] },
]

/** Escolhe `n` momentos do arco mantendo a ordem: essenciais primeiro, depois os demais na ordem do arco; completa com extras. */
export function escolherMomentos(arco: Momento[], n: number): Momento[] {
  if (n <= 0) return []
  if (arco.length <= n) {
    const saida = [...arco]
    for (let i = 0; saida.length < n; i++) {
      const extra = EXTRAS[i % EXTRAS.length]!
      const rodada = Math.floor(i / EXTRAS.length)
      // extras entram antes do fechamento do arco (a última tela do meio costuma ser o pedido/próximo passo)
      saida.splice(Math.max(1, saida.length - 1), 0, rodada ? { ...extra, titulo: `${extra.titulo} (${rodada + 1})` } : extra)
    }
    return saida
  }
  const essenciais = arco.map((m, i) => ({ m, i })).filter((x) => x.m.essencial)
  const escolhidos = new Set(essenciais.slice(0, n).map((x) => x.i))
  for (let i = 0; i < arco.length && escolhidos.size < n; i++) escolhidos.add(i)
  return arco.filter((_, i) => escolhidos.has(i))
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

/**
 * O que a pessoa deu antes de gerar entra no roteiro local também: números-chave viram uma tela de métricas,
 * fotos próprias uma galeria (ou imagem) e "o que não pode faltar" uma lista. Cada um ocupa o lugar de uma tela-guia
 * do arco (o total de telas não muda).
 */
export function encaixarMaterial(meio: Tela[], p: Pick<PedidoRoteiro, 'material'>): Tela[] {
  const m = p.material
  const saida = [...meio]
  const usados = new Set<number>()
  const trocaveis = ['conceito', 'cartoes', 'citacao', 'lista', 'secao', 'imagem', 'galeria', 'processo']
  const encaixar = (nova: Tela, jaTem: (t: Tela) => boolean) => {
    if (saida.some(jaTem) || saida.length < 2) return
    for (let i = saida.length - 1; i >= 1; i--) {
      if (usados.has(i) || !trocaveis.includes(saida[i]!.tipo)) continue
      saida[i] = nova
      usados.add(i)
      return
    }
  }
  const numeros = m.numeros.map((n) => n.trim()).filter((n) => /\d/.test(n)).map((n) => (n.includes('|') ? n.split('|').map((x) => x.trim()).join('|') : n.replace(/^\s*([^\s]+)\s+/, '$1|'))).filter((n) => n.split('|')[1]?.trim())
  if (numeros.length) {
    // os números da pessoa substituem os números-guia do arco (que são só exemplo)
    const k = saida.findIndex((t) => t.tipo === 'numeros')
    if (k >= 0) {
      saida[k] = { ...saida[k]!, itens: numeros.slice(0, 4) }
      usados.add(k)
    } else encaixar(tela('numeros', 'Os números que importam', '', numeros.slice(0, 4), 'Comente cada número e o que ele prova.', 'Em números'), () => false)
  }
  if (m.fotos.length) {
    const fotos = m.fotos.map((f, i) => (f.trim() || `Foto ${i + 1}`).slice(0, 60))
    encaixar(fotos.length === 1 ? tela('imagem', fotos[0]!, 'Uma imagem que mostra o resultado.', [], '', 'Na prática') : tela('galeria', 'Veja de perto', '', fotos.slice(0, 6).map((f) => `${f}|`), 'Passe pelas imagens e destaque uma.', 'Galeria'), (t) => t.tipo === 'galeria')
  }
  const itens = m.obrigatorio.split(/\n|;|•/).map((x) => x.replace(RE_TOPICO, '').trim()).filter(Boolean)
  if (itens.length) encaixar(tela('lista', 'O que não pode faltar', '', itens.slice(0, 5).map((x) => palavras(x, 16)), 'Passe por cada ponto.', 'Essencial'), () => false)
  return saida
}

export function gerarRoteiroLocal(p: PedidoRoteiro): Roteiro {
  // pedido com estrutura explícita (Slide 01, Slide 02…): uma tela para cada tela pedida, com os dados do pedido
  const daEstrutura = p.prompt ? roteiroDaEstrutura(p.prompt, { marca: p.marca.nome }) : null
  if (daEstrutura) {
    const telas = [...daEstrutura.telas]
    if (telas.length > p.telas) {
      // menos telas que o pedido (limite do plano): capa, as primeiras do meio e o encerramento, na ordem
      const fim = telas.pop()!
      telas.splice(Math.max(1, p.telas - 1))
      telas.push(fim)
    }
    for (let i = 0; telas.length < p.telas; i++) telas.splice(telas.length - 1, 0, deMomento(EXTRAS[i % EXTRAS.length]!))
    return ajustarRoteiroAoPedido(normalizarRoteiro({ titulo: daEstrutura.titulo, telas }, p.telas), p, tipoEfetivo(p))
  }
  const base = p.prompt || p.conteudo.split('\n').find((l) => l.trim()) || ''
  const titulo = tituloDoPrompt(base.replace(RE_TITULO, ''))
  const meioN = Math.max(1, p.telas - 2)
  const def = TIPOS[tipoEfetivo(p)]
  let meio: Tela[]
  if (p.conteudo) {
    const doTexto = telasDoTexto(p.conteudo)
    // a primeira linha costuma ser o título do documento: não vira tela própria
    if (doTexto[0] && !p.prompt && doTexto[0].texto === '' && doTexto[0].itens.length === 0) doTexto.shift()
    // o texto do usuário pode ter blocos parecidos seguidos: varia a ordem só deles; o arco do tipo já tem ritmo
    meio = doTexto.length >= meioN ? variar(doTexto.slice(0, meioN)) : [...variar(doTexto), ...escolherMomentos(def.arco, meioN - doTexto.length).map(deMomento)]
  } else {
    meio = escolherMomentos(def.arco, meioN).map(deMomento)
  }
  meio = encaixarMaterial(meio, p)
  // linha de apoio da capa: o resto da primeira frase depois da vírgula, ou a segunda frase
  const [primeiraFrase = '', ...outras] = p.prompt.split(/[.\n!?]/).map((f) => f.trim()).filter(Boolean)
  const restoDaFrase = primeiraFrase.includes(',') ? primeiraFrase.slice(primeiraFrase.indexOf(',') + 1).trim() : ''
  const apoio = p.publico ? `Para ${p.publico}` : capitalizar(semPontoFinal(palavras(restoDaFrase || outras[0] || def.nome, 18)))
  const fim = deMomento(def.fim)
  const r = normalizarRoteiro({
    titulo,
    telas: [
      tela('capa', titulo, apoio, [], 'Apresente-se e diga em uma frase o que a plateia vai ver.', p.marca.nome || (tipoEfetivo(p) === 'geral' ? '' : def.nome)),
      ...meio,
      fim,
    ],
  }, p.telas)
  return ajustarRoteiroAoPedido(r, p, tipoEfetivo(p))
}
