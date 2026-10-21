'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instancia: SupabaseClient | null = null

/** Cliente do navegador: chave pública + sessão do usuário. RLS limita ao próprio workspace. */
export function supabaseNavegador(): SupabaseClient {
  if (instancia) return instancia
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase não configurado no navegador')
  instancia = createClient(url, anon)
  return instancia
}

export const MODO_DEMO = process.env.NEXT_PUBLIC_DEMO === '1' || !process.env.NEXT_PUBLIC_SUPABASE_URL
