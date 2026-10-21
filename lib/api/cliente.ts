'use client'
/**
 * Cliente HTTP tipado para as rotas /api (modo real). As telas não o chamam direto: passam por lib/dados
 * (lib/dados/real.ts), que tem o mesmo contrato do store demo. A sessão vai no cookie HttpOnly do Neon Auth
 * (mesma origem): o cliente não lê nem guarda token nenhum.
 */
import type { z } from 'zod'
import type { Asset, ContaRes, CriarProjetoReq, CriarShareLinkReq, DetalheProjetoRes, Envelope, ProjetoResumo, ResolverShareRes, SalvarCenasRes, ShareLink } from './contratos'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import type { PedidoRoteiro, RespostaRoteiro } from '@/lib/ia/pedido'
import type { PedidoTextoSchema, RespostaTexto } from '@/lib/ia/texto'
import type { PedidoTelaSchema, RespostaTela } from '@/lib/ia/tela'

export class ErroApiCliente extends Error {
  constructor(public code: string, message: string, public details?: unknown, public status?: number) {
    super(message)
  }
}

function lerEnvelope<T>(status: number, env: Envelope<T> | null): T {
  if (!env) throw new ErroApiCliente('erro_interno', 'Resposta inválida do servidor', undefined, status)
  if (env.error) throw new ErroApiCliente(env.error.code, env.error.message, env.error.details, status)
  return env.data as T
}

/** Falha de rede (sem resposta do servidor): a UI trata como "sem conexão" e tenta de novo depois. */
export const SEM_CONEXAO = 'sem_conexao'

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(init.headers as Record<string, string>) }
  let resp: Response
  try {
    resp = await fetch(caminho, { ...init, headers, credentials: 'same-origin' })
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') throw e
    throw new ErroApiCliente(SEM_CONEXAO, 'Sem conexão com o servidor. Verifique a internet e tente de novo.')
  }
  return lerEnvelope(resp.status, (await resp.json().catch(() => null)) as Envelope<T> | null)
}

export const api = {
  ia: {
    /** No modo demo a rota não exige sessão. */
    roteiro: (b: Partial<PedidoRoteiro>, sinal?: AbortSignal) => chamar<RespostaRoteiro>('/api/ai/roteiro', { method: 'POST', body: JSON.stringify(b), signal: sinal }),
    /** Reescrever o texto de uma tela (editor). */
    texto: (b: z.input<typeof PedidoTextoSchema>, sinal?: AbortSignal) => chamar<RespostaTexto>('/api/ai/texto', { method: 'POST', body: JSON.stringify(b), signal: sinal }),
    /** Refazer uma tela (editor). */
    tela: (b: z.input<typeof PedidoTelaSchema>, sinal?: AbortSignal) => chamar<RespostaTela>('/api/ai/tela', { method: 'POST', body: JSON.stringify(b), signal: sinal }),
  },
  projetos: {
    listar: (q: { q?: string; status?: 'all' | 'draft' | 'published' | 'archived' | 'trash'; cursor?: string; limit?: string } = {}) => chamar<{ items: ProjetoResumo[]; nextCursor: string | null; total: number }>(`/api/projects?${new URLSearchParams(q as Record<string, string>)}`),
    criar: (b: z.infer<typeof CriarProjetoReq>) => chamar<ProjetoResumo>('/api/projects', { method: 'POST', body: JSON.stringify(b) }),
    obter: (id: string) => chamar<z.infer<typeof DetalheProjetoRes>>(`/api/projects/${id}`),
    atualizar: (id: string, b: Record<string, unknown>) => chamar<ProjetoResumo>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    /** Move para a lixeira (soft delete; revoga os links). */
    excluir: (id: string) => chamar<{ deleted: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
    /** Só para projeto que já está na lixeira. */
    excluirDefinitivo: (id: string) => chamar<{ deleted: true }>(`/api/projects/${id}?definitivo=1`, { method: 'DELETE' }),
    restaurar: (id: string) => chamar<ProjetoResumo>(`/api/projects/${id}/restore`, { method: 'POST', body: '{}' }),
    salvarCenas: (id: string, document: DocumentoProjeto, baseRevision: number) => chamar<z.infer<typeof SalvarCenasRes>>(`/api/projects/${id}/scenes`, { method: 'PUT', body: JSON.stringify({ baseRevision, document }) }),
    publicar: (id: string, baseRevision: number) => chamar<{ publishedRevision: number; publishedAt: string }>(`/api/projects/${id}/publish`, { method: 'POST', body: JSON.stringify({ baseRevision }) }),
  },
  links: {
    listar: (projectId: string) => chamar<ShareLink[]>(`/api/projects/${projectId}/share-links`),
    /** Todos os links do workspace (painel, Enviados). */
    listarTodos: () => chamar<ShareLink[]>('/api/share-links'),
    criar: (projectId: string, b: z.infer<typeof CriarShareLinkReq>) => chamar<ShareLink & { token: string }>(`/api/projects/${projectId}/share-links`, { method: 'POST', body: JSON.stringify(b) }),
    revogar: (id: string) => chamar<{ revoked: true }>(`/api/share-links/${id}`, { method: 'DELETE' }),
  },
  assets: {
    listar: () => chamar<Asset[]>('/api/assets'),
    excluir: (id: string, force = false) => chamar<{ deleted: true; projetosAfetados: string[] }>(`/api/assets/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' }),
    /**
     * Envia o arquivo para a rota do app (POST /api/assets/upload), que confere tipo/tamanho/conteúdo e grava no
     * armazenamento privado. XHR só para ter progresso de envio. Devolve o asset já pronto. `projectId` é opcional
     * (a mídia é do workspace; a biblioteca envia sem projeto).
     */
    enviar: async (projectId: string | null, arquivo: File, aoProgredir?: (p: number) => void, dims?: { width?: number; height?: number; duration?: number }): Promise<Asset> => {
      const q = new URLSearchParams({ ...(projectId ? { projectId } : {}), name: arquivo.name })
      for (const [k, v] of Object.entries(dims ?? {})) if (v != null) q.set(k, String(v))
      const asset = await new Promise<Asset>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/assets/upload?${q}`)
        xhr.withCredentials = true
        // tipo vazio (extensão desconhecida pelo navegador) cai em octet-stream e o servidor recusa com mensagem clara
        xhr.setRequestHeader('content-type', arquivo.type || 'application/octet-stream')
        xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir?.(Math.round((e.loaded / e.total) * 100))
        xhr.onload = () => {
          let env: Envelope<Asset> | null = null
          try { env = JSON.parse(xhr.responseText) as Envelope<Asset> } catch { /* resposta não JSON */ }
          try { resolve(lerEnvelope(xhr.status, env)) } catch (e) { reject(e) }
        }
        xhr.onerror = () => reject(new ErroApiCliente(SEM_CONEXAO, 'Falha de rede no envio. Tente novamente.'))
        xhr.send(arquivo)
      })
      return asset
    },
  },
  conta: {
    obter: () => chamar<ContaRes>('/api/conta'),
  },
  share: {
    resolver: (token: string) => chamar<z.infer<typeof ResolverShareRes>>(`/api/share/${token}`),
    desbloquear: (token: string, password: string) => chamar<{ unlocked: true }>(`/api/share/${token}/unlock`, { method: 'POST', body: JSON.stringify({ password }) }),
  },
}
