'use client'
/**
 * Canvas do editor: camadas DOM posicionadas + Pointer Events (sem canvas raster).
 * Seleção (clique, Shift+clique), mover, redimensionar por 8 alças (Shift = proporcional),
 * grade, snap, zoom e preservação de coordenadas de referência.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Camada, DocumentoProjeto } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { calcularEncaixe, camadaNoPonto, envolvente, paraCena, redimensionar, snap, type Alca, type Retangulo } from '@/lib/scene/transform'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { useTamanho } from '@/components/renderer/useTamanho'

const PASSO_GRADE = 8
const ALCAS: Alca[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CURSORES: Record<Alca, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }

type Gesto =
  | { tipo: 'mover'; origem: { x: number; y: number }; iniciais: Record<string, Retangulo>; moveu: boolean; antes: DocumentoProjeto }
  | { tipo: 'redimensionar'; alca: Alca; origem: { x: number; y: number }; inicial: Retangulo; id: string; antes: DocumentoProjeto }

export function Canvas({ editor, assets }: { editor: Editor; assets: AssetsResolvidos }) {
  const { estado, cena, acoes } = editor
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const [gesto, setGesto] = useState<Gesto | null>(null)
  const [editandoTexto, setEditandoTexto] = useState<string | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  const encaixe = useMemo(() => {
    if (!cena || !tamanho.width) return null
    const base = calcularEncaixe(cena.size, tamanho, 48)
    if (!estado.zoom) return base
    const scale = estado.zoom
    const width = cena.size.width * scale
    const height = cena.size.height * scale
    return { scale, width, height, offsetX: Math.max(48, (tamanho.width - width) / 2), offsetY: Math.max(48, (tamanho.height - height) / 2) }
  }, [cena, tamanho, estado.zoom])

  const pontoCena = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = areaRef.current?.getBoundingClientRect()
      if (!rect || !encaixe) return { x: 0, y: 0 }
      return paraCena({ x: e.clientX - rect.left, y: e.clientY - rect.top }, encaixe)
    },
    [encaixe]
  )

  if (!cena) return null
  const selecionadas = cena.layers.filter((l) => estado.selecao.includes(l.id))
  const aplicarSnap = (v: number) => snap(v, PASSO_GRADE, estado.snap)

  // ---------- ponteiro ----------
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || editandoTexto) return
    const alvoEl = e.target as HTMLElement
    const alca = alvoEl.dataset.alca as Alca | undefined
    if (alca && selecionadas[0]) {
      const l = selecionadas[0]
      setGesto({ tipo: 'redimensionar', alca, origem: pontoCena(e), inicial: { x: l.x, y: l.y, width: l.width, height: l.height }, id: l.id, antes: acoes.documentoAtual() })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    const p = pontoCena(e)
    const camada = camadaNoPonto(cena, p)
    if (!camada) {
      if (!e.shiftKey) acoes.selecionar([])
      return
    }
    let ids = estado.selecao
    if (e.shiftKey) ids = ids.includes(camada.id) ? ids.filter((i) => i !== camada.id) : [...ids, camada.id]
    else if (!ids.includes(camada.id)) ids = [camada.id]
    acoes.selecionar(ids)
    const moviveis = cena.layers.filter((l) => ids.includes(l.id) && !l.locked)
    if (moviveis.length) {
      setGesto({ tipo: 'mover', origem: p, iniciais: Object.fromEntries(moviveis.map((l) => [l.id, { x: l.x, y: l.y, width: l.width, height: l.height }])), moveu: false, antes: acoes.documentoAtual() })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!gesto) return
    const p = pontoCena(e)
    const dx = p.x - gesto.origem.x
    const dy = p.y - gesto.origem.y
    if (gesto.tipo === 'mover') {
      if (!gesto.moveu && Math.hypot(dx, dy) < 2 / (encaixe?.scale ?? 1)) return
      if (!gesto.moveu) setGesto({ ...gesto, moveu: true })
      acoes.atualizarCamadas(Object.keys(gesto.iniciais), (l) => {
        const i = gesto.iniciais[l.id]!
        return { ...l, x: aplicarSnap(i.x + dx), y: aplicarSnap(i.y + dy) }
      }, false)
    } else {
      const r = redimensionar(gesto.inicial, gesto.alca, dx, dy, e.shiftKey)
      acoes.atualizarCamadas([gesto.id], (l) => ({ ...l, x: aplicarSnap(r.x), y: aplicarSnap(r.y), width: Math.max(8, aplicarSnap(r.width)), height: Math.max(8, aplicarSnap(r.height)) }), false)
    }
  }

  const onPointerUp = () => {
    if (gesto && (gesto.tipo === 'redimensionar' || gesto.moveu)) acoes.registrarHistorico(gesto.antes)
    setGesto(null)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const camada = camadaNoPonto(cena, pontoCena(e))
    if (camada?.type === 'text' && !camada.locked) setEditandoTexto(camada.id)
  }

  const caixa = selecionadas.length ? envolvente(selecionadas) : null
  const unica = selecionadas.length === 1 ? selecionadas[0] : null
  const esc = encaixe?.scale ?? 1
  const textoEmEdicao = editandoTexto ? (cena.layers.find((l) => l.id === editandoTexto) as Extract<Camada, { type: 'text' }> | undefined) : undefined

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden bg-fundo" style={{ touchAction: 'none' }}>
      {encaixe && (
        <div
          ref={areaRef}
          data-testid="canvas"
          className={`absolute shadow-suave ${estado.grade ? 'grade-editor' : ''}`}
          style={{ left: encaixe.offsetX, top: encaixe.offsetY, width: encaixe.width, height: encaixe.height, backgroundSize: `${PASSO_GRADE * esc * 4}px ${PASSO_GRADE * esc * 4}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <SceneRenderer cena={cena} assets={assets} escala={esc} modo="editor" style={{ outline: '1px solid rgb(var(--cor-borda))' }}>
            {/* área segura (mobile) para Story */}
            {estado.documento.mode === 'story' && <div aria-hidden style={{ position: 'absolute', left: cena.size.width * 0.06, right: cena.size.width * 0.06, top: cena.size.height * 0.08, bottom: cena.size.height * 0.1, border: '1px dashed rgba(127,147,166,.6)', pointerEvents: 'none' }} />}
            {/* seleção */}
            {selecionadas.map((l) => (
              <div key={l.id} aria-hidden style={{ position: 'absolute', left: l.x, top: l.y, width: l.width, height: l.height, transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined, outline: `${2 / esc}px solid rgb(var(--cor-acao))`, outlineOffset: -1 / esc, pointerEvents: 'none', zIndex: 9999 }} />
            ))}
            {unica && !unica.locked && (
              ALCAS.map((a) => {
                const cx = a.includes('w') ? unica.x : a.includes('e') ? unica.x + unica.width : unica.x + unica.width / 2
                const cy = a.includes('n') ? unica.y : a.includes('s') ? unica.y + unica.height : unica.y + unica.height / 2
                const t = 10 / esc
                return <div key={a} data-alca={a} role="presentation" style={{ position: 'absolute', left: cx - t / 2, top: cy - t / 2, width: t, height: t, background: 'white', border: `${1.5 / esc}px solid rgb(var(--cor-acao))`, borderRadius: 2 / esc, cursor: CURSORES[a], zIndex: 10000 }} />
              })
            )}
            {caixa && selecionadas.length > 1 && <div aria-hidden style={{ position: 'absolute', left: caixa.x, top: caixa.y, width: caixa.width, height: caixa.height, outline: `${1 / esc}px dashed rgb(var(--cor-acao))`, pointerEvents: 'none', zIndex: 9998 }} />}
            {/* edição de texto inline */}
            {textoEmEdicao && (
              <textarea
                autoFocus
                aria-label="Editar texto"
                defaultValue={textoEmEdicao.text}
                onBlur={(e) => { acoes.atualizarCamadas([textoEmEdicao.id], { text: e.target.value } as Partial<Camada>); setEditandoTexto(null) }}
                onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur() }}
                style={{ position: 'absolute', left: textoEmEdicao.x, top: textoEmEdicao.y, width: textoEmEdicao.width, height: textoEmEdicao.height, fontFamily: textoEmEdicao.fontFamily, fontSize: textoEmEdicao.fontSize, fontWeight: textoEmEdicao.fontWeight, color: textoEmEdicao.color, textAlign: textoEmEdicao.align, lineHeight: textoEmEdicao.lineHeight, letterSpacing: textoEmEdicao.letterSpacing, background: 'rgba(255,255,255,.08)', border: `${2 / esc}px solid rgb(var(--cor-acao))`, outline: 'none', resize: 'none', padding: 0, margin: 0, zIndex: 10001 }}
              />
            )}
          </SceneRenderer>
        </div>
      )}
      {/* barra flutuante de zoom */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-superficie px-2 py-1 text-xs shadow-suave">
        <button className="rounded px-2 py-1 hover:bg-superficie2" onClick={() => acoes.setZoom(Math.max(0.1, (estado.zoom || esc) - 0.1))} aria-label="Diminuir zoom">−</button>
        <button className="min-w-[4rem] rounded px-2 py-1 tabular-nums hover:bg-superficie2" onClick={() => acoes.setZoom(0)} title="Ajustar à tela">{Math.round(esc * 100)}%</button>
        <button className="rounded px-2 py-1 hover:bg-superficie2" onClick={() => acoes.setZoom(Math.min(4, (estado.zoom || esc) + 0.1))} aria-label="Aumentar zoom">+</button>
      </div>
    </div>
  )
}
