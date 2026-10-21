# ADR 0002 — Autenticação e autorização

**Status:** aceito · **Data:** 2026-10-21 · Partes de Supabase substituídas pela ADR 0010 (Neon + R2).

## Decisão
- **Criadores**: Supabase Auth (e-mail + senha com verificação; social depois). A API aceita `Authorization: Bearer <access_token>`; `autenticar()` valida com `auth.getUser` e resolve o workspace por `workspace_members`.
- **Autorização**: sempre no servidor, por recurso e workspace (`projetoDoWorkspace`); 404 sem vazar existência. RLS no banco como defesa em profundidade.
- **Convidados**: não têm conta. O token do link é a credencial; só o hash SHA-256 é gravado. Links com senha emitem um **grant** (cookie HttpOnly, SameSite=Lax, HMAC com `SHARE_GRANT_SECRET`, 2 h) após `POST /api/share/:token/unlock`. Tentativas limitadas por link+IP (5 em 15 min) e por processo.
- **Modo demo**: sessão fictícia em `localStorage`; guard no cliente.

## Pendente (Sprint 1)
Adotar `@supabase/ssr` para sessão em cookies HttpOnly e `middleware.ts` protegendo `/app` no servidor; política de senha e encerramento de sessão; CSRF para rotas com cookie (o grant só autoriza GET de leitura, então o risco é baixo).
