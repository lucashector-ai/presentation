'use client'
/**
 * Contexto do inspetor: gestos contínuos (arrastar rótulo, área de cor, deslizantes) viram UMA entrada
 * no histórico; cores do documento ("Nesta página") e imagens disponíveis para o seletor de cor.
 */
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { coresUsadas } from '@/lib/editor/cor'

export interface Gesto {
  /** Começo de um arraste: guarda o documento para desfazer tudo de uma vez. */
  iniciar: () => void
  /** Fim do arraste: registra uma única entrada no histórico (se algo mudou durante o gesto). */
  terminar: () => void
  /** Há um gesto em andamento? Setters do inspetor gravam sem histórico enquanto isso. */
  emGesto: () => boolean
  /** Marca que houve mudança sem histórico durante o gesto. */
  sujar: () => void
}

export interface ImagemDisponivel { id: string; nome: string; url: string }

interface ValorContexto {
  gesto: Gesto | null
  coresDocumento: string[]
  imagens: ImagemDisponivel[]
}

const Ctx = createContext<ValorContexto>({ gesto: null, coresDocumento: [], imagens: [] })

export function ProvedorInspetor({ editor, assets, children }: { editor: Editor; assets: AssetDemo[]; children: ReactNode }) {
  const { acoes } = editor
  const inicio = useRef<DocumentoProjeto | null>(null)
  const sujo = useRef(false)
  const gesto = useMemo<Gesto>(() => ({
    iniciar: () => { inicio.current = acoes.documentoAtual(); sujo.current = false },
    terminar: () => {
      const anterior = inicio.current
      inicio.current = null
      if (anterior && sujo.current) acoes.registrarHistorico(anterior)
      sujo.current = false
    },
    emGesto: () => inicio.current !== null,
    sujar: () => { sujo.current = true },
  }), [acoes])
  const cenas = editor.estado.documento.scenes
  const coresDocumento = useMemo(() => coresUsadas(cenas as unknown as Parameters<typeof coresUsadas>[0]), [cenas])
  const imagens = useMemo(() => assets.filter((a) => a.tipo === 'image' || a.tipo === 'gif' || a.tipo === 'svg').map((a) => ({ id: a.id, nome: a.nome, url: a.thumbUrl || a.url })), [assets])
  const valor = useMemo(() => ({ gesto, coresDocumento, imagens }), [gesto, coresDocumento, imagens])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useInspetor() {
  return useContext(Ctx)
}

/** Grava com histórico normalmente; durante um gesto grava sem histórico (o gesto registra ao terminar). */
export function useHistorico() {
  const { gesto } = useInspetor()
  return () => {
    if (gesto?.emGesto()) { gesto.sujar(); return false }
    return true
  }
}
