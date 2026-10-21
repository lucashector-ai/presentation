import { describe, expect, it } from 'vitest'
import { validarDocumento } from '@/lib/scene/validate'
import { COMPONENTES, NOMES_TIPO_TELA, TEMAS, TIPOS_TELA, VARIANTES, compativeis, contraste, legivel, resolverTema, superficie, temaDaMarca, tipoDaVariante } from './designSystem'
import { desenharLocal, enfaseLocal } from './desenhoLocal'
import { caber, contarLinhas, dividirEnfase, montarTela, numeroDe, type TelaDesenhada } from './montagem'
import { montarDocumento, type Roteiro } from './roteiro'

const ITENS: Partial<Record<(typeof TIPOS_TELA)[number], string[]>> = {
  agenda: ['Contexto|onde estamos', 'Proposta', 'Plano|como fazemos'],
  lista: ['Diagnóstico em duas semanas', 'Conceito e protótipo', 'Lançamento com métricas'],
  cartoes: ['Estratégia|posicionamento', 'Identidade|marca e aplicações', 'Lançamento|plano de estreia'],
  processo: ['Conecta|em minutos', 'Analisa|o que melhorar', 'Entrega|no primeiro mês'],
  numeros: ['+38%|engajamento', '2×|conversão', '6 sem.|até o lançamento'],
  grafico: ['3,2|Norte', '4,1|Sul', '2,7|Leste'],
  comparacao: ['Hoje', 'Depois', 'Manual', 'Automático'],
  linhaTempo: ['Mar 2027|Piloto', 'Jun 2027|Ajustes', 'Dez 2027|Relatório'],
  galeria: ['Embalagem|frente', 'Fachada|rua', 'Digital|site'],
  equipe: ['Ana Lima|CEO', 'Bruno Costa|CTO'],
  precos: ['Essencial|R$ 4.900|Estratégia; Identidade', 'Completo|R$ 9.800|Tudo'],
  paleta: ['Terracota|#B4532A', 'Argila|#EEE7DB'],
  cta: ['Agendar conversa', 'E-mail|ana@aurora.com'],
  encerramento: ['E-mail|ana@aurora.com'],
}

/** Uma tela por variante do catálogo, com conteúdo no formato do componente. */
function telasDeTodasAsVariantes(story: boolean): { roteiro: Roteiro; desenho: TelaDesenhada[] } {
  const telas: Roteiro['telas'] = []
  const desenho: TelaDesenhada[] = []
  for (const tipo of TIPOS_TELA) {
    for (const v of COMPONENTES[tipo].variantes) {
      if (story && v.soSlides) continue
      const t = { tipo, rotulo: v.nome, titulo: `${COMPONENTES[tipo].nome} que resolve o problema`, texto: 'Uma frase de apoio curta.', itens: ITENS[tipo] ?? [], notas: 'nota' }
      telas.push(t)
      desenho.push({ ...t, variante: v.id, fundo: 'claro', alinhamento: 'esquerda', enfase: 'o problema', destaque: 0, imagem: 'foto do produto', decoracao: 'marcante' })
    }
  }
  return { roteiro: { titulo: 'Catálogo', telas }, desenho }
}

describe('catálogo de componentes', () => {
  it('cada tipo tem nome, uso e ao menos uma variante com id "tipo.nome"', () => {
    for (const t of TIPOS_TELA) {
      expect(NOMES_TIPO_TELA[t]).toBeTruthy()
      expect(COMPONENTES[t].variantes.length).toBeGreaterThan(0)
      for (const v of COMPONENTES[t].variantes) expect(tipoDaVariante(v.id)).toBe(t)
    }
    expect(new Set(VARIANTES).size).toBe(VARIANTES.length)
    expect(tipoDaVariante('capa.inexistente')).toBeNull()
  })
  it('todo tipo tem ao menos uma variante que serve para story', () => {
    for (const t of TIPOS_TELA) expect(COMPONENTES[t].variantes.some((v) => !v.soSlides)).toBe(true)
  })
  it('famílias de troca: lista ↔ cartões; capa não vira outra coisa', () => {
    expect(compativeis('lista', 'cartoes')).toBe(true)
    expect(compativeis('numeros', 'grafico')).toBe(true)
    expect(compativeis('capa', 'conceito')).toBe(false)
    expect(compativeis('capa', 'capa')).toBe(true)
  })
})

describe('temas e cores', () => {
  it('todo tema tem texto legível nas duas superfícies e sobre o acento', () => {
    for (const t of TEMAS) {
      expect(contraste(t.claro.tinta, t.claro.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(t.escuro.tinta, t.escuro.fundo)).toBeGreaterThanOrEqual(7)
      // telas de acento levam títulos grandes (WCAG AA para texto grande: 3:1)
      expect(contraste(t.sobreAcento, t.acento)).toBeGreaterThanOrEqual(3)
      for (const f of ['claro', 'escuro', 'acento'] as const) expect(contraste(superficie(t, f).destaque, superficie(t, f).fundo)).toBeGreaterThanOrEqual(2.9)
    }
  })
  it('tema da marca mantém contraste com qualquer cor (amarelo, azul escuro, rosa claro)', () => {
    for (const cor of ['#F5D300', '#0B2A5B', '#F7C6D9', '#00A86B', '#FFFFFF']) {
      const t = temaDaMarca({ nome: 'Aurora', cores: [cor] })
      expect(t.id).toBe('marca')
      expect(contraste(t.claro.tinta, t.claro.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(t.escuro.tinta, t.escuro.fundo)).toBeGreaterThanOrEqual(7)
      expect(contraste(t.sobreAcento, t.acento)).toBeGreaterThanOrEqual(4.5)
    }
    expect(temaDaMarca({ nome: 'X', cores: ['#5965F2', '#101820'] }).escuro.fundo).toBe('#101820')
    expect(resolverTema('marca', { nome: '', cores: [] }).id).toBe(TEMAS[0].id)
    expect(resolverTema('inexistente').id).toBe(TEMAS[0].id)
  })
  it('legível escolhe a primeira opção com contraste suficiente', () => {
    expect(legivel('#FFFFFF', ['#EEEEEE', '#111111'])).toBe('#111111')
    expect(legivel('#000000', ['#FFFFFF', '#111111'])).toBe('#FFFFFF')
  })
})

describe('medição de texto', () => {
  it('mais texto ou fonte maior nunca ocupa menos linhas', () => {
    expect(contarLinhas('Uma frase curta', 'Geist', 40, 1600)).toBe(1)
    expect(contarLinhas('palavra '.repeat(40), 'Geist', 40, 600)).toBeGreaterThan(contarLinhas('palavra '.repeat(10), 'Geist', 40, 600))
    expect(contarLinhas('Título do slide', 'Geist', 200, 800)).toBeGreaterThanOrEqual(contarLinhas('Título do slide', 'Geist', 100, 800))
    expect(contarLinhas('a\nb\nc', 'Geist', 30, 900)).toBe(3)
    // números e maiúsculas são mais largos que a média; negrito também
    expect(contarLinhas('R$ 2.400/MÊS', 'Inter', 68, 340, { peso: 700 })).toBeGreaterThan(1)
  })
  it('caber escolhe o maior tamanho que cabe nas linhas e na altura', () => {
    expect(caber('Curto', 'Geist', 1600, [200, 120], 1).tamanho).toBe(200)
    const r = caber('Um título bem comprido que não cabe numa linha só', 'Geist', 1400, [200, 150, 100, 80], 2)
    expect(r.linhas).toBeLessThanOrEqual(2)
    expect(r.tamanho).toBeLessThan(200)
    expect(caber('Capa: tipográfica que resolve', 'Inter', 1660, [250, 220, 190, 160, 136], 3, { alturaMax: 400 }).tamanho).toBeLessThan(250)
  })
  it('ênfase só vale para um trecho final exato do título', () => {
    expect(dividirEnfase('Energia solar para todos', 'para todos')).toEqual(['Energia solar', 'para todos'])
    expect(dividirEnfase('Energia solar para todos.', 'PARA TODOS')).toEqual(['Energia solar', 'para todos.'])
    expect(dividirEnfase('Energia solar para todos', 'solar')).toBeNull()
    expect(dividirEnfase('Curto', 'Curto')).toBeNull()
    expect(dividirEnfase('Um título', '')).toBeNull()
  })
  it('ênfase local leva junto palavras fracas e evita títulos curtos', () => {
    expect(enfaseLocal('Proposta de rebrand para a Café Bairro')).toBe('para a Café Bairro')
    expect(enfaseLocal('Um problema caro que ninguém resolveu bem')).toBe('que ninguém resolveu bem')
    expect(enfaseLocal('Obrigado')).toBe('')
  })
  it('números em português', () => {
    expect(numeroDe('R$ 4,2 bi')).toBe(4.2)
    expect(numeroDe('1.200 clientes')).toBe(1200)
    expect(numeroDe('38%')).toBe(38)
    expect(numeroDe('sem número')).toBeNull()
  })
})

describe('montagem de todas as variantes', () => {
  for (const tema of TEMAS) {
    for (const modo of ['slides', 'story'] as const) {
      it(`${tema.id} · ${modo}: documento válido, textos dentro da tela`, () => {
        const { roteiro, desenho } = telasDeTodasAsVariantes(modo === 'story')
        const doc = montarDocumento(roteiro, { modo, tema: tema.id, estilo: 'ousado', desenho })
        expect(validarDocumento(doc).erros).toEqual([])
        expect(doc.scenes).toHaveLength(roteiro.telas.length)
        for (const cena of doc.scenes) {
          const ids = cena.layers.map((l) => l.id)
          expect(new Set(ids).size).toBe(ids.length)
          for (const l of cena.layers) {
            if (l.type !== 'text' || !l.text) continue
            expect(l.x).toBeGreaterThanOrEqual(0)
            expect(l.x + l.width).toBeLessThanOrEqual(cena.size.width + 2)
            expect(l.y + Math.min(l.height, 40)).toBeLessThanOrEqual(cena.size.height)
          }
        }
      })
    }
  }
  it('a montagem respeita o tipo das camadas por papel (ids "titulo-", "valor-", "item-")', () => {
    const t = resolverTema('argila')
    const base = { tema: t, estilo: 'editorial' as const, story: false, numero: 2, total: 5, tituloProjeto: 'X', marca: '', motivos: true, placeholders: false, indiceSecao: 1, reservarDireita: false, uid: (() => { let n = 0; return (p: string) => `${p}-${++n}` })() }
    const d: TelaDesenhada = { tipo: 'numeros', variante: 'numeros.grandes', fundo: 'claro', alinhamento: 'esquerda', rotulo: 'Resultados', titulo: 'Os números', enfase: '', texto: '', itens: ['+38%|engajamento', '2×|conversão'], destaque: 0, imagem: '', decoracao: 'sutil', notas: '' }
    const m = montarTela(d, base)
    expect(m.layers.filter((l) => l.id.startsWith('valor-'))).toHaveLength(2)
    expect(m.layers.some((l) => l.id.startsWith('titulo-'))).toBe(true)
    expect(m.layers.some((l) => l.id.startsWith('rodape-') || l.id.startsWith('pagina-'))).toBe(true)
    // gráfico sem números vira métricas
    const g = montarTela({ ...d, tipo: 'grafico', variante: 'grafico.barras', itens: ['muito|a', 'pouco|b'] }, base)
    expect(g.layers.some((l) => l.id.startsWith('barra-'))).toBe(false)
  })
  it('estilos de cor do documento ligados às camadas; morph entre telas com o motivo do tema', () => {
    const { roteiro, desenho } = telasDeTodasAsVariantes(false)
    const doc = montarDocumento(roteiro, { modo: 'slides', tema: 'argila', estilo: 'editorial', desenho })
    expect(doc.theme?.colorStyles?.map((c) => c.id)).toContain('cor-acento')
    expect(doc.scenes.some((s) => s.layers.some((l) => l.colorStyleIds))).toBe(true)
    expect(doc.scenes.some((s) => s.transition?.type === 'morph')).toBe(true)
    const minimal = montarDocumento(roteiro, { modo: 'slides', tema: 'argila', estilo: 'minimal', desenho })
    expect(minimal.scenes.some((s) => s.transition?.type === 'morph')).toBe(false)
  })
})

describe('design local (modo demo)', () => {
  const t = (tipo: TelaDesenhada['tipo'], titulo = 'Um título de tela qualquer', itens: string[] = []) => ({ tipo, rotulo: '', titulo, texto: '', itens, notas: '' })
  it('escolhe a capa pelo estilo e alterna variantes do mesmo tipo', () => {
    const r: Roteiro = { titulo: 'X', telas: [t('capa', 'Aurora'), t('conceito'), t('lista', 'L', ['a', 'b', 'c', 'd', 'e']), t('conceito'), t('cartoes', 'C', ['a|b', 'c|d']), t('cartoes', 'C2', ['a|b', 'c|d']), t('encerramento', 'Obrigado')] }
    const tema = resolverTema('argila')
    expect(desenharLocal(r, { story: false, estilo: 'ousado', tema })[0]!.variante).toBe('capa.tipografica')
    expect(desenharLocal(r, { story: false, estilo: 'minimal', tema })[0]!.variante).toBe('capa.centrada')
    const ed = desenharLocal(r, { story: false, estilo: 'editorial', tema })
    expect(ed[0]!.variante).toBe('capa.classica')
    expect(ed[4]!.variante).not.toBe(ed[5]!.variante)
    // nunca duas telas seguidas com o mesmo fundo forte
    for (let i = 1; i < ed.length - 1; i++) if (ed[i]!.fundo !== tema.base) expect(ed[i - 1]!.fundo === ed[i]!.fundo).toBe(false)
  })
  it('story nunca recebe variante só de slides; preços destacam o plano do meio', () => {
    const r: Roteiro = { titulo: 'X', telas: [t('capa'), t('linhaTempo', 'T', ['a|b', 'c|d']), t('precos', 'P', ['a|1|x', 'b|2|y', 'c|3|z']), t('encerramento', 'Fim', ['E-mail|a@b.com'])] }
    const d = desenharLocal(r, { story: true, estilo: 'editorial', tema: resolverTema('mare') })
    for (const x of d) expect(COMPONENTES[x.tipo].variantes.find((v) => v.id === x.variante)?.soSlides).toBeFalsy()
    expect(d[2]!.destaque).toBe(1)
  })
})
