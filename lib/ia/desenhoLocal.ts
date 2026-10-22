/**
 * Design local e determinístico: escolhe variante, fundo, ênfase e destaque de cada tela a partir do roteiro,
 * com ritmo entre as telas (alterna variantes do mesmo tipo e fundos de "respiro"). Roda no modo demo, nos
 * templates e como reserva quando o modelo de design falha. É também a sugestão inicial enviada ao modelo.
 * Puro: sem rede, sem DOM.
 */
import { COMPONENTES, regrasDe, type Decoracao, type Fundo, type TemaVisual, type TipoTela } from './designSystem'
import type { Estilo, TelaDesenhada } from './montagem'
import type { Roteiro, TelaRoteiro } from './roteiro'

const ROTULO_PADRAO: Partial<Record<TipoTela, string>> = {
  agenda: 'Agenda', numeros: 'Em números', grafico: 'Dados', comparacao: 'Comparação', linhaTempo: 'Cronograma', processo: 'Como funciona',
  equipe: 'Equipe', precos: 'Investimento', galeria: 'Galeria', cta: 'Próximo passo', paleta: 'Cores', tipografia: 'Tipografia',
  comparativo: 'Comparativo', funil: 'Funil', tabela: 'Ranking', kpis: 'Indicadores', roadmap: 'Plano de ação', alertas: 'Atenção',
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Variante que a direção visual pedida para a tela indica ("gráfico de linhas", "cards grandes", "barras horizontais"). */
export function varianteDaDirecao(tipo: TipoTela, direcao: string): string | null {
  const t = semAcento(direcao)
  if (!t.trim()) return null
  switch (tipo) {
    case 'grafico':
      if (/linha|evoluc|tendenc/.test(t)) return 'grafico.linha'
      if (/participac|percentual|proporc|% do total|fatia/.test(t)) return 'grafico.participacao'
      if (/coluna|vertica/.test(t)) return 'grafico.colunas'
      if (/barra|horizonta/.test(t)) return 'grafico.barras'
      return null
    case 'numeros': return /cards?|cart(ao|oes)|caixas/.test(t) ? 'numeros.cartoes' : /grandes|editorial/.test(t) ? 'numeros.grandes' : null
    case 'comparativo': return /meta|realizad|objetivo/.test(t) ? 'comparativo.meta' : /cresc|anterior|antes|q[1-4]|t[1-4]|horizonta/.test(t) ? 'comparativo.crescimento' : null
    case 'funil': return /degrau|escada|esquerda/.test(t) ? 'funil.degraus' : 'funil.barras'
    case 'tabela': return /ranking|posic|colocad|melhores/.test(t) ? 'tabela.ranking' : /tabela/.test(t) ? 'tabela.simples' : null
    case 'kpis': return /meta|objetivo|proje|futur|alvo/.test(t) ? 'kpis.metas' : 'kpis.painel'
    case 'roadmap': return /linha|lista/.test(t) && !/roadmap/.test(t) ? 'roadmap.linhas' : 'roadmap.colunas'
    case 'cartoes': return /editorial|aberto|fio/.test(t) ? 'cartoes.linhas' : /cards?|cart(ao|oes)/.test(t) ? 'cartoes.grade' : null
    case 'capa': return /centrad|simetric/.test(t) ? 'capa.centrada' : /dividid|metade/.test(t) ? 'capa.dividida' : null
    case 'encerramento': return /centrad|minimalista|marcante/.test(t) ? 'encerramento.centrado' : null
    default: return null
  }
}

/** Fundo que a direção pede ("fundo azul-marinho" → escuro; "fundo azul" na cor da marca → acento). */
export function fundoDaDirecao(direcao: string): Fundo | null {
  const t = semAcento(direcao)
  if (/fundo (?:azul[- ]marinho|marinho|escuro|preto|noturno|grafite)/.test(t)) return 'escuro'
  if (/fundo (?:azul|verde|vermelho|laranja|roxo|violeta|amarelo|rosa|colorido|da cor (?:principal|da marca)|na cor (?:principal|da marca))(?![- ]?(?:claro|escuro|marinho))/.test(t)) return 'acento'
  if (/fundo (?:branco|claro|cinza claro)/.test(t)) return 'claro'
  return null
}

const palavras = (s: string) => s.trim().split(/\s+/).filter(Boolean)

/** Final do título que ganha cor: o último terço das palavras (até 3), sem começar por preposição solta. */
export function enfaseLocal(titulo: string): string {
  const p = palavras(titulo.replace(/[.!?]+$/, ''))
  if (p.length < 4) return ''
  let k = Math.min(3, Math.ceil(p.length / 3))
  const fracas = /^(e|de|da|do|das|dos|a|o|as|os|em|no|na|para|por|com|que|um|uma)$/i
  while (k > 1 && fracas.test(p[p.length - k]!)) k--
  // "para a | Café Bairro" → a ênfase leva junto as palavras fracas que ficariam soltas antes dela
  while (k < Math.min(5, p.length - 1) && fracas.test(p[p.length - k - 1]!)) k++
  if (k >= p.length - 1) return ''
  return p.slice(-k).join(' ')
}

export interface OpcoesDesenhoLocal {
  story: boolean
  estilo: Estilo
  tema: TemaVisual
  /** Direção visual pedida para cada tela (na ordem do roteiro), quando o pedido traz uma estrutura. */
  direcoes?: string[]
}

/** Desenha todas as telas do roteiro (com ritmo entre elas). */
export function desenharLocal(roteiro: Roteiro, o: OpcoesDesenhoLocal): TelaDesenhada[] {
  const contagem = new Map<TipoTela, number>()
  const saida: TelaDesenhada[] = []
  roteiro.telas.forEach((t, i) => {
    const n = contagem.get(t.tipo) ?? 0
    contagem.set(t.tipo, n + 1)
    saida.push(desenharTelaLocal(t, { ...o, ocorrencia: n, indice: i, total: roteiro.telas.length, anterior: saida[i - 1], direcao: o.direcoes?.[i] }))
  })
  return saida
}

export function desenharTelaLocal(t: TelaRoteiro, o: OpcoesDesenhoLocal & { ocorrencia: number; indice: number; total: number; anterior?: TelaDesenhada; direcao?: string }): TelaDesenhada {
  const { story, estilo, tema } = o
  const variantes = COMPONENTES[t.tipo].variantes.filter((v) => !story || !v.soSlides)
  const por = (id: string) => (variantes.some((v) => v.id === id) ? id : variantes[0]!.id)
  const rodar = (ids: string[]) => {
    const validos = ids.filter((id) => variantes.some((v) => v.id === id))
    return validos.length ? validos[o.ocorrencia % validos.length]! : variantes[0]!.id
  }
  const nPal = palavras(t.titulo).length
  const itens = t.itens.filter((x) => x.trim())
  let variante: string
  switch (t.tipo) {
    case 'capa': variante = estilo === 'ousado' && nPal <= 4 ? por('capa.tipografica') : estilo === 'minimal' ? por('capa.centrada') : por('capa.classica'); break
    case 'secao': variante = estilo === 'ousado' ? por('secao.faixa') : estilo === 'minimal' ? por('secao.minimal') : rodar(['secao.numero', 'secao.faixa']); break
    case 'conceito': variante = estilo === 'minimal' ? rodar(['conceito.frase', 'conceito.lateral']) : t.texto.length >= 90 && !story ? rodar(['conceito.lateral', 'conceito.frase']) : rodar(estilo === 'ousado' ? ['conceito.enfase', 'conceito.frase'] : ['conceito.frase', 'conceito.enfase']); break
    case 'lista': variante = itens.length <= 3 && itens.every((x) => x.length <= 60) ? por('lista.colunas') : rodar(['lista.numerada', 'lista.colunas']); break
    case 'cartoes': variante = estilo === 'ousado' ? por('cartoes.grade') : rodar(['cartoes.grade', 'cartoes.linhas']); break
    case 'processo': variante = itens.length <= 4 && estilo === 'ousado' ? por('processo.circulos') : rodar(['processo.passos', 'processo.circulos']); break
    case 'numeros': variante = estilo === 'ousado' ? por('numeros.grandes') : rodar(['numeros.grandes', 'numeros.cartoes']); break
    case 'grafico': variante = itens.every((x) => /^[^|]*\|\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|t[1-4]|q[1-4]|s[1-2]|\d{4})/i.test(x)) ? por('grafico.colunas') : por('grafico.barras'); break
    case 'comparacao': variante = /antes|hoje|atual|sem/i.test(itens[0] ?? '') ? por('comparacao.antesDepois') : por('comparacao.colunas'); break
    case 'linhaTempo': variante = itens.length > 5 ? por('linhaTempo.vertical') : por('linhaTempo.horizontal'); break
    case 'citacao': variante = rodar(estilo === 'minimal' ? ['citacao.depoimento', 'citacao.grande'] : ['citacao.grande', 'citacao.depoimento']); break
    case 'imagem': variante = rodar(estilo === 'ousado' ? ['imagem.cheia', 'imagem.lateral', 'imagem.moldura'] : ['imagem.lateral', 'imagem.moldura', 'imagem.cheia']); break
    case 'galeria': variante = itens.length >= 3 ? rodar(['galeria.mosaico', 'galeria.grade']) : por('galeria.grade'); break
    case 'equipe': variante = itens.length > 4 && !story ? por('equipe.lista') : por('equipe.grade'); break
    case 'encerramento': variante = itens.length && !story && estilo !== 'ousado' ? por('encerramento.contato') : por('encerramento.centrado'); break
    case 'cta': variante = estilo === 'minimal' ? por('cta.botao') : rodar(['cta.botao', 'cta.faixa']); break
    case 'comparativo': variante = /meta|objetivo|previsto/i.test(itens[0] ?? '') ? por('comparativo.meta') : por('comparativo.crescimento'); break
    case 'funil': variante = rodar(['funil.barras', 'funil.degraus']); break
    case 'tabela': variante = /^(pos|#|rank|n[ºo°]|lugar|coloca)/i.test(itens[0] ?? '') ? por('tabela.ranking') : por('tabela.simples'); break
    case 'kpis': variante = itens.some((x) => /\|\s*(de|atual|hoje)\s/i.test(x)) || /proje|meta/i.test(`${t.rotulo} ${t.texto}`) ? por('kpis.metas') : por('kpis.painel'); break
    case 'roadmap': variante = itens.length <= 5 && !story ? por('roadmap.colunas') : por('roadmap.linhas'); break
    default: variante = variantes[0]!.id
  }
  if (t.tipo === 'grafico') {
    // evolução no tempo → linha; partes de um todo (segmentos, canais) → participação
    const tempo = itens.length >= 2 && itens.every((x) => /\|\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|t[1-4]|q[1-4]|s[1-2]|\d{4}|semana|m[eê]s)/i.test(x))
    if (tempo && itens.length >= 3) variante = por('grafico.linha')
    else if (/segment|particip|canal|canais|regi|categoria|produto/i.test(`${t.titulo} ${t.rotulo} ${t.texto}`)) variante = por('grafico.participacao')
  }
  const daDirecao = o.direcao ? varianteDaDirecao(t.tipo, o.direcao) : null
  if (daDirecao && variantes.some((v) => v.id === daDirecao)) variante = daDirecao
  // o estilo tem composição própria: variantes preferidas por componente (suíço: capa tipográfica; luxo: centrada…)
  const regras = regrasDe(tema)
  const preferidas = (regras.variantes[t.tipo] ?? []).filter((id) => variantes.some((v) => v.id === id))
  if (preferidas.length && !daDirecao) variante = preferidas[o.ocorrencia % preferidas.length]!

  const base: Fundo = tema.base
  const oposto: Fundo = base === 'claro' ? 'escuro' : 'claro'
  const capa: Fundo = estilo === 'minimal' && tema.capa === 'acento' ? base : tema.capa
  let fundo: Fundo
  switch (t.tipo) {
    case 'capa':
    case 'encerramento': fundo = capa; break
    case 'secao': fundo = variante === 'secao.faixa' ? 'acento' : estilo === 'minimal' ? base : oposto; break
    case 'conceito': fundo = estilo === 'minimal' ? base : o.ocorrencia % 2 === 0 ? oposto : estilo === 'ousado' ? 'acento' : base; break
    case 'citacao': fundo = variante === 'citacao.grande' && estilo !== 'minimal' ? oposto : base; break
    case 'cta': fundo = estilo === 'minimal' ? base : variante === 'cta.faixa' ? 'acento' : oposto; break
    case 'paleta': fundo = base; break
    default: fundo = base
  }
  // estilos sem telas de acento (luxo, acadêmico, vidro…): a superfície oposta faz o respiro
  if (regras.semAcento && fundo === 'acento') fundo = oposto
  // ritmo: duas telas de "respiro" seguidas com o mesmo fundo forte viram a superfície base
  if (o.anterior && fundo !== base && o.anterior.fundo === fundo && t.tipo !== 'encerramento') fundo = base
  // o fundo que o pedido dá para a tela ("capa com fundo azul-marinho", "fundo azul e tipografia branca") manda
  const fundoPedido = o.direcao ? fundoDaDirecao(o.direcao) : null
  if (fundoPedido && ['capa', 'encerramento', 'secao', 'conceito', 'citacao', 'cta'].includes(t.tipo)) fundo = regras.semAcento && fundoPedido === 'acento' ? oposto : fundoPedido

  const decoracao: Decoracao = estilo === 'minimal' ? 'nenhuma' : estilo === 'ousado' ? 'marcante' : 'sutil'
  const centro = ['capa.centrada', 'conceito.enfase', 'encerramento.centrado', 'cta.faixa'].includes(variante)
  const enfase = estilo !== 'minimal' && ['capa', 'conceito', 'cta'].includes(t.tipo) && variante !== 'capa.tipografica' ? enfaseLocal(t.titulo) : ''
  const destaque = t.tipo === 'precos' ? (itens.length >= 3 ? 1 : itens.length - 1) : t.tipo === 'linhaTempo' && itens.length > 2 ? itens.length - 1 : -1
  return {
    tipo: t.tipo,
    variante,
    fundo,
    alinhamento: centro ? 'centro' : 'esquerda',
    rotulo: (t.rotulo ?? '').trim().toLowerCase() === t.titulo.trim().toLowerCase() ? '' : t.rotulo || ROTULO_PADRAO[t.tipo] || '',
    titulo: t.titulo,
    enfase,
    texto: t.texto,
    itens,
    destaque,
    imagem: '',
    decoracao,
    notas: t.notas,
  }
}
