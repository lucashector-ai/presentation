'use client'
/**
 * Linha do tempo da tela: uma linha por camada com a entrada como barra (atraso → atraso + duração).
 * Arraste a barra para mudar o atraso, as bordas para mudar a duração; clique numa trilha vazia para
 * adicionar um fade naquele instante. O cursor acompanha a prévia tocando no canvas.
 */
import { useMemo, useRef, useState } from 'react'
import type { Animacao, Camada } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { linhaDoTempo, nomeAnimacao, nomeLoop, type LinhaTempo } from '@/lib/scene/animacoes'
import { pedirPrevia, usePreviaAnimacao } from '@/components/renderer/animacao'
import { cx } from '@/components/ui'

type Modo = 'mover' | 'inicio' | 'fim'
const GATILHOS = { after: 'depois de outra camada', click: 'toca ao clicar', hover: 'toca ao passar o mouse', scroll: 'acompanha a rolagem' } as const
const PASSO = 50
const snap = (v: number) => Math.round(v / PASSO) * PASSO
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * Cursor da prévia: uma animação CSS (transform, na GPU) em vez de um estado React por quadro — antes a linha do
 * tempo inteira re-renderizava e o cursor mudava `left` (layout + pintura) a cada quadro. Componente próprio: só
 * ele acompanha a prévia (as linhas não re-renderizam no começo e no fim dela).
 */
function CursorPrevia({ total }: { total: number }) {
  const previa = usePreviaAnimacao(true)
  const tocando = !!previa && !previa.semAtraso && !previa.saida
  const decorrido = tocando ? Math.max(0, performance.now() - previa.inicio) : 0
  if (!tocando || decorrido > total) return null
  return (
    <div aria-hidden className="pointer-events-none absolute bottom-0 top-0" style={{ left: 76, right: 0, overflow: 'clip', overflowClipMargin: 4 }}>
      <div key={`${previa.nonce}-${total}`} className="linha-cursor absolute inset-y-0 left-0 w-full" style={{ animationDuration: `${total}ms`, animationDelay: `${-Math.round(decorrido)}ms` }}>
        <div className="absolute bottom-0 left-0 top-0 w-px bg-guia">
          <span className="absolute -left-[3px] top-0 h-[7px] w-[7px] rounded-full bg-guia" />
        </div>
      </div>
    </div>
  )
}

export function LinhaDoTempo({ editor }: { editor: Editor }) {
  const { cena, acoes } = editor
  const dados = useMemo(() => (cena ? linhaDoTempo(cena) : { linhas: [], total: 2000 }), [cena])
  const [congelado, setCongelado] = useState<{ total: number; ordem: string[] } | null>(null)
  const [arrasto, setArrasto] = useState<{ id: string; delay: number; duration: number } | null>(null)
  const trilhas = useRef<HTMLDivElement>(null)

  if (!cena) return null
  const total = congelado?.total ?? dados.total
  const linhas = congelado ? congelado.ordem.map((id) => dados.linhas.find((l) => l.id === id)).filter((l): l is LinhaTempo => !!l) : dados.linhas
  const pct = (ms: number) => `${(ms / total) * 100}%`

  const iniciar = (e: React.PointerEvent, linha: LinhaTempo, modo: Modo) => {
    e.preventDefault()
    e.stopPropagation()
    const camada = cena.layers.find((l) => l.id === linha.id)
    const a0 = camada?.enterAnimation
    const largura = trilhas.current?.getBoundingClientRect().width ?? 1
    if (!a0 || a0.type === 'none') return
    const antes = acoes.documentoAtual()
    const x0 = e.clientX
    let moveu = false
    let atual = { delay: a0.delay, duration: a0.duration }
    setCongelado({ total, ordem: linhas.map((l) => l.id) })
    setArrasto({ id: linha.id, ...atual })
    const mover = (ev: PointerEvent) => {
      const dms = ((ev.clientX - x0) / largura) * total
      if (Math.abs(ev.clientX - x0) > 2) moveu = true
      if (modo === 'mover') atual = { delay: clamp(snap(a0.delay + dms), 0, 5000), duration: a0.duration }
      else if (modo === 'fim') atual = { delay: a0.delay, duration: clamp(snap(a0.duration + dms), 100, 3000) }
      else {
        const fim = a0.delay + a0.duration
        const delay = clamp(snap(a0.delay + dms), Math.max(0, fim - 3000), fim - 100)
        atual = { delay, duration: fim - delay }
      }
      setArrasto({ id: linha.id, ...atual })
      acoes.atualizarCamadas([linha.id], (c) => ({ ...c, enterAnimation: { ...a0, ...atual } }) as Camada, false)
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      setArrasto(null)
      setCongelado(null)
      if (moveu) acoes.registrarHistorico(antes)
      // toca a camada no tempo certo (com atraso): o cursor da linha do tempo acompanha
      pedirPrevia({ ids: [linha.id], duracao: atual.delay + atual.duration + 200 })
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const adicionar = (e: React.MouseEvent, linha: LinhaTempo) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const delay = clamp(snap(((e.clientX - r.left) / r.width) * total), 0, 5000)
    const nova: Animacao = { type: 'fadeIn', duration: 600, delay, easing: 'easeOut' }
    acoes.atualizarCamadas([linha.id], (c) => ({ ...c, enterAnimation: nova }) as Camada)
    pedirPrevia({ ids: [linha.id], duracao: delay + 800 })
  }

  const marcas: number[] = []
  for (let t = 0; t <= total; t += 500) marcas.push(t)

  return (
    <div className="select-none" data-testid="linha-do-tempo">
      <div className="mb-1 flex h-4 items-center justify-between">
        <span className="mono text-[10px] text-texto3">{arrasto ? `atraso ${arrasto.delay} ms · duração ${arrasto.duration} ms` : `${linhas.filter((l) => l.tipo !== 'none').length} de ${linhas.length} animadas`}</span>
      </div>
      <div className="relative">
        {/* régua */}
        <div className="flex">
          <div className="w-[76px] shrink-0" />
          <div className="relative h-4 flex-1">
            {marcas.map((t) => (
              <span key={t} className="absolute top-0 flex h-full flex-col items-start" style={{ left: pct(t) }}>
                {t % 1000 === 0 ? <span className="mono -translate-x-1/2 text-[9px] leading-none text-texto3" style={{ transform: t === 0 ? 'none' : t === total ? 'translateX(-100%)' : undefined }}>{t / 1000}s</span> : <span className="mt-1 h-1.5 w-px bg-bordaForte" />}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-[3px] pt-1">
          {linhas.map((l) => {
            const ativa = arrasto?.id === l.id
            const temAnim = l.tipo !== 'none'
            return (
              <div key={l.id} className={cx('group flex h-[22px] items-center', l.oculta && 'opacity-45')}>
                <button type="button" onClick={() => acoes.selecionar([l.id])} title={`Selecionar “${l.nome}”`} className="w-[76px] shrink-0 truncate pr-2 text-left text-[11px] text-texto2 hover:text-texto">
                  {l.gatilho === 'after' ? '↳ ' : l.gatilho === 'scroll' ? '↕ ' : l.gatilho ? '◎ ' : ''}{l.nome}
                </button>
                <div
                  ref={l === linhas[0] ? trilhas : undefined}
                  className={cx('relative h-full flex-1 rounded-[5px] bg-superficie2', !temAnim && 'cursor-copy hover:bg-hover')}
                  onClick={temAnim ? undefined : (e) => adicionar(e, l)}
                  title={temAnim ? undefined : 'Clique para adicionar um fade aqui'}
                >
                  {temAnim && (
                    <>
                      {l.loop && <span aria-hidden className="absolute top-1/2 h-[2px] -translate-y-1/2" style={{ left: pct(l.fim), right: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgb(var(--cor-acento) / .55) 0 4px, transparent 4px 7px)' }} />}
                      <div
                        role="slider"
                        tabIndex={0}
                        aria-label={`${l.nome}: ${nomeAnimacao(l.tipo)}, atraso ${l.inicio} ms, duração ${l.fim - l.inicio} ms${l.gatilho ? `, ${GATILHOS[l.gatilho]}` : ''}`}
                        aria-valuemin={0}
                        aria-valuemax={5000}
                        aria-valuenow={l.inicio}
                        title={`${nomeAnimacao(l.tipo)} · ${l.inicio}–${l.fim} ms${l.gatilho ? ` · ${GATILHOS[l.gatilho]}` : ''}${l.loop ? ` · loop: ${nomeLoop(l.loop)}` : ''}${l.saida ? ` · saída: ${nomeAnimacao(l.saida)}` : ''}`}
                        onPointerDown={(e) => iniciar(e, l, 'mover')}
                        onKeyDown={(e) => {
                          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                          e.preventDefault()
                          const d = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 250 : PASSO)
                          acoes.atualizarCamadas([l.id], (c) => (c.enterAnimation ? ({ ...c, enterAnimation: { ...c.enterAnimation, delay: clamp(c.enterAnimation.delay + d, 0, 5000) } } as Camada) : c))
                        }}
                        className={cx('absolute top-[3px] flex h-4 cursor-grab items-center overflow-hidden rounded-[4px] bg-acento text-acentoTexto shadow-[0_1px_2px_rgba(89,101,242,.4)] active:cursor-grabbing', ativa && 'ring-2 ring-acento/30')}
                        style={{ left: pct(l.inicio), width: `max(8px, ${pct(l.fim - l.inicio)})` }}
                      >
                        <span className="pointer-events-none truncate px-1.5 text-[9.5px] font-medium leading-none">{nomeAnimacao(l.tipo)}</span>
                        <span aria-hidden onPointerDown={(e) => iniciar(e, l, 'inicio')} className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                        <span aria-hidden onPointerDown={(e) => iniciar(e, l, 'fim')} className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                      </div>
                      {l.saida && <span aria-hidden title={`Saída: ${nomeAnimacao(l.saida)}`} className="absolute right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border border-texto3" />}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <CursorPrevia total={total} />
      </div>
      {!linhas.length && <p className="py-2 text-[11px] text-texto3">Nenhuma camada nesta tela.</p>}
    </div>
  )
}
