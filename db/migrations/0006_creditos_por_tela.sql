-- 1 crédito = 1 tela criada pela IA (decisão de 21/10/2026, ver docs/economia-ia.md).
-- Ações de IA grátis (roteiro, reescrever texto) não geram débito, mas o custo delas continua registrado
-- aqui, para a margem real (view ai_margem_diaria) incluir tudo o que a plataforma paga à API.

create table if not exists public.ai_usos (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_action text not null,                         -- roteiro | texto | ...
  ai_model text,
  ai_cost_usd numeric(12, 6),
  ai_cost_source text not null default 'previsto' check (ai_cost_source in ('previsto', 'uso')),
  ai_input_tokens int,
  ai_output_tokens int,
  ai_cache_read_tokens int,
  ai_cache_write_tokens int,
  created_at timestamptz not null default now()
);
create index if not exists ai_usos_criado_idx on public.ai_usos(created_at desc);
create index if not exists ai_usos_workspace_idx on public.ai_usos(workspace_id, created_at desc);

-- margem por dia, ação e modelo: débitos (com créditos) + usos grátis (0 crédito)
create or replace view public.ai_margem_diaria as
with todos as (
  select created_at, ai_action, ai_model, -amount as creditos, ai_cost_usd, ai_cost_source
    from public.credit_transactions
   where amount < 0 and ai_action is not null
  union all
  select created_at, ai_action, ai_model, 0, ai_cost_usd, ai_cost_source
    from public.ai_usos
)
select date_trunc('day', created_at) as dia,
       ai_action as acao,
       ai_model as modelo,
       count(*) as debitos,
       sum(creditos) as creditos,
       sum(ai_cost_usd) as custo_usd,
       round(sum(ai_cost_usd) / nullif(sum(creditos), 0), 6) as usd_por_credito,
       count(*) filter (where ai_cost_source = 'previsto') as sem_uso_medido
  from todos
 group by 1, 2, 3;

-- boas-vindas do Free: 50 créditos (= 50 telas)
create or replace function public.creditos_iniciais() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.credit_balances (workspace_id, balance) values (new.id, 50) on conflict (workspace_id) do nothing;
  insert into public.credit_transactions (workspace_id, amount, reason, balance_after) values (new.id, 50, 'Créditos de boas-vindas', 50);
  return new;
end $$;
revoke execute on function public.creditos_iniciais() from public;
