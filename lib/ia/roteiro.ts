/**
 * Roteiro (outline) de uma apresentação e a montagem do documento a partir dele.
 * Usado pelo "Criar com IA" (a IA escreve o roteiro e desenha cada tela; o motor do design system monta as
 * camadas, sempre válidas) e pelos templates do novo projeto. Puro: sem rede, sem DOM.
 */
import { z } from 'zod'
import { FORMATOS, SCHEMA_VERSION, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import { parseDocumento } from '@/lib/scene/migrar'
import { COMPONENTES, TEMAS, TIPOS_DADOS, TIPOS_TELA, regrasDe, resolverTema, type Marca, type TemaEscolhido, type TemaId, type TemaVisual, type TipoTela } from './designSystem'
import { desenharLocal } from './desenhoLocal'
import { entrelinhaNaGrade, naGrade } from './grade8'
import { montarTela, type Estilo, type FotoMontagem, type LogoMontagem, type TelaDesenhada } from './montagem'

export { TEMAS, TIPOS_TELA, type TemaId, type TipoTela }
export type { Estilo }

export const TelaRoteiroSchema = z.object({
  tipo: z.enum(TIPOS_TELA),
  /** Rótulo curto acima do título ("O problema", "Cronograma"). */
  rotulo: z.string().trim().max(40).default(''),
  titulo: z.string().trim().min(1).max(160),
  texto: z.string().trim().max(600).default(''),
  /** Itens no formato do tipo: pontos, "valor|legenda", "Título|descrição", "Nome|#hex"… (ver COMPONENTES). */
  itens: z.array(z.string().trim().max(160)).max(8).default([]),
  notas: z.string().trim().max(1200).default(''),
})
export type TelaRoteiro = z.infer<typeof TelaRoteiroSchema>

export const ESTILOS = ['editorial', 'ousado', 'minimal'] as const

export const RoteiroSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  telas: z.array(TelaRoteiroSchema).min(1).max(100),
})
export type Roteiro = z.infer<typeof RoteiroSchema>

export const OPCOES_IMAGENS = ['formas', 'placeholders', 'nenhuma'] as const
export type OpcaoImagens = (typeof OPCOES_IMAGENS)[number]
export const DENSIDADES = ['minimo', 'medio', 'detalhado'] as const
export type Densidade = (typeof DENSIDADES)[number]

export interface OpcoesDocumento {
  modo: ModoProjeto
  tema: TemaEscolhido
  estilo: Estilo
  /** formas: motivos do tema; placeholders: espaços para imagens suas na capa; nenhuma: só tipografia. */
  imagens?: OpcaoImagens
  /** Quanto texto de apoio entra em cada tela. */
  densidade?: Densidade
  /** Desenho de cada tela (da IA). Ausente = desenho local determinístico. */
  desenho?: (TelaDesenhada | null | undefined)[]
  /** Nome, cores e fontes da marca (aplicadas sobre o estilo) e o nome no rodapé. */
  marca?: Marca
  /** Logo da marca: capa, encerramento e (opcional) rodapé. */
  logo?: LogoMontagem | null
  /** Fotos da pessoa: ocupam os espaços de imagem, na ordem das telas. */
  fotos?: FotoMontagem[]
  /** Direção visual pedida para cada tela (pedido com estrutura explícita): orienta o desenho local. */
  direcoes?: string[]
}

const corta = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

/** Aplica densidade e imagens ao desenho antes da montagem. */
function prepararDesenho(d0: TelaDesenhada, imagens: OpcaoImagens, densidade: Densidade, tema: TemaVisual, story: boolean): TelaDesenhada {
  let d = d0
  // o estilo tem composição própria: ao trocar de estilo, a variante que ele não usa vira a preferida dele (grátis, sem IA)
  const preferidas = (regrasDe(tema).variantes[d.tipo] ?? []).filter((id) => COMPONENTES[d.tipo].variantes.some((v) => v.id === id && !(story && v.soSlides)))
  if (preferidas.length && !preferidas.includes(d.variante)) d = { ...d, variante: preferidas[0]!, alinhamento: ['capa.centrada', 'conceito.enfase', 'encerramento.centrado', 'cta.faixa'].includes(preferidas[0]!) ? 'centro' : 'esquerda' }
  let r = d
  if (imagens === 'nenhuma' && r.tipo === 'imagem') r = { ...r, tipo: 'conceito', variante: 'conceito.frase' }
  if (imagens === 'nenhuma' && r.tipo === 'galeria') r = { ...r, tipo: 'cartoes', variante: 'cartoes.linhas' }
  if (imagens === 'nenhuma' && r.variante === 'capa.dividida') r = { ...r, imagem: '' }
  // dados (tabela, funil, gráfico, painel, roadmap) nunca perdem itens: cortar uma linha mudaria o que os números dizem
  const dados = TIPOS_DADOS.includes(r.tipo) || r.tipo === 'roadmap'
  if (densidade === 'minimo' && !['capa', 'citacao', 'encerramento', 'cta'].includes(r.tipo)) r = { ...r, texto: dados ? corta(r.texto, 140) : '', itens: dados ? r.itens : r.itens.slice(0, r.tipo === 'comparacao' ? 6 : 3) }
  if (densidade === 'medio') r = { ...r, texto: corta(r.texto, 240), itens: dados ? r.itens : r.itens.slice(0, r.tipo === 'comparacao' ? 6 : 5) }
  return r
}

const ESTILOS_COR: { id: string; nome: string; cor: (t: TemaVisual) => string }[] = [
  { id: 'cor-fundo', nome: 'Fundo', cor: (t) => t.claro.fundo },
  { id: 'cor-tinta', nome: 'Texto', cor: (t) => t.claro.tinta },
  { id: 'cor-suave', nome: 'Texto secundário', cor: (t) => t.claro.suave },
  { id: 'cor-cartao', nome: 'Cartão', cor: (t) => t.claro.cartao },
  { id: 'cor-escuro', nome: 'Fundo escuro', cor: (t) => t.escuro.fundo },
  { id: 'cor-tinta-escuro', nome: 'Texto no escuro', cor: (t) => t.escuro.tinta },
  { id: 'cor-acento', nome: 'Acento', cor: (t) => t.acento },
  { id: 'cor-acento-2', nome: 'Acento 2', cor: (t) => t.acento2 },
]

/** Liga as cores literais das camadas aos estilos de cor do documento (editar "Acento" muda o deck inteiro). */
function ligarEstilos(layers: Record<string, unknown>[], mapa: Map<string, string>) {
  for (const l of layers) {
    const ids: Record<string, string> = {}
    for (const prop of ['fill', 'color', 'stroke', 'background'] as const) {
      const v = l[prop]
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) {
        const id = mapa.get(v.toUpperCase())
        if (id) ids[prop] = id
      }
    }
    if (Object.keys(ids).length) l.colorStyleIds = ids
  }
}

let seq = 0
const uid = (p: string) => `${p}-${(++seq).toString(36)}`

/** Gera o documento completo a partir do roteiro (e do desenho de cada tela, se houver). Sempre válido pelo schema. */
export function montarDocumento(roteiro: Roteiro, opcoes: OpcoesDocumento): DocumentoProjeto {
  seq = 0
  const imagens = opcoes.imagens ?? 'formas'
  const densidade = opcoes.densidade ?? 'detalhado'
  const tema = resolverTema(opcoes.tema, opcoes.marca)
  const story = opcoes.modo === 'story'
  const size = story ? FORMATOS.story : FORMATOS.slides169
  const locais = desenharLocal(roteiro, { story, estilo: opcoes.estilo, tema, direcoes: opcoes.direcoes })
  const explorar = opcoes.modo === 'explorar' && roteiro.telas.length > 1
  let secoes = 0
  const colunas = Math.ceil(Math.sqrt(roteiro.telas.length))
  // fotos da pessoa: cada espaço de imagem pega a próxima (sem repetir); acabou, fica o espaço listrado
  const fotos = [...(opcoes.fotos ?? [])]
  const foto = () => fotos.shift() ?? null
  const montadas = roteiro.telas.map((t, i) => {
    if (t.tipo === 'secao') secoes++
    const d = prepararDesenho({ ...(opcoes.desenho?.[i] ?? locais[i]!), notas: opcoes.desenho?.[i]?.notas || t.notas }, imagens, densidade, tema, story)
    const m = montarTela(explorar && i === 0 ? { ...d, variante: d.variante === 'capa.dividida' || d.variante === 'capa.centrada' ? 'capa.classica' : d.variante } : d, {
      tema, estilo: opcoes.estilo, story, numero: i + 1, total: roteiro.telas.length, tituloProjeto: roteiro.titulo, marca: opcoes.marca?.nome.trim() ?? '',
      motivos: imagens === 'formas', placeholders: imagens === 'placeholders', indiceSecao: secoes, reservarDireita: explorar && i === 0, uid,
      logo: opcoes.logo ?? null, foto,
    })
    return { t, d, m }
  })
  const temMotivo = (k: number) => !!montadas[k]?.m.layers.some((l) => l.name === 'motivo')
  const telas = montadas.map(({ t, d, m }, i) => {
    const morph = opcoes.modo === 'slides' && opcoes.estilo !== 'minimal' && i > 0 && temMotivo(i) && temMotivo(i - 1)
    return {
      id: `tela-${String(i + 1).padStart(2, '0')}-${d.tipo}`,
      title: corta(d.titulo || t.titulo, 60),
      size,
      background: m.background,
      ...(m.backgroundGradient ? { backgroundGradient: m.backgroundGradient } : {}),
      notes: d.notas,
      transition: morph ? { type: 'morph', duration: 800, easing: 'easeInOut' } : { type: i === 0 ? 'fade' : opcoes.estilo === 'ousado' ? 'slide' : 'fade', duration: 600, easing: 'easeInOut' },
      ...(opcoes.modo === 'explorar' ? { map: { x: (i % colunas) * (size.width + 360), y: Math.floor(i / colunas) * (size.height + 360) } } : {}),
      layers: m.layers as Record<string, unknown>[],
    }
  })
  // modo explorar: a capa ganha um menu de hotspots para as outras telas (lado direito, reservado na montagem, na grade de 8)
  if (explorar) {
    const capa = telas[0]!
    const tinta = String(capa.layers.find((l) => String(l.id).startsWith('titulo-'))?.color ?? tema.claro.tinta)
    const destinos = telas.slice(1, 7)
    destinos.forEach((d, k) => {
      capa.layers.push({ id: uid('menu'), type: 'text', text: `${String(k + 2).padStart(2, '0')}  ${d.title}`, x: naGrade(size.width * 0.6), y: naGrade(size.height * 0.2) + k * 96, width: naGrade(size.width * 0.34), height: 72, fontFamily: tema.fontes.texto, fontSize: 34, lineHeight: entrelinhaNaGrade(34, 1.15), fontWeight: 500, color: tinta, z: capa.layers.length, ariaLabel: `Ir para ${d.title}`, interactions: [{ trigger: 'click', do: { action: 'goToScene', targetSceneId: d.id }, transition: { type: 'scale', duration: 700 } }] })
    })
    for (const d of destinos) {
      const cor = String(d.layers.find((l) => String(l.id).startsWith('titulo-'))?.color ?? tema.claro.tinta)
      d.layers.push({ id: uid('voltar'), type: 'text', text: '← Início', x: size.width - 336, y: 40, width: 240, height: 48, fontFamily: tema.fontes.texto, fontSize: 28, lineHeight: entrelinhaNaGrade(28, 1.15), color: cor, align: 'right', z: d.layers.length, ariaLabel: 'Voltar ao início', interactions: [{ trigger: 'click', do: { action: 'goToScene', targetSceneId: capa.id } }] })
    }
  }
  const estilosCor = ESTILOS_COR.map((e) => ({ id: e.id, name: e.nome, color: e.cor(tema).slice(0, 7).toUpperCase() }))
  const mapa = new Map<string, string>()
  for (const e of estilosCor) if (!mapa.has(e.color)) mapa.set(e.color, e.id)
  for (const t of telas) ligarEstilos(t.layers, mapa)
  return parseDocumento({ schemaVersion: SCHEMA_VERSION, mode: opcoes.modo, theme: { palette: tema.paleta, fontTitle: tema.fontes.titulo, fontBody: tema.fontes.texto, colorStyles: estilosCor }, scenes: telas })
}

export function luminancia(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

type TelaEntrada = z.input<typeof TelaRoteiroSchema>
const r = (titulo: string, telas: TelaEntrada[]): Roteiro => RoteiroSchema.parse({ titulo, telas })

/** Roteiros dos templates do "Novo projeto". */
export const TEMPLATES: { id: string; nome: string; descricao: string; tema: TemaId; estilo: Estilo; modo: ModoProjeto; roteiro: Roteiro }[] = [
  {
    id: 'identidade', nome: 'Identidade visual', descricao: 'Conceito, paleta, tipografia e aplicações.', tema: 'argila', estilo: 'editorial', modo: 'slides',
    roteiro: r('Identidade visual', [
      { tipo: 'capa', titulo: 'Nome da marca', texto: 'Identidade visual — proposta 01', notas: 'Apresente o nome e o tom da proposta.' },
      { tipo: 'conceito', rotulo: 'Conceito', titulo: 'O conceito em uma frase', texto: 'Explique de onde vem a ideia e como ela guia todas as decisões.' },
      { tipo: 'paleta', titulo: 'Paleta', itens: ['Terracota|#B4532A', 'Argila|#EEE7DB', 'Sálvia|#A7B29A', 'Carvão|#2B1D16'] },
      { tipo: 'tipografia', titulo: 'Tipografia' },
      { tipo: 'galeria', rotulo: 'Aplicações', titulo: 'A marca no mundo', itens: ['Papelaria|cartão e papel', 'Embalagem|frente e verso', 'Sinalização|fachada', 'Digital|redes e site'] },
      { tipo: 'encerramento', titulo: 'Obrigado', texto: 'contato@estudio.com' },
    ]),
  },
  {
    id: 'pitch', nome: 'Pitch / proposta comercial', descricao: 'Problema, solução, números e próximos passos.', tema: 'grafite', estilo: 'ousado', modo: 'slides',
    roteiro: r('Proposta', [
      { tipo: 'capa', titulo: 'Proposta para o cliente', texto: 'Outubro 2026' },
      { tipo: 'conceito', rotulo: 'O problema', titulo: 'O problema', texto: 'O que está travando o resultado hoje.' },
      { tipo: 'lista', rotulo: 'Abordagem', titulo: 'Nossa abordagem', itens: ['Diagnóstico em duas semanas', 'Conceito e protótipo', 'Lançamento com métricas'] },
      { tipo: 'numeros', rotulo: 'Resultados', titulo: 'Resultados esperados', itens: ['+38%|engajamento', '2×|conversão', '6 sem.|até o lançamento'] },
      { tipo: 'comparacao', rotulo: 'Investimento', titulo: 'Investimento', itens: ['Essencial', 'Completo', 'Identidade + site', 'Identidade + site + campanha'] },
      { tipo: 'encerramento', titulo: 'Vamos começar?', texto: 'Próximo passo: reunião de kick-off.' },
    ]),
  },
  {
    id: 'portfolio', nome: 'Portfólio', descricao: 'Apresente cases com navegação livre.', tema: 'nevoa', estilo: 'minimal', modo: 'explorar',
    roteiro: r('Portfólio', [
      { tipo: 'capa', titulo: 'Seu nome', texto: 'Direção de arte e identidade visual' },
      { tipo: 'imagem', rotulo: 'Case 01', titulo: 'Case 01', texto: 'Cliente, desafio e resultado.' },
      { tipo: 'imagem', rotulo: 'Case 02', titulo: 'Case 02', texto: 'Cliente, desafio e resultado.' },
      { tipo: 'imagem', rotulo: 'Case 03', titulo: 'Case 03', texto: 'Cliente, desafio e resultado.' },
      { tipo: 'conceito', rotulo: 'Sobre', titulo: 'Sobre', texto: 'Quem é você e como trabalha.' },
    ]),
  },
  {
    id: 'campanha', nome: 'Campanha (Story)', descricao: 'Narrativa vertical guiada pelo scroll.', tema: 'mare', estilo: 'ousado', modo: 'story',
    roteiro: r('Campanha', [
      { tipo: 'capa', titulo: 'Nome da campanha', texto: 'Verão 2027' },
      { tipo: 'conceito', rotulo: 'A ideia', titulo: 'A ideia', texto: 'O que a campanha quer fazer as pessoas sentirem.' },
      { tipo: 'imagem', rotulo: 'Key visual', titulo: 'Key visual' },
      { tipo: 'encerramento', titulo: 'Lançamento 21.12' },
    ]),
  },
]

export type { TelaDesenhada }
