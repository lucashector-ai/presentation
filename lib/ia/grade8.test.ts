/**
 * Regra do 8 (lib/ia/grade8.ts): a DISTÂNCIA borda a borda entre vizinhos e de cada filho até a borda do pai é
 * múltipla de 8 em todas as telas geradas — estilos × componentes × variantes (slides e story), o pedido real da
 * Nexora (lib/ia/fixtures/prompt-nexora-resultados.md) pelo gerador local (modo demo) e com o Claude simulado
 * (servidor local, nada sai da máquina), em slides, story e explorar. Vale também depois que o editor mede os
 * textos de novo: o teste mede os textos com a medição do ambiente de teste (as linhas de `contarLinhas` ×
 * entrelinha, como o navegador abraça a caixa), resolve o auto layout e só então confere as distâncias
 * (lib/ia/distancias8.mjs, a mesma conferência do e2e no navegador). Exceções: espessura de traços (até 6 px),
 * comprimento das barras de dados e marcadores no ponto do dado do gráfico de linha.
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
import { distanciasForaDe8 } from './distancias8.mjs'
import { acimaNaGrade, ajustarEspacamento, alinharNaGrade, colunasNaGrade, entrelinhaNaGrade, espacoNaGrade, naGrade, repartirNaGrade, type CamadaGrade } from './grade8'
import { gerarRoteiroLocal } from './local'
import { contarLinhas, montarTela, type ContextoMontagem, type Estilo, type TelaDesenhada } from './montagem'
import { PedidoRoteiroSchema } from './pedido'
import { montarDocumento, type Roteiro } from './roteiro'

type C = CamadaGrade & { type: string; parentId?: string }
interface Layout { direction: string; gap: number; rowGap?: number; gapAuto: boolean; padding: Record<'top' | 'right' | 'bottom' | 'left', number>; alignX: string; alignY: string }

const de8 = (v: number) => Math.abs(v / 8 - Math.round(v / 8)) < 1e-6

/** Linhas de um texto na largura da caixa (a medição do ambiente de teste). */
const linhasDe = (l: C) => contarLinhas(String(l.text), String(l.fontFamily), Number(l.fontSize), l.width, { maiusculas: l.transform === 'uppercase', espacamento: Number(l.letterSpacing ?? 0), peso: Number(l.fontWeight ?? 400) })

/**
 * O que o editor faz ao abrir: mede de novo os textos de altura automática (linhas × entrelinha, arredondado para
 * cima, como o medidor do DOM) e resolve o auto layout. `menos` simula um navegador que quebra uma linha a menos
 * nos textos de duas ou mais linhas (fonte real mais estreita que a estimativa).
 */
function abrirNoEditor(layers: C[], menos = false): C[] {
  const medidos = layers.map((l) => {
    if (l.type !== 'text' || (l.sizingH !== 'hug' && l.sizingW !== 'hug')) return l
    const n = Math.max(1, linhasDe(l) - (menos && linhasDe(l) >= 2 ? 1 : 0))
    const pad = typeof l.padding === 'number' && l.background ? l.padding * 2 : 0
    return { ...l, height: Math.ceil(n * Number(l.fontSize) * Number(l.lineHeight) - 1e-6) + pad }
  })
  return calcularLayout(medidos.map((l, i) => ({ ...l, z: i })) as unknown as CamadaCena[]) as unknown as C[]
}

/** Distâncias fora do 8 numa tela, depois de aberta no editor (ver abrirNoEditor). */
function distancias(layers: C[], tamanho: { width: number; height: number }, menos = false): string[] {
  const R = abrirNoEditor(layers, menos)
  return distanciasForaDe8(R as never, new Map(R.map((l) => [l.id, { x: l.x, y: l.y, w: l.width, h: l.height }])), tamanho).problemas
}

/**
 * Espaçamentos fora da regra: gaps e paddings de auto layout, padding das etiquetas de texto e a entrelinha (em px,
 * múltipla de 8; corpo pequeno em 4 só com caixa de altura fixa, que o navegador não muda).
 */
function espacamentosForaDe8(layers: C[]): string[] {
  const r: string[] = []
  for (const l of layers) {
    const lay = l.layout as Layout | undefined
    if (lay) for (const [k, v] of Object.entries({ gap: lay.gap, rowGap: lay.rowGap ?? 0, ...lay.padding })) if (!de8(v)) r.push(`${l.id}.${k} = ${v}`)
    if (l.type !== 'text') continue
    if (typeof l.padding === 'number' && !de8(l.padding)) r.push(`${l.id}.padding = ${l.padding}`)
    const lh = Number(l.fontSize) * Number(l.lineHeight)
    const passo = l.sizingH === 'fixed' ? 4 : 8
    if (Math.abs(lh / passo - Math.round(lh / passo)) * passo > 0.05) r.push(`${l.id}: entrelinha ${lh.toFixed(2)} px`)
    if (l.sizingW === 'hug') r.push(`${l.id}: largura automática`)
    if (l.leadingTrim === 'cap') r.push(`${l.id}: corte vertical`)
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
    expect([...espacamentosForaDe8(R), ...distancias(R, { width: 1920, height: 1080 })]).toEqual([])
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

describe('"Ajustar espaçamento (8 px)" do editor (ajustarEspacamento)', () => {
  let seq = 0
  const uid = (p: string) => `${p}-e${++seq}`
  const tela = { width: 1920, height: 1080 }
  const lay = (gap: number, extra: Partial<Layout> = {}): Layout => ({ direction: 'horizontal', gap, gapAuto: false, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignX: 'start', alignY: 'center', ...extra })
  /** Distância borda a borda, no eixo x, entre a camada `a` e a vizinha seguinte no mesmo pai. */
  const vao = (R: C[], a: string) => {
    const A = R.find((l) => l.id === a)!
    const irmaos = R.filter((l) => l.parentId === A.parentId && l.id !== a && l.x >= A.x + A.width - 0.5).sort((p, q) => p.x - q.x)
    return irmaos[0]!.x - (A.x + A.width)
  }

  it('o que o usuário mediu: rótulo Hug a 60 px da barra vira 56; dois cartões a 36 px ficam a 32; um desfazer (a tela volta igual)', () => {
    const L: C[] = [
      { id: 'linha', type: 'frame', x: 160, y: 160, width: 1200, height: 40, sizingW: 'fixed', sizingH: 'hug', layout: lay(60) },
      { id: 'rotulo', type: 'text', parentId: 'linha', x: 160, y: 165, width: 143, height: 29, text: 'Receita recorrente', fontFamily: 'Inter', fontSize: 24, lineHeight: 1.2, sizingW: 'hug', sizingH: 'hug', align: 'left' },
      { id: 'barra-1', type: 'shape', parentId: 'linha', x: 363, y: 168, width: 611, height: 24, fill: '#06F' },
      { id: 'cartoes', type: 'frame', x: 160, y: 400, width: 1600, height: 200, sizingW: 'fixed', sizingH: 'hug', layout: lay(36, { alignY: 'start' }) },
      { id: 'cartao-1', type: 'frame', parentId: 'cartoes', x: 160, y: 400, width: 400, height: 200, sizingW: 'fixed', sizingH: 'fixed', fill: '#EEE', layout: { ...lay(8), direction: 'vertical', padding: { top: 24, right: 24, bottom: 24, left: 24 } } },
      { id: 'cartao-2', type: 'frame', parentId: 'cartoes', x: 596, y: 400, width: 400, height: 200, sizingW: 'fixed', sizingH: 'fixed', fill: '#EEE', layout: { ...lay(8), direction: 'vertical', padding: { top: 24, right: 24, bottom: 24, left: 24 } } },
    ]
    const antes = calcularLayout(L.map((l, i) => ({ ...l, z: i })) as unknown as CamadaCena[]) as unknown as C[]
    expect(vao(antes, 'rotulo')).toBe(60)
    expect(vao(antes, 'cartao-1')).toBe(36)
    expect(distancias(antes, tela).length).toBeGreaterThan(0)
    const R = ajustarEspacamento(antes, { uid }) as C[]
    const p = (id: string) => R.find((l) => l.id === id)!
    expect(vao(R, 'rotulo')).toBe(56)
    expect(vao(R, 'cartao-1')).toBe(32)
    expect((p('linha').layout as Layout).gap).toBe(56)
    expect((p('cartoes').layout as Layout).gap).toBe(32)
    // o rótulo deixa de ser Hug: largura fixa na grade (o navegador não a muda ao medir de novo)
    expect(p('rotulo').sizingW).toBe('fixed')
    expect(p('rotulo').width % 8).toBe(0)
    // a barra continua com o comprimento exato (é o valor)
    expect(p('barra-1').width).toBe(611)
    expect([...espacamentosForaDe8(R), ...distancias(R, tela)]).toEqual([])
    expect(resolvido(R)).toBe(true)
    // aplicar de novo não muda nada (idempotente: o segundo "ajustar" é um passo vazio)
    const R2 = ajustarEspacamento(R, { uid }) as C[]
    expect(R2.map((l) => [l.id, l.x, l.y, l.width, l.height])).toEqual(R.map((l) => [l.id, l.x, l.y, l.width, l.height]))
  })

  it('camadas soltas (sem auto layout) também: cartões absolutos a 36 px e o valor a 20 px da ponta da barra vai para 16', () => {
    const L: C[] = [
      { id: 'c1', type: 'shape', x: 160, y: 160, width: 400, height: 200, fill: '#EEE' },
      { id: 'c2', type: 'shape', x: 596, y: 160, width: 400, height: 200, fill: '#EEE' },
      { id: 'barra-1', type: 'shape', x: 160, y: 480, width: 611, height: 24, fill: '#06F' },
      { id: 'barra-2', type: 'shape', x: 160, y: 560, width: 377, height: 24, fill: '#06F' },
      { id: 'v1', type: 'text', x: 791, y: 476, width: 120, height: 32, text: '61%', fontFamily: 'Inter', fontSize: 28, lineHeight: 1.15, sizingW: 'fixed', sizingH: 'hug' },
      { id: 'v2', type: 'text', x: 557, y: 556, width: 120, height: 32, text: '38%', fontFamily: 'Inter', fontSize: 28, lineHeight: 1.15, sizingW: 'fixed', sizingH: 'hug' },
    ]
    const R = ajustarEspacamento(L, { uid }) as C[]
    const p = (id: string) => R.find((l) => l.id === id)!
    // (camada solta: cada borda vai para a grade, então 36 vira 32 ou 40)
    expect([32, 40]).toContain(p('c2').x - (p('c1').x + p('c1').width))
    // o valor acompanha a ponta da barra a um vão da escala (16), e a barra não muda de comprimento
    expect(p('barra-1').width).toBe(611)
    expect(p('v1').x - (p('barra-1').x + p('barra-1').width)).toBe(16)
    expect(p('v2').x - (p('barra-2').x + p('barra-2').width)).toBe(16)
    expect([...espacamentosForaDe8(R), ...distancias(R, tela)]).toEqual([])
  })
})

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
            const tela = story ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
            for (const p of [...espacamentosForaDe8(m.layers as C[]), ...distancias(m.layers as C[], tela), ...distancias(m.layers as C[], tela, true).map((x) => `(uma linha a menos) ${x}`)]) erros.push(`${tema.id} · ${d.variante}: ${p}`)
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
    const L = cena.layers as unknown as C[]
    for (const p of [...espacamentosForaDe8(L), ...distancias(L, cena.size), ...distancias(L, cena.size, true).map((x) => `(uma linha a menos) ${x}`)]) erros.push(`${cena.id}: ${p}`)
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
