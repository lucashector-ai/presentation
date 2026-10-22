/**
 * Regra do 8 (lib/ia/grade8.ts): toda geometria que a IA gera cai na grade de 8 px — posições, larguras e alturas,
 * gaps e paddings de auto layout — em todos os estilos × componentes × variantes (slides e story), no pedido real da
 * Nexora (lib/ia/fixtures/prompt-nexora-resultados.md) pelo gerador local (modo demo) e com o Claude simulado
 * (servidor local, nada sai da máquina), em slides, story e explorar. Exceções conferidas à parte: espessura de traços
 * (até 6 px), comprimento das barras de dados, marcadores no ponto do dado e itens centralizados em meio passo (4 px).
 */
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calcularLayout } from '@/lib/editor/autolayout'
import type { Camada as CamadaCena } from '@/lib/scene/schema'
import { validarDocumento } from '@/lib/scene/validate'
import { direcoesDoPedido } from './analisePedido'
import { MAX_TELAS_POR_PEDIDO_DESIGN, PedidoDesignSchema, type DesenhoModelo } from './design'
import { COMPONENTES, ESCALA_ESPACO, GRADE, TEMAS, TIPOS_TELA, resolverTema, type TipoTela } from './designSystem'
import { desenharLocal } from './desenhoLocal'
import { acimaNaGrade, alinharNaGrade, colunasNaGrade, entrelinhaNaGrade, espacoNaGrade, naGrade, repartirNaGrade, type CamadaGrade } from './grade8'
import { gerarRoteiroLocal } from './local'
import { montarTela, type ContextoMontagem, type Estilo, type TelaDesenhada } from './montagem'
import { PedidoRoteiroSchema } from './pedido'
import { montarDocumento, type Roteiro } from './roteiro'

type C = CamadaGrade & { type: string; parentId?: string }
interface Layout { direction: string; gap: number; rowGap?: number; gapAuto: boolean; padding: Record<'top' | 'right' | 'bottom' | 'left', number>; alignX: string; alignY: string }

const de8 = (v: number) => Math.abs(v / 8 - Math.round(v / 8)) < 1e-6
const de4 = (v: number) => Math.abs(v / 4 - Math.round(v / 4)) < 1e-6

/**
 * O que está fora da grade numa tela montada (lista vazia = tudo no 8). Exceções: a espessura de traços de até
 * 6 px (e, no comprimento, a posição de um fio que liga centros pode cair em 4), o comprimento das barras de dados e
 * do "gap" entre meta e realizado e o lado do logo que segue a proporção do arquivo (um eixo é medida exata; o outro
 * fica na grade), os marcadores sobre os pontos do gráfico
 * de linha e o meio passo (4 px) de um item centralizado pelo pai, que o conteúdo dele herda.
 */
function foraDaGrade(layers: C[], variante = ''): string[] {
  const porId = new Map(layers.map((l) => [l.id, l]))
  const r: string[] = []
  // meio passo herdado: um item centralizado a 4 px leva o conteúdo junto (a posição conta a partir dele)
  const meio = new Map<string, { x: number; y: number }>()
  const deslocamento = (l: C): { x: number; y: number } => {
    const m = meio.get(l.id)
    if (m) return m
    const pai = typeof l.parentId === 'string' ? porId.get(l.parentId) : undefined
    const base = pai ? deslocamento(pai) : { x: 0, y: 0 }
    const lay = pai && !l.absolute ? (pai.layout as Layout | undefined) : undefined
    const d = { ...base }
    for (const e of ['x', 'y'] as const) {
      const centro = !!lay && (e === 'x' ? lay.alignX : lay.alignY) === 'center'
      if (centro && !de8(l[e] - base[e]) && de4(l[e] - base[e])) d[e] = base[e] + 4
    }
    meio.set(l.id, d)
    return d
  }
  for (const l of layers) {
    if (variante === 'grafico.linha' && /^marcador-/.test(l.id)) continue
    const base = deslocamento(l)
    const dado = /^(barra|gap|logo)-/.test(l.id)
    const foraDoEixo: string[][] = []
    for (const [pos, tam] of [['x', 'width'], ['y', 'height']] as const) {
      const fora: string[] = []
      const traco = l.type === 'shape' && l[tam] <= 6
      if (traco) continue
      if (!de8(l[pos] - base[pos]) && !(l.type === 'shape' && Math.min(l.width, l.height) <= 6 && de4(l[pos]))) fora.push(`${l.id}.${pos} = ${l[pos]}`)
      if (!de8(l[tam])) fora.push(`${l.id}.${tam} = ${l[tam]}`)
      if (fora.length) foraDoEixo.push(fora)
    }
    // barra de dados ou logo: um eixo é medida exata (o valor, a proporção do arquivo); o outro fica na grade
    if (!(dado && foraDoEixo.length === 1)) r.push(...foraDoEixo.flat())
    const lay0 = l.layout as Layout | undefined
    if (lay0) {
      for (const [k, v] of Object.entries({ gap: lay0.gap, rowGap: lay0.rowGap ?? 0, ...lay0.padding })) if (!de8(v)) r.push(`${l.id}.${k} = ${v}`)
    }
    if (l.type === 'text') {
      if (typeof l.padding === 'number' && !de8(l.padding)) r.push(`${l.id}.padding = ${l.padding}`)
      const lh = Number(l.fontSize) * Number(l.lineHeight)
      if (Math.abs(lh / 4 - Math.round(lh / 4)) > 0.01) r.push(`${l.id}: entrelinha ${lh.toFixed(2)} px`)
    }
  }
  return r
}

/** O resultado já vem resolvido: o auto layout do editor não move nada. */
function resolvido(layers: C[]): boolean {
  const z = layers.map((l, i) => ({ ...l, z: i })) as unknown as CamadaCena[]
  const de = calcularLayout(z)
  return de === z || (de as unknown as C[]).every((l, i) => l.x === layers[i]!.x && l.y === layers[i]!.y && l.width === layers[i]!.width && l.height === layers[i]!.height)
}

describe('escala e utilitários da grade', () => {
  it('a escala de espaçamento do design system só tem múltiplos de 8', () => {
    expect(GRADE).toBe(8)
    for (const v of ESCALA_ESPACO) expect(v % 8).toBe(0)
  })

  it('arredonda para a grade: monótono, gaps que não somem e altura de texto que não encolhe', () => {
    expect([0, 3.9, 4, 11.9, 12, 1259, 1920].map(naGrade)).toEqual([0, 0, 8, 8, 16, 1256, 1920])
    const amostra = Array.from({ length: 400 }, (_, i) => i * 3.7 - 50)
    for (let i = 1; i < amostra.length; i++) expect(naGrade(amostra[i]!)).toBeGreaterThanOrEqual(naGrade(amostra[i - 1]!))
    expect([0, 2, 6, 12, 14, 20, 26, 36, 45].map(espacoNaGrade)).toEqual([0, 8, 8, 8, 16, 16, 24, 32, 48])
    expect(acimaNaGrade(40.0008)).toBe(40)
    expect(acimaNaGrade(41)).toBe(48)
  })

  it('entrelinha em 8 nos corpos grandes e em 4 nos pequenos, sem ficar abaixo do corpo', () => {
    for (const [t, lh] of [[176, 1.02], [58, 1.02], [64, 1.06], [32, 1.42], [29, 1.42], [20, 1.3], [16, 1.42], [340, 0.62]] as const) {
      const px = t * entrelinhaNaGrade(t, lh)
      expect(Math.abs(px / (t >= 40 ? 8 : 4) - Math.round(px / (t >= 40 ? 8 : 4))), `${t}/${lh}`).toBeLessThan(0.01)
      if (lh >= 1) expect(px).toBeGreaterThanOrEqual(t - 0.01)
    }
  })

  it('colunas iguais e na grade que fecham a largura (a calha mais perto da pedida)', () => {
    expect(colunasNaGrade(1664, 3, 32)).toEqual({ largura: 528, gap: 40 })
    expect(colunasNaGrade(1664, 4, 32)).toEqual({ largura: 392, gap: 32 })
    expect(colunasNaGrade(1664, 2, 32)).toEqual({ largura: 816, gap: 32 })
    for (const w of [1664, 1712, 1600, 904, 1472]) for (const n of [1, 2, 3, 4, 5, 6]) {
      const c = colunasNaGrade(w, n, 32)
      expect(c.largura % 8 + c.gap % 8).toBe(0)
      expect(n * c.largura + (n - 1) * c.gap).toBeLessThanOrEqual(w)
      expect(w - (n * c.largura + (n - 1) * c.gap)).toBeLessThan(8 * n)
    }
  })

  it('reparte uma largura em partes proporcionais na grade, somando exatamente o total', () => {
    const p = repartirNaGrade(1376, [10, 21, 14, 5])
    expect(p.reduce((a, b) => a + b, 0)).toBe(1376)
    for (const v of p) expect(v % 8).toBe(0)
  })
})

describe('passo final da montagem (alinharNaGrade)', () => {
  let seq = 0
  const uid = (p: string) => `${p}-${++seq}`

  it('bordas iguais continuam iguais, nada se sobrepõe, nada sai da tela e o auto layout fica resolvido', () => {
    const L: C[] = [
      { id: 'a', type: 'shape', x: 101, y: 99, width: 333.3, height: 201, fill: '#000' },
      { id: 'b', type: 'shape', x: 101, y: 302, width: 333.3, height: 50, fill: '#000' },
      { id: 'c', type: 'shape', x: 437.3, y: 99, width: 200, height: 253, fill: '#000' },
      { id: 'd', type: 'shape', x: 1850, y: 1040, width: 70, height: 40, fill: '#000' },
      { id: 'f', type: 'frame', x: 130, y: 501, width: 517, height: 1, sizingW: 'fixed', sizingH: 'hug', layout: { direction: 'vertical', gap: 22, gapAuto: false, padding: { top: 14, right: 14, bottom: 14, left: 14 }, alignX: 'start', alignY: 'start' } },
      { id: 't1', type: 'shape', x: 0, y: 0, width: 300, height: 45, parentId: 'f', fill: '#000' },
      { id: 'fio', type: 'shape', x: 0, y: 0, width: 300, height: 2, parentId: 'f', sizingW: 'fill', fill: '#000' },
      { id: 't2', type: 'shape', x: 0, y: 0, width: 300, height: 61, parentId: 'f', fill: '#000' },
    ]
    const R = alinharNaGrade(L, { uid }) as C[]
    const p = (id: string) => R.find((l) => l.id === id)!
    expect(p('a').x).toBe(p('b').x)
    expect(p('a').x + p('a').width).toBe(p('b').x + p('b').width)
    expect(p('a').y).toBe(p('c').y)
    expect(p('a').x + p('a').width).toBeLessThanOrEqual(p('c').x)
    expect(p('a').y + p('a').height).toBeLessThanOrEqual(p('b').y)
    expect(p('d').x + p('d').width).toBeLessThanOrEqual(1920)
    expect(p('d').y + p('d').height).toBeLessThanOrEqual(1080)
    // o fio de 2 px no fluxo fica numa faixa de 8 px: o que vem depois continua na grade
    const fio = p('fio')
    expect(fio.height).toBe(2)
    expect(p(String(fio.parentId)).height).toBe(8)
    expect((p('f').layout as Layout).gap).toBe(24)
    expect(foraDaGrade(R)).toEqual([])
    expect(resolvido(R)).toBe(true)
  })

  it('barras de dados: comprimento exato, âncora na grade', () => {
    const L: C[] = [
      { id: 'barra-1', type: 'shape', x: 553, y: 601, width: 503.7, height: 46, fill: '#000' },
      { id: 'barra-2', type: 'shape', x: 300, y: 300, width: 64, height: 287.3, fill: '#000' },
    ]
    const R = alinharNaGrade(L, { uid, dados: new Map([['barra-1', { eixo: 'x', ancora: 'inicio' }], ['barra-2', { eixo: 'y', ancora: 'fim' }]]) }) as C[]
    expect(R[0]).toMatchObject({ x: 552, width: 503.7, y: 600, height: 48 })
    expect(R[1]!.height).toBe(287.3)
    expect(R[1]!.y + R[1]!.height).toBe(584)
  })
})

// ---------------------------------------------------------------- todos os estilos × componentes × variantes

const ITENS: Partial<Record<TipoTela, string[]>> = {
  agenda: ['O contexto do mercado|onde estamos e por que agora', 'A proposta|o que muda para o cliente', 'O plano de execução|como fazemos', 'Os números|tração e projeções'],
  lista: ['Diagnóstico completo da operação em duas semanas', 'Conceito e protótipo validado com clientes', 'Lançamento gradual com métricas semanais', 'Relatório de resultados para o conselho'],
  cartoes: ['Estratégia|posicionamento e mensagens-chave', 'Identidade|marca, tipografia e cores', 'Lançamento|plano de estreia em três cidades'],
  processo: ['Conecta|integração em minutos', 'Analisa|o que melhorar', 'Recomenda|ações por impacto', 'Entrega|resultados no primeiro mês'],
  numeros: ['R$ 4,2 bi|mercado endereçável', '+38%|engajamento depois do piloto', '2,4×|conversão', '6 sem.|até o lançamento'],
  grafico: ['3,2|Região Norte', '4,1|Região Sul', '2,7|Região Leste', '5,6|Região Oeste', '1,9|Centro'],
  comparacao: ['Hoje', 'Depois', 'Planilhas soltas', 'Painel único', 'Três dias para fechar', 'Uma tarde'],
  linhaTempo: ['Mar 2027|Piloto em três escolas', 'Jun 2027|Ajustes com professores', 'Set 2027|Expansão', 'Dez 2027|Relatório de impacto'],
  galeria: ['Embalagem|frente e verso', 'Fachada|loja da rua Augusta', 'Digital|site e aplicativo', 'Uniforme|equipe'],
  equipe: ['Ana Lima|CEO', 'Bruno Costa|CTO', 'Carla Dias|Design', 'Diego Rocha|Vendas', 'Elisa Prado|Financeiro'],
  precos: ['Essencial|R$ 4.900|Estratégia; Identidade', 'Completo|R$ 9.800|Tudo; Site; Lançamento', 'Sob medida|Consulte|Equipe dedicada'],
  paleta: ['Terracota|#B4532A', 'Argila|#EEE7DB', 'Grafite|#2B2B2B', 'Musgo|#5E6B3A'],
  cta: ['Agendar uma conversa', 'E-mail|ana@aurora.com', 'Telefone|+55 11 99999-0000'],
  encerramento: ['E-mail|ana@aurora.com', 'Site|aurora.com.br'],
  comparativo: ['Meta trimestral|R$ 13,5 mi', 'Receita realizada|R$ 12,4 mi'],
  funil: ['Leads gerados|5.200', 'Oportunidades|3.100', 'Propostas|1.480', 'Negociações|620', 'Contratos|260'],
  tabela: ['Posição|Vendedor|Receita|Novos clientes', '1|Ana Souza|R$ 1,82 mi|28', '2|Carlos Lima|R$ 1,54 mi|24', '3|Mariana Alves|R$ 1,31 mi|22', '4|Rafael Costa|R$ 1,12 mi|18'],
  kpis: ['R$ 47.692|Ticket médio|3,8;4,2;4,4', '17,6%|Conversão|+2,1 p.p. vs. Q2', 'R$ 15 mi|Receita-alvo|de R$ 12,4 mi', '88%|Satisfação'],
  roadmap: ['Aumentar a conversão|acompanhamento semanal|Vendas|Out 2026', 'Qualificar leads|pontuação compartilhada|Marketing|Nov 2026', 'Rotina de pipeline|previsão de receita|Operações|Dez 2026'],
  alertas: ['Meta não atingida|91,9% da meta', 'Conversão baixa|17,6% das propostas', 'Ciclo mais longo|94 dias no Enterprise'],
}

function telasDeTeste(story: boolean): TelaDesenhada[] {
  const r: TelaDesenhada[] = []
  for (const tipo of TIPOS_TELA) {
    const comp = COMPONENTES[tipo]
    for (const v of comp.variantes) {
      if (story && v.soSlides) continue
      r.push({ tipo, variante: v.id, fundo: 'claro', alinhamento: r.length % 3 === 0 ? 'centro' : 'esquerda', rotulo: v.nome, titulo: `${comp.nome} que resolve o problema`, enfase: 'o problema', texto: comp.limites.texto ? 'Uma frase de apoio que explica o contexto em linguagem simples.' : '', itens: (ITENS[tipo] ?? []).slice(0, Math.max(comp.maxItens, 0)), destaque: 1, imagem: 'foto do produto em uso', decoracao: 'marcante', notas: '' })
    }
  }
  return r
}

describe('todas as telas geradas ficam na grade de 8', () => {
  for (const story of [false, true]) {
    for (const estilo of ['editorial', 'ousado'] as Estilo[]) {
      it(`${story ? 'story' : 'slides'} · ${estilo}: estilos × componentes × variantes`, () => {
        const erros: string[] = []
        let seq = 0
        let camadas = 0
        for (const tema of TEMAS) {
          const lista = telasDeTeste(story)
          lista.forEach((d, i) => {
            const c: ContextoMontagem = {
              tema, estilo, story, numero: i + 1, total: lista.length, tituloProjeto: 'Aurora', marca: 'Aurora', motivos: true, placeholders: i % 2 === 0, indiceSecao: 1,
              reservarDireita: false, uid: (p) => `${p}-${(++seq).toString(36)}`, logo: i % 4 === 0 ? { assetId: 'logo-teste', largura: 400, altura: 120, cor: '#222222', rodape: true } : null,
            }
            const m = montarTela({ ...d, fundo: (['claro', 'escuro', 'acento'] as const)[i % 3]! }, c)
            camadas += m.layers.length
            for (const p of foraDaGrade(m.layers as C[], d.variante)) erros.push(`${tema.id} · ${d.variante}: ${p}`)
            if (!resolvido(m.layers as C[])) erros.push(`${tema.id} · ${d.variante}: auto layout não resolvido`)
          })
        }
        if (process.env.LISTAR_PROBLEMAS) console.log(erros.join('\n'))
        expect(camadas).toBeGreaterThan(1000)
        expect(erros.slice(0, 30), `${erros.length} valores fora da grade`).toEqual([])
      }, 60_000)
    }
  }
})

// ---------------------------------------------------------------- o pedido da Nexora

const PEDIDO = readFileSync(new URL('./fixtures/prompt-nexora-resultados.md', import.meta.url), 'utf8')
const MARCA = { nome: 'Nexora Soluções', cores: ['#006BFF', '#071A3D'], papeis: { claro: '#FFFFFF', cartao: '#EAF3FF', positivo: '#16A765', negativo: '#E45454' } }
const pedido = PedidoRoteiroSchema.parse({ prompt: PEDIDO, telas: 15, marca: { nome: MARCA.nome, cores: MARCA.cores } })
const roteiro: Roteiro = gerarRoteiroLocal(pedido)
const direcoes = direcoesDoPedido(PEDIDO, roteiro.telas.length)

function conferirDocumento(doc: ReturnType<typeof montarDocumento>) {
  expect(validarDocumento(doc).ok).toBe(true)
  const erros: string[] = []
  for (const cena of doc.scenes) {
    const variante = cena.id.split('-').slice(2).join('-')
    for (const p of foraDaGrade(cena.layers as unknown as C[], variante === 'grafico' && cena.layers.some((l) => l.id.startsWith('area-')) ? 'grafico.linha' : variante)) erros.push(`${cena.id}: ${p}`)
    if (!resolvido(cena.layers as unknown as C[])) erros.push(`${cena.id}: auto layout não resolvido`)
  }
  return erros
}

describe('pedido da Nexora: tudo no 8, pelo caminho local e com o Claude simulado', () => {
  it('gerador local (modo demo): slides, story e explorar, em vários estilos', () => {
    expect(roteiro.telas).toHaveLength(15)
    for (const [modo, tema, estilo] of [['slides', 'corporativo', 'minimal'], ['slides', 'corporativo', 'editorial'], ['story', 'corporativo', 'editorial'], ['explorar', 'corporativo', 'editorial'], ['slides', 'suico', 'ousado'], ['slides', 'luxo', 'editorial'], ['story', 'startup', 'ousado']] as const) {
      const doc = montarDocumento(roteiro, { modo, tema, estilo, marca: MARCA, direcoes })
      expect(doc.scenes).toHaveLength(15)
      expect(conferirDocumento(doc), `${modo} · ${tema} · ${estilo}`).toEqual([])
    }
  })

  it('margens, vãos entre título e conteúdo e cartões ficam em valores da escala', () => {
    const doc = montarDocumento(roteiro, { modo: 'slides', tema: 'corporativo', estilo: 'editorial', marca: MARCA, direcoes })
    // tela 2 (cartões de números): margem esquerda, vão do cabeçalho ao conteúdo e cartões, tudo múltiplo de 8
    const tela = doc.scenes[1]!.layers as unknown as C[]
    const titulo = tela.find((l) => l.id.startsWith('titulo-'))!
    expect(titulo.x % 8).toBe(0)
    const cartoes = tela.filter((l) => l.id.startsWith('cartao-'))
    expect(cartoes.length).toBeGreaterThan(1)
    for (const c of cartoes) expect([c.x % 8, c.y % 8, c.width % 8, c.height % 8]).toEqual([0, 0, 0, 0])
    expect(new Set(cartoes.map((c) => c.width)).size).toBe(1)
    const grade = tela.find((l) => l.id === cartoes[0]!.parentId)!
    expect(((grade.layout as Layout).gap) % 8).toBe(0)
  })
})

// Claude simulado: devolve o desenho de cada tela (variantes e fundos diferentes dos do desenho local)
let server: Server
const ler = (req: IncomingMessage) => new Promise<string>((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)) })
const sse = (tipo: string, dados: unknown) => `event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`

beforeAll(async () => {
  const locais = desenharLocal(roteiro, { story: false, estilo: 'editorial', tema: resolverTema('corporativo', MARCA), direcoes })
  server = createServer(async (req, res) => {
    const corpo = JSON.parse(await ler(req)) as { model: string; messages: { content: { text: string }[] }[] }
    const pedidoTela = corpo.messages[0]!.content.at(-1)!.text
    const i = Number(/Desenhe a tela (\d+)/.exec(pedidoTela)?.[1] ?? 1) - 1
    const t = roteiro.telas[i]!
    const comp = COMPONENTES[t.tipo]
    const local = locais[i]!
    // o "modelo" escolhe outra variante do componente (quando houver), alterna fundos e centraliza algumas telas
    const outra = comp.variantes.find((v) => v.id !== local.variante && !v.soSlides)?.id ?? local.variante
    const saida: DesenhoModelo = { variante: i % 2 ? outra : local.variante, fundo: (['claro', 'escuro', 'acento'] as const)[i % 3]!, alinhamento: i % 4 === 0 ? 'centro' : 'esquerda', rotulo: '', titulo: '', enfase: '', texto: '', itens: [], destaque: i % 3 === 0 ? 0 : -1, imagem: '', decoracao: i % 2 ? 'marcante' : 'sutil' }
    const texto = JSON.stringify(saida)
    const uso = { input_tokens: 9000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(sse('message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: corpo.model, content: [], stop_reason: null, stop_sequence: null, usage: uso } }))
    res.write(sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
    res.write(sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texto } }))
    res.write(sse('content_block_stop', { type: 'content_block_stop', index: 0 }))
    res.write(sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 300 } }))
    res.write(sse('message_stop', { type: 'message_stop' }))
    res.end()
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste'
})
afterAll(() => {
  server?.close()
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
})

describe('pedido da Nexora com o Claude simulado', () => {
  it('o desenho que volta do modelo é montado na grade de 8 (slides, story e explorar)', async () => {
    const { desenharTelasClaude } = await import('./claude')
    for (const formato of ['slides', 'story', 'explorar'] as const) {
      const desenhos: TelaDesenhada[] = []
      for (let i0 = 0; i0 < roteiro.telas.length; i0 += MAX_TELAS_POR_PEDIDO_DESIGN) {
        const indices = Array.from({ length: Math.min(MAX_TELAS_POR_PEDIDO_DESIGN, roteiro.telas.length - i0) }, (_, k) => i0 + k)
        const p = PedidoDesignSchema.parse({ roteiro, indices, formato, estilo: 'editorial', tema: 'corporativo', marca: MARCA, direcoes })
        const r = await desenharTelasClaude(p)
        for (const t of r.telas) {
          expect(t.desenho, `tela ${t.indice + 1}`).not.toBeNull()
          desenhos[t.indice] = t.desenho!
        }
      }
      // o modelo variou o desenho (não é o local) e a montagem continua no 8
      expect(desenhos.some((d, i) => d.fundo !== desenharLocal(roteiro, { story: formato === 'story', estilo: 'editorial', tema: resolverTema('corporativo', MARCA), direcoes })[i]!.fundo)).toBe(true)
      const doc = montarDocumento(roteiro, { modo: formato, tema: 'corporativo', estilo: 'editorial', marca: MARCA, direcoes, desenho: desenhos })
      expect(conferirDocumento(doc), formato).toEqual([])
    }
  }, 60_000)

  it('o prompt do design pede o espaçamento em múltiplos de 8', async () => {
    const { INSTRUCOES_DESIGN } = await import('./design')
    expect(INSTRUCOES_DESIGN).toContain('múltiplos de 8 px (8, 16, 24, 32, 40, 48, 56, 64, 80, 96')
    expect(INSTRUCOES_DESIGN).toContain('regra do 8')
  })
})
