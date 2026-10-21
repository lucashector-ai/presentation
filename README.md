# Plataforma de Apresentações Criativas — MVP

SaaS privado para designers, diretores de arte e estúdios: importe artes prontas, monte cenas, adicione interações simples (clique → ir para cena, hover → revelar camada) e envie um **link privado, com senha opcional e revogável**. Construído a partir do blueprint v1.0 (20.10.2026).

> Produto privado por padrão. Nada é indexado, listado ou acessível por URL previsível.

## Estado atual (Sprint 0 + fundação das Sprints 1–4)

| Área | Status |
| --- | --- |
| Schema de cena compartilhado (Zod), validação semântica, motor de interação | ✅ com testes unitários |
| Editor (cenas, canvas DOM, inspetor, biblioteca de mídias, undo/redo, autosave com revisão) | ✅ protótipo funcional |
| Visualizador Slides + Story (teclado, toque, fullscreen, pré-carregamento, fallback, reduced motion) | ✅ |
| Publicação (snapshot imutável) e links (token hash, senha, validade, revogação, limite de tentativas) | ✅ no modo demonstração |
| Painel, detalhes, compartilhamento, conta/planos, marketing, login/cadastro | ✅ |
| Banco (migrations + RLS + bucket privado) e rotas `/api` sobre Supabase | ✅ escritas e compiladas, **ainda não exercitadas contra um projeto Supabase real** |
| UI ligada ao backend real (hoje usa `lib/demo/store.ts` no navegador) | ⏳ Sprint 1: trocar o módulo de dados por `lib/api/cliente.ts` |
| Worker de thumbnails/transcodificação, billing (Stripe), e-mail transacional | ⏳ não iniciados |

A UI roda em **modo demonstração** (`NEXT_PUBLIC_DEMO=1`): um "backend" no navegador (`lib/demo/store.ts`) implementa os mesmos contratos das rotas reais, com dados fictícios persistidos em `localStorage`. Isso permite validar a experiência completa (AC-01 a AC-14) antes de ligar o banco.

## Como rodar

```bash
cp .env.example .env.local        # modo demo já vem ligado
npm install
npm run dev                        # http://localhost:3000
```

Contas de demonstração: qualquer e-mail/senha entram. Link público de exemplo: `/p/demo_cafe_aurora_proposta_01_token_fixo_xx`.

## Como testar

```bash
npm run lint && npm run typecheck && npm run test   # unitários (Vitest)
npm run build                                        # build de produção
npm run dev & npm run test:e2e                       # fluxo ponta a ponta (Playwright, exige navegador instalado: npx playwright install chromium)
```

`npm run verificar` encadeia lint, typecheck, testes e build (é o que a CI executa em `.github/workflows/ci.yml`).

## Como migrar o banco (Supabase)

1. Crie um projeto no Supabase e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SHARE_GRANT_SECRET` em `.env.local` (nunca versionar).
2. Aplique `supabase/migrations/0000_base.sql` e `0001_funcoes_transacionais.sql` em ordem (SQL Editor ou `supabase db push`). Veja `supabase/LEIA-ME.md`.
3. Desligue o modo demo: `NEXT_PUBLIC_DEMO=0`. As rotas `/api` passam a autenticar com o Bearer do Supabase Auth.

Novas mudanças de schema: arquivo `000N_descricao.sql` sequencial; nunca editar migration já aplicada.

## Como publicar e reverter

- **Vercel** (recomendado, mesmo padrão do Clinical 360): importar o repositório, definir as variáveis acima em *Production* e *Preview*, deploy automático por branch. Reverter = *Promote* do deployment anterior no painel (instantâneo) ou `git revert` + push.
- Qualquer host Node 20+: `npm run build && npm start`.
- Migrations são aditivas; para reverter uma, escreva a migration inversa (não apague a anterior).

## Estrutura

```
app/                      rotas (App Router)
  page.tsx                marketing
  login/ signup/          autenticação
  app/                    área autenticada: painel, projects/[id] (detalhes, edit, share, apresentar), settings
  p/[token]/              visualizador público não listado
  api/                    rotas HTTP (contratos em lib/api/contratos.ts)
components/
  renderer/               SceneRenderer — ÚNICO renderizador (editor, miniaturas, preview, viewer)
  viewer/                 Viewer (Slides/Story), página pública
  editor/                 EditorShell, PainelCenas, Canvas, Inspetor, BibliotecaMidias
  compartilhar/           links privados
  app/                    Shell, Dashboard, DetalheProjeto, Configuracoes, FormAuth
  ui/                     design system: Botao, Entrada, Campo, Modal, Toast, ZonaUpload (na biblioteca), Cartao, CampoInspetor, MiniaturaCena, ModalCompartilhar
lib/
  scene/                  schema.ts (Zod), validate.ts, motor.ts (reducer de interações), transform.ts, order.ts
  api/                    contratos.ts (Zod), servidor.ts (auth/envelope/rate limit), cliente.ts (HTTP tipado)
  demo/                   backend de demonstração no navegador + dados fictícios
  editor/                 useEditor (undo/redo, autosave, revisão, conflito)
  share/                  tokens, hash de senha (PBKDF2), estado do link, limite de tentativas
  midia/                  detecção de MIME real por bytes mágicos
  planos.ts               planos e entitlements (aplicados no servidor)
  design-tokens.ts        tokens (espelham app/globals.css)
supabase/migrations/      schema relacional, RLS, bucket privado, funções transacionais
docs/                     ARQUITETURA.md, CRITERIOS-ACEITE.md, adr/
e2e/                      fluxo ponta a ponta com Playwright
```

## Decisões registradas

Ver `docs/adr/`: stack (0001), autenticação (0002), entrega de mídia (0003), renderizador de cena (0004), modelo de revisões (0005). Visão geral, mapa de telas e plano P0 em `docs/ARQUITETURA.md`. Critérios de aceite e como cada um é verificado em `docs/CRITERIOS-ACEITE.md`.
