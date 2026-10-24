'use client'
/**
 * Visualizador: rota limpa, sem chrome. Modos Slides, Story e Explorar.
 * Teclado (setas, espaço, Home/End, F, Esc), toque (swipe), tela cheia por gesto, controles que somem,
 * pré-carregamento da próxima tela, tela de carregamento, fallback de mídia, transições fade/slide/scale/morph,
 * avanço automático e sincronização com a visão do apresentador.
 * Proporção diferente da tela: "Ajustar" (padrão) mostra a cena inteira e estende o fundo dela pelas faixas;
 * "Preencher tela" cobre a tela cortando o mínimo das bordas (escolha lembrada neste navegador).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Minimize2, Proportions, X } from 'lucide-react'
import type { Camada, Cena, DocumentoProjeto, Interacao } from '@/lib/scene/schema'
import { adaptarTransicao, aoEntrarNaCena, aoSairHover, cenaAtual, estadoInicialRuntime, executar, irPara, type Efeito, type EstadoRuntime, EASING_CSS } from '@/lib/scene/motor'
import { fimDasEntradas, tempoSaida } from '@/lib/scene/animacoes'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { usePreferencias, useTamanho } from '@/components/renderer/useTamanho'
import { aguardarFontes, fontesDoDocumento, useFontesDoDocumento } from '@/components/renderer/fontes'
import { useCanal } from './canal'
import { StoryView } from './StoryView'
import { ExplorarView } from './ExplorarView'
import { FundoEstendido } from './FundoEstendido'
import { sangriaDoEncaixe } from '@/lib/scene/sangria'
import { encaixar, type ModoEncaixe } from './fundo'
import { useControles } from './useControles'
import { Marca } from '@/components/ui/Logo'
import { carregarModelViewer } from '@/components/renderer/camadas/Modelo3d'
import { precarregarLottie } from '@/components/renderer/camadas/Lottie'
import { Downloads } from './Downloads'

export interface ViewerProps {
  documento: DocumentoProjeto
  assets: AssetsResolvidos
  nome: string
  indiceInicial?: number
  /** Esc (fora da tela cheia) ou botão "Sair": recebe a tela atual. */
  aoSair?: (indice: number) => void
  /** A cada troca de tela (ex.: lembrar a tela para selecioná-la no editor ao voltar). */
  aoMudarTela?: (indice: number) => void
  /** Selo "Feito com Mostra" (plano Free). */
  marca?: boolean
  /** Canal do apresentador (BroadcastChannel). */
  canal?: string
  /** Esconde os controles (janela controlada pelo apresentador). */
  semControles?: boolean
}

const LIMIAR_SWIPE = 50
/** Duração do fade da tela "Preparando apresentação". */
const SUMIR_CARREGAMENTO_MS = 300
const CHAVE_ENCAIXE = 'mostra.viewer.encaixe'

export function Viewer(props: ViewerProps) {
  const { documento, assets, nome, indiceInicial = 0, aoSair, aoMudarTela, marca, canal, semControles } = props
  useFontesDoDocumento(documento)
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const { reduzirMovimento, semHover } = usePreferencias()
  const mobile = tamanho.width > 0 && tamanho.width < 640
  const [runtime, setRuntime] = useState<EstadoRuntime>(() => estadoInicialRuntime(indiceInicial))
  const [anterior, setAnterior] = useState<{ cena: Cena; chave: number; volta: boolean } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [pronto, setPronto] = useState(false)
  // a 1ª tela só começa a animar quando a tela de carregamento termina de sumir (senão as entradas tocam escondidas)
  const [iniciado, setIniciado] = useState(false)
  const [visaoGeral, setVisaoGeral] = useState(false)
  const [modoEncaixe, setModoEncaixe] = useState<ModoEncaixe>('ajustar')
  const controles = useControles({ fixar: visaoGeral, zonaTopo: !!marca })
  const videos = useRef(new Map<string, HTMLVideoElement>())
  const bloqueadoAte = useRef(0)
  const saiuDaTelaCheiaEm = useRef(0)
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
          if (sai) setAnterior({ cena: sai, chave: Date.now(), volta: novo.indice < e.indice })
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
    if (m.tipo === 'encerrar') aoSair?.(indiceRef.current)
  })

  // ---------- entrada na tela ----------
  useEffect(() => {
    indiceRef.current = runtime.indice
    aplicar((e) => aoEntrarNaCena(documento, e))
    const prox = documento.scenes[runtime.indice + 1]
    if (prox) void precarregar(prox, assets)
    if (anuncio.current && cena) anuncio.current.textContent = `Tela ${runtime.indice + 1} de ${total}${cena.title ? `: ${cena.title}` : ''}`
    enviar({ tipo: 'estado', indice: runtime.indice, total })
    aoMudarTela?.(runtime.indice)
    // avanço automático
    if (cena?.autoAdvance && modo === 'slides') {
      const t = window.setTimeout(() => navegar((s) => irPara(documento, s, s.indice + 1)), cena.autoAdvance)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.indice, documento])

  // remove a tela que saiu depois da transição — e depois das entradas da tela nova, com a página ociosa:
  // tirar a tela antiga do DOM recalcula o estilo da tela nova inteira (~600 elementos numa tela de texto
  // animado), e no fim da transição isso caía no meio das entradas, como um tranco. Até sair ela fica
  // invisível (fade terminado) e sem receber cliques.
  const fimEntradasAtual = cena ? fimDasEntradas(cena.layers) : 0
  useEffect(() => {
    if (!anterior) return
    let ocioso = 0
    const remover = () => setAnterior(null)
    const t = window.setTimeout(() => {
      ocioso = typeof requestIdleCallback === 'function' ? requestIdleCallback(remover, { timeout: 1000 }) : window.setTimeout(remover, 0)
    }, Math.max(transicao?.duration ?? 400, fimEntradasAtual) + saidaMs + 60)
    return () => { window.clearTimeout(t); if (ocioso && typeof cancelIdleCallback === 'function') cancelIdleCallback(ocioso) }
  }, [anterior, transicao?.duration, saidaMs, fimEntradasAtual])

  useEffect(() => {
    let ativo = true
    const primeira = documento.scenes[indiceInicial] ?? documento.scenes[0]
    const t = window.setTimeout(() => ativo && setPronto(true), 4000)
    // imagens da 1ª tela + fontes do documento (evita a troca de fonte no meio da entrada)
    if (primeira) void Promise.all([precarregar(primeira, assets), aguardarFontes(fontesDoDocumento(documento))]).finally(() => { if (ativo) { setPronto(true); window.clearTimeout(t) } })
    return () => { ativo = false; window.clearTimeout(t) }
  }, [documento, assets, indiceInicial])

  useEffect(() => {
    if (!pronto || iniciado) return
    const t = window.setTimeout(() => setIniciado(true), reduzirMovimento ? 0 : SUMIR_CARREGAMENTO_MS)
    return () => window.clearTimeout(t)
  }, [pronto, iniciado, reduzirMovimento])

  const alternarFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await ref.current?.requestFullscreen()
    } catch {
      /* sem suporte (ex.: iOS): mantém UI limpa */
    }
  }, [ref])

  // ---------- teclado ----------
  const ocultarControles = controles.ocultar
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
      if (e.key === 'Escape') {
        if (visaoGeral) setVisaoGeral(false)
        else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
        // o 1º Esc em tela cheia é do navegador (sai da tela cheia); só o seguinte volta
        else if (performance.now() - saiuDaTelaCheiaEm.current > 400) aoSair?.(indiceRef.current)
        return
      }
      if (e.key === 'Tab') return
      if (e.key === 'f' || e.key === 'F') return void alternarFullscreen()
      if (modo === 'story') return
      if (e.key === 'g' || e.key === 'G') return setVisaoGeral((v) => !v)
      // controle focado pelo teclado (Tab): Espaço/Enter acionam o botão, não a navegação
      // (clicar com o mouse não foca os controles, então Espaço continua avançando depois de um clique)
      if (alvo?.closest('[data-controles]') && (e.key === ' ' || e.key === 'Enter')) return
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
          e.preventDefault(); navegar((s) => irPara(documento, s, s.indice + 1)); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault(); navegar((s) => irPara(documento, s, s.indice - 1)); break
        case 'Home': irParaIndice(0); break
        case 'End': irParaIndice(total - 1); break
        default: return
      }
      ocultarControles()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [documento, navegar, modo, total, aoSair, alternarFullscreen, irParaIndice, visaoGeral, ocultarControles])

  useEffect(() => {
    const f = () => {
      const agora = !!document.fullscreenElement
      setFullscreen((antes) => {
        if (antes && !agora) saiuDaTelaCheiaEm.current = performance.now()
        return agora
      })
    }
    f()
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])

  // ---------- Ajustar / Preencher tela (lembrado por navegador) ----------
  useEffect(() => {
    try { if (localStorage.getItem(CHAVE_ENCAIXE) === 'preencher') setModoEncaixe('preencher') } catch { /* sem storage */ }
  }, [])
  const alternarEncaixe = () => {
    setModoEncaixe((m) => {
      const novo = m === 'preencher' ? 'ajustar' : 'preencher'
      try { localStorage.setItem(CHAVE_ENCAIXE, novo) } catch { /* sem storage */ }
      return novo
    })
  }

  // ---------- toque ----------
  const toque = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => { controles.raiz.onPointerDown(e); if (e.pointerType === 'touch') toque.current = { x: e.clientX, y: e.clientY } }
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
    // quem acabou de selecionar texto (páginas de PDF importadas) não quer trocar de tela
    if (window.getSelection()?.toString()) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const frac = (e.clientX - rect.left) / rect.width
    if (frac > 0.8) navegar((s) => irPara(documento, s, s.indice + 1))
    else if (frac < 0.2) navegar((s) => irPara(documento, s, s.indice - 1))
  }

  const registrarVideo = useCallback((id: string, el: HTMLVideoElement | null) => { if (el) videos.current.set(id, el); else videos.current.delete(id) }, [])
  const encaixe = useMemo(() => (cena && tamanho.width ? encaixar(cena.size, tamanho, modoEncaixe) : null), [cena, tamanho, modoEncaixe])
  // camadas que encostam na borda se estendem até a borda da tela (sem faixas em telas de outra proporção)
  const sangria = useMemo(() => (encaixe ? sangriaDoEncaixe(encaixe.offsetX, encaixe.offsetY, encaixe.scale) : undefined), [encaixe])
  const comum = { assets, modo: 'viewer' as const, reduzirMovimento, semHover, mobile, aoInteragir, registrarVideo }
  const ehMorph = transicao?.type === 'morph' && !!anterior
  const ehPush = transicao?.type === 'push' && !!anterior
  // sentido da transição (deslizar/empurrar e o parallax delas): 1 avançando, −1 voltando
  const sentido = anterior?.volta ? -1 : 1
  // fade/deslizar/zoom: a tela que sai fica POR CIMA e some (opacidade), a nova só se move por baixo. Mesma mistura
  // de cores das telas opacas, mas a opacidade animada fica numa camada parada (a tela velha) em vez de na tela que
  // entra com as entradas tocando dentro — que obrigava o compositor a desenhar a tela nova inteira duas vezes por
  // quadro durante a transição
  const sobAnterior = !ehMorph && !ehPush && !!anterior && !!transicao && (transicao.type === 'fade' || transicao.type === 'slide' || transicao.type === 'scale') && runtime.historico.length > 0
  const easing = EASING_CSS[transicao?.easing ?? 'easeInOut']
  const duracao = transicao?.duration ?? 400
  const ocultos = !controles.visiveis

  /** Cena + fundo estendido pelas faixas (os dois entram/saem juntos na transição). */
  const camadaDeCena = (c: Cena, e: ReturnType<typeof encaixar>, comFundo: boolean) =>
    comFundo ? <FundoEstendido cena={c} assets={assets} escala={e.scale} x={e.offsetX} y={e.offsetY} largura={tamanho.width} altura={tamanho.height} style={{ left: -e.offsetX, top: -e.offsetY }} /> : null

  return (
    <div
      ref={ref}
      className={`relative h-full w-full select-none overflow-hidden text-white ${ocultos ? 'viewer-sem-controles' : ''} ${controles.cursor ? '' : 'viewer-sem-cursor'}`}
      onMouseMove={controles.raiz.onMouseMove}
      onMouseLeave={controles.raiz.onMouseLeave}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={cliqueFundo}
      // nos slides o fundo da raiz fica escondido atrás das telas (o fundo estendido cobre as faixas): sem transição
      // de cor nele — ela repintava a área inteira a cada quadro durante a troca de tela. No Explorar ele aparece
      // em volta do mapa e acompanha a tela atual.
      style={{ background: modo === 'story' ? '#111' : cena?.background ?? '#000', transition: modo === 'explorar' ? `background ${duracao}ms` : undefined }}
    >
      <div ref={anuncio} className="sr-only" aria-live="polite" />

      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#111] text-white"
        role="status"
        aria-hidden={pronto || undefined}
        style={{ opacity: pronto ? 0 : 1, visibility: pronto ? 'hidden' : 'visible', transition: `opacity ${SUMIR_CARREGAMENTO_MS}ms ease, visibility 0s linear ${SUMIR_CARREGAMENTO_MS}ms`, pointerEvents: pronto ? 'none' : undefined }}
      >
        {/* o pulso só enquanto carrega: escondida, a animação infinita seguia rodando na thread principal (não é
            composta num elemento invisível) e mantinha o ciclo de quadros acordado durante toda a apresentação */}
        <Marca className={pronto ? 'text-[28px]' : 'animate-pulse text-[28px]'} />
        <p className="text-sm text-white/60">Preparando apresentação…</p>
      </div>

      {modo === 'story' && <StoryView documento={documento} tamanho={tamanho} runtime={runtime} aplicar={aplicar} iniciado={iniciado} {...comum} />}

      {modo === 'explorar' && <ExplorarView documento={documento} tamanho={tamanho} runtime={runtime} visaoGeral={visaoGeral} preencher={modoEncaixe === 'preencher'} iniciado={iniciado} aoEscolher={(i) => { setVisaoGeral(false); irParaIndice(i) }} {...comum} />}

      {modo === 'slides' && cena && encaixe && (
        <>
          {/* no morph a tela nova é transparente sobre a antiga: o fundo estendido fica atrás das duas */}
          {ehMorph && anterior && <FundoEstendido key={`fundo-${anterior.chave}`} cena={cena} assets={assets} escala={encaixe.scale} x={encaixe.offsetX} y={encaixe.offsetY} largura={tamanho.width} altura={tamanho.height} corInicial={anterior.cena.background} duracao={duracao} style={{ left: 0, top: 0, zIndex: 0 }} />}
          {anterior && anterior.cena.id !== cena.id && (() => {
            const e = encaixar(anterior.cena.size, tamanho, modoEncaixe)
            return (
              // no morph o que não tem par sai rápido (45% da duração): o texto antigo não fica por baixo do novo
              // empurrar: a tela que sai anda junto com a que entra, pela largura da área (--larg)
              <div key={`sai-${anterior.chave}`} className={ehPush ? 'cena-saindo cena-saindo-push' : 'cena-saindo'} style={{ position: 'absolute', left: e.offsetX, top: e.offsetY, zIndex: sobAnterior ? 2 : 0, ['--dur' as string]: `${ehMorph ? Math.round(duracao * 0.45) : duracao}ms`, ['--dir' as string]: sentido, ['--plx-dir' as string]: sentido, ['--larg' as string]: `${tamanho.width}px`, animationDelay: saidaMs ? `${saidaMs}ms` : undefined }}>
                {camadaDeCena(anterior.cena, e, !ehMorph)}
                {/* a tela que sai remonta parada no estado final (animar=false): sem isso as entradas dela tocavam
                    de novo por baixo do fade e o texto dividido inteiro era montado outra vez no meio da transição */}
                <SceneRenderer cena={anterior.cena} escala={e.scale} assets={assets} modo="viewer" sangria={sangriaDoEncaixe(e.offsetX, e.offsetY, e.scale)} reduzirMovimento={reduzirMovimento} saida={saidaMs > 0} animar={saidaMs > 0} ocultar={ehMorph ? idsCasados(anterior.cena, cena) : undefined} />
              </div>
            )
          })()}
          <AposSaida key={`${cena.id}-${runtime.historico.length}`} ms={saidaMs}>
          <TelaEntrando
            transicao={!ehMorph && transicao && transicao.type !== 'none' && runtime.historico.length ? transicao.type : undefined}
            espera={!iniciado}
            sobAnterior={sobAnterior}
            fimEntradas={fimDasEntradas(cena.layers)}
            style={{ position: 'absolute', left: encaixe.offsetX, top: encaixe.offsetY, zIndex: 1, ['--dur' as string]: `${duracao}ms`, ['--dir' as string]: sentido, ['--plx-dir' as string]: sentido, ['--larg' as string]: `${tamanho.width}px` }}
          >
            {camadaDeCena(cena, encaixe, !ehMorph)}
            <SceneRenderer cena={cena} escala={encaixe.scale} sangria={sangria} runtime={runtime} chaveEntrada={cena.id} morphDe={ehMorph ? anterior?.cena : undefined} morphDuracao={transicao?.duration} morphEasing={easing} style={ehMorph ? { background: 'transparent' } : undefined} {...comum} />
          </TelaEntrando>
          </AposSaida>
        </>
      )}

      {/* controles discretos: sobrepostos (não ocupam espaço), somem ao apresentar */}
      {!semControles && (
        <div className="viewer-controles pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div {...controles.grupo} className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-xs backdrop-blur">
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
          <div {...controles.grupo} className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/55 px-1 py-1 backdrop-blur">
            {modo === 'explorar' && (
              <button aria-label="Visão geral do mapa" aria-pressed={visaoGeral} onClick={(e) => { e.stopPropagation(); setVisaoGeral((v) => !v) }} className="rounded-full p-2 hover:bg-white/15"><LayoutGrid className="h-4 w-4" /></button>
            )}
            {modo !== 'story' && (
              <button
                aria-label="Preencher tela"
                aria-pressed={modoEncaixe === 'preencher'}
                title={modoEncaixe === 'preencher' ? 'Preencher tela: cobre a tela cortando o mínimo das bordas. Clique para ajustar (mostrar tudo).' : 'Ajustar: mostra a tela inteira. Clique para preencher a tela.'}
                onClick={(e) => { e.stopPropagation(); alternarEncaixe() }}
                className={`rounded-full p-2 hover:bg-white/15 ${modoEncaixe === 'preencher' ? 'bg-white/15' : ''}`}
              >
                <Proportions className="h-4 w-4" />
              </button>
            )}
            <Downloads documento={documento} assets={assets} indice={runtime.indice} total={total} />
            <button aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} onClick={(e) => { e.stopPropagation(); void alternarFullscreen() }} className="rounded-full p-2 hover:bg-white/15">
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            {aoSair && <button aria-label="Sair da apresentação" onClick={(e) => { e.stopPropagation(); aoSair(indiceRef.current) }} className="rounded-full p-2 hover:bg-white/15"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      )}
      {marca && (
        <a href="/" {...controles.grupo} className="viewer-controles absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur hover:text-white">
          Feito com <Marca className="text-[13px]" />
        </a>
      )}
    </div>
  )
}

/**
 * Tela que entra. A transição preenche só para trás (o fim é o estilo parado), então a classe pode ficar; ela
 * sai depois das entradas, com a página ociosa, só para limpar. `sobAnterior`: fade/deslizar/zoom com a tela
 * anterior por cima sumindo — esta só se move (sem opacidade animada sobre as entradas tocando dentro).
 * Estado próprio (e os filhos vêm prontos do Viewer): ao soltar, só este nó re-renderiza.
 */
function TelaEntrando({ transicao, espera, sobAnterior = false, fimEntradas, style, children }: { transicao?: string; espera: boolean; sobAnterior?: boolean; fimEntradas: number; style: CSSProperties; children: ReactNode }) {
  const [feita, setFeita] = useState(false)
  const [terminou, setTerminou] = useState(false)
  // soltar a classe recalcula o estilo da tela inteira (a tela deixa de ser uma camada composta): espera as
  // entradas terminarem e a página ficar ociosa, para não cair no meio delas
  useEffect(() => {
    if (!terminou || feita) return
    let ocioso = 0
    const t = window.setTimeout(() => { ocioso = typeof requestIdleCallback === 'function' ? requestIdleCallback(() => setFeita(true), { timeout: 2000 }) : window.setTimeout(() => setFeita(true), 0) }, fimEntradas)
    return () => { window.clearTimeout(t); if (ocioso && typeof cancelIdleCallback === 'function') cancelIdleCallback(ocioso) }
  }, [terminou, feita, fimEntradas])
  return (
    <div
      className={[transicao && !feita ? `cena-transicao-${transicao}${sobAnterior ? ' sob-a-anterior' : ''}` : '', espera ? 'animacoes-em-espera' : ''].filter(Boolean).join(' ') || undefined}
      style={style}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setTerminou(true) }}
    >
      {children}
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
/** Quando a página estiver ociosa (a entrada da tela atual ainda está tocando quando a próxima é pré-carregada). */
const quandoOcioso = (fn: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 3000 }) : window.setTimeout(fn, 1200))
export function precarregar(cena: Cena, assets: AssetsResolvidos): Promise<void> {
  // 3D e Lottie: o código (three.js, lottie-web) é baixado e avaliado antes de a tela entrar — avaliar no meio da
  // transição era uma tarefa longa justamente quando as entradas começam
  const modelo = cena.layers.some((c) => c.type === 'model3d')
  const lotties = cena.layers.filter((c) => c.type === 'lottie')
  if (modelo || lotties.length) quandoOcioso(() => {
    if (modelo) void carregarModelViewer().catch(() => undefined)
    for (const l of lotties) if (l.type === 'lottie') precarregarLottie(l.data ? undefined : l.assetId ? assets[l.assetId]?.url : undefined)
  })
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
