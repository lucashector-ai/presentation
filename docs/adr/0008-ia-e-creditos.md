# ADR 0008 — Criar com IA e créditos

**Status:** aceito · **Data:** 2026-10-21

## Decisão
A IA escreve **conteúdo e estrutura**; o **layout é determinístico**. A rota `POST /api/ai/roteiro` devolve um `Roteiro` (`lib/ia/roteiro.ts`: tipos de tela como capa, lista, números, paleta, comparação…) e `montarDocumento` transforma o roteiro em telas válidas pelo schema, com tema, estilo, opção de imagens e densidade de texto. Assim toda apresentação gerada abre no editor sem erro e é 100% editável.

- Modelo: Claude (`claude-opus-5-5`) via `@anthropic-ai/sdk`, saída estruturada validada por Zod (`betaZodOutputFormat`), esforço `medium`, e `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) para que uma recusa por política seja refeita no modelo reserva recomendado na mesma chamada. Recusa final → 400 com mensagem para reformular.
- O material do usuário vai delimitado (`<material>`) e as instruções pedem para tratá-lo como conteúdo, não como ordens.
- Sem `ANTHROPIC_API_KEY`, ou com a API indisponível (429/5xx/rede), a rota usa o **gerador local** (`lib/ia/local.ts`): organiza o texto colado em telas ou monta uma estrutura-guia pelo tipo de apresentação. Não cobra créditos.

## Créditos
Saldo compartilhado por workspace (`credit_balances`) com extrato imutável (`credit_transactions`), alterado só pela função `debitar_creditos` (service role; `execute` revogado de `anon`/`authenticated`). Custos em `lib/planos.ts` (`CUSTO_CREDITOS`: roteiro 10, tela 5…). A rota debita antes de chamar o modelo e **estorna** se a geração falhar. Novos workspaces recebem 400 créditos.

## Pendências
Geração de imagens e vídeo (custos já definidos), reescrever tela no editor, registro em `ai_generations` a partir da rota, leitura de PDF/DOCX no servidor.
