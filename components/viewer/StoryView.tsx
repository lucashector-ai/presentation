'use client'
/**
 * Story: fluxo vertical contínuo com largura editorial e animações por rolagem (scrollThreshold).
 * Em telas largas, o fundo de cada tela se estende pelas laterais (sem faixas escuras dos lados).
 *
 * Animações por seção (equivalente ao slide no fluxo contínuo):
 * - a entrada de cada tela espera (pausada no 1º quadro) até a seção aparecer de verdade na janela;
 * - a saída toca quando a seção está indo embora (menos de 30% dela à vista), se a tela tiver saídas;
 * - ao voltar para uma seção que saiu, a entrada toca de novo. Sem saídas, a entrada toca uma vez só.
 */
import { useEffect, useRef, useState } from 'react'
import { tempoSaida } from '@/lib/scene/animacoes'
import type { Camada, DocumentoProjeto, Interacao } from '@/lib/scene/schema'
import { aoSairHover, estadoInicialRuntime, executar, type Efeito, type EstadoRuntime } from '@/lib/scene/motor'
import { SceneRenderer, type SceneRendererProps } from '@/components/renderer/SceneRenderer'
import { FundoEstendido } from './FundoEstendido'

type Comum = Omit<SceneRendererProps, 'cena' | 'escala' | 'runtime' | 'chaveEntrada'>

/** Fração visível (da seção ou da janela, o que for menor) para a entrada começar / para a saída tocar. */
const ENTRAR = 0.4
const SAIR = 0.3

/** Estado de animação de uma seção: esperando (nunca vista), dentro (entrada tocou), fora (saída tocou). */
interface EstadoSecao { fase: 'esperando' | 'dentro' | 'fora'; vez: number }

export function StoryView({ documento, tamanho, runtime, aplicar, iniciado = true, ...comum }: { documento: DocumentoProjeto; tamanho: { width: number; height: number }; runtime: EstadoRuntime; aplicar: (fn: (e: EstadoRuntime) => { estado: EstadoRuntime; efeitos: Efeito[] } | EstadoRuntime) => void; iniciado?: boolean } & Comum) {
  const larguraEditorial = Math.min(tamanho.width, 720)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const [runtimes, setRuntimes] = useState<Record<string, EstadoRuntime>>({})
  const [secoes, setSecoes] = useState<Record<string, EstadoSecao>>({})

  // entrada ao aparecer, saída ao sair (com folga entre os limites para não piscar na borda)
  useEffect(() => {
    if (!iniciado || !tamanho.width) return
    const temSaida = new Map(documento.scenes.map((c) => [c.id, tempoSaida(c) > 0]))
    const io = new IntersectionObserver(
      (entradas) => {
        setSecoes((atual) => {
          let novo = atual
          for (const en of entradas) {
            const id = (en.target as HTMLElement).dataset.cena
            if (!id) continue
            const alt = Math.min(en.boundingClientRect.height, en.rootBounds?.height ?? window.innerHeight) || 1
            const frac = en.isIntersecting ? en.intersectionRect.height / alt : 0
            const s = novo[id] ?? { fase: 'esperando', vez: 0 }
            let prox = s
            if (frac >= ENTRAR && s.fase !== 'dentro') prox = { fase: 'dentro', vez: s.fase === 'fora' ? s.vez + 1 : s.vez }
            else if (frac < SAIR && s.fase === 'dentro' && temSaida.get(id)) prox = { fase: 'fora', vez: s.vez }
            if (prox !== s) novo = { ...novo, [id]: prox }
          }
          return novo
        })
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
    )
    refs.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [documento.scenes, iniciado, tamanho.width])

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
      <div className="flex w-full flex-col">
        {documento.scenes.map((cena, indice) => {
          const escala = larguraEditorial / cena.size.width
          const rt = runtimes[cena.id] ?? estadoInicialRuntime(indice)
          const sec = secoes[cena.id] ?? { fase: 'esperando', vez: 0 }
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
            <div key={cena.id} ref={(el) => { if (el) refs.current.set(cena.id, el) }} data-cena={cena.id} className={`relative w-full ${sec.fase === 'esperando' ? 'animacoes-em-espera' : ''}`} style={{ scrollSnapAlign: 'start' }}>
              {tamanho.width > larguraEditorial && <FundoEstendido cena={cena} assets={comum.assets} escala={escala} x={(tamanho.width - larguraEditorial) / 2} y={0} largura={tamanho.width} altura={cena.size.height * escala} style={{ left: 0, top: 0, width: '100%' }} />}
              <SceneRenderer cena={cena} escala={escala} runtime={rt} chaveEntrada={`${cena.id}-${sec.vez}`} saida={sec.fase === 'fora'} {...comum} aoInteragir={interagir} style={{ margin: '0 auto' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
