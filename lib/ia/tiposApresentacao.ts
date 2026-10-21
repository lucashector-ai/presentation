/**
 * Tipos de apresentação que o "Criar com IA" sabe fazer, cada um com sua estrutura narrativa (arco):
 * a sequência de momentos que uma boa apresentação daquele tipo percorre, com o componente de tela de cada um.
 * O arco orienta o modelo (prompt do roteiro) e é a base do gerador local (modo demo).
 * Puro: sem rede, sem DOM.
 */
import type { TemaId, TipoTela } from './designSystem'

export const TIPOS_APRESENTACAO = ['pitch', 'proposta', 'projeto', 'relatorio', 'aula', 'portfolio', 'lancamento', 'case', 'evento', 'institucional', 'identidade', 'geral'] as const
export type TipoApresentacao = (typeof TIPOS_APRESENTACAO)[number]
/** "auto" = descobrir pelo pedido. */
export const TIPOS_PEDIDO = ['auto', ...TIPOS_APRESENTACAO] as const
export type TipoPedido = (typeof TIPOS_PEDIDO)[number]

export const TONS = ['profissional', 'inspirador', 'direto', 'didatico', 'descontraido', 'sofisticado'] as const
export type Tom = (typeof TONS)[number]
export const NOMES_TOM: Record<Tom, string> = { profissional: 'Profissional', inspirador: 'Inspirador', direto: 'Direto', didatico: 'Didático', descontraido: 'Descontraído', sofisticado: 'Sofisticado' }
export const DESCRICAO_TOM: Record<Tom, string> = {
  profissional: 'profissional: claro, seguro e cordial, sem jargão',
  inspirador: 'inspirador: frases que dão vontade de agir, com imagens concretas, sem exagero',
  direto: 'direto: frases curtas, verbos fortes, só o essencial',
  didatico: 'didático: explica passo a passo, com exemplos do dia a dia',
  descontraido: 'descontraído: leve e próximo, como uma conversa, sem gírias datadas',
  sofisticado: 'sofisticado: elegante e preciso, ritmo calmo, vocabulário cuidadoso',
}

/** Um momento do arco: o componente, o rótulo (kicker) e um texto-guia para o gerador local. */
export interface Momento {
  tipo: TipoTela
  rotulo: string
  titulo: string
  texto?: string
  itens?: string[]
  notas?: string
  /** Momentos essenciais entram mesmo em apresentações curtas. */
  essencial?: boolean
}

export interface DefinicaoTipo {
  nome: string
  descricao: string
  /** Palavras que indicam o tipo num pedido livre. */
  palavras: RegExp
  publico: string
  tom: Tom
  estilo: 'editorial' | 'ousado' | 'minimal'
  temas: TemaId[]
  /** Arco entre a capa e o encerramento, em ordem. */
  arco: Momento[]
  /** Fechamento (última tela). */
  fim: Momento
}

const m = (tipo: TipoTela, rotulo: string, titulo: string, extra: Omit<Momento, 'tipo' | 'rotulo' | 'titulo'> = {}): Momento => ({ tipo, rotulo, titulo, ...extra })

export const TIPOS: Record<TipoApresentacao, DefinicaoTipo> = {
  pitch: {
    nome: 'Pitch para investidores', descricao: 'problema, solução, mercado, tração, modelo de negócio, time e o pedido',
    palavras: /pitch|investidor|startup|rodada|seed|s[eé]rie a|capta[cç][aã]o|aceleradora/i,
    publico: 'investidores', tom: 'direto', estilo: 'ousado', temas: ['grafite', 'noturno', 'mare'],
    arco: [
      m('conceito', 'O problema', 'Um problema caro que ninguém resolveu bem', { texto: 'Quem sofre com ele, com que frequência e quanto custa hoje.', notas: 'Comece por uma história real de um cliente. Mostre a dor antes da solução.', essencial: true }),
      m('conceito', 'A solução', 'Nossa resposta em uma frase', { texto: 'O que o produto faz e por que é diferente do que existe.', notas: 'Uma frase só. Se precisar de duas, ainda não está clara.', essencial: true }),
      m('processo', 'Como funciona', 'Três passos até o resultado', { itens: ['Conecta|o cliente liga a conta em minutos', 'Analisa|o sistema encontra o que melhorar', 'Entrega|o resultado aparece no primeiro mês'], notas: 'Mostre o produto em uso, sem detalhes técnicos.' }),
      m('numeros', 'Mercado · exemplo', 'Um mercado grande e crescendo', { itens: ['R$ 12 bi|mercado endereçável', '18%|crescimento ao ano', '40 mil|empresas no público-alvo'], notas: 'Números de exemplo: troque pelos seus, com a fonte.' }),
      m('grafico', 'Tração · exemplo', 'Crescimento mês a mês', { itens: ['120|Jan', '210|Fev', '380|Mar', '640|Abr'], notas: 'Dados de exemplo: troque pelos seus clientes ou receita reais.', essencial: true }),
      m('cartoes', 'Modelo de negócio', 'Como ganhamos dinheiro', { itens: ['Assinatura|mensal por empresa', 'Serviços|implantação e treinamento', 'Parcerias|revenda por canais'], notas: 'Diga quem paga, quanto e com que frequência.' }),
      m('comparacao', 'Concorrência', 'Por que vamos ganhar', { itens: ['Hoje', 'Com a gente', 'Planilhas e processos manuais', 'Tudo automático e em um lugar', 'Semanas para ver resultado', 'Resultado no primeiro mês'] }),
      m('equipe', 'Time', 'Quem está construindo', { itens: ['Nome Sobrenome|CEO', 'Nome Sobrenome|CTO', 'Nome Sobrenome|Produto'], notas: 'Mostre por que este time é o certo para este problema.' }),
      m('cta', 'O pedido', 'Estamos captando para crescer', { texto: 'Quanto, para quê e em quanto tempo.', itens: ['Agendar conversa', 'E-mail|seu@email.com'], notas: 'Seja direto sobre valor, uso dos recursos e marcos.', essencial: true }),
    ],
    fim: m('encerramento', 'Obrigado', 'Obrigado', { texto: 'seu@email.com', notas: 'Repita o pedido e abra para perguntas.' }),
  },
  proposta: {
    nome: 'Proposta comercial', descricao: 'contexto do cliente, desafio, abordagem, entregas, cronograma, investimento e próximos passos',
    palavras: /proposta|or[cç]amento|cliente|servi[cç]o|consultoria|ag[eê]ncia|est[uú]dio/i,
    publico: 'o cliente', tom: 'profissional', estilo: 'editorial', temas: ['argila', 'corporativo', 'nevoa'],
    arco: [
      m('conceito', 'O contexto', 'Onde vocês estão hoje', { texto: 'O que entendemos do momento da empresa e do que está em jogo.', notas: 'Mostre que você ouviu o cliente antes de propor.', essencial: true }),
      m('conceito', 'O desafio', 'O que precisa mudar', { texto: 'O objetivo da proposta, em uma frase que o cliente assinaria.', essencial: true }),
      m('processo', 'Nossa abordagem', 'Como vamos trabalhar', { itens: ['Diagnóstico|entrevistas e análise do cenário', 'Conceito|caminhos criativos e escolha', 'Entrega|produção, ajustes e lançamento'], essencial: true }),
      m('cartoes', 'Entregas', 'O que você recebe', { itens: ['Estratégia|posicionamento e mensagem', 'Identidade|marca e aplicações', 'Lançamento|plano e peças de estreia'] }),
      m('linhaTempo', 'Cronograma', 'Seis semanas do início ao fim', { itens: ['Semana 1|Kick-off e diagnóstico', 'Semana 3|Apresentação do conceito', 'Semana 5|Ajustes e produção', 'Semana 6|Entrega final'] }),
      m('precos', 'Investimento', 'Opções de investimento', { itens: ['Essencial|R$ 0.000|Estratégia; Identidade', 'Completo|R$ 0.000|Estratégia; Identidade; Lançamento', 'Contínuo|R$ 0.000/mês|Tudo do Completo; Acompanhamento mensal'], notas: 'Valores de exemplo: preencha com os seus.', essencial: true }),
      m('citacao', 'Quem já trabalhou com a gente', '“Uma frase de um cliente sobre o resultado do trabalho.”', { texto: 'Nome, cargo e empresa' }),
      m('cta', 'Próximo passo', 'Vamos começar?', { texto: 'Aprovação da proposta e agendamento do kick-off.', itens: ['Aprovar proposta', 'E-mail|seu@email.com'] }),
    ],
    fim: m('encerramento', 'Obrigado', 'Obrigado', { texto: 'seu@email.com · (11) 90000-0000' }),
  },
  projeto: {
    nome: 'Plano de projeto', descricao: 'objetivo, escopo, etapas, cronograma, equipe, riscos e próximos passos',
    palavras: /projeto|plano|escopo|cronograma|kick-?off|implanta[cç][aã]o|roadmap/i,
    publico: 'a equipe e os patrocinadores do projeto', tom: 'profissional', estilo: 'editorial', temas: ['corporativo', 'nevoa', 'salvia'],
    arco: [
      m('agenda', 'Agenda', 'O que vamos ver', { itens: ['Objetivo', 'Escopo', 'Cronograma', 'Equipe e próximos passos'] }),
      m('conceito', 'Objetivo', 'O que este projeto vai mudar', { texto: 'O resultado esperado e como vamos saber que deu certo.', essencial: true }),
      m('comparacao', 'Escopo', 'O que entra e o que fica de fora', { itens: ['Dentro do escopo', 'Fora do escopo', 'Item incluído', 'Item que fica para depois', 'Outro item incluído', 'Outro item fora'], essencial: true }),
      m('processo', 'Etapas', 'Como o trabalho se organiza', { itens: ['Descoberta|levantamento e alinhamento', 'Construção|desenvolvimento em ciclos curtos', 'Entrega|testes, ajustes e implantação'] }),
      m('linhaTempo', 'Cronograma', 'Marcos principais', { itens: ['Mês 1|Descoberta concluída', 'Mês 2|Primeira versão', 'Mês 3|Testes com usuários', 'Mês 4|Lançamento'], essencial: true }),
      m('equipe', 'Equipe', 'Quem faz o quê', { itens: ['Nome Sobrenome|Gestão do projeto', 'Nome Sobrenome|Design', 'Nome Sobrenome|Desenvolvimento'] }),
      m('lista', 'Riscos', 'O que pode atrasar e como evitar', { itens: ['Dependências de outras áreas: alinhar no kick-off', 'Mudanças de escopo: passar pelo comitê', 'Dados incompletos: validar na primeira semana'] }),
      m('cta', 'Próximos passos', 'O que precisamos decidir hoje', { itens: ['Aprovar o plano', 'Responsável|nome@empresa.com'] }),
    ],
    fim: m('encerramento', 'Obrigado', 'Perguntas?', { texto: 'nome@empresa.com' }),
  },
  relatorio: {
    nome: 'Relatório de resultados', descricao: 'resumo, números do período, o que funcionou, o que não funcionou, aprendizados e próximos passos',
    palavras: /relat[oó]rio|resultado|trimestr|mensal|anual|balan[cç]o|desempenho|kpi|m[eé]tricas/i,
    publico: 'a diretoria', tom: 'profissional', estilo: 'minimal', temas: ['corporativo', 'papel', 'nevoa'],
    arco: [
      m('conceito', 'Resumo', 'O período em uma frase', { texto: 'O principal resultado e o que ele significa para a empresa.', essencial: true }),
      m('numeros', 'Destaques · exemplo', 'Os números do período', { itens: ['+24%|receita frente ao período anterior', '92%|clientes satisfeitos', '3,1 mi|usuários ativos'], notas: 'Números de exemplo: troque pelos reais e cite a fonte.', essencial: true }),
      m('grafico', 'Evolução · exemplo', 'Receita por trimestre', { itens: ['3,2|T1', '3,6|T2', '4,1|T3', '4,8|T4'], notas: 'Dados de exemplo.' }),
      m('cartoes', 'O que funcionou', 'O que deu certo', { itens: ['Canal novo|trouxe um terço das vendas', 'Atendimento|tempo de resposta caiu pela metade', 'Produto|nova versão reduziu cancelamentos'] }),
      m('comparacao', 'Meta e realizado', 'Onde ficamos abaixo', { itens: ['Meta', 'Realizado', 'Indicador A: 100', 'Indicador A: 86', 'Indicador B: 50', 'Indicador B: 52'], essencial: true }),
      m('lista', 'Aprendizados', 'O que aprendemos', { itens: ['Primeiro aprendizado do período', 'Segundo aprendizado do período', 'Terceiro aprendizado do período'] }),
      m('linhaTempo', 'Próximo período', 'Prioridades e prazos', { itens: ['Jan|Prioridade um', 'Fev|Prioridade dois', 'Mar|Prioridade três'] }),
    ],
    fim: m('encerramento', 'Perguntas', 'Perguntas e próximos passos', { texto: 'nome@empresa.com' }),
  },
  aula: {
    nome: 'Aula ou treinamento', descricao: 'objetivos, conceitos em passos, exemplos, prática, resumo e próximos passos',
    palavras: /aula|curso|treinamento|workshop|oficina|palestra|ensinar|alunos|turma|educa/i,
    publico: 'alunos', tom: 'didatico', estilo: 'editorial', temas: ['ipe', 'salvia', 'mare'],
    arco: [
      m('agenda', 'Hoje', 'O que vamos aprender', { itens: ['O que é', 'Como funciona', 'Na prática', 'Resumo'], essencial: true }),
      m('conceito', 'Por que importa', 'Por que isso importa para você', { texto: 'Uma situação do dia a dia em que este assunto faz diferença.' }),
      m('secao', 'Parte 1', 'O que é', { texto: 'O conceito, sem jargão.' }),
      m('cartoes', 'Conceitos-chave', 'Três ideias para guardar', { itens: ['Ideia um|explicação curta com exemplo', 'Ideia dois|explicação curta com exemplo', 'Ideia três|explicação curta com exemplo'], essencial: true }),
      m('processo', 'Passo a passo', 'Como fazer', { itens: ['Observe|o que acontece hoje', 'Teste|uma mudança pequena', 'Compare|o antes e o depois'] }),
      m('imagem', 'Exemplo', 'Um exemplo real', { texto: 'Uma foto, print ou diagrama que mostre o conceito funcionando.' }),
      m('lista', 'Prática', 'Agora é com você', { itens: ['Exercício um', 'Exercício dois', 'Exercício três'], notas: 'Dê alguns minutos e circule pela sala.' }),
      m('lista', 'Resumo', 'Para levar daqui', { itens: ['Primeira ideia principal', 'Segunda ideia principal', 'Terceira ideia principal'], essencial: true }),
    ],
    fim: m('encerramento', 'Dúvidas', 'Dúvidas?', { texto: 'Material e contato: seu@email.com' }),
  },
  portfolio: {
    nome: 'Portfólio', descricao: 'quem é você, como trabalha, projetos com contexto e resultado, serviços e contato',
    palavras: /portf[oó]lio|cases?|trabalhos|freela|diretor[a]? de arte|designer|fot[oó]graf/i,
    publico: 'potenciais clientes', tom: 'sofisticado', estilo: 'minimal', temas: ['papel', 'nevoa', 'argila'],
    arco: [
      m('conceito', 'Sobre', 'Design que resolve problemas de negócio', { texto: 'Quem você é, sua especialidade e o tipo de cliente que atende.', essencial: true }),
      m('galeria', 'Projetos', 'Trabalhos selecionados', { itens: ['Projeto um|identidade visual', 'Projeto dois|campanha', 'Projeto três|produto digital', 'Projeto quatro|editorial'], essencial: true }),
      m('imagem', 'Projeto em destaque', 'Projeto um', { texto: 'Cliente, ano, o desafio e o resultado.', notas: 'Fale do problema e do resultado, não só da estética.', essencial: true }),
      m('imagem', 'Projeto em destaque', 'Projeto dois', { texto: 'Cliente, ano, o desafio e o resultado.' }),
      m('processo', 'Como eu trabalho', 'Do briefing à entrega', { itens: ['Escuta|entender o negócio', 'Criação|caminhos e escolha', 'Entrega|arquivos e acompanhamento'] }),
      m('cartoes', 'Serviços', 'O que eu faço', { itens: ['Identidade visual|marcas do zero ou redesenho', 'Direção de arte|campanhas e conteúdo', 'Produto digital|sites e aplicativos'] }),
      m('citacao', 'Clientes', '“Uma frase de um cliente sobre trabalhar com você.”', { texto: 'Nome, cargo e empresa' }),
    ],
    fim: m('encerramento', 'Contato', 'Vamos conversar?', { texto: 'seu@email.com · @seuperfil' }),
  },
  lancamento: {
    nome: 'Lançamento de produto', descricao: 'a novidade, para quem é, o que muda, recursos, como funciona, preço e disponibilidade',
    palavras: /lan[cç]amento|lan[cç]ar|novo produto|nova vers[aã]o|release|novidade|apresentamos/i,
    publico: 'clientes e imprensa', tom: 'inspirador', estilo: 'ousado', temas: ['noturno', 'mare', 'lima'],
    arco: [
      m('conceito', 'A novidade', 'Conheça o novo produto', { texto: 'O que é, em uma frase, e o que ele muda na vida de quem usa.', essencial: true }),
      m('imagem', 'O produto', 'Feito para o seu dia a dia', { texto: 'Foto ou render do produto em uso.', essencial: true }),
      m('cartoes', 'Recursos', 'O que ele faz', { itens: ['Rápido|faz em minutos o que levava horas', 'Simples|pronto para usar, sem manual', 'Seguro|seus dados protegidos de ponta a ponta'], essencial: true }),
      m('comparacao', 'O que muda', 'Antes e depois', { itens: ['Antes', 'Agora', 'Várias ferramentas', 'Tudo em um só lugar', 'Horas de trabalho', 'Minutos'] }),
      m('processo', 'Como funciona', 'Comece em três passos', { itens: ['Baixe|disponível para web e celular', 'Configure|em menos de cinco minutos', 'Use|e veja o resultado no primeiro dia'] }),
      m('precos', 'Preços', 'Escolha seu plano', { itens: ['Grátis|R$ 0|Recursos essenciais; 1 usuário', 'Pro|R$ 00/mês|Tudo do Grátis; Recursos avançados', 'Empresas|Sob consulta|Tudo do Pro; Suporte dedicado'], notas: 'Valores de exemplo.' }),
      m('cta', 'Disponível', 'Disponível a partir de hoje', { texto: 'Onde comprar, baixar ou testar.', itens: ['Experimentar agora', 'Site|seusite.com.br'], essencial: true }),
    ],
    fim: m('encerramento', 'Obrigado', 'Obrigado', { texto: 'seusite.com.br' }),
  },
  case: {
    nome: 'Estudo de caso', descricao: 'cliente, desafio, abordagem, solução, resultados com números e depoimento',
    palavras: /estudo de caso|case de|caso de sucesso|como ajudamos|resultado para o cliente/i,
    publico: 'potenciais clientes', tom: 'profissional', estilo: 'editorial', temas: ['papel', 'corporativo', 'argila'],
    arco: [
      m('conceito', 'O cliente', 'Quem é o cliente', { texto: 'Setor, tamanho e o momento em que nos procurou.', essencial: true }),
      m('conceito', 'O desafio', 'O problema que precisava de solução', { texto: 'O que estava em jogo e por que as tentativas anteriores não funcionaram.', essencial: true }),
      m('processo', 'A abordagem', 'Como resolvemos', { itens: ['Diagnóstico|ouvimos clientes e equipe', 'Solução|desenhamos e testamos', 'Implantação|lançamos em etapas'] }),
      m('imagem', 'A solução', 'O que foi entregue', { texto: 'Imagem da solução em uso.' }),
      m('numeros', 'Resultados · exemplo', 'Resultados em seis meses', { itens: ['+45%|conversão', '−30%|custo de atendimento', '4,8|nota dos clientes'], notas: 'Números de exemplo: troque pelos do cliente, com autorização.', essencial: true }),
      m('citacao', 'Depoimento', '“O que o cliente disse sobre o resultado.”', { texto: 'Nome, cargo e empresa' }),
      m('lista', 'Aprendizados', 'O que levamos para outros projetos', { itens: ['Primeiro aprendizado', 'Segundo aprendizado', 'Terceiro aprendizado'] }),
    ],
    fim: m('encerramento', 'Contato', 'Quer um resultado assim?', { texto: 'seu@email.com' }),
  },
  evento: {
    nome: 'Evento', descricao: 'o evento, por que participar, programação, palestrantes, local e data, inscrição ou patrocínio',
    palavras: /evento|festival|confer[eê]ncia|congresso|meetup|semana|feira|show|patroc/i,
    publico: 'participantes e patrocinadores', tom: 'inspirador', estilo: 'ousado', temas: ['lima', 'mare', 'ameixa'],
    arco: [
      m('conceito', 'O evento', 'Dois dias para quem faz o futuro', { texto: 'O que é, para quem é e o que torna esta edição única.', essencial: true }),
      m('numeros', 'Em números · exemplo', 'A edição anterior', { itens: ['3 mil|participantes', '40|palestras', '96%|voltariam'], notas: 'Números de exemplo.' }),
      m('linhaTempo', 'Programação', 'Programação', { itens: ['09h|Abertura', '10h|Palestra principal', '14h|Oficinas', '18h|Encerramento e festa'], essencial: true }),
      m('equipe', 'Palestrantes', 'Quem vai estar no palco', { itens: ['Nome Sobrenome|tema da palestra', 'Nome Sobrenome|tema da palestra', 'Nome Sobrenome|tema da palestra', 'Nome Sobrenome|tema da palestra'] }),
      m('imagem', 'O lugar', 'Local e data', { texto: 'Endereço, data e como chegar.', essencial: true }),
      m('precos', 'Ingressos', 'Garanta seu lugar', { itens: ['Lote 1|R$ 000|Acesso aos dois dias', 'VIP|R$ 000|Acesso total; Área exclusiva; Kit'], notas: 'Valores de exemplo.' }),
      m('cta', 'Inscrições', 'Inscrições abertas', { itens: ['Quero participar', 'Site|seuevento.com.br'] }),
    ],
    fim: m('encerramento', 'Até lá', 'Até lá', { texto: 'seuevento.com.br' }),
  },
  institucional: {
    nome: 'Apresentação institucional', descricao: 'quem somos, o que fazemos, como fazemos, números, clientes, equipe e contato',
    palavras: /institucional|quem somos|nossa empresa|sobre a empresa|apresenta[cç][aã]o da empresa|empresa de/i,
    publico: 'clientes e parceiros', tom: 'profissional', estilo: 'editorial', temas: ['corporativo', 'nevoa', 'mare'],
    arco: [
      m('conceito', 'Quem somos', 'Uma frase sobre o que nos move', { texto: 'Há quanto tempo existimos, onde atuamos e para quem.', essencial: true }),
      m('cartoes', 'O que fazemos', 'Nossas frentes', { itens: ['Frente um|o que entregamos', 'Frente dois|o que entregamos', 'Frente três|o que entregamos'], essencial: true }),
      m('numeros', 'Em números · exemplo', 'Alguns números', { itens: ['15 anos|de mercado', '300+|clientes atendidos', '8|cidades'], notas: 'Números de exemplo.' }),
      m('processo', 'Como trabalhamos', 'Nosso jeito de trabalhar', { itens: ['Escutar|entender o desafio', 'Propor|soluções sob medida', 'Acompanhar|do início ao resultado'] }),
      m('galeria', 'Clientes', 'Quem confia na gente', { itens: ['Cliente um|setor', 'Cliente dois|setor', 'Cliente três|setor'] }),
      m('equipe', 'Liderança', 'Quem lidera', { itens: ['Nome Sobrenome|Diretora', 'Nome Sobrenome|Diretor', 'Nome Sobrenome|Gerente'] }),
    ],
    fim: m('encerramento', 'Contato', 'Vamos trabalhar juntos?', { texto: 'contato@empresa.com · empresa.com.br' }),
  },
  identidade: {
    nome: 'Identidade visual', descricao: 'ponto de partida, conceito, logotipo, paleta, tipografia, aplicações e próximos passos',
    palavras: /identidade|marca|branding|logo|rebrand|logotipo/i,
    publico: 'o cliente', tom: 'sofisticado', estilo: 'editorial', temas: ['argila', 'ameixa', 'papel'],
    arco: [
      m('conceito', 'Ponto de partida', 'O que a marca precisa dizer', { texto: 'O problema que a identidade resolve, em uma frase.', notas: 'Comece pelo porquê, antes de mostrar qualquer forma.', essencial: true }),
      m('secao', 'Conceito', 'A ideia que guia tudo', { texto: 'De onde vem a ideia e como ela vira forma.', essencial: true }),
      m('imagem', 'Logotipo', 'O símbolo', { texto: 'O logotipo e suas versões.', essencial: true }),
      m('paleta', 'Cores', 'Paleta', { itens: ['Principal|#B4532A', 'Fundo|#EEE7DB', 'Apoio|#A7B29A', 'Tinta|#2B1D16'], notas: 'Explique de onde vêm as cores e como se combinam.' }),
      m('tipografia', 'Tipografia', 'Tipografia', { notas: 'Mostre a hierarquia: títulos, textos e números.' }),
      m('galeria', 'Aplicações', 'A marca no mundo', { itens: ['Embalagem|frente e verso', 'Sinalização|fachada', 'Digital|redes e site', 'Papelaria|cartão e papel'] }),
      m('lista', 'Próximos passos', 'Próximos passos', { itens: ['Aprovação do conceito', 'Manual da marca', 'Aplicações prioritárias'], notas: 'Feche com o que precisa ser decidido hoje.' }),
    ],
    fim: m('encerramento', 'Obrigado', 'Obrigado', { texto: 'contato@estudio.com' }),
  },
  geral: {
    nome: 'Outro assunto', descricao: 'contexto, ideia central, pontos principais, exemplo, comparação, plano e fechamento',
    palavras: /$^/,
    publico: '', tom: 'profissional', estilo: 'editorial', temas: ['nevoa', 'argila', 'mare'],
    arco: [
      m('conceito', 'Contexto', 'Onde estamos e por que isso importa', { texto: 'O cenário em poucas palavras.', notas: 'Situe a plateia antes de propor qualquer coisa.', essencial: true }),
      m('secao', 'A proposta', 'A ideia central', { texto: 'O que muda, em uma frase.', essencial: true }),
      m('cartoes', 'Pontos principais', 'Três pontos para guardar', { itens: ['Primeiro ponto|uma frase de explicação', 'Segundo ponto|uma frase de explicação', 'Terceiro ponto|uma frase de explicação'], essencial: true }),
      m('imagem', 'Exemplo', 'Como fica na prática', { texto: 'Uma imagem que mostre o resultado.' }),
      m('comparacao', 'Hoje e depois', 'Hoje e depois', { itens: ['Hoje', 'Depois', 'Como é agora', 'Como fica'] }),
      m('linhaTempo', 'Plano', 'Os próximos passos', { itens: ['Etapa 1|Primeiro passo', 'Etapa 2|Segundo passo', 'Etapa 3|Terceiro passo'] }),
      m('citacao', 'Para fechar', '“Uma frase que resume tudo.”', { texto: 'Quem disse' }),
    ],
    fim: m('encerramento', 'Obrigado', 'Obrigado', { texto: 'seu@email.com' }),
  },
}

/** Reconhece o tipo num pedido livre (o primeiro que casar, na ordem de especificidade). */
export function tipoDoPedido(texto: string): TipoApresentacao {
  const ordem: TipoApresentacao[] = ['case', 'pitch', 'portfolio', 'identidade', 'relatorio', 'aula', 'evento', 'lancamento', 'projeto', 'institucional', 'proposta']
  return ordem.find((t) => TIPOS[t].palavras.test(texto)) ?? 'geral'
}

/** Arco resumido para o prompt do roteiro: "pitch: conceito (O problema) → …". */
export function arcoResumido(t: TipoApresentacao): string {
  const d = TIPOS[t]
  return ['capa', ...d.arco.map((x) => `${x.tipo} (${x.rotulo.replace(/ · exemplo$/, '')})`), `${d.fim.tipo}`].join(' → ')
}
