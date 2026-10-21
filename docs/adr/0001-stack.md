# ADR 0001 — Stack: Next.js + TypeScript + Tailwind + Supabase

**Status:** aceito · **Data:** 2026-10-21

## Contexto
O blueprint sugere Next.js/React/TS, Tailwind, Zod, Postgres (Prisma/Drizzle), object storage S3-compatible e auth gerenciado. A casa já opera um produto (Clinical 360) em Next.js 14 + Supabase + Vercel.

## Decisão
Next.js 14 (App Router), TypeScript strict, Tailwind com tokens em CSS variables, Zod 4 para todos os contratos, **Supabase** para Postgres + Auth + Storage privado. Sem ORM: SQL direto nas migrations e funções PL/pgSQL para operações transacionais; acesso via `@supabase/supabase-js` com service role no servidor e RLS como segunda barreira.

## Consequências
+ Um deploy, um stack conhecido, menos superfície.
+ RLS e bucket privado resolvem "isolamento multi-tenant" e "mídia nunca pública" no nível da infraestrutura.
− Sem ORM, tipos das linhas são declarados à mão (`lib/api/*Servidor.ts`); gerar tipos com `supabase gen types` na Sprint 1.
− Lock-in moderado: módulos de mídia, auth e pagamentos ficam atrás de funções pequenas (`lib/supabase`, `lib/api/servidor.ts`) para troca futura.
