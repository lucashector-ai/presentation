'use client'
/**
 * Visualizador (seção 8): rota limpa, sem chrome. Modos Slides e Story.
 * Teclado (setas, espaço, Esc), toque (swipe), fullscreen por gesto, controles que somem,
 * pré-carregamento da próxima cena, tela de carregamento e fallback de mídia.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react'
import type { Camada, DocumentoProjeto, Interacao } from '@/lib/scene/schema'
import { aoEntrarNaCena, aoSairHover, cenaAtual, estadoInicialRuntime, executar, irPara, type EstadoRuntime, type Efeito } from '@/lib/scene/motor'
import { calcularEncaixe } from '@/lib/scene/transform'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { usePreferencias, useTamanho } from '@/components/renderer/useTamanho'

export interface ViewerProps {
  documento: DocumentoProjeto
  assets: AssetsResolvidos
  nome: string
  /** Cena inicial (preview do editor abre na cena selecionada). */
  indiceInicial?: number
  aoSair?: () => void
  /** Marca da plataforma (plano Free). */
  marca?: boolean
}

const TEMPO_OCIOSO = 2500
const LIMIAR_SWIPE = 50

export function Viewer({ documento, assets, nome, indiceInicial = 0, aoSair, marca }: ViewerProps) {
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const { reduzirMovimento, semHover } = usePreferencias()
  const mobile = tamanho.width > 0 && tamanho.width < 640
  const [runtime, setRuntime] = useState<EstadoRuntime>(() => estadoInicialRuntime(indiceInicial))
  const [ocioso, setOcioso] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [pronto, setPronto] = useState(false)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const timerOcioso = useRef<number | undefined>(undefined)
  const bloqueadoAte = useRef(0)
  const anuncio = useRef<HTMLDivElement>(null)

  const story = documento.mode === 'story'
  const cena = cenaAtual(documento, runtime)
  const total = documento.scenes.length

  // ---------- efeitos do motor ----------
  const executarEfeitos = useCallback((efeitos: Efeito[]) => {
    for (const ef of efeitos) {
      if (ef.tipo === 'abrirLink') {
        // Apenas http(s) (já validado pelo schema); noopener evita acesso à janela de origem.
        const w = window.open(ef.url, ef.novaAba ? '_blank' : '_self', 'noopener,noreferrer')
        if (w) w.opener = null
      } else if (ef.tipo === 'video') {
        const v = videos.current.get(ef.layerId)
        if (!v) continue
        if (ef.modo === 'play' || (ef.modo === 'toggle' && v.paused)) void v.play().catch(() => undefined)
        else v.pause()
      }
    }
  }, [])

  const aplicar = useCallback(
    (fn: (e: EstadoRuntime) => { estado: EstadoRuntime; efeitos: Efeito[] } | EstadoRuntime) => {
      setRuntime((e) => {
        const r = fn(e)
        if ('estado' in r && 'efeitos' in r) {
          if (r.efeitos.length) queueMicrotask(() => executarEfeitos(r.efeitos))
          return r.estado
        }
        return r as EstadoRuntime
      })
    },
    [executarEfeitos]
  )

  const navegar = useCallback(
    (fn: (e: EstadoRuntime) => EstadoRuntime) => {
      const agora = performance.now()
      if (agora < bloqueadoAte.current) return // evita múltiplos disparos durante a transição
      bloqueadoAte.current = agora + (reduzirMovimento ? 50 : 200)
      aplicar(fn)
    },
    [aplicar, reduzirMovimento]
  )

  const aoInteragir = useCallback(
    (camada: Camada, inter: Interacao, origem: 'click' | 'hoverEnter' | 'hoverLeave') => {
      if (origem === 'hoverLeave') return aplicar((e) => aoSairHover(documento, e, camada))
      const navega = ['nextScene', 'prevScene', 'goToScene'].includes(inter.do.action)
      if (navega) return navegar((e) => executar(documento, e, camada, inter).estado)
      aplicar((e) => executar(documento, e, camada, inter))
    },
    [aplicar, documento, navegar]
  )

  // ---------- entrada na cena: triggers sceneEnter + pré-carregamento ----------
  useEffect(() => {
    aplicar((e) => aoEntrarNaCena(documento, e))
    const prox = documento.scenes[runtime.indice + 1]
    if (prox) precarregar(prox, assets)
    if (anuncio.current && cena) anuncio.current.textContent = `Cena ${runtime.indice + 1} de ${total}${cena.title ? `: ${cena.title}` : ''}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.indice, documento])

  // tela de carregamento: espera a primeira cena (com timeout) — "exibir shell e mídia prioritária o quanto antes"
  useEffect(() => {
    let ativo = true
    const primeira = documento.scenes[indiceInicial] ?? documento.scenes[0]
    const t = setTimeout(() => ativo && setPronto(true), 4000)
    if (primeira) precarregar(primeira, assets).finally(() => { if (ativo) { setPronto(true); clearTimeout(t) } })
    return () => { ativo = false; clearTimeout(t) }
  }, [documento, assets, indiceInicial])

  const alternarFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await ref.current?.requestFullscreen()
    } catch {
      /* sem suporte (ex.: iOS): mantém UI limpa */
    }
  }, [ref])

  // ---------- teclado ----------
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA'].includes(alvo.tagName)) return
      if (story) {
        if (e.key === 'Escape') { if (document.fullscreenElement) void document.exitFullscreen(); else aoSair?.() }
        return
      }
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
          e.preventDefault(); navegar((s) => irPara(documento, s, s.indice + 1)); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault(); navegar((s) => irPara(documento, s, s.indice - 1)); break
        case 'Home': navegar((s) => irPara(documento, s, 0)); break
        case 'End': navegar((s) => irPara(documento, s, total - 1)); break
        case 'f': case 'F': void alternarFullscreen(); break
        case 'Escape':
          if (document.fullscreenElement) void document.exitFullscreen()
          else aoSair?.()
          break
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [documento, navegar, story, total, aoSair, alternarFullscreen])

  // ---------- ociosidade ----------
  const acordar = useCallback(() => {
    setOcioso(false)
    window.clearTimeout(timerOcioso.current)
    timerOcioso.current = window.setTimeout(() => setOcioso(true), TEMPO_OCIOSO)
  }, [])
  useEffect(() => { acordar(); return () => window.clearTimeout(timerOcioso.current) }, [acordar])

  // ---------- fullscreen (gesto do usuário) ----------
  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  // ---------- toque: swipe ----------
  const toque = useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => { if (e.pointerType === 'touch') toque.current = { x: e.clientX, y: e.clientY, t: Date.now() } }
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !toque.current || story) return
    const dx = e.clientX - toque.current.x
    const dy = e.clientY - toque.current.y
    toque.current = null
    if (Math.abs(dx) > LIMIAR_SWIPE && Math.abs(dx) > Math.abs(dy)) navegar((s) => irPara(documento, s, s.indice + (dx < 0 ? 1 : -1)))
  }

  // clique nas laterais (fora de camadas interativas)
  const cliqueFundo = (e: React.MouseEvent) => {
    if (story || mobile) return
    const alvo = e.target as HTMLElement
    if (alvo.closest('[role="button"], button, a, video')) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const frac = (e.clientX - rect.left) / rect.width
    if (frac > 0.8) navegar((s) => irPara(documento, s, s.indice + 1))
    else if (frac < 0.2) navegar((s) => irPara(documento, s, s.indice - 1))
  }

  const registrarVideo = useCallback((id: string, el: HTMLVideoElement | null) => { if (el) videos.current.set(id, el); else videos.current.delete(id) }, [])

  const encaixe = useMemo(() => (cena && tamanho.width ? calcularEncaixe(cena.size, tamanho) : null), [cena, tamanho])

  const comum = { assets, modo: 'viewer' as const, reduzirMovimento, semHover, mobile, aoInteragir, registrarVideo }

  return (
    <div
      ref={ref}
      className={`relative h-full w-full select-none overflow-hidden bg-black text-white ${ocioso ? 'viewer-ocioso' : ''}`}
      onMouseMove={acordar}
      onPointerDown={(e) => { acordar(); onPointerDown(e) }}
      onPointerUp={onPointerUp}
      onClick={cliqueFundo}
      onTouchStart={acordar}
      style={{ background: cena?.background ?? '#000' }}
    >
      <div ref={anuncio} className="sr-only" aria-live="polite" />

      {!pronto && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0F1620] text-white/80" role="status">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-white/15" />
          <p className="text-sm">Preparando apresentação…</p>
        </div>
      )}

      {story ? (
        <StoryView documento={documento} tamanho={tamanho} runtime={runtime} aplicar={aplicar} {...comum} />
      ) : (
        cena && encaixe && (
          <div key={`${cena.id}-${runtime.historico.length}`} className={runtime.transicao && runtime.transicao.type !== 'none' ? `cena-transicao-${runtime.transicao.type}` : undefined} style={{ position: 'absolute', left: encaixe.offsetX, top: encaixe.offsetY, ['--dur' as string]: `${runtime.transicao?.duration ?? 350}ms` }}>
            <SceneRenderer cena={cena} escala={encaixe.scale} runtime={runtime} chaveEntrada={cena.id} {...comum} />
          </div>
        )
      )}

      {/* controles discretos */}
      <div className="viewer-controles pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs backdrop-blur">
          {!story && (
            <>
              <button aria-label="Cena anterior" onClick={(e) => { e.stopPropagation(); navegar((s) => irPara(documento, s, s.indice - 1)) }} disabled={runtime.indice === 0} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-[3.5rem] text-center tabular-nums">{runtime.indice + 1} / {total}</span>
              <button aria-label="Próxima cena" onClick={(e) => { e.stopPropagation(); navegar((s) => irPara(documento, s, s.indice + 1)) }} disabled={runtime.indice === total - 1} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </>
          )}
          {story && <span className="px-2 py-1.5">{nome}</span>}
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 px-1 py-1 backdrop-blur">
          <button aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} onClick={(e) => { e.stopPropagation(); void alternarFullscreen() }} className="rounded-full p-2 hover:bg-white/15">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {aoSair && (
            <button aria-label="Sair da apresentação" onClick={(e) => { e.stopPropagation(); aoSair() }} className="rounded-full p-2 hover:bg-white/15"><X className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      {marca && <a href="/" className="viewer-controles absolute left-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur hover:text-white">Feito com Apresentações</a>}
    </div>
  )
}

// ---------- Story: fluxo vertical contínuo ----------

function StoryView({ documento, tamanho, runtime, aplicar, ...comum }: { documento: DocumentoProjeto; tamanho: { width: number; height: number }; runtime: EstadoRuntime; aplicar: (fn: (e: EstadoRuntime) => { estado: EstadoRuntime; efeitos: Efeito[] } | EstadoRuntime) => void } & Omit<Parameters<typeof SceneRenderer>[0], 'cena' | 'escala' | 'runtime' | 'chaveEntrada'>) {
  const larguraEditorial = Math.min(tamanho.width, 720)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const [runtimes, setRuntimes] = useState<Record<string, EstadoRuntime>>({})

  // navegação disparada por hotspot: rola até a cena alvo
  useEffect(() => {
    const alvo = documento.scenes[runtime.indice]
    if (alvo) refs.current.get(alvo.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [runtime.indice, documento.scenes])

  // scrollThreshold por camada (IntersectionObserver)
  useEffect(() => {
    const observadores: IntersectionObserver[] = []
    documento.scenes.forEach((cena, indice) => {
      const el = refs.current.get(cena.id)
      if (!el) return
      for (const camada of cena.layers) {
        const inter = camada.interaction
        if (!inter || inter.trigger !== 'scrollThreshold') continue
        const alvo = el.querySelector<HTMLElement>(`[data-layer-id="${camada.id}"]`) ?? el
        const io = new IntersectionObserver(
          (entradas) => {
            for (const en of entradas) {
              if (en.intersectionRatio >= inter.conditions.threshold) {
                setRuntimes((rs) => {
                  const atual = rs[cena.id] ?? estadoInicialRuntime(indice)
                  const r = executar(documento, atual, camada, inter)
                  if (r.estado.indice !== indice) aplicar(() => r.estado)
                  return { ...rs, [cena.id]: { ...r.estado, indice } }
                })
              }
            }
          },
          { threshold: [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= 1) }
        )
        io.observe(alvo)
        observadores.push(io)
      }
    })
    return () => observadores.forEach((o) => o.disconnect())
  }, [documento, aplicar])

  if (!tamanho.width) return null
  return (
    <div className="rolagem-fina absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ scrollSnapType: 'y proximity' }}>
      <div className="mx-auto flex flex-col items-center" style={{ width: larguraEditorial }}>
        {documento.scenes.map((cena, indice) => {
          const escala = larguraEditorial / cena.size.width
          const rt = runtimes[cena.id] ?? { ...estadoInicialRuntime(indice) }
          return (
            <div key={cena.id} ref={(el) => { if (el) refs.current.set(cena.id, el) }} style={{ scrollSnapAlign: 'start' }}>
              <SceneRenderer
                cena={cena}
                escala={escala}
                runtime={rt}
                chaveEntrada={cena.id}
                {...comum}
                aoInteragir={(camada, inter, origem) => {
                  if (origem === 'hoverLeave') return setRuntimes((rs) => ({ ...rs, [cena.id]: aoSairHover(documento, rs[cena.id] ?? estadoInicialRuntime(indice), camada) }))
                  setRuntimes((rs) => {
                    const r = executar(documento, rs[cena.id] ?? estadoInicialRuntime(indice), camada, inter)
                    if (r.estado.indice !== indice) aplicar(() => r.estado)
                    if (r.efeitos.length) queueMicrotask(() => comum.aoInteragir && r.efeitos.forEach((ef) => ef.tipo === 'abrirLink' && window.open(ef.url, ef.novaAba ? '_blank' : '_self', 'noopener,noreferrer')))
                    return { ...rs, [cena.id]: { ...r.estado, indice } }
                  })
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- pré-carregamento controlado ----------

const cachePre = new Set<string>()
function precarregar(cena: DocumentoProjeto['scenes'][number], assets: AssetsResolvidos): Promise<void> {
  const urls = new Set<string>()
  if (cena.backgroundAssetId && assets[cena.backgroundAssetId]) urls.add(assets[cena.backgroundAssetId]!.url)
  for (const c of cena.layers) if (c.type === 'image' && assets[c.assetId]) urls.add(assets[c.assetId]!.url)
  const pendentes = [...urls].filter((u) => !cachePre.has(u)).slice(0, 12) // limite por cena: não baixar tudo de uma vez
  return Promise.all(
    pendentes.map(
      (u) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = img.onerror = () => { cachePre.add(u); resolve() }
          img.src = u
        })
    )
  ).then(() => undefined)
}
