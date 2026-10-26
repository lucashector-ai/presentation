/**
 * Conteúdo da landing (Claude Design, "Landing v2"). Dados puros — sem JSX — para poder ser
 * reutilizado em outras telas (página de preços, painel de créditos, central de ajuda...).
 */
import { ACOES_IA, ACUMULO_MAXIMO, CUSTO_CREDITOS, DESCONTO_ANUAL as DESCONTO, PACOTES_AVULSOS, PLANOS, TELAS_REFERENCIA, apresentacoesCom, custoApresentacao } from '@/lib/planos'
import { MAX_TELAS_IA, MIN_TELAS_IA, exemploApresentacoes, telasCom, textoTelas } from '@/lib/telasIa'

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

/** Âncoras com "/" na frente: o cabeçalho também aparece em /precos e /apresentacao-com-ia; na landing, viram rolagem. */
export const NAV: ItemNav[] = [
  { href: '/#como', rotulo: 'Como funciona' },
  { href: '/#ia', rotulo: 'Criar com IA', ponto: true },
  { href: '/#formatos', rotulo: 'Formatos' },
  { href: '/#recursos', rotulo: 'Recursos' },
  { href: '/precos', rotulo: 'Preços' },
  { href: '/#faq', rotulo: 'FAQ' },
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
  { n: 1, titulo: 'Crie', texto: 'Descreva o briefing para a IA ou importe imagens, vídeos e textos para um canvas livre, com guias, grids e componentes. Precisão de editor de design, simplicidade de slide.' },
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
  { titulo: '1 · Prompt', texto: 'Descreva, cole um briefing ou importe um texto.' },
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
  { icone: 'pontos', titulo: 'Acompanhe o cliente', texto: 'Veja quantas vezes cada link foi aberto, publique ajustes no mesmo link e revogue quando quiser — tudo em Enviados. Tempo por tela chega em breve.' },
  { icone: 'avatares', titulo: 'Colaboração em tempo real', texto: 'Edite com o estúdio ao mesmo tempo, deixe comentários no canvas e mantenha uma biblioteca compartilhada.' },
  { icone: 'cubo', titulo: '3D e arquivos de design', texto: 'Cole direto do Figma e do Illustrator, solte SVG, fotos, vídeos e modelos 3D do Blender (GLB).' },
]

// ---------- PDF × Mostra ----------
export const COMPARACAO = [
  { rotulo: 'Movimento e transições', pdf: 'Não', mostra: 'Sim' },
  { rotulo: 'Vídeo dentro do projeto', pdf: 'Não', mostra: 'Sim' },
  { rotulo: 'Interações clicáveis', pdf: 'Limitado', mostra: 'Sem código' },
  { rotulo: 'Atualizar depois de enviar', pdf: 'Reenviar arquivo', mostra: 'Mesmo link' },
  { rotulo: 'Saber se o cliente abriu', pdf: 'Não', mostra: 'Visualizações por link' },
  { rotulo: 'Tamanho do envio', pdf: 'Anexos pesados', mostra: 'Um link' },
] as const

// ---------- Preços ----------
// Preços, créditos e pacotes vêm de lib/planos.ts (fonte única: backend, painel e landing usam os mesmos números).

/** Desconto do plano anual sobre o mensal. */
export const DESCONTO_ANUAL = DESCONTO

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
  /** Créditos traduzidos em apresentações de 10 telas. */
  apresentacoes: number
  /** Créditos em telas com IA (≈) e um exemplo com 10 e 20 telas. */
  telas: number
  exemplo: string
  inclui: string
  itens: string[]
  cta: string
  destaque?: boolean
  cores: { fundo: string; tinta: string; moeda: string; ctaFundo: string; ctaTinta: string }
}

const plano = (id: PlanoMarketing['id']) => {
  const p = PLANOS[id]
  return { id, nome: p.nome, precoAnual: p.precoAnualBRL, precoMensal: p.precoMensalBRL, creditos: p.creditos.quantidade, apresentacoes: apresentacoesCom(p.creditos.quantidade), telas: telasCom(p.creditos.quantidade), exemplo: exemploApresentacoes(p.creditos.quantidade) }
}

export const PLANOS_MARKETING: PlanoMarketing[] = [
  {
    ...plano('free'), periodo: 'para sempre',
    descricao: 'Para experimentar e apresentar os primeiros projetos.',
    creditosLegenda: 'no cadastro · uma vez',
    inclui: 'Free inclui:', itens: ['3 projetos', `Apresentações de até ${PLANOS.free.limites.telasPorPrompt} telas com IA`, 'Slides, Story e Explorar', 'Cole do Figma e do Illustrator', 'Links privados revogáveis'],
    cta: 'Começar grátis',
    cores: { fundo: '#FAFAF9', tinta: '#171717', moeda: '#F2C14E', ctaFundo: '#FFFFFF', ctaTinta: '#171717' },
  },
  {
    ...plano('plus'), periodo: '/ mês',
    descricao: 'Para quem apresenta de vez em quando e quer tirar a marca.',
    creditosLegenda: 'por mês',
    inclui: 'Tudo do Free, e:', itens: ['Projetos ilimitados', `Apresentações de até ${PLANOS.plus.limites.telasPorPrompt} telas com IA`, 'Sem marca d’água Mostra', 'Imagens com IA avançadas'],
    cta: 'Assinar Plus',
    cores: { fundo: '#EEE7DB', tinta: '#2B1D16', moeda: '#E4572E', ctaFundo: '#FFFFFF', ctaTinta: '#171717' },
  },
  {
    ...plano('pro'), periodo: '/ mês', destaque: true,
    descricao: 'Para freelancers e diretores de arte que apresentam toda semana.',
    creditosLegenda: 'por mês',
    inclui: 'Tudo do Plus, e:', itens: [`Apresentações de até ${PLANOS.pro.limites.telasPorPrompt} telas com IA`, 'Links com senha e métricas', 'Modelos de imagem premium', 'Marca própria e 10 domínios', 'Acesso à API'],
    cta: 'Assinar Pro',
    cores: { fundo: '#171717', tinta: '#FAFAF9', moeda: '#D7F25C', ctaFundo: '#D7F25C', ctaTinta: '#171717' },
  },
  {
    ...plano('studio'), periodo: '/ membro / mês',
    descricao: 'Para estúdios e agências que trabalham em equipe.',
    creditosLegenda: 'por membro, por mês · compartilhados',
    inclui: 'Tudo do Pro, e:', itens: ['Créditos compartilhados pela equipe', 'Modelos de IA mais avançados para texto e imagem', 'Edição em tempo real e biblioteca', 'Até 100 domínios próprios'],
    cta: 'Falar com vendas',
    cores: { fundo: '#F2C14E', tinta: '#2A2118', moeda: '#FAFAF9', ctaFundo: '#171717', ctaTinta: '#FAFAF9' },
  },
]

/** Tamanho de referência das contas "≈ N apresentações". */
export const TELAS_EXEMPLO = TELAS_REFERENCIA

/** Quanto custa gerar uma apresentação: roteiro + cada tela. */
export const CUSTO_APRESENTACAO = { roteiro: CUSTO_CREDITOS.roteiro, porTela: CUSTO_CREDITOS.tela, calcular: custoApresentacao }

/** Ações secundárias, todas dentro de uma apresentação que já existe. Editar, apresentar e compartilhar não consomem créditos. */
export const CUSTOS_CREDITOS: { id: string; rotulo: string; detalhe: string; creditos: number; cor: string; forma: TipoForma }[] = ACOES_IA.filter((a) => a.id !== 'apresentacao').map((a, i) => ({
  id: a.id,
  rotulo: a.rotulo,
  detalhe: a.detalhe,
  creditos: a.creditos,
  cor: ['#E4572E', '#D7F25C', '#F2C14E'][i] ?? '#5965F2',
  forma: (['quadradoSuave', 'quadrado', 'semicirculo'] as const)[i] ?? 'circulo',
}))

/** Pacotes avulsos: não expiram, valem em qualquer plano. */
export const PACOTES_CREDITOS = PACOTES_AVULSOS.map((p) => ({ creditos: p.creditos, preco: p.precoBRL, apresentacoes: apresentacoesCom(p.creditos), telas: telasCom(p.creditos), exemplo: exemploApresentacoes(p.creditos) }))

// ---------- FAQ ----------
// Perguntas como as pessoas fazem a buscadores e a assistentes de IA; respostas factuais, com os números de lib/planos.ts
// (entram também no JSON-LD FAQPage da landing). Mudou um recurso? Mude aqui, e o resto acompanha.
const F = PLANOS.free, PL = PLANOS.plus, PR = PLANOS.pro, ST = PLANOS.studio
const reais = (n: number) => `R$${n.toLocaleString('pt-BR')}`

export const FAQ = [
  { pergunta: 'Como fazer uma apresentação com IA no Mostra?', resposta: `Descreva o que você precisa (ou cole um briefing, um texto ou um PDF), escolha a marca e o estilo e a IA escreve o roteiro, tela por tela. Você revisa, pede outro roteiro se quiser e manda desenhar: cada tela sai montada no seu kit de marca, com texto, layout e formas editáveis no editor. Uma apresentação vai de ${MIN_TELAS_IA} a ${MAX_TELAS_IA} telas e o roteiro é grátis; só o desenho consome créditos.` },
  { pergunta: 'Quanto custa o Mostra?', resposta: `O plano Free é grátis para sempre: ${F.creditos.quantidade} créditos no cadastro e ${F.limites.projetos} projetos. O Plus custa ${reais(PL.precoMensalBRL)} por mês (${PL.creditos.quantidade} créditos mensais), o Pro ${reais(PR.precoMensalBRL)} por mês (${PR.creditos.quantidade} créditos) e o Studio ${reais(ST.precoMensalBRL)} por membro por mês (${ST.creditos.quantidade} créditos por membro, compartilhados). No anual, Plus ${reais(PL.precoAnualBRL)}, Pro ${reais(PR.precoAnualBRL)} e Studio ${reais(ST.precoAnualBRL)} por mês. Pacotes avulsos: ${PACOTES_AVULSOS.map((p) => `${p.creditos} créditos por ${reais(p.precoBRL)}`).join(', ')}; eles não expiram. Preços em reais, sem conversão de dólar.` },
  { pergunta: 'Como funcionam os créditos?', resposta: `1 crédito = 1 tela criada pela IA. Uma apresentação de 10 telas custa ${custoApresentacao(10)} créditos e uma de 20 custa ${custoApresentacao(20)}, cobrados quando a IA desenha as telas. O Free vem com ${F.creditos.quantidade} créditos (${textoTelas(F.creditos.quantidade)}: ${exemploApresentacoes(F.creditos.quantidade)}) e o Plus renova ${PL.creditos.quantidade.toLocaleString('pt-BR')} por mês (${textoTelas(PL.creditos.quantidade)}). Roteiro, logo, cores, estilo e trocar o estilo depois são grátis; editar, apresentar e compartilhar também.` },
  { pergunta: 'Funciona com Figma e Illustrator?', resposta: 'Sim. Copie no Figma ou no Illustrator e cole no editor (⌘V): vetores viram camadas editáveis, com grupos, textos e cores preservados. Também dá para soltar PNG, JPG, SVG, vídeo, GIF, Lottie e modelos 3D do Blender (GLB); cada imagem pode virar uma tela.' },
  { pergunta: 'Exporta PDF ou PPTX?', resposta: 'PDF, sim: uma página por tela, com as fontes embutidas, direto do editor. PPTX não é exportado — o Mostra lê o tema de um .pptx antigo para montar o kit de marca, mas a apresentação vive no link, com animações e interações que um arquivo não carrega. Para quem precisa de um arquivo, o PDF resolve.' },
  { pergunta: 'Tem animação e transições?', resposta: 'Sim. Transições entre telas (fade, slide, scale e morph) com duração e easing ajustáveis, animações ligadas ao scroll no formato Story e interações sem código: clique, hover, hotspots, modais e estados. Tudo configurado em listas, com prévia na hora; não precisa programar.' },
  { pergunta: 'O Mostra é uma alternativa ao Gamma, ao Pitch ou ao Canva?', resposta: `Para quem apresenta em português e paga em reais, sim. Como o Gamma, gera a apresentação com IA a partir de um briefing; a diferença está no editor de canvas livre (camadas, grupos, guias e auto layout, como no Figma), na colagem direta do Figma e do Illustrator, nos três formatos (Slides, Story e Explorar) e nos links privados com senha e visualizações. Planos a partir de ${reais(PL.precoMensalBRL)} por mês, sem conversão de dólar.` },
  { pergunta: 'O cliente precisa criar conta para ver?', resposta: 'Não. Ele abre o link no navegador, no computador ou no celular. Se você ativar senha, só quem tiver a senha entra; você vê quantas vezes o link foi aberto e pode revogar quando quiser.' },
] as const satisfies readonly { pergunta: string; resposta: string }[]

/** Perguntas da página /precos (créditos, pacotes, cancelamento). */
export const FAQ_PRECOS = [
  { pergunta: 'O que é um crédito?', resposta: 'Um crédito é uma tela criada pela IA (roteiro e design juntos). Refazer uma tela ou adicionar uma nova com IA também custa 1 crédito. Reescrever ou traduzir o texto, trocar o estilo, as cores, o logo e reordenar são grátis. Editar, apresentar e compartilhar nunca consomem créditos.' },
  { pergunta: 'Os créditos expiram?', resposta: `Os créditos dos pacotes avulsos não expiram e valem em qualquer plano. Os créditos mensais do plano renovam todo mês; o que sobrar acumula até ${ACUMULO_MAXIMO}× a cota mensal.` },
  { pergunta: 'Posso trocar de plano ou cancelar quando quiser?', resposta: `Sim. Ao cancelar, seus projetos continuam acessíveis e a conta volta para os limites do plano Free (${F.limites.projetos} projetos). Nada é apagado.` },
  { pergunta: 'O plano anual tem desconto?', resposta: `Sim: ${Math.round(DESCONTO * 100)}% sobre o mensal. Plus ${reais(PL.precoAnualBRL)}, Pro ${reais(PR.precoAnualBRL)} e Studio ${reais(ST.precoAnualBRL)} por membro, por mês, cobrados uma vez ao ano.` },
  { pergunta: 'Preciso de cartão de crédito para começar?', resposta: `Não. O Free não pede cartão: ${F.creditos.quantidade} créditos no cadastro (${textoTelas(F.creditos.quantidade)}) e ${F.limites.projetos} projetos, para sempre.` },
] as const satisfies readonly { pergunta: string; resposta: string }[]

// ---------- Mostra × Gamma × Pitch × Canva ----------
/**
 * Comparação factual (buscadores e IAs citam tabelas): só o que é público e óbvio sobre os outros produtos
 * (sites oficiais, outubro de 2026). O que não dá para afirmar sai como `A_CONFIRMAR`, que a tabela mostra com
 * asterisco, em vez de inventar. Gamma, Pitch e Canva são marcas dos respectivos donos.
 */
export const A_CONFIRMAR = 'a confirmar'
export const CONCORRENTES = ['Mostra', 'Gamma', 'Pitch', 'Canva'] as const
export const COMPARATIVO: { rotulo: string; valores: [string, string, string, string] }[] = [
  { rotulo: 'Feito no Brasil, em português, com preços em reais', valores: ['Sim', 'Preços em dólar', 'Preços em dólar', 'Interface em português'] },
  { rotulo: 'Gera a apresentação com IA a partir de um briefing', valores: ['Sim', 'Sim', 'Sim', 'Sim'] },
  { rotulo: 'Editor de canvas livre: camadas, grupos, guias e auto layout', valores: ['Sim', 'Não (editor por blocos)', 'Sim', 'Sim'] },
  { rotulo: 'Cola do Figma e do Illustrator como camadas editáveis', valores: ['Sim', A_CONFIRMAR, A_CONFIRMAR, A_CONFIRMAR] },
  { rotulo: 'Formatos', valores: ['Slides, Story e Explorar', 'Apresentação, documento e página', 'Slides', 'Slides, documentos e sites'] },
  { rotulo: 'Animações entre telas com duração e easing ajustáveis', valores: ['Sim, inclusive morph', 'Transições prontas', 'Sim', 'Sim'] },
  { rotulo: 'Modelos 3D (GLB) e Lottie dentro da apresentação', valores: ['Sim', A_CONFIRMAR, A_CONFIRMAR, A_CONFIRMAR] },
  { rotulo: 'Link privado com senha, validade e visualizações', valores: ['Sim (senha a partir do Pro)', 'Link e analytics', 'Link e analytics', 'Link (senha: a confirmar)'] },
  { rotulo: 'Como a IA é cobrada', valores: ['1 crédito = 1 tela; pacotes não expiram', 'Créditos de IA', A_CONFIRMAR, 'Créditos de IA'] },
  { rotulo: 'Plano grátis', valores: [`Sim: ${F.creditos.quantidade} créditos e ${F.limites.projetos} projetos`, 'Sim', 'Sim', 'Sim'] },
]

// ---------- Rodapé ----------
/** `href: null` = página ainda não existe; o item aparece como texto. O rodapé também aparece fora da landing, por isso as âncoras levam "/". */
export const RODAPE: { titulo: string; links: { rotulo: string; href: string | null }[] }[] = [
  { titulo: 'Produto', links: [{ rotulo: 'Como funciona', href: '/#como' }, { rotulo: 'Formatos', href: '/#formatos' }, { rotulo: 'Recursos', href: '/#recursos' }, { rotulo: 'Planos e preços', href: '/precos' }] },
  { titulo: 'Guias', links: [{ rotulo: 'Apresentação com IA', href: '/apresentacao-com-ia' }, { rotulo: 'Alternativa ao Gamma', href: '/apresentacao-com-ia#gamma' }, { rotulo: 'Mostra × Gamma × Pitch × Canva', href: '/#comparativo' }, { rotulo: 'FAQ', href: '/#faq' }] },
  { titulo: 'Empresa', links: [{ rotulo: 'Sobre', href: null }, { rotulo: 'Contato', href: null }, { rotulo: 'Termos de uso', href: '/termos' }, { rotulo: 'Privacidade', href: '/privacidade' }] },
]

// ---------- formatação ----------
const NUM = new Intl.NumberFormat('pt-BR')
export const formatarNumero = (n: number) => NUM.format(n)
export const formatarReais = (n: number) => `R$${NUM.format(n)}`
