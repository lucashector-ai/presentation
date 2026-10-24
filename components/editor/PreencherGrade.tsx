'use client'
/**
 * "Preencher": encaixa a seleção numa região da tela, como organizar janelas (Rectangle / Snap do Windows).
 * Predefinições (tela inteira, metades, terços, quartos), uma grade de células para arrastar e "Dividir em grade"
 * (cópias da camada em células iguais). Abre pelo menu de contexto, pelo botão ao lado de W/H e com ⌃⌥ + tecla.
 * Passar o cursor numa opção mostra a região no canvas (evento `mostra:previa-preencher`).
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Editor } from '@/lib/editor/useEditor'
import { clonarCamadas } from '@/lib/editor/useEditor'
import { PREDEFINICOES, dividirCaixa, gradeLayoutPadrao, preencherRegiao, regiaoDaGrade, type Celulas, type Predefinicao } from '@/lib/editor/preencher'
import { comDescendentes, mapaDe, paiDe, raizesDaSelecao, temAutoLayout } from '@/lib/scene/arvore'
import { normalizarZ } from '@/lib/scene/order'
import type { Camada } from '@/lib/scene/schema'
import type { Retangulo } from '@/lib/scene/transform'
import { cx } from '@/components/ui'

export const EVENTO_ABRIR = 'mostra:preencher'
export const EVENTO_PREVIA = 'mostra:previa-preencher'

/** Abre o painel "Preencher" no ponto da tela (coordenadas da janela). */
export function abrirPreencher(x: number, y: number) {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: { x, y } }))
}
const previa = (r: Retangulo | null) => window.dispatchEvent(new CustomEvent(EVENTO_PREVIA, { detail: r }))

let margensLembradas = false
let gradeLembrada: [number, number] = [6, 4]

/** Camadas que dá para encaixar: fora de fluxo de auto layout e destravadas. */
function idsPreenchiveis(editor: Editor): string[] {
  const cena = editor.cena
  if (!cena) return []
  const mapa = mapaDe(cena.layers)
  return raizesDaSelecao(editor.estado.selecao, cena.layers).filter((id) => {
    const l = mapa.get(id)
    return !!l && !l.locked && (l.absolute || !temAutoLayout(paiDe(l, mapa)))
  })
}

export function regiaoPara(editor: Editor, celulas: Celulas, margens: boolean): Retangulo | null {
  const cena = editor.cena
  if (!cena) return null
  return regiaoDaGrade(cena.size, celulas, margens ? gradeLayoutPadrao(cena.size) : null)
}

/** Aplica a região à seleção (um passo de desfazer). Devolve false se nada pôde ser encaixado. */
export function preencherSelecao(editor: Editor, celulas: Celulas, margens = margensLembradas): boolean {
  const ids = idsPreenchiveis(editor)
  const regiao = regiaoPara(editor, celulas, margens)
  if (!ids.length || !regiao) return false
  editor.acoes.transformarCena((c) => {
    const m = preencherRegiao(c.layers, ids, regiao)
    return m.size ? { ...c, layers: c.layers.map((l) => m.get(l.id) ?? l) } : c
  })
  return true
}

/** Divide a camada em cols × lins cópias iguais com `gap` (a original vira a primeira célula). */
export function dividirSelecao(editor: Editor, cols: number, lins: number, gap: number): boolean {
  const cena = editor.cena
  const id = idsPreenchiveis(editor)[0]
  const alvo = cena?.layers.find((l) => l.id === id)
  if (!cena || !alvo || cols * lins < 2) return false
  const celulas = dividirCaixa(alvo, cols, lins, gap)
  if (celulas.length < 2) return false
  const novos: string[] = [alvo.id]
  editor.acoes.transformarCena((c) => {
    const ids = comDescendentes([alvo.id], c.layers)
    const grupo = c.layers.filter((l) => ids.includes(l.id))
    // a raiz ganha a caixa da célula; o conteúdo (frames) só acompanha o deslocamento
    const mover = (raiz: Camada, resto: Camada[], r: Retangulo): Camada[] => {
      const dx = r.x - alvo.x
      const dy = r.y - alvo.y
      return [{ ...raiz, x: r.x, y: r.y, width: r.width, height: r.height } as Camada, ...resto.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }) as Camada)]
    }
    const primeira = celulas[0]!
    let camadas = c.layers.map((l) => (l.id === alvo.id ? ({ ...l, ...primeira } as Camada) : l))
    for (const r of celulas.slice(1)) {
      const copias = clonarCamadas(grupo, camadas, 0)
      const raiz = copias[grupo.findIndex((l) => l.id === alvo.id)]!
      novos.push(raiz.id)
      camadas = [...camadas, ...mover(raiz, copias.filter((x) => x !== raiz), r)]
    }
    return { ...c, layers: normalizarZ(camadas) }
  })
  editor.acoes.selecionarExato(novos)
  return true
}

/** Miniatura da região (retângulo da tela com a parte preenchida no acento). */
function Icone({ c, ativo }: { c: Celulas; ativo?: boolean }) {
  const l = (c.c0 / c.cols) * 100, t = (c.l0 / c.lins) * 100
  const w = ((c.c1 - c.c0 + 1) / c.cols) * 100, h = ((c.l1 - c.l0 + 1) / c.lins) * 100
  return (
    <span aria-hidden className={cx('relative block h-[19px] w-[34px] rounded-[3px] border-[1.5px]', ativo ? 'border-acento' : 'border-texto2/45 group-hover:border-acento/70')}>
      <span className={cx('absolute rounded-[1.5px]', ativo ? 'bg-acento' : 'bg-texto2/75 group-hover:bg-acento')} style={{ left: `calc(${l}% + 1.5px)`, top: `calc(${t}% + 1.5px)`, width: `calc(${w}% - 3px)`, height: `calc(${h}% - 3px)` }} />
    </span>
  )
}

export function PainelPreencher({ editor, x, y, aoFechar }: { editor: Editor; x: number; y: number; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [margens, setMargens] = useState(margensLembradas)
  const [[cols, lins], setGrade] = useState<[number, number]>(gradeLembrada)
  const [arrasto, setArrasto] = useState<{ a: [number, number]; b: [number, number] } | null>(null)
  const [dividir, setDividir] = useState({ cols: 2, lins: 2, gap: 24 })
  const cena = editor.cena
  const ids = idsPreenchiveis(editor)
  const unica = ids.length === 1 ? cena?.layers.find((l) => l.id === ids[0]) : undefined
  useEffect(() => { margensLembradas = margens }, [margens])
  useEffect(() => { gradeLembrada = [cols, lins] }, [cols, lins])

  useEffect(() => {
    const fora = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) aoFechar() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); aoFechar() } }
    document.addEventListener('pointerdown', fora)
    window.addEventListener('keydown', esc, true)
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    return () => { document.removeEventListener('pointerdown', fora); window.removeEventListener('keydown', esc, true); previa(null) }
  }, [aoFechar])

  if (!cena) return null
  const aspecto = cena.size.width / cena.size.height
  const mostrar = (c: Celulas | null) => previa(c ? regiaoPara(editor, c, margens) : null)
  const aplicar = (c: Celulas) => { if (preencherSelecao(editor, c, margens)) aoFechar() }
  const celulasDoArrasto = (a: [number, number], b: [number, number]): Celulas => ({ cols, lins, c0: Math.min(a[0], b[0]), c1: Math.max(a[0], b[0]), l0: Math.min(a[1], b[1]), l1: Math.max(a[1], b[1]) })
  const grupos = ['Tela', 'Metades', 'Terços', 'Quartos'] as const
  const larg = 284
  const left = Math.max(8, Math.min(x, window.innerWidth - larg - 8))
  const top = Math.max(8, Math.min(y, window.innerHeight - 560))
  const cel = (e: React.PointerEvent): [number, number] | null => {
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-celula]')
    if (!el) return null
    const [c, l] = el.dataset.celula!.split(',').map(Number)
    return [c!, l!]
  }
  const sel = arrasto ? celulasDoArrasto(arrasto.a, arrasto.b) : null

  return (
    <div ref={ref} role="dialog" aria-label="Preencher em grade" data-testid="painel-preencher" className="fixed z-50 rounded-lg border border-borda bg-superficie p-2.5 text-[11px] shadow-painel" style={{ left, top, width: larg }} onMouseLeave={() => mostrar(null)}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium">Preencher</span>
        <button type="button" aria-label="Fechar" onClick={aoFechar} className="rounded p-1 text-texto3 hover:bg-hover hover:text-texto"><X className="h-3.5 w-3.5" /></button>
      </div>
      {!ids.length && <p className="mb-2 rounded-md bg-superficie2 px-2 py-1.5 text-texto2">Selecione uma camada fora do auto layout.</p>}
      {grupos.map((g) => (
        <div key={g} className="mb-1.5">
          <div className="rotulo-mono mb-1 !text-[10px]">{g}</div>
          <div className="flex flex-wrap gap-1">
            {PREDEFINICOES.filter((p) => p.grupo === g).map((p: Predefinicao) => (
              <button key={p.id} type="button" disabled={!ids.length} data-preencher={p.id} title={`${p.rotulo}${p.atalho ? ` (${p.atalho})` : ''}`} aria-label={p.rotulo} onMouseEnter={() => mostrar(p.celulas)} onFocus={() => mostrar(p.celulas)} onClick={() => aplicar(p.celulas)} className="group flex h-8 w-[44px] items-center justify-center rounded-md hover:bg-hover focus-visible:bg-hover disabled:opacity-40">
                <Icone c={p.celulas} />
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-2 border-t border-borda pt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="rotulo-mono !text-[10px]">Arraste nas células</span>
          <div className="flex rounded-md bg-superficie2 p-0.5" role="radiogroup" aria-label="Células">
            {([[4, 4], [6, 4], [12, 6]] as [number, number][]).map(([c, l]) => (
              <button key={`${c}x${l}`} type="button" role="radio" aria-checked={cols === c && lins === l} onClick={() => setGrade([c, l])} className={cx('mono rounded px-1.5 py-0.5 text-[10px]', cols === c && lins === l ? 'bg-superficie text-texto shadow-sm' : 'text-texto3 hover:text-texto')}>{c}×{l}</button>
            ))}
          </div>
        </div>
        <div
          data-testid="grade-celulas"
          className={cx('grid w-full touch-none select-none gap-[3px] rounded-md border border-borda p-[3px]', !ids.length && 'pointer-events-none opacity-40')}
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, aspectRatio: `${aspecto}` }}
          onPointerDown={(e) => { const c = cel(e); if (!c) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setArrasto({ a: c, b: c }); mostrar(celulasDoArrasto(c, c)) }}
          onPointerMove={(e) => {
            const c = cel(e)
            if (!c) return
            if (arrasto) { if (c[0] !== arrasto.b[0] || c[1] !== arrasto.b[1]) { setArrasto({ ...arrasto, b: c }); mostrar(celulasDoArrasto(arrasto.a, c)) } }
            else mostrar(celulasDoArrasto(c, c))
          }}
          onPointerUp={() => { if (sel) aplicar(sel); setArrasto(null) }}
          onPointerLeave={() => { if (!arrasto) mostrar(null) }}
        >
          {Array.from({ length: cols * lins }, (_, k) => {
            const c = k % cols, l = Math.floor(k / cols)
            const dentro = !!sel && c >= sel.c0 && c <= sel.c1 && l >= sel.l0 && l <= sel.l1
            return <span key={k} data-celula={`${c},${l}`} className={cx('rounded-[2px] transition-colors', dentro ? 'bg-acento' : 'bg-superficie2 hover:bg-acento/30')} />
          })}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-texto2">
          <input type="checkbox" checked={margens} onChange={(e) => setMargens(e.target.checked)} className="accent-[rgb(89_101_242)]" />
          Com margens <span className="mono text-[10px] text-texto3">({gradeLayoutPadrao(cena.size).margem} / {gradeLayoutPadrao(cena.size).gutter} px)</span>
        </label>
      </div>

      {unica && (unica.type === 'shape' || unica.type === 'frame' || unica.type === 'image') && (
        <div className="mt-2 border-t border-borda pt-2">
          <div className="rotulo-mono mb-1.5 !text-[10px]">Dividir em grade</div>
          <div className="flex items-center gap-1.5">
            {(['cols', 'lins', 'gap'] as const).map((k) => (
              <label key={k} className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md bg-superficie2 px-1.5 focus-within:ring-1 focus-within:ring-acento">
                <span className="mono text-[10px] text-texto3">{{ cols: 'C', lins: 'L', gap: '↔' }[k]}</span>
                <input aria-label={{ cols: 'Colunas', lins: 'Linhas', gap: 'Espaço entre células' }[k]} type="number" min={k === 'gap' ? 0 : 1} max={k === 'gap' ? 400 : 12} value={dividir[k]} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) setDividir((d) => ({ ...d, [k]: Math.max(k === 'gap' ? 0 : 1, Math.min(k === 'gap' ? 400 : 12, v)) })) }} className="mono w-full min-w-0 bg-transparent text-[11px] outline-none" />
              </label>
            ))}
            <button type="button" onClick={() => { if (dividirSelecao(editor, dividir.cols, dividir.lins, dividir.gap)) aoFechar() }} disabled={dividir.cols * dividir.lins < 2} className="h-7 shrink-0 rounded-md bg-acao px-2.5 text-[11px] font-medium text-acaoTexto hover:bg-acao/90 disabled:opacity-40">Dividir</button>
          </div>
        </div>
      )}
    </div>
  )
}
