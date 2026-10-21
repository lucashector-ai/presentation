'use client'
/** Campos básicos do inspetor (sem dependência de controles.tsx, para o seletor de cor poder usá-los). */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/components/ui'
import { avaliar } from '@/lib/editor/expressao'
import { useInspetor } from './contexto'

/** Valor de seleção múltipla com valores diferentes. */
export const MISTO = 'misto' as const
export type Misto = typeof MISTO

/** Botão de ícone 24 px das seções e linhas. `ativo` = alternador ligado. */
export function BotaoMini({ rotulo, ativo, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rest.title ?? rotulo}
      aria-pressed={ativo}
      className={cx('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] transition-colors disabled:cursor-not-allowed disabled:opacity-35', ativo ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover hover:text-texto disabled:hover:bg-transparent', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Botão de ícone 32 px alinhado aos campos (rotacionar 90°, espelhar, travar proporção…). */
export function BotaoCampo({ rotulo, ativo, children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string; ativo?: boolean }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rest.title ?? rotulo}
      aria-pressed={ativo}
      className={cx('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35', ativo ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover hover:text-texto disabled:hover:bg-transparent', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * Campo numérico (como os do Figma):
 * - arrastar o prefixo (letra/ícone) na horizontal muda o valor (Shift = ×10), em um único passo de desfazer;
 * - ↑/↓ somam o passo (Shift = ×10);
 * - aceita expressões: "100/2", "40+8*2";
 * - Enter/Tab confirmam, Esc desfaz a digitação;
 * - seleção múltipla com valores diferentes mostra "Misto" (↑/↓ e arraste somam em cada um, via `aoDelta`).
 */
export function CampoNum({ prefixo, valor: valorBruto, aoMudar, aoDelta, min, max, passo = 1, sufixo, rotulo, casas = 0, titulo, className, desativado, compacto, vazio, base = 0, aoLimpar }: {
  prefixo?: ReactNode
  /** `null` = valor automático (campo vazio com o texto de `vazio`, ex.: "Auto"). */
  valor: number | Misto | null
  aoMudar: (v: number) => void
  aoDelta?: (d: number) => void
  min?: number
  max?: number
  passo?: number
  sufixo?: string
  rotulo: string
  casas?: number
  titulo?: string
  className?: string
  desativado?: boolean
  /** 28 px (dentro do seletor de cor). */
  compacto?: boolean
  /** Texto do campo vazio quando `valor` é null (ex.: "Auto"). */
  vazio?: string
  /** Ponto de partida de ↑/↓ e do arraste quando o valor é automático. */
  base?: number
  /** Apagar o número volta ao automático. */
  aoLimpar?: () => void
}) {
  const { gesto } = useInspetor()
  const auto = valorBruto === null
  const valor: number | Misto = auto ? MISTO : valorBruto
  const misto = valor === MISTO
  const [texto, setTexto] = useState(misto ? '' : fmt(valor, casas))
  const focado = useRef(false)
  const cancelar = useRef(false)
  useEffect(() => { if (!focado.current) setTexto(valor === MISTO ? '' : fmt(valor, casas)) }, [valor, casas])
  const limitar = (v: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v))
  const somar = (d: number) => {
    if (auto) { const v = limitar(Math.round((base + d) * 1000) / 1000); aoMudar(v); setTexto(fmt(v, casas)); return }
    if (valor === MISTO) { aoDelta?.(d); return }
    const v = limitar(Math.round((valor + d) * 1000) / 1000)
    aoMudar(v)
    setTexto(fmt(v, casas))
  }
  const confirmar = () => {
    if (cancelar.current) { cancelar.current = false; setTexto(valor === MISTO ? '' : fmt(valor, casas)); return }
    if (texto.trim() === '' && aoLimpar && !auto) { aoLimpar(); return }
    if (misto && texto.trim() === '') return
    const v = avaliar(texto)
    if (v === null) setTexto(valor === MISTO ? '' : fmt(valor, casas))
    else { const l = limitar(v); if (l !== valor) aoMudar(l); setTexto(fmt(l, casas)) }
  }
  const arrastar = (e: React.PointerEvent) => {
    if (desativado || e.button !== 0) return
    e.preventDefault()
    const x0 = e.clientX
    const v0 = auto ? base : valor === MISTO ? 0 : valor
    let aplicado = 0
    gesto?.iniciar()
    document.body.style.cursor = 'ew-resize'
    const mover = (ev: PointerEvent) => {
      const passos = Math.round((ev.clientX - x0) / 2) * (ev.shiftKey ? 10 : 1)
      const d = passos * passo
      if (valor === MISTO && !auto) { if (d !== aplicado) { aoDelta?.(d - aplicado); aplicado = d } return }
      const v = limitar(Math.round((v0 + d) / passo) * passo)
      if (v !== aplicado + v0) { aplicado = v - v0; aoMudar(Math.round(v * 1000) / 1000) }
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      document.body.style.cursor = ''
      gesto?.terminar()
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  return (
    <div title={titulo ?? rotulo} className={cx('flex min-w-0 flex-1 items-center rounded-md bg-superficie2 ring-inset', compacto ? 'h-6' : 'h-7', ' transition-shadow hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento', !prefixo && 'pl-2', desativado && 'opacity-50', className)}>
      {prefixo !== undefined && (
        <span onPointerDown={arrastar} className={cx('flex h-full w-7 shrink-0 select-none items-center justify-center text-[11px] text-texto3', !desativado && 'cursor-ew-resize hover:text-texto2')} aria-hidden>
          {prefixo}
        </span>
      )}
      <input
        aria-label={rotulo}
        value={texto}
        disabled={desativado}
        placeholder={auto ? vazio ?? 'Auto' : misto ? 'Misto' : undefined}
        inputMode="decimal"
        spellCheck={false}
        onFocus={(e) => { focado.current = true; e.currentTarget.select() }}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => { focado.current = false; confirmar() }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
          else if (e.key === 'Escape') { e.stopPropagation(); cancelar.current = true; (e.target as HTMLInputElement).blur() }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            somar((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * passo)
          }
        }}
        className="h-full w-full min-w-0 bg-transparent pr-1 text-[12px] tabular-nums text-texto outline-none placeholder:text-texto2 disabled:cursor-not-allowed"
      />
      {sufixo && <span className="pr-2 text-[11px] text-texto3">{sufixo}</span>}
    </div>
  )
}

function fmt(v: number, casas: number) {
  return Number.isFinite(v) ? String(Math.round(v * 10 ** casas) / 10 ** casas) : '0'
}

