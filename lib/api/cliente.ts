'use client'
/**
 * Cliente HTTP tipado para as rotas /api (modo real). Espelha as funções de lib/demo/store.ts para que a UI
 * troque de fonte de dados sem mudar componentes. Envia o Bearer da sessão do Supabase.
 */
import type { z } from 'zod'
import type { Asset, CriarProjetoReq, CriarShareLinkReq, DetalheProjetoRes, Envelope, ProjetoResumo, ResolverShareRes, SalvarCenasRes, ShareLink } from './contratos'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { supabaseNavegador } from '@/lib/supabase/navegador'
import type { PedidoRoteiro, RespostaRoteiro } from '@/lib/ia/pedido'

export class ErroApiCliente extends Error {
  constructor(public code: string, message: string, public details?: unknown, public status?: number) {
    super(message)
  }
}

async function chamar<T>(caminho: string, init: RequestInit = {}, autenticado = true): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string>) }
  if (autenticado) {
    const { data } = await supabaseNavegador().auth.getSession()
    if (data.session) headers.authorization = `Bearer ${data.session.access_token}`
  }
  const resp = await fetch(caminho, { ...init, headers, credentials: 'same-origin' })
  const env = (await resp.json().catch(() => null)) as Envelope<T> | null
  if (!env) throw new ErroApiCliente('erro_interno', 'Resposta inválida do servidor', undefined, resp.status)
  if (env.error) throw new ErroApiCliente(env.error.code, env.error.message, env.error.details, resp.status)
  return env.data as T
}

export const api = {
  ia: {
    /** No modo demo a rota não exige sessão. */
    roteiro: (b: Partial<PedidoRoteiro>, sinal?: AbortSignal) => chamar<RespostaRoteiro>('/api/ai/roteiro', { method: 'POST', body: JSON.stringify(b), signal: sinal }, process.env.NEXT_PUBLIC_DEMO !== '1'),
  },
  projetos: {
    listar: (q: { q?: string; status?: string; cursor?: string } = {}) => chamar<{ items: ProjetoResumo[]; nextCursor: string | null; total: number }>(`/api/projects?${new URLSearchParams(q as Record<string, string>)}`),
    criar: (b: z.infer<typeof CriarProjetoReq>) => chamar<ProjetoResumo>('/api/projects', { method: 'POST', body: JSON.stringify(b) }),
    obter: (id: string) => chamar<z.infer<typeof DetalheProjetoRes>>(`/api/projects/${id}`),
    atualizar: (id: string, b: Record<string, unknown>) => chamar<ProjetoResumo>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    excluir: (id: string) => chamar<{ deleted: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
    salvarCenas: (id: string, document: DocumentoProjeto, baseRevision: number) => chamar<z.infer<typeof SalvarCenasRes>>(`/api/projects/${id}/scenes`, { method: 'PUT', body: JSON.stringify({ baseRevision, document }) }),
    publicar: (id: string, baseRevision: number) => chamar<{ publishedRevision: number; publishedAt: string }>(`/api/projects/${id}/publish`, { method: 'POST', body: JSON.stringify({ baseRevision }) }),
  },
  links: {
    listar: (projectId: string) => chamar<ShareLink[]>(`/api/projects/${projectId}/share-links`),
    criar: (projectId: string, b: z.infer<typeof CriarShareLinkReq>) => chamar<ShareLink & { token: string }>(`/api/projects/${projectId}/share-links`, { method: 'POST', body: JSON.stringify(b) }),
    revogar: (id: string) => chamar<{ revoked: true }>(`/api/share-links/${id}`, { method: 'DELETE' }),
  },
  assets: {
    listar: () => chamar<Asset[]>('/api/assets'),
    excluir: (id: string, force = false) => chamar<{ deleted: true; projetosAfetados: string[] }>(`/api/assets/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' }),
    /** Upload direto: pede URL assinada → PUT no storage → finalize. */
    enviar: async (projectId: string, arquivo: File, aoProgredir?: (p: number) => void, dims?: { width?: number; height?: number; duration?: number }) => {
      const { assetId, uploadUrl, headers } = await chamar<{ assetId: string; uploadUrl: string; headers: Record<string, string> }>('/api/assets/upload-url', { method: 'POST', body: JSON.stringify({ projectId, name: arquivo.name, mime: arquivo.type, bytes: arquivo.size }) })
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
        xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir?.(Math.round((e.loaded / e.total) * 100))
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ErroApiCliente('erro_interno', 'Falha no envio. Tentar novamente.')))
        xhr.onerror = () => reject(new ErroApiCliente('erro_interno', 'Falha de rede no envio. Tentar novamente.'))
        xhr.send(arquivo)
      })
      await chamar<{ status: 'ready' }>(`/api/assets/${assetId}/finalize`, { method: 'POST', body: JSON.stringify(dims ?? {}) })
      return assetId
    },
  },
  share: {
    resolver: (token: string) => chamar<z.infer<typeof ResolverShareRes>>(`/api/share/${token}`, {}, false),
    desbloquear: (token: string, password: string) => chamar<{ unlocked: true }>(`/api/share/${token}/unlock`, { method: 'POST', body: JSON.stringify({ password }) }, false),
  },
}
