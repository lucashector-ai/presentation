/**
 * Roteiro local (sem IA) para um pedido com estrutura explícita: uma tela para cada tela pedida, na ordem, com os
 * títulos e textos dados e o componente que a tela pede (funil, tabela, linha, barras proporcionais, meta ×
 * realizado, painel de indicadores, roadmap, alertas). Os números vêm dos dados do próprio pedido, sem alteração
 * (só a forma compacta: "R$ 12.400.000" → "R$ 12,4 mi"); o que é calculado (trimestre anterior, receita por
 * contrato) leva "estimado"/"calculado". Roda no modo demo e completa um roteiro do modelo que veio com telas a menos.
 * Puro: sem rede, sem DOM.
 */
import type { TipoTela } from './designSystem'
import { analisarPedido, radicais, type TelaPedida } from './analisePedido'

export { radicais }
import { compactar, formatarComo, formatarPct, lerNumero, valorDe } from './numeros'
import type { RoteiroBruto } from './pedido'

type Tela = RoteiroBruto['telas'][number]

// ---------------------------------------------------------------- dados do pedido

export interface Dado {
  /** Bloco em que o dado aparece ("Receita mensal", "Funil comercial"); vazio = solto. */
  bloco: string
  rotulo: string
  valor: string
  /** Posição num ranking numerado ("1. Ana Souza: …"). */
  posicao: number | null
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const limpar = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const semPonto = (s: string) => s.replace(/[.;]+$/, '').trim()
const capitalizar = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

/** Dados "Rótulo: valor" do pedido (fora das telas), agrupados pelo cabeçalho do bloco. */
export function dadosDoPedido(texto: string): Dado[] {
  const linhas = texto.replace(/\r/g, '').split('\n')
  const dados: Dado[] = []
  let bloco = ''
  for (const bruta of linhas) {
    const linha = limpar(bruta)
    if (!linha) continue
    if (/^(?:#{1,6}\s*)?(?:slide|tela|l[aâ]mina)\s*\d/i.test(linha)) break
    const item = /^(?:[-*•–]|(\d{1,2})[.)])\s+(.*)$/.exec(linha)
    const corpo = item ? item[2]! : linha
    const par = /^([^:]{2,60}):\s*(.+)$/.exec(corpo)
    if (!item && /:$/.test(linha) && linha.length <= 60) { bloco = linha.replace(/:$/, ''); continue }
    if (par && /\d/.test(par[2]!) && !/#[0-9a-f]{3,6}\b/i.test(par[2]!)) {
      dados.push({ bloco, rotulo: par[1]!.trim(), valor: semPonto(par[2]!.trim()), posicao: item?.[1] ? Number(item[1]) : null })
      continue
    }
    // linha comum fora de lista fecha o bloco (o próximo cabeçalho abre outro)
    if (!item && !par) bloco = ''
  }
  return dados
}

/** Fração dos radicais de `consulta` que aparecem em `alvo`. */
function parecido(consulta: string, alvo: string): number {
  const q = radicais(consulta)
  if (!q.length) return 0
  const a = new Set(radicais(alvo))
  return q.filter((x) => a.has(x)).length / q.length
}

/**
 * O dado que melhor responde à consulta, ou null. Precisa cobrir `minimo` da consulta pelo rótulo; no empate,
 * ganha o rótulo mais enxuto ("Contratos fechados" antes de "Ticket médio dos contratos fechados").
 */
function acharDado(dados: Dado[], consulta: string, minimo = 0.5, filtro: (d: Dado) => boolean = () => true): Dado | null {
  let melhor: Dado | null = null
  let nota = -1
  for (const d of dados.filter(filtro)) {
    const cobre = parecido(consulta, d.rotulo)
    if (cobre < minimo) continue
    const n = cobre + parecido(d.rotulo, consulta) * 0.25 + parecido(consulta, d.bloco) * 0.1
    if (n > nota) { nota = n; melhor = d }
  }
  return melhor
}

/** O bloco de dados que a tela pede (o nome do bloco mais parecido com o nome e o texto da tela). */
function acharBloco(dados: Dado[], tela: TelaPedida): Dado[] {
  const blocos = [...new Set(dados.map((d) => d.bloco).filter(Boolean))]
  const alvo = `${tela.nome} ${tela.direcao.join(' ')}`
  let melhor = ''
  let nota = 0
  for (const b of blocos) {
    const n = parecido(b, alvo) + parecido(b, tela.nome) * 0.5
    if (n > nota) { nota = n; melhor = b }
  }
  return nota >= 0.5 ? dados.filter((d) => d.bloco === melhor) : []
}

// ---------------------------------------------------------------- número + legenda

const RE_VALOR = /^\s*([+\-−]?\s*(?:R\$\s*|US\$\s*|€\s*)?\d[\d.,]*\s*(?:%|mi\b|milh(?:ão|ões)|bi\b|bilh(?:ão|ões)|mil\b|k\b)?)\s*(.*)$/i

/** "R$ 12,4 milhões de receita" → ["R$ 12,4 mi", "receita"]; sem número no começo, null. */
function valorELegenda(s: string): [string, string] | null {
  const m = RE_VALOR.exec(s)
  if (!m) return null
  const valor = m[1]!.replace(/\s*milh(?:ão|ões)\b/i, ' mi').replace(/\s*bilh(?:ão|ões)\b/i, ' bi').replace(/\s+/g, ' ').trim()
  const legenda = semPonto(m[2]!.replace(/^(?:de|do|da|em)\s+/i, ''))
  return [compactar(valor), capitalizar(legenda)]
}

/** Números citados no meio de uma frase com as palavras que os seguem ("185 novos clientes conquistados"). */
function numerosNaFrase(s: string): [string, string][] {
  const saida: [string, string][] = []
  for (const m of s.matchAll(/((?:R\$\s*)?\d[\d.,]*\s*(?:%|mi\b|milh(?:ão|ões))?)\s+((?:[\p{L}-]+\s?){1,3})/gu)) {
    const palavras = m[2]!.trim().split(/\s+/).filter((p) => !/^(e|o|a|de|do|da)$/i.test(p))
    if (!palavras.length) continue
    saida.push([compactar(m[1]!.trim()), capitalizar(semPonto(palavras.join(' ')))])
  }
  return saida
}

/** Forma compacta na unidade da lista: com valores em milhões, os de centenas de mil também viram "mi". */
const compactarLista = (valores: string[]) => {
  const emMilhoes = valores.some((v) => Math.abs(valorDe(v) ?? 0) >= 1e6)
  return (v: string) => compactar(v, emMilhoes ? 1e5 : 1e6)
}

// ---------------------------------------------------------------- uma tela

const tela = (tipo: TipoTela, rotulo: string, titulo: string, texto = '', itens: string[] = [], notas = ''): Tela => ({ tipo, rotulo, titulo, texto, itens, notas })

/** Responsável fictício por função, pelo assunto da prioridade (o pedido pede responsáveis por função). */
function responsavel(s: string): string {
  const t = semAcento(s.toLowerCase())
  if (/lead|marketing|campanha|qualifica/.test(t)) return 'Marketing'
  if (/pipeline|previs|forecast|analise|dados/.test(t)) return 'Operações de receita'
  if (/enterprise|mid market|segment|conta|key account/.test(t)) return 'Gerência de contas'
  if (/convers|proposta|acompanhamento|vendas|comercial/.test(t)) return 'Gerência comercial'
  return 'Liderança comercial'
}

/** "Aumentar a conversão por meio de X" → ["Aumentar a conversão", "Por meio de X"]. */
function dividirPrioridade(s: string): [string, string] {
  const m = /^(.{12,70}?)\s+(por meio de|com|via|para|atrav[eé]s de)\s+(.{8,})$/i.exec(s)
  return m ? [m[1]!, capitalizar(`${m[2]} ${m[3]}`)] : [s, '']
}

interface Ctx { dados: Dado[]; marca: string; periodo: string }

function montarTelaPedida(t: TelaPedida, i: number, total: number, ctx: Ctx): Tela {
  const nome = t.nome || `Tela ${t.numero}`
  const tudo = semAcento(`${t.nome} ${t.direcao.join(' ')}`.toLowerCase())
  const titulo = t.titulo || nome
  // a direção do pedido ("Crie um gráfico de linhas…") é instrução de desenho, não fala do apresentador
  const notas = ''
  const { dados } = ctx
  const dado = (q: string, min?: number) => acharDado(dados, q, min)
  if (i === 0 || /^capa\b/.test(tudo)) return tela('capa', ctx.marca, titulo, t.subtitulo || ctx.periodo, [], notas)
  if (i === total - 1 || /encerramento|fechamento|agradecimento/.test(tudo)) return tela('encerramento', '', titulo, t.subtitulo, [], notas)

  // funil: o bloco do funil, do topo para o fundo
  if (/funil/.test(tudo)) {
    const bloco = acharBloco(dados, t).filter((d) => valorDe(d.valor) !== null)
    if (bloco.length >= 3) {
      const [a, b] = [bloco[0]!, bloco[bloco.length - 1]!]
      const conv = (valorDe(b.valor)! / valorDe(a.valor)!) * 100
      return tela('funil', 'Funil', titulo, `Conversão total de ${formatarPct(conv)}: ${b.valor} ${b.rotulo.toLowerCase()} de ${a.valor} ${a.rotulo.toLowerCase()}.`, bloco.map((d) => `${d.rotulo}|${d.valor}`), notas)
    }
  }
  // ranking/tabela: linhas numeradas "Nome: valor, N coisa"
  if (/ranking|tabela|vendedores|classifica/.test(tudo)) {
    const bloco = acharBloco(dados, t).filter((d) => d.posicao !== null)
    if (bloco.length >= 2) {
      const colunas: string[] = []
      const cl = compactarLista(bloco.flatMap((d) => d.valor.split(/,\s*/)))
      const linhas = bloco.map((d) => {
        const partes = d.valor.split(/,\s*/)
        const celulas = partes.map((p, k) => {
          const vl = valorELegenda(p)
          if (!vl) return p.trim()
          const [v, leg] = vl
          colunas[k] ??= leg || (/R\$/.test(v) ? 'Receita' : 'Valor')
          return /R\$|US\$|€/.test(v) ? cl(p.trim()) : v
        })
        return [String(d.posicao), d.rotulo, ...celulas].join('|')
      })
      const nomeLinha = /vendedor/.test(tudo) ? 'Vendedor' : /produto/.test(tudo) ? 'Produto' : 'Nome'
      return tela('tabela', 'Ranking', titulo, '', [['Posição', nomeLinha, ...colunas].join('|'), ...linhas], notas)
    }
  }
  // metas futuras: painel marcado como projeção, com o ponto de partida de cada meta
  if (/objetivo|metas? (?:para|do|fictic)|projec|proximo trimestre|futur/.test(tudo) && t.itens.length >= 2) {
    return tela('kpis', 'Projeção', titulo, 'Metas propostas para o próximo trimestre: projeções, não resultados realizados.', t.itens.slice(0, 6).map((it) => {
      const rotulado = /^([^:]{2,40}):\s*(.+)$/.exec(it)
      let valor = ''
      let indicador = ''
      if (rotulado && valorELegenda(rotulado[2]!)) { valor = valorELegenda(rotulado[2]!)![0]; indicador = rotulado[1]! }
      else {
        const m = /((?:R\$\s*)?\d[\d.,]*\s*(?:%|milh(?:ão|ões)|mi\b)?)/.exec(it)
        if (m) {
          valor = compactar(m[1]!.replace(/\s*milh(?:ão|ões)/, ' mi').trim())
          const minimo = /pelo menos|no m[ií]nimo/i.test(it)
          indicador = capitalizar(it.replace(m[1]!, ' ').replace(/^(atingir|conquistar|alcan[cç]ar|chegar a|aumentar|ter)\s+/i, '').replace(/pelo menos|no m[ií]nimo/i, '').replace(/^\s*(de|em)\s+/i, '').replace(/\s+/g, ' ').trim()) + (minimo ? ' · mínimo' : '')
        } else {
          const verbo = /^(\p{L}+)\s+(.*)$/u.exec(it)
          return verbo ? `${capitalizar(verbo[1]!)}|${capitalizar(verbo[2]!.replace(/^(a|o|as|os)\s+/i, ''))}|meta qualitativa` : `${it}|`
        }
      }
      const atual = dado(indicador, 0.5)
      return `${valor}|${indicador}${atual ? `|de ${compactar(atual.valor)}` : ''}`
    }), notas)
  }
  // meta × realizado
  if (/meta/.test(tudo) && /realizad/.test(tudo)) {
    const nums = t.direcao.join(' ').match(/(?:R\$\s*)?\d[\d.,]*\s*(?:milh(?:ão|ões)|mi\b)?/g)?.map((x) => compactar(x.replace(/\s*milh(?:ão|ões)/, ' mi'))) ?? []
    const meta = nums[0] ?? (dado('meta') ? compactar(dado('meta')!.valor) : '')
    const real = nums[1] ?? (dado('receita total') ? compactar(dado('receita total')!.valor) : '')
    if (valorDe(meta) !== null && valorDe(real) !== null) {
      const analise = /an[aá]lise curta sobre (?:a |o )?([^.]+)/i.exec(t.direcao.join(' '))?.[1]
      const gap = valorDe(meta)! - valorDe(real)!
      // o gap e o % atingido a tela calcula e mostra; o texto fica com a leitura pedida
      const texto = analise ? `Leitura: ${analise}.` : gap > 0 ? 'Abaixo da meta do período.' : 'Acima da meta do período.'
      return tela('comparativo', 'Meta e realizado', titulo, texto, [`Meta|${meta}`, `Realizado|${real}`], notas)
    }
  }
  // período anterior × atual, com o anterior calculado pelo crescimento informado
  const periodos = /\b([QT][1-4])\s*(?:e|x|×|vs\.?|versus)\s*([QT][1-4])(?:\s+de)?\s*(\d{4})?/i.exec(`${t.nome} ${t.direcao.join(' ')}`)
  if (periodos && /crescimento|comparativo|variac/.test(tudo)) {
    const cresc = acharDado(dados, 'crescimento', 0.5)
    const atual = dado('receita total')
    const g = cresc ? lerNumero(cresc.valor) : null
    if (atual && g && /%/.test(cresc!.valor)) {
      const v = valorDe(atual.valor)!
      const modelo = compactar(atual.valor)
      const anterior = v / (1 + g.base / 100)
      const ano = periodos[3] ? ` ${periodos[3]}` : ''
      return tela('comparativo', 'Crescimento', titulo, `${periodos[1]!.toUpperCase()} estimado a partir do crescimento informado de ${formatarPct(g.base)}: ${formatarComo(v, modelo)} ÷ ${(1 + g.base / 100).toLocaleString('pt-BR')}.`, [`${periodos[1]!.toUpperCase()}${ano} · estimado|${formatarComo(anterior, modelo, 1)}`, `${periodos[2]!.toUpperCase()}${ano}|${modelo}`], notas)
    }
  }
  // evolução no tempo (linha) e participação (barras proporcionais): o bloco de dados da tela
  if (/linha|evoluc|mensal|segment|participac|proporc|barras/.test(tudo)) {
    const bloco = acharBloco(dados, t).filter((d) => valorDe(d.valor) !== null)
    if (bloco.length >= 2) {
      const participacao = /segment|participac|proporc/.test(tudo)
      const soma = bloco.reduce((s, d) => s + valorDe(d.valor)!, 0)
      const maior = bloco.reduce((m, d) => (valorDe(d.valor)! > valorDe(m.valor)! ? d : m), bloco[0]!)
      const texto = participacao
        ? `${maior.rotulo} responde por ${formatarPct((valorDe(maior.valor)! / soma) * 100)} do total de ${formatarComo(soma, compactar(maior.valor))}.`
        : `De ${compactar(bloco[0]!.valor)} em ${bloco[0]!.rotulo.toLowerCase()} para ${compactar(bloco[bloco.length - 1]!.valor)} em ${bloco[bloco.length - 1]!.rotulo.toLowerCase()}: ${formatarPct((valorDe(bloco[bloco.length - 1]!.valor)! / valorDe(bloco[0]!.valor)! - 1) * 100, true)} no período.`
      const cl = compactarLista(bloco.map((d) => d.valor))
      return tela('grafico', participacao ? 'Segmentos' : 'Evolução', titulo, texto, bloco.map((d) => `${cl(d.valor)}|${d.rotulo}`), notas)
    }
  }
  // plano de ação
  if (/roadmap|plano de acao|prioridade/.test(tudo) && t.itens.length >= 2) {
    return tela('roadmap', 'Plano de ação', titulo, '', t.itens.slice(0, 5).map((it) => { const [a, b] = dividirPrioridade(it); return `${a}|${b}|${responsavel(it)}` }), notas)
  }
  // pontos de atenção, com o dado que sustenta cada um
  if (/aten[cç]|desafio|risco|alerta/.test(tudo) && t.itens.length >= 2) {
    return tela('alertas', 'Atenção', titulo, '', t.itens.slice(0, 5).map((it) => {
      const entre = /entre\s+(.+?)\s+e\s+(.+)$/i.exec(it)
      if (entre) {
        const [a, b] = [dado(entre[1]!), dado(entre[2]!)]
        if (a && b && valorDe(a.valor) && valorDe(b.valor)) return `${it}|${a.rotulo}: ${a.valor} → ${b.rotulo}: ${b.valor} (${formatarPct((valorDe(b.valor)! / valorDe(a.valor)!) * 100)})`
      }
      if (/menor partic|menos partic/i.test(it)) {
        const seg = dados.filter((d) => /segment/i.test(d.bloco) && valorDe(d.valor) !== null).sort((x, y) => valorDe(x.valor)! - valorDe(y.valor)!).slice(0, 2)
        const cl = compactarLista(dados.filter((d) => /segment/i.test(d.bloco)).map((d) => d.valor))
        if (seg.length) return `${it}|${seg.map((d) => `${d.rotulo}: ${cl(d.valor)}`).join(' · ')}`
      }
      const d = dado(it, 0.34)
      return d ? `${it}|${d.rotulo}: ${compactar(d.valor)}` : `${it}|`
    }), notas)
  }
  // números: itens com valor no começo ("R$ 12,4 milhões de receita") ou números citados na frase
  const comValor = t.itens.map(valorELegenda).filter((x): x is [string, string] => !!x)
  if (comValor.length >= 2 && comValor.length === t.itens.length) return tela('numeros', 'Em números', titulo, '', comValor.slice(0, 4).map(([v, l]) => `${v}|${l}`), notas)
  // indicadores derivados ("Receita por contrato", "Relação entre oportunidades e fechamentos")
  if (/indicador|eficien|produtiv|kpi/.test(tudo) && t.itens.length >= 2) {
    const itens = t.itens.slice(0, 6).map((it) => {
      const direto = dado(it, 0.6)
      if (direto) return `${compactar(direto.valor)}|${it}`
      const por = /^(.+?)\s+por\s+(.+)$/i.exec(it)
      const entre = /rela[cç][aã]o entre\s+(.+?)\s+e\s+(.+)$/i.exec(it)
      if (por) {
        const [a, b] = [dado(`${por[1]} total`, 0.5) ?? dado(por[1]!, 0.5), dado(por[2]!, 0.5)]
        if (a && b && valorDe(b.valor)) return `${formatarComo(valorDe(a.valor)! / valorDe(b.valor)!, a.valor.includes('R$') ? 'R$ 1' : '1')}|${it}|calculado: ${compactar(a.valor)} ÷ ${b.valor}`
      }
      if (entre) {
        const [a, b] = [dado(entre[1]!, 0.5), dado(entre[2]!, 0.5) ?? dado(`contratos ${entre[2]}`, 0.5)]
        if (a && b && valorDe(b.valor)) return `${(valorDe(a.valor)! / valorDe(b.valor)!).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} : 1|${it}|${a.valor} ${a.rotulo.toLowerCase()} para ${b.valor} ${b.rotulo.toLowerCase()}`
      }
      return null
    }).filter((x): x is string => !!x)
    if (itens.length >= 2) return tela('kpis', 'Eficiência', titulo, '', itens, notas)
  }
  if (t.itens.length >= 2) {
    // destaques: cada item ganha o número que o sustenta (do próprio texto ou dos dados)
    const itens = t.itens.slice(0, 4).map((it) => {
      const n = numerosNaFrase(it)[0] ?? (/(\d[\d.,]*\s*%)/.exec(it) ? [/(\d[\d.,]*\s*%)/.exec(it)![1]!.replace(/\s+/g, ''), it] as [string, string] : null)
      if (n) return `${/%$/.test(n[0]) && /cresc/i.test(it) ? '+' : ''}${n[0]}|${it}`
      // "Setembro como melhor mês" → o dado de setembro; "segmentos Enterprise e Mid Market" → a soma dos dois
      const citados = dados.filter((d) => valorDe(d.valor) !== null && new RegExp(`\\b${d.rotulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(it))
      if (citados.length) {
        const soma = citados.reduce((s, d) => s + valorDe(d.valor)!, 0)
        return `${formatarComo(soma, compactar(citados[0]!.valor))}|${it}`
      }
      return `${it}|`
    })
    if (itens.every((x) => /\d/.test(x.split('|')[0]!))) return tela('numeros', 'Destaques', titulo, '', itens, notas)
    return tela('cartoes', 'Destaques', titulo, '', itens.map((x) => (/\d/.test(x.split('|')[0]!) ? `${x.split('|')[1]}|${x.split('|')[0]}` : x)), notas)
  }
  const naFrase = numerosNaFrase(t.direcao.join(' ')).filter(([v]) => !/^\d{4}$/.test(v))
  if (naFrase.length >= 2) return tela('numeros', 'Em números', titulo, '', naFrase.slice(0, 4).map(([v, l]) => `${v}|${l}`), notas)
  return tela('conceito', '', titulo, t.subtitulo || semPonto(t.direcao[0] ?? ''), [], notas)
}

/** Roteiro local de um pedido com estrutura explícita (null = o pedido não tem estrutura). */
export function roteiroDaEstrutura(prompt: string, opcoes: { marca?: string } = {}): RoteiroBruto | null {
  const a = analisarPedido(prompt)
  if (!a.estrutura.length) return null
  const dados = dadosDoPedido(prompt)
  const periodo = /\b(?:per[ií]odo|trimestre|m[eê]s|ano)\s*:\s*([^.\n]+)/i.exec(prompt)?.[1]?.trim() ?? ''
  const ctx: Ctx = { dados, marca: opcoes.marca || a.marca, periodo: periodo.slice(0, 80) }
  const telas = a.estrutura.map((t, i) => montarTelaPedida(t, i, a.estrutura.length, ctx))
  const titulo = a.estrutura[0]!.titulo || prompt.split('\n')[0]!.split(/\s[|·—–]\s/)[0]!.trim()
  return { titulo: titulo.slice(0, 120) || 'Nova apresentação', telas }
}

/** A tela local para a tela pedida de índice `i` (completar um roteiro do modelo que veio com telas a menos). */
export function telaDaEstrutura(prompt: string, i: number): Tela | null {
  return roteiroDaEstrutura(prompt)?.telas[i] ?? null
}
