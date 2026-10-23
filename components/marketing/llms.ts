/**
 * /llms.txt e /llms-full.txt (padrão llmstxt.org): o produto descrito em Markdown simples para assistentes de IA
 * citarem com os números certos. Tudo vem de lib/planos.ts, lib/seo.ts e dados.ts; nada é escrito duas vezes.
 */
import { ACOES_IA, ACUMULO_MAXIMO, DESCONTO_ANUAL, LEITURA_PDF_CREDITOS, PACOTES_AVULSOS, PLANOS, ROTEIROS_GRATIS, custoApresentacao, formatarBytes } from '@/lib/planos'
import { MAX_TELAS_IA, MIN_TELAS_IA, textoTelas } from '@/lib/telasIa'
import { DEFINICAO, NOME, PAGINAS, absoluta } from '@/lib/seo'
import { COMPARATIVO, CONCORRENTES, FAQ, FAQ_PRECOS, FORMATOS, PASSOS, RECURSOS } from './dados'

const reais = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`
const linha = (celulas: string[]) => `| ${celulas.join(' | ')} |`

function tabelaPlanos(): string {
  const cab = linha(['Plano', 'Mensal', 'Anual (por mês)', 'Créditos', 'Projetos', 'Telas por apresentação com IA', 'Domínios próprios'])
  const sep = linha(Array(7).fill('---'))
  const linhas = Object.values(PLANOS).map((p) =>
    linha([
      p.nome,
      p.precoMensalBRL ? `${reais(p.precoMensalBRL)}${p.porMembro ? ' por membro' : ''}` : 'grátis',
      p.precoAnualBRL ? `${reais(p.precoAnualBRL)}${p.porMembro ? ' por membro' : ''}` : 'grátis',
      p.creditos.recorrencia === 'mensal' ? `${p.creditos.quantidade} por mês${p.porMembro ? ', por membro, compartilhados' : ''}` : `${p.creditos.quantidade} no cadastro`,
      p.limites.projetos > 1000 ? 'ilimitados' : String(p.limites.projetos),
      `até ${p.limites.telasPorPrompt}`,
      String(p.limites.dominios),
    ]),
  )
  return [cab, sep, ...linhas].join('\n')
}

/** Resumo curto: o que o site é, links e os fatos que mais se perguntam. */
export function llmsTxt(): string {
  const f = PLANOS.free
  return `# ${NOME}

> ${DEFINICAO}

${NOME} (${absoluta('/')}) é um produto brasileiro, em português do Brasil, com preços em reais. Público: designers, agências, times de vendas e founders que apresentam para clientes (propostas, pitches, relatórios, identidades visuais, campanhas, portfólios).

## Fatos principais

- Criar com IA: descreva o briefing (ou cole texto/PDF), escolha marca e estilo; a IA escreve o roteiro (grátis, até ${ROTEIROS_GRATIS} por apresentação) e desenha as telas no kit de marca. Apresentações de ${MIN_TELAS_IA} a ${MAX_TELAS_IA} telas.
- Créditos: 1 crédito = 1 tela criada pela IA (10 telas = ${custoApresentacao(10)} créditos). Editar, apresentar e compartilhar não consomem créditos.
- Planos: Free grátis (${f.creditos.quantidade} créditos no cadastro, ${f.limites.projetos} projetos); Plus ${reais(PLANOS.plus.precoMensalBRL)}/mês (${PLANOS.plus.creditos.quantidade} créditos/mês); Pro ${reais(PLANOS.pro.precoMensalBRL)}/mês (${PLANOS.pro.creditos.quantidade}); Studio ${reais(PLANOS.studio.precoMensalBRL)} por membro/mês (${PLANOS.studio.creditos.quantidade} por membro, compartilhados). Anual com ${Math.round(DESCONTO_ANUAL * 100)}% de desconto. Pacotes avulsos que não expiram: ${PACOTES_AVULSOS.map((p) => `${p.creditos} por ${reais(p.precoBRL)}`).join(', ')}.
- Editor: canvas livre com camadas, grupos, guias, grades e auto layout; cola do Figma e do Illustrator como camadas editáveis; SVG, imagens, vídeo, GIF, Lottie e modelos 3D (GLB).
- Formatos: ${FORMATOS.map((x) => x.rotulo).join(', ')}. Transições fade, slide, scale e morph; interações sem código.
- Compartilhamento: link privado, senha e validade (a partir do Pro), contagem de visualizações, revogação; o cliente não precisa de conta. Exporta PDF; não exporta PPTX.
- Colaboração em tempo real no plano Studio.

## Páginas

${PAGINAS.map((p) => `- [${p.caminho === '/' ? 'Início' : p.titulo}](${absoluta(p.caminho)}): ${p.descricao}`).join('\n')}
- [Descrição completa para IAs](${absoluta('/llms-full.txt')})

## Opcional

- [Sitemap](${absoluta('/sitemap.xml')})
`
}

/** Versão completa: planos, limites, custos de IA, recursos, formatos, comparativo e as duas FAQs. */
export function llmsFullTxt(): string {
  const planos = Object.values(PLANOS)
  return `# ${NOME} — descrição completa

> ${DEFINICAO}

Site: ${absoluta('/')} · Idioma: português do Brasil · Moeda: real (BRL) · Categoria: software de apresentações com IA (web).

## O que é

${NOME} gera e envia apresentações. A pessoa traz artes (Figma, Illustrator, Blender) ou pede para a IA montar a apresentação a partir de um briefing, ajusta num editor de canvas livre, publica e manda um link privado ao cliente; depois acompanha quantas vezes o link foi aberto. Não é um gerador de slides em blocos: cada tela é uma composição com camadas, grupos, guias e auto layout, editável depois da geração.

## Como funciona

${PASSOS.map((p) => `${p.n}. **${p.titulo}.** ${p.texto}`).join('\n')}

## Criar com IA

- Entrada: prompt, briefing colado, texto, PDF (texto extraído no navegador, sem custo) ou .docx. Páginas escaneadas podem ser lidas pela IA por ${LEITURA_PDF_CREDITOS.porPagina} créditos por página.
- Marca: logo enviado, paleta extraída do logo, paletas prontas, par de fontes (catálogo do Google Fonts) e kit de marca salvo. Lê o manual da marca (PDF, imagens, tokens JSON, CSS, tema de .pptx) sem IA.
- Estilo: estilos de composição com prévia real; trocar o estilo depois é grátis.
- Tamanho: de ${MIN_TELAS_IA} a ${MAX_TELAS_IA} telas (o limite depende do plano).
- Roteiro: grátis, até ${ROTEIROS_GRATIS} roteiros por apresentação; você edita e reordena antes de desenhar.
- Telas: montadas em auto layout no kit de marca; cada tela custa 1 crédito, cobrado quando a IA desenha.

### Custos de IA

${ACOES_IA.map((a) => `- ${a.rotulo}: ${a.creditos === 0 ? 'grátis' : `${a.creditos} ${a.creditos === 1 ? 'crédito' : 'créditos'}`}${a.id === 'apresentacao' ? ' (10 telas; 1 por tela)' : ''}${a.disponivel ? '' : ' — ainda indisponível'}`).join('\n')}
- Créditos mensais não usados acumulam até ${ACUMULO_MAXIMO}× a cota do plano. Pacotes avulsos não expiram.

## Planos e preços

${tabelaPlanos()}

Pacotes avulsos (não expiram, valem em qualquer plano): ${PACOTES_AVULSOS.map((p) => `${p.creditos} créditos por ${reais(p.precoBRL)} (${textoTelas(p.creditos)})`).join('; ')}.

Limites por plano: ${planos.map((p) => `${p.nome}: ${formatarBytes(p.limites.armazenamentoBytes)} de armazenamento, arquivos de até ${formatarBytes(p.limites.tamanhoArquivoBytes)}, ${p.limites.membros === 1 ? '1 pessoa' : `até ${p.limites.membros} membros`}`).join('; ')}.

Capacidades: senha no link e métricas de visualização a partir do Pro; marca própria e domínios próprios no Pro (${PLANOS.pro.limites.dominios}) e Studio (${PLANOS.studio.limites.dominios}); equipe e colaboração em tempo real no Studio; o Free mostra a marca Mostra na apresentação.

## Recursos

${RECURSOS.map((r) => `- **${r.titulo}.** ${r.texto}`).join('\n')}

## Formatos

${FORMATOS.map((f) => `- **${f.rotulo}.** ${f.descricao} (${f.pontos.join('; ')}.)`).join('\n')}

## Comparativo com Gamma, Pitch e Canva

Sobre os outros produtos, só o que está público nos sites oficiais em outubro de 2026; "a confirmar" marca o que não dá para afirmar.

${linha(['Critério', ...CONCORRENTES])}
${linha(Array(CONCORRENTES.length + 1).fill('---'))}
${COMPARATIVO.map((c) => linha([c.rotulo, ...c.valores])).join('\n')}

## Perguntas frequentes

${[...FAQ, ...FAQ_PRECOS].map((q) => `### ${q.pergunta}\n\n${q.resposta}`).join('\n\n')}

## Links

${PAGINAS.map((p) => `- ${p.caminho === '/' ? 'Início' : p.titulo}: ${absoluta(p.caminho)}`).join('\n')}
- Entrar: ${absoluta('/login')}
`
}
