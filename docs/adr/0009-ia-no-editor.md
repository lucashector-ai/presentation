# ADR 0009 — IA dentro da apresentação (editor)

**Status:** aceito · **Data:** 2026-10-21 · Complementa a [ADR 0008](./0008-ia-e-creditos.md)

## Contexto
A tabela de preços prometia três ações "de uma tela" (`ACOES_IA` em `lib/planos.ts`): Refazer uma tela (5 créditos), Reescrever o texto de uma tela (2) e Gerar imagem para uma tela (20), marcadas "em breve no editor". A apresentação é a unidade de tudo (DIRECAO.md, princípio 1): a IA precisa agir **na tela que a pessoa está editando**, sem quebrar o que ela já ajustou à mão.

## Decisão
1. **A IA reescreve texto; o layout não muda.** As duas ações devolvem só conteúdo e o editor coloca esse conteúdo nas camadas de texto que já existem. Fonte, cor, posição, tamanho da caixa, animações e interações ficam intactos. Refazer *não* chama `montarDocumento` de novo: isso apagaria ajustes manuais e trocaria ids usados por interações.
2. **Papéis por camada** (`lib/ia/tela.ts`, `mapearTela`). Telas geradas pela IA têm ids com o papel (`titulo-`, `texto-`, `valor-`, `num-`, `caixa-`, `rotulo-`…), então a tela volta a ser título + texto + itens do tipo certo (lista, números `valor|legenda`, comparação em duas colunas, citação com autor). Em telas feitas à mão, o maior texto é o título, o próximo na ordem de leitura é o texto e os demais são itens; numeração, aspas, nomes de cor, "Aa" e textos com interação (botões, navegação) ficam de fora. O modelo recebe o número exato de itens e `normalizarTela` garante isso (completa com o original, preserva valores e cores).
3. **Prévia antes/depois, aplicar = um passo de desfazer.** Nada entra no documento até "Aplicar"; o resultado aparece por camada, com aviso "não cabe na caixa" (mede com `medirTexto`, o mesmo cálculo do renderizador, e só avisa se o texto novo passa da caixa *e* do original). Aplicar usa `atualizarCamadas` (reescrever) ou `atualizarCena` (refazer: textos, título da tela, rótulo "02 — …" e notas) — uma entrada no histórico.
4. **Rotas espelham `/api/ai/roteiro`.** `POST /api/ai/texto` e `POST /api/ai/tela`: Zod na entrada, Claude `claude-opus-5-5` via `client.beta.messages.parse` + `betaZodOutputFormat`, `output_config.effort` (`low` para texto, `medium` para tela), `fallbacks: 'default'` com o beta `server-side-fallback-2026-07-01`, recusa (`stop_reason === 'refusal'`) → 400 com orientação. Schemas do modelo só com campos simples e obrigatórios; limites aplicados depois (`normalizarTextos`, `normalizarTela`). Prompts em `lib/ia/texto.ts` e `lib/ia/tela.ts`, conteúdo do usuário delimitado (`<texto>`, `<tela_atual>`, `<telas>`, `<instrucao>`) e delimitadores neutralizados dentro dele.
5. **Reserva local honesta.** Sem `ANTHROPIC_API_KEY` (demonstração) ou com a API fora do ar (429/5xx/rede), regras determinísticas: cortar parênteses, enchimento e orações (mais curto), tirar hesitação (impactante), trocar gírias (formal), palavras simples (simples), acentos/espaços/pontuação (corrigir) e um glossário curto para a tradução. A UI marca **"exemplo local"** e a tradução diz "Tradução de exemplo — conecte a IA para traduzir de verdade". Números, datas, e-mails, URLs e cores nunca mudam; caixa alta e quebras de linha são preservadas.
6. **Créditos.** Fora do modo demo a rota debita (`debitar_creditos`) antes de chamar o modelo e estorna se ele falhar — igual ao roteiro; a reserva local não cobra. Na demonstração o débito é feito no navegador (`gastarCreditos`) quando chega um resultado com mudança, para o ciclo saldo → uso → compra ser visível; sem saldo, `useCreditos().abrirCompra(motivo)`. Cada botão mostra o custo. Descartar não devolve créditos (o modelo já trabalhou) — o painel diz "2 créditos usados".
7. **Gerar imagem fica visível e desligado ("em breve").** Não há modelo de imagem nesta stack; fingir seria pior que esperar (princípio 6, honestidade).

## Pontos de entrada
Botão **✦ IA** no cabeçalho do editor (`BotaoIA`, uma montagem em `EditorShell`), itens no menu de contexto do canvas e seção **IA** no inspetor quando há texto selecionado. Todos chamam `abrirIA(aba)` (evento `mostra:ia`), então o painel `components/editor/ia/PainelIA.tsx` é o único dono do fluxo.

## Consequências
- Telas geradas pela IA são refeitas com precisão por tipo; telas feitas à mão recebem uma leitura heurística (pode errar o papel em composições incomuns — a prévia mostra o papel de cada texto antes de aplicar).
- Trocar o tipo/layout de uma tela ("transformar em lista") continua fora de escopo.

## Pendências
Gerar imagem (precisa de modelo e armazenamento), registro em `ai_generations` (`kind 'refazer_tela' | 'reescrever'`, migration futura), reescrita da apresentação inteira (várias telas, um débito por tela).
