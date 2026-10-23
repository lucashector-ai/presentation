'use client'
/**
 * Seletor de cor da Mostra (modelo do seletor do Figma, visual da plataforma):
 * abas Personalizado/Paleta · tipo de preenchimento (sólido, gradiente linear/radial, imagem) ·
 * área saturação × brilho · matiz · alfa · conta-gotas · HEX/RGB/HSL/HSB + % · "Nesta página".
 * Gradiente: paradas numa barra (clique adiciona, arraste move, Backspace remove) e ângulo.
 * Fecha com Esc ou clique fora; abre ao lado do campo sem sair da janela.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight, Check, Minus, Pencil, Pipette, Plus, Trash2, X } from 'lucide-react'
import type { EstiloCor, Gradiente } from '@/lib/scene/schema'
import { proximoNome } from '@/lib/editor/estilosCor'
import { PALETA } from '@/lib/design-tokens'
import { cx } from '@/components/ui'
import { alfaDe, comAlfa, corNoGradiente, cssBarraGradiente, hexParaRgba, hsvParaHsl, hsvParaRgb, hslParaHsv, lerCor, mesmaCor, normalizarHex, rgbParaHsv, rgbaParaHex, type Hsv } from '@/lib/editor/cor'
import { BotaoMini, CampoNum } from './campos'
import { useInspetor } from './contexto'

export type TipoPintura = 'solido' | 'linear' | 'radial' | 'angular' | 'imagem'
export type Encaixe = 'cover' | 'contain' | 'fill'
export type Pintura =
  | { tipo: 'solido'; cor: string }
  | { tipo: 'gradiente'; gradiente: Gradiente }
  | { tipo: 'imagem'; assetId?: string; encaixe?: Encaixe }

export const tipoDaPintura = (p: Pintura): TipoPintura => (p.tipo === 'gradiente' ? p.gradiente.type : p.tipo)

/** CSS de prévia de uma pintura (amostra da linha de preenchimento). */
export function cssPintura(p: Pintura, urlImagem?: string): string {
  if (p.tipo === 'solido') return p.cor
  if (p.tipo === 'imagem') return urlImagem ? `center / cover no-repeat url("${urlImagem}")` : '#E2E1DE'
  const stops = [...p.gradiente.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos}%`).join(', ')
  return p.gradiente.type === 'radial' ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${p.gradiente.angle}deg, ${stops})`
}

/** Segunda cor padrão de um gradiente novo: o mesmo matiz, mais escuro (ou mais claro, se a cor já for escura). */
function tomVizinho(hex: string): string {
  const c = hexParaRgba(hex) ?? { r: 89, g: 101, b: 242, a: 1 }
  const h = rgbParaHsv(c)
  return rgbaParaHex({ ...hsvParaRgb({ ...h, v: h.v > 45 ? h.v - 40 : h.v + 45, s: h.v > 45 ? Math.min(100, h.s + 10) : h.s }), a: c.a })
}

export const XADREZ = 'repeating-conic-gradient(#E2E1DE 0 25%, #FFFFFF 0 50%) 0 0 / 8px 8px'

const TIPOS: { id: TipoPintura; rotulo: string; fundo: string }[] = [
  { id: 'solido', rotulo: 'Sólido', fundo: 'currentColor' },
  { id: 'linear', rotulo: 'Gradiente linear', fundo: 'linear-gradient(180deg, currentColor, transparent)' },
  { id: 'radial', rotulo: 'Gradiente radial', fundo: 'radial-gradient(circle, currentColor 15%, transparent 75%)' },
  { id: 'angular', rotulo: 'Gradiente angular', fundo: 'conic-gradient(currentColor, transparent)' },
  { id: 'imagem', rotulo: 'Imagem', fundo: '' },
]

type Modo = 'hex' | 'rgb' | 'hsl' | 'hsb'
const CHAVE_MODO = 'mostra.seletorCor.modo'
function lerModo(): Modo {
  try { const m = localStorage.getItem(CHAVE_MODO); if (m === 'hex' || m === 'rgb' || m === 'hsl' || m === 'hsb') return m } catch { /* sem storage */ }
  return 'hex'
}

export interface PropsSeletorCor {
  ancora: HTMLElement | null
  valor: Pintura
  aoMudar: (p: Pintura) => void
  aoFechar: () => void
  /** Tipos que este campo aceita (os outros aparecem desativados). */
  tipos?: TipoPintura[]
  titulo?: string
  /** Estilo de cor ligado a este campo (se houver). */
  estiloId?: string
  /** Liga o campo a um estilo do documento (sem isto, escolher um estilo só copia a cor). */
  aoEstilo?: (e: EstiloCor) => void
}

export function SeletorCor({ ancora, valor, aoMudar, aoFechar, tipos = ['solido'], titulo = 'Cor', estiloId, aoEstilo }: PropsSeletorCor) {
  const { gesto, coresDocumento, imagens, estilos } = useInspetor()
  // editar um estilo: o seletor mexe na cor do estilo (todas as camadas ligadas mudam juntas)
  const [editando, setEditando] = useState<string | null>(null)
  const estiloEd = editando ? estilos?.lista.find((e) => e.id === editando) : undefined
  const [salvando, setSalvando] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [aba, setAba] = useState<'personalizado' | 'paleta'>('personalizado')
  const [modo, setModoEstado] = useState<Modo>('hex')
  const [paradaSel, setParadaSel] = useState(0)
  const [contaGotas, setContaGotas] = useState(false)
  useEffect(() => { setModoEstado(lerModo()); setContaGotas(typeof window !== 'undefined' && 'EyeDropper' in window) }, [])
  const setModo = (m: Modo) => { setModoEstado(m); try { localStorage.setItem(CHAVE_MODO, m) } catch { /* sem storage */ } }

  const grad = !estiloEd && valor.tipo === 'gradiente' ? valor.gradiente : null
  const indiceSel = grad ? Math.min(paradaSel, grad.stops.length - 1) : 0
  const corAtiva = estiloEd ? estiloEd.color : valor.tipo === 'solido' ? valor.cor : grad ? (grad.stops[indiceSel]?.color ?? '#000000') : '#000000'

  // HSV guardado em estado para não perder o matiz quando a cor fica cinza/preta.
  const [hsv, setHsv] = useState<Hsv>(() => rgbParaHsv(hexParaRgba(corAtiva) ?? { r: 0, g: 0, b: 0 }))
  const alfa = alfaDe(corAtiva)
  useEffect(() => {
    const atual = rgbaParaHex({ ...hsvParaRgb(hsv), a: alfa })
    if (mesmaCor(atual, corAtiva)) return
    const rgb = hexParaRgba(corAtiva)
    if (!rgb) return
    const novo = rgbParaHsv(rgb)
    setHsv((h) => ({ h: novo.s === 0 || novo.v === 0 ? h.h : novo.h, s: novo.v === 0 ? h.s : novo.s, v: novo.v }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corAtiva])

  const aplicarCor = (hex: string) => {
    if (estiloEd) estilos?.atualizar(estiloEd.id, { color: hex })
    else if (valor.tipo === 'solido') aoMudar({ tipo: 'solido', cor: hex })
    else if (grad) aoMudar({ tipo: 'gradiente', gradiente: { ...grad, stops: grad.stops.map((s, i) => (i === indiceSel ? { ...s, color: hex } : s)) } })
  }
  const aplicarHsv = (n: Hsv, a = alfa) => { setHsv(n); aplicarCor(rgbaParaHex({ ...hsvParaRgb(n), a })) }
  const aplicarTexto = (hex: string) => {
    const rgb = hexParaRgba(hex)
    if (!rgb) return
    const n = rgbParaHsv(rgb)
    setHsv((h) => ({ h: n.s === 0 ? h.h : n.h, s: n.s, v: n.v }))
    aplicarCor(rgbaParaHex(rgb))
  }

  const trocarTipo = (t: TipoPintura) => {
    if (t === tipoDaPintura(valor)) return
    if (t === 'solido') aoMudar({ tipo: 'solido', cor: corAtiva })
    else if (t === 'linear' || t === 'radial') {
      if (grad) aoMudar({ tipo: 'gradiente', gradiente: { ...grad, type: t } })
      else { const base = normalizarHex(corAtiva) ?? '#5965F2'; setParadaSel(0); aoMudar({ tipo: 'gradiente', gradiente: { type: t, angle: 180, stops: [{ color: base, pos: 0 }, { color: tomVizinho(base), pos: 100 }] } }) }
    } else if (t === 'imagem') aoMudar({ tipo: 'imagem', assetId: imagens[0]?.id, encaixe: 'cover' })
  }

  // ----- posição: ao lado do campo (à esquerda do painel), sem sair da janela -----
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const posicionar = () => {
      const a = ancora?.getBoundingClientRect() ?? { left: window.innerWidth - 300, right: window.innerWidth - 300, top: 80 }
      const w = el.offsetWidth, h = el.offsetHeight
      let left = a.left - w - 12
      if (left < 8) left = Math.min(window.innerWidth - w - 8, a.right + 12)
      const top = Math.max(8, Math.min(window.innerHeight - h - 8, a.top - 48))
      setPos({ left: Math.max(8, left), top })
    }
    posicionar()
    const ro = new ResizeObserver(posicionar)
    ro.observe(el)
    window.addEventListener('resize', posicionar)
    return () => { ro.disconnect(); window.removeEventListener('resize', posicionar) }
  }, [ancora])

  // ----- foco, Esc e clique fora -----
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.focus({ preventScroll: true })
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (el?.contains(alvo) || ancora?.contains(alvo)) return
      fechar.current()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar.current() } }
    document.addEventListener('pointerdown', fora, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora, true)
      document.removeEventListener('keydown', esc)
      const ativo = document.activeElement
      if (anterior && document.contains(anterior) && (!ativo || ativo === document.body || el?.contains(ativo))) anterior.focus({ preventScroll: true })
    }
  }, [ancora])

  const pegarCor = async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
      const r = await new Ctor().open()
      const rgb = lerCor(r.sRGBHex)
      if (rgb) aplicarTexto(rgbaParaHex({ ...rgb, a: alfa }))
    } catch { /* cancelado */ }
  }

  const tipoAtual = tipoDaPintura(valor)
  const paleta = useMemo(() => {
    const vistos = new Set<string>()
    return PALETA.flatMap((p) => [{ cor: p.fundo, nome: p.nome }, { cor: p.tinta, nome: `${p.nome} (tinta)` }]).filter((x) => (vistos.has(x.cor) ? false : (vistos.add(x.cor), true)))
  }, [])

  const conteudo = (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Seletor de cor: ${titulo}`}
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); aoFechar() } e.stopPropagation() }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-[70] w-[248px] rounded-xl border border-borda bg-superficie text-texto shadow-painel outline-none"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      {/* abas */}
      <div className="flex h-10 items-center gap-1 border-b border-borda pl-2 pr-1.5">
        <div role="tablist" aria-label="Origem da cor" className="flex flex-1 gap-0.5">
          {(['personalizado', 'paleta'] as const).map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={cx('rounded-md px-2 py-1 text-[12px] transition-colors', aba === a ? 'bg-canvas font-medium text-texto' : 'text-texto2 hover:text-texto')}>
              {a === 'personalizado' ? 'Personalizado' : 'Paleta'}
            </button>
          ))}
        </div>
        <BotaoMini rotulo="Fechar seletor de cor" onClick={aoFechar}><X className="h-3.5 w-3.5" /></BotaoMini>
      </div>

      {aba === 'personalizado' ? (
        <div className="space-y-3 p-2.5">
          {estiloEd && (
            <div className="flex items-center gap-1.5 rounded-md bg-acentoSuave px-2 py-1.5">
              <span className="text-[11px] text-acento">Estilo</span>
              <input aria-label="Nome do estilo" defaultValue={estiloEd.name} key={estiloEd.id} maxLength={60} onBlur={(e) => e.target.value.trim() && e.target.value !== estiloEd.name && estilos?.atualizar(estiloEd.id, { name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className="h-6 min-w-0 flex-1 rounded bg-superficie px-1.5 text-[12px] outline-none focus:ring-1 focus:ring-acento" />
              <BotaoMini rotulo="Concluir edição do estilo" onClick={() => { setEditando(null); setAba('paleta') }}><Check className="h-3.5 w-3.5" /></BotaoMini>
            </div>
          )}
          {!estiloEd && tipos.length > 1 && (
            <div role="radiogroup" aria-label="Tipo de preenchimento" className="flex items-center gap-0.5">
              {TIPOS.map((t) => {
                const ok = tipos.includes(t.id)
                return (
                  <button key={t.id} type="button" role="radio" aria-checked={tipoAtual === t.id} aria-label={t.rotulo} title={ok ? t.rotulo : `${t.rotulo} — indisponível aqui`} disabled={!ok} onClick={() => trocarTipo(t.id)} className={cx('flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30', tipoAtual === t.id ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover hover:text-texto')}>
                    {t.id === 'imagem' ? <IconeImagem /> : <span className="h-3.5 w-3.5 rounded-[3px] border-[1.5px] border-current" style={{ background: t.fundo }} />}
                  </button>
                )
              })}
            </div>
          )}

          {!estiloEd && valor.tipo === 'imagem' ? (
            <EscolhaImagem valor={valor} aoMudar={aoMudar} />
          ) : (
            <>
              {grad && (
                <EditorGradiente
                  gradiente={grad}
                  selecionada={indiceSel}
                  aoSelecionar={setParadaSel}
                  aoMudar={(g) => aoMudar({ tipo: 'gradiente', gradiente: g })}
                />
              )}
              <AreaSV hsv={hsv} aoMudar={(n) => aplicarHsv(n)} aoIniciar={() => gesto?.iniciar()} aoTerminar={() => gesto?.terminar()} />
              <div className="flex items-center gap-2">
                {contaGotas && <BotaoMini rotulo="Conta-gotas" className="h-8 w-8" onClick={() => void pegarCor()}><Pipette className="h-4 w-4" /></BotaoMini>}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Faixa rotulo="Matiz" valor={hsv.h} max={360} fundo="linear-gradient(90deg,#f00 0%,#ff0 16.6%,#0f0 33.3%,#0ff 50%,#00f 66.6%,#f0f 83.3%,#f00 100%)" corPolegar={`hsl(${hsv.h} 100% 50%)`} aoMudar={(h) => aplicarHsv({ ...hsv, h })} aoIniciar={() => gesto?.iniciar()} aoTerminar={() => gesto?.terminar()} formatar={(v) => `${Math.round(v)}°`} />
                  <Faixa rotulo="Opacidade da cor" valor={Math.round(alfa * 100)} max={100} xadrez fundo={`linear-gradient(90deg, ${comAlfa(rgbaParaHex({ ...hsvParaRgb(hsv), a: 1 }), 0)}, ${rgbaParaHex({ ...hsvParaRgb(hsv), a: 1 })})`} corPolegar={corAtiva} aoMudar={(a) => aplicarHsv(hsv, a / 100)} aoIniciar={() => gesto?.iniciar()} aoTerminar={() => gesto?.terminar()} formatar={(v) => `${v}%`} />
                </div>
              </div>
              <CamposModo modo={modo} setModo={setModo} hsv={hsv} alfa={alfa} cor={corAtiva} aoHsv={(n, a) => aplicarHsv(n, a)} aoHex={aplicarTexto} />
            </>
          )}
          {!estiloEd && valor.tipo === 'solido' && estilos && (
            salvando !== null ? (
              <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const novo = estilos.criar(salvando, corAtiva); aoEstilo?.(novo); setSalvando(null) }}>
                <input aria-label="Nome do novo estilo" autoFocus value={salvando} maxLength={60} onChange={(e) => setSalvando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSalvando(null) } }} className="h-7 min-w-0 flex-1 rounded-md bg-superficie2 px-2 text-[12px] outline-none focus:ring-1 focus:ring-acento" />
                <button type="submit" className="h-7 rounded-md bg-acento px-2.5 text-[12px] font-medium text-acentoTexto hover:opacity-90">Salvar</button>
              </form>
            ) : (
              <button type="button" onClick={() => setSalvando(proximoNome(estilos.lista))} className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[12px] text-texto2 hover:bg-hover hover:text-texto"><Plus className="h-3.5 w-3.5" /> Salvar como estilo</button>
            )
          )}
          {!estiloEd && valor.tipo !== 'imagem' && coresDocumento.length > 0 && (
            <Amostras titulo="Nesta página" cores={coresDocumento.map((c) => ({ cor: c, nome: c }))} atual={corAtiva} aoEscolher={aplicarTexto} />
          )}
        </div>
      ) : (
        <div className="space-y-3 p-2.5">
          {estilos && (
            <ListaEstilos
              estilos={estilos.lista}
              ligado={estiloId}
              aoEscolher={(e) => { if (aoEstilo) aoEstilo(e); else if (valor.tipo === 'imagem') aoMudar({ tipo: 'solido', cor: e.color }); else aplicarTexto(e.color) }}
              aoEditar={(e) => { setEditando(e.id); setAba('personalizado') }}
              aoRemover={(e) => estilos.remover(e.id)}
              aoNovo={() => { setAba('personalizado'); setSalvando(proximoNome(estilos.lista)) }}
              podeCriar={valor.tipo === 'solido'}
            />
          )}
          <Amostras titulo="Paleta Mostra" cores={paleta} atual={corAtiva} aoEscolher={(c) => { if (valor.tipo === 'imagem') aoMudar({ tipo: 'solido', cor: c }); else aplicarTexto(c) }} grande />
          {coresDocumento.length > 0 && <Amostras titulo="Nesta página" cores={coresDocumento.map((c) => ({ cor: c, nome: c }))} atual={corAtiva} aoEscolher={(c) => { if (valor.tipo === 'imagem') aoMudar({ tipo: 'solido', cor: c }); else aplicarTexto(c) }} />}
        </div>
      )}
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(conteudo, document.body)
}

function IconeImagem() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <path d="m2.5 11.5 3.5-3.5 3 3 2-2 2.5 2.5" />
      <circle cx="10.5" cy="6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// ---------- área saturação × brilho ----------

function AreaSV({ hsv, aoMudar, aoIniciar, aoTerminar }: { hsv: Hsv; aoMudar: (h: Hsv) => void; aoIniciar: () => void; aoTerminar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const ler = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect()
    const s = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
    const v = Math.max(0, Math.min(100, 100 - ((e.clientY - r.top) / r.height) * 100))
    aoMudar({ h: hsv.h, s, v })
  }
  const rgb = hsvParaRgb(hsv)
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Saturação e brilho"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s)}
      aria-valuetext={`Saturação ${Math.round(hsv.s)}%, brilho ${Math.round(hsv.v)}%`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); aoIniciar(); ler(e) }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) ler(e) }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); aoTerminar() }}
      onKeyDown={(e) => {
        const p = e.shiftKey ? 10 : 1
        const d = { ArrowLeft: [-p, 0], ArrowRight: [p, 0], ArrowUp: [0, p], ArrowDown: [0, -p] }[e.key]
        if (!d) return
        e.preventDefault()
        aoMudar({ h: hsv.h, s: Math.max(0, Math.min(100, hsv.s + d[0]!)), v: Math.max(0, Math.min(100, hsv.v + d[1]!)) })
      }}
      className="relative h-[164px] w-full cursor-crosshair touch-none rounded-lg outline-none ring-acento ring-offset-2 focus-visible:ring-2"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]" />
      <span
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.25),0_1px_3px_rgba(0,0,0,.3)]"
        style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: `rgb(${rgb.r} ${rgb.g} ${rgb.b})` }}
      />
    </div>
  )
}

// ---------- faixas de matiz e alfa ----------

function Faixa({ rotulo, valor, max, fundo, corPolegar, xadrez, aoMudar, aoIniciar, aoTerminar, formatar }: { rotulo: string; valor: number; max: number; fundo: string; corPolegar: string; xadrez?: boolean; aoMudar: (v: number) => void; aoIniciar: () => void; aoTerminar: () => void; formatar: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null)
  const ler = (x: number) => {
    const r = ref.current!.getBoundingClientRect()
    aoMudar(Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * max))
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(valor)}
      aria-valuetext={formatar(valor)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); aoIniciar(); ler(e.clientX) }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) ler(e.clientX) }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); aoTerminar() }}
      onKeyDown={(e) => {
        const p = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0)
        if (!p) return
        e.preventDefault()
        aoMudar(Math.max(0, Math.min(max, Math.round(valor) + p)))
      }}
      className="relative h-3 w-full cursor-pointer touch-none rounded-full outline-none ring-acento ring-offset-2 focus-visible:ring-2"
      style={{ background: xadrez ? `${fundo}, ${XADREZ}` : fundo }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]" />
      <span className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_0_1px_rgba(0,0,0,.25),0_1px_3px_rgba(0,0,0,.3)]" style={{ left: `${(valor / max) * 100}%`, background: xadrez ? `linear-gradient(${corPolegar}, ${corPolegar}), ${XADREZ}` : corPolegar }} />
    </div>
  )
}

// ---------- modo HEX / RGB / HSL / HSB ----------

function CamposModo({ modo, setModo, hsv, alfa, cor, aoHsv, aoHex }: { modo: Modo; setModo: (m: Modo) => void; hsv: Hsv; alfa: number; cor: string; aoHsv: (h: Hsv, a?: number) => void; aoHex: (hex: string) => void }) {
  const rgb = hsvParaRgb(hsv)
  const hsl = hsvParaHsl(hsv)
  const alfaCampo = <CampoNum compacto rotulo="Opacidade (%)" valor={Math.round(alfa * 100)} min={0} max={100} sufixo="%" className="max-w-[58px] !flex-none" aoMudar={(a) => aoHsv(hsv, a / 100)} />
  const canais: { rotulo: string; valor: number; max: number; aplicar: (v: number) => void }[] =
    modo === 'rgb'
      ? (['r', 'g', 'b'] as const).map((k) => ({ rotulo: k.toUpperCase(), valor: rgb[k], max: 255, aplicar: (v: number) => { const n = rgbParaHsv({ ...rgb, [k]: v }); aoHsv({ h: n.s === 0 ? hsv.h : n.h, s: n.s, v: n.v }) } }))
      : modo === 'hsl'
        ? [
            { rotulo: 'H', valor: Math.round(hsl.h), max: 360, aplicar: (v: number) => aoHsv(hslParaHsv({ ...hsl, h: v })) },
            { rotulo: 'S', valor: Math.round(hsl.s), max: 100, aplicar: (v: number) => aoHsv(hslParaHsv({ ...hsl, s: v })) },
            { rotulo: 'L', valor: Math.round(hsl.l), max: 100, aplicar: (v: number) => aoHsv(hslParaHsv({ ...hsl, l: v })) },
          ]
        : [
            { rotulo: 'H', valor: Math.round(hsv.h), max: 360, aplicar: (v: number) => aoHsv({ ...hsv, h: v }) },
            { rotulo: 'S', valor: Math.round(hsv.s), max: 100, aplicar: (v: number) => aoHsv({ ...hsv, s: v }) },
            { rotulo: 'B', valor: Math.round(hsv.v), max: 100, aplicar: (v: number) => aoHsv({ ...hsv, v: v }) },
          ]
  return (
    <div className="flex items-center gap-1">
      <span className="relative flex h-7 w-[58px] shrink-0 items-center rounded-md hover:bg-hover">
        <select aria-label="Modelo de cor" value={modo} onChange={(e) => setModo(e.target.value as Modo)} className="h-full w-full cursor-pointer appearance-none bg-transparent pl-1.5 text-[11px] font-medium uppercase text-texto2 outline-none focus-visible:ring-1 focus-visible:ring-acento">
          <option value="hex">Hex</option><option value="rgb">RGB</option><option value="hsl">HSL</option><option value="hsb">HSB</option>
        </select>
        <svg viewBox="0 0 8 8" className="pointer-events-none absolute right-1.5 h-2 w-2 text-texto3" aria-hidden><path d="M1 3l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.3" /></svg>
      </span>
      {modo === 'hex' ? <CampoHex cor={cor} aoHex={aoHex} /> : canais.map((c) => <CampoNum key={`${modo}-${c.rotulo}`} compacto rotulo={c.rotulo} titulo={`${c.rotulo} (0–${c.max})`} valor={c.valor} min={0} max={c.max} className="!pl-1.5" aoMudar={c.aplicar} />)}
      {alfaCampo}
    </div>
  )
}

function CampoHex({ cor, aoHex }: { cor: string; aoHex: (hex: string) => void }) {
  const exibido = (normalizarHex(cor) ?? '#000000').slice(1, 7)
  const [texto, setTexto] = useState(exibido)
  const focado = useRef(false)
  useEffect(() => { if (!focado.current) setTexto(exibido) }, [exibido])
  const confirmar = () => {
    const rgb = lerCor(texto)
    if (rgb) aoHex(rgbaParaHex({ ...rgb, a: rgb.a < 1 ? rgb.a : alfaDe(cor) }))
    else setTexto(exibido)
  }
  return (
    <div className="flex h-7 min-w-0 flex-1 items-center rounded-md bg-superficie2 pl-2 ring-inset hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento">
      <input aria-label="Hexadecimal" value={texto} spellCheck={false} maxLength={32} onFocus={(e) => { focado.current = true; e.currentTarget.select() }} onChange={(e) => setTexto(e.target.value)} onBlur={() => { focado.current = false; confirmar() }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTexto(exibido) }} className="h-full w-full min-w-0 bg-transparent text-[12px] uppercase tabular-nums outline-none" />
    </div>
  )
}

// ---------- amostras ----------

function Amostras({ titulo, cores, atual, aoEscolher, grande }: { titulo: string; cores: { cor: string; nome: string }[]; atual: string; aoEscolher: (c: string) => void; grande?: boolean }) {
  return (
    <div className="border-t border-borda pt-2.5 first:border-t-0 first:pt-0">
      <div className="mb-2 text-[11px] font-medium text-texto2">{titulo}</div>
      <div className={cx('grid', grande ? 'grid-cols-8 gap-1.5' : 'grid-cols-10 gap-1')}>
        {cores.map((c) => (
          <button key={c.cor} type="button" title={c.nome} aria-label={`${titulo}: ${c.nome}`} onClick={() => aoEscolher(c.cor)} className={cx('aspect-square rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.1)] outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-acento', mesmaCor(c.cor, atual) && 'ring-2 ring-acento ring-offset-1')} style={{ background: alfaDe(c.cor) < 1 ? `linear-gradient(${c.cor}, ${c.cor}), ${XADREZ}` : c.cor }} />
        ))}
      </div>
    </div>
  )
}

// ---------- estilos do documento ----------

function ListaEstilos({ estilos, ligado, aoEscolher, aoEditar, aoRemover, aoNovo, podeCriar }: { estilos: EstiloCor[]; ligado?: string; aoEscolher: (e: EstiloCor) => void; aoEditar: (e: EstiloCor) => void; aoRemover: (e: EstiloCor) => void; aoNovo: () => void; podeCriar: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-texto2">Estilos</span>
        {podeCriar && <BotaoMini rotulo="Criar estilo com a cor atual" onClick={aoNovo}><Plus className="h-3.5 w-3.5" /></BotaoMini>}
      </div>
      {estilos.length ? (
        <ul role="list" aria-label="Estilos de cor do documento" className="-mx-1 max-h-[180px] overflow-y-auto rolagem-fina">
          {estilos.map((e) => (
            <li key={e.id} className={cx('group flex items-center gap-1 rounded-md pr-1', ligado === e.id ? 'bg-acentoSuave' : 'hover:bg-hover')}>
              <button type="button" aria-label={`Aplicar estilo ${e.name}`} aria-pressed={ligado === e.id} onClick={() => aoEscolher(e)} className="flex h-7 min-w-0 flex-1 items-center gap-2 px-1 text-left text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-acento">
                <span className="h-4 w-4 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]" style={{ background: alfaDe(e.color) < 1 ? `linear-gradient(${e.color}, ${e.color}), ${XADREZ}` : e.color }} />
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <span className="mono text-[10px] uppercase text-texto3">{(normalizarHex(e.color) ?? e.color).slice(1, 7)}</span>
              </button>
              <BotaoMini rotulo={`Editar estilo ${e.name}`} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => aoEditar(e)}><Pencil className="h-3 w-3" /></BotaoMini>
              <BotaoMini rotulo={`Excluir estilo ${e.name}`} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => aoRemover(e)}><Trash2 className="h-3 w-3" /></BotaoMini>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] leading-snug text-texto3">Nenhum estilo ainda. Escolha uma cor e use “Salvar como estilo” para reutilizá-la em todo o documento.</p>
      )}
    </div>
  )
}

// ---------- imagem ----------

function EscolhaImagem({ valor, aoMudar }: { valor: Extract<Pintura, { tipo: 'imagem' }>; aoMudar: (p: Pintura) => void }) {
  const { imagens } = useInspetor()
  if (!imagens.length) return <p className="py-6 text-center text-[12px] text-texto2">Envie imagens na aba Arquivos para usá-las como preenchimento.</p>
  return (
    <div className="space-y-2.5">
      <div role="radiogroup" aria-label="Imagem" className="grid max-h-[220px] grid-cols-3 gap-1.5 overflow-y-auto rolagem-fina">
        {imagens.map((im) => (
          <button key={im.id} type="button" role="radio" aria-checked={valor.assetId === im.id} title={im.nome} aria-label={im.nome} onClick={() => aoMudar({ ...valor, assetId: im.id })} className={cx('aspect-square overflow-hidden rounded-md bg-superficie2 outline-none focus-visible:ring-2 focus-visible:ring-acento', valor.assetId === im.id ? 'ring-2 ring-acento ring-offset-1' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt="" className="h-full w-full object-cover" draggable={false} />
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Encaixe da imagem" className="flex h-7 rounded-md bg-superficie2 p-[2px]">
        {([['cover', 'Cobrir'], ['contain', 'Conter'], ['fill', 'Esticar']] as const).map(([id, r]) => (
          <button key={id} type="button" role="radio" aria-checked={(valor.encaixe ?? 'cover') === id} onClick={() => aoMudar({ ...valor, encaixe: id })} className={cx('flex-1 rounded-[5px] text-[12px]', (valor.encaixe ?? 'cover') === id ? 'bg-superficie text-texto shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-texto2 hover:text-texto')}>{r}</button>
        ))}
      </div>
    </div>
  )
}

// ---------- gradiente ----------

function EditorGradiente({ gradiente, selecionada, aoSelecionar, aoMudar }: { gradiente: Gradiente; selecionada: number; aoSelecionar: (i: number) => void; aoMudar: (g: Gradiente) => void }) {
  const { gesto } = useInspetor()
  const barra = useRef<HTMLDivElement>(null)
  const parada = gradiente.stops[selecionada]
  const posDe = (x: number) => {
    const r = barra.current!.getBoundingClientRect()
    return Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * 100)
  }
  const mover = (i: number, pos: number) => aoMudar({ ...gradiente, stops: gradiente.stops.map((s, j) => (j === i ? { ...s, pos: Math.max(0, Math.min(100, pos)) } : s)) })
  const remover = (i: number) => {
    if (gradiente.stops.length <= 2) return
    aoMudar({ ...gradiente, stops: gradiente.stops.filter((_, j) => j !== i) })
    aoSelecionar(Math.max(0, i - 1))
  }
  const adicionar = (pos: number) => {
    if (gradiente.stops.length >= 8) return
    const nova = { color: corNoGradiente(gradiente.stops, pos), pos }
    const indice = gradiente.stops.length
    aoMudar({ ...gradiente, stops: [...gradiente.stops, nova] })
    aoSelecionar(indice)
    // foco na parada nova: setas movem, Backspace remove
    requestAnimationFrame(() => barra.current?.querySelectorAll<HTMLElement>('[role="slider"]')[indice]?.focus())
  }
  return (
    <div className="space-y-2">
      <div className="px-[7px]">
        <div
          ref={barra}
          role="group"
          aria-label="Paradas do gradiente (clique para adicionar)"
          onPointerDown={(e) => { if (e.target === e.currentTarget) adicionar(posDe(e.clientX)) }}
          className="relative h-6 cursor-copy rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]"
          style={{ background: `${cssBarraGradiente(gradiente.stops)}, ${XADREZ}` }}
        >
          {gradiente.stops.map((s, i) => (
            <button
              key={i}
              type="button"
              role="slider"
              aria-label={`Parada ${i + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={s.pos}
              aria-valuetext={`${s.pos}% · ${s.color}`}
              title="Arraste para mover · Backspace remove"
              onPointerDown={(e) => {
                e.stopPropagation()
                aoSelecionar(i)
                const el = e.currentTarget
                el.setPointerCapture(e.pointerId)
                el.focus()
                gesto?.iniciar()
                const mv = (ev: PointerEvent) => mover(i, posDe(ev.clientX))
                const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); gesto?.terminar() }
                el.addEventListener('pointermove', mv)
                el.addEventListener('pointerup', up)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); remover(i) }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); mover(i, s.pos + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)) }
              }}
              className={cx('absolute top-1/2 h-[18px] w-[14px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-[4px] border-[2.5px] border-white outline-none', i === selecionada ? 'shadow-[0_0_0_1.5px_rgb(var(--cor-acento)),0_1px_3px_rgba(0,0,0,.3)]' : 'shadow-[0_0_0_1px_rgba(0,0,0,.3),0_1px_3px_rgba(0,0,0,.2)]')}
              style={{ left: `${s.pos}%`, background: `linear-gradient(${s.color}, ${s.color}), ${XADREZ}` }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {gradiente.type === 'linear' ? (
          <CampoNum compacto prefixo={<IconeAngulo />} rotulo="Ângulo do gradiente" valor={gradiente.angle} min={0} max={360} sufixo="°" aoMudar={(angle) => aoMudar({ ...gradiente, angle })} />
        ) : <span className="flex-1 truncate pl-1 text-[11px] text-texto3">Radial · do centro</span>}
        {parada && <CampoNum compacto rotulo="Posição da parada" titulo="Posição da parada selecionada" valor={parada.pos} min={0} max={100} sufixo="%" className="max-w-[66px]" aoMudar={(p) => mover(selecionada, p)} />}
        <BotaoMini rotulo="Inverter gradiente" className="h-7 w-7" onClick={() => aoMudar({ ...gradiente, stops: gradiente.stops.map((s) => ({ ...s, pos: 100 - s.pos })) })}><ArrowLeftRight className="h-3.5 w-3.5" /></BotaoMini>
        <BotaoMini rotulo="Remover parada" className="h-7 w-7" disabled={gradiente.stops.length <= 2} onClick={() => remover(selecionada)}><Minus className="h-3.5 w-3.5" /></BotaoMini>
      </div>
    </div>
  )
}

export function IconeAngulo() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M1.5 10.5h9M1.5 10.5 8 3" />
      <path d="M5.2 10.5a3.7 3.7 0 0 0-1.1-2.6" />
    </svg>
  )
}
