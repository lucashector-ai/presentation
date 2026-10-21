'use client'
/**
 * Visualizador: rota limpa, sem chrome. Modos Slides, Story e Explorar.
 * Teclado (setas, espaço, Home/End, F, Esc), toque (swipe), tela cheia por gesto, controles que somem,
 * pré-carregamento da próxima tela, tela de carregamento, fallback de mídia, transições fade/slide/scale/morph,
 * avanço automático e sincronização com a visão do apresentador.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Minimize2, X } from 'lucide-react'
import type { Camada, Cena, DocumentoProjeto, Interacao } from '@/lib/scene/schema'
import { adaptarTransicao, aoEntrarNaCena, aoSairHover, cenaAtual, estadoInicialRuntime, executar, irPara, type Efeito, type EstadoRuntime, EASING_CSS } from '@/lib/scene/motor'
import { calcularEncaixe } from '@/lib/scene/transform'
import { tempoSaida } from '@/lib/scene/animacoes'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { usePreferencias, useTamanho } from '@/components/renderer/useTamanho'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { useCanal } from './canal'
import { StoryView } from './StoryView'
import { ExplorarView } from './ExplorarView'
import { Marca } from '@/components/ui/Logo'

export interface ViewerProps {
  documento: DocumentoProjeto
  assets: AssetsResolvidos
  nome: string
  indiceInicial?: number
  aoSair?: () => void
  /** Selo "Feito com Mostra" (plano Free). */
  marca?: boolean
  /** Canal do apresentador (BroadcastChannel). */
  canal?: string
  /** Esconde os controles (janela controlada pelo apresentador). */
  semControles?: boolean
}

const TEMPO_OCIOSO = 2500
const LIMIAR_SWIPE = 50

export function Viewer(props: ViewerProps) {
  const { documento, assets, nome, indiceInicial = 0, aoSair, marca, canal, semControles } = props
  useFontesDoDocumento(documento)
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const { reduzirMovimento, semHover } = usePreferencias()
  const mobile = tamanho.width > 0 && tamanho.width < 640
  const [runtime, setRuntime] = useState<EstadoRuntime>(() => estadoInicialRuntime(indiceInicial))
  const [anterior, setAnterior] = useState<{ cena: Cena; chave: number } | null>(null)
  const [ocioso, setOcioso] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [visaoGeral, setVisaoGeral] = useState(false)
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const timerOcioso = useRef<number | undefined>(undefined)
  const bloqueadoAte = useRef(0)
  const anuncio = useRef<HTMLDivElement>(null)
  const indiceRef = useRef(runtime.indice)

  const modo = documento.mode
  const cena = cenaAtual(documento, runtime)
  const total = documento.scenes.length
  const transicao = adaptarTransicao(runtime.transicao, reduzirMovimento)
  // animações de saída da tela anterior: tocam primeiro; a próxima tela entra quando terminam
  const saidaMs = anterior ? (reduzirMovimento ? Math.min(150, tempoSaida(anterior.cena)) : tempoSaida(anterior.cena)) : 0

  // ---------- efeitos do motor ----------
  const executarEfeitos = useCallback((efeitos: Efeito[]) => {
    for (const ef of efeitos) {
      if (ef.tipo === 'abrirLink') {
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
        const novo = 'estado' in r && 'efeitos' in r ? r.estado : (r as EstadoRuntime)
        if ('efeitos' in r && r.efeitos.length) queueMicrotask(() => executarEfeitos(r.efeitos))
        if (novo.indice !== e.indice) {
          const sai = documento.scenes[e.indice]
          if (sai) setAnterior({ cena: sai, chave: Date.now() })
        }
        return novo
      })
    },
    [executarEfeitos, documento.scenes]
  )

  const navegar = useCallback(
    (fn: (e: EstadoRuntime) => EstadoRuntime) => {
      const agora = performance.now()
      if (agora < bloqueadoAte.current) return // evita múltiplos disparos durante a transição
      bloqueadoAte.current = agora + (reduzirMovimento ? 50 : 220)
      aplicar(fn)
    },
    [aplicar, reduzirMovimento]
  )

  const irParaIndice = useCallback((i: number) => navegar((s) => irPara(documento, s, i)), [navegar, documento])

  const aoInteragir = useCallback(
    (camada: Camada, inters: Interacao[], origem: 'click' | 'hoverEnter' | 'hoverLeave') => {
      if (origem === 'hoverLeave') return aplicar((e) => aoSairHover(documento, e, camada))
      const navega = inters.some((i) => ['nextScene', 'prevScene', 'goToScene'].includes(i.do.action))
      const rodar = (e: EstadoRuntime) => {
        let estado = e
        const efeitos: Efeito[] = []
        for (const i of inters) {
          const r = executar(documento, estado, camada, i)
          estado = r.estado
          efeitos.push(...r.efeitos)
        }
        return { estado, efeitos }
      }
      if (navega) {
        const agora = performance.now()
        if (agora < bloqueadoAte.current) return
        bloqueadoAte.current = agora + 220
      }
      aplicar(rodar)
    },
    [aplicar, documento]
  )

  // ---------- canal do apresentador ----------
  const enviar = useCanal(canal, (m) => {
    if (m.tipo === 'ir') irParaIndice(m.indice)
    if (m.tipo === 'pedirEstado') enviar({ tipo: 'estado', indice: indiceRef.current, total })
    if (m.tipo === 'encerrar') aoSair?.()
  })

  // ---------- entrada na tela ----------
  useEffect(() => {
    indiceRef.current = runtime.indice
    aplicar((e) => aoEntrarNaCena(documento, e))
    const prox = documento.scenes[runtime.indice + 1]
    if (prox) void precarregar(prox, assets)
    if (anuncio.current && cena) anuncio.current.textContent = `Tela ${runtime.indice + 1} de ${total}${cena.title ? `: ${cena.title}` : ''}`
    enviar({ tipo: 'estado', indice: runtime.indice, total })
    // avanço automático
    if (cena?.autoAdvance && modo === 'slides') {
      const t = window.setTimeout(() => navegar((s) => irPara(documento, s, s.indice + 1)), cena.autoAdvance)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.indice, documento])

  // remove a tela que saiu ao fim da transição
  useEffect(() => {
    if (!anterior) return
    const t = window.setTimeout(() => setAnterior(null), (transicao?.duration ?? 400) + saidaMs + 60)
    return () => window.clearTimeout(t)
  }, [anterior, transicao?.duration, saidaMs])

  useEffect(() => {
    let ativo = true
    const primeira = documento.scenes[indiceInicial] ?? documento.scenes[0]
    const t = window.setTimeout(() => ativo && setPronto(true), 4000)
    if (primeira) void precarregar(primeira, assets).finally(() => { if (ativo) { setPronto(true); window.clearTimeout(t) } })
    return () => { ativo = false; window.clearTimeout(t) }
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
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
      if (e.key === 'Escape') {
        if (visaoGeral) setVisaoGeral(false)
        else if (document.fullscreenElement) void document.exitFullscreen()
        else aoSair?.()
        return
      }
      if (e.key === 'f' || e.key === 'F') return void alternarFullscreen()
      if (modo === 'story') return
      if (e.key === 'g' || e.key === 'G') return setVisaoGeral((v) => !v)
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
          e.preventDefault(); navegar((s) => irPara(documento, s, s.indice + 1)); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault(); navegar((s) => irPara(documento, s, s.indice - 1)); break
        case 'Home': irParaIndice(0); break
        case 'End': irParaIndice(total - 1); break
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [documento, navegar, modo, total, aoSair, alternarFullscreen, irParaIndice, visaoGeral])

  // ---------- ociosidade ----------
  const acordar = useCallback(() => {
    setOcioso(false)
    window.clearTimeout(timerOcioso.current)
    timerOcioso.current = window.setTimeout(() => setOcioso(true), TEMPO_OCIOSO)
  }, [])
  useEffect(() => { acordar(); return () => window.clearTimeout(timerOcioso.current) }, [acordar])

  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  // ---------- toque ----------
  const toque = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => { acordar(); if (e.pointerType === 'touch') toque.current = { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !toque.current || modo !== 'slides') return
    const dx = e.clientX - toque.current.x
    const dy = e.clientY - toque.current.y
    toque.current = null
    if (Math.abs(dx) > LIMIAR_SWIPE && Math.abs(dx) > Math.abs(dy)) navegar((s) => irPara(documento, s, s.indice + (dx < 0 ? 1 : -1)))
  }

  const cliqueFundo = (e: React.MouseEvent) => {
    if (modo !== 'slides' || mobile) return
    const alvo = e.target as HTMLElement
    if (alvo.closest('[role="button"], button, a, video, model-viewer, iframe')) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const frac = (e.clientX - rect.left) / rect.width
    if (frac > 0.8) navegar((s) => irPara(documento, s, s.indice + 1))
    else if (frac < 0.2) navegar((s) => irPara(documento, s, s.indice - 1))
  }

  const registrarVideo = useCallback((id: string, el: HTMLVideoElement | null) => { if (el) videos.current.set(id, el); else videos.current.delete(id) }, [])
  const encaixe = useMemo(() => (cena && tamanho.width ? calcularEncaixe(cena.size, tamanho) : null), [cena, tamanho])
  const comum = { assets, modo: 'viewer' as const, reduzirMovimento, semHover, mobile, aoInteragir, registrarVideo }
  const ehMorph = transicao?.type === 'morph' && !!anterior
  const easing = EASING_CSS[transicao?.easing ?? 'easeInOut']

  return (
    <div
      ref={ref}
      className={`relative h-full w-full select-none overflow-hidden text-white ${ocioso ? 'viewer-ocioso' : ''}`}
      onMouseMove={acordar}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={cliqueFundo}
      style={{ background: modo === 'story' ? '#111' : cena?.background ?? '#000', transition: `background ${transicao?.duration ?? 400}ms` }}
    >
      <div ref={anuncio} className="sr-only" aria-live="polite" />

      {!pronto && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-fundo text-texto" role="status">
          <Marca className="animate-pulse text-[28px]" />
          <p className="text-sm text-texto2">Preparando apresentação…</p>
        </div>
      )}

      {modo === 'story' && <StoryView documento={documento} tamanho={tamanho} runtime={runtime} aplicar={aplicar} {...comum} />}

      {modo === 'explorar' && <ExplorarView documento={documento} tamanho={tamanho} runtime={runtime} visaoGeral={visaoGeral} aoEscolher={(i) => { setVisaoGeral(false); irParaIndice(i) }} {...comum} />}

      {modo === 'slides' && cena && encaixe && (
        <>
          {anterior && anterior.cena.id !== cena.id && (
            <div key={`sai-${anterior.chave}`} className="cena-saindo" style={{ position: 'absolute', left: encaixe.offsetX, top: encaixe.offsetY, zIndex: 0, ['--dur' as string]: `${transicao?.duration ?? 400}ms`, animationDelay: saidaMs ? `${saidaMs}ms` : undefined }}>
              <SceneRenderer cena={anterior.cena} escala={calcularEncaixe(anterior.cena.size, tamanho).scale} assets={assets} modo="viewer" reduzirMovimento={reduzirMovimento} saida={saidaMs > 0} ocultar={ehMorph ? idsCasados(anterior.cena, cena) : undefined} />
            </div>
          )}
          <AposSaida key={`${cena.id}-${runtime.historico.length}`} ms={saidaMs}>
          <div
            className={!ehMorph && transicao && transicao.type !== 'none' && runtime.historico.length ? `cena-transicao-${transicao.type}` : undefined}
            style={{ position: 'absolute', left: encaixe.offsetX, top: encaixe.offsetY, zIndex: 1, ['--dur' as string]: `${transicao?.duration ?? 400}ms` }}
          >
            <SceneRenderer cena={cena} escala={encaixe.scale} runtime={runtime} chaveEntrada={cena.id} morphDe={ehMorph ? anterior?.cena : undefined} morphDuracao={transicao?.duration} morphEasing={easing} style={ehMorph ? { background: 'transparent' } : undefined} {...comum} />
          </div>
          </AposSaida>
        </>
      )}

      {/* controles discretos */}
      {!semControles && (
        <div className="viewer-controles pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs backdrop-blur">
            {modo !== 'story' ? (
              <>
                <button aria-label="Tela anterior" onClick={(e) => { e.stopPropagation(); navegar((s) => irPara(documento, s, s.indice - 1)) }} disabled={runtime.indice === 0} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <span className="mono min-w-[3.5rem] text-center tabular-nums">{String(runtime.indice + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
                <button aria-label="Próxima tela" onClick={(e) => { e.stopPropagation(); navegar((s) => irPara(documento, s, s.indice + 1)) }} disabled={runtime.indice === total - 1} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </>
            ) : (
              <span className="px-2 py-1.5">{nome}</span>
            )}
          </div>
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 px-1 py-1 backdrop-blur">
            {modo === 'explorar' && (
              <button aria-label="Visão geral do mapa" aria-pressed={visaoGeral} onClick={(e) => { e.stopPropagation(); setVisaoGeral((v) => !v) }} className="rounded-full p-2 hover:bg-white/15"><LayoutGrid className="h-4 w-4" /></button>
            )}
            <button aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} onClick={(e) => { e.stopPropagation(); void alternarFullscreen() }} className="rounded-full p-2 hover:bg-white/15">
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            {aoSair && <button aria-label="Sair da apresentação" onClick={(e) => { e.stopPropagation(); aoSair() }} className="rounded-full p-2 hover:bg-white/15"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      )}
      {marca && (
        <a href="/" className="viewer-controles absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur hover:text-white">
          Feito com <Marca className="text-[13px]" />
        </a>
      )}
    </div>
  )
}

/** Monta a tela que entra só depois que as animações de saída da anterior terminam. */
function AposSaida({ ms, children }: { ms: number; children: ReactNode }) {
  const [pronto, setPronto] = useState(ms <= 0)
  useEffect(() => {
    if (pronto) return
    const t = window.setTimeout(() => setPronto(true), ms)
    return () => window.clearTimeout(t)
  }, [ms, pronto])
  return pronto ? <>{children}</> : null
}

/** IDs das camadas da tela que sai que têm par na tela que entra (ficam ocultas na saída durante o morph). */
function idsCasados(sai: Cena, entra: Cena): Set<string> {
  const chave = (c: Camada) => (c.name?.trim() ? `n:${c.name.trim().toLowerCase()}` : `i:${c.id}`)
  const destino = new Set(entra.layers.map(chave))
  return new Set(sai.layers.filter((l) => destino.has(chave(l))).map((l) => l.id))
}

// ---------- pré-carregamento controlado ----------

const cachePre = new Set<string>()
export function precarregar(cena: Cena, assets: AssetsResolvidos): Promise<void> {
  const urls = new Set<string>()
  if (cena.backgroundAssetId && assets[cena.backgroundAssetId]) urls.add(assets[cena.backgroundAssetId]!.url)
  for (const c of cena.layers) if (c.type === 'image' && assets[c.assetId]) urls.add(assets[c.assetId]!.url)
  const pendentes = [...urls].filter((u) => !cachePre.has(u)).slice(0, 12)
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
