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
| Criar com IA (`/app/criar`; `/criar` redireciona mantendo o prompt): prompt, texto ou arquivo → roteiro editável → telas desenhadas; créditos por workspace | ✅ ver ADR 0008 — usa o Claude com `ANTHROPIC_API_KEY`, senão gerador local |
| Criar com IA em passos: Briefing → Marca (logo enviado, paleta extraída do logo no navegador, paletas prontas, par de fontes, kit de marca salvo no espaço) → Material (texto/PDF, números, o que não pode faltar, o que evitar, fotos próprias) → Estilo (23 estilos com composição própria, filtro e busca, prévia real) → Tamanho (6 até o limite do plano, até 30 telas) → Revisar e gerar → Roteiro → Design. Marca, cores, logo, fotos e troca de estilo entram na montagem, sem IA; custo sempre à vista | ✅ `components/app/CriarComIA.tsx`, `components/app/criar/`, `lib/ia/marca.ts`, `lib/telasIa.ts`, migração 0005 |
| Telas geradas com auto layout: rótulo, título (ênfase como segunda parte no mesmo frame, gap 0) e texto num bloco; cartões, métricas, equipe, preços, etapas e linha do tempo em linhas/grades de auto layout, editáveis depois; textos com altura que abraça o conteúdo; conteúdo grande demais é montado de novo menor | ✅ `lib/ia/montagem.ts`, teste `lib/ia/autolayout.test.ts` (sem sobreposição em todos os estilos × componentes × variantes, slides e story) |
| PDF e .docx como material da IA: texto extraído no navegador (pdf.js sob demanda, estrutura em Markdown leve: títulos, listas, tabelas, ordem de leitura); páginas escaneadas lidas pelo Claude (documento PDF, cobrado por página, `/api/ai/pdf`); importar PDF como apresentação (uma tela por página, texto selecionável; nas páginas escaneadas, o texto vem do OCR no navegador, posicionado sobre as palavras, sem créditos, e opcionalmente vai para as notas) em Novo projeto | ✅ `lib/pdf/` (camada do OCR em `lib/pdf/camadaOcr.ts`), `lib/importar/docx.ts`, custos em `docs/economia-ia.md`; E2E em `e2e/pdf.mjs` |
| Publicação (snapshot imutável) e links (token hash, senha, validade, revogação, limite de tentativas) | ✅ no modo demonstração |
| Painel como centro do app (criar, continuar, enviados e visualizações, créditos e compra, primeiros passos, busca ⌘K), detalhes, compartilhamento, conta/planos, marketing, login/cadastro | ✅ ver `docs/ux/DIRECAO.md` |
| Banco (Neon Postgres, `db/migrations`), login (Neon Auth: e-mail/senha + Google), mídias (Cloudflare R2) e rotas `/api` | ✅ exercitados de ponta a ponta contra o Neon (cadastro, login, projeto, cenas, upload, publicação, link de convidado, créditos, isolamento entre usuários) — ver ADR 0010 |
| UI ligada ao backend real: camada de dados única (`lib/dados`) com duas implementações — demo (`lib/demo/store.ts`, `NEXT_PUBLIC_DEMO=1`) e real (rotas `/api`, sessão por cookie) | ✅ painel, editor (autosave com revisão, 409, offline), mídias, publicação, links, página pública, lixeira, créditos/plano e IA — provado por `e2e/real.mjs` |
| Colaboração em tempo real: sala por projeto (Durable Object + WebSocket em hibernação), presença (avatares, cursores com nome, seleções, tela de cada um), edição simultânea com LWW por propriedade, desfazer por pessoa, offline com sincronização ao voltar; equipe (convite por e-mail ou link, editor/visualizador, remover) | ✅ ver ADR 0011 — provado por `e2e/colaboracao.mjs` (dois navegadores, duas contas) |
| Fontes do Google: catálogo completo (1.894 famílias com português, `lib/fontes/catalogo-google.json`, gerado por `node scripts/gerar-catalogo-fontes.mjs` a partir do pacote `google-font-metadata` fixado) no seletor do editor e no kit de marca (busca, categorias, prévias só com os glifos do nome, lista virtualizada, "Fontes do documento" e "Recentes"); carregadas sob demanda, só as variantes usadas, pela mesma origem (proxy no Worker `/fontes/*` com cache da borda), iguais no editor, apresentação, miniaturas, link público e exportação PNG/PDF (fontes embutidas); colar do Figma e SVG mapeiam nomes para o catálogo (SVG com as fontes recortadas embutidas) | ✅ `lib/fontes/`, `components/fontes/SeletorFonte.tsx`, `components/renderer/fontes.ts` |
| Worker de thumbnails/transcodificação, billing (Stripe), e-mail transacional | ⏳ não iniciados |

As telas só falam com `dados` (`lib/dados/index.ts`) e leem o estado com `useDados`/`useCarregar`/`useProjetoCompleto`; nenhuma decide sozinha se está no modo demo. O build escolhe a implementação:

- **modo demonstração** (`NEXT_PUBLIC_DEMO=1`): um "backend" no navegador (`lib/demo/store.ts`) implementa os mesmos contratos das rotas reais, com dados fictícios persistidos em `localStorage` (`mostra.demo.v2`).
- **modo real** (sem a variável): `lib/dados/real.ts` chama as rotas `/api` (`lib/api/cliente.ts`) e mantém um cache reativo no mesmo formato; o servidor continua sendo a fonte da verdade (revisão/409, limites do plano, débito de créditos, autorização). Sem sessão, `/app/*` manda para `/login?proximo=…` e volta depois de entrar; uma sessão que expira no meio do uso faz o mesmo.

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

### Modo real local (banco de verdade)

1. `.env.local` com as variáveis do Neon de um **branch de teste** (`neon branches create --name teste-x --parent production` e `neon env pull --branch teste-x --file .env.local`) e `.dev.vars` com as mesmas linhas, sem as `NEXT_PUBLIC_*` (o Worker local lê o `.dev.vars`).
2. `npm run dev`. O servidor roda no workerd; se ele não resolver DNS (rede que só sai por proxy HTTP, como sessões de agente), encaminhe o fetch de saída do Worker pelo Node com o preload de desenvolvimento:
   `NODE_USE_ENV_PROXY=1 node --import ./e2e/saida-pelo-node.mjs node_modules/vite/bin/vite.js dev --port 3104`
   (só HTTP(S); o app usa o driver HTTP do Neon. Não entra no build.) Com outras cópias do app rodando `vite dev` na mesma máquina, isole o registro de Workers do Miniflare com `MINIFLARE_REGISTRY_PATH=<pasta própria>`: todas se chamam `mostra` e o registro global é compartilhado.
3. `E2E_BASE_URL=http://localhost:3104 node e2e/real.mjs`: cadastra um usuário novo, cria projeto, edita e salva, recarrega, envia imagem, edita em duas abas ao mesmo tempo (sala de colaboração, sem 409), publica, abre o link numa aba anônima, duplica/arquiva/usa a lixeira, envia para a biblioteca, cria com IA, sai e entra de novo. No fim imprime o usuário criado para apagar do branch.
4. `NODE_USE_ENV_PROXY=1 E2E_BASE_URL=http://localhost:3104 node e2e/colaboracao.mjs`: duas contas em dois navegadores — convite (o Free recusa; o teste põe o workspace no Studio direto no branch), aceite, presença, cursores, edição vista pelo outro (latência medida), edições simultâneas, desfazer por pessoa, queda de rede e volta, recarregar e conferir no banco, e a sala recusando quem não tem sessão, vem de outro site ou saiu da equipe. Lê `DATABASE_URL`/`NEON_BRANCH` do `.env.local` e recusa rodar no `production`.

## Como testar

```bash
npm run lint && npm run typecheck && npm run test   # unitários (Vitest)
npm run build                                        # build de produção (dist/)
npm run dev & npm run test:e2e                       # fluxo ponta a ponta (Playwright, exige navegador instalado: npx playwright install chromium)
NEXT_PUBLIC_DEMO=1 npm run build && npm run preview  # o Worker de produção no workerd, em http://localhost:8787
E2E_BASE_URL=http://localhost:8787 npm run test:e2e  # o mesmo fluxo contra o preview
E2E_BASE_URL=http://localhost:8787 node e2e/pdf.mjs  # PDF/.docx no "Criar com IA" e PDF importado como apresentação
```

O pdf.js só existe no navegador: `lib/pdf/navegador.ts` é carregado sob demanda e, no RSC/SSR, vira um stub (plugin em `vite.config.ts`), então o Worker não leva o pdf.js. O worker do pdf.js sai como asset do build; o wasm (JPEG 2000/JBIG2) e as fontes padrão que ele busca por URL saem em `/_next/static/pdfjs/<versão>/`.

`npm run verificar` encadeia lint, typecheck, testes e build (é o que a CI executa em `.github/workflows/ci.yml`).

## Banco, login e mídias (Neon + Cloudflare R2)

1. `neon link` no projeto e `neon deploy` (o `neon.ts` declara `auth: true`): o CLI escreve `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_AUTH_BASE_URL` e `NEON_AUTH_JWKS_URL` em `.env.local`. Acrescente `NEON_AUTH_COOKIE_SECRET` e `SHARE_GRANT_SECRET` (`openssl rand -base64 32` cada; nunca versionar).
2. `npm run db:migrar` aplica `db/migrations/*.sql` em ordem no branch do `.env.local` (teste antes num branch do Neon; ver `db/LEIA-ME.md`).
3. Desligue o modo demo (`NEXT_PUBLIC_DEMO=0`). Cadastro/login usam o Neon Auth pelo proxy `/api/auth/*` (cookies HttpOnly do próprio domínio) e as rotas `/api` conferem a sessão e o workspace em toda consulta (não há RLS).
4. Mídias: no Worker, o binding R2 `MIDIAS`; fora dele (`npm run dev`), disco em `.armazenamento-dev/` (em `next start`, defina `ARMAZENAMENTO_DEV_DIR`).

Novas mudanças de schema: arquivo `000N_descricao.sql` sequencial; nunca editar migration já aplicada (o script recusa).

## Como publicar e reverter

- **Cloudflare Workers** (Worker `mostra`, config em `wrangler.jsonc`, bucket R2 `mostra-midias` no binding `MIDIAS`): `npx wrangler login` uma vez, segredos com `npx wrangler secret put DATABASE_URL` (e os demais do servidor), depois `npm run deploy` (build + `wrangler deploy`). Variáveis `NEXT_PUBLIC_*` entram no build, então precisam estar no ambiente de quem roda o deploy. Reverter = `npx wrangler rollback` (versão anterior, instantâneo) ou `git revert` + deploy.
- Bindings do Cloudflare só por `lib/cf/ambiente.ts` (fora do Worker, como no Vitest, devolve null). Exceção: o Durable Object da sala de colaboração (`SALAS` → classe `SalaProjeto`), que o Worker (`worker/index.ts`, o `main` do wrangler) recebe no `env` e exporta junto do vinext.
- Migrations são aditivas; para reverter uma, escreva a migration inversa (não apague a anterior).

## Estrutura

```
worker/index.ts           entrada do Worker: sala de colaboração (WebSocket) + vinext para o resto
app/                      rotas (App Router)
  page.tsx                marketing
  login/ signup/          autenticação
  app/                    área autenticada: painel, novo, biblioteca, compartilhados, lixeira, projects/[id] (detalhes, edit, share, apresentar, apresentador), settings
  criar/                  Criar com IA (prompt → roteiro → apresentação)
  p/[token]/              visualizador público não listado
  api/                    rotas HTTP (contratos em lib/api/contratos.ts)
components/
  renderer/               SceneRenderer — ÚNICO renderizador (editor, miniaturas, preview, viewer); fontes.ts carrega as fontes usadas
  fontes/                 SeletorFonte (catálogo do Google: busca, categorias, prévias, virtualizado)
  viewer/                 Viewer (Slides/Story/Explorar), Apresentador, página pública
  editor/                 EditorShell, PainelEsquerdo (telas/camadas/arquivos/blocos), Canvas, inspetor/ (Design, Animação, Interações)
  compartilhar/           links privados
  app/                    Shell, Dashboard, DetalheProjeto, Configuracoes, FormAuth
  ui/                     design system: Botao, Entrada, Campo, Modal, Toast, ZonaUpload (na biblioteca), Cartao, CampoInspetor, MiniaturaCena, ModalCompartilhar
lib/
  scene/                  schema.ts (Zod), validate.ts, motor.ts (reducer de interações), transform.ts, order.ts
  api/                    contratos.ts (Zod), servidor.ts (sessão/workspace/envelope/rate limit), cliente.ts (HTTP tipado), midiaServidor.ts (entrega de mídia)
  auth/                   Neon Auth: servidor.ts (proxy /api/auth + sessão), cliente.ts (navegador)
  armazenamento.ts        mídias no R2 (binding MIDIAS via lib/cf/ambiente.ts) ou disco/memória em dev
  db/                     conexão Neon (sql() HTTP, novoPool() WebSocket)
  dados/                  camada de dados das telas: contrato (tipos.ts), demo.ts (store local) e real.ts (rotas /api + cache)
  demo/                   backend de demonstração no navegador + dados fictícios
  editor/                 useEditor (undo/redo por pessoa, sala ou autosave, revisão, conflito), guias, importação
  colab/                  colaboração: ops.ts (diferença/aplicar/compactar), motor.ts (reconciliação no cliente), protocolo.ts (Zod, limites), cliente.ts (WebSocket), sala.ts (Durable Object), entrada.ts (handshake autenticado)
  importar/               SVG (sanitização, cores), arquivos (GLB/glTF/Lottie), área de transferência
  ia/                     roteiro + motor de layout, gerador local, prompt e chamada ao Claude
  share/                  tokens, hash de senha (PBKDF2), estado do link, limite de tentativas
  fontes/                 catálogo do Google Fonts (JSON gerado + busca/variantes), URLs e proxy do Worker (/fontes/*), SVG com fontes embutidas
  midia/                  detecção de MIME real (bytes mágicos; SVG/glTF/Lottie validados pelo conteúdo)
  planos.ts               planos e entitlements (aplicados no servidor)
  design-tokens.ts        tokens (espelham app/globals.css)
db/migrations/            schema relacional e funções transacionais (Neon); db/migrar.mjs aplica
docs/                     ARQUITETURA.md, CRITERIOS-ACEITE.md, adr/
scripts/                  gerar-catalogo-fontes.mjs (regenera lib/fontes/catalogo-google.json; versão do pacote fixada)
e2e/                      fluxos ponta a ponta com Playwright: fluxo.mjs (demo) e real.mjs (Neon de verdade)
```

## Decisões registradas

Ver `docs/adr/`: stack (0001), autenticação (0002), entrega de mídia (0003), renderizador de cena (0004), modelo de revisões (0005), importação e área de transferência (0006), 3D/Lottie/embeds (0007), IA e créditos (0008), IA no editor (0009), Neon + R2 no lugar do Supabase (0010), colaboração em tempo real e equipe (0011). Visão geral, mapa de telas e plano P0 em `docs/ARQUITETURA.md`. Critérios de aceite e como cada um é verificado em `docs/CRITERIOS-ACEITE.md`.
