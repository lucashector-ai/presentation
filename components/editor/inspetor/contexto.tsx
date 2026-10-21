'use client'
/**
 * Contexto do inspetor: gestos contínuos (arrastar rótulo, área de cor, deslizantes) viram UMA entrada
 * no histórico; cores do documento ("Nesta página") e imagens disponíveis para o seletor de cor.
 */
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import type { DocumentoProjeto, EstiloCor } from '@/lib/scene/schema'
import { coresUsadas } from '@/lib/editor/cor'
import { adicionarEstilo, atualizarEstilo, criarEstilo, estilosDo, removerEstilo } from '@/lib/editor/estilosCor'

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

/** Estilos de cor do documento (theme.colorStyles) e como criá-los/editá-los a partir do seletor. */
export interface EstilosCorCtx {
  lista: EstiloCor[]
  criar: (nome: string, cor: string) => EstiloCor
  atualizar: (id: string, patch: Partial<Pick<EstiloCor, 'name' | 'color'>>) => void
  remover: (id: string) => void
}

interface ValorContexto {
  gesto: Gesto | null
  coresDocumento: string[]
  imagens: ImagemDisponivel[]
  estilos: EstilosCorCtx | null
}

const Ctx = createContext<ValorContexto>({ gesto: null, coresDocumento: [], imagens: [], estilos: null })

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
  const tema = editor.estado.documento.theme
  const estilos = useMemo<EstilosCorCtx>(() => ({
    lista: estilosDo({ theme: tema }),
    criar: (nome, cor) => {
      // o id nasce do documento atual; a gravação vem antes da ligação da camada (mesma fila do reducer)
      const { estilo } = criarEstilo(acoes.documentoAtual(), nome, cor)
      acoes.transformarDocumento((d) => adicionarEstilo(d, estilo))
      return estilo
    },
    atualizar: (id, patch) => {
      // arrastar na área de cor editando um estilo = um único desfazer (como nos campos)
      const emGesto = gesto.emGesto()
      if (emGesto) gesto.sujar()
      acoes.transformarDocumento((d) => atualizarEstilo(d, id, patch), !emGesto)
    },
    remover: (id) => acoes.transformarDocumento((d) => removerEstilo(d, id)),
  }), [tema, acoes, gesto])
  const valor = useMemo(() => ({ gesto, coresDocumento, imagens, estilos }), [gesto, coresDocumento, imagens, estilos])
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
