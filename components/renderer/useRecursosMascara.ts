'use client'
/**
 * Fontes e imagens embutidas nas máscaras da cena (lib/scene/mascaraRecursos.ts). O primeiro render de todos
 * (que pode ser hidratação do servidor) sai sem recursos — igual ao HTML do servidor; depois de montar, usa o
 * cache e re-renderiza quando cada recurso termina de carregar.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Camada } from '@/lib/scene/schema'
import { recursosDasMascaras, type RecursosMascara } from '@/lib/scene/mascara'
import { aoCarregarRecurso, carregarRecurso, recursosProntos } from '@/lib/scene/mascaraRecursos'

let jaMontou = false
const VAZIO: RecursosMascara = new Map()

export function useRecursosMascara(camadas: readonly Camada[], assets: Readonly<Record<string, { url: string } | undefined>>): RecursosMascara {
  const pedidos = useMemo(() => recursosDasMascaras(camadas, assets), [camadas, assets])
  const chave = pedidos.map((p) => p.chave).join('\n')
  const [montado, setMontado] = useState(jaMontou)
  const [versao, setVersao] = useState(0)
  useEffect(() => {
    jaMontou = true
    setMontado(true)
  }, [])
  useEffect(() => {
    if (!pedidos.length) return
    let vivo = true
    const faltam = pedidos.filter((p) => !recursosProntos().has(p.chave))
    if (!faltam.length) return
    const sair = aoCarregarRecurso(() => { if (vivo) setVersao((v) => v + 1) })
    faltam.forEach((p) => void carregarRecurso(p))
    return () => { vivo = false; sair() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (montado && pedidos.length ? new Map(recursosProntos()) : VAZIO), [montado, chave, versao])
}
