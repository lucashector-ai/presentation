'use client'
/**
 * Mapa do modo Explorar: as telas espalhadas como na apresentação, para arrastar e organizar. Na apresentação a
 * câmera voa de uma tela para a próxima seguindo a ordem (as setas): tela à direita = o movimento vai para a
 * direita, abaixo = desce. Arrastar encaixa numa grade de 40 px (Alt solta); cada arraste é um passo de desfazer.
 * Atalhos de organização: linha, coluna, grade e zigue-zague. Clique duplo numa tela abre ela no editor.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowRight, Grid2x2, Spline, X } from 'lucide-react'
import type { Cena } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { posicoesNoMapa } from '@/components/viewer/ExplorarView'
import { Botao, cx } from '@/components/ui'
import { MiniaturaCena } from './MiniaturaCena'
import { arranjar, type Arranjo } from '@/lib/editor/mapaExplorar'

const GRADE = 40
type Ponto = { x: number; y: number }

const ARRANJOS: { id: Arranjo; rotulo: string; icone: ReactNode }[] = [
  { id: 'linha', rotulo: 'Linha', icone: <ArrowRight className="h-3.5 w-3.5" /> },
  { id: 'coluna', rotulo: 'Coluna', icone: <ArrowDown className="h-3.5 w-3.5" /> },
  { id: 'grade', rotulo: 'Grade', icone: <Grid2x2 className="h-3.5 w-3.5" /> },
  { id: 'zigue', rotulo: 'Zigue-zague', icone: <Spline className="h-3.5 w-3.5" /> },
]


export function MapaExplorar({ editor, assets, aoFechar }: { editor: Editor; assets: AssetsResolvidos; aoFechar: () => void }) {
  const cenas = editor.estado.documento.scenes
  const salvas = useMemo(() => posicoesNoMapa(cenas), [cenas])
  const [arrasto, setArrasto] = useState<{ i: number; inicio: Ponto; base: Ponto; atual: Ponto } | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const [caixa, setCaixa] = useState({ w: 1000, h: 600 })
  useEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setCaixa({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  const pos = salvas.map((p, i) => (arrasto?.i === i ? arrasto.atual : p))
  // enquadramento: escala que cabe tudo (calculada sem o arraste, para o mapa não "fugir" durante o gesto)
  const limites = useMemo(() => {
    const xs = salvas.flatMap((p, i) => [p.x, p.x + cenas[i]!.size.width])
    const ys = salvas.flatMap((p, i) => [p.y, p.y + cenas[i]!.size.height])
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }, [salvas, cenas])
  const margem = 64
  const escala = Math.min((caixa.w - margem * 2) / Math.max(1, limites.w), (caixa.h - margem * 2) / Math.max(1, limites.h), 0.25)
  const ox = (caixa.w - limites.w * escala) / 2 - limites.x * escala
  const oy = (caixa.h - limites.h * escala) / 2 - limites.y * escala
  const tela = (p: Ponto) => ({ x: ox + p.x * escala, y: oy + p.y * escala })

  const gravar = (novas: Ponto[]) => editor.acoes.transformarDocumento((d) => ({ ...d, scenes: d.scenes.map((s, i) => ({ ...s, map: { x: Math.round(novas[i]!.x), y: Math.round(novas[i]!.y) } })) }))
  const soltar = () => {
    if (!arrasto) return
    const { i, atual, base } = arrasto
    setArrasto(null)
    if (atual.x === base.x && atual.y === base.y) return
    gravar(salvas.map((p, k) => (k === i ? atual : p)))
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Mapa das telas" className="fixed inset-0 z-50 flex flex-col bg-fundo">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-borda bg-superficie px-4">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-texto">Mapa das telas</h2>
          <p className="truncate text-[11px] text-texto2">Arraste para organizar. Na apresentação a câmera segue as setas: tela à direita, o movimento vai para a direita; abaixo, desce.</p>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-superficie2 p-[3px]" role="group" aria-label="Organizar automaticamente">
          {ARRANJOS.map((a) => (
            <button key={a.id} type="button" onClick={() => gravar(arranjar(cenas, a.id))} className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-texto2 transition-colors hover:bg-superficie hover:text-texto">
              {a.icone}{a.rotulo}
            </button>
          ))}
        </div>
        <Botao tamanho="xs" variante="acento" onClick={aoFechar}>Concluir</Botao>
        <button type="button" aria-label="Fechar mapa" onClick={aoFechar} className="flex h-8 w-8 items-center justify-center rounded-md text-texto2 hover:bg-hover hover:text-texto"><X className="h-4 w-4" /></button>
      </div>
      <div
        ref={area}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(rgb(var(--cor-borda-forte)) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onPointerMove={(e) => {
          if (!arrasto) return
          const dx = (e.clientX - arrasto.inicio.x) / escala
          const dy = (e.clientY - arrasto.inicio.y) / escala
          const encaixar = (v: number) => (e.altKey ? v : Math.round(v / GRADE) * GRADE)
          setArrasto({ ...arrasto, atual: { x: encaixar(arrasto.base.x + dx), y: encaixar(arrasto.base.y + dy) } })
        }}
        onPointerUp={soltar}
        onPointerCancel={() => setArrasto(null)}
      >
        {/* caminho da apresentação: centro de uma tela até a próxima, com seta */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <marker id="mapa-seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="rgb(var(--cor-acento))" /></marker>
          </defs>
          {cenas.slice(1).map((c, k) => {
            const a = cenas[k]!
            const pa = tela({ x: pos[k]!.x + a.size.width / 2, y: pos[k]!.y + a.size.height / 2 })
            const pb = tela({ x: pos[k + 1]!.x + c.size.width / 2, y: pos[k + 1]!.y + c.size.height / 2 })
            // para a seta não sumir embaixo da miniatura: termina na borda da tela de destino
            const dx = pb.x - pa.x, dy = pb.y - pa.y
            const t = Math.max(0, 1 - Math.min(Math.abs((c.size.width * escala) / 2 / (dx || 1e-6)), Math.abs((c.size.height * escala) / 2 / (dy || 1e-6))) - 0.02)
            return <line key={c.id} x1={pa.x} y1={pa.y} x2={pa.x + dx * t} y2={pa.y + dy * t} stroke="rgb(var(--cor-acento))" strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#mapa-seta)" />
          })}
        </svg>
        {cenas.map((c, i) => {
          const p = tela(pos[i]!)
          const largura = Math.max(48, c.size.width * escala)
          const atual = c.id === editor.cena?.id
          return (
            <div
              key={c.id}
              data-testid={`mapa-tela-${i + 1}`}
              className={cx('group absolute select-none', arrasto?.i === i ? 'z-10 cursor-grabbing' : 'cursor-grab')}
              style={{ left: p.x, top: p.y, width: largura }}
              onPointerDown={(e) => { if (e.button !== 0) return; (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); setArrasto({ i, inicio: { x: e.clientX, y: e.clientY }, base: salvas[i]!, atual: salvas[i]! }) }}
              onDoubleClick={() => { editor.acoes.irParaCena(c.id); aoFechar() }}
              title="Arraste para mover · clique duplo para editar"
            >
              <div className={cx('overflow-hidden rounded-md bg-superficie shadow-[0_1px_2px_rgba(0,0,0,.08),0_8px_24px_-12px_rgba(0,0,0,.25)] ring-1 transition-shadow', atual ? 'ring-2 ring-acento' : 'ring-borda group-hover:ring-bordaForte', arrasto?.i === i && 'shadow-[0_16px_40px_-12px_rgba(0,0,0,.35)]')}>
                <MiniaturaCena cena={c} assets={assets} largura={largura} className="border-0" />
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-acento px-1 text-[10px] font-semibold tabular-nums text-acentoTexto">{i + 1}</span>
                <span className="truncate text-texto2">{c.title || 'Sem título'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
