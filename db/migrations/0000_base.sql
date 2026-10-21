-- =====================================================================
-- Plataforma de Apresentações Criativas — schema base (MVP)
-- Seção 11 do blueprint. Postgres no Neon. Idempotente onde possível.
-- Regras: toda tabela de cliente filtra por workspace_id; soft delete em
-- projetos; conteúdo de cenas em JSON validado pela aplicação (schema_version).
--
-- Usuários vêm do Neon Auth (Managed Better Auth, schema neon_auth): public.users
-- guarda o perfil do app com o MESMO id de neon_auth."user". Não há RLS: o app
-- conecta com um único papel e TODA autorização é feita no servidor
-- (lib/api/servidor.ts: autenticar + filtros por workspace_id em cada consulta).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type project_mode as enum ('slides', 'story');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_status as enum ('queued', 'processing', 'ready', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_type as enum ('image', 'video', 'gif');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workspace_role as enum ('owner', 'editor', 'viewer'); -- editor/viewer: Fase 2
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

-- ---------- users (perfil; identidade e senha ficam em neon_auth."user") ----------
create table if not exists public.users (
  id uuid primary key references neon_auth."user"(id) on delete cascade,
  name text not null default '',
  email text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- workspaces ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  -- cascade: excluir a conta no Neon Auth remove perfil, workspace e tudo que pende dele
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  plan_id text not null default 'free' check (plan_id in ('free', 'creator', 'studio')),
  created_at timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_user_id);

-- Fase 2: equipes. Já criada para o modelo estar pronto; no MVP só existe a linha do owner.
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role workspace_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

-- ---------- assets ----------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  storage_key text not null unique,            -- chave no bucket privado (R2): {workspace_id}/{asset_id}/original.ext
  media_type media_type not null,
  mime text not null,
  bytes bigint not null check (bytes > 0),
  width int,
  height int,
  duration numeric(10,3),
  status asset_status not null default 'queued',
  name text not null default '',
  metadata_json jsonb not null default '{}'::jsonb, -- variantes, poster, erro de processamento
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz                        -- fila de limpeza após retenção
);
create index if not exists assets_workspace_idx on public.assets(workspace_id, created_at desc);
create index if not exists assets_status_idx on public.assets(status) where status in ('queued', 'processing');

-- ---------- projects ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  mode project_mode not null default 'slides',
  status project_status not null default 'draft',
  cover_asset_id uuid references public.assets(id) on delete set null,
  current_revision int not null default 1,      -- revisão técnica do rascunho (optimistic concurrency)
  published_revision int,                       -- aponta para project_snapshots.revision
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, slug)
);
create index if not exists projects_workspace_updated_idx on public.projects(workspace_id, updated_at desc) where deleted_at is null;

-- ---------- project_scenes (rascunho editável) ----------
create table if not exists public.project_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_key text not null,                      -- id estável usado pelas interações (ex.: "scene-04")
  order_index int not null,
  title text not null default '',
  width int not null,
  height int not null,
  background text not null default '#101820',
  content_json jsonb not null,                  -- cena completa validada por lib/scene/schema.ts
  schema_version int not null default 1,
  unique (project_id, scene_key),
  unique (project_id, order_index) deferrable initially deferred  -- reordenação transacional
);
create index if not exists project_scenes_project_idx on public.project_scenes(project_id, order_index);

-- ---------- project_snapshots (publicação imutável) ----------
create table if not exists public.project_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision int not null,
  content_json jsonb not null,                  -- DocumentoProjeto completo
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  unique (project_id, revision)
);

-- ---------- share_links ----------
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,              -- sha256 hex do token; o token nunca é gravado
  token_preview text not null,                  -- 4 primeiros caracteres, só para a UI
  password_hash text,                           -- pbkdf2/argon2; null = sem senha
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists share_links_project_idx on public.share_links(project_id, created_at desc);

-- tentativas de senha por link (rate limit persistente; complementa o limite por IP na borda)
create table if not exists public.share_link_attempts (
  id bigserial primary key,
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  ip_hash text not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists share_link_attempts_idx on public.share_link_attempts(share_link_id, ip_hash, created_at desc);

-- ---------- billing ----------
create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  provider text not null default 'manual',
  customer_ref text,
  status subscription_status not null default 'trial',
  renewal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- auditoria ----------
create table if not exists public.audit_events (
  id bigserial primary key,
  actor_id uuid references public.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  event_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,  -- NUNCA tokens, senhas ou URLs privadas
  created_at timestamptz not null default now()
);
create index if not exists audit_events_project_idx on public.audit_events(project_id, created_at desc);

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists billing_updated_at on public.billing_accounts;
create trigger billing_updated_at before update on public.billing_accounts for each row execute function public.set_updated_at();

-- ---------- bootstrap: perfil + workspace no primeiro acesso ----------
-- No Supabase isto era um trigger em auth.users. O schema neon_auth é gerenciado pelo Neon,
-- então não penduramos trigger lá: o servidor chama esta função (idempotente) ao autenticar
-- e recebe o workspace do usuário. Só aceita ids que existem em neon_auth."user".
create or replace function public.garantir_conta(p_user_id uuid, p_email text, p_name text)
returns uuid
language plpgsql set search_path = public as $$
declare ws uuid;
begin
  select m.workspace_id into ws from public.workspace_members m where m.user_id = p_user_id order by m.created_at limit 1;
  if ws is not null then return ws; end if;

  -- serializa o primeiro acesso do mesmo usuário (duas abas ao mesmo tempo não criam dois workspaces)
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select m.workspace_id into ws from public.workspace_members m where m.user_id = p_user_id order by m.created_at limit 1;
  if ws is not null then return ws; end if;

  insert into public.users (id, email, name, email_verified_at)
  select u.id, coalesce(nullif(p_email, ''), u.email), coalesce(nullif(p_name, ''), u.name, ''), case when u."emailVerified" then now() end
  from neon_auth."user" u where u.id = p_user_id
  on conflict (id) do nothing;
  if not found and not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'USUARIO_INEXISTENTE' using errcode = 'P0002';
  end if;

  insert into public.workspaces (owner_user_id, name) values (p_user_id, 'Meu espaço') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, p_user_id, 'owner');
  insert into public.billing_accounts (workspace_id) values (ws);
  return ws;
end $$;
