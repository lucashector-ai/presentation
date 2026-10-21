# Banco de dados (Supabase / Postgres)

- `migrations/0000_base.sql` — schema completo do MVP (seção 11 do blueprint), RLS, trigger de bootstrap de conta e bucket privado `midias`.
- Aplicar: SQL Editor do painel do Supabase, ou `supabase db push` com a CLI apontando para o projeto.
- Novas mudanças: criar `000N_descricao.sql` sequencial. Nunca editar migration já aplicada em produção.
- O conteúdo das cenas (`project_scenes.content_json`, `project_snapshots.content_json`) é validado pela aplicação com `lib/scene/schema.ts`; o banco guarda `schema_version` para migrações futuras.
- Tokens de link: só o hash SHA-256 é gravado (`share_links.token_hash`). O token em texto aparece uma única vez, na criação.
- Convidados não têm sessão: toda leitura de snapshot e mídia passa pelo servidor (`/api/share/:token`), que valida o token e emite URLs assinadas curtas.
