'use client'
/** Peças visuais da aba Animação: chips, cartões de preset com prévia animada (keyframes reais) e área de transferência. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronRight, Play, RotateCcw, Square } from 'lucide-react'
import type { Animacao, Loop, Transicao } from '@/lib/scene/schema'
import { PRESETS_LOOP, animacaoDoPreset, ehAnimacaoDeTexto, type PresetEntrada, type TipoAnimacao, type TipoLoop } from '@/lib/scene/animacoes'
import { EASING_CSS } from '@/lib/scene/motor'
import { Desenho, TextoSegmentado, planoAnimacao } from '@/components/renderer/animacao'
import { usePreferencias } from '@/components/renderer/useTamanho'
import { cx } from '@/components/ui'

// ---------- chips ----------

export function Chips<T extends string>({ valor, opcoes, aoMudar, rotulo, cheio }: { valor: T | null; opcoes: { id: T; rotulo: string; titulo?: string }[]; aoMudar: (v: T) => void; rotulo: string; cheio?: boolean }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cx('flex flex-wrap gap-1', cheio && '[&>*]:flex-1')}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          title={o.titulo}
          onClick={() => aoMudar(o.id)}
          className={cx(
            'h-[26px] whitespace-nowrap rounded-full border px-2.5 text-[11px] transition-colors',
            valor === o.id ? 'border-acento bg-acentoSuave font-medium text-acento' : 'border-borda bg-superficie text-texto2 hover:border-bordaForte hover:text-texto'
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Rotulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex min-h-[20px] items-center justify-between pt-1">
      <span className="text-[11px] text-texto2">{children}</span>
      {acao}
    </div>
  )
}

export function BotaoPrevia({ aoClicar, tocando, rotulo = 'Prévia', aoParar }: { aoClicar: () => void; tocando?: boolean; rotulo?: string; aoParar?: () => void }) {
  return (
    <button
      type="button"
      onClick={tocando && aoParar ? aoParar : aoClicar}
      className="flex h-6 items-center gap-1 rounded-full bg-acentoSuave px-2.5 text-[11px] font-medium text-acento transition-colors hover:bg-acento hover:text-acentoTexto"
    >
      {tocando && aoParar ? <Square className="h-2.5 w-2.5 fill-current" /> : <Play className="h-2.5 w-2.5 fill-current" />}
      {tocando && aoParar ? 'Parar' : rotulo}
    </button>
  )
}

/** "Ajustes finos" recolhidos (sempre começam fechados, a não ser que já haja um valor que só se mexe lá), com resumo e "Padrão". */
export function Finos({ children, resumo, aoPadrao, aberto: abertoInicial = false, rotulo = 'Ajustes finos' }: { children: ReactNode; resumo?: string; aoPadrao?: () => void; aberto?: boolean; rotulo?: string }) {
  const [aberto, setAberto] = useState(abertoInicial)
  return (
    // sem caixa em volta: uma linha de 32 px (seta · título · resumo · Padrão) e o conteúdo com um fio à esquerda
    <div>
      <div className="flex h-8 items-center gap-1">
        <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="group flex h-full min-w-0 flex-1 items-center gap-1 text-left text-[11px] font-medium text-texto">
          <ChevronRight className={cx('h-3 w-3 shrink-0 text-texto3 transition-transform group-hover:text-texto', aberto && 'rotate-90')} aria-hidden />
          {rotulo}
          {!aberto && resumo && <span className="ml-auto min-w-0 truncate pl-2 font-normal text-texto3">{resumo}</span>}
        </button>
        {aoPadrao && (
          <button type="button" onClick={aoPadrao} title="Voltar aos valores do efeito" className="flex shrink-0 items-center gap-1 pl-2 text-[11px] text-texto2 hover:text-texto">
            <RotateCcw className="h-3 w-3" aria-hidden /> Padrão
          </button>
        )}
      </div>
      {aberto && <div className="space-y-2 border-l border-bordaForte pb-2 pl-2">{children}</div>}
    </div>
  )
}

/** Abas internas (Entrada · Ênfase · Saída) com ponto quando a aba tem animação. */
export function AbasInternas<T extends string>({ valor, opcoes, aoMudar }: { valor: T; opcoes: { id: T; rotulo: string; ativo?: boolean }[]; aoMudar: (v: T) => void }) {
  return (
    <div role="tablist" aria-label="Tipo de animação" className="flex w-full rounded-md bg-superficie2 p-[3px]">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => aoMudar(o.id)}
          className={cx('flex h-[26px] flex-1 items-center justify-center gap-1.5 rounded-[5px] text-[11px] transition-colors', valor === o.id ? 'bg-superficie font-medium text-texto shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-texto2 hover:text-texto')}
        >
          {o.rotulo}
          {o.ativo && <span className="h-1.5 w-1.5 rounded-full bg-acento" aria-label="(com animação)" />}
        </button>
      ))}
    </div>
  )
}

// ---------- cartões ----------

/** Cartão de preset: prévia animada ao passar o mouse/focar, rótulo embaixo. */
export function CartaoPreset({ selecionado, rotulo, aoClicar, children, titulo, duasLinhas }: { selecionado: boolean; rotulo: string; aoClicar: () => void; children: (tocando: boolean) => ReactNode; titulo?: string; duasLinhas?: boolean }) {
  const [tocando, setTocando] = useState(false)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      title={titulo ?? rotulo}
      onClick={aoClicar}
      onPointerEnter={() => setTocando(true)}
      onPointerLeave={() => setTocando(false)}
      onFocus={() => setTocando(true)}
      onBlur={() => setTocando(false)}
      className={cx('group flex min-w-0 flex-col gap-1 rounded-lg border p-1 pb-1.5 text-left transition-colors', selecionado ? 'border-acento bg-acentoSuave' : 'border-borda bg-superficie hover:border-bordaForte')}
    >
      {/* sem eventos na prévia: ela remonta ao passar o mouse, e um clique que começa num nó removido não conta */}
      <span className={cx('pointer-events-none relative block h-10 w-full overflow-hidden rounded-[6px]', selecionado ? 'bg-superficie' : 'bg-superficie2')}>{children(tocando)}</span>
      <span className={cx('block px-0.5 text-[11px] leading-tight', duasLinhas ? 'line-clamp-2 min-h-[26px]' : 'truncate', selecionado ? 'font-medium text-acento' : 'text-texto2 group-hover:text-texto')}>{rotulo}</span>
    </button>
  )
}

export function GradeCartoesPreset({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-3 gap-1.5">
      {children}
    </div>
  )
}

/** Repete enquanto `ativo` (a cada `periodo` ms), para as prévias em loop dos cartões. */
export function useCiclo(ativo: boolean, periodo: number | null) {
  const [ciclo, setCiclo] = useState(0)
  useEffect(() => {
    if (!ativo) return
    setCiclo((c) => c + 1)
    if (periodo === null) return
    const t = window.setInterval(() => setCiclo((c) => c + 1), periodo)
    return () => window.clearInterval(t)
  }, [ativo, periodo])
  return ciclo
}

/**
 * Congela as miniaturas paradas num instante, todas juntas e no quadro seguinte (antes da 1ª pintura): a galeria
 * monta uma dúzia de cartões no mesmo commit e cada `getAnimations()` força um recálculo de estilo — intercalado
 * com `pause()`/`currentTime` (que sujam o estilo de novo), era um recálculo por cartão ao abrir a aba, mais o do
 * quadro. No requestAnimationFrame, a primeira leitura faz o recálculo que o quadro faria de qualquer jeito; depois
 * vêm todas as escritas.
 */
let aCongelar: { el: HTMLElement; t: number }[] = []
function congelar(el: HTMLElement, t: number) {
  if (!aCongelar.length) requestAnimationFrame(() => {
    const lote = aCongelar.filter(({ el }) => el.isConnected && el.hasAttribute('data-congelada'))
    aCongelar = []
    const anims = lote.map(({ el }) => el.getAnimations({ subtree: true }))
    lote.forEach(({ t }, i) => { for (const a of anims[i]!) { a.pause(); a.currentTime = t } })
  })
  aCongelar.push({ el, t })
}

const ESCALA = 0.25 // a prévia usa coordenadas de referência (como a cena) e é reduzida: deslocamentos reais de 40 px viram 10 px

/**
 * Miniatura de um preset com os MESMOS keyframes/estilos do renderizador.
 * `tipo`/`preset` = entrada/saída (o preset traz os ajustes da variação); `loop` = ênfase.
 * Texto mostra a divisão real em palavras/letras (número, no contador).
 */
export function MiniPrevia({ tipo: tipoProp, preset, loop, saida, texto, tocando, cor = '#5965F2' }: { tipo?: TipoAnimacao; preset?: PresetEntrada; loop?: TipoLoop; saida?: boolean; texto?: boolean; tocando: boolean; cor?: string }) {
  const { reduzirMovimento } = usePreferencias()
  const tipo = preset?.id ?? tipoProp
  const anim: Animacao | undefined = useMemo(() => (tipo && tipo !== 'none' ? animacaoDoPreset(tipo, undefined, preset) : undefined), [tipo, preset])
  const loopDef: Loop | undefined = useMemo(() => (loop ? { type: loop, duration: Math.min(PRESETS_LOOP.find((p) => p.id === loop)?.duracao ?? 2000, 2400), intensity: 1.8 } : undefined), [loop])
  const temAnim = !!anim || !!loopDef
  const ativo = tocando && !reduzirMovimento && temAnim
  const ciclo = useCiclo(ativo, loopDef ? null : (anim?.duration ?? 600) + 900)
  const desenho = tipo === 'draw'
  const plano = temAnim ? planoAnimacao({ entrada: saida ? undefined : anim, saida: saida ? anim : undefined, loop: loopDef, reduzir: false, ehTexto: !!texto, desenhavel: desenho }) : {}
  const vars = { ['--op' as string]: 1, ['--tf' as string]: 'translate(0)', ['--amp' as string]: loopDef?.intensity ?? 1, ['--clip-final' as string]: 'none' }
  // parado: congela os mesmos keyframes no meio do movimento, para cada cartão mostrar o "jeito" do efeito
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (ativo || !temAnim || !el || typeof el.getAnimations !== 'function') return
    const meio = tipo === 'reveal' || tipo === 'mask' || tipo === 'iris' || tipo === 'draw' || tipo === 'unfold' || tipo === 'expand' || (!!tipo && ehAnimacaoDeTexto(tipo))
    const t = loopDef ? loopDef.duration * (loop === 'pulse' || loop === 'float' || loop === 'glow' ? 0.5 : 0.25) : (anim?.duration ?? 600) * (saida ? 0.55 : tipo === 'bounce' ? 0.62 : meio ? 0.45 : 0.2)
    congelar(el, t)
  }, [ativo, temAnim, ciclo, anim?.duration, loopDef, loop, saida, tipo])
  const chave = `${ativo ? 'a' : 'p'}-${ciclo}`
  const amostra = tipo === 'counter' ? '38%' : tipo === 'lines' ? 'Olá\nmundo' : 'Olá mundo'
  return (
    <span ref={ref} aria-hidden data-congelada={ativo ? undefined : ''} className="absolute left-1/2 top-1/2" style={{ width: 288, height: 160, marginLeft: -144, marginTop: -80, transform: `scale(${ESCALA})` }}>
      {texto ? (
        <span key={chave} className={plano.classe} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 46, lineHeight: 1.05, fontWeight: 600, letterSpacing: -1.5, color: 'rgb(var(--cor-texto))', whiteSpace: 'pre-wrap', ...vars, ...plano.estilo }}>
          <span>{plano.texto ? <TextoSegmentado texto={amostra} animacao={plano.texto} cor="#5965F2" /> : amostra}</span>
        </span>
      ) : desenho ? (
        <span key={chave} className={plano.classe} style={{ position: 'absolute', left: 84, top: 30, width: 120, height: 100, ...vars, ...plano.estilo }}>
          <Desenho ativo style={{ width: '100%', height: '100%' }}>
            <svg viewBox="0 0 120 100" width="120" height="100"><polygon points="60,6 74,40 112,42 82,64 92,96 60,76 28,96 38,64 8,42 46,40" fill="#C9CCF7" stroke={cor} strokeWidth="5" strokeLinejoin="round" /></svg>
          </Desenho>
        </span>
      ) : (
        <span key={chave} className={plano.classe} style={{ position: 'absolute', left: 84, top: 40, width: 120, height: 80, borderRadius: 16, background: cor, boxShadow: cor === '#5965F2' ? '0 8px 20px -8px rgba(89,101,242,.6)' : undefined, ...vars, ...plano.estilo }} />
      )}
    </span>
  )
}

const KEYFRAME_TRANSICAO: Record<Transicao['type'], string> = { none: 'cena-fade', fade: 'cena-fade', slide: 'cena-slide', scale: 'cena-scale', morph: '', push: 'cena-push' }
const CURVA_TRANSICAO: Partial<Record<Transicao['type'], string>> = { scale: 'cubic-bezier(.2,.8,.2,1)', push: 'cubic-bezier(.65,0,.35,1)' }

/** Miniatura de transição de tela: a tela B entra sobre a A com os keyframes reais do visualizador. */
export function MiniTransicao({ tipo, tocando, duracao }: { tipo: Transicao['type']; tocando: boolean; duracao: number }) {
  const { reduzirMovimento } = usePreferencias()
  const ativo = tocando && !reduzirMovimento
  const ciclo = useCiclo(ativo, duracao + 1000)
  const [morphFim, setMorphFim] = useState(true)
  useEffect(() => {
    if (tipo !== 'morph' || !ativo) return setMorphFim(true)
    setMorphFim(false)
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setMorphFim(true)))
    return () => cancelAnimationFrame(r)
  }, [ciclo, tipo, ativo])
  // empurrar: a tela A sai junto, com o mesmo tempo e curva (a B a empurra)
  const saiA = ativo && tipo === 'push' ? { animation: `cena-saida-push ${duracao}ms ${CURVA_TRANSICAO.push} 250ms both` } : undefined
  const telaA = (
    <span key={`a-${ciclo}`} className="absolute inset-0 bg-[#E7E5E1]" style={saiA}>
      <span className="absolute left-[10%] top-[22%] h-[14%] w-[44%] rounded-[2px] bg-[#C9C6C0]" />
      <span className="absolute left-[10%] top-[48%] h-[8%] w-[30%] rounded-[2px] bg-[#D6D3CE]" />
    </span>
  )
  if (tipo === 'morph') {
    const caixa = morphFim ? { left: '52%', top: '18%', width: '38%', height: '64%', borderRadius: 4, background: '#5965F2' } : { left: '10%', top: '22%', width: '20%', height: '30%', borderRadius: 2, background: '#9AA1F7' }
    return (
      <span aria-hidden className="absolute inset-0 bg-[#EEEFFD]">
        <span className="absolute left-[10%] top-[70%] h-[8%] w-[30%] rounded-[2px] bg-[#C9CCF7]" />
        <span className="absolute" style={{ ...caixa, transition: morphFim && ativo ? `all ${duracao}ms ${EASING_CSS.easeInOut}` : 'none' }} />
      </span>
    )
  }
  return (
    <span aria-hidden className="absolute inset-0">
      {telaA}
      {tipo !== 'none' || ativo ? (
        <span
          key={ciclo}
          className="absolute inset-0 bg-[#EEEFFD]"
          style={ativo ? { animation: tipo === 'none' ? `cena-fade 1ms step-end ${Math.round(duracao * 0.6)}ms both` : `${KEYFRAME_TRANSICAO[tipo]} ${duracao}ms ${CURVA_TRANSICAO[tipo] ?? 'ease-out'} 250ms both` } : tipo === 'none' || tipo === 'push' ? { opacity: 0 } : undefined}
        >
          <span className="absolute left-[52%] top-[18%] h-[64%] w-[38%] rounded-[4px] bg-[#5965F2]" />
          <span className="absolute left-[10%] top-[30%] h-[12%] w-[34%] rounded-[2px] bg-[#C9CCF7]" />
        </span>
      ) : null}
    </span>
  )
}

// ---------- área de transferência de animação ----------

export interface AnimacaoCopiada {
  enterAnimation?: Animacao
  loopAnimation?: Loop
  exitAnimation?: Animacao
}
let copiada: AnimacaoCopiada | null = null
const ouvintes = new Set<() => void>()
export const areaAnimacao = {
  copiar(a: AnimacaoCopiada) {
    copiada = structuredClone(a)
    ouvintes.forEach((f) => f())
  },
  ler: () => copiada,
}
export function useAnimacaoCopiada(): AnimacaoCopiada | null {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f) } },
    () => copiada,
    () => null
  )
}
