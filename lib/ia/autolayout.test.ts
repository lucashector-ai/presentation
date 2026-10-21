/**
 * Auto layout das telas geradas: em todos os componentes × variantes × estilos (slides e story), com conteúdo
 * curto e no limite, nenhum texto se sobrepõe a outro texto, a imagens ou a cartões; nada sai da tela nem do
 * frame que o contém; e o texto cabe na própria caixa (na largura final, depois do auto layout).
 */
import { describe, expect, it } from 'vitest'
import { calcularLayout } from '@/lib/editor/autolayout'
import type { Camada as CamadaCena } from '@/lib/scene/schema'
import { COMPONENTES, TEMAS, TIPOS_TELA, type TipoTela } from './designSystem'
import { contarLinhas, montarTela, type ContextoMontagem, type Estilo, type TelaDesenhada } from './montagem'

type C = Record<string, unknown> & { id: string; type: string; x: number; y: number; width: number; height: number; parentId?: string }

const CURTO: Partial<Record<TipoTela, string[]>> = {
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

/** Conteúdo no limite do componente (mais itens e textos mais longos que o roteiro costuma ter). */
const LONGO: Partial<Record<TipoTela, string[]>> = {
  agenda: ['O contexto do mercado|onde estamos e por que agora', 'A proposta|o que muda para o cliente', 'O plano de execução|como fazemos em seis meses', 'Os números|tração e projeções', 'A equipe|quem faz', 'O pedido|o que precisamos'],
  lista: ['Diagnóstico completo da operação em duas semanas com a equipe', 'Conceito e protótipo navegável validado com clientes reais', 'Lançamento gradual com métricas acompanhadas toda semana', 'Ajustes contínuos a partir do uso real', 'Relatório de resultados para o conselho'],
  cartoes: ['Estratégia de marca|posicionamento, arquitetura e mensagens-chave para cada público', 'Identidade visual|marca, tipografia, cores e aplicações nos pontos de contato', 'Lançamento|plano de estreia com conteúdo, mídia e eventos em três cidades', 'Acompanhamento|relatórios mensais e ajustes de rota com a diretoria'],
  processo: ['Conecta|integração com os sistemas atuais em poucos minutos', 'Analisa|o que melhorar com base nos dados de uso', 'Recomenda|ações priorizadas por impacto e esforço', 'Entrega|resultados medidos no primeiro mês', 'Escala|para outras unidades da rede'],
  numeros: ['R$ 4,2 bi|mercado endereçável no Brasil', '+38%|engajamento depois do piloto', '2,4×|conversão em relação ao canal atual', '6 sem.|do contrato ao lançamento'],
  grafico: ['3,2|Região Norte', '4,1|Região Sul', '2,7|Região Leste', '5,6|Região Oeste', '1,9|Centro', '4,4|Litoral'],
  comparacao: ['Hoje, sem a plataforma', 'Depois, com a plataforma', 'Planilhas soltas e retrabalho', 'Um painel único e atualizado', 'Três dias para fechar o mês', 'Fechamento em uma tarde', 'Decisão no escuro', 'Alertas antes do problema'],
  linhaTempo: ['Mar 2027|Piloto em três escolas da rede', 'Jun 2027|Ajustes com professores e famílias', 'Set 2027|Expansão para vinte escolas', 'Dez 2027|Relatório de impacto', 'Mar 2028|Rede estadual', 'Jun 2028|Avaliação externa'],
  galeria: ['Embalagem|frente e verso', 'Fachada|loja da rua Augusta', 'Digital|site e aplicativo', 'Uniforme|equipe de atendimento', 'Sacola|papel reciclado', 'Cardápio|versão impressa'],
  equipe: ['Ana Lima|CEO, ex-diretora de operações', 'Bruno Costa|CTO, engenharia de dados', 'Carla Dias|Design e pesquisa', 'Diego Rocha|Vendas e parcerias', 'Elisa Prado|Financeiro', 'Fábio Nunes|Atendimento'],
  precos: ['Essencial|R$ 4.900|Estratégia; Identidade; Manual da marca', 'Completo|R$ 9.800|Tudo do Essencial; Site; Lançamento; Três meses de suporte', 'Sob medida|Consulte|Equipe dedicada; Relatórios; Treinamento', 'Rede|R$ 19.900|Várias unidades; Painel; Integrações'],
  paleta: ['Terracota|#B4532A', 'Argila|#EEE7DB', 'Grafite|#2B2B2B', 'Musgo|#5E6B3A', 'Areia|#D9C7A7'],
  cta: ['Agendar uma conversa', 'E-mail|ana.lima@aurora-energia.com.br', 'Telefone|+55 11 99999-0000'],
  encerramento: ['E-mail|ana.lima@aurora-energia.com.br', 'Site|aurora-energia.com.br', 'Telefone|+55 11 99999-0000'],
}

const corte = (s: string, n: number) => (n > 0 && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') : s)

function telas(story: boolean, longo: boolean): TelaDesenhada[] {
  const r: TelaDesenhada[] = []
  for (const tipo of TIPOS_TELA) {
    const comp = COMPONENTES[tipo]
    for (const v of comp.variantes) {
      if (story && v.soSlides) continue
      const titulo = longo
        ? corte(tipo === 'citacao' ? 'A plataforma mudou a forma como a nossa equipe decide: hoje vemos o problema antes do cliente e agimos no mesmo dia, sem planilha' : 'Para começar, buscamos um investimento de R$ 5 milhões para crescer', comp.limites.titulo)
        : `${comp.nome} que resolve o problema`
      const enfase = longo ? (titulo.endsWith('crescer') ? 'para crescer' : titulo.split(' ').slice(-2).join(' ')) : 'o problema'
      const texto = longo ? corte('Uma frase de apoio que explica o contexto com números do material da pessoa, em linguagem simples e direta para a plateia entender rápido.', comp.limites.texto) : 'Uma frase de apoio curta.'
      const itens = ((longo ? LONGO : CURTO)[tipo] ?? []).slice(0, Math.max(comp.maxItens, 0)).map((i) => corte(i, comp.limites.item + 40))
      r.push({ tipo, variante: v.id, fundo: 'claro', alinhamento: 'esquerda', rotulo: longo ? 'O pedido · rodada semente' : v.nome, titulo, enfase, texto: comp.limites.texto ? texto : '', itens, destaque: 1, imagem: 'foto do produto em uso', decoracao: 'marcante', notas: '' })
    }
  }
  return r
}

const sobrepoe = (a: C, b: C, tol = 2) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > tol && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > tol
const nome = (l: C) => `${l.id}${l.type === 'text' ? ` "${String(l.text).slice(0, 30)}"` : ''}`

/** Problemas de layout de uma tela montada (lista vazia = ok). */
function problemas(layers: C[], W: number, H: number, variante: string): string[] {
  const r: string[] = []
  const porId = new Map(layers.map((l) => [l.id, l]))
  const ancestrais = (l: C) => { const a = new Set<string>(); let p = l.parentId ? porId.get(l.parentId) : undefined; while (p && !a.has(p.id)) { a.add(p.id); p = p.parentId ? porId.get(p.parentId) : undefined } return a }
  const textos = layers.filter((l) => l.type === 'text')
  // conteúdo que um texto não pode cobrir: imagens (fotos, logo, espaços de imagem) e caixas cheias (cartões, avatares…)
  const conteudo = layers.filter((l) => l.type === 'image' || (l.type === 'frame' && (/^imagem-/.test(l.id) || (!!l.fill && /^(cartao|caixa|avatar|marcador|cor)-/.test(l.id)))))
  const fundoCheio = (l: C) => l.width >= W * 0.9 && l.height >= H * 0.9
  for (const t of textos) {
    if (t.x < -2 || t.y < -2 || t.x + t.width > W + 2 || t.y + t.height > H + 2) r.push(`fora da tela: ${nome(t)} (${t.x},${t.y},${t.width}×${t.height})`)
    const anc = ancestrais(t)
    for (const u of textos) if (u.id < t.id && sobrepoe(t, u)) r.push(`texto sobre texto: ${nome(t)} × ${nome(u)}`)
    for (const c of conteudo) if (!anc.has(c.id) && !(variante === 'imagem.cheia' && fundoCheio(c)) && sobrepoe(t, c)) r.push(`texto sobre conteúdo: ${nome(t)} × ${nome(c)}`)
    // o texto cabe na caixa, na largura final (estimativa da montagem; o editor mede de novo no DOM)
    if (!t.background) {
      const tam = Number(t.fontSize)
      const linhas = contarLinhas(String(t.text), String(t.fontFamily), tam, t.width, { maiusculas: t.transform === 'uppercase', espacamento: Number(t.letterSpacing ?? 0), peso: Number(t.fontWeight ?? 400) })
      if (linhas * tam * Number(t.lineHeight ?? 1.2) > t.height + tam * 0.25) r.push(`texto maior que a caixa: ${nome(t)} (${linhas} linhas em ${t.height}px)`)
    }
  }
  // filhos no fluxo ficam dentro do frame
  for (const l of layers) {
    const p = l.parentId ? porId.get(l.parentId) : undefined
    if (!p || l.absolute) continue
    if (l.x < p.x - 2 || l.y < p.y - 2 || l.x + l.width > p.x + p.width + 2 || l.y + l.height > p.y + p.height + 2) r.push(`fora do frame: ${nome(l)} em ${p.id}`)
  }
  // o resultado já vem resolvido: o auto layout do editor não move nada
  const z = layers.map((l, i) => ({ ...l, z: i })) as unknown as CamadaCena[]
  const de = calcularLayout(z)
  if (de !== z) {
    const mudou = (de as unknown as C[]).filter((l, i) => l.x !== layers[i]!.x || l.y !== layers[i]!.y || l.width !== layers[i]!.width || l.height !== layers[i]!.height)
    if (mudou.length) r.push(`auto layout não resolvido: ${mudou.slice(0, 3).map(nome).join(', ')}`)
  }
  return r
}

const LOGO = { assetId: 'logo-teste', largura: 400, altura: 120, cor: '#222222', rodape: true }

describe('auto layout das telas geradas (sem caixas sobrepostas)', () => {
  for (const story of [false, true]) {
    for (const estilo of ['editorial', 'ousado'] as Estilo[]) {
      it(`${story ? 'story' : 'slides'} · ${estilo}: todos os estilos × componentes × variantes`, () => {
        const W = story ? 1080 : 1920
        const H = story ? 1920 : 1080
        const erros: string[] = []
        let seq = 0
        for (const tema of TEMAS) {
          for (const longo of [false, true]) {
            const lista = telas(story, longo)
            lista.forEach((d, i) => {
              const c: ContextoMontagem = {
                tema, estilo, story, numero: i + 1, total: lista.length, tituloProjeto: 'Aurora', marca: 'Aurora', motivos: true, placeholders: i % 2 === 0, indiceSecao: 1,
                reservarDireita: false, uid: (p) => `${p}-${(++seq).toString(36)}`, logo: longo ? LOGO : null,
              }
              for (const fundo of ['claro', 'escuro', 'acento'] as const) {
                const m = montarTela({ ...d, fundo, alinhamento: i % 3 === 0 ? 'centro' : 'esquerda' }, c)
                for (const p of problemas(m.layers as C[], W, H, d.variante)) erros.push(`${tema.id} · ${d.variante} · ${fundo}${longo ? ' · longo' : ''}: ${p}`)
              }
            })
          }
        }
        expect(erros.slice(0, 40), `${erros.length} problemas`).toEqual([])
      }, 60_000) // percorre todos os estilos × componentes × variantes: pesado sob carga
    }
  }

  it('título com ênfase: as duas partes no mesmo frame de auto layout, sem vão e sem sobrepor', () => {
    let seq = 0
    const d: TelaDesenhada = { tipo: 'cta', variante: 'cta.botao', fundo: 'claro', alinhamento: 'esquerda', rotulo: 'O pedido', titulo: 'Para começar, buscamos R$ 5 milhões', enfase: 'R$ 5 milhões', texto: 'Rodada semente para os próximos 18 meses.', itens: ['Agendar conversa'], destaque: -1, imagem: '', decoracao: 'sutil', notas: '' }
    const m = montarTela(d, { tema: TEMAS[0]!, estilo: 'editorial', story: false, numero: 9, total: 10, tituloProjeto: 'Aurora', marca: 'Aurora', motivos: true, placeholders: false, indiceSecao: 1, reservarDireita: false, uid: (p) => `${p}-${++seq}` })
    const L = m.layers as C[]
    const a = L.find((l) => l.id.startsWith('titulo-'))!
    const b = L.find((l) => l.id.startsWith('enfase-'))!
    expect(a.parentId).toBeTruthy()
    expect(b.parentId).toBe(a.parentId)
    const grupo = L.find((l) => l.id === a.parentId)!
    expect(grupo.type).toBe('frame')
    expect((grupo.layout as { gap: number }).gap).toBe(0)
    expect(b.y).toBe(a.y + a.height)
    expect(a.sizingH).toBe('hug')
    expect(b.sizingH).toBe('hug')
    // rótulo, título e texto num bloco de auto layout com gap do tema
    const bloco = L.find((l) => l.id.startsWith('bloco-'))!
    expect(bloco.type).toBe('frame')
    expect(L.find((l) => l.id.startsWith('texto-'))!.parentId).toBe(bloco.id)
  })
})
