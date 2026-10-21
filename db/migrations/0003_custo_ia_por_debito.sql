-- 0003: custo de IA em cada débito de créditos (para acompanhar a margem) e créditos de boas-vindas do Free.
-- Aditiva: colunas novas e opcionais em credit_transactions, funções novas, uma view de leitura e o novo valor
-- de boas-vindas só para workspaces criados daqui em diante. Nada existente é apagado ou reescrito.

-- ---------- custo estimado e modelo em cada débito de IA ----------
alter table public.credit_transactions
  add column if not exists ai_action text,                 -- roteiro | design | tela | texto
  add column if not exists ai_model text,                  -- modelo que respondeu (ou o planejado, antes da resposta)
  add column if not exists ai_cost_usd numeric(12, 6),     -- custo estimado em USD (tokens × preço do modelo)
  add column if not exists ai_cost_source text,            -- previsto (antes da chamada) | uso (medido na resposta)
  add column if not exists ai_input_tokens int,
  add column if not exists ai_output_tokens int,
  add column if not exists ai_cache_read_tokens int,
  add column if not exists ai_cache_write_tokens int;

alter table public.credit_transactions drop constraint if exists credit_transactions_ai_cost_source_check;
alter table public.credit_transactions add constraint credit_transactions_ai_cost_source_check check (ai_cost_source is null or ai_cost_source in ('previsto', 'uso'));

create index if not exists credit_transactions_ia_idx on public.credit_transactions(created_at desc) where ai_action is not null;

-- Debita créditos de uma ação de IA já com a previsão de custo e o modelo planejado; devolve o saldo e o id do
-- lançamento (para `registrar_uso_ia` gravar o uso medido depois da resposta). Mesma regra de `debitar_creditos`:
-- lock da linha do saldo e exceção 'saldo_insuficiente' sem mudar nada.
create or replace function public.debitar_creditos_ia(p_workspace uuid, p_custo int, p_motivo text, p_acao text, p_modelo text, p_custo_usd numeric)
returns table (saldo int, transacao bigint)
language plpgsql set search_path = public as $$
declare v_saldo int; v_id bigint;
begin
  if p_custo is null or p_custo <= 0 then raise exception 'custo_invalido' using errcode = '22023'; end if;
  insert into public.credit_balances (workspace_id) values (p_workspace) on conflict (workspace_id) do nothing;
  select b.balance into v_saldo from public.credit_balances b where b.workspace_id = p_workspace for update;
  if v_saldo - p_custo < 0 then raise exception 'saldo_insuficiente' using errcode = 'P0001'; end if;
  update public.credit_balances set balance = v_saldo - p_custo, updated_at = now() where workspace_id = p_workspace;
  insert into public.credit_transactions (workspace_id, amount, reason, balance_after, ai_action, ai_model, ai_cost_usd, ai_cost_source)
  values (p_workspace, -p_custo, left(coalesce(p_motivo, ''), 200), v_saldo - p_custo, left(p_acao, 40), left(p_modelo, 80), p_custo_usd, 'previsto')
  returning id into v_id;
  return query select v_saldo - p_custo, v_id;
end $$;

-- Troca a previsão pelo uso medido na resposta do modelo (só em débitos de IA do próprio workspace).
create or replace function public.registrar_uso_ia(p_workspace uuid, p_transacao bigint, p_modelo text, p_custo_usd numeric, p_entrada int, p_saida int, p_cache_leitura int, p_cache_escrita int)
returns void
language sql set search_path = public as $$
  update public.credit_transactions
     set ai_model = left(p_modelo, 80), ai_cost_usd = p_custo_usd, ai_cost_source = 'uso',
         ai_input_tokens = p_entrada, ai_output_tokens = p_saida, ai_cache_read_tokens = p_cache_leitura, ai_cache_write_tokens = p_cache_escrita
   where id = p_transacao and workspace_id = p_workspace and amount < 0 and ai_action is not null;
$$;

-- Margem por dia, ação e modelo: créditos debitados (sem descontar estornos, que ficam em linhas próprias),
-- custo estimado em USD e USD por crédito (teto de custo do crédito: US$ 0,002; ver docs/economia-ia.md).
create or replace view public.ai_margem_diaria as
select date_trunc('day', created_at) as dia,
       ai_action as acao,
       ai_model as modelo,
       count(*) as debitos,
       sum(-amount) as creditos,
       sum(ai_cost_usd) as custo_usd,
       round(sum(ai_cost_usd) / nullif(sum(-amount), 0), 6) as usd_por_credito,
       count(*) filter (where ai_cost_source = 'previsto') as sem_uso_medido
  from public.credit_transactions
 where amount < 0 and ai_action is not null
 group by 1, 2, 3;

-- ---------- Free: 450 créditos de boas-vindas (2 apresentações de 10 telas) para workspaces novos ----------
create or replace function public.creditos_iniciais() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.credit_balances (workspace_id, balance) values (new.id, 450) on conflict (workspace_id) do nothing;
  insert into public.credit_transactions (workspace_id, amount, reason, balance_after) values (new.id, 450, 'Créditos de boas-vindas', 450);
  return new;
end $$;

-- Só o papel do app executa as funções (nenhum outro papel do branch herda acesso por PUBLIC).
revoke execute on function public.debitar_creditos_ia(uuid, int, text, text, text, numeric) from public;
revoke execute on function public.registrar_uso_ia(uuid, bigint, text, numeric, int, int, int, int) from public;
revoke execute on function public.creditos_iniciais() from public;
