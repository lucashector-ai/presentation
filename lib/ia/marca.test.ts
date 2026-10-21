import { describe, expect, it } from 'vitest'
import { validarDocumento } from '@/lib/scene/validate'
import { CATEGORIAS_ESTILO, PARES_FONTES, TEMAS, aplicarMarca, contraste, regrasDe, resolverTema, superficie, temaPorId } from './designSystem'
import { coresDoLogo, coresDoTexto, deHsl, hsl, ordenarCoresDaMarca, paletasDoLogo, PALETAS_PRONTAS } from './marca'
import { montarDocumento, type Roteiro } from './roteiro'
import { gerarRoteiroLocal } from './local'
import { PedidoRoteiroSchema, caracteresMaterial } from './pedido'
import { desenharLocal } from './desenhoLocal'

/** Pixels RGBA de um "logo": n pixels de cada cor (alfa 255) e alguns transparentes. */
function pixels(cores: [string, number][], transparentes = 10): Uint8ClampedArray {
  const lista: number[] = []
  for (const [hex, n] of cores) for (let i = 0; i < n; i++) lista.push(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255)
  for (let i = 0; i < transparentes; i++) lista.push(255, 255, 255, 0)
  return new Uint8ClampedArray(lista)
}

describe('paleta do logo (sem IA)', () => {
  it('acha as cores dominantes, ignora transparência e põe brancos quase puros por último', () => {
    const r = coresDoLogo(pixels([['#E4572E', 600], ['#1F3B4D', 300], ['#FFFFFF', 900]]))
    expect(r.cores[0]).toMatch(/^#E[0-9A-F]5[0-9A-F]2[0-9A-F]$/)
    expect(r.cores.some((c) => c.startsWith('#1F3B4') || c.startsWith('#1F3A4'))).toBe(true)
    expect(r.cores).not.toContain('#FFFFFF')
    expect(r.neutro).toBe(false)
  })
  it('logo preto e branco é neutro; vazio não quebra', () => {
    expect(coresDoLogo(pixels([['#111111', 500], ['#FFFFFF', 500]])).neutro).toBe(true)
    expect(coresDoLogo(new Uint8ClampedArray([0, 0, 0, 0])).cores).toEqual([])
  })
  it('sugere 3 ou 4 paletas, todas começando pela cor principal', () => {
    const p = paletasDoLogo(['#E4572E', '#1F3B4D'])
    expect(p.length).toBeGreaterThanOrEqual(3)
    expect(p.length).toBeLessThanOrEqual(4)
    for (const x of p) expect(x.cores[0]).toBe('#E4572E')
    expect(paletasDoLogo([])).toEqual([])
    expect(PALETAS_PRONTAS.length).toBeGreaterThanOrEqual(6)
  })
  it('hsl ida e volta', () => {
    const { h, s, l } = hsl('#5965F2')
    expect(contraste(deHsl(h, s, l), '#5965F2')).toBeLessThan(1.05)
  })
})

describe('cores citadas no pedido', () => {
  it('lê códigos e nomes de cor quando o texto fala de cor', () => {
    expect(coresDoTexto('Paleta: #1f3b4d e #E4572E')).toEqual(['#1F3B4D', '#E4572E'])
    expect(coresDoTexto('Proposta com cores azul-marinho e dourado')).toEqual(['#1B2A4A', '#C9A45C'])
    expect(coresDoTexto('Identidade em verde e laranja')).toEqual(['#2F9E5B', '#F07C1E'])
  })
  it('não confunde palavras comuns com cor', () => {
    expect(coresDoTexto('Pitch da Aurora, startup de energia solar')).toEqual([])
    expect(coresDoTexto('Relatório do 3º trimestre')).toEqual([])
  })
  it('a cor mais saturada vira a principal', () => {
    expect(ordenarCoresDaMarca(['#111111', '#E4572E'])[0]).toBe('#E4572E')
  })
})

describe('estilos de design', () => {
  it('pelo menos 15 estilos, em categorias, com regras de composição próprias', () => {
    expect(TEMAS.length).toBeGreaterThanOrEqual(15)
    for (const t of TEMAS) expect(CATEGORIAS_ESTILO).toContain(t.categoria)
    const comRegras = TEMAS.filter((t) => 'regras' in t)
    expect(comRegras.length).toBeGreaterThanOrEqual(10)
    // estilos bem diferentes: fontes de título e cartões variados
    expect(new Set(TEMAS.map((t) => t.fontes.titulo)).size).toBeGreaterThanOrEqual(12)
    expect(new Set(TEMAS.map((t) => regrasDe(t).cartao))).toEqual(new Set(['cheio', 'contorno', 'vidro', 'sombra']))
    expect(new Set(TEMAS.map((t) => t.motivo)).size).toBeGreaterThanOrEqual(10)
  })
  it('marca aplicada sobre qualquer estilo mantém contraste e a tipografia do estilo', () => {
    for (const t of TEMAS) for (const cores of [['#F5D300'], ['#0B2A5B', '#F2C14E'], ['#F7C6D9', '#101820'], ['#00A86B']]) {
      const m = aplicarMarca(t, { nome: 'Aurora', cores })
      expect(m.id).toBe(t.id)
      expect(m.fontes.titulo).toBe(t.fontes.titulo)
      expect(m.acento).toBe(cores[0])
      expect(contraste(m.claro.tinta, m.claro.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(m.escuro.tinta, m.escuro.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(m.sobreAcento, m.acento)).toBeGreaterThanOrEqual(3)
      for (const f of ['claro', 'escuro', 'acento'] as const) expect(contraste(superficie(m, f).destaque, superficie(m, f).fundo)).toBeGreaterThanOrEqual(2.9)
    }
  })
  it('fontes da marca trocam o par; aplicarCores: false mantém as cores do estilo', () => {
    const par = PARES_FONTES.find((p) => p.id === 'playfair')!
    const m = resolverTema('suico', { nome: '', cores: ['#00A86B'], aplicarCores: false, fontes: { titulo: par.titulo, texto: par.texto } })
    expect(m.acento).toBe(temaPorId('suico').acento)
    expect(m.fontes.titulo).toBe('Playfair Display')
  })
  it('variantes preferidas do estilo no desenho local (suíço: capa tipográfica; luxo: centrada) e sem telas de acento', () => {
    const r: Roteiro = { titulo: 'X', telas: [{ tipo: 'capa', rotulo: '', titulo: 'Uma capa qualquer de teste', texto: '', itens: [], notas: '' }, { tipo: 'secao', rotulo: '', titulo: 'Seção', texto: '', itens: [], notas: '' }, { tipo: 'encerramento', rotulo: '', titulo: 'Fim', texto: '', itens: [], notas: '' }] }
    expect(desenharLocal(r, { story: false, estilo: 'editorial', tema: temaPorId('suico') })[0]!.variante).toBe('capa.tipografica')
    const luxo = desenharLocal(r, { story: false, estilo: 'ousado', tema: temaPorId('luxo') })
    expect(luxo[0]!.variante).toBe('capa.centrada')
    expect(luxo.some((d) => d.fundo === 'acento')).toBe(false)
  })
})

describe('material da pessoa no roteiro local', () => {
  const pedido = (material: Partial<{ numeros: string[]; fotos: string[]; obrigatorio: string }>) => PedidoRoteiroSchema.parse({ prompt: 'Pitch de uma startup de energia solar', telas: 10, material })
  it('números substituem os números-guia, fotos viram galeria, "não pode faltar" vira lista', () => {
    const r = gerarRoteiroLocal(pedido({ numeros: ['38% | mais clientes', '6 semanas | até o lançamento'], fotos: ['Telhado', 'App'], obrigatorio: 'assinatura; economia na conta' }))
    expect(r.telas).toHaveLength(10)
    expect(r.telas.find((t) => t.tipo === 'numeros')?.itens).toEqual(['38%|mais clientes', '6 semanas|até o lançamento'])
    expect(r.telas.some((t) => t.tipo === 'galeria' && t.itens.length === 2)).toBe(true)
    expect(r.telas.some((t) => t.tipo === 'lista' && t.itens.includes('assinatura'))).toBe(true)
  })
  it('o pedido aceita até 30 telas e o material entra no preço do roteiro', () => {
    expect(PedidoRoteiroSchema.safeParse({ prompt: 'abc', telas: 30 }).success).toBe(true)
    expect(PedidoRoteiroSchema.safeParse({ prompt: 'abc', telas: 31 }).success).toBe(false)
    expect(caracteresMaterial({ conteudo: 'a'.repeat(100), material: { numeros: ['1|a'], obrigatorio: 'xyz', evitar: '' } })).toBe(106)
  })
})

describe('logo e fotos na montagem (sem IA)', () => {
  const roteiro: Roteiro = {
    titulo: 'Aurora',
    telas: [
      { tipo: 'capa', rotulo: '', titulo: 'Energia solar por assinatura', texto: 'Rodada seed', itens: [], notas: '' },
      { tipo: 'lista', rotulo: 'Por quê', titulo: 'Três motivos', texto: '', itens: ['Um', 'Dois', 'Três'], notas: '' },
      { tipo: 'galeria', rotulo: '', titulo: 'Na prática', texto: '', itens: ['Telhado|loja', 'Painel|fábrica', 'App|celular'], notas: '' },
      { tipo: 'encerramento', rotulo: '', titulo: 'Obrigado', texto: 'oi@aurora.com', itens: [], notas: '' },
    ],
  }
  const logo = { assetId: 'as-logo', largura: 400, altura: 100, cor: '#1F3B4D', rodape: true }
  it('logo na capa, no encerramento e discreto no rodapé; fotos nos espaços de imagem', () => {
    for (const tema of ['nevoa', 'luxo', 'brutalista', 'vidro'] as const) {
      const doc = montarDocumento(roteiro, { modo: 'slides', tema, estilo: 'editorial', logo, fotos: [{ assetId: 'as-f1', legenda: 'Telhado' }, { assetId: 'as-f2', legenda: 'Painel' }] })
      expect(validarDocumento(doc).erros).toEqual([])
      const imgs = (i: number) => doc.scenes[i]!.layers.filter((l) => l.type === 'image')
      expect(imgs(0).some((l) => l.type === 'image' && l.assetId === 'as-logo' && l.name === 'logo')).toBe(true)
      expect(imgs(3).some((l) => l.type === 'image' && l.assetId === 'as-logo')).toBe(true)
      expect(imgs(1).some((l) => l.type === 'image' && l.name === 'logo-rodape')).toBe(true)
      const fotos = imgs(2).filter((l) => l.type === 'image' && l.assetId.startsWith('as-f'))
      expect(fotos).toHaveLength(2)
      // a proporção do logo é mantida
      const l0 = imgs(0).find((l) => l.name === 'logo')!
      expect(Math.abs(l0.width / l0.height - 4)).toBeLessThan(0.1)
    }
  })
  it('logo escuro sobre fundo escuro vira silhueta branca', () => {
    const doc = montarDocumento(roteiro, { modo: 'slides', tema: 'luxo', estilo: 'editorial', logo: { ...logo, cor: '#151515' } })
    const l = doc.scenes[0]!.layers.find((x) => x.type === 'image' && x.name === 'logo')
    expect(l && l.type === 'image' ? l.adjust : null).toMatchObject({ brightness: 0, invert: 1 })
  })
  it('trocar para um estilo de base oposta inverte claro/escuro e aplica a composição do estilo novo', () => {
    const base = { tipo: 'conceito' as const, variante: 'conceito.frase', fundo: 'claro' as const, alinhamento: 'esquerda' as const, rotulo: '', titulo: 'Uma ideia', enfase: '', texto: '', itens: [], destaque: -1, imagem: '', decoracao: 'nenhuma' as const, notas: '' }
    const r: Roteiro = { titulo: 'X', telas: [{ ...roteiro.telas[0]!, tipo: 'conceito', titulo: 'Uma ideia' }] }
    const desenhada = { ...base, baseTema: 'claro' as const, estiloDesenho: 'minimal' as const }
    const luxo = montarDocumento(r, { modo: 'slides', tema: 'luxo', estilo: 'editorial', desenho: [desenhada] })
    expect(luxo.scenes[0]!.background).toBe(temaPorId('luxo').escuro.fundo)
    // desenhada em "minimal" (sem decoração): no luxo ganha a moldura do estilo
    expect(luxo.scenes[0]!.layers.some((l) => l.name === 'motivo')).toBe(true)
    const suico = montarDocumento(r, { modo: 'slides', tema: 'suico', estilo: 'minimal', desenho: [desenhada] })
    expect(suico.scenes[0]!.background).toBe(temaPorId('suico').claro.fundo)
  })
  it('apresentação de 30 telas monta inteira e válida', () => {
    const telas = Array.from({ length: 30 }, (_, i) => ({ tipo: i === 0 ? 'capa' as const : i === 29 ? 'encerramento' as const : (['conceito', 'lista', 'cartoes', 'numeros', 'processo'] as const)[i % 5]!, rotulo: '', titulo: `Tela ${i + 1} com um título`, texto: 'Texto de apoio.', itens: i % 5 === 3 ? ['10%|a', '20%|b'] : ['A|a', 'B|b', 'C|c'], notas: '' }))
    const doc = montarDocumento({ titulo: 'Longa', telas }, { modo: 'slides', tema: 'startup', estilo: 'ousado', logo })
    expect(doc.scenes).toHaveLength(30)
    expect(validarDocumento(doc).erros).toEqual([])
  })
})
