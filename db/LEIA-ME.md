# Banco de dados (Neon Postgres) e armazenamento

## Migrações

- `migrations/0000_base.sql` — schema do MVP (seção 11 do blueprint): perfis, workspaces, projetos, cenas, snapshots, mídias, links, billing, auditoria e `garantir_conta()` (perfil + workspace no primeiro acesso).
- `migrations/0001_funcoes_transacionais.sql` — `save_project_scenes`, `publish_project` (optimistic concurrency por revisão) e `increment_share_views`.
- `migrations/0002_criativo_creditos_ia.sql` — modos/tipos do editor criativo, planos free/plus/pro/studio, créditos (`debitar_creditos`, saldo inicial por trigger) e registro de gerações de IA.
- `migrations/0003_custo_ia_por_debito.sql` — custo estimado em USD, modelo e tokens em cada débito de IA (`debitar_creditos_ia`, `registrar_uso_ia`), view `ai_margem_diaria` e boas-vindas do Free em 450 créditos (ver docs/economia-ia.md).
- Aplicar: `npm run db:migrar` (usa `DATABASE_URL_UNPOOLED` do `.env.local`; `-- --status` só lista). As aplicadas ficam em `public.schema_migrations` com o sha256 do arquivo; uma por transação; advisory lock impede dois migradores ao mesmo tempo.
- Novas mudanças: criar `000N_descricao.sql` sequencial. Nunca editar migração já aplicada (o script recusa).
- Antes de produção, teste num branch: `neon branches create --name teste-x --parent production --expires-at <data>`, `neon env pull --branch teste-x --file .env.teste.local`, `node --env-file=.env.teste.local db/migrar.mjs`, depois `npm run db:migrar` no production e `neon branches delete teste-x`.
- Sempre a conexão **direta** (`DATABASE_URL_UNPOOLED`, sem `-pooler`) para migrar; o app usa a do pooler (`DATABASE_URL`).

## Usuários e autorização

- Identidade, senha e sessões ficam no **Neon Auth** (Managed Better Auth, schema `neon_auth`, gerenciado pelo Neon — não criar tabelas nem triggers lá).
- `public.users.id` = `neon_auth."user".id` (FK com `on delete cascade`): excluir a conta no Neon Auth (`neon neon-auth user delete <id>`) apaga perfil, workspace, projetos, mídias (registros) e créditos.
- **Não há RLS.** O app conecta com um único papel e toda autorização é feita no servidor: `autenticar()` (lib/api/servidor.ts) resolve o workspace da sessão, e cada consulta de dados de cliente filtra por `workspace_id` desse workspace (ou pelo link de convidado já validado). As funções transacionais também recebem `p_workspace_id` e filtram por ele.
- `EXECUTE` das funções é revogado de `PUBLIC`: só o papel dono do schema (o do app) executa.
- O conteúdo das cenas (`project_scenes.content_json`, `project_snapshots.content_json`) é validado pela aplicação com `lib/scene/schema.ts`; o banco guarda `schema_version` para migrações futuras.
- Tokens de link: só o hash SHA-256 é gravado (`share_links.token_hash`). O token em texto aparece uma única vez, na criação.

## Mídias (Cloudflare R2)

- Bucket privado no binding `MIDIAS` do Worker (`obterBucketMidias()` em `lib/cf/ambiente.ts`), acessado só por `lib/armazenamento.ts`. Chave: `{workspace_id}/{asset_id}/original.ext`.
- Fora do Worker (dev no Node, testes): disco em `ARMAZENAMENTO_DEV_DIR` (padrão `.armazenamento-dev/`) ou memória (`ARMAZENAMENTO_DEV=memoria`). Em produção sem bucket e sem pasta explícita, o upload falha.
- Upload: `POST /api/assets/upload` com o arquivo no corpo. O servidor confere sessão, projeto, cota/tamanho do plano (antes de ler o corpo), MIME real por bytes mágicos, e o conteúdo dos formatos de texto (SVG sanitizado — só a versão limpa é gravada; glTF autocontido; JSON Lottie).
- Entrega: o bucket nunca gera URL. Dono: `GET /api/midias/:id` (sessão por cookie, `private, max-age=31536000, immutable`). Convidado: `GET /api/share/:token/midias/:id` — só com link ativo, grant de senha quando houver e só para mídias que aparecem na versão publicada (`private, max-age=300`, então revogar corta em minutos mesmo para quem já abriu). Range (vídeo), ETag/304, `nosniff` e CSP `sandbox`.
- Excluir mídia é soft delete; a rotina de retenção (pendente) remove o objeto do R2 depois do prazo.
