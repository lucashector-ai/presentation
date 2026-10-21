# Mostra — apresentações para quem cria

SaaS privado para designers, diretores de arte e estúdios: cole artes do Figma e do Illustrator, traga modelos 3D do Blender, monte telas com animação e interações, peça para a IA escrever o roteiro e envie um **link privado, com senha opcional e revogável**. Construído a partir do blueprint v1.0 (20.10.2026) e do design "Mostra" (protótipo de sete telas).

> Produto privado por padrão. Nada é indexado, listado ou acessível por URL previsível.

## Estado atual (Sprint 0 + fundação das Sprints 1–4)

| Área | Status |
| --- | --- |
| Schema de cena compartilhado (Zod), validação semântica, motor de interação | ✅ com testes unitários |
| Editor profissional (telas, camadas, grupos, guias inteligentes, alinhar/distribuir, cortar/máscara, efeitos, gradientes, curvas de easing, copiar/colar estilo, atalhos, undo/redo, autosave com revisão) | ✅ |
| Colar/importar de Figma, Illustrator, navegador: SVG (sanitizado), imagens, texto, links (YouTube/Vimeo/Figma/Spline viram embed) | ✅ ver ADR 0006 |
| 3D (GLB/glTF do Blender via `<model-viewer>`), Lottie, embeds com allowlist | ✅ ver ADR 0007 |
| Visualizador Slides, Story e Explorar (mapa navegável), transição morph, avanço automático, modo apresentador com notas sincronizado | ✅ |
| Criar com IA (`/app/criar`; `/criar` redireciona mantendo o prompt): prompt ou texto → roteiro editável → telas desenhadas; créditos por workspace | ✅ ver ADR 0008 — usa o Claude com `ANTHROPIC_API_KEY`, senão gerador local |
| Publicação (snapshot imutável) e links (token hash, senha, validade, revogação, limite de tentativas) | ✅ no modo demonstração |
| Painel como centro do app (criar, continuar, enviados e visualizações, créditos e compra, primeiros passos, busca ⌘K), detalhes, compartilhamento, conta/planos, marketing, login/cadastro | ✅ ver `docs/ux/DIRECAO.md` |
| Banco (migrations + RLS + bucket privado) e rotas `/api` sobre Supabase | ✅ escritas e compiladas, **ainda não exercitadas contra um projeto Supabase real** |
| UI ligada ao backend real (hoje usa `lib/demo/store.ts` no navegador) | ⏳ Sprint 1: trocar o módulo de dados por `lib/api/cliente.ts` |
| Worker de thumbnails/transcodificação, billing (Stripe), e-mail transacional | ⏳ não iniciados |

A UI roda em **modo demonstração** (`NEXT_PUBLIC_DEMO=1`): um "backend" no navegador (`lib/demo/store.ts`) implementa os mesmos contratos das rotas reais, com dados fictícios persistidos em `localStorage`. Isso permite validar a experiência completa (AC-01 a AC-14) antes de ligar o banco.

## Como rodar

```bash
cp .env.example .env.local        # modo demo já vem ligado
npm install
npm run dev                        # http://localhost:3000 (vinext: API do Next.js sobre o Vite, servidor no workerd)
```

Node 22+. O app roda com [vinext](https://github.com/cloudflare/vinext) no Cloudflare Workers: `app/` e `next.config.js` são os mesmos, mas o pacote `next` não está instalado (o vinext implementa os `next/*`). Variáveis só do servidor ficam em `.dev.vars` (mesmo formato do `.env.local`; nunca versionar).

Contas de demonstração: qualquer e-mail/senha entram. Link público de exemplo: `/p/demo_cafe_aurora_proposta_01_token_fixo_xx`.

Para o "Criar com IA" e as ações de IA do editor (reescrever o texto de uma tela, refazer uma tela) usarem o Claude, defina `ANTHROPIC_API_KEY` em `.env.local` (só no servidor). Sem chave, as rotas `/api/ai/roteiro`, `/api/ai/texto` e `/api/ai/tela` usam geradores locais determinísticos (rotulados "exemplo local" no editor) e não cobram créditos (no modo demonstração o saldo fictício do navegador é debitado, para o ciclo de créditos ficar visível).

### Planos e créditos

Fonte única: `lib/planos.ts` (servidor, painel e landing leem os mesmos números). O Mostra gera **apresentações**, então os créditos são explicados em apresentações:

| Ação | Créditos |
| --- | --- |
| Gerar uma apresentação (roteiro + telas) | 10 + 5 por tela — **10 telas = 60** (cobrado uma vez; ajustar o roteiro, trocar o tema e redesenhar é grátis) |
| Refazer uma tela | 5 |
| Reescrever ou traduzir o texto de uma tela | 2 |
| Gerar imagem para uma tela | 20 |

| Plano | Preço (anual / mensal) | Créditos | ≈ apresentações de 10 telas |
| --- | --- | --- | --- |
| Free | R$0 | 400 no cadastro | 6 |
| Plus | R$24 / R$29 | 1.000 por mês | 16 |
| Pro | R$59 / R$74 | 4.000 por mês | 66 |
| Studio | R$119 / R$149 por membro | 20.000 por mês, compartilhados | 333 |

Pacotes avulsos (não expiram): 500 por R$19 (≈ 8), 2.000 por R$59 (≈ 33), 10.000 por R$229 (≈ 166). Editar, apresentar, compartilhar e acompanhar o cliente nunca consomem créditos. Decisões e justificativas (inclusive a saída do "vídeo curto") em `docs/ux/DIRECAO.md`.

## Como testar

```bash
npm run lint && npm run typecheck && npm run test   # unitários (Vitest)
npm run build                                        # build de produção (dist/)
npm run dev & npm run test:e2e                       # fluxo ponta a ponta (Playwright, exige navegador instalado: npx playwright install chromium)
NEXT_PUBLIC_DEMO=1 npm run build && npm run preview  # o Worker de produção no workerd, em http://localhost:8787
E2E_BASE_URL=http://localhost:8787 npm run test:e2e  # o mesmo fluxo contra o preview
```

`npm run verificar` encadeia lint, typecheck, testes e build (é o que a CI executa em `.github/workflows/ci.yml`).

## Como migrar o banco (Supabase)

1. Crie um projeto no Supabase e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SHARE_GRANT_SECRET` em `.env.local` (nunca versionar).
2. Aplique `supabase/migrations/0000_base.sql`, `0001_funcoes_transacionais.sql` e `0002_criativo_creditos_ia.sql` em ordem (SQL Editor ou `supabase db push`). Veja `supabase/LEIA-ME.md`.
3. Desligue o modo demo: `NEXT_PUBLIC_DEMO=0`. As rotas `/api` passam a autenticar com o Bearer do Supabase Auth.

Novas mudanças de schema: arquivo `000N_descricao.sql` sequencial; nunca editar migration já aplicada.

## Como publicar e reverter

- **Cloudflare Workers** (Worker `mostra`, config em `wrangler.jsonc`, bucket R2 `mostra-midias` no binding `MIDIAS`): `npx wrangler login` uma vez, segredos com `npx wrangler secret put DATABASE_URL` (e os demais do servidor), depois `npm run deploy` (build + `wrangler deploy`). Variáveis `NEXT_PUBLIC_*` entram no build, então precisam estar no ambiente de quem roda o deploy. Reverter = `npx wrangler rollback` (versão anterior, instantâneo) ou `git revert` + deploy.
- Bindings do Cloudflare só por `lib/cf/ambiente.ts` (fora do Worker, como no Vitest, devolve null).
- Migrations são aditivas; para reverter uma, escreva a migration inversa (não apague a anterior).

## Estrutura

```
app/                      rotas (App Router)
  page.tsx                marketing
  login/ signup/          autenticação
  app/                    área autenticada: painel, novo, biblioteca, compartilhados, lixeira, projects/[id] (detalhes, edit, share, apresentar, apresentador), settings
  criar/                  Criar com IA (prompt → roteiro → apresentação)
  p/[token]/              visualizador público não listado
  api/                    rotas HTTP (contratos em lib/api/contratos.ts)
components/
  renderer/               SceneRenderer — ÚNICO renderizador (editor, miniaturas, preview, viewer)
  viewer/                 Viewer (Slides/Story/Explorar), Apresentador, página pública
  editor/                 EditorShell, PainelEsquerdo (telas/camadas/arquivos/blocos), Canvas, inspetor/ (Design, Animação, Interações)
  compartilhar/           links privados
  app/                    Shell, Dashboard, DetalheProjeto, Configuracoes, FormAuth
  ui/                     design system: Botao, Entrada, Campo, Modal, Toast, ZonaUpload (na biblioteca), Cartao, CampoInspetor, MiniaturaCena, ModalCompartilhar
lib/
  scene/                  schema.ts (Zod), validate.ts, motor.ts (reducer de interações), transform.ts, order.ts
  api/                    contratos.ts (Zod), servidor.ts (auth/envelope/rate limit), cliente.ts (HTTP tipado)
  demo/                   backend de demonstração no navegador + dados fictícios
  editor/                 useEditor (undo/redo, autosave, revisão, conflito), guias, importação
  importar/               SVG (sanitização, cores), arquivos (GLB/glTF/Lottie), área de transferência
  ia/                     roteiro + motor de layout, gerador local, prompt e chamada ao Claude
  share/                  tokens, hash de senha (PBKDF2), estado do link, limite de tentativas
  midia/                  detecção de MIME real (bytes mágicos; SVG/glTF/Lottie validados pelo conteúdo)
  planos.ts               planos e entitlements (aplicados no servidor)
  design-tokens.ts        tokens (espelham app/globals.css)
supabase/migrations/      schema relacional, RLS, bucket privado, funções transacionais
docs/                     ARQUITETURA.md, CRITERIOS-ACEITE.md, adr/
e2e/                      fluxo ponta a ponta com Playwright
```

## Decisões registradas

Ver `docs/adr/`: stack (0001), autenticação (0002), entrega de mídia (0003), renderizador de cena (0004), modelo de revisões (0005), importação e área de transferência (0006), 3D/Lottie/embeds (0007), IA e créditos (0008). Visão geral, mapa de telas e plano P0 em `docs/ARQUITETURA.md`. Critérios de aceite e como cada um é verificado em `docs/CRITERIOS-ACEITE.md`.
