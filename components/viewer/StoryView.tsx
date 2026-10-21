'use client'
/** Story: fluxo vertical contínuo com largura editorial e animações por rolagem (scrollThreshold). */
import { useEffect, useRef, useState } from 'react'
import type { Camada, DocumentoProjeto, Interacao } from '@/lib/scene/schema'
import { aoSairHover, estadoInicialRuntime, executar, type Efeito, type EstadoRuntime } from '@/lib/scene/motor'
import { SceneRenderer, type SceneRendererProps } from '@/components/renderer/SceneRenderer'

type Comum = Omit<SceneRendererProps, 'cena' | 'escala' | 'runtime' | 'chaveEntrada'>

export function StoryView({ documento, tamanho, runtime, aplicar, ...comum }: { documento: DocumentoProjeto; tamanho: { width: number; height: number }; runtime: EstadoRuntime; aplicar: (fn: (e: EstadoRuntime) => { estado: EstadoRuntime; efeitos: Efeito[] } | EstadoRuntime) => void } & Comum) {
  const larguraEditorial = Math.min(tamanho.width, 720)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const [runtimes, setRuntimes] = useState<Record<string, EstadoRuntime>>({})

  useEffect(() => {
    const alvo = documento.scenes[runtime.indice]
    if (alvo && runtime.historico.length) refs.current.get(alvo.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [runtime.indice, runtime.historico.length, documento.scenes])

  useEffect(() => {
    const observadores: IntersectionObserver[] = []
    documento.scenes.forEach((cena, indice) => {
      const el = refs.current.get(cena.id)
      if (!el) return
      for (const camada of cena.layers) {
        for (const inter of camada.interactions) {
          if (inter.trigger !== 'scrollThreshold') continue
          const alvo = el.querySelector<HTMLElement>(`[data-layer-id="${camada.id}"]`) ?? el
          const io = new IntersectionObserver(
            (entradas) => {
              for (const en of entradas) {
                if (en.intersectionRatio < inter.conditions.threshold) continue
                setRuntimes((rs) => {
                  const r = executar(documento, rs[cena.id] ?? estadoInicialRuntime(indice), camada, inter)
                  return { ...rs, [cena.id]: { ...r.estado, indice } }
                })
              }
            },
            { threshold: [0, 0.25, 0.4, 0.5, 0.75, 1] }
          )
          io.observe(alvo)
          observadores.push(io)
        }
      }
    })
    return () => observadores.forEach((o) => o.disconnect())
  }, [documento, larguraEditorial])

  if (!tamanho.width) return null
  return (
    <div className="rolagem-fina absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ scrollSnapType: 'y proximity' }}>
      <div className="mx-auto flex flex-col items-center" style={{ width: larguraEditorial }}>
        {documento.scenes.map((cena, indice) => {
          const escala = larguraEditorial / cena.size.width
          const rt = runtimes[cena.id] ?? estadoInicialRuntime(indice)
          const interagir = (camada: Camada, inters: Interacao[], origem: 'click' | 'hoverEnter' | 'hoverLeave') => {
            if (origem === 'hoverLeave') return setRuntimes((rs) => ({ ...rs, [cena.id]: aoSairHover(documento, rs[cena.id] ?? estadoInicialRuntime(indice), camada) }))
            const navega = inters.find((i) => ['nextScene', 'prevScene', 'goToScene'].includes(i.do.action))
            if (navega) return comum.aoInteragir?.(camada, [navega], 'click')
            setRuntimes((rs) => {
              let estado = rs[cena.id] ?? estadoInicialRuntime(indice)
              for (const i of inters) estado = executar(documento, estado, camada, i).estado
              return { ...rs, [cena.id]: { ...estado, indice } }
            })
            comum.aoInteragir?.(camada, inters.filter((i) => i.do.action === 'openLink' || i.do.action === 'toggleVideo'), 'click')
          }
          return (
            <div key={cena.id} ref={(el) => { if (el) refs.current.set(cena.id, el) }} style={{ scrollSnapAlign: 'start' }}>
              <SceneRenderer cena={cena} escala={escala} runtime={rt} chaveEntrada={cena.id} {...comum} aoInteragir={interagir} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
