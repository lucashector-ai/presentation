/**
 * Conteúdo da landing (Claude Design, "Landing v2"). Dados puros — sem JSX — para poder ser
 * reutilizado em outras telas (página de preços, painel de créditos, central de ajuda...).
 */

export const ROTAS = {
  entrar: '/login',
  cadastro: '/signup',
  criar: '/criar',
  exemplo: '/p/demo_cafe_aurora_proposta_01_token_fixo_xx',
} as const

/** Formas geométricas da marca usadas como marcadores (faixa, listas, legendas). */
export type TipoForma = 'circulo' | 'quadrado' | 'quadradoSuave' | 'triangulo' | 'semicirculo'

export interface ItemNav {
  href: string
  rotulo: string
  /** Mostra o ponto violeta antes do rótulo (destaque do "Criar com IA"). */
  ponto?: boolean
}

export const NAV: ItemNav[] = [
  { href: '#como', rotulo: 'Como funciona' },
  { href: '#ia', rotulo: 'Criar com IA', ponto: true },
  { href: '#formatos', rotulo: 'Formatos' },
  { href: '#recursos', rotulo: 'Recursos' },
  { href: '#precos', rotulo: 'Preços' },
  { href: '#faq', rotulo: 'FAQ' },
]

export const FAIXA: { rotulo: string; forma: TipoForma; cor: string }[] = [
  { rotulo: 'Identidades visuais', forma: 'circulo', cor: '#E4572E' },
  { rotulo: 'Campanhas', forma: 'triangulo', cor: '#D7F25C' },
  { rotulo: 'Portfólios', forma: 'quadrado', cor: '#5965F2' },
  { rotulo: 'Pitches', forma: 'semicirculo', cor: '#F2C14E' },
  { rotulo: 'Key visuals', forma: 'circulo', cor: '#F1D3B3' },
  { rotulo: 'Editoriais', forma: 'triangulo', cor: '#C9D3C0' },
  { rotulo: 'Packaging', forma: 'quadrado', cor: '#E4572E' },
  { rotulo: 'Wayfinding', forma: 'circulo', cor: '#D7F25C' },
]

export const PASSOS = [
  { n: 1, titulo: 'Crie', texto: 'Importe imagens, vídeos e textos para um canvas livre, com guias, grids e componentes. Precisão de editor de design, simplicidade de slide.' },
  { n: 2, titulo: 'Apresente', texto: 'Tela cheia, transições cinematográficas e navegação por clique, teclado ou scroll. O projeto ocupa todo o espaço — sem barras, sem distrações.' },
  { n: 3, titulo: 'Compartilhe', texto: 'Links privados com senha, expiração e métricas de visualização. Atualize o projeto e o cliente vê a nova versão — sem reenviar nada.' },
] as const

// ---------- Criar com IA ----------
export const IA_FORMATOS = ['Slides', 'Story', 'Explorar'] as const

export const IA_PROMPT_INICIAL = 'Identidade visual para uma marca de cerâmica artesanal, com conceito, paleta e aplicações.'

export const IA_EXEMPLOS: { rotulo: string; cor: string; forma: TipoForma; prompt: string }[] = [
  { rotulo: 'Rebrand de cafeteria', cor: '#B4532A', forma: 'circulo', prompt: 'Rebrand de uma cafeteria de bairro, com conceito, paleta e aplicações.' },
  { rotulo: 'Campanha de verão', cor: '#E4572E', forma: 'quadradoSuave', prompt: 'Campanha de verão para marca de moda praia, com key visual e peças digitais.' },
  { rotulo: 'Portfólio de DA', cor: '#D7F25C', forma: 'quadrado', prompt: 'Portfólio de diretora de arte com cinco cases de identidade e editorial.' },
  { rotulo: 'Pitch de festival', cor: '#F1D3B3', forma: 'semicirculo', prompt: 'Pitch de festival de música independente para patrocinadores.' },
]

export const IA_ETAPAS = [
  { titulo: '1 · Prompt', texto: 'Descreva, cole um briefing ou importe um PDF.' },
  { titulo: '2 · Roteiro', texto: 'Edite, reordene e ajuste cada tela.' },
  { titulo: '3 · Telas', texto: 'Tema, formas e layout aplicados na hora.' },
] as const

/** Temas da prévia: fundo, tinta, acento, fundo alternativo, tinta alternativa. */
export const IA_TEMAS = [
  { nome: 'Argila', fundo: '#EEE7DB', tinta: '#2B1D16', acento: '#B4532A', fundoAlt: '#2B1D16', tintaAlt: '#EEE7DB' },
  { nome: 'Maré', fundo: '#1F3B4D', tinta: '#F2E9D8', acento: '#E4572E', fundoAlt: '#F2E9D8', tintaAlt: '#1F3B4D' },
  { nome: 'Ipê', fundo: '#F2C14E', tinta: '#2A2118', acento: '#2A2118', fundoAlt: '#2A2118', tintaAlt: '#F2C14E' },
  { nome: 'Ameixa', fundo: '#3A2E5C', tinta: '#F1D3B3', acento: '#F1D3B3', fundoAlt: '#F1D3B3', tintaAlt: '#3A2E5C' },
] as const

export const IA_TELAS = ['Atlas Cerâmica', 'O desafio', 'Forma e fogo', 'Paleta de argila', 'Tipografia', 'Aplicações'] as const

// ---------- Formatos ----------
export const FORMATOS = [
  {
    id: 'slides',
    rotulo: 'Slides',
    cor: '#E4572E',
    descricao: 'Telas em sequência com transições cinematográficas. Ideal para apresentar ao vivo, em reunião ou na tela do cliente.',
    pontos: ['Transições fade, slide, scale e morph', 'Modo apresentador com notas', 'Navegação por teclado e clique'],
  },
  {
    id: 'story',
    rotulo: 'Story',
    cor: '#1F3B4D',
    descricao: 'Uma narrativa vertical contínua, controlada pelo scroll — com animações que respondem ao ritmo da leitura.',
    pontos: ['Animações ligadas ao scroll', 'Perfeito no celular', 'Seções fixas e parallax'],
  },
  {
    id: 'explorar',
    rotulo: 'Explorar',
    cor: '#D7F25C',
    descricao: 'Um espaço interativo com hotspots e caminhos abertos. O cliente descobre o projeto no próprio tempo.',
    pontos: ['Hotspots e modais', 'Navegação livre entre telas', 'Estados e alternâncias'],
  },
] as const

export type IdFormato = (typeof FORMATOS)[number]['id']

// ---------- Recursos ----------
export type IconeRecurso = 'circulo' | 'quadrado' | 'triangulo' | 'semicirculo' | 'pontos' | 'avatares' | 'cubo'

export const RECURSOS: { icone: IconeRecurso; titulo: string; texto: string }[] = [
  { icone: 'circulo', titulo: 'Interações sem código', texto: 'Hotspots, modais, estados e navegação — configurados com cliques: gatilho, ação, animação.' },
  { icone: 'quadrado', titulo: 'Animações e transições', texto: 'Fade, slide, scale e morph entre telas, com duração e easing ajustáveis e prévia instantânea.' },
  { icone: 'triangulo', titulo: 'Vídeo e mídia em alta', texto: 'MP4, GIF e Lottie rodando no projeto, imagens sem compressão destrutiva e carregamento progressivo.' },
  { icone: 'semicirculo', titulo: 'Links privados', texto: 'Senha, expiração, domínio próprio e permissão de comentários — você controla quem vê e por quanto tempo.' },
  { icone: 'pontos', titulo: 'Métricas de visualização', texto: 'Saiba quem abriu, quanto tempo ficou em cada tela e onde clicou. Ideal para acompanhar propostas.' },
  { icone: 'avatares', titulo: 'Colaboração em tempo real', texto: 'Edite com o estúdio ao mesmo tempo, deixe comentários no canvas e mantenha uma biblioteca compartilhada.' },
  { icone: 'cubo', titulo: '3D e arquivos de design', texto: 'Cole direto do Figma e do Illustrator, solte SVG, fotos, vídeos e modelos 3D do Blender (GLB).' },
]

// ---------- PDF × Mostra ----------
export const COMPARACAO = [
  { rotulo: 'Movimento e transições', pdf: 'Não', mostra: 'Sim' },
  { rotulo: 'Vídeo dentro do projeto', pdf: 'Não', mostra: 'Sim' },
  { rotulo: 'Interações clicáveis', pdf: 'Limitado', mostra: 'Sem código' },
  { rotulo: 'Atualizar depois de enviar', pdf: 'Reenviar arquivo', mostra: 'Mesmo link' },
  { rotulo: 'Saber se o cliente abriu', pdf: 'Não', mostra: 'Métricas por tela' },
  { rotulo: 'Tamanho do envio', pdf: 'Anexos pesados', mostra: 'Um link' },
] as const

// ---------- Preços ----------
/** Desconto do plano anual sobre o mensal. */
export const DESCONTO_ANUAL = 0.2

export interface PlanoMarketing {
  id: 'free' | 'plus' | 'pro' | 'studio'
  nome: string
  /** Preço mensal em reais quando cobrado anualmente (já com desconto). */
  precoAnual: number
  /** Preço mensal em reais no plano mensal. */
  precoMensal: number
  periodo: string
  descricao: string
  creditos: number
  creditosLegenda: string
  inclui: string
  itens: string[]
  cta: string
  destaque?: boolean
  cores: { fundo: string; tinta: string; moeda: string; ctaFundo: string; ctaTinta: string }
}

export const PLANOS_MARKETING: PlanoMarketing[] = [
  {
    id: 'free', nome: 'Free', precoAnual: 0, precoMensal: 0, periodo: 'para sempre',
    descricao: 'Para experimentar e apresentar os primeiros projetos.',
    creditos: 400, creditosLegenda: 'no cadastro · uma vez',
    inclui: 'Free inclui:', itens: ['3 projetos', 'Até 10 telas por prompt', 'Slides, Story e Explorar', 'Importar PDF e PPTX', 'Exportar PDF e PNG'],
    cta: 'Começar grátis',
    cores: { fundo: '#FAFAF9', tinta: '#171717', moeda: '#F2C14E', ctaFundo: '#FFFFFF', ctaTinta: '#171717' },
  },
  {
    id: 'plus', nome: 'Plus', precoAnual: 24, precoMensal: 29, periodo: '/ mês',
    descricao: 'Para quem apresenta de vez em quando e quer tirar a marca.',
    creditos: 1000, creditosLegenda: 'por mês',
    inclui: 'Tudo do Free, e:', itens: ['Projetos ilimitados', 'Até 50 telas por prompt', 'Sem marca d’água Mostra', 'Imagens com IA avançadas'],
    cta: 'Assinar Plus',
    cores: { fundo: '#EEE7DB', tinta: '#2B1D16', moeda: '#E4572E', ctaFundo: '#FFFFFF', ctaTinta: '#171717' },
  },
  {
    id: 'pro', nome: 'Pro', precoAnual: 59, precoMensal: 74, periodo: '/ mês', destaque: true,
    descricao: 'Para freelancers e diretores de arte que apresentam toda semana.',
    creditos: 4000, creditosLegenda: 'por mês',
    inclui: 'Tudo do Plus, e:', itens: ['Até 100 telas por prompt', 'Modelos de imagem premium', 'Links com senha e métricas', 'Marca própria e 10 domínios', 'Acesso à API'],
    cta: 'Assinar Pro',
    cores: { fundo: '#171717', tinta: '#FAFAF9', moeda: '#D7F25C', ctaFundo: '#D7F25C', ctaTinta: '#171717' },
  },
  {
    id: 'studio', nome: 'Studio', precoAnual: 119, precoMensal: 149, periodo: '/ membro / mês',
    descricao: 'Para estúdios e agências que trabalham em equipe.',
    creditos: 20000, creditosLegenda: 'por mês · compartilhados',
    inclui: 'Tudo do Pro, e:', itens: ['Modelos de IA mais avançados (texto, imagem, vídeo)', 'Edição em tempo real e biblioteca', 'Até 100 domínios próprios', 'Acesso antecipado a novidades'],
    cta: 'Falar com vendas',
    cores: { fundo: '#F2C14E', tinta: '#2A2118', moeda: '#FAFAF9', ctaFundo: '#171717', ctaTinta: '#FAFAF9' },
  },
]

/** Custo em créditos de cada recurso de IA. Editar, apresentar e compartilhar não consomem créditos. */
export const CUSTOS_CREDITOS: { id: string; rotulo: string; creditos: number; cor: string; forma: TipoForma }[] = [
  { id: 'roteiro', rotulo: 'Gerar roteiro com IA', creditos: 10, cor: '#5965F2', forma: 'circulo' },
  { id: 'tela', rotulo: 'Gerar uma tela', creditos: 5, cor: '#E4572E', forma: 'quadradoSuave' },
  { id: 'texto', rotulo: 'Reescrever ou traduzir texto', creditos: 2, cor: '#D7F25C', forma: 'quadrado' },
  { id: 'imagem', rotulo: 'Gerar imagem com IA', creditos: 20, cor: '#F2C14E', forma: 'semicirculo' },
  { id: 'video', rotulo: 'Gerar vídeo curto', creditos: 100, cor: '#3A2E5C', forma: 'circulo' },
]

/** Pacotes avulsos: não expiram, valem em qualquer plano. */
export const PACOTES_CREDITOS = [
  { creditos: 500, preco: 19 },
  { creditos: 2000, preco: 59 },
  { creditos: 10000, preco: 229 },
] as const

// ---------- FAQ ----------
export const FAQ = [
  { pergunta: 'Preciso saber programar?', resposta: 'Não. Tudo é visual: arraste elementos, escolha gatilhos e ações em listas e veja a prévia na hora.' },
  { pergunta: 'O cliente precisa criar conta para ver?', resposta: 'Não. Ele abre o link no navegador, no computador ou no celular. Se você ativar senha, só quem tiver a senha entra.' },
  { pergunta: 'Posso importar meus arquivos do Figma ou PDF?', resposta: 'Sim. Importe imagens, PDFs e frames exportados; cada página vira uma tela editável.' },
  { pergunta: 'Dá para apresentar offline?', resposta: 'Sim, nos planos pagos você baixa uma versão HTML que roda sem internet.' },
  { pergunta: 'Posso cancelar quando quiser?', resposta: 'Sim. Seus projetos continuam acessíveis e voltam para o limite do plano Free.' },
] as const

// ---------- Rodapé ----------
/** `href: null` = página ainda não existe; o item aparece como texto. */
export const RODAPE: { titulo: string; links: { rotulo: string; href: string | null }[] }[] = [
  { titulo: 'Produto', links: [{ rotulo: 'Como funciona', href: '#como' }, { rotulo: 'Formatos', href: '#formatos' }, { rotulo: 'Recursos', href: '#recursos' }, { rotulo: 'Planos e preços', href: '#precos' }] },
  { titulo: 'Recursos', links: [{ rotulo: 'Templates', href: null }, { rotulo: 'Central de ajuda', href: null }, { rotulo: 'Blog', href: null }, { rotulo: 'FAQ', href: '#faq' }] },
  { titulo: 'Empresa', links: [{ rotulo: 'Sobre', href: null }, { rotulo: 'Contato', href: null }, { rotulo: 'Termos', href: null }, { rotulo: 'Privacidade', href: null }] },
]

// ---------- formatação ----------
const NUM = new Intl.NumberFormat('pt-BR')
export const formatarNumero = (n: number) => NUM.format(n)
export const formatarReais = (n: number) => `R$${NUM.format(n)}`
