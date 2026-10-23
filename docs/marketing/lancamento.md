# Plano de lançamento — Mostra (mostra.page)

Quatro semanas: duas de preparação, uma de lançamento, uma de consolidação. Tudo que precisa de número que ainda não existe está marcado como [preencher]. Números de produto (créditos, preços, limites) vêm de `lib/planos.ts` e já estão certos aqui.

**Posicionamento em uma frase:** Mostra é a plataforma brasileira para criar apresentações com IA e um editor de nível profissional: animações, interações, 3D, importação do Figma e links privados, sem escrever código.

**Promessa para cada público**

| Público | O que ele ganha | Prova |
| --- | --- | --- |
| Designers e diretores de arte | Precisão de Figma numa apresentação que se move | Cola do Figma e do Illustrator vira camadas editáveis; morph; 3D (GLB) |
| Agências e estúdios | Proposta na marca do cliente em minutos, com a equipe editando junto | Kit de marca (logo, paleta, fontes), Studio com créditos compartilhados e edição em tempo real |
| Vendas e consultorias | Proposta por link com senha, e saber se o cliente abriu | Links privados, validade, visualizações, atualização no mesmo link |
| Founders | Pitch com roteiro em minutos e telas na identidade da empresa | Criar com IA: briefing → roteiro (grátis) → telas (1 crédito cada) |

**Oferta de lançamento:** o próprio Free. 50 créditos no cadastro (≈ 50 telas com IA: 5 apresentações de 10 telas ou 2 de 20), 3 projetos, sem cartão. Não inventar cupom: o Free já é a oferta.

---

## Semana 1 — Fundação (pré-lançamento)

Objetivo: tudo pronto para alguém chegar do zero e sair com um link enviado.

- [ ] Domínio mostra.page no ar com HTTPS, landing, /precos e /apresentacao-com-ia (feito neste repositório).
- [ ] Search Console e Bing Webmaster verificados; sitemap enviado (passo a passo em `seo-geo.md`).
- [ ] Open Graph testado no LinkedIn Post Inspector, no X Card Validator e no WhatsApp (mandar o link para si mesmo).
- [ ] Vídeo de 45 s da tela: briefing → roteiro → telas → link (roteiro 1 de `instagram-tiktok.md`). É o ativo que roda em todo canal.
- [ ] 3 apresentações públicas de exemplo, feitas no Mostra, uma por público (proposta de agência, pitch, resultados comerciais). Links reais em /p/.
- [ ] Página do Product Hunt preparada (`product-hunt.md`): tagline, galeria (5 imagens 1270×760), vídeo, primeiro comentário.
- [ ] Perfis criados e com a mesma bio: LinkedIn (página), Instagram, X/Threads, TikTok, YouTube. Handle sugerido: @mostrapage [confirmar disponibilidade].
- [ ] Lista de 30 pessoas para o acesso antecipado: designers, donos de agência, vendedores B2B e founders que você conhece. Mensagem direta, pedindo uso real e feedback, não "apoio".
- [ ] E-mails de boas-vindas (4) e de lançamento prontos (`email.md`); remetente e domínio de envio autenticados (SPF, DKIM, DMARC) [preencher ferramenta].
- [ ] Analytics mínimo definido: eventos de cadastro, primeira apresentação gerada, primeiro link publicado, primeira abertura por cliente. Sem scripts de terceiros na landing; os eventos vêm do backend.

## Semana 2 — Acesso antecipado

Objetivo: 30 pessoas usando de verdade, bugs corrigidos, 10 frases reais para usar depois (com autorização).

- [ ] Liberar o acesso para a lista. Acompanhar cada pessoa: ela gerou? publicou? o cliente abriu?
- [ ] Pedir permissão por escrito para citar nome, cargo e empresa de quem topar. Sem depoimento inventado, nunca.
- [ ] Publicar os primeiros 2 posts do LinkedIn (`linkedin.md`: bastidor do editor e créditos e preço). Não anunciar o lançamento ainda.
- [ ] Postar 2 vídeos curtos (Instagram/TikTok): "cole do Figma" e "1 crédito = 1 tela".
- [ ] Medir o funil: cadastro → gerou → publicou → aberto. Se "gerou → publicou" estiver abaixo de 50%, o problema é produto, não divulgação; corrigir antes da semana 3.
- [ ] Enviar o press kit (`press-kit.md`) para 10 veículos e newsletters de design, marketing e startups [preencher lista], oferecendo acesso e uma entrevista.

## Semana 3 — Lançamento

Dia D sugerido: terça ou quarta. Product Hunt abre às 00h01 PT (04h01 em Brasília): agendar.

**Véspera**
- [ ] Mensagem para os 30 do acesso antecipado: "amanhã às X horas, se o Mostra te ajudou, conta isso no Product Hunt e no LinkedIn com suas palavras".
- [ ] Posts agendados: LinkedIn (lançamento), X (thread 1), Instagram (carrossel 1), e-mail de lançamento para toda a base.
- [ ] Monitoramento: alguém de olho em erros, cadastros e e-mails de suporte durante o dia inteiro.

**Dia D**
- 04h01 — Product Hunt no ar. Primeiro comentário do maker publicado na hora.
- 07h30 — LinkedIn: post de lançamento. X: thread 1. Instagram/TikTok: vídeo 1 + stories com link.
- 09h00 — E-mail de lançamento para a base.
- 10h00 — WhatsApp e Telegram em grupos onde você participa de verdade (não entrar em grupo para spammar).
- Dia inteiro — responder todo comentário em até 30 minutos. Respostas prontas em `product-hunt.md`.
- 18h00 — Stories com os números do dia (cadastros, apresentações geradas) se forem bons; se não forem, agradecer e seguir.

**D+1 a D+5**
- [ ] LinkedIn: comparação com Gamma (D+1), caso Nexora (D+3).
- [ ] X: threads 2 e 3.
- [ ] Vídeos 3, 4 e 5.
- [ ] Responder quem comentou nos perfis e no PH com uma pergunta de volta ("o que você apresenta hoje e como?"); vira entrevista de usuário.

## Semana 4 — Consolidação

- [ ] Resumo público do lançamento (post no LinkedIn): o que funcionou, números reais, o que vem a seguir. Honestidade converte melhor que hype.
- [ ] Primeira rodada de SEO pós-lançamento: Search Console → páginas indexadas, consultas que apareceram; ajustar títulos e descrições com base nas consultas reais (`seo-geo.md`, checklist mensal).
- [ ] Perguntar ao ChatGPT, ao Perplexity, ao Gemini e ao Claude: "alternativa ao Gamma em português", "como fazer apresentação com IA em português", "quanto custa o Mostra". Registrar se e como o Mostra aparece (GEO).
- [ ] Carrosséis 2 e 3; e-mail 4 (upgrade) começa a disparar para quem usou mais de 70% dos créditos.
- [ ] Decidir o próximo ciclo com base em dados: qual público converteu mais em Plus/Pro? Dobrar a aposta nele.

---

## Canais e papel de cada um

| Canal | Papel | Frequência pós-lançamento |
| --- | --- | --- |
| LinkedIn (perfil do fundador + página) | Principal: agências, vendas, founders | 3 posts/semana |
| Instagram + TikTok | Mostrar o editor em movimento; designers | 3 vídeos/semana |
| X/Threads | Comunidade de produto e design, lançamentos | 1 thread/semana + respostas |
| Product Hunt | Pico de atenção e backlinks | Uma vez |
| E-mail | Ativação e upgrade | Automático + 1 novidade/mês |
| SEO + GEO | Demanda constante: "apresentação com IA", "alternativa ao Gamma" | Revisão mensal |
| Comunidades (Discord/Slack de design, grupos de agências) | Onde você já participa | Quando tiver algo útil |

## Métricas

**Norte:** apresentações publicadas (link gerado) por semana. É o momento em que o produto cumpriu a promessa.

| Métrica | Meta semana 3 | Como medir |
| --- | --- | --- |
| Cadastros | [preencher] | backend |
| Cadastro → primeira apresentação gerada | ≥ 60% | backend (evento) |
| Gerada → link publicado | ≥ 50% | backend |
| Link aberto pelo cliente em 7 dias | ≥ 40% dos links | backend (visualizações) |
| Free → pago em 30 dias | [preencher] (referência de mercado: 2–5%) | billing [preencher ferramenta] |
| Product Hunt | top 5 do dia | PH |
| Search Console | 3 páginas indexadas; impressões para "apresentação com IA" | GSC |
| Citações em IA | Mostra citado em ≥ 1 das 4 respostas de teste | manual, mensal |

## O que não fazer

- Não comprar seguidores, votos ou avaliações.
- Não prometer PPTX, HTML offline ou métricas por tela: não existem hoje (PDF existe).
- Não comparar com números dos concorrentes que você não verificou. A tabela da landing usa "a confirmar" para isso; os posts também.
- Não usar depoimento, logo de cliente ou prêmio que não seja real e autorizado.
