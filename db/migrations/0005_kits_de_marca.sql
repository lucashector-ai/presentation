-- 0005: kits de marca do workspace (Criar com IA): nome, cores, par de fontes e logo, para reusar nas próximas
-- apresentações sem pedir de novo (e sem gastar créditos: tudo é aplicado na montagem, sem IA).
-- Aditiva: uma tabela nova e um índice; nada existente é alterado ou apagado.
--
-- Autorização como no resto do schema: sem RLS; as rotas /api/marcas filtram por workspace_id do workspace ativo
-- da sessão (lib/api/servidor.ts). O logo é uma mídia do próprio workspace (conferida na rota); se a mídia for
-- apagada de vez, o kit perde o logo (on delete set null) e continua com as cores e as fontes.

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  -- ["#RRGGBB", ...] (até 6)
  colors jsonb not null default '[]'::jsonb check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) <= 6),
  font_title text check (font_title is null or length(font_title) between 1 and 80),
  font_body text check (font_body is null or length(font_body) between 1 and 80),
  logo_asset_id uuid references public.assets(id) on delete set null,
  -- proporção e cor média do logo ({ largura, altura, cor }) e se ele vai no rodapé
  logo_meta jsonb not null default '{}'::jsonb check (jsonb_typeof(logo_meta) = 'object'),
  logo_in_footer boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brand_kits_workspace_idx on public.brand_kits(workspace_id, updated_at desc);
