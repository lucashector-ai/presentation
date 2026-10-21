-- 0004: colaboração — convites para o workspace (por e-mail ou por link) e aceitar convite com limite de membros.
-- Aditiva: uma tabela nova, índices e funções novas. workspace_members (0000) já existia com os papéis
-- owner/editor/viewer; nada existente é alterado ou apagado.
--
-- O token do convite nunca é gravado: só o sha256 (como nos links de compartilhamento). Convite por e-mail só pode
-- ser aceito pela conta com aquele e-mail e vale uma vez; convite por link (email null) vale para quem tiver o link
-- até expirar ou ser revogado. O limite de membros vem do plano (lib/planos.ts) e é conferido aqui, com o workspace
-- travado, para dois aceites ao mesmo tempo não passarem do limite.

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text check (email is null or (length(email) between 3 and 320 and email = lower(email))),
  role workspace_role not null default 'editor' check (role in ('editor', 'viewer')),
  token_hash text not null unique,
  -- opcional: projeto para onde levar quem aceitar ("convidar para este projeto")
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz
);
create index if not exists workspace_invites_workspace_idx on public.workspace_invites(workspace_id, created_at desc);

-- Aceita um convite (token já em hash). Devolve o workspace, o papel, o projeto do convite e se a pessoa já era membro.
-- Erros: CONVITE_INVALIDO (não existe, expirou, revogado ou já usado), CONVITE_OUTRO_EMAIL, LIMITE_MEMBROS.
create or replace function public.aceitar_convite(p_token_hash text, p_user_id uuid, p_email text, p_limite int)
returns table (ws_id uuid, papel workspace_role, projeto_id uuid, ja_membro boolean)
language plpgsql set search_path = public as $$
declare
  v_convite public.workspace_invites%rowtype;
  v_papel workspace_role;
  v_total int;
begin
  select * into v_convite from public.workspace_invites i
  where i.token_hash = p_token_hash and i.revoked_at is null and i.expires_at > now()
    and (i.email is null or i.accepted_at is null)
  for update;
  if v_convite.id is null then raise exception 'CONVITE_INVALIDO' using errcode = 'P0002'; end if;
  if v_convite.email is not null and v_convite.email <> lower(coalesce(p_email, '')) then
    raise exception 'CONVITE_OUTRO_EMAIL' using errcode = 'P0001';
  end if;

  -- trava o workspace: aceites simultâneos contam um de cada vez
  perform 1 from public.workspaces w where w.id = v_convite.workspace_id for update;

  select m.role into v_papel from public.workspace_members m where m.workspace_id = v_convite.workspace_id and m.user_id = p_user_id;
  if v_papel is not null then
    if v_convite.email is not null then
      update public.workspace_invites set accepted_at = now(), accepted_by = p_user_id where id = v_convite.id;
    end if;
    return query select v_convite.workspace_id, v_papel, v_convite.project_id, true;
    return;
  end if;

  select count(*) into v_total from public.workspace_members m where m.workspace_id = v_convite.workspace_id;
  if v_total >= p_limite then raise exception 'LIMITE_MEMBROS' using errcode = 'P0001'; end if;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_convite.workspace_id, p_user_id, v_convite.role);
  if v_convite.email is not null then
    update public.workspace_invites set accepted_at = now(), accepted_by = p_user_id where id = v_convite.id;
  end if;
  return query select v_convite.workspace_id, v_convite.role, v_convite.project_id, false;
end $$;

revoke execute on function public.aceitar_convite(text, uuid, text, int) from public;
