-- 0002: editor criativo (SVG, 3D, Lottie, modo Explorar), novos planos, créditos de IA.
-- Idempotente onde o Postgres permite.
-- Os tipos de arquivo aceitos ficam no código (lib/api/contratos.ts MIMES_ACEITOS) e são conferidos
-- pelo servidor no upload (bytes mágicos / sanitização); o R2 não tem lista de MIME por bucket.

-- ---------- modos e tipos de mídia ----------
alter type project_mode add value if not exists 'explorar';
alter type media_type add value if not exists 'svg';
alter type media_type add value if not exists 'model3d';
alter type media_type add value if not exists 'lottie';

-- ---------- planos: free / plus / pro / studio ----------
alter table public.workspaces drop constraint if exists workspaces_plan_id_check;
update public.workspaces set plan_id = 'pro' where plan_id = 'creator';
alter table public.workspaces add constraint workspaces_plan_id_check check (plan_id in ('free', 'plus', 'pro', 'studio'));

-- ---------- créditos (saldo compartilhado por workspace + extrato imutável) ----------
create table if not exists public.credit_balances (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  amount int not null check (amount <> 0),        -- negativo = gasto; positivo = compra, renovação ou estorno
  reason text not null default '',
  balance_after int not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_transactions_workspace_idx on public.credit_transactions(workspace_id, created_at desc);

-- Registro das gerações de IA (custo, modelo, resultado) para suporte e auditoria. Não guarda o prompt.
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('roteiro', 'tela', 'reescrever', 'imagem', 'video')),
  model text,
  credits int not null default 0,
  status text not null check (status in ('ok', 'recusado', 'erro', 'local')),
  created_at timestamptz not null default now()
);
create index if not exists ai_generations_workspace_idx on public.ai_generations(workspace_id, created_at desc);
create index if not exists ai_generations_user_idx on public.ai_generations(user_id);

-- Debita (p_custo > 0) ou estorna/credita (p_custo < 0) de forma atômica.
-- Saldo insuficiente → exceção 'saldo_insuficiente' e nada muda.
create or replace function public.debitar_creditos(p_workspace uuid, p_custo int, p_motivo text)
returns int
language plpgsql set search_path = public as $$
declare v_saldo int;
begin
  if p_custo = 0 then
    select balance into v_saldo from public.credit_balances where workspace_id = p_workspace;
    return coalesce(v_saldo, 0);
  end if;
  insert into public.credit_balances (workspace_id) values (p_workspace) on conflict (workspace_id) do nothing;
  select balance into v_saldo from public.credit_balances where workspace_id = p_workspace for update;
  if v_saldo - p_custo < 0 then raise exception 'saldo_insuficiente' using errcode = 'P0001'; end if;
  update public.credit_balances set balance = v_saldo - p_custo, updated_at = now() where workspace_id = p_workspace;
  insert into public.credit_transactions (workspace_id, amount, reason, balance_after)
  values (p_workspace, -p_custo, left(coalesce(p_motivo, ''), 200), v_saldo - p_custo);
  return v_saldo - p_custo;
end $$;

-- Créditos de cadastro (plano grátis: 400) para todo workspace novo.
create or replace function public.creditos_iniciais() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.credit_balances (workspace_id, balance) values (new.id, 400) on conflict (workspace_id) do nothing;
  insert into public.credit_transactions (workspace_id, amount, reason, balance_after) values (new.id, 400, 'Créditos de boas-vindas', 400);
  return new;
end $$;
drop trigger if exists on_workspace_created_credits on public.workspaces;
create trigger on_workspace_created_credits after insert on public.workspaces for each row execute function public.creditos_iniciais();

-- Workspaces que já existiam começam com o saldo de cadastro.
insert into public.credit_balances (workspace_id, balance)
select id, 400 from public.workspaces
on conflict (workspace_id) do nothing;

-- Só o papel do app executa as funções (nenhum outro papel do branch herda acesso por PUBLIC).
revoke execute on function public.debitar_creditos(uuid, int, text) from public;
revoke execute on function public.creditos_iniciais() from public;
