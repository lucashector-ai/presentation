# ADR 0010 — Saída do Supabase: Neon Postgres + Neon Auth + Cloudflare R2

**Status:** aceito · **Data:** 2026-10-21 · Substitui as partes de Supabase das ADRs 0001, 0002 e 0003.

## Contexto
O app nunca rodou contra um Supabase real (só modo demo) e a hospedagem vai para Cloudflare Workers (vinext). O banco já estava no Neon (`lib/db/neon.ts`).

## Decisão
- **Banco**: Neon Postgres, migrações SQL em `db/migrations` aplicadas por `npm run db:migrar` (conexão direta, tabela `schema_migrations`). As funções transacionais continuam em PL/pgSQL e são chamadas pelo driver HTTP (`sql()`), uma chamada = uma transação.
- **Sem RLS**: o app usa um único papel; a autorização é do servidor. `autenticar()` lê a sessão e resolve o workspace (`garantir_conta`); toda consulta filtra por `workspace_id` da sessão; ids fora do formato UUID dão 404 antes de tocar no banco; as funções SQL recebem o workspace e filtram por ele.
- **Login**: Neon Auth (Managed Better Auth), e-mail e senha + Google (credenciais compartilhadas de desenvolvimento). Integração só com o toolkit agnóstico `@neondatabase/auth/server` (`handleAuthProxyRequest` em `/api/auth/[...path]`, `createAuthServer().getSession()` por requisição) e o cliente `@neondatabase/auth` sem adaptador de React. **Não usamos** `@neondatabase/auth/next` (`createNeonAuth`, `auth.middleware()`/`proxy.ts`, `next/headers`), que exige Next ≥ 16 e internals do Next — incompatível com Next 14 e arriscado no vinext. Consequências: não há middleware protegendo `/app` no servidor (o guard de página continua no cliente; os dados são protegidos nas rotas `/api`), e o retorno do OAuth é concluído pelo `getSession()` do cliente (ele repassa `neon_auth_session_verifier` ao proxy).
- **Sessão**: cookies `__Secure-neon-auth.*` HttpOnly, Secure, SameSite=Lax no domínio do app; nada de token no `localStorage`. Mutações exigem `Origin` do app (CSRF).
- **Arquivos**: Cloudflare R2 pelo binding `MIDIAS` (`lib/armazenamento.ts`). Sem URL assinada: upload pelo app (`POST /api/assets/upload`, validação de tipo/tamanho/conteúdo antes de gravar, stream com `FixedLengthStream` no Worker) e entrega por rotas que conferem permissão a cada pedido.

## Consequências
+ Revogar um link corta o acesso à mídia na rota (com até 5 min de cache privado do navegador), em vez de esperar URLs assinadas expirarem.
+ Um provedor a menos; banco, login e sessões ficam no mesmo Postgres e ramificam juntos nos branches do Neon.
− Todo byte de mídia passa pelo Worker (limite de corpo de requisição do plano Cloudflare: 100 MB no Free/Pro). Arquivos maiores que isso (planos Pro/Studio permitem até 500 MB/1 GB) precisarão de multipart do R2 ou URL pré-assinada via API S3 do R2.
− `@neondatabase/auth` está em beta (0.6.0-beta, versão fixada) e traz `@supabase/auth-js` como dependência transitiva (adaptador de compatibilidade do SDK, não usado pelo app).
