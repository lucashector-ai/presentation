# Arquitetura — Plataforma de Apresentações Criativas

Documento do "primeiro entregável" da instrução mestre (seção 20): stack e trade-offs, estrutura de pastas, schema relacional, contratos TS, mapa de telas e plano P0.

## 1. Stack e trade-offs

| Camada | Escolha | Por quê | Alternativa descartada |
| --- | --- | --- | --- |
| Web app | Next.js 14 (App Router) + React 18 + TypeScript strict | Mesmo stack do outro produto da casa (Clinical 360), SSR do marketing, rotas de API no mesmo deploy | Vite + API separada: dois deploys, mais plumbing |
| UI | Tailwind 3 + componentes próprios (`components/ui`) com tokens em CSS variables | Tema claro/escuro sem duplicar classes; design editorial sem "cara de dashboard" | Biblioteca pronta (shadcn/MUI): mais peso visual e dependências |
| Validação | Zod 4 | Um schema para API, editor, viewer e JSON do banco | io-ts/valibot: menos conhecidos pela equipe |
| Banco/Auth/Storage | Neon Postgres + Neon Auth (Better Auth gerenciado) + Cloudflare R2 (ADR 0010) | Postgres com branches, login no mesmo banco, bucket privado no binding do Worker; autorização no servidor | Supabase (substituído: nunca rodou em produção e a hospedagem foi para Cloudflare) |
| Renderizador | Camadas DOM posicionadas com `transform: scale()` | Texto selecionável/acessível, vídeos nativos, mesma base no editor e viewer | Canvas raster: acessibilidade e vídeo piores |
| Testes | Vitest (unitário) + Playwright (E2E) | Rápidos, sem configuração pesada | Jest |
| Hospedagem | Cloudflare Workers via vinext (`wrangler.jsonc`) | Borda global, R2 junto para as mídias, rollback por versão (`wrangler rollback`) | Vercel: o plano inicial; OpenNext no Workers: mais maduro, porém mais pesado |

Regra: o servidor é a autoridade para papéis, acesso, assinatura, cotas e publicação. A UI apenas reflete.

## 2. Módulos

```
web-app (Next.js)
  marketing + auth + dashboard         app/, components/app
  editor                               components/editor, lib/editor
  shared-renderer                      components/renderer + lib/scene (schema, motor, transform, order)
  viewer (slides / story)              components/viewer
  billing + settings                   components/app/Configuracoes, lib/planos
api (app/api)
  auth + permissions + project CRUD    projects/, lib/api/servidor.ts
  scene revisions + publish            projects/[id]/scenes, projects/[id]/publish (funções SQL transacionais)
  asset ingest + media delivery       assets/upload, midias/*, share/[token]/midias/*, lib/midia, lib/armazenamento.ts
  share grants                         projects/[id]/share-links, share-links/[id], share/[token]
  audit logs                           audit_events (lib/api/servidor.ts#auditar)
infrastructure
  PostgreSQL (autorização no servidor) db/migrations
  object storage privado               R2 `MIDIAS` (servido por rotas que conferem permissão)
  worker / fila                        PENDENTE (thumbnails, transcodificação) — ver §7
  telemetria + backups + CI            .github/workflows/ci.yml; restore/branches do Neon; logs estruturados por requestId
```

## 3. Mapa de telas (seção 4.1)

| Rota | Tela | Estado |
| --- | --- | --- |
| `/` | Marketing: proposta, como funciona, planos, CTA | ✅ |
| `/login`, `/signup`, `/login?recuperar=1` | Autenticação com verificação de e-mail (fluxo demo) | ✅ |
| `/app` | Painel: busca, filtros (todos/recentes/arquivados), cards, estado vazio, ações com confirmação | ✅ |
| `/app/projects/:id` | Detalhes: capa, metadados, descrição, links ativos, ações | ✅ |
| `/app/projects/:id/edit` | Editor de 3 painéis + biblioteca inferior (tablet recolhe; celular só consome) | ✅ |
| `/app/projects/:id/share` | Compartilhamento: criar/revogar link, senha, validade | ✅ |
| `/app/projects/:id/apresentar` | Rota limpa para o autor apresentar | ✅ |
| `/p/:token` | Visualizador público não listado (indisponível / senha / pronto) | ✅ |
| `/app/settings` | Conta, plano e uso, créditos, tema, LGPD | ✅ |
| `/app/novo` | Novo projeto: formato, templates, importação de arquivos | ✅ |
| `/app/biblioteca`, `/app/compartilhados`, `/app/lixeira` | Arquivos do workspace, projetos com link, lixeira com restauração | ✅ |
| `/app/projects/:id/apresentador` | Visão do apresentador (notas, próxima tela, cronômetro) sincronizada por BroadcastChannel | ✅ |
| `/criar` | Criar com IA: prompt/texto/arquivo → roteiro editável → apresentação | ✅ |

## 4. Modelo de dados

Schema em `db/migrations/0000_base.sql` (seção 11.1): `users`, `workspaces`, `workspace_members` (dono, editores e visualizadores; convites em `workspace_invites`, migração 0004 — ver ADR 0011), `projects` (soft delete, `current_revision`, `published_revision`), `project_scenes` (rascunho, `content_json` validado, `order_index` único *deferrable* para reordenação transacional), `project_snapshots` (publicação imutável), `assets` (`storage_key` em bucket privado, status `queued|processing|ready|failed`), `share_links` (`token_hash`, `password_hash`, `expires_at`, `revoked_at`), `share_link_attempts`, `billing_accounts`, `audit_events`.

Integridade: toda consulta filtra por `workspace_id` no servidor **e** RLS no banco (defesa em profundidade). Funções `save_project_scenes` e `publish_project` (`0001_funcoes_transacionais.sql`) fazem o lock da linha do projeto, comparam `base_revision` e falham com `REVISION_CONFLICT:n` → HTTP 409 com `currentRevision`.

## 5. Contratos

- **Cena/documento**: `lib/scene/schema.ts` (schema v2, migração automática da v1 em `lib/scene/migrar.ts`) — `DocumentoProjeto { schemaVersion, mode: slides|story|explorar, theme, scenes[] }`; camadas `image | video | text | shape | hotspot | svg | model3d | lottie | embed`, com grupos, efeitos, gradientes, corte/máscara; até 8 `interactions` por camada (`trigger + conditions + do + transition`); transição `morph` casa camadas pelo nome entre telas.
- **IA**: `lib/ia/pedido.ts` (pedido/resposta de `/api/ai/roteiro`), `lib/ia/roteiro.ts` (roteiro → documento).
- **Validação semântica**: `lib/scene/validate.ts` — referências cruzadas, URLs só http(s), compatibilidade trigger/ação, `scrollThreshold` só em Story, rótulos de acessibilidade (aviso ao designer).
- **Motor**: `lib/scene/motor.ts` — reducer puro `executar(doc, estado, camada, interacao) → { estado, efeitos }`. Editor (preview) e viewer usam exatamente o mesmo contrato.
- **API**: `lib/api/contratos.ts` — envelope `{ data, error, requestId }`, códigos (400/401/403/404/409/413/429/5xx), schemas de cada rota da seção 13.1.

## 6. Plano P0 (status)

| Sprint | Escopo | Status |
| --- | --- | --- |
| 0 — fundação | TS strict, lint, format, testes, CI, README, ADRs, protótipo navegável, migrations, storage privado | ✅ |
| 1 — usuários e projetos | Auth real (Neon Auth), workspace, CRUD via `/api`, isolamento multi-tenant testado, seed | 🟡 rotas e login testados contra o Neon; falta ligar a UI de dados (`lib/api/cliente.ts`) |
| 2 — mídia e cenas | Upload pela rota do app (R2) + validação de MIME real + progresso; cenas/ordem/duplicação; autosave e revisão | 🟡 rotas e UI prontas no demo; falta worker de thumbnails |
| 3 — engine e viewer | Renderer compartilhado, hotspots, transições, Slides/Story, teclado/toque, pré-carregamento, fullscreen, E2E | ✅ (E2E em `e2e/fluxo.mjs`) |
| 4 — publicação e compartilhamento | Snapshot, links, senha, validade, revogação, entrega autorizada de mídia, rate limiting, audit | 🟡 lógica completa (demo + rotas); falta QA em staging real |
| 5 — beta fechado | Testes com designers reais, limites de plano, checkout, produção com backup/rollback | ⏳ |

## 7. Riscos e próximas dependências

1. **UI de dados ainda no modo demo.** As rotas `/api` já rodam contra o Neon (login, multi-tenant, 409, publicação, links, créditos); falta apontar painel/editor para `lib/api/cliente.ts`.
2. **Sessão no servidor**: a sessão já é cookie HttpOnly do Neon Auth e as rotas `/api` a conferem; o guard de páginas de `/app` continua no cliente (sem middleware do Next, por causa do vinext — ADR 0010).
3. **Variantes de mídia**: `finalize` marca `ready` sem gerar thumbnails. O viewer usa o original com lazy loading; cenas com muitas imagens 4K podem pesar. Worker (Sprint 2): sharp para thumbs/webp, ffmpeg para poster/transcodificação.
4. **Rate limiting** em memória por processo é suficiente para o beta; em produção multi-instância, mover para a borda (Cloudflare WAF / Rate Limiting) ou Redis.
5. **Decisões a validar antes de cobrar** (seção 20.1): nome e domínio, limites definitivos por plano, mercado/moeda/provedor de pagamento, retenção e termos de conteúdo autoral.
