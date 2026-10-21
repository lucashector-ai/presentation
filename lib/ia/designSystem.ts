/**
 * Design system da IA do Mostra: temas (cores, tipografia, raio, motivo decorativo), o catálogo de
 * componentes de tela (o que o modelo escolhe e preenche) e utilitários de cor/contraste.
 * O motor de montagem (`montagem.ts`) transforma uma tela desenhada + tema em camadas do schema.
 * Puro: sem rede, sem DOM. Compartilhado entre servidor (prompts) e cliente (prévia, editor).
 */

import { FONTES_APRESENTACAO } from '@/lib/design-tokens'

// ---------------------------------------------------------------- tipos de tela (componentes)

export const TIPOS_TELA = [
  'capa', 'agenda', 'secao', 'conceito', 'lista', 'cartoes', 'processo', 'numeros', 'grafico', 'comparacao',
  'linhaTempo', 'citacao', 'imagem', 'galeria', 'equipe', 'precos', 'paleta', 'tipografia', 'cta', 'encerramento',
] as const
export type TipoTela = (typeof TIPOS_TELA)[number]

export const FUNDOS = ['claro', 'escuro', 'acento'] as const
export type Fundo = (typeof FUNDOS)[number]
export const DECORACOES = ['nenhuma', 'sutil', 'marcante'] as const
export type Decoracao = (typeof DECORACOES)[number]
export const ALINHAMENTOS = ['esquerda', 'centro'] as const
export type Alinhamento = (typeof ALINHAMENTOS)[number]

export interface Variante { id: string; nome: string; uso: string; /** Só faz sentido em slides horizontais. */ soSlides?: boolean }
export interface Componente {
  nome: string
  /** Quando usar (vai para o prompt do roteiro e do design). */
  uso: string
  /** Formato de cada item (vazio = a tela não usa itens). */
  itens: string
  minItens: number
  maxItens: number
  /** Limites de caracteres que cabem no layout (o modelo escreve para caber; a normalização corta o excesso). */
  limites: { titulo: number; texto: number; item: number }
  variantes: Variante[]
}

export const COMPONENTES: Record<TipoTela, Componente> = {
  capa: {
    nome: 'Capa', uso: 'primeira tela: título da apresentação e uma linha de apoio (cliente, data ou promessa)', itens: '', minItens: 0, maxItens: 0,
    limites: { titulo: 70, texto: 140, item: 0 },
    variantes: [
      { id: 'capa.classica', nome: 'Clássica', uso: 'título grande embaixo à esquerda e forma de destaque à direita; serve para quase tudo' },
      { id: 'capa.centrada', nome: 'Centrada', uso: 'título centralizado e simétrico; eventos, aulas, institucional' },
      { id: 'capa.dividida', nome: 'Dividida', uso: 'metade da tela é bloco de cor ou foto; produto, portfólio, lançamento', soSlides: true },
      { id: 'capa.tipografica', nome: 'Tipográfica', uso: 'só o título, enorme; títulos curtos (até 4 palavras) e tom ousado' },
    ],
  },
  agenda: {
    nome: 'Agenda', uso: 'o roteiro da conversa: as partes da apresentação, em ordem', itens: '"Parte" ou "Parte|o que vamos ver"', minItens: 3, maxItens: 6,
    limites: { titulo: 40, texto: 120, item: 70 },
    variantes: [
      { id: 'agenda.lista', nome: 'Lista', uso: 'números grandes e as partes empilhadas' },
      { id: 'agenda.colunas', nome: 'Colunas', uso: 'partes lado a lado; 3 ou 4 partes', soSlides: true },
    ],
  },
  secao: {
    nome: 'Seção', uso: 'abertura de capítulo: título curto, texto opcional', itens: '', minItens: 0, maxItens: 0,
    limites: { titulo: 50, texto: 140, item: 0 },
    variantes: [
      { id: 'secao.numero', nome: 'Número', uso: 'número do capítulo enorme ao lado do título' },
      { id: 'secao.faixa', nome: 'Faixa', uso: 'título sobre fundo de cor cheio; pausa forte entre partes' },
      { id: 'secao.minimal', nome: 'Minimal', uso: 'título e uma linha fina; tom calmo' },
    ],
  },
  conceito: {
    nome: 'Ideia central', uso: 'uma ideia, problema, tese ou insight: título forte e 1 a 2 frases', itens: '', minItens: 0, maxItens: 0,
    limites: { titulo: 90, texto: 240, item: 0 },
    variantes: [
      { id: 'conceito.frase', nome: 'Frase', uso: 'a frase ocupa a tela; texto de apoio embaixo' },
      { id: 'conceito.lateral', nome: 'Lateral', uso: 'título à esquerda e explicação numa coluna à direita', soSlides: true },
      { id: 'conceito.enfase', nome: 'Ênfase', uso: 'frase centralizada com o final destacado em cor' },
    ],
  },
  lista: {
    nome: 'Lista', uso: '3 a 5 pontos curtos (até 12 palavras cada)', itens: '"ponto"', minItens: 2, maxItens: 6,
    limites: { titulo: 60, texto: 160, item: 110 },
    variantes: [
      { id: 'lista.numerada', nome: 'Numerada', uso: 'título à esquerda, pontos numerados à direita' },
      { id: 'lista.colunas', nome: 'Colunas', uso: 'pontos em grade de 2 ou 3 colunas com marcador de cor' },
    ],
  },
  cartoes: {
    nome: 'Cartões', uso: 'pilares, benefícios, diferenciais, serviços: 2 a 4 blocos com título e descrição', itens: '"Título|descrição"', minItens: 2, maxItens: 6,
    limites: { titulo: 60, texto: 160, item: 130 },
    variantes: [
      { id: 'cartoes.grade', nome: 'Grade', uso: 'cartões com fundo; o item em destaque ganha a cor de acento' },
      { id: 'cartoes.linhas', nome: 'Linhas', uso: 'colunas abertas separadas por um fio de cor; mais editorial' },
    ],
  },
  processo: {
    nome: 'Processo', uso: 'como funciona, metodologia, etapas em ordem (sem datas)', itens: '"Etapa|descrição"', minItens: 3, maxItens: 5,
    limites: { titulo: 60, texto: 160, item: 110 },
    variantes: [
      { id: 'processo.passos', nome: 'Passos', uso: 'etapas lado a lado ligadas por uma linha, com número grande' },
      { id: 'processo.circulos', nome: 'Círculos', uso: 'cada etapa num círculo de cor; 3 ou 4 etapas', soSlides: true },
    ],
  },
  numeros: {
    nome: 'Métricas', uso: '2 a 4 números que provam algo; só números do material do usuário', itens: '"valor|legenda" (ex.: "38%|mais passageiros no pico")', minItens: 1, maxItens: 4,
    limites: { titulo: 60, texto: 160, item: 80 },
    variantes: [
      { id: 'numeros.grandes', nome: 'Grandes', uso: 'números enormes lado a lado, com legenda' },
      { id: 'numeros.cartoes', nome: 'Cartões', uso: 'cada número num cartão; o destaque ganha a cor de acento' },
    ],
  },
  grafico: {
    nome: 'Gráfico', uso: 'comparar 3 a 6 valores numéricos da mesma grandeza (barras)', itens: '"valor|rótulo" (ex.: "42%|Região Sul"); valor numérico', minItens: 2, maxItens: 6,
    limites: { titulo: 60, texto: 160, item: 60 },
    variantes: [
      { id: 'grafico.barras', nome: 'Barras', uso: 'barras horizontais com rótulo e valor' },
      { id: 'grafico.colunas', nome: 'Colunas', uso: 'colunas verticais; bom para evolução no tempo', soSlides: true },
    ],
  },
  comparacao: {
    nome: 'Comparação', uso: 'antes/depois, opção A/B, hoje/amanhã', itens: 'alternados entre duas colunas: o 1º e o 2º são os nomes das colunas; depois 3º, 5º… à esquerda e 4º, 6º… à direita', minItens: 2, maxItens: 6,
    limites: { titulo: 60, texto: 140, item: 90 },
    variantes: [
      { id: 'comparacao.colunas', nome: 'Colunas', uso: 'duas caixas lado a lado; a da direita em destaque' },
      { id: 'comparacao.antesDepois', nome: 'Antes e depois', uso: 'esquerda apagada, seta, direita em cor' },
    ],
  },
  linhaTempo: {
    nome: 'Linha do tempo', uso: 'cronograma, histórico, marcos com data', itens: '"Data|marco" (ex.: "Mar 2027|Piloto em 3 escolas")', minItens: 2, maxItens: 6,
    limites: { titulo: 60, texto: 140, item: 80 },
    variantes: [
      { id: 'linhaTempo.horizontal', nome: 'Horizontal', uso: 'linha atravessando a tela com marcos', soSlides: true },
      { id: 'linhaTempo.vertical', nome: 'Vertical', uso: 'marcos empilhados ao longo de uma linha vertical' },
    ],
  },
  citacao: {
    nome: 'Citação', uso: 'depoimento ou frase de alguém: a frase vai no título; o texto diz quem disse', itens: '', minItens: 0, maxItens: 0,
    limites: { titulo: 160, texto: 80, item: 0 },
    variantes: [
      { id: 'citacao.grande', nome: 'Grande', uso: 'aspas enormes e a frase ocupando a tela' },
      { id: 'citacao.depoimento', nome: 'Depoimento', uso: 'frase num cartão com o autor e as iniciais' },
    ],
  },
  imagem: {
    nome: 'Imagem', uso: 'tela com espaço para foto, render ou print; título e legenda', itens: '', minItens: 0, maxItens: 0,
    limites: { titulo: 60, texto: 180, item: 0 },
    variantes: [
      { id: 'imagem.lateral', nome: 'Lateral', uso: 'imagem ocupando um lado, texto do outro' },
      { id: 'imagem.cheia', nome: 'Cheia', uso: 'imagem de ponta a ponta e o título por cima' },
      { id: 'imagem.moldura', nome: 'Moldura', uso: 'imagem emoldurada no centro, legenda embaixo' },
    ],
  },
  galeria: {
    nome: 'Galeria', uso: 'vários trabalhos, peças ou fotos: 2 a 6 espaços de imagem com legenda', itens: '"Título|legenda"', minItens: 2, maxItens: 6,
    limites: { titulo: 60, texto: 140, item: 70 },
    variantes: [
      { id: 'galeria.grade', nome: 'Grade', uso: 'imagens do mesmo tamanho em grade' },
      { id: 'galeria.mosaico', nome: 'Mosaico', uso: 'uma imagem grande e as outras menores', soSlides: true },
    ],
  },
  equipe: {
    nome: 'Equipe', uso: 'pessoas do time, palestrantes, responsáveis', itens: '"Nome|cargo ou papel"', minItens: 1, maxItens: 6,
    limites: { titulo: 60, texto: 140, item: 60 },
    variantes: [
      { id: 'equipe.grade', nome: 'Grade', uso: 'retratos redondos com nome e cargo' },
      { id: 'equipe.lista', nome: 'Lista', uso: 'nomes em lista com o papel de cada um' },
    ],
  },
  precos: {
    nome: 'Preços', uso: 'planos, pacotes ou investimento: 1 a 4 opções', itens: '"Plano|preço|benefício; benefício; benefício"', minItens: 1, maxItens: 4,
    limites: { titulo: 60, texto: 140, item: 150 },
    variantes: [
      { id: 'precos.colunas', nome: 'Colunas', uso: 'um cartão por plano; o recomendado em destaque' },
    ],
  },
  paleta: {
    nome: 'Paleta', uso: 'apresentar cores de uma identidade visual', itens: '"Nome|#RRGGBB"', minItens: 2, maxItens: 5,
    limites: { titulo: 40, texto: 0, item: 40 },
    variantes: [{ id: 'paleta.faixas', nome: 'Faixas', uso: 'faixas de cor de ponta a ponta com nome e código' }],
  },
  tipografia: {
    nome: 'Tipografia', uso: 'apresentar as fontes de uma identidade visual', itens: '', minItens: 0, maxItens: 0,
    limites: { titulo: 40, texto: 160, item: 0 },
    variantes: [{ id: 'tipografia.amostra', nome: 'Amostra', uso: '"Aa" gigante e o alfabeto' }],
  },
  cta: {
    nome: 'Chamada', uso: 'o pedido ou próximo passo: o que a plateia deve fazer agora', itens: '1º = texto do botão (ex.: "Agendar conversa"); os demais "Rótulo|contato"', minItens: 0, maxItens: 3,
    limites: { titulo: 70, texto: 180, item: 60 },
    variantes: [
      { id: 'cta.botao', nome: 'Botão', uso: 'frase de ação grande e um botão' },
      { id: 'cta.faixa', nome: 'Faixa', uso: 'fundo de cor cheio, frase centralizada' },
    ],
  },
  encerramento: {
    nome: 'Encerramento', uso: 'última tela: agradecimento ou próximo passo; texto com contato', itens: 'opcional: "Rótulo|contato"', minItens: 0, maxItens: 3,
    limites: { titulo: 50, texto: 140, item: 60 },
    variantes: [
      { id: 'encerramento.centrado', nome: 'Centrado', uso: 'agradecimento centralizado' },
      { id: 'encerramento.contato', nome: 'Contato', uso: 'título à esquerda e contatos à direita', soSlides: true },
    ],
  },
}

/** Nome de cada tipo de tela, para a interface. */
export const NOMES_TIPO_TELA = Object.fromEntries(TIPOS_TELA.map((t) => [t, COMPONENTES[t].nome])) as Record<TipoTela, string>

export const VARIANTES = Object.values(COMPONENTES).flatMap((c) => c.variantes.map((v) => v.id))
export const VARIANTES_IDS = VARIANTES as [string, ...string[]]
export const tipoDaVariante = (v: string): TipoTela | null => {
  const t = v.split('.')[0] as TipoTela
  return (TIPOS_TELA as readonly string[]).includes(t) && COMPONENTES[t].variantes.some((x) => x.id === v) ? t : null
}

/** Tipos que o design pode trocar entre si sem perder conteúdo (mesmo formato de itens ou sem itens). */
export const FAMILIAS: TipoTela[][] = [
  ['conceito', 'secao'],
  ['lista', 'cartoes', 'processo', 'agenda'],
  ['numeros', 'grafico'],
  ['imagem', 'galeria'],
  ['cta', 'encerramento'],
]
export const compativeis = (a: TipoTela, b: TipoTela) => a === b || FAMILIAS.some((f) => f.includes(a) && f.includes(b))

// ---------------------------------------------------------------- cores

export const RE_HEX = /^#[0-9a-f]{6}$/i
const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '').slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0) as [number, number, number]
}
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
export const paraHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase()
/** Mistura `a` com `b` (t = 0 → a; t = 1 → b). */
export function misturar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return paraHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}
/** Cor com transparência (#RRGGBBAA). */
export const alfa = (hex: string, a: number) => `${hex.slice(0, 7).toUpperCase()}${hex2(a * 255).toUpperCase()}`
/** Luminância relativa (WCAG 2). */
export function luminanciaRelativa(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Contraste WCAG entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}
/** A primeira cor da lista que tem contraste suficiente com o fundo (ou a de maior contraste). */
export function legivel(fundo: string, opcoes: string[], minimo = 3): string {
  return opcoes.find((c) => contraste(c, fundo) >= minimo) ?? [...opcoes].sort((a, b) => contraste(b, fundo) - contraste(a, fundo))[0]!
}

// ---------------------------------------------------------------- temas

/**
 * Formas e texturas que se repetem nas telas (dão identidade ao estilo): formas geométricas, fios, grade de
 * pontos, brilho desfocado, manchas orgânicas, bolhas (lúdico), confete (Memphis), sol listrado (retrô),
 * moldura fina (luxo), blocos de cor (startup, brutalista) e luzes de vidro (glass).
 */
export const MOTIVOS = ['formas', 'linhas', 'grade', 'brilho', 'manchas', 'bolhas', 'confete', 'sol', 'moldura', 'blocos', 'vidro', 'nenhum'] as const
export type Motivo = (typeof MOTIVOS)[number]

/** Famílias de estilo da galeria (filtro por categoria). */
export const CATEGORIAS_ESTILO = ['minimalista', 'editorial', 'corporativo', 'tecnologia', 'ousado', 'elegante', 'divertido', 'natural'] as const
export type CategoriaEstilo = (typeof CATEGORIAS_ESTILO)[number]
export const NOMES_CATEGORIA: Record<CategoriaEstilo, string> = {
  minimalista: 'Minimalista', editorial: 'Editorial', corporativo: 'Corporativo', tecnologia: 'Tecnologia', ousado: 'Ousado', elegante: 'Elegante', divertido: 'Divertido', natural: 'Natural',
}

/**
 * Regras de composição de um estilo, além de cor e fonte: margens, escala e caixa dos títulos, como são os
 * cartões e o rótulo acima do título, fios, fundo, rodapé, variantes preferidas de cada componente, se usa telas
 * de acento e o ritmo das animações. Aplicadas pelo motor de montagem e pelo desenho local (e descritas ao modelo).
 */
export interface Regras {
  /** Escala das margens da tela (1 = padrão; luxo respira mais, brutalista encosta nas bordas). */
  margem: number
  /** Escala dos títulos. */
  escalaTitulo: number
  /** Títulos em caixa alta. */
  caixaAlta: boolean
  /** Cartões e caixas: cheios, só contorno, vidro (translúcido com desfoque) ou com sombra dura deslocada. */
  cartao: 'cheio' | 'contorno' | 'vidro' | 'sombra'
  /** Espessura dos contornos (cartão contorno/sombra). */
  borda: number
  /** Rótulo acima do título: mono em caixa alta, pílula de cor, fio + mono, ou itálico na fonte do título. */
  rotulo: 'mono' | 'pilula' | 'fio' | 'italico'
  /** Fio cheio acima do cabeçalho das telas de conteúdo (grade suíça, acadêmico). */
  fioCabecalho: boolean
  /** Fundo: liso, gradiente das superfícies, ou malha de luzes desfocadas atrás do conteúdo. */
  fundo: 'liso' | 'gradiente' | 'malha'
  /** Rodapé das telas de conteúdo. */
  rodape: 'mono' | 'fio' | 'nenhum'
  /** Variantes preferidas por componente (desenho local e plano de ritmo enviado ao modelo). */
  variantes: Partial<Record<TipoTela, readonly string[]>>
  /** O estilo não usa telas inteiras na cor de acento (vira a superfície oposta). */
  semAcento: boolean
  /** Ritmo das animações de entrada. */
  ritmo: 'calmo' | 'normal' | 'energico'
  /** Energia de escrita e decoração quando a pessoa não escolhe (estilo editorial/ousado/minimal). */
  energia: 'editorial' | 'ousado' | 'minimal'
  /** Composição em uma frase (vai para o prompt do design). */
  composicao: string
}

export const REGRAS_PADRAO: Regras = {
  margem: 1, escalaTitulo: 1, caixaAlta: false, cartao: 'cheio', borda: 2, rotulo: 'mono', fioCabecalho: false, fundo: 'liso', rodape: 'mono',
  variantes: {}, semAcento: false, ritmo: 'normal', energia: 'editorial', composicao: 'grade de 12 colunas, títulos à esquerda, cartões cheios',
}
export const regrasDe = (t: TemaVisual): Regras => ({ ...REGRAS_PADRAO, ...t.regras, variantes: { ...t.regras?.variantes } })

export interface Superficie {
  fundo: string
  tinta: string
  /** Texto secundário. */
  suave: string
  /** Fundo de cartões e caixas sobre esta superfície. */
  cartao: string
  /** Fios e separadores. */
  linha: string
  gradiente?: { angle: number; stops: { color: string; pos: number }[] }
}

export interface TemaVisual {
  id: string
  nome: string
  /** Quando usar (vai para o prompt e aparece como dica na escolha do tema). */
  descricao: string
  /** Superfície das telas de conteúdo. */
  base: 'claro' | 'escuro'
  claro: Superficie
  escuro: Superficie
  acento: string
  /** Segunda cor de destaque (formas, gráficos). */
  acento2: string
  /** Texto sobre a cor de acento. */
  sobreAcento: string
  fontes: { titulo: string; texto: string; pesoTitulo: number; tracking: number; italicoCitacao: boolean }
  raio: number
  motivo: Motivo
  /** Fundo da capa e do encerramento. */
  capa: Fundo
  /** Par da paleta do produto (lib/design-tokens.ts) gravado em `theme.palette`. */
  paleta: string
  /** Família na galeria de estilos. */
  categoria?: CategoriaEstilo
  /** Palavras para a busca da galeria. */
  tags?: string
  /** Regras de composição (ausente = padrão). */
  regras?: Partial<Regras>
}

const sup = (fundo: string, tinta: string, extra: Partial<Superficie> = {}): Superficie => ({
  fundo, tinta, suave: misturar(tinta, fundo, 0.32), cartao: misturar(fundo, tinta, 0.06), linha: misturar(fundo, tinta, 0.16), ...extra,
})

export const TEMAS = [
  {
    id: 'argila', nome: 'Argila', descricao: 'quente e artesanal; identidade visual, marcas autorais, gastronomia, arquitetura', base: 'claro',
    claro: sup('#EEE7DB', '#2B1D16'), escuro: sup('#2B1D16', '#EEE7DB'), acento: '#B4532A', acento2: '#A7B29A', sobreAcento: '#FFF8F0',
    fontes: { titulo: 'Fraunces', texto: 'Geist', pesoTitulo: 500, tracking: 0.02, italicoCitacao: true }, raio: 18, motivo: 'formas', capa: 'claro', paleta: 'argila', categoria: 'natural', tags: 'quente terroso artesanal serifa',
  },
  {
    id: 'mare', nome: 'Maré', descricao: 'criativo e confiante; campanhas, lançamentos, turismo, cultura', base: 'claro',
    claro: sup('#F2E9D8', '#1F3B4D'), escuro: sup('#1F3B4D', '#F2E9D8'), acento: '#E4572E', acento2: '#F2C14E', sobreAcento: '#FFF4EC',
    fontes: { titulo: 'Geist', texto: 'Geist', pesoTitulo: 600, tracking: 0.045, italicoCitacao: false }, raio: 24, motivo: 'formas', capa: 'escuro', paleta: 'mare', categoria: 'ousado', tags: 'praia verão campanha laranja',
  },
  {
    id: 'grafite', nome: 'Grafite', descricao: 'tecnológico e ousado; startups, pitch, produto digital', base: 'escuro',
    claro: sup('#F4F4F2', '#171717'), escuro: sup('#171717', '#F4F4F2', { cartao: '#232323', linha: '#333333' }), acento: '#D7F25C', acento2: '#5965F2', sobreAcento: '#171717',
    fontes: { titulo: 'Space Grotesk', texto: 'Geist', pesoTitulo: 600, tracking: 0.04, italicoCitacao: false }, raio: 14, motivo: 'grade', capa: 'escuro', paleta: 'grafite', categoria: 'tecnologia', tags: 'escuro tech startup lima grade',
  },
  {
    id: 'noturno', nome: 'Noturno', descricao: 'escuro com brilho; SaaS, inteligência artificial, lançamento de produto tech', base: 'escuro',
    claro: sup('#F5F6FB', '#0B1020'), escuro: sup('#0B1020', '#E8ECF8', { cartao: '#161D36', linha: '#26304F', gradiente: { angle: 160, stops: [{ color: '#0B1020', pos: 0 }, { color: '#151C3B', pos: 100 }] } }),
    acento: '#7C8CFF', acento2: '#3DDC97', sobreAcento: '#0B1020',
    fontes: { titulo: 'Inter', texto: 'Inter', pesoTitulo: 700, tracking: 0.04, italicoCitacao: false }, raio: 20, motivo: 'brilho', capa: 'escuro', paleta: 'violeta', categoria: 'tecnologia', tags: 'escuro tech saas ia brilho neon',
  },
  {
    id: 'corporativo', nome: 'Corporativo', descricao: 'sóbrio e claro; relatórios, resultados, propostas B2B, conselhos', base: 'claro',
    claro: sup('#F7F8FA', '#0F1E36'), escuro: sup('#0F1E36', '#F1F4F9'), acento: '#2F6BFF', acento2: '#00A88F', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'IBM Plex Sans', texto: 'IBM Plex Sans', pesoTitulo: 600, tracking: 0.025, italicoCitacao: false }, raio: 10, motivo: 'linhas', capa: 'escuro', paleta: 'nevoa', categoria: 'corporativo', tags: 'empresa b2b relatório azul limpo',
  },
  {
    id: 'papel', nome: 'Papel', descricao: 'editorial de revista; cases, relatórios, pesquisa, conteúdo', base: 'claro',
    claro: sup('#FBFAF7', '#141414'), escuro: sup('#141414', '#FBFAF7'), acento: '#D7263D', acento2: '#141414', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Playfair Display', texto: 'Inter', pesoTitulo: 600, tracking: 0.01, italicoCitacao: true }, raio: 2, motivo: 'linhas', capa: 'claro', paleta: 'nevoa', categoria: 'editorial', tags: 'revista serifa jornal vermelho',
  },
  {
    id: 'ameixa', nome: 'Ameixa', descricao: 'sofisticado e acolhedor; moda, beleza, eventos, cultura', base: 'claro',
    claro: sup('#F1D3B3', '#3A2E5C'), escuro: sup('#3A2E5C', '#F1D3B3'), acento: '#5965F2', acento2: '#E4572E', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'DM Serif Display', texto: 'Geist', pesoTitulo: 400, tracking: 0.01, italicoCitacao: false }, raio: 40, motivo: 'formas', capa: 'escuro', paleta: 'ameixa', categoria: 'elegante', tags: 'moda beleza roxo pêssego',
  },
  {
    id: 'salvia', nome: 'Sálvia', descricao: 'calmo e natural; sustentabilidade, saúde, bem-estar, educação', base: 'claro',
    claro: sup('#E4E9DF', '#2E3A2C'), escuro: sup('#2E3A2C', '#E4E9DF'), acento: '#3F6B4A', acento2: '#F2C14E', sobreAcento: '#F6F8F3',
    fontes: { titulo: 'Instrument Serif', texto: 'Geist', pesoTitulo: 400, tracking: 0.01, italicoCitacao: true }, raio: 28, motivo: 'linhas', capa: 'claro', paleta: 'salvia', categoria: 'natural', tags: 'verde calmo saúde sustentável',
  },
  {
    id: 'ipe', nome: 'Ipê', descricao: 'alegre e didático; aulas, workshops, onboarding, comunidade', base: 'claro',
    claro: sup('#FFF6E0', '#2A2118'), escuro: sup('#2A2118', '#FFF6E0'), acento: '#E07A00', acento2: '#5965F2', sobreAcento: '#2A2118',
    fontes: { titulo: 'Space Grotesk', texto: 'Geist', pesoTitulo: 700, tracking: 0.035, italicoCitacao: false }, raio: 22, motivo: 'formas', capa: 'acento', paleta: 'ipe', categoria: 'divertido', tags: 'aula escola amarelo didático',
  },
  {
    id: 'lima', nome: 'Lima', descricao: 'jovem e de rua; eventos, festivais, marcas de rua, campanhas', base: 'claro',
    claro: sup('#F4F4F2', '#171717'), escuro: sup('#171717', '#D7F25C'), acento: '#D7F25C', acento2: '#E4572E', sobreAcento: '#171717',
    fontes: { titulo: 'Archivo Black', texto: 'Geist', pesoTitulo: 400, tracking: 0.03, italicoCitacao: false }, raio: 0, motivo: 'formas', capa: 'acento', paleta: 'lima', categoria: 'ousado', tags: 'festival rua jovem verde-limão',
  },
  {
    id: 'nevoa', nome: 'Névoa', descricao: 'neutro e minimalista; qualquer assunto, quando o conteúdo é a estrela', base: 'claro',
    claro: sup('#EFEFF1', '#171717'), escuro: sup('#171717', '#EFEFF1'), acento: '#5965F2', acento2: '#171717', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Geist', texto: 'Geist', pesoTitulo: 600, tracking: 0.045, italicoCitacao: false }, raio: 16, motivo: 'linhas', capa: 'claro', paleta: 'nevoa', categoria: 'minimalista', tags: 'neutro cinza simples limpo',
  },
  // ---------- estilos com regras de composição próprias (além de cor e fonte) ----------
  {
    id: 'suico', nome: 'Suíço', descricao: 'minimalista suíço: grade rígida, Inter pesada, vermelho pontual; design, arquitetura, cultura', base: 'claro',
    claro: sup('#FFFFFF', '#111111', { cartao: '#F2F2F2', linha: '#111111' }), escuro: sup('#111111', '#FFFFFF'), acento: '#E30613', acento2: '#111111', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Inter', texto: 'Inter', pesoTitulo: 700, tracking: 0.055, italicoCitacao: false }, raio: 0, motivo: 'linhas', capa: 'claro', paleta: 'nevoa',
    categoria: 'minimalista', tags: 'suíço grid helvetica vermelho tipográfico design',
    regras: {
      margem: 0.8, escalaTitulo: 1.1, rotulo: 'fio', fioCabecalho: true, cartao: 'contorno', borda: 2, rodape: 'fio', energia: 'minimal', ritmo: 'normal',
      variantes: { capa: ['capa.tipografica'], secao: ['secao.numero'], lista: ['lista.numerada'], cartoes: ['cartoes.linhas'], numeros: ['numeros.grandes'], conceito: ['conceito.lateral', 'conceito.frase'], agenda: ['agenda.lista'] },
      composicao: 'grade suíça: títulos enormes alinhados à esquerda, fios pretos cheios, números grandes, nada centralizado, vermelho só como pontuação',
    },
  },
  {
    id: 'gradiente', nome: 'Gradiente vibrante', descricao: 'gradientes saturados e Syne; lançamentos, marcas jovens, criativo, música', base: 'claro',
    claro: sup('#FFF6FB', '#1C0B33', { gradiente: { angle: 135, stops: [{ color: '#FFF6FB', pos: 0 }, { color: '#F1EEFF', pos: 100 }] } }),
    escuro: sup('#240E5C', '#FFFFFF', { cartao: '#3A1C78', linha: '#5B3A99', gradiente: { angle: 135, stops: [{ color: '#240E5C', pos: 0 }, { color: '#4A1475', pos: 55 }, { color: '#7A1269', pos: 100 }] } }),
    acento: '#D6136F', acento2: '#3BB7E8', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Syne', texto: 'Manrope', pesoTitulo: 700, tracking: 0.03, italicoCitacao: false }, raio: 28, motivo: 'vidro', capa: 'escuro', paleta: 'violeta',
    categoria: 'ousado', tags: 'gradiente colorido rosa roxo vibrante neon jovem',
    regras: {
      fundo: 'gradiente', escalaTitulo: 1.05, rotulo: 'pilula', ritmo: 'energico', energia: 'ousado',
      variantes: { capa: ['capa.classica', 'capa.tipografica'], conceito: ['conceito.enfase'], secao: ['secao.faixa'], numeros: ['numeros.cartoes'] },
      composicao: 'fundos em gradiente saturado, luzes coloridas desfocadas, rótulos em pílula, frases de impacto centralizadas',
    },
  },
  {
    id: 'vidro', nome: 'Vidro', descricao: 'glassmorphism escuro: cartões translúcidos sobre luzes; tecnologia, produto, IA, fintech', base: 'escuro',
    claro: sup('#EEF1F8', '#0E1222'), escuro: sup('#0E1222', '#EEF2FF', { cartao: '#FFFFFF14', linha: '#FFFFFF2E', gradiente: { angle: 160, stops: [{ color: '#0E1222', pos: 0 }, { color: '#161B36', pos: 100 }] } }),
    acento: '#7FDBFF', acento2: '#C08BFF', sobreAcento: '#0E1222',
    fontes: { titulo: 'Manrope', texto: 'Manrope', pesoTitulo: 600, tracking: 0.035, italicoCitacao: false }, raio: 28, motivo: 'vidro', capa: 'escuro', paleta: 'violeta',
    categoria: 'tecnologia', tags: 'glass vidro translúcido escuro tech ia futurista',
    regras: {
      fundo: 'malha', cartao: 'vidro', borda: 1.5, rotulo: 'pilula', semAcento: true, ritmo: 'calmo', energia: 'editorial',
      variantes: { cartoes: ['cartoes.grade'], numeros: ['numeros.cartoes'], citacao: ['citacao.depoimento'], capa: ['capa.centrada', 'capa.classica'] },
      composicao: 'superfície escura com luzes coloridas desfocadas atrás; tudo em cartões de vidro translúcido com contorno fino; nada de telas chapadas de cor',
    },
  },
  {
    id: 'brutalista', nome: 'Brutalista', descricao: 'contornos grossos, sombra dura, caixa alta; marcas ousadas, moda de rua, agências', base: 'claro',
    claro: sup('#F2F0E9', '#0A0A0A', { cartao: '#FFFFFF', linha: '#0A0A0A' }), escuro: sup('#0A0A0A', '#F2F0E9'), acento: '#FF4F00', acento2: '#2D5BFF', sobreAcento: '#0A0A0A',
    fontes: { titulo: 'Space Grotesk', texto: 'Geist', pesoTitulo: 700, tracking: 0.02, italicoCitacao: false }, raio: 0, motivo: 'blocos', capa: 'acento', paleta: 'lima',
    categoria: 'ousado', tags: 'brutalista neo-brutalism contorno sombra caixa alta laranja',
    regras: {
      margem: 0.8, caixaAlta: true, escalaTitulo: 0.92, cartao: 'sombra', borda: 4, rotulo: 'pilula', rodape: 'fio', ritmo: 'energico', energia: 'ousado',
      variantes: { capa: ['capa.tipografica', 'capa.dividida'], cartoes: ['cartoes.grade'], numeros: ['numeros.cartoes'], comparacao: ['comparacao.colunas'], secao: ['secao.faixa'] },
      composicao: 'neo-brutalismo: caixas com contorno preto de 4 px e sombra dura deslocada, títulos em caixa alta, blocos de cor chapada',
    },
  },
  {
    id: 'luxo', nome: 'Luxo', descricao: 'preto, dourado e Cormorant; joias, hotelaria, imóveis de alto padrão, moda', base: 'escuro',
    claro: sup('#F7F2EA', '#1B1814'), escuro: sup('#0D0C0A', '#F3EBDD', { cartao: '#1A1814', linha: '#3A332A' }), acento: '#C9A45C', acento2: '#8C7853', sobreAcento: '#0D0C0A',
    fontes: { titulo: 'Cormorant Garamond', texto: 'Manrope', pesoTitulo: 500, tracking: 0.005, italicoCitacao: true }, raio: 0, motivo: 'moldura', capa: 'escuro', paleta: 'argila',
    categoria: 'elegante', tags: 'luxo premium dourado preto serifa elegante joia hotel',
    regras: {
      margem: 1.3, escalaTitulo: 0.95, rotulo: 'fio', cartao: 'contorno', borda: 1, semAcento: true, ritmo: 'calmo', energia: 'editorial',
      variantes: { capa: ['capa.centrada'], conceito: ['conceito.enfase', 'conceito.frase'], secao: ['secao.minimal'], encerramento: ['encerramento.centrado'], citacao: ['citacao.grande'], cartoes: ['cartoes.linhas'], cta: ['cta.faixa'] },
      composicao: 'muito respiro, composição centrada e simétrica, serifa fina, moldura dourada fina, ouro só em detalhes',
    },
  },
  {
    id: 'organico', nome: 'Orgânico', descricao: 'formas orgânicas, verde-musgo e mostarda; alimentação, sustentabilidade, bem-estar, artesanato', base: 'claro',
    claro: sup('#F3EEE3', '#283326'), escuro: sup('#283326', '#F3EEE3'), acento: '#5E7F45', acento2: '#E0A93B', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Instrument Serif', texto: 'Manrope', pesoTitulo: 400, tracking: 0.01, italicoCitacao: true }, raio: 44, motivo: 'manchas', capa: 'claro', paleta: 'salvia',
    categoria: 'natural', tags: 'orgânico natural verde folhas sustentável artesanal',
    regras: {
      margem: 1.05, cartao: 'cheio', rotulo: 'italico', ritmo: 'calmo', energia: 'editorial',
      variantes: { capa: ['capa.classica'], lista: ['lista.colunas'], cartoes: ['cartoes.grade'], processo: ['processo.circulos'] },
      composicao: 'formas orgânicas arredondadas e sobrepostas, cantos muito redondos, rótulos em itálico, ritmo calmo',
    },
  },
  {
    id: 'retro', nome: 'Retrô', descricao: 'anos 70: sol listrado, laranja e turquesa, Fraunces pesada; cafés, música, eventos, marcas nostálgicas', base: 'claro',
    claro: sup('#F5E6C8', '#3B2416'), escuro: sup('#3B2416', '#F5E6C8'), acento: '#C2541A', acento2: '#1F8A80', sobreAcento: '#FFF4E2',
    fontes: { titulo: 'Fraunces', texto: 'Manrope', pesoTitulo: 800, tracking: 0.02, italicoCitacao: true }, raio: 24, motivo: 'sol', capa: 'escuro', paleta: 'ipe',
    categoria: 'divertido', tags: 'retrô vintage anos 70 laranja sol nostalgia',
    regras: {
      escalaTitulo: 1.05, rotulo: 'pilula', cartao: 'contorno', borda: 3, ritmo: 'normal', energia: 'ousado',
      variantes: { capa: ['capa.classica', 'capa.dividida'], secao: ['secao.faixa'], conceito: ['conceito.frase'], cartoes: ['cartoes.grade'] },
      composicao: 'sol de faixas concêntricas, cores quentes chapadas, serifa gorda, cartões com contorno grosso',
    },
  },
  {
    id: 'ludico', nome: 'Lúdico', descricao: 'bolhas coloridas e Fredoka arredondada; infantil, educação, games, comunidade', base: 'claro',
    claro: sup('#FFF8EE', '#2B2340'), escuro: sup('#2B2340', '#FFF8EE'), acento: '#FF6B6B', acento2: '#2EC4B6', sobreAcento: '#2B2340',
    fontes: { titulo: 'Fredoka', texto: 'Manrope', pesoTitulo: 600, tracking: 0.01, italicoCitacao: false }, raio: 36, motivo: 'bolhas', capa: 'acento', paleta: 'ipe',
    categoria: 'divertido', tags: 'lúdico infantil criança escola jogo colorido arredondado',
    regras: {
      escalaTitulo: 1.05, rotulo: 'pilula', cartao: 'cheio', ritmo: 'energico', energia: 'ousado',
      variantes: { capa: ['capa.centrada', 'capa.classica'], lista: ['lista.colunas'], processo: ['processo.circulos'], cartoes: ['cartoes.grade'], equipe: ['equipe.grade'] },
      composicao: 'tudo arredondado, bolhas e estrelas coloridas, rótulos em pílula, centralizado nas telas de uma ideia',
    },
  },
  {
    id: 'academico', nome: 'Acadêmico', descricao: 'serifa de leitura, azul-marinho e fios; pesquisa, defesa de tese, aula, relatório técnico', base: 'claro',
    claro: sup('#FFFFFF', '#1C1C1C', { cartao: '#F4F5F7', linha: '#C9CDD4' }), escuro: sup('#14213D', '#F4F5F7'), acento: '#14213D', acento2: '#9B2226', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Source Serif 4', texto: 'Source Serif 4', pesoTitulo: 600, tracking: 0.01, italicoCitacao: true }, raio: 4, motivo: 'linhas', capa: 'claro', paleta: 'nevoa',
    categoria: 'editorial', tags: 'acadêmico pesquisa tese universidade ciência serifa',
    regras: {
      escalaTitulo: 0.8, fioCabecalho: true, rodape: 'fio', cartao: 'contorno', borda: 1.5, semAcento: true, ritmo: 'calmo', energia: 'minimal',
      variantes: { capa: ['capa.classica'], lista: ['lista.numerada'], conceito: ['conceito.lateral'], citacao: ['citacao.depoimento'], secao: ['secao.numero'], cartoes: ['cartoes.linhas'], grafico: ['grafico.barras'] },
      composicao: 'sóbrio e legível: títulos menores, mais texto, fio cheio no topo, numeração de seções, sem telas de cor',
    },
  },
  {
    id: 'startup', nome: 'Startup bold', descricao: 'Bebas Neue enorme, violeta elétrico e blocos; pitch, demo day, crescimento', base: 'claro',
    claro: sup('#FFFFFF', '#0B0B0F', { cartao: '#F3F1FF' }), escuro: sup('#0B0B0F', '#FFFFFF', { cartao: '#1A1A22', linha: '#2C2C36' }), acento: '#6E3BFF', acento2: '#00C896', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Bebas Neue', texto: 'Inter', pesoTitulo: 400, tracking: 0, italicoCitacao: false }, raio: 20, motivo: 'blocos', capa: 'acento', paleta: 'violeta',
    categoria: 'ousado', tags: 'startup pitch investidor bold violeta crescimento métricas',
    regras: {
      escalaTitulo: 1.25, caixaAlta: true, rotulo: 'mono', cartao: 'cheio', ritmo: 'energico', energia: 'ousado',
      variantes: { capa: ['capa.tipografica'], numeros: ['numeros.grandes'], conceito: ['conceito.enfase'], secao: ['secao.faixa'], grafico: ['grafico.colunas'] },
      composicao: 'títulos e números gigantes em caixa alta condensada, blocos de cor chapados, uma ideia por tela',
    },
  },
  {
    id: 'mono', nome: 'Monocromático', descricao: 'só preto, branco e cinzas, títulos em mono; arquitetura, fotografia, portfólio', base: 'claro',
    claro: sup('#F5F5F5', '#0A0A0A', { cartao: '#EAEAEA' }), escuro: sup('#0A0A0A', '#F5F5F5', { cartao: '#1A1A1A', linha: '#2E2E2E' }), acento: '#0A0A0A', acento2: '#8A8A8A', sobreAcento: '#FFFFFF',
    fontes: { titulo: 'Geist Mono', texto: 'Geist', pesoTitulo: 500, tracking: 0.04, italicoCitacao: false }, raio: 2, motivo: 'grade', capa: 'escuro', paleta: 'grafite',
    categoria: 'minimalista', tags: 'monocromático preto e branco cinza mono portfólio fotografia',
    regras: {
      margem: 0.95, escalaTitulo: 0.9, rotulo: 'mono', cartao: 'contorno', borda: 1.5, semAcento: true, rodape: 'mono', energia: 'minimal',
      variantes: { capa: ['capa.classica'], imagem: ['imagem.moldura', 'imagem.cheia'], galeria: ['galeria.mosaico'], cartoes: ['cartoes.linhas'] },
      composicao: 'monocromático rigoroso: títulos em fonte mono, contornos finos, alternância preto/branco, imagens em destaque',
    },
  },
  {
    id: 'memphis', nome: 'Neo-Memphis', descricao: 'confete geométrico, rosa, turquesa e amarelo; moda, eventos, marcas pop, campanhas', base: 'claro',
    claro: sup('#FFF5E1', '#1D1D1B'), escuro: sup('#1D1D1B', '#FFF5E1'), acento: '#FF5DA2', acento2: '#00A79D', sobreAcento: '#1D1D1B',
    fontes: { titulo: 'Unbounded', texto: 'Manrope', pesoTitulo: 700, tracking: 0.03, italicoCitacao: false }, raio: 12, motivo: 'confete', capa: 'claro', paleta: 'mare',
    categoria: 'divertido', tags: 'memphis anos 80 pop confete geométrico rosa',
    regras: {
      escalaTitulo: 0.9, rotulo: 'pilula', cartao: 'sombra', borda: 3, ritmo: 'energico', energia: 'ousado',
      variantes: { capa: ['capa.classica', 'capa.centrada'], cartoes: ['cartoes.grade'], lista: ['lista.colunas'], secao: ['secao.faixa'] },
      composicao: 'confete geométrico (triângulos, anéis, pontos, zigue-zague) espalhado, cartões com contorno e sombra dura colorida',
    },
  },
] as const satisfies readonly TemaVisual[]

export type TemaId = (typeof TEMAS)[number]['id']
export const TEMA_IDS = TEMAS.map((t) => t.id) as [TemaId, ...TemaId[]]
/** "marca" = tema montado a partir das cores da marca do usuário (`temaDaMarca`). */
export type TemaEscolhido = TemaId | 'marca'
export const TEMAS_ESCOLHA = [...TEMA_IDS, 'marca'] as [TemaEscolhido, ...TemaEscolhido[]]

export const temaPorId = (id: string): TemaVisual => (TEMAS as readonly TemaVisual[]).find((t) => t.id === id) ?? TEMAS[0]

export type FonteApresentacao = (typeof FONTES_APRESENTACAO)[number]

/** Par de fontes da biblioteca (títulos + textos) que a pessoa pode fixar no kit de marca. */
export interface ParFontes { id: string; nome: string; titulo: FonteApresentacao; texto: FonteApresentacao; pesoTitulo: number; italicoCitacao: boolean }
export const PARES_FONTES: readonly ParFontes[] = [
  { id: 'geist', nome: 'Geist', titulo: 'Geist', texto: 'Geist', pesoTitulo: 600, italicoCitacao: false },
  { id: 'inter', nome: 'Inter', titulo: 'Inter', texto: 'Inter', pesoTitulo: 700, italicoCitacao: false },
  { id: 'manrope', nome: 'Manrope', titulo: 'Manrope', texto: 'Manrope', pesoTitulo: 700, italicoCitacao: false },
  { id: 'grotesk', nome: 'Space Grotesk + Geist', titulo: 'Space Grotesk', texto: 'Geist', pesoTitulo: 600, italicoCitacao: false },
  { id: 'plex', nome: 'IBM Plex Sans', titulo: 'IBM Plex Sans', texto: 'IBM Plex Sans', pesoTitulo: 600, italicoCitacao: false },
  { id: 'syne', nome: 'Syne + Manrope', titulo: 'Syne', texto: 'Manrope', pesoTitulo: 700, italicoCitacao: false },
  { id: 'unbounded', nome: 'Unbounded + Manrope', titulo: 'Unbounded', texto: 'Manrope', pesoTitulo: 700, italicoCitacao: false },
  { id: 'bebas', nome: 'Bebas Neue + Inter', titulo: 'Bebas Neue', texto: 'Inter', pesoTitulo: 400, italicoCitacao: false },
  { id: 'archivo', nome: 'Archivo Black + Inter', titulo: 'Archivo Black', texto: 'Inter', pesoTitulo: 400, italicoCitacao: false },
  { id: 'fredoka', nome: 'Fredoka + Manrope', titulo: 'Fredoka', texto: 'Manrope', pesoTitulo: 600, italicoCitacao: false },
  { id: 'fraunces', nome: 'Fraunces + Geist', titulo: 'Fraunces', texto: 'Geist', pesoTitulo: 500, italicoCitacao: true },
  { id: 'playfair', nome: 'Playfair Display + Inter', titulo: 'Playfair Display', texto: 'Inter', pesoTitulo: 600, italicoCitacao: true },
  { id: 'dmserif', nome: 'DM Serif Display + Geist', titulo: 'DM Serif Display', texto: 'Geist', pesoTitulo: 400, italicoCitacao: false },
  { id: 'instrument', nome: 'Instrument Serif + Inter', titulo: 'Instrument Serif', texto: 'Inter', pesoTitulo: 400, italicoCitacao: true },
  { id: 'cormorant', nome: 'Cormorant Garamond + Manrope', titulo: 'Cormorant Garamond', texto: 'Manrope', pesoTitulo: 500, italicoCitacao: true },
  { id: 'sourceserif', nome: 'Source Serif 4', titulo: 'Source Serif 4', texto: 'Source Serif 4', pesoTitulo: 600, italicoCitacao: true },
  { id: 'mono', nome: 'Geist Mono + Geist', titulo: 'Geist Mono', texto: 'Geist', pesoTitulo: 500, italicoCitacao: false },
]
export const parDeFontes = (titulo: string, texto: string): ParFontes | undefined => PARES_FONTES.find((p) => p.titulo === titulo && p.texto === texto)

export interface Marca {
  nome: string
  cores: string[]
  /** false = usa as cores do estilo mesmo com cores de marca (padrão: aplica as cores da marca sobre o estilo). */
  aplicarCores?: boolean
  /** Par de fontes fixado pela marca (ausente = as fontes do estilo). */
  fontes?: { titulo: string; texto: string } | null
}

/**
 * Tema a partir das cores da marca: a 1ª vira o acento, a 2ª (opcional) o fundo escuro, a 3ª (opcional) o
 * acento secundário. Fundos e tintas são derivados para manter contraste legível (WCAG ≥ 4,5 no texto).
 * (O tema "marca" antigo; hoje as cores da marca são aplicadas sobre qualquer estilo por `aplicarMarca`.)
 */
export function temaDaMarca(marca: Marca, base: TemaVisual = temaPorId('nevoa')): TemaVisual {
  const cores = marca.cores.filter((c) => RE_HEX.test(c)).map((c) => c.toUpperCase())
  if (!cores.length) return base
  const principal = cores[0]!
  const escuraDada = cores.slice(1).find((c) => luminanciaRelativa(c) < 0.08)
  const escuroFundo = escuraDada ?? misturar(principal, '#000000', 0.78)
  const claroFundo = misturar('#FFFFFF', principal, 0.05)
  const claroTinta = legivel(claroFundo, [misturar(escuroFundo, '#000000', 0.2), '#141414'], 7)
  const escuroTinta = legivel(escuroFundo, [misturar('#FFFFFF', principal, 0.06), '#FFFFFF'], 7)
  const acento = contraste(principal, claroFundo) >= 2.2 ? principal : misturar(principal, '#000000', 0.35)
  const acento2 = cores.find((c, i) => i > 0 && c !== escuraDada) ?? misturar(principal, '#FFFFFF', 0.45)
  return {
    ...base,
    id: 'marca',
    nome: marca.nome.trim() ? `Marca ${marca.nome.trim()}`.slice(0, 40) : 'Sua marca',
    descricao: 'as cores da sua marca',
    claro: sup(claroFundo, claroTinta),
    escuro: sup(escuroFundo, escuroTinta),
    acento,
    acento2,
    sobreAcento: legivel(acento, ['#FFFFFF', '#141414'], 4.5),
    motivo: 'formas',
    capa: 'escuro',
    paleta: 'nevoa',
  }
}

/** Cinza com a mesma luminância (para tirar a cor de uma superfície antes de tingir com a marca). */
function cinzaDe(hex: string): string {
  const l = luminanciaRelativa(hex)
  const v = (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055) * 255
  return paraHex(v, v, v)
}

/**
 * Cores (e fontes) da marca aplicadas SOBRE um estilo: o estilo mantém tipografia, forma, espaçamento, motivo e
 * regras de composição; as superfícies perdem parte da cor própria e ganham um tom da marca; acentos viram as
 * cores da marca; tintas são escolhidas para contraste ≥ 7. O id continua o do estilo (trocar estilo é grátis).
 */
export function aplicarMarca(base: TemaVisual, marca: Marca | undefined): TemaVisual {
  if (!marca) return base
  let t = base
  const cores = marca.cores.filter((c) => RE_HEX.test(c)).map((c) => c.toUpperCase())
  if (cores.length && marca.aplicarCores !== false) {
    const principal = cores[0]!
    const escuraDada = cores.slice(1).find((c) => luminanciaRelativa(c) < 0.06)
    const segunda = cores.slice(1).find((c) => c !== escuraDada)
    const neutro = (hex: string, k: number) => misturar(hex, cinzaDe(hex), k)
    const claroFundo = misturar(neutro(base.claro.fundo, 0.6), principal, 0.05)
    const escuroFundo = escuraDada ?? misturar(neutro(base.escuro.fundo, 0.55), principal, luminanciaRelativa(base.escuro.fundo) < 0.03 ? 0.1 : 0.16)
    const claroTinta = legivel(claroFundo, [base.claro.tinta, misturar(escuroFundo, '#000000', 0.25), '#141414'], 7)
    const escuroTinta = legivel(escuroFundo, [base.escuro.tinta, misturar('#FFFFFF', principal, 0.06), '#FFFFFF'], 7)
    const acento = principal
    const acento2 = segunda ?? (base.base === 'escuro' ? misturar(principal, '#FFFFFF', 0.35) : misturar(principal, escuroFundo, 0.45))
    const grad = (g: Superficie['gradiente'], de: string, para: string) => (g ? { angle: g.angle, stops: [{ color: de, pos: 0 }, { color: misturar(de, para, 0.14), pos: 55 }, { color: misturar(de, para, 0.26), pos: 100 }] } : undefined)
    const comCartao = (s: Superficie, fundo: string, tinta: string): Superficie => {
      const nova = sup(fundo, tinta)
      // cartões translúcidos (vidro) continuam translúcidos
      const cartao = s.cartao.length > 7 ? s.cartao : nova.cartao
      const linha = s.linha.length > 7 ? s.linha : nova.linha
      const g = grad(s.gradiente, fundo, base.base === 'escuro' || s === base.escuro ? principal : acento2)
      return { ...nova, cartao, linha, ...(g ? { gradiente: g } : {}) }
    }
    t = {
      ...base,
      claro: comCartao(base.claro, claroFundo, claroTinta),
      escuro: comCartao(base.escuro, escuroFundo, escuroTinta),
      acento,
      acento2,
      sobreAcento: legivel(acento, ['#FFFFFF', '#141414'], 4.5),
    }
  }
  const par = marca.fontes ? PARES_FONTES.find((p) => p.titulo === marca.fontes!.titulo && p.texto === marca.fontes!.texto) : undefined
  if (par) t = { ...t, fontes: { ...t.fontes, titulo: par.titulo, texto: par.texto, pesoTitulo: par.pesoTitulo, italicoCitacao: par.italicoCitacao } }
  return t
}

/** O estilo escolhido com a marca aplicada ("marca" = tema montado só das cores da marca, legado). */
export function resolverTema(id: TemaEscolhido | string, marca?: Marca): TemaVisual {
  if (id === 'marca') return marca?.cores.some((c) => RE_HEX.test(c)) ? aplicarMarca(temaDaMarca(marca), { ...marca, cores: [] }) : aplicarMarca(temaPorId(id), marca && { ...marca, cores: [] })
  return aplicarMarca(temaPorId(id), marca)
}

/** Superfície de uma tela conforme o fundo escolhido. No fundo de acento, a tinta é `sobreAcento`. */
export function superficie(t: TemaVisual, fundo: Fundo): Superficie & { tipo: Fundo; destaque: string } {
  if (fundo === 'acento') {
    const tinta = t.sobreAcento
    return { tipo: 'acento', fundo: t.acento, tinta, suave: contraste(tinta, t.acento) >= 4.5 ? alfa(tinta, 0.82) : tinta, cartao: misturar(t.acento, tinta, 0.12), linha: misturar(t.acento, tinta, 0.3), destaque: legivel(t.acento, [t.acento2, tinta], 3) }
  }
  const s = fundo === 'escuro' ? t.escuro : t.claro
  return { ...s, tipo: fundo, destaque: legivel(s.fundo, [t.acento, t.acento2, s.tinta], 3) }
}
