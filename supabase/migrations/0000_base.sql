-- =====================================================================
-- Plataforma de Apresentações Criativas — schema base (MVP)
-- Seção 11 do blueprint. Postgres (Supabase). Idempotente onde possível.
-- Regras: toda tabela de cliente filtra por workspace_id; soft delete em
-- projetos; conteúdo de cenas em JSON validado pela aplicação (schema_version).
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

-- ---------- users (perfil; autenticação fica em auth.users) ----------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- workspaces ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
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
  storage_key text not null unique,            -- caminho no bucket privado: {workspace_id}/{asset_id}/original.ext
  media_type media_type not null,
  mime text not null,
  bytes bigint not null check (bytes > 0),
  width int,
  height int,
  duration numeric(10,3),
  status asset_status not null default 'queued',
  name text not null default '',
  metadata_json jsonb not null default '{}'::jsonb, -- variantes, poster, erro de processamento
  created_by uuid references public.users(id),
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
  created_by uuid references public.users(id),
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
  created_by uuid references public.users(id),
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
  actor_id uuid references public.users(id),
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

-- ---------- bootstrap: perfil + workspace ao criar conta ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  insert into public.users (id, email, name, email_verified_at)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), new.email_confirmed_at)
  on conflict (id) do nothing;
  insert into public.workspaces (owner_user_id, name) values (new.id, 'Meu espaço') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  insert into public.billing_accounts (workspace_id) values (ws);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- RLS: defesa em profundidade (o servidor já autoriza; o banco garante) ----------
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.assets enable row level security;
alter table public.projects enable row level security;
alter table public.project_scenes enable row level security;
alter table public.project_snapshots enable row level security;
alter table public.share_links enable row level security;
alter table public.share_link_attempts enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.is_member(ws uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

drop policy if exists users_self on public.users;
create policy users_self on public.users for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists workspaces_member on public.workspaces;
create policy workspaces_member on public.workspaces for select using (public.is_member(id));
drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_owner_update on public.workspaces for update using (owner_user_id = auth.uid());

drop policy if exists members_read on public.workspace_members;
create policy members_read on public.workspace_members for select using (public.is_member(workspace_id));

drop policy if exists assets_member on public.assets;
create policy assets_member on public.assets for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

drop policy if exists projects_member on public.projects;
create policy projects_member on public.projects for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

drop policy if exists scenes_member on public.project_scenes;
create policy scenes_member on public.project_scenes for all
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id)));

drop policy if exists snapshots_member on public.project_snapshots;
create policy snapshots_member on public.project_snapshots for select
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id)));

drop policy if exists links_member on public.share_links;
create policy links_member on public.share_links for select
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_member(p.workspace_id)));
-- criação/revogação de links e desbloqueio de convidados passam só pelo servidor (service role).

drop policy if exists billing_member on public.billing_accounts;
create policy billing_member on public.billing_accounts for select using (public.is_member(workspace_id));

drop policy if exists audit_member on public.audit_events;
create policy audit_member on public.audit_events for select using (workspace_id is not null and public.is_member(workspace_id));

-- share_link_attempts: sem políticas = só service role.

-- ---------- Storage: bucket PRIVADO de mídias ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midias', 'midias', false, 524288000, array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Dono do workspace lê/escreve apenas na pasta do próprio workspace ({workspace_id}/...).
drop policy if exists midias_workspace_rw on storage.objects;
create policy midias_workspace_rw on storage.objects for all
  using (bucket_id = 'midias' and public.is_member((split_part(name, '/', 1))::uuid))
  with check (bucket_id = 'midias' and public.is_member((split_part(name, '/', 1))::uuid));
-- Convidados nunca acessam o bucket direto: o servidor gera URLs assinadas curtas após validar o token.
