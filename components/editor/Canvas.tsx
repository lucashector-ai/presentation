'use client'
/**
 * Canvas do editor (camadas DOM + Pointer Events, sem canvas raster).
 * - Seleção: clique (grupo inteiro), Shift+clique, duplo clique entra no grupo/edita texto, arrastar no vazio = área
 * - Mover com guias inteligentes (bordas e centros das outras camadas e da tela); Shift trava o eixo
 * - Redimensionar (8 alças, Shift proporcional) também para seleção múltipla; alça de rotação (Shift = 15°)
 * - Ferramentas Texto/Forma/Hotspot: arraste para desenhar (ou clique para tamanho padrão)
 * - Zoom no cursor (Ctrl/⌘ + roda, pinça), pan (roda, espaço+arrastar, botão do meio, ferramenta Mão)
 * - Soltar arquivos/SVG/links na posição do cursor
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Camada, CamadaTexto, DocumentoProjeto } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { encaixar, intersecta, anguloRotacao, type Guia } from '@/lib/editor/guias'
import { camadaNoPonto, envolvente, redimensionar, snap, type Alca, type Retangulo } from '@/lib/scene/transform'
import { pilhaFonte } from '@/lib/design-tokens'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { useTamanho } from '@/components/renderer/useTamanho'
import { MiniaturaCena } from './MiniaturaCena'
import { lerDataTransfer } from '@/lib/importar/clipboard'
import { importarConteudo, type Avisar } from '@/lib/editor/importar'
import type { AssetDemo } from '@/lib/demo/tipos'

const ALCAS: Alca[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CURSORES: Record<Alca, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }
const PASSO_GRADE = 8
const ZOOM_MIN = 0.05
const ZOOM_MAX = 8

type Gesto =
  | { tipo: 'mover'; inicio: { x: number; y: number }; iniciais: Map<string, Retangulo>; caixa: Retangulo; moveu: boolean; antes: DocumentoProjeto }
  | { tipo: 'redimensionar'; alca: Alca; inicio: { x: number; y: number }; caixa: Retangulo; iniciais: Map<string, Retangulo>; antes: DocumentoProjeto }
  | { tipo: 'rotacionar'; centro: { x: number; y: number }; id: string; antes: DocumentoProjeto }
  | { tipo: 'area'; inicio: { x: number; y: number }; atual: { x: number; y: number }; base: string[] }
  | { tipo: 'desenhar'; inicio: { x: number; y: number }; atual: { x: number; y: number } }
  | { tipo: 'pan'; inicio: { x: number; y: number }; panInicial: { x: number; y: number } }

export function Canvas({ editor, assets, avisar, interagir3d = false, aoEscala }: { editor: Editor; assets: Record<string, AssetDemo>; avisar: Avisar; interagir3d?: boolean; aoEscala?: (s: number) => void }) {
  const { estado, cena, acoes, indiceCena } = editor
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const gesto = useRef<Gesto | null>(null)
  const [, forcar] = useState(0)
  const [guias, setGuias] = useState<Guia[]>([])
  const [hover, setHover] = useState<string | null>(null)
  const [editandoTexto, setEditandoTexto] = useState<string | null>(null)
  const [espaco, setEspaco] = useState(false)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
  const [previaAtiva, setPreviaAtiva] = useState(false)

  // prévia de animação: o canvas renderiza em modo apresentação por alguns segundos e volta ao modo edição
  useEffect(() => {
    if (!estado.previa) return
    setPreviaAtiva(true)
    const t = window.setTimeout(() => setPreviaAtiva(false), 2600)
    return () => window.clearTimeout(t)
  }, [estado.previa])

  // ---------- viewport ----------
  const vp = useMemo(() => {
    if (!cena || !tamanho.width) return null
    const padX = tamanho.width < 700 ? 48 : 128
    const ajuste = Math.max(ZOOM_MIN, Math.min((tamanho.width - padX) / cena.size.width, (tamanho.height - 160) / cena.size.height))
    const s = estado.zoom || ajuste
    const ox = (tamanho.width - cena.size.width * s) / 2 + estado.pan.x
    const oy = (tamanho.height - cena.size.height * s) / 2 + estado.pan.y
    return { s, ox, oy, ajuste }
  }, [cena, tamanho, estado.zoom, estado.pan])

  useEffect(() => { if (vp) aoEscala?.(vp.s) }, [vp, aoEscala])

  const local = useCallback((ev: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }, [ref])
  const paraCena = useCallback((p: { x: number; y: number }) => (vp ? { x: (p.x - vp.ox) / vp.s, y: (p.y - vp.oy) / vp.s } : p), [vp])
  const paraTela = useCallback((r: Retangulo) => (vp ? { x: vp.ox + r.x * vp.s, y: vp.oy + r.y * vp.s, width: r.width * vp.s, height: r.height * vp.s } : r), [vp])

  const zoomEm = useCallback(
    (novo: number, p: { x: number; y: number }) => {
      if (!vp || !cena) return
      const s2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, novo))
      const ox2 = p.x - (p.x - vp.ox) * (s2 / vp.s)
      const oy2 = p.y - (p.y - vp.oy) * (s2 / vp.s)
      acoes.ui({ zoom: s2, pan: { x: ox2 - (tamanho.width - cena.size.width * s2) / 2, y: oy2 - (tamanho.height - cena.size.height * s2) / 2 } })
    },
    [vp, cena, acoes, tamanho]
  )

  // espaço segurado = mão temporária
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) && !alvo.isContentEditable) { e.preventDefault(); setEspaco(true) }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setEspaco(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // roda: pan; Ctrl/⌘ (e pinça do trackpad): zoom no cursor
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      if (!vp) return
      if (e.ctrlKey || e.metaKey) zoomEm(vp.s * Math.exp(-e.deltaY * 0.0022), local(e))
      else acoes.ui({ pan: { x: estado.pan.x - e.deltaX, y: estado.pan.y - e.deltaY }, zoom: estado.zoom || vp.s })
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [ref, vp, zoomEm, local, acoes, estado.pan, estado.zoom])

  if (!cena) return null
  const selecionadas = cena.layers.filter((l) => estado.selecao.includes(l.id))
  const caixaSel = selecionadas.length ? envolvente(selecionadas) : null
  const unica = selecionadas.length === 1 ? selecionadas[0]! : null
  const ehDesenho = estado.ferramenta === 'texto' || estado.ferramenta === 'forma' || estado.ferramenta === 'hotspot'
  const modoMao = estado.ferramenta === 'mao' || espaco
  const aplicarGrade = (v: number) => (estado.grade ? snap(v, PASSO_GRADE, true) : v)
  const interacoesVisiveis = estado.abaDireita === 'interacoes' && estado.mostrarHotspots
  const comInteracao = cena.layers.filter((l) => l.interactions.length > 0)

  // ---------- ponteiro ----------
  const onPointerDown = (ev: React.PointerEvent) => {
    if (editandoTexto || !vp) return
    // modo "interagir": o 3D/embed recebe o ponteiro (girar o modelo, dar play no vídeo)
    if (interagir3d && (ev.target as HTMLElement).closest('model-viewer, iframe')) return
    const p = local(ev)
    const pc = paraCena(p)
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
    if (ev.button === 1 || modoMao) {
      gesto.current = { tipo: 'pan', inicio: p, panInicial: estado.pan }
      if (!estado.zoom) acoes.ui({ zoom: vp.s })
      return
    }
    if (ev.button !== 0) return
    const alvo = ev.target as HTMLElement
    const alca = alvo.dataset.alca as Alca | 'rot' | undefined
    if (alca === 'rot' && unica) {
      gesto.current = { tipo: 'rotacionar', centro: { x: unica.x + unica.width / 2, y: unica.y + unica.height / 2 }, id: unica.id, antes: acoes.documentoAtual() }
      return
    }
    if (alca && alca !== 'rot' && caixaSel) {
      const moviveis = selecionadas.filter((l) => !l.locked)
      gesto.current = { tipo: 'redimensionar', alca, inicio: pc, caixa: caixaSel, iniciais: new Map(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }])), antes: acoes.documentoAtual() }
      return
    }
    if (ehDesenho) {
      gesto.current = { tipo: 'desenhar', inicio: pc, atual: pc }
      return
    }
    // clique dentro da caixa de seleção múltipla move tudo
    const camada = camadaNoPonto(cena, pc, { ignorarTravadas: true })
    let ids = estado.selecao
    if (camada) {
      if (ev.shiftKey) ids = ids.includes(camada.id) ? ids.filter((i) => i !== camada.id) : [...ids, camada.id]
      else if (!ids.includes(camada.id)) ids = [camada.id]
      acoes.selecionar(ids)
    } else if (caixaSel && selecionadas.length > 1 && pc.x >= caixaSel.x && pc.x <= caixaSel.x + caixaSel.width && pc.y >= caixaSel.y && pc.y <= caixaSel.y + caixaSel.height) {
      // mantém a seleção
    } else {
      gesto.current = { tipo: 'area', inicio: pc, atual: pc, base: ev.shiftKey ? estado.selecao : [] }
      if (!ev.shiftKey) acoes.selecionar([])
      return
    }
    const idsFinais = camada ? expandir(ids) : estado.selecao
    const moviveis = cena.layers.filter((l) => idsFinais.includes(l.id) && !l.locked)
    if (moviveis.length) {
      gesto.current = { tipo: 'mover', inicio: pc, iniciais: new Map(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }])), caixa: envolvente(moviveis), moveu: false, antes: acoes.documentoAtual() }
    }
  }

  const expandir = (ids: string[]) => {
    const grupos = new Set(cena.layers.filter((l) => ids.includes(l.id) && l.groupId).map((l) => l.groupId))
    return [...new Set([...ids, ...cena.layers.filter((l) => l.groupId && grupos.has(l.groupId)).map((l) => l.id)])]
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    if (!vp) return
    const p = local(ev)
    const pc = paraCena(p)
    const g = gesto.current
    if (!g) {
      const h = !ehDesenho && !modoMao ? camadaNoPonto(cena, pc, { ignorarTravadas: true }) : undefined
      if ((h?.id ?? null) !== hover) setHover(h?.id ?? null)
      return
    }
    switch (g.tipo) {
      case 'pan':
        acoes.ui({ pan: { x: g.panInicial.x + (p.x - g.inicio.x), y: g.panInicial.y + (p.y - g.inicio.y) } })
        break
      case 'mover': {
        let dx = pc.x - g.inicio.x
        let dy = pc.y - g.inicio.y
        if (!g.moveu && Math.hypot(dx, dy) * vp.s < 3) return
        g.moveu = true
        if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        let proposta = { ...g.caixa, x: aplicarGrade(g.caixa.x + dx), y: aplicarGrade(g.caixa.y + dy) }
        let novasGuias: Guia[] = []
        if (estado.snap && !ev.altKey) {
          const outros = cena.layers.filter((l) => !g.iniciais.has(l.id) && !l.hidden)
          const r = encaixar(proposta, outros, cena.size, 6 / vp.s)
          proposta = { ...proposta, x: r.x, y: r.y }
          novasGuias = r.guias
        }
        setGuias(novasGuias)
        const fx = proposta.x - g.caixa.x
        const fy = proposta.y - g.caixa.y
        acoes.atualizarCamadas([...g.iniciais.keys()], (l) => { const i = g.iniciais.get(l.id)!; return { ...l, x: Math.round((i.x + fx) * 10) / 10, y: Math.round((i.y + fy) * 10) / 10 } }, false)
        break
      }
      case 'redimensionar': {
        const nova = redimensionar(g.caixa, g.alca, pc.x - g.inicio.x, pc.y - g.inicio.y, ev.shiftKey || (g.iniciais.size === 1 && cena.layers.find((l) => g.iniciais.has(l.id))?.type === 'svg' && !ev.altKey))
        const sx = nova.width / g.caixa.width
        const sy = nova.height / g.caixa.height
        acoes.atualizarCamadas([...g.iniciais.keys()], (l) => {
          const i = g.iniciais.get(l.id)!
          return { ...l, x: Math.round(nova.x + (i.x - g.caixa.x) * sx), y: Math.round(nova.y + (i.y - g.caixa.y) * sy), width: Math.max(4, Math.round(i.width * sx)), height: Math.max(4, Math.round(i.height * sy)) }
        }, false)
        break
      }
      case 'rotacionar':
        acoes.atualizarCamadas([g.id], { rotation: anguloRotacao(g.centro, pc, ev.shiftKey) } as Partial<Camada>, false)
        break
      case 'area': {
        g.atual = pc
        const area = retDe(g.inicio, g.atual)
        const dentro = cena.layers.filter((l) => !l.hidden && !l.locked && intersecta(area, l)).map((l) => l.id)
        acoes.selecionar([...new Set([...g.base, ...dentro])])
        forcar((n) => n + 1)
        break
      }
      case 'desenhar':
        g.atual = ev.shiftKey ? quadrado(g.inicio, pc) : pc
        forcar((n) => n + 1)
        break
    }
  }

  const onPointerUp = () => {
    const g = gesto.current
    gesto.current = null
    setGuias([])
    if (!g) return
    if ((g.tipo === 'mover' && g.moveu) || g.tipo === 'redimensionar' || g.tipo === 'rotacionar') acoes.registrarHistorico(g.antes)
    if (g.tipo === 'desenhar') {
      const r = retDe(g.inicio, g.atual)
      const pequeno = r.width < 8 && r.height < 8
      const tipo = estado.ferramenta === 'texto' ? 'text' : estado.ferramenta === 'hotspot' ? 'hotspot' : 'shape'
      const padrao = tipo === 'text' ? { width: cena.size.width * 0.3, height: cena.size.width * 0.05 } : { width: cena.size.width * 0.18, height: cena.size.width * 0.18 }
      const rect = pequeno ? { x: g.inicio.x, y: g.inicio.y, ...padrao } : r
      const nova = acoes.criarCamada({ type: tipo }, { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) })
      acoes.setFerramenta('mover')
      if (nova?.type === 'text') setTimeout(() => setEditandoTexto(nova.id), 30)
    }
    forcar((n) => n + 1)
  }

  const onDoubleClick = (ev: React.MouseEvent) => {
    const pc = paraCena(local(ev))
    const camada = camadaNoPonto(cena, pc, { ignorarTravadas: true })
    if (!camada) return
    if (camada.type === 'text') setEditandoTexto(camada.id)
    else if (camada.groupId) acoes.selecionarExato([camada.id])
  }

  // ---------- soltar arquivos ----------
  const onDrop = async (ev: React.DragEvent) => {
    ev.preventDefault()
    setArrastandoArquivo(false)
    const assetId = ev.dataTransfer.getData('application/x-mostra-asset')
    const ponto = paraCena(local(ev))
    if (assetId) {
      const a = assets[assetId]
      if (a) acoes.adicionarAsset(a, ponto)
      return
    }
    const bloco = ev.dataTransfer.getData('application/x-mostra-bloco')
    if (bloco) {
      window.dispatchEvent(new CustomEvent('mostra:bloco', { detail: { bloco, ponto } }))
      return
    }
    await importarConteudo(editor, lerDataTransfer(ev.dataTransfer), { ponto, avisar })
  }

  if (!vp) return <div ref={ref} className="h-full w-full bg-canvas" />
  const telaCena = { x: vp.ox, y: vp.oy, width: cena.size.width * vp.s, height: cena.size.height * vp.s }
  const g = gesto.current
  const textoEmEdicao = editandoTexto ? (cena.layers.find((l) => l.id === editandoTexto) as CamadaTexto | undefined) : undefined
  const cursor = modoMao ? (g?.tipo === 'pan' ? 'grabbing' : 'grab') : ehDesenho ? 'crosshair' : 'default'

  return (
    <div
      ref={ref}
      data-testid="canvas-area"
      className={`relative h-full w-full select-none overflow-hidden bg-canvas ${arrastandoArquivo ? 'ring-2 ring-inset ring-acento' : ''}`}
      style={{ cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => { e.preventDefault(); if (!arrastandoArquivo) setArrastandoArquivo(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastandoArquivo(false) }}
      onDrop={onDrop}
      onContextMenu={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('mostra:menu', { detail: { x: e.clientX, y: e.clientY } })) }}
    >
      {/* rótulo da tela */}
      <div className="mono pointer-events-none absolute text-[11px] text-texto2" style={{ left: telaCena.x, top: telaCena.y - 22 }}>
        {String(indiceCena + 1).padStart(2, '0')} — {cena.title || 'Sem título'}
      </div>

      <div data-testid="canvas" className={`absolute shadow-[0_1px_3px_rgba(0,0,0,.06),0_20px_50px_-30px_rgba(0,0,0,.35)] ${estado.grade ? 'grade-editor' : ''}`} style={{ left: telaCena.x, top: telaCena.y, width: telaCena.width, height: telaCena.height, backgroundSize: `${PASSO_GRADE * vp.s * 4}px ${PASSO_GRADE * vp.s * 4}px` }}>
        <SceneRenderer key={`${cena.id}-${previaAtiva ? estado.previa : 0}`} cena={cena} assets={assets} escala={vp.s} modo={previaAtiva ? 'viewer' : 'editor'} interativoNoEditor={interagir3d} chaveEntrada={`${estado.previa}`} ocultar={editandoTexto ? new Set([editandoTexto]) : undefined} />
        {estado.documento.mode === 'story' && <div aria-hidden className="pointer-events-none absolute border border-dashed border-texto3/60" style={{ left: '6%', right: '6%', top: '8%', bottom: '10%' }} />}
      </div>

      {/* hover */}
      {hover && !estado.selecao.includes(hover) && !g && (() => { const l = cena.layers.find((x) => x.id === hover); return l ? <Contorno r={paraTela(l)} rot={l.rotation} cor="rgb(89 101 242 / .55)" /> : null })()}

      {/* interações: marcadores numerados e fluxo */}
      {interacoesVisiveis && comInteracao.map((l, i) => {
        const r = paraTela(l)
        return (
          <div key={`h-${l.id}`} className="pointer-events-none absolute" style={{ left: r.x - 6, top: r.y - 6, width: r.width + 12, height: r.height + 12, border: '1px dashed rgb(89 101 242 / .7)', borderRadius: 8, background: 'rgb(89 101 242 / .04)' }}>
            <span className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-acento text-[11px] font-medium text-white">{i + 1}</span>
          </div>
        )
      })}
      {interacoesVisiveis && unica && <FluxoInteracao camada={unica} editor={editor} assets={assets} r={paraTela(unica)} />}

      {/* seleção */}
      {!editandoTexto && selecionadas.map((l) => <Contorno key={l.id} r={paraTela(l)} rot={l.rotation} cor="rgb(89 101 242)" largura={1.5} />)}
      {caixaSel && !editandoTexto && !interacoesVisiveis && (() => {
        const r = paraTela(caixaSel)
        const travada = selecionadas.every((l) => l.locked)
        return (
          <>
            {selecionadas.length > 1 && <Contorno r={r} rot={0} cor="rgb(89 101 242)" tracejado />}
            {!travada && (unica ? !unica.rotation : true) && ALCAS.map((a) => {
              const cx = a.includes('w') ? r.x : a.includes('e') ? r.x + r.width : r.x + r.width / 2
              const cy = a.includes('n') ? r.y : a.includes('s') ? r.y + r.height : r.y + r.height / 2
              return <div key={a} data-alca={a} className="absolute z-10 h-2 w-2 border-[1.5px] border-acento bg-white" style={{ left: cx - 4, top: cy - 4, cursor: CURSORES[a] }} />
            })}
            {unica && !travada && <div data-alca="rot" title="Girar (Shift = 15°)" className="absolute z-10 h-3 w-3 rounded-full border-[1.5px] border-acento bg-white" style={{ left: r.x + r.width / 2 - 6, top: r.y - 28, cursor: 'grab' }} />}
            {unica && !travada && <div className="pointer-events-none absolute w-px bg-acento" style={{ left: r.x + r.width / 2, top: r.y - 16, height: 16 }} />}
            <div className="mono pointer-events-none absolute whitespace-nowrap rounded-[4px] bg-acento px-1.5 py-[3px] text-[11px] leading-none text-white" style={{ left: r.x + r.width / 2, top: r.y + r.height + 8, transform: 'translateX(-50%)' }}>
              {Math.round(caixaSel.width)} × {Math.round(caixaSel.height)}{unica?.rotation ? ` · ${unica.rotation}°` : ''}
            </div>
          </>
        )
      })()}

      {/* guias inteligentes */}
      {guias.map((gu, i) => {
        const a = paraTela(gu.eixo === 'v' ? { x: gu.pos, y: gu.de, width: 0, height: gu.ate - gu.de } : { x: gu.de, y: gu.pos, width: gu.ate - gu.de, height: 0 })
        return <div key={i} className="pointer-events-none absolute bg-guia" style={gu.eixo === 'v' ? { left: a.x, top: a.y, width: 1, height: Math.max(1, a.height) } : { left: a.x, top: a.y, height: 1, width: Math.max(1, a.width) }} />
      })}

      {/* área e desenho */}
      {g?.tipo === 'area' && (() => { const r = paraTela(retDe(g.inicio, g.atual)); return <div className="pointer-events-none absolute border border-acento bg-acento/10" style={{ left: r.x, top: r.y, width: r.width, height: r.height }} /> })()}
      {g?.tipo === 'desenhar' && (() => { const r = paraTela(retDe(g.inicio, g.atual)); return <div className="pointer-events-none absolute border-[1.5px] border-acento bg-acento/10" style={{ left: r.x, top: r.y, width: r.width, height: r.height, borderRadius: estado.ferramenta === 'hotspot' ? 6 : 0, borderStyle: estado.ferramenta === 'hotspot' ? 'dashed' : 'solid' }} /> })()}

      {/* edição de texto no lugar */}
      {textoEmEdicao && (() => {
        const r = paraTela(textoEmEdicao)
        return (
          <textarea
            autoFocus
            aria-label="Editar texto"
            defaultValue={textoEmEdicao.text}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => { if (e.target.value !== textoEmEdicao.text) acoes.atualizarCamadas([textoEmEdicao.id], { text: e.target.value } as Partial<Camada>); setEditandoTexto(null) }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur() }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute z-20 resize-none overflow-hidden bg-transparent outline-none ring-[1.5px] ring-acento"
            style={{ left: r.x, top: r.y, width: r.width, height: r.height, fontFamily: pilhaFonte(textoEmEdicao.fontFamily), fontSize: textoEmEdicao.fontSize * vp.s, fontWeight: textoEmEdicao.fontWeight, fontStyle: textoEmEdicao.italic ? 'italic' : undefined, color: textoEmEdicao.color, textAlign: textoEmEdicao.align === 'justify' ? 'justify' : textoEmEdicao.align, lineHeight: textoEmEdicao.lineHeight, letterSpacing: textoEmEdicao.letterSpacing * vp.s, padding: textoEmEdicao.padding * vp.s, textTransform: textoEmEdicao.transform === 'none' ? undefined : textoEmEdicao.transform, background: textoEmEdicao.background, borderRadius: textoEmEdicao.radius * vp.s, transform: textoEmEdicao.rotation ? `rotate(${textoEmEdicao.rotation}deg)` : undefined }}
          />
        )
      })()}

      {arrastandoArquivo && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <span className="rounded-full bg-acento px-4 py-2 text-sm font-medium text-white shadow-suave">Solte para importar: imagens, SVG, vídeo, GLB do Blender, Lottie</span>
        </div>
      )}
    </div>
  )
}

function Contorno({ r, rot, cor, largura = 1, tracejado }: { r: Retangulo; rot: number; cor: string; largura?: number; tracejado?: boolean }) {
  return <div className="pointer-events-none absolute" style={{ left: r.x, top: r.y, width: r.width, height: r.height, outline: `${largura}px ${tracejado ? 'dashed' : 'solid'} ${cor}`, transform: rot ? `rotate(${rot}deg)` : undefined }} />
}

/** Cartão "Clique → 05 Aplicações · Morph · 600ms" ligado à camada selecionada (aba Interações). */
function FluxoInteracao({ camada, editor, assets, r }: { camada: Camada; editor: Editor; assets: AssetsResolvidos; r: Retangulo }) {
  const it = camada.interactions.find((i) => i.do.action === 'goToScene')
  if (!it || it.do.action !== 'goToScene') return null
  const alvoId = it.do.targetSceneId
  const idx = editor.estado.documento.scenes.findIndex((s) => s.id === alvoId)
  const alvo = editor.estado.documento.scenes[idx]
  if (!alvo) return null
  const gatilho = { click: 'Clique', hover: 'Hover', sceneEnter: 'Automático', scrollThreshold: 'Scroll' }[it.trigger]
  const tr = it.transition ?? alvo.transition
  const curva = { easeOut: 'Ease out', easeInOut: 'In-out', spring: 'Spring', linear: 'Linear', ease: 'Ease', easeIn: 'Ease in' }[tr?.easing ?? 'easeInOut']
  const topo = r.y + r.height + 6
  return (
    <>
      <div className="pointer-events-none absolute w-px bg-acento" style={{ left: r.x + Math.min(84, r.width / 2), top: topo, height: 64 }} />
      <div className="pointer-events-none absolute flex items-center gap-3 rounded-[10px] border-[1.5px] border-acento bg-white p-2 pr-3 shadow-[0_12px_30px_-12px_rgba(89,101,242,.45)]" style={{ left: r.x + 16, top: topo + 64 }}>
        <MiniaturaCena cena={alvo} assets={assets} largura={78} className="border-0" />
        <div className="whitespace-nowrap">
          <div className="text-[13px] font-medium text-acento">{gatilho} → {String(idx + 1).padStart(2, '0')} {alvo.title}</div>
          <div className="text-[11px] text-texto2">{tr ? `${{ none: 'Instantânea', fade: 'Fade', slide: 'Slide', scale: 'Scale', morph: 'Morph' }[tr.type]} · ${tr.duration}ms · ${curva}` : 'Fade · 400ms'}</div>
        </div>
      </div>
    </>
  )
}

function retDe(a: { x: number; y: number }, b: { x: number; y: number }): Retangulo {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}
function quadrado(a: { x: number; y: number }, b: { x: number; y: number }) {
  const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  return { x: a.x + Math.sign(b.x - a.x || 1) * d, y: a.y + Math.sign(b.y - a.y || 1) * d }
}
