'use client'
/**
 * Ponto único de dados das telas. `dados` é a fonte do modo atual (demo ou real, decidido no build por
 * NEXT_PUBLIC_DEMO) e os hooks abaixo leem o estado reativo e disparam o carregamento do que a tela precisa.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { MODO_DEMO } from '@/lib/sessao'
import { fonteDemo } from './demo'
import { fonteReal } from './real'
import { mensagemDeErro } from './comum'
import type { EstadoDados, FonteDados, Projeto, Recurso } from './tipos'

export const dados: FonteDados = MODO_DEMO ? fonteDemo : fonteReal

export * from './tipos'
export { documentoInicial, ehErroDados, mensagemDeErro, telasDo } from './comum'

/** Estado completo (referência estável enquanto nada muda). */
export function useEstadoDados(): EstadoDados {
  return useSyncExternalStore(dados.assinar, dados.estado, dados.estado)
}

/**
 * Fatia derivada do estado. O seletor pode devolver objetos novos: só é recalculado quando o estado muda,
 * então a referência fica estável e não provoca re-render em loop.
 */
export function useDados<T>(seletor: (e: EstadoDados) => T): T {
  const e = useEstadoDados()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => seletor(e), [e])
}

/**
 * Busca os recursos de que a tela precisa (uma vez; o cache vale para as outras telas) e diz se ainda está
 * carregando ou se deu erro. No modo demo tudo já está pronto.
 */
export function useCarregar(recursos: Recurso[]): { carregando: boolean; erro: string | null; tentarDeNovo: () => void } {
  const chave = recursos.join(',')
  const situacoes = useDados((e) => recursos.map((r) => e.situacao[r]))
  useEffect(() => {
    void dados.carregar(chave.split(',') as Recurso[])
  }, [chave])
  const tentarDeNovo = useCallback(() => { void dados.carregar(chave.split(',') as Recurso[], { forcar: true }) }, [chave])
  const erro = situacoes.find((s) => s.estado === 'erro')?.erro ?? null
  return { carregando: !erro && situacoes.some((s) => s.estado === 'ocioso' || s.estado === 'carregando'), erro, tentarDeNovo }
}

/**
 * Projeto com o documento inteiro. Mostra o que já está em cache (completo) e atualiza com o servidor.
 * `ausente`: não existe, é de outro workspace ou está na lixeira.
 */
export function useProjetoCompleto(id: string): { projeto: Projeto | undefined; carregando: boolean; ausente: boolean; erro: string | null; tentarDeNovo: () => void } {
  const emCache = useDados((e) => e.projetos.find((p) => p.id === id && !p.excluidoEm))
  const [situacao, setSituacao] = useState<{ id: string; estado: 'carregando' | 'pronto' | 'ausente' | 'erro'; erro?: string }>({ id, estado: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let vivo = true
    setSituacao((s) => (s.id === id && s.estado === 'pronto' ? s : { id, estado: 'carregando' }))
    dados.abrirProjeto(id, { forcar: true }).then(
      (p) => { if (vivo) setSituacao({ id, estado: p ? 'pronto' : 'ausente' }) },
      (e) => { if (vivo) setSituacao({ id, estado: 'erro', erro: mensagemDeErro(e, 'Não foi possível abrir o projeto.') }) }
    )
    return () => { vivo = false }
  }, [id, tentativa])
  const completo = emCache && !emCache.documentoParcial ? emCache : undefined
  const s = situacao.id === id ? situacao.estado : 'carregando'
  return {
    projeto: s === 'ausente' ? undefined : completo,
    carregando: !completo && s === 'carregando',
    ausente: s === 'ausente' || (s === 'pronto' && !emCache),
    erro: !completo && s === 'erro' ? (situacao.erro ?? 'Não foi possível abrir o projeto.') : null,
    tentarDeNovo: () => setTentativa((n) => n + 1),
  }
}
