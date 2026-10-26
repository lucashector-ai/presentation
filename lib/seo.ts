/**
 * SEO e GEO (buscadores e respostas de IA): origem canônica, páginas públicas, sitemap, robots e JSON-LD.
 * Fonte única para app/layout.tsx, app/robots.ts, app/sitemap.ts, as rotas /llms.txt e as páginas públicas;
 * os números de planos vêm de lib/planos.ts. Conteúdo de marketing (FAQ, comparativos) fica em
 * components/marketing/dados.ts e entra aqui só como parâmetro dos construtores.
 */
import type { Metadata } from 'next'
import { PACOTES_AVULSOS, PLANOS, type Plano } from './planos'
import { ORIGEM_SITE } from './site'

export const NOME = 'Mostra'
export const SLOGAN = 'Apresentações para quem cria'
/** Frase-definição citável (topo da landing, llms.txt, Open Graph). */
export const DEFINICAO = 'Mostra é a plataforma brasileira para criar apresentações com IA e um editor de nível profissional: animações, interações, 3D, importação do Figma e links privados, sem escrever código.'
export const DESCRICAO_PADRAO = 'Crie apresentações com IA e um editor profissional: animações, interações, cole do Figma e envie por link privado. Feito no Brasil, grátis para começar.'
/** Imagem de compartilhamento (1200×630), gerada por scripts/gerar-og.mjs. */
export const IMAGEM_OG = { url: '/og.png', width: 1200, height: 630, alt: 'Mostra — apresentações com IA para quem cria' } as const
/** Perfis oficiais (sameAs do JSON-LD). Vazio até os perfis existirem: um link quebrado aqui vale menos que nenhum. */
export const REDES: string[] = []
/** E-mail público de contato; vazio até existir uma caixa real. */
export const EMAIL_CONTATO = ''

/** URL absoluta a partir de um caminho ("/precos") ou de uma URL já absoluta. */
export const absoluta = (caminho: string) => (/^https?:\/\//.test(caminho) ? caminho : `${ORIGEM_SITE}${caminho.startsWith('/') ? caminho : `/${caminho}`}`)

export interface PaginaPublica {
  caminho: string
  /** Título sem o sufixo "· Mostra" (a landing usa o título absoluto). */
  titulo: string
  descricao: string
  prioridade: number
  frequencia: 'weekly' | 'monthly' | 'yearly'
}

const resumoPlanos = () => {
  const p = PLANOS
  return `Free com ${p.free.creditos.quantidade} créditos, Plus R$${p.plus.precoMensalBRL}, Pro R$${p.pro.precoMensalBRL} e Studio R$${p.studio.precoMensalBRL} por membro`
}

/** Páginas que entram no sitemap, no llms.txt e no rodapé. Login, /criar, /app, /api e /p ficam de fora. */
export const PAGINAS: PaginaPublica[] = [
  { caminho: '/', titulo: 'Mostra — crie apresentações com IA e envie por link', descricao: DESCRICAO_PADRAO, prioridade: 1, frequencia: 'weekly' },
  { caminho: '/precos', titulo: 'Planos e preços', descricao: `Planos do Mostra: ${resumoPlanos()}. 1 crédito = 1 tela criada pela IA; pacotes avulsos que não expiram.`, prioridade: 0.9, frequencia: 'monthly' },
  { caminho: '/apresentacao-com-ia', titulo: 'Como fazer uma apresentação com IA', descricao: 'Descreva o briefing, revise o roteiro e receba telas desenhadas na sua marca, em português. A alternativa brasileira ao Gamma, Pitch e Canva.', prioridade: 0.9, frequencia: 'monthly' },
  { caminho: '/termos', titulo: 'Termos de uso', descricao: 'Termos de uso do Mostra: conta, planos e créditos, conteúdo e IA, links de apresentação, uso aceitável e cancelamento.', prioridade: 0.3, frequencia: 'yearly' },
  { caminho: '/privacidade', titulo: 'Política de privacidade', descricao: 'Como o Mostra trata seus dados pessoais (LGPD): o que coletamos, para quê, com quem compartilhamos, IA, cookies e seus direitos.', prioridade: 0.3, frequencia: 'yearly' },
  { caminho: '/signup', titulo: 'Criar conta grátis', descricao: `Crie sua conta no Mostra: ${PLANOS.free.creditos.quantidade} créditos de IA e ${PLANOS.free.limites.projetos} projetos grátis, sem cartão de crédito. Em português, com preços em reais.`, prioridade: 0.6, frequencia: 'monthly' },
]

export const pagina = (caminho: string): PaginaPublica => {
  const p = PAGINAS.find((x) => x.caminho === caminho)
  if (!p) throw new Error(`página pública desconhecida: ${caminho}`)
  return p
}

/**
 * Metadados completos de uma página pública (título, descrição, canônico, Open Graph e Twitter). O Next mescla
 * metadados por chave de primeiro nível, então openGraph e twitter são repetidos aqui para não herdar os da raiz
 * com a URL errada. A raiz é noindex (produto privado por padrão); as páginas públicas liberam a indexação.
 */
export function metadadosPagina(caminho: string, extra: Partial<Metadata> = {}): Metadata {
  const p = pagina(caminho)
  const url = absoluta(caminho)
  const tituloCompleto = caminho === '/' ? p.titulo : `${p.titulo} · ${NOME}`
  return {
    title: caminho === '/' ? { absolute: p.titulo } : p.titulo,
    description: p.descricao,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', siteName: NOME, locale: 'pt_BR', url, title: tituloCompleto, description: p.descricao, images: [{ ...IMAGEM_OG, url: absoluta(IMAGEM_OG.url) }] },
    twitter: { card: 'summary_large_image', title: tituloCompleto, description: p.descricao, images: [absoluta(IMAGEM_OG.url)] },
    ...extra,
  }
}

// ---------- robots e sitemap ----------

/**
 * Caminhos privados: nunca indexados e fora do rastreamento (o X-Robots-Tag em next.config.js reforça /p e /app).
 * Disallow casa por prefixo, então "/p" bloquearia /precos e "/app" bloquearia /apresentacao-com-ia: por isso a barra
 * no fim e o "$" (fim da URL) para a raiz do painel.
 */
export const CAMINHOS_PRIVADOS = ['/app/', '/app$', '/api/', '/p/', '/criar'] as const
/** Prefixos de fato (sem o "$"), para conferir se uma página pública colide com um caminho privado. */
export const PREFIXOS_PRIVADOS = CAMINHOS_PRIVADOS.map((c) => c.replace(/\$$/, ''))
export const ehCaminhoPrivado = (caminho: string) => PREFIXOS_PRIVADOS.some((p) => caminho === p.replace(/\/$/, '') || caminho.startsWith(p))

/**
 * Rastreadores de busca com IA liberados de propósito (decisão GEO): queremos ser citados nas respostas do
 * ChatGPT, Claude, Perplexity, Gemini e Copilot. O conteúdo público é a landing, preços e as páginas de intenção.
 */
export const ROBOS_IA = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Bingbot', 'CCBot', 'Applebot-Extended'] as const

export interface RegraRobots { userAgent: string | string[]; allow: string; disallow: string[] }
export interface ConfigRobots { rules: RegraRobots[]; sitemap: string; host: string }

export function configRobots(): ConfigRobots {
  const disallow = [...CAMINHOS_PRIVADOS]
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: [...ROBOS_IA], allow: '/', disallow },
    ],
    sitemap: absoluta('/sitemap.xml'),
    host: ORIGEM_SITE,
  }
}

export interface EntradaSitemap { url: string; changeFrequency: PaginaPublica['frequencia']; priority: number }

/** Sem <lastmod>: no Worker, Date no escopo do módulo é 1970 e "agora" a cada pedido não é uma data de alteração; o Google ignora lastmod que não bate. */
export const entradasSitemap = (): EntradaSitemap[] => PAGINAS.map((p) => ({ url: absoluta(p.caminho), changeFrequency: p.frequencia, priority: p.prioridade }))

// ---------- JSON-LD ----------

export type JsonLd = Record<string, unknown>

const ID = { organizacao: `${ORIGEM_SITE}/#organizacao`, site: `${ORIGEM_SITE}/#site`, app: `${ORIGEM_SITE}/#app` } as const

export function jsonLdOrganizacao(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ID.organizacao,
    name: NOME,
    url: ORIGEM_SITE,
    logo: { '@type': 'ImageObject', url: absoluta('/apple-touch-icon.png'), width: 180, height: 180 },
    ...(EMAIL_CONTATO ? { email: EMAIL_CONTATO } : {}),
    ...(REDES.length ? { sameAs: REDES } : {}),
    address: { '@type': 'PostalAddress', addressCountry: 'BR' },
  }
}

export function jsonLdWebSite(): JsonLd {
  return { '@type': 'WebSite', '@id': ID.site, url: ORIGEM_SITE, name: NOME, inLanguage: 'pt-BR', publisher: { '@id': ID.organizacao } }
}

/** Oferta de um plano (preço mensal em BRL; o Free sai como 0). */
function ofertaPlano(p: Plano): JsonLd {
  return {
    '@type': 'Offer',
    name: `Plano ${p.nome}`,
    price: p.precoMensalBRL,
    priceCurrency: 'BRL',
    url: absoluta('/precos'),
    availability: 'https://schema.org/InStock',
    category: 'subscription',
    description: p.creditos.recorrencia === 'mensal' ? `${p.creditos.quantidade} créditos por mês${p.porMembro ? ', por membro' : ''} (1 crédito = 1 tela criada pela IA)` : `${p.creditos.quantidade} créditos no cadastro, ${p.limites.projetos} projetos`,
    ...(p.precoMensalBRL > 0
      ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: p.precoMensalBRL, priceCurrency: 'BRL', unitText: p.porMembro ? 'por membro, por mês' : 'por mês', billingDuration: 'P1M' } }
      : {}),
  }
}

export function jsonLdSoftware(): JsonLd {
  const planos = Object.values(PLANOS)
  const precos = planos.map((p) => p.precoMensalBRL)
  return {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': ID.app,
    name: NOME,
    url: ORIGEM_SITE,
    description: DEFINICAO,
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Apresentações',
    operatingSystem: 'Web',
    browserRequirements: 'Navegador moderno com JavaScript',
    inLanguage: 'pt-BR',
    countryOfOrigin: { '@type': 'Country', name: 'Brasil' },
    featureList: [
      'Criar apresentação com IA a partir de um briefing, texto ou PDF',
      'Editor de canvas livre com camadas, grupos, guias e auto layout',
      'Cola do Figma e do Illustrator como camadas editáveis',
      'Três formatos: Slides, Story (scroll) e Explorar (navegação livre)',
      'Animações e transições (fade, slide, scale, morph)',
      'Vídeo, GIF, Lottie e modelos 3D (GLB)',
      'Links privados com senha, validade e contagem de visualizações',
      'Colaboração em tempo real',
      'Exportação em PDF',
    ],
    publisher: { '@id': ID.organizacao },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: Math.min(...precos),
      highPrice: Math.max(...precos),
      offerCount: planos.length + PACOTES_AVULSOS.length,
      offers: [
        ...planos.map(ofertaPlano),
        ...PACOTES_AVULSOS.map((pk) => ({ '@type': 'Offer', name: `Pacote de ${pk.creditos} créditos`, price: pk.precoBRL, priceCurrency: 'BRL', url: absoluta('/precos'), availability: 'https://schema.org/InStock', description: `${pk.creditos} créditos avulsos que não expiram (1 crédito = 1 tela criada pela IA)` })),
      ],
    },
  }
}

export interface PerguntaResposta { pergunta: string; resposta: string }

export function jsonLdFaq(itens: readonly PerguntaResposta[]): JsonLd {
  return {
    '@type': 'FAQPage',
    mainEntity: itens.map((q) => ({ '@type': 'Question', name: q.pergunta, acceptedAnswer: { '@type': 'Answer', text: q.resposta } })),
  }
}

export function jsonLdBreadcrumb(trilha: { nome: string; caminho: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trilha.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.nome, item: absoluta(t.caminho) })),
  }
}

export function jsonLdWebPage(caminho: string, extra: JsonLd = {}): JsonLd {
  const p = pagina(caminho)
  return { '@type': 'WebPage', '@id': `${absoluta(caminho)}#pagina`, url: absoluta(caminho), name: caminho === '/' ? p.titulo : `${p.titulo} · ${NOME}`, description: p.descricao, inLanguage: 'pt-BR', isPartOf: { '@id': ID.site }, about: { '@id': ID.app }, ...extra }
}

/** Um único <script> por página, com tudo em @graph. `<` vira < para o JSON não fechar a tag. */
export const grafoJsonLd = (nos: JsonLd[]): JsonLd => ({ '@context': 'https://schema.org', '@graph': nos })
export const serializarJsonLd = (dados: JsonLd) => JSON.stringify(dados).replace(/</g, '\\u003c')
