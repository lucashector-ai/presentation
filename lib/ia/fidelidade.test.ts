/**
 * Fidelidade do "Criar com IA" ao pedido, com o caso real que deu errado em produção
 * (lib/ia/fixtures/prompt-nexora-resultados.md: resultados comerciais Q3 2026, estrutura de 15 slides, cores em hex):
 * o pedido inteiro chega ao modelo, o tipo não vira "identidade visual", são pedidas 15 telas (ou o limite do plano,
 * com aviso), as cores viram a paleta da marca e a montagem gera funil, tabela, linha e barras com os números do
 * pedido. O Claude é simulado por um servidor local (nada sai da máquina); o gerador local (modo demo) também é
 * conferido com o mesmo pedido.
 */
import { readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { analisarPedido, direcoesDoPedido, estruturaDoPedido, paletaDoPedido, telasCitadas } from './analisePedido'
import { PedidoDesignSchema, mensagemDeck } from './design'
import { resolverTema } from './designSystem'
import { desenharLocal } from './desenhoLocal'
import { temPreenchimento } from './fidelidade'
import { gerarRoteiroLocal } from './local'
import { montarTela, type ContextoMontagem, type TelaDesenhada } from './montagem'
import { compactar, formatarComo, formatarPct, valorDe } from './numeros'
import { MAX_PROMPT, PedidoRoteiroSchema, RoteiroModeloSchema, tipoEfetivo, type RoteiroModelo } from './pedido'
import { mensagemUsuario } from './prompt'
import { montarDocumento, type Roteiro } from './roteiro'
import { podeGerarTelas, PLANOS } from '@/lib/planos'
import { validarDocumento } from '@/lib/scene/validate'

const PEDIDO = readFileSync(new URL('./fixtures/prompt-nexora-resultados.md', import.meta.url), 'utf8')

// ---------------------------------------------------------------- Claude simulado

const corpos: Record<string, unknown>[] = []
let server: Server
let resposta: RoteiroModelo | null = null
const ler = (req: IncomingMessage) => new Promise<string>((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)) })
const sse = (tipo: string, dados: unknown) => `event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const corpo = JSON.parse(await ler(req)) as Record<string, unknown>
    corpos.push(corpo)
    const texto = JSON.stringify(resposta ?? {})
    const uso = { input_tokens: 9000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.write(sse('message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: corpo.model, content: [], stop_reason: null, stop_sequence: null, usage: uso } }))
    res.write(sse('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
    for (let i = 0; i < texto.length; i += 500) res.write(sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: texto.slice(i, i + 500) } }))
    res.write(sse('content_block_stop', { type: 'content_block_stop', index: 0 }))
    res.write(sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 3000 } }))
    res.write(sse('message_stop', { type: 'message_stop' }))
    res.end()
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste'
})
afterAll(() => {
  server.close()
  delete process.env.ANTHROPIC_BASE_URL
  delete process.env.ANTHROPIC_API_KEY
})

/** Texto de todas as camadas de texto de uma tela montada. */
const textos = (layers: Record<string, unknown>[]) => layers.filter((l) => l.type === 'text').map((l) => String(l.text))
const tema = resolverTema('corporativo', { nome: 'Nexora Soluções', cores: ['#006BFF', '#071A3D'], papeis: { claro: '#FFFFFF', cartao: '#EAF3FF', positivo: '#16A765', negativo: '#E45454' } })
let seq = 0
const ctx = (story = false): ContextoMontagem => ({ tema, estilo: 'editorial', story, numero: 2, total: 15, tituloProjeto: 'Resultados Comerciais', marca: 'Nexora Soluções', motivos: true, placeholders: false, indiceSecao: 1, reservarDireita: false, uid: (p) => `${p}-${++seq}` })
const desenho = (tipo: TelaDesenhada['tipo'], variante: string, itens: string[], titulo = 'Tela'): TelaDesenhada => ({ tipo, variante, fundo: 'claro', alinhamento: 'esquerda', rotulo: '', titulo, enfase: '', texto: '', itens, destaque: -1, imagem: '', decoracao: 'sutil', notas: '' })

describe('o pedido chega inteiro e é lido sem IA', () => {
  const analise = analisarPedido(PEDIDO)

  it('o pedido de ≈ 7.900 caracteres passa no contrato (limite de 30 mil) e acima disso pede para mover ao material', () => {
    expect(PEDIDO.length).toBeGreaterThan(7000)
    expect(PedidoRoteiroSchema.parse({ prompt: PEDIDO }).prompt).toBe(PEDIDO.trim())
    expect(PedidoRoteiroSchema.safeParse({ prompt: 'x'.repeat(MAX_PROMPT + 1) }).success).toBe(false)
  })

  it('reconhece a estrutura explícita de 15 telas, com títulos, subtítulos e itens na ordem', () => {
    const e = estruturaDoPedido(PEDIDO)
    expect(e).toHaveLength(15)
    expect(e.map((t) => t.nome)).toEqual(['Capa', 'Visão executiva', 'Metas vs. realizado', 'Evolução mensal da receita', 'Crescimento trimestral', 'Receita por segmento', 'Performance dos vendedores', 'Funil comercial', 'Conquista de clientes', 'Indicadores de eficiência', 'Destaques do trimestre', 'Pontos de atenção', 'Plano de ação para Q4', 'Objetivos para Q4', 'Encerramento'])
    expect(e[0]).toMatchObject({ titulo: 'Resultados Comerciais', subtitulo: 'Q3 2026 | Julho a Setembro' })
    expect(e[14]).toMatchObject({ titulo: 'O próximo resultado começa agora' })
    expect(e[1]!.itens).toEqual(['R$ 12,4 milhões de receita', '91,9% da meta atingida', '+28% de crescimento trimestral', '185 novos clientes'])
    expect(e[12]!.itens).toHaveLength(4)
    // as regras de qualidade não viram itens da última tela
    expect(e[14]!.itens).toEqual([])
    expect(analise.telas).toBe(15)
    expect(telasCitadas('Crie 15 slides completos')).toBe(15)
    expect(telasCitadas('uma apresentação de 10 telas')).toBe(10)
    expect(telasCitadas('quero doze slides')).toBe(12)
    expect(telasCitadas('sem número')).toBeNull()
  })

  it('o tipo é relatório (não identidade visual), por pontuação de evidências', () => {
    expect(tipoEfetivo(PedidoRoteiroSchema.parse({ prompt: PEDIDO }))).toBe('relatorio')
  })

  it('as cores em hex viram a paleta da marca com papéis, e o tema da montagem usa cada uma no seu lugar', () => {
    const p = paletaDoPedido(PEDIDO)!
    expect(p.cores).toEqual(['#006BFF', '#071A3D'])
    expect(p.papeis).toMatchObject({ principal: '#006BFF', escuro: '#071A3D', claro: '#FFFFFF', cartao: '#EAF3FF', positivo: '#16A765', negativo: '#E45454' })
    expect(analise.marca).toBe('Nexora Soluções')
    expect(analise.imagens).toBe(false)
    expect(tema.acento).toBe('#006BFF')
    expect(tema.escuro.fundo).toBe('#071A3D')
    expect(tema.claro.fundo).toBe('#FFFFFF')
    expect(tema.claro.cartao).toBe('#EAF3FF')
    expect(tema.positivo).toBe('#16A765')
    expect(tema.negativo).toBe('#E45454')
  })
})

describe('roteiro com o Claude simulado', () => {
  const telasModelo = (n: number): RoteiroModelo['telas'] => estruturaDoPedido(PEDIDO).slice(0, n).map((t, i) => ({
    tipo: i === 0 ? 'capa' : i === 14 ? 'encerramento' : 'conceito', rotulo: '', titulo: t.titulo || t.nome, texto: '', itens: [], notas: '',
  }))

  it('a mensagem leva o pedido inteiro, a estrutura tela a tela e pede exatamente 15 telas', async () => {
    const { gerarRoteiroClaude } = await import('./claude')
    corpos.length = 0
    resposta = { titulo: 'Resultados Comerciais', tipo: 'relatorio', tema: 'corporativo', telas: telasModelo(15) }
    const pedido = PedidoRoteiroSchema.parse({ prompt: PEDIDO, telas: 15, marca: { nome: 'Nexora Soluções', cores: ['#006BFF', '#071A3D'] } })
    const r = await gerarRoteiroClaude(pedido)
    const mensagem = String(((corpos[0]!.messages as { content: string }[])[0]!).content)
    // o pedido inteiro, sem corte (as últimas linhas, que antes ficavam além dos 4.000 caracteres, inclusive)
    expect(mensagem).toContain(PEDIDO.trim())
    expect(mensagem).toContain('Não crie logos adicionais nem altere a identidade visual da Nexora.')
    expect(mensagem).toContain('exatamente 15 telas')
    expect(mensagem).toContain('estrutura explícita de 15 telas')
    expect(mensagem).toContain('15. Encerramento — título: "O próximo resultado começa agora"')
    expect(mensagem).toContain('Tipo reconhecido pelo texto: relatorio')
    expect(mensagem).not.toMatch(/Tipo reconhecido pelo texto: identidade/)
    expect(mensagem).toContain('não use telas de imagem ou galeria')
    expect(mensagem).toContain('#006BFF, #071A3D')
    // a saída estruturada pede o tipo e a resposta volta com o tipo do modelo
    expect(JSON.stringify(corpos[0]!.output_config)).toContain('"tipo"')
    expect(r.tipo).toBe('relatorio')
    expect(r.roteiro.telas).toHaveLength(15)
    expect(r.roteiro.telas[14]!.titulo).toBe('O próximo resultado começa agora')
  })

  it('telas a menos, títulos trocados, colchetes e espaço de imagem: a conferência corrige contra o pedido', async () => {
    const { gerarRoteiroClaude } = await import('./claude')
    const telas = telasModelo(15)
    telas.splice(7, 1) // o modelo esqueceu o funil
    telas[0] = { ...telas[0]!, titulo: 'Nexora: identidade visual', texto: 'Apresentado em [data]' }
    telas[2] = { ...telas[2]!, tipo: 'imagem', texto: 'arraste sua imagem aqui' }
    resposta = { titulo: 'Nexora', tipo: 'relatorio', tema: 'corporativo', telas }
    const r = await gerarRoteiroClaude(PedidoRoteiroSchema.parse({ prompt: PEDIDO, telas: 15 }))
    expect(r.roteiro.telas).toHaveLength(15)
    expect(r.roteiro.telas[0]).toMatchObject({ titulo: 'Resultados Comerciais', texto: 'Q3 2026 | Julho a Setembro' })
    expect(r.roteiro.telas[2]!.tipo).not.toBe('imagem')
    // o funil que faltava entra no lugar dele, montado com os volumes do pedido
    expect(r.roteiro.telas[7]).toMatchObject({ tipo: 'funil', itens: ['Leads gerados|5.200', 'Oportunidades qualificadas|3.100', 'Propostas enviadas|1.480', 'Negociações|620', 'Contratos fechados|260'] })
    for (const t of r.roteiro.telas) expect(temPreenchimento([t.titulo, t.texto, ...t.itens].join(' ')), t.titulo).toBe(false)
  })

  it('plano Free (até 12 telas): o limite aparece com upgrade, e com 12 a IA é avisada para juntar telas, sem cortar em silêncio', () => {
    expect(PLANOS.free.limites.telasPorPrompt).toBe(12)
    const lim = podeGerarTelas('free', analisarPedido(PEDIDO).telas!)
    expect(lim.ok).toBe(false)
    if (!lim.ok) expect(lim.upgradePara).toBe('plus')
    const m = mensagemUsuario(PedidoRoteiroSchema.parse({ prompt: PEDIDO, telas: 12 }))
    expect(m).toContain('exatamente 12 telas')
    expect(m).toContain('estrutura explícita de 15 telas, mas esta apresentação terá 12')
    expect(m).toContain('junte em uma tela as telas pedidas de assunto mais próximo')
  })

  it('o schema da saída do modelo aceita o tipo de apresentação', () => {
    expect(RoteiroModeloSchema.safeParse({ titulo: 'x', tipo: 'relatorio', tema: 'corporativo', telas: [] }).success).toBe(true)
    expect(RoteiroModeloSchema.safeParse({ titulo: 'x', tipo: 'qualquer', tema: 'corporativo', telas: [] }).success).toBe(false)
  })
})

describe('componentes de dados refletem exatamente os números', () => {
  const porId = (layers: Record<string, unknown>[], p: string) => layers.filter((l) => String(l.id).startsWith(`${p}-`))

  it('funil: volumes, larguras proporcionais, taxas de passagem, maior perda e conversão total', () => {
    const m = montarTela(desenho('funil', 'funil.barras', ['Leads gerados|5.200', 'Oportunidades qualificadas|3.100', 'Propostas enviadas|1.480', 'Negociações|620', 'Contratos fechados|260']), ctx())
    const t = textos(m.layers)
    for (const v of ['5.200', '3.100', '1.480', '620', '260']) expect(t).toContain(v)
    // 3.100/5.200 = 59,6%; 1.480/3.100 = 47,7%; 620/1.480 = 41,9% (maior perda); 260/620 = 41,9%
    expect(t).toContain('↓ 59,6%')
    expect(t).toContain('↓ 47,7%')
    expect(t).toContain('↓ 41,9%  maior perda')
    expect(t).toContain('↓ 41,9%')
    expect(t).toContain('Conversão total 5%')
    const barras = porId(m.layers, 'barra').map((l) => Number(l.width))
    const volumes = [5200, 3100, 1480, 620, 260]
    barras.forEach((w, k) => expect(w / barras[0]!).toBeCloseTo(volumes[k]! / 5200, 2))
  })

  it('tabela/ranking: cabeçalho, linhas na ordem, três primeiros em destaque e barra proporcional à receita', () => {
    const itens = ['Posição|Vendedor|Receita|Novos clientes', '1|Ana Souza|R$ 1,82 mi|28', '2|Carlos Lima|R$ 1,54 mi|24', '3|Mariana Alves|R$ 1,31 mi|22', '4|Rafael Costa|R$ 1,12 mi|18', '5|Juliana Mendes|R$ 0,98 mi|16']
    const m = montarTela(desenho('tabela', 'tabela.ranking', itens), ctx())
    const t = textos(m.layers)
    for (const v of ['Posição', 'Vendedor', 'Receita', 'Novos clientes', 'Ana Souza', 'Juliana Mendes', 'R$ 1,82 mi', 'R$ 0,98 mi', '28', '16']) expect(t).toContain(v)
    expect(t.indexOf('Ana Souza')).toBeLessThan(t.indexOf('Carlos Lima'))
    const marcadores = porId(m.layers, 'marcador')
    expect(marcadores.filter((l) => l.fill === tema.acento)).toHaveLength(1)
    expect(marcadores.slice(3).every((l) => !!l.stroke)).toBe(true)
    const barras = porId(m.layers, 'barra').map((l) => Number(l.width))
    expect(barras[4]! / barras[0]!).toBeCloseTo(0.98 / 1.82, 2)
  })

  it('linha: um ponto por período, na altura do valor, com a variação calculada entre eles', () => {
    const m = montarTela(desenho('grafico', 'grafico.linha', ['R$ 3,8 mi|Julho', 'R$ 4,2 mi|Agosto', 'R$ 4,4 mi|Setembro']), ctx())
    const t = textos(m.layers)
    for (const v of ['R$ 3,8 mi', 'R$ 4,2 mi', 'R$ 4,4 mi', 'Julho', 'Agosto', 'Setembro', '+10,5%', '+4,8%']) expect(t).toContain(v)
    const linha = porId(m.layers, 'linha')[0] as { vetor: { h: number; caminhos: { nos: { x: number; y: number }[] }[] } }
    const nos = linha.vetor.caminhos[0]!.nos
    expect(nos).toHaveLength(3)
    // alturas proporcionais às diferenças: (4,2 − 3,8) / (4,4 − 4,2) = 2
    expect((nos[0]!.y - nos[1]!.y) / (nos[1]!.y - nos[2]!.y)).toBeCloseTo(2, 5)
    expect(nos[0]!.x).toBeLessThan(nos[1]!.x)
  })

  it('barras de participação: largura proporcional, % de cada segmento e total conferido', () => {
    const m = montarTela(desenho('grafico', 'grafico.participacao', ['R$ 5,1 mi|Enterprise', 'R$ 4,3 mi|Mid Market', 'R$ 2,1 mi|SMB', 'R$ 0,9 mi|Governo']), ctx())
    const t = textos(m.layers)
    for (const v of ['41,1%', '34,7%', '16,9%', '7,3%', 'Total R$ 12,4 mi · 100%']) expect(t).toContain(v)
    const barras = porId(m.layers, 'barra').map((l) => Number(l.width))
    expect(barras[1]! / barras[0]!).toBeCloseTo(4.3 / 5.1, 2)
    expect(barras[3]! / barras[0]!).toBeCloseTo(0.9 / 5.1, 2)
  })

  it('meta × realizado (gap e % atingido) e anterior × atual (variação), com as contas conferidas', () => {
    const meta = textos(montarTela(desenho('comparativo', 'comparativo.meta', ['Meta|R$ 13,5 mi', 'Realizado|R$ 12,4 mi']), ctx()).layers)
    expect(meta).toContain('91,9%')
    expect(meta).toContain('Gap de R$ 1,1 mi')
    // Q2 = 12,4 / 1,28 = 9,6875 ≈ 9,69 → variação de 28%
    const q2 = formatarComo(12.4e6 / 1.28, 'R$ 12,4 mi', 1)
    expect(q2).toBe('R$ 9,69 mi')
    const cresc = textos(montarTela(desenho('comparativo', 'comparativo.crescimento', [`Q2 2026 · estimado|${q2}`, 'Q3 2026|R$ 12,4 mi']), ctx()).layers)
    expect(cresc).toContain('+28%')
    expect(cresc).toContain('de Q2 2026 para Q3 2026')
  })

  it('painel de metas: projeção marcada, progresso do ponto de partida até a meta', () => {
    const t = textos(montarTela(desenho('kpis', 'kpis.metas', ['R$ 15 mi|Receita-alvo|de R$ 12,4 mi', '20%|Conversão de propostas|de 17,6%', '220|Novos clientes|de 185']), ctx()).layers)
    expect(t.filter((x) => x === 'Meta')).toHaveLength(3)
    expect(t).toContain('Hoje R$ 12,4 mi · 82,7% da meta')
    expect(t).toContain('Hoje 17,6% · 88% da meta')
    expect(t).toContain('Hoje 185 · 84,1% da meta')
  })

  it('números: leitura com escala e formatação no jeito do valor de referência', () => {
    expect(valorDe('R$ 12,4 mi')).toBe(12_400_000)
    expect(valorDe('R$ 12.400.000')).toBe(12_400_000)
    expect(compactar('R$ 1.820.000')).toBe('R$ 1,82 mi')
    expect(compactar('R$ 47.692')).toBe('R$ 47.692')
    expect(compactar('R$ 900.000', 1e5)).toBe('R$ 0,9 mi')
    expect(formatarPct(27.97, true)).toBe('+28%')
    expect(formatarPct(41.129)).toBe('41,1%')
  })
})

describe('gerador local (modo demo) com o mesmo pedido', () => {
  const pedido = PedidoRoteiroSchema.parse({ prompt: PEDIDO, telas: 15, marca: { nome: 'Nexora Soluções', cores: ['#006BFF', '#071A3D'] } })
  const roteiro: Roteiro = gerarRoteiroLocal(pedido)

  it('segue a estrutura tela a tela, com os componentes que cada tela pede e os dados do pedido', () => {
    expect(roteiro.telas).toHaveLength(15)
    expect(roteiro.telas.map((t) => t.tipo)).toEqual(['capa', 'numeros', 'comparativo', 'grafico', 'comparativo', 'grafico', 'tabela', 'funil', 'numeros', 'kpis', 'numeros', 'alertas', 'roadmap', 'kpis', 'encerramento'])
    expect(roteiro.telas[0]).toMatchObject({ titulo: 'Resultados Comerciais', texto: 'Q3 2026 | Julho a Setembro', rotulo: 'Nexora Soluções' })
    expect(roteiro.telas[1]!.itens).toEqual(['R$ 12,4 mi|Receita', '91,9%|Meta atingida', '+28%|Crescimento trimestral', '185|Novos clientes'])
    expect(roteiro.telas[2]!.itens).toEqual(['Meta|R$ 13,5 mi', 'Realizado|R$ 12,4 mi'])
    expect(roteiro.telas[3]!.itens).toEqual(['R$ 3,8 mi|Julho', 'R$ 4,2 mi|Agosto', 'R$ 4,4 mi|Setembro'])
    expect(roteiro.telas[4]!.itens).toEqual(['Q2 2026 · estimado|R$ 9,69 mi', 'Q3 2026|R$ 12,4 mi'])
    expect(roteiro.telas[5]!.itens).toEqual(['R$ 5,1 mi|Enterprise', 'R$ 4,3 mi|Mid Market', 'R$ 2,1 mi|SMB', 'R$ 0,9 mi|Governo'])
    expect(roteiro.telas[6]!.itens[0]).toBe('Posição|Vendedor|Receita|Novos clientes')
    expect(roteiro.telas[6]!.itens[1]).toBe('1|Ana Souza|R$ 1,82 mi|28')
    expect(roteiro.telas[8]!.itens).toEqual(['185|Novos clientes conquistados', '260|Contratos fechados'])
    // receita por contrato = 12,4 mi ÷ 260 (calculado e marcado como tal); oportunidades por fechamento = 3.100 ÷ 260
    expect(roteiro.telas[9]!.itens).toContain('R$ 47.692|Receita por contrato|calculado: R$ 12,4 mi ÷ 260')
    expect(roteiro.telas[9]!.itens.some((i) => i.startsWith('11,9 : 1|'))).toBe(true)
    // metas futuras são projeção, com o ponto de partida real
    expect(roteiro.telas[13]!.rotulo).toBe('Projeção')
    expect(roteiro.telas[13]!.itens[0]).toBe('R$ 15 mi|Receita-alvo|de R$ 12,4 mi')
    expect(roteiro.telas[14]!.titulo).toBe('O próximo resultado começa agora')
    // o ranking (só parte da equipe) não vira a receita total em lugar nenhum
    expect(JSON.stringify(roteiro)).not.toContain('7,77')
  })

  it('a montagem gera funil, tabela, linha e barras proporcionais, sem placeholder nem espaço de imagem, e varia o layout', () => {
    const direcoes = direcoesDoPedido(PEDIDO, roteiro.telas.length)
    expect(direcoes).toHaveLength(15)
    const desenhos = desenharLocal(roteiro, { story: false, estilo: 'minimal', tema, direcoes })
    const variantes = desenhos.map((d) => d.variante)
    expect(variantes[3]).toBe('grafico.linha')
    expect(variantes[5]).toBe('grafico.participacao')
    expect(variantes[6]).toBe('tabela.ranking')
    expect(variantes[7]).toBe('funil.barras')
    expect(variantes[2]).toBe('comparativo.meta')
    expect(variantes[4]).toBe('comparativo.crescimento')
    expect(variantes[13]).toBe('kpis.metas')
    expect(variantes[1]).toBe('numeros.cartoes')
    // capa com fundo azul-marinho; encerramento com fundo azul (a cor principal)
    expect(desenhos[0]!.fundo).toBe('escuro')
    expect(desenhos[14]!.fundo).toBe('acento')
    for (let i = 1; i < variantes.length; i++) expect(variantes[i], `telas ${i} e ${i + 1}`).not.toBe(variantes[i - 1])
    const doc = montarDocumento(roteiro, { modo: 'slides', tema: 'corporativo', estilo: 'minimal', marca: { nome: 'Nexora Soluções', cores: ['#006BFF', '#071A3D'], papeis: { claro: '#FFFFFF', cartao: '#EAF3FF', positivo: '#16A765', negativo: '#E45454' } }, direcoes })
    expect(validarDocumento(doc).ok).toBe(true)
    expect(doc.scenes).toHaveLength(15)
    const todos = doc.scenes.flatMap((c) => c.layers)
    expect(todos.some((l) => l.id.startsWith('imagem-') || l.id.startsWith('listras-'))).toBe(false)
    for (const c of doc.scenes) for (const l of c.layers) if (l.type === 'text') expect(temPreenchimento(l.text), `${c.id}: ${l.text}`).toBe(false)
    const tf = (i: number) => doc.scenes[i]!.layers.filter((l) => l.type === 'text').map((l) => (l as { text: string }).text)
    expect(tf(7)).toContain('↓ 41,9%  maior perda')
    expect(tf(5)).toContain('41,1%')
    expect(tf(3)).toContain('+10,5%')
    expect(tf(2)).toContain('91,9%')
    expect(tf(4)).toContain('+28%')
    expect(doc.scenes[0]!.background).toBe('#071A3D')
    expect(doc.scenes[14]!.background).toBe('#006BFF')
  })

  it('o design com IA recebe a direção pedida de cada tela', () => {
    const p = PedidoDesignSchema.parse({ roteiro, indices: [3], formato: 'slides', tema: 'corporativo', direcoes: direcoesDoPedido(PEDIDO, 15) })
    expect(mensagemDeck(p)).toContain('direção pedida: Evolução mensal da receita. Crie um gráfico de linhas')
  })
})
