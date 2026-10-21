# Economia da IA: custo por ação, créditos e planos

Fonte única dos números: `lib/ia/economia.ts` (estimativas de tokens e contas) e `lib/planos.ts` (preços em créditos e planos). O teste `lib/ia/economia.test.ts` falha se algum preço em créditos deixar de cobrir o custo estimado com folga, ou se algum plano passar do teto de custo de IA. Ao mudar modelo, prompt ou preço, rode `npx vitest run lib/ia/economia.test.ts` e atualize esta página.


## Modelo atual (21/10/2026): 1 crédito = 1 tela

Decidido com o dono depois do teste lado a lado em produção (mesmo roteiro de 10 telas desenhado com Opus e com Sonnet: resultado visual equivalente, porque o layout vem do design system; o Sonnet custou metade). O design passou para o **Sonnet 5.5**; o Opus fica como qualidade "premium" opcional (`qualidade: 'premium'` no pedido de `/api/ai/design`, sem interface ainda).

| Ação | Créditos |
|---|---|
| Gerar apresentação | **1 por tela** (6 telas = 6, 30 telas = 30), cobrado no design |
| Adicionar 1 tela nova com IA, redesenhar ou refazer 1 tela | 1 |
| Ler PDF escaneado pela IA | 4 por página (a página vai como imagem; com 2 o lucro ficaria em ≈ 40%) |
| Roteiro (até 3 por apresentação; teto de 40 por dia por espaço), reescrever/traduzir texto, estilo, cores, logo, reordenar, editar | **grátis** |
| Material colado | grátis até 20 mil caracteres; depois 1 a cada 20 mil |

| | Preço | Créditos (= telas) | Lucro com o custo medido, usando tudo (mensal / anual) |
|---|---|---|---|
| Free | R$ 0 | 50 no cadastro | custo ≈ R$ 1,35 por cadastro |
| Plus | R$ 29/mês | 150/mês | 83% / 80% |
| Pro | R$ 74/mês | 400/mês | 82% / 78% |
| Studio | R$ 149/mês | 800/mês por membro | 82% / 78% |
| Pacotes | R$ 19 / 69 / 299 | 100 / 400 / 2.000 | 83% / 81% / 78% |

Custo medido: **US$ 0,0045 por tela** (roteiro US$ 0,020 + design ≈ US$ 0,025 numa apresentação de 10 telas, cache quente), constante `CUSTO_MEDIDO_POR_TELA_USD`. O teste `lib/ia/economia.test.ts` exige lucro ≥ 75% com o custo medido no crédito mais barato (≈ R$ 0,122 líquido) para apresentações de 6 a 30 telas, e ≥ 55% na estimativa conservadora (≈ 35% acima do medido). Ações grátis continuam medidas: o custo delas vai para `ai_usos` (migração 0006) e entra na view `ai_margem_diaria`. Créditos não usados acumulam até 2× a cota (`ACUMULO_MAXIMO`, a aplicar quando houver renovação mensal com cobrança).

As seções abaixo são o histórico das versões anteriores da tabela.

## 0. Recalibração com uso real (21/10/2026)

A primeira geração real em produção (10 telas, conta do dono) registrou o uso medido em `credit_transactions` (migração 0003):

| Etapa | Modelo | Tokens (entrada · saída · cache lido · cache escrito) | Custo real | Créditos cobrados (tabela antiga) |
|---|---|---|---|---|
| Roteiro | Sonnet 5.5 | 1.292 · 2.170 · 4.161 · 0 | US$ 0,0251 | 40 |
| Design, 1 tela | Opus 5.5 | 43 · 148 · 5.347 · 1.633 | US$ 0,0124 | 17 |
| Design, 3 telas | Opus 5.5 | 81 · 295 · 20.940 · 0 | US$ 0,0104 | 51 |
| Design, 3 telas | Opus 5.5 | 83 · 707 · 20.940 · 0 | US$ 0,0187 | 51 |
| Design, 3 telas | Opus 5.5 | 90 · 667 · 20.940 · 0 | US$ 0,0179 | 51 |
| **Total** | | | **US$ 0,0844 (R$ 0,51)** | **210** |

A estimativa de projeto era US$ 0,252: a saída do design foi 4× menor que o previsto (100–236 tokens por tela contra 850) e a do roteiro, metade. Com a tabela antiga, 210 créditos cobriam até US$ 0,42, cinco vezes o custo real. As estimativas foram recalibradas (seção 2) e o preço caiu para **20 + 7 por tela (10 telas = 90 créditos)**, que ainda cobre o pior caso com o cache frio (US$ 0,131 para 10 telas) com a folga de 25%. Os créditos dos planos não mudaram: cada plano passa a render ≈ 2,3× mais apresentações (Free ≈ 5, Plus ≈ 8, Pro ≈ 22, Studio ≈ 44 por membro), e a margem mínima de cada plano continua a mesma, porque ela é calculada pelo teto de US$ 0,002 por crédito. Uma amostra só: acompanhar `ai_margem_diaria` e reajustar quando houver volume.

**Segunda revisão (mesmo dia): roteiro mais barato.** O roteiro custava 20 + 2 por tela (40 créditos em 10 telas) para um custo real de US$ 0,025 (R$ 0,15). A parte fixa existia para cobrir o cache das instruções esfriando a cada 5 minutos. As instruções do roteiro e do design passaram para o **cache de 1 hora** (gravação a 2×, leitura igual), o que tira esse pior caso do dia a dia, e o preço passou a seguir o custo medido com folga: **4 + 8 por tela** (roteiro 4 + 2 por tela, design 6 por tela). 10 telas = **84 créditos** (roteiro 24 + design 60); gerar outro roteiro de 10 telas custa 24 em vez de 40. Lucro sobre a receita líquida com o custo real: ≈ 75% no crédito mais barato (Pro anual) e ≈ 80% no pacote pequeno. O custo da gravação de 1 hora é medido por `usage.cache_creation.ephemeral_1h_input_tokens` e entra no registro de cada débito.

## 1. Pipeline e modelo de cada etapa

| Etapa | Modelo | Preço (US$/milhão de tokens: entrada · saída · leitura de cache · escrita de cache 5 min) | Esforço | Chamada |
|---|---|---|---|---|
| Roteiro (estrutura e texto de todas as telas) | Claude Sonnet 5.5 | 2 · 10 · 0,20 · 2,50 | medium | 1 por apresentação, streaming, system em cache |
| Design (componente, variante, fundo, ênfase, texto ajustado ao layout) | Claude Opus 5.5 | 4 · 20 · 0,20 · 5 | medium | 1 por tela, streaming; system (catálogo) e roteiro do deck em cache |
| Refazer uma tela (editor) | Claude Sonnet 5.5 | 2 · 10 · 0,20 · 2,50 | medium | 1, sem streaming |
| Reescrever o texto de uma tela (editor) | Claude Haiku 5.5 | 0,10 · 0,50 · 0,01 · 0,125 | low | 1, sem streaming |
| Ler PDF escaneado ("Criar com IA", rota `/api/ai/pdf`) | Claude Sonnet 5.5 | 2 · 10 · — · — | low | 1 por leitura (até 40 páginas), streaming; o PDF vai como documento na mensagem, sem cache |

PDF com texto e .docx não passam pela IA: o navegador extrai o texto (pdf.js / fflate), de graça, e ele entra no roteiro como material (1 crédito a cada 2.500 caracteres, como texto colado). Só as páginas **sem texto extraível** (escaneadas, só imagem) podem ser lidas pelo Claude, e só quando a pessoa pede: o navegador renderiza essas páginas como JPEG (lado maior 2.000 px), monta um PDF novo só com elas (jsPDF) e envia; o servidor confere o PDF (cabeçalho, sem script/anexo/formulário/fluxo de objetos, número de páginas = o informado), cobra e repassa ao Claude. O PDF não é gravado (nem no R2, nem no banco, nem em log).

Sonnet e Opus usam a reserva no servidor (`fallbacks: "default"`): se o modelo recusar por política, a API tenta o modelo recomendado na mesma chamada e o custo é calculado pelo modelo que de fato respondeu (iterações de `usage`).

Como o cache é usado no design: o system (catálogo completo do design system, ≈ 2.950 tokens) é igual para todos os pedidos e o primeiro bloco da mensagem (briefing + roteiro do deck + plano de ritmo) é igual para todas as telas do deck. A primeira tela abre o stream sozinha e escreve o cache; as demais só começam quando ela começa a responder (antes disso a entrada não é legível) e leem o prefixo a US$ 0,20/milhão em vez de US$ 4. A parte que varia (≈ 60 tokens: "desenhe a tela N") vai depois do último ponto de cache. O modelo devolve vazio nos campos de texto que o roteiro já resolve, o que corta a saída (a parte cara do Opus).

## 2. Estimativa de tokens por etapa

Os systems são medidos do texto real dos prompts (3,3 caracteres por token, conservador para português). Os demais números são estimativas de projeto, a confirmar com o uso real registrado em cada débito (seção 6).

| Etapa | Entrada | Saída (pensamento + JSON) | Cache |
|---|---|---|---|
| Roteiro | 1.300 (pedido; medido 1.292) + material colado ÷ 3,3 | 300 + 200 por tela (medido: 2.170 no total para 10 telas) | system 2.325 escrito (pior caso; na prática vem do cache) |
| Design, por tela | 60 (pedido da tela) | 300 (medido: 100–236 por tela) | prefixo = 2.952 + 300 + 130 por tela do deck: escrito na 1ª tela, lido nas demais |
| Refazer tela | 298 (system) + 700 | 900 | — |
| Reescrever texto | 353 (system) + 600 | 600 | — |
| Ler PDF escaneado | 400 (system) + 120 + **6.384 por página** (4.784 da imagem + 1.600 de texto) | 200 + **1.100 por página** | — |

Leitura de PDF, de onde vem cada número: a API transforma cada página em imagem e extrai o texto que houver ([PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)). Imagem: `⌈largura/28⌉ × ⌈altura/28⌉` tokens visuais, com teto de **4.784** no nível de alta resolução (modelos 4.7 e posteriores, lado maior até 2.576 px) — usamos o teto (pior caso). Texto: a documentação fala em 1.500–3.000 tokens por página de texto; o PDF que enviamos só tem imagem, então a parte de texto deve ser quase zero, mas contamos **1.600** como folga. Saída: a transcrição de uma página cheia (≈ 400–900 tokens em português) + o pensamento em esforço baixo + o JSON por página = **1.100**. O uso medido de cada leitura fica no débito (seção 6) para conferir.

## 3. Custo por ação (USD → créditos)

Premissas: **1 crédito cobre até US$ 0,002 de IA** (teto de custo do crédito); preço em créditos = custo estimado × 1,25 (folga para variação de tamanho, retentativas e recusas) ÷ 0,002, arredondado para cima; **câmbio de planejamento R$ 6,00/US$** (comercial ≈ R$ 5,60 + IOF de 3,5% no cartão internacional + spread).

| Ação | Custo estimado (roteiro + design) | Em reais | Créditos necessários (com folga) | **Créditos cobrados** (roteiro + design) | Cobertura |
|---|---|---|---|---|---|
| Gerar apresentação de 6 telas | US$ 0,0181 + 0,0475 = **0,0655** | R$ 0,39 | 41 | **52** (16 + 36) | 1,59× |
| Gerar apresentação de 8 telas | US$ 0,0221 + 0,0632 = **0,0853** | R$ 0,51 | 54 | **68** (20 + 48) | 1,59× |
| Gerar apresentação de 10 telas | US$ 0,0261 + 0,0792 = **0,1052** | R$ 0,63 | 66 | **84** (24 + 60) | 1,60× |
| Gerar apresentação de 12 telas | US$ 0,0301 + 0,0954 = **0,1254** | R$ 0,75 | 79 | **100** (28 + 72) | 1,59× |
| Gerar apresentação de 20 telas | US$ 0,0461 + 0,1621 = **0,2082** | R$ 1,25 | 131 | **164** (44 + 120) | 1,58× |
| Material colado de 60 mil caracteres (a mais no roteiro) | US$ 0,0364 | R$ 0,22 | 23 | **24** | 1,32× |
| Redesenhar 1 tela de um deck de 10 (roteiro do deck ainda no cache) | US$ 0,0072 | R$ 0,04 | 5 | **6** | 1,68× |
| Redesenhar 1 tela depois de 5 minutos (grava o roteiro do deck de novo) | US$ 0,0148 | R$ 0,09 | 10 | **6** | 0,81× |
| Redesenhar 1 tela com a plataforma parada há mais de 1 hora (cache todo frio) | US$ 0,0379 | R$ 0,23 | 24 | **6** | 0,32× |
| Refazer uma tela (editor) | US$ 0,0110 | R$ 0,07 | 7 | **8** | 1,46× |
| Reescrever o texto de uma tela (editor) | US$ 0,0004 | R$ 0,002 | 1 | **1** (mínimo) | 5,06× |
| Ler 1 página escaneada de PDF | US$ 0,0268 | R$ 0,16 | 17 | **19** (4 + 15) | 1,42× |
| Ler 5 páginas escaneadas | US$ 0,1219 | R$ 0,73 | 77 | **79** | 1,30× |
| Ler 10 páginas escaneadas | US$ 0,2407 | R$ 1,44 | 151 | **154** | 1,28× |
| Ler 20 páginas escaneadas | US$ 0,4784 | R$ 2,87 | 299 | **304** | 1,27× |
| Ler 40 páginas escaneadas (máximo por leitura) | US$ 0,9538 | R$ 5,72 | 597 | **604** | 1,27× |

"Cobertura" = créditos cobrados × US$ 0,002 ÷ custo estimado (já inclui a folga de 25% no "necessário").

**Tabela de preços em créditos** (`CUSTO_CREDITOS` e `DIVISAO_TELA` em `lib/planos.ts`):

- Gerar uma apresentação: **4 créditos + 8 por tela**, em duas etapas — o roteiro (4 + 2 por tela, + 1 a cada 2.500 caracteres de material colado) quando a IA escreve, e o design (6 por tela) quando ela desenha. 10 telas = **84 créditos**. As instruções do roteiro e do design ficam no cache de 1 hora, então o preço segue o custo medido com folga, sem uma parte fixa para o cache frio.
- Gerar outro roteiro: só a parte do roteiro (10 telas = 24).
- Trocar tema, estilo ou reordenar: grátis (o design de cada tela é guardado pelo conteúdo; o tema é aplicado na montagem). Só telas novas ou alteradas são redesenhadas, a 6 créditos cada.
- Refazer uma tela: **8**. Reescrever o texto de uma tela: **1**. Imagem: 20 (indisponível; preço a confirmar com o fornecedor).
- Ler PDF escaneado (`LEITURA_PDF_CREDITOS` e `custoLeituraPdf`): **4 + 15 por página** lida pela IA (≈ US$ 0,024 de custo por página, 0,030 de cobertura). Páginas com texto, páginas em branco e .docx não pagam leitura. O valor aparece no botão ("Ler 3 páginas com a IA · 49 créditos") antes de qualquer cobrança; se a leitura falhar, estorna. Limite por leitura: Free 10 páginas, Plus 25, Pro e Studio 40 (`paginasPdfIa`). Importar PDF como apresentação não usa IA (Free 30 páginas, Plus 150, Pro e Studio 300: `paginasPdfImportar`).

Casos de borda conhecidos (prejuízo pequeno, coberto pela sobra da geração do mesmo deck):
- Redesenhar 1 tela mais de 5 minutos depois da geração (o roteiro do deck sai do cache de 5 minutos e é gravado de novo): US$ 0,015 = 10 créditos com a folga contra 6 cobrados. Com a plataforma parada há mais de 1 hora (catálogo também frio): US$ 0,038. São casos de centavos, cobertos pela sobra da geração do mesmo deck.
- A primeira geração depois de 1 hora sem uso grava as instruções no cache de 1 hora (≈ US$ 0,06 a mais, uma vez por hora parada).
- Reescrever com seleção muito grande (até 40 textos de 5 mil caracteres): até ≈ US$ 0,01 (Haiku) contra 1 crédito.

## 4. Créditos de cada plano e margem

Regra: no **pior caso** (todos os créditos do mês usados, cada crédito custando o teto de US$ 0,002), a IA pode consumir **no máximo 50% da receita líquida** do plano — calculado sobre o preço **anual** (o menor), então o ciclo mensal fica com folga maior. Receita líquida = preço − 17% (impostos ≈ 12% no Simples + meio de pagamento ≈ 5%). Infraestrutura (Workers, Neon, R2) fica fora da conta da IA e sai da margem restante.

| Plano | Preço/mês | Receita líquida | **Créditos/mês** | ≈ apresentações de 10 telas | IA no pior caso | Peso na receita líquida | Margem bruta mínima |
|---|---|---|---|---|---|---|---|
| Free (no cadastro) | R$ 0 | — | **450** | 5 | R$ 5,40 por cadastro (custo de aquisição) | — | — |
| Plus mensal | R$ 29 | R$ 24,07 | **800** | 9 | R$ 9,60 | 40% | 60% |
| Plus anual | R$ 24 | R$ 19,92 | 800 | 9 | R$ 9,60 | 48% | 52% |
| Pro mensal | R$ 74 | R$ 61,42 | **2.000** | 23 | R$ 24,00 | 39% | 61% |
| Pro anual | R$ 59 | R$ 48,97 | 2.000 | 23 | R$ 24,00 | 49% | 51% |
| Studio mensal (por membro) | R$ 149 | R$ 123,67 | **4.000 por membro**, somados no saldo da equipe | 47 por membro | R$ 48,00 | 39% | 61% |
| Studio anual (por membro) | R$ 119 | R$ 98,77 | 4.000 por membro | 47 por membro | R$ 48,00 | 49% | 51% |

Pacotes avulsos (não expiram), com preço por crédito decrescente:

| Créditos | Preço | Por crédito | IA no pior caso | Peso na receita líquida | Margem bruta mínima |
|---|---|---|---|---|---|
| 500 | R$ 19 | R$ 0,0380 | R$ 6,00 | 38% | 62% |
| 2.000 | R$ 69 (era 59) | R$ 0,0345 | R$ 24,00 | 42% | 58% |
| 10.000 | R$ 299 (era 229) | R$ 0,0299 | R$ 120,00 | 48% | 52% |

Por que a margem real é maior que a mínima: (1) o custo estimado de uma apresentação de 10 telas é US$ 0,25, ou US$ 0,0012 por crédito cobrado — 60% do teto usado na tabela; (2) parte dos créditos do mês não é usada; (3) o system do roteiro e do design é igual para todos os pedidos e costuma vir do cache (a tabela assume que ele é escrito a cada deck). Com uso médio de 50% dos créditos e o custo estimado, a IA fica perto de 15% da receita líquida do Plus anual (800 × 50% × US$ 0,0012 × R$ 6 ≈ R$ 2,90 de R$ 19,92).

O que mudou em relação à tabela anterior: antes, 10 telas custavam 60 créditos (≈ US$ 0,12 de cobertura no teto de hoje) e o design era um layout fixo, sem modelo; com o design por tela no Opus, o mesmo deck custa ≈ US$ 0,25. Mantendo os 60 créditos, cada apresentação daria prejuízo no Studio (R$ 0,0075 por crédito no plano anterior). Os créditos dos planos pagos caíram (Plus 1.000 → 800, Pro 4.000 → 2.000, Studio 20.000 por equipe → 4.000 por membro) e o Free subiu de 400 para 450 (2 apresentações de 10 telas).

## 5. Sensibilidade (para decidir)

- **Design no Sonnet 5.5 em vez do Opus 5.5**: o design de 10 telas cairia de ≈ US$ 0,203 para ≈ US$ 0,106 (10 telas ≈ US$ 0,155 no total), permitindo ≈ 9 créditos por tela no design. A escolha atual (Opus no design) prioriza a qualidade da composição; a troca é uma linha em `MODELO_POR_ETAPA`.
- **Esforço do design em `high`**: a saída por tela tende a crescer ≈ 1,5×–2× (mais pensamento); o design de 10 telas iria para ≈ US$ 0,30–0,37, ainda dentro da cobertura de 170 créditos (US$ 0,34) só no limite — medir antes.
- **Leitura de PDF em outro modelo**: no Haiku 5.5, ≈ US$ 0,0012 por página (1 crédito por página bastaria), mas a transcrição de página escaneada (tabelas, números pequenos, duas colunas) é onde a qualidade mais pesa, e o material alimenta o roteiro do Sonnet; no Opus 5.5, ≈ US$ 0,048 por página (30 créditos). A troca é uma linha em `MODELO_POR_ETAPA.pdf`; o teste de economia mostra o novo mínimo.
- **Página menor**: a imagem enviada pesa o teto de 4.784 tokens; renderizar a 1.568 px de lado maior cairia para ≈ 1.600–2.000 tokens visuais (≈ US$ 0,006 a menos por página), com risco de perder texto pequeno de documentos escaneados. Mantido em 2.000 px.
- **Câmbio**: cada R$ 0,50 a mais no dólar aumenta o peso da IA no pior caso em ≈ 4 pontos percentuais (Plus anual: 48% → 52% com R$ 6,50).

## 6. Acompanhamento da margem (banco)

A migração `db/migrations/0003_custo_ia_por_debito.sql` (aditiva) grava em cada débito de IA, em `credit_transactions`:

- `ai_action` (roteiro, design, tela, texto, pdf), `ai_model`, `ai_cost_usd`, `ai_cost_source` e os tokens (`ai_input_tokens`, `ai_output_tokens`, `ai_cache_read_tokens`, `ai_cache_write_tokens`).
- O débito nasce com a **previsão** (`ai_cost_source = 'previsto'`, modelo planejado, custo da tabela acima) pela função `debitar_creditos_ia`; quando a resposta chega, `registrar_uso_ia` troca pela conta do **uso medido** (`'uso'`: tokens da resposta × preço do modelo que respondeu). Se a geração falhar, os créditos são estornados numa linha própria e o custo do que foi consumido continua no débito.
- A view `ai_margem_diaria` soma por dia, ação e modelo: débitos, créditos, custo em USD e **USD por crédito** — o número a comparar com o teto de US$ 0,002 (e com a receita por crédito de cada plano).

Consulta sugerida para o dono:

```sql
select dia, acao, modelo, creditos, custo_usd, usd_por_credito
from public.ai_margem_diaria
order by dia desc, custo_usd desc;
```

Se `usd_por_credito` passar de 0,0016 (80% do teto) de forma consistente numa ação, revise as estimativas em `lib/ia/economia.ts` e os preços em `lib/planos.ts`; o teste de economia mostra o novo mínimo.
