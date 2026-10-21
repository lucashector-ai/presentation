# Arquitetura — Plataforma de Apresentações Criativas

Documento do "primeiro entregável" da instrução mestre (seção 20): stack e trade-offs, estrutura de pastas, schema relacional, contratos TS, mapa de telas e plano P0.

## 1. Stack e trade-offs

| Camada | Escolha | Por quê | Alternativa descartada |
| --- | --- | --- | --- |
| Web app | Next.js 14 (App Router) + React 18 + TypeScript strict | Mesmo stack do outro produto da casa (Clinical 360), SSR do marketing, rotas de API no mesmo deploy | Vite + API separada: dois deploys, mais plumbing |
| UI | Tailwind 3 + componentes próprios (`components/ui`) com tokens em CSS variables | Tema claro/escuro sem duplicar classes; design editorial sem "cara de dashboard" | Biblioteca pronta (shadcn/MUI): mais peso visual e dependências |
| Validação | Zod 4 | Um schema para API, editor, viewer e JSON do banco | io-ts/valibot: menos conhecidos pela equipe |
| Banco/Auth/Storage | Supabase (Postgres + Auth + Storage privado) | Postgres gerenciado, RLS, bucket privado com URLs assinadas, já usado na casa | Prisma + S3 + Auth próprio: mais código para manter |
| Renderizador | Camadas DOM posicionadas com `transform: scale()` | Texto selecionável/acessível, vídeos nativos, mesma base no editor e viewer | Canvas raster: acessibilidade e vídeo piores |
| Testes | Vitest (unitário) + Playwright (E2E) | Rápidos, sem configuração pesada | Jest |
| Hospedagem | Vercel (sugerido) | Deploy por branch, rollback por promote | Railway/Fly: ok, mas sem preview automático por PR |

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
  asset ingest + signed media delivery assets/*, lib/midia
  share grants                         projects/[id]/share-links, share-links/[id], share/[token]
  audit logs                           audit_events (lib/api/servidor.ts#auditar)
infrastructure
  PostgreSQL + RLS                     supabase/migrations
  object storage privado               bucket `midias` (URLs assinadas de 15 min)
  worker / fila                        PENDENTE (thumbnails, transcodificação) — ver §7
  telemetria + backups + CI            .github/workflows/ci.yml; backups do Supabase; logs estruturados por requestId
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
| `/app/settings` | Conta, plano e uso, tema, LGPD | ✅ |

## 4. Modelo de dados

Schema em `supabase/migrations/0000_base.sql` (seção 11.1): `users`, `workspaces`, `workspace_members` (Fase 2), `projects` (soft delete, `current_revision`, `published_revision`), `project_scenes` (rascunho, `content_json` validado, `order_index` único *deferrable* para reordenação transacional), `project_snapshots` (publicação imutável), `assets` (`storage_key` em bucket privado, status `queued|processing|ready|failed`), `share_links` (`token_hash`, `password_hash`, `expires_at`, `revoked_at`), `share_link_attempts`, `billing_accounts`, `audit_events`.

Integridade: toda consulta filtra por `workspace_id` no servidor **e** RLS no banco (defesa em profundidade). Funções `save_project_scenes` e `publish_project` (`0001_funcoes_transacionais.sql`) fazem o lock da linha do projeto, comparam `base_revision` e falham com `REVISION_CONFLICT:n` → HTTP 409 com `currentRevision`.

## 5. Contratos

- **Cena/documento**: `lib/scene/schema.ts` — `DocumentoProjeto { schemaVersion, mode, scenes[] }`; camadas `image | video | text | shape | hotspot`; `Interacao = trigger + conditions + do (ação) + transition`; matriz `ACOES_POR_TRIGGER`.
- **Validação semântica**: `lib/scene/validate.ts` — referências cruzadas, URLs só http(s), compatibilidade trigger/ação, `scrollThreshold` só em Story, rótulos de acessibilidade (aviso ao designer).
- **Motor**: `lib/scene/motor.ts` — reducer puro `executar(doc, estado, camada, interacao) → { estado, efeitos }`. Editor (preview) e viewer usam exatamente o mesmo contrato.
- **API**: `lib/api/contratos.ts` — envelope `{ data, error, requestId }`, códigos (400/401/403/404/409/413/429/5xx), schemas de cada rota da seção 13.1.

## 6. Plano P0 (status)

| Sprint | Escopo | Status |
| --- | --- | --- |
| 0 — fundação | TS strict, lint, format, testes, CI, README, ADRs, protótipo navegável, migrations, storage privado | ✅ |
| 1 — usuários e projetos | Auth real (Supabase), workspace, CRUD via `/api`, isolamento multi-tenant testado, seed | 🟡 rotas escritas; falta ligar UI (`lib/api/cliente.ts`) e testes de integração com banco |
| 2 — mídia e cenas | Upload presigned + validação de MIME real + progresso; cenas/ordem/duplicação; autosave e revisão | 🟡 rotas e UI prontas no demo; falta worker de thumbnails |
| 3 — engine e viewer | Renderer compartilhado, hotspots, transições, Slides/Story, teclado/toque, pré-carregamento, fullscreen, E2E | ✅ (E2E em `e2e/fluxo.mjs`) |
| 4 — publicação e compartilhamento | Snapshot, links, senha, validade, revogação, entrega autorizada de mídia, rate limiting, audit | 🟡 lógica completa (demo + rotas); falta QA em staging real |
| 5 — beta fechado | Testes com designers reais, limites de plano, checkout, produção com backup/rollback | ⏳ |

## 7. Riscos e próximas dependências

1. **Rotas `/api` nunca rodaram contra um Supabase real.** Primeira tarefa da Sprint 1: criar projeto Supabase de staging, aplicar migrations, escrever testes de integração (auth, multi-tenant, 409, publicação, links) e só então apontar a UI para `lib/api/cliente.ts`.
2. **Sessão no servidor**: hoje o guard de `/app` é no cliente. Com Supabase Auth real, adotar `@supabase/ssr` (cookies HttpOnly) e `middleware.ts` (ADR 0002).
3. **Variantes de mídia**: `finalize` marca `ready` sem gerar thumbnails. O viewer usa o original com lazy loading; cenas com muitas imagens 4K podem pesar. Worker (Sprint 2): sharp para thumbs/webp, ffmpeg para poster/transcodificação.
4. **Rate limiting** em memória por processo é suficiente para o beta; em produção multi-instância, mover para a borda (Vercel WAF) ou Redis.
5. **Decisões a validar antes de cobrar** (seção 20.1): nome e domínio, limites definitivos por plano, mercado/moeda/provedor de pagamento, retenção e termos de conteúdo autoral.
