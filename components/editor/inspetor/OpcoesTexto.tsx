'use client'
/**
 * "Opções de texto" (como o "Type settings" do Figma): botão na seção Texto que abre um painel com duas abas.
 * - Básico: alinhamento (com justificado), decoração (nenhuma, sublinhado, tachado + estilo, espessura,
 *   deslocamento, pular descendentes e cor da linha), caixa (inclui Primeira Maiúscula e versalete), corte vertical,
 *   lista, espaço entre parágrafos e truncar texto (máximo de linhas).
 * - Detalhes: quebra de linha (automática, equilibrada, bonita), algarismos e ligaduras.
 * Tudo vale no editor, no visualizador e na exportação (lib/scene/tipografia.ts).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, List, ListOrdered, Minus, Strikethrough, Underline, X } from 'lucide-react'
import type { CamadaTexto } from '@/lib/scene/schema'
import { temOpcoesDeTexto } from '@/lib/scene/tipografia'
import { cx } from '@/components/ui'
import { BotaoCampo, BotaoMini, CampoCor, CampoNum, Interruptor, Segmentado } from './controles'

type Set = (p: Partial<CamadaTexto>) => void
type Aba = 'basico' | 'detalhes'

/** Ícone das opções de texto (Aa com controles), no traço dos ícones do inspetor. */
function IconeOpcoesTexto() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
      <path d="M2 4.5h7M2 8h5M2 11.5h7" />
      <circle cx="12" cy="4.5" r="1.4" />
      <circle cx="10" cy="8" r="1.4" />
      <circle cx="12" cy="11.5" r="1.4" />
    </svg>
  )
}

export function BotaoOpcoesTexto({ c, set }: { c: CamadaTexto; set: Set }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span ref={ref} className="inline-flex shrink-0">
      <BotaoCampo rotulo="Opções de texto" title="Opções de texto: decoração, caixa, corte vertical, listas, truncar…" ativo={aberto || temOpcoesDeTexto(c)} aria-haspopup="dialog" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <IconeOpcoesTexto />
      </BotaoCampo>
      {aberto && <PainelOpcoesTexto c={c} set={set} ancora={ref.current} aoFechar={() => setAberto(false)} />}
    </span>
  )
}

function PainelOpcoesTexto({ c, set, ancora, aoFechar }: { c: CamadaTexto; set: Set; ancora: HTMLElement | null; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [aba, setAba] = useState<Aba>('basico')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // ao lado do inspetor (à esquerda), sem sair da janela
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const posicionar = () => {
      const a = ancora?.getBoundingClientRect() ?? { left: window.innerWidth - 300, right: window.innerWidth - 300, top: 120 }
      const w = el.offsetWidth
      const h = el.offsetHeight
      let left = a.left - w - 12
      const painel = ancora?.closest('aside')?.getBoundingClientRect()
      if (painel) left = Math.min(left, painel.left - w - 8)
      if (left < 8) left = Math.min(window.innerWidth - w - 8, a.right + 12)
      setPos({ left: Math.max(8, left), top: Math.max(8, Math.min(window.innerHeight - h - 8, a.top - 60)) })
    }
    posicionar()
    const ro = new ResizeObserver(posicionar)
    ro.observe(el)
    window.addEventListener('resize', posicionar)
    return () => { ro.disconnect(); window.removeEventListener('resize', posicionar) }
  }, [ancora])

  // Esc e clique fora fecham (o seletor de cor aberto daqui é outro diálogo: não conta como fora)
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar
  useEffect(() => {
    const el = ref.current
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Element
      if (el?.contains(alvo) || ancora?.contains(alvo) || alvo.closest?.('[role="dialog"], [data-menu-suspenso]')) return
      fechar.current()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-label^="Seletor de cor"]')) { e.preventDefault(); fechar.current() } }
    document.addEventListener('pointerdown', fora, true)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fora, true); document.removeEventListener('keydown', esc) }
  }, [ancora])

  const conteudo = (
    <div
      ref={ref}
      role="dialog"
      aria-label="Opções de texto"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="fixed z-[70] w-[272px] rounded-xl border border-borda bg-superficie text-texto shadow-painel outline-none"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      <div className="flex h-10 items-center gap-1 border-b border-borda pl-2 pr-1.5">
        <div role="tablist" aria-label="Opções de texto" className="flex flex-1 gap-0.5">
          {(['basico', 'detalhes'] as const).map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={cx('rounded-md px-2 py-1 text-[12px] transition-colors', aba === a ? 'bg-hover font-medium text-texto' : 'text-texto2 hover:text-texto')}>
              {a === 'basico' ? 'Básico' : 'Detalhes'}
            </button>
          ))}
        </div>
        <BotaoMini rotulo="Fechar opções de texto" onClick={aoFechar}><X className="h-3.5 w-3.5" /></BotaoMini>
      </div>
      <div role="tabpanel" aria-label={aba === 'basico' ? 'Básico' : 'Detalhes'} className="space-y-1.5 p-2.5">
        {aba === 'basico' ? <Basico c={c} set={set} /> : <Detalhes c={c} set={set} />}
      </div>
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(conteudo, document.body)
}

/** Linha do painel: rótulo à esquerda (largura fixa) e controle à direita, 28 px. */
function Item({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <div className="flex min-h-[28px] items-center gap-2" title={dica}>
      <span className="w-[84px] shrink-0 truncate text-[11px] text-texto2">{rotulo}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">{children}</div>
    </div>
  )
}

const ic = 'h-3.5 w-3.5'

function Basico({ c, set }: { c: CamadaTexto; set: Set }) {
  const decoracao = c.underline ? 'underline' : c.strikethrough ? 'strike' : 'none'
  const linhaAtiva = decoracao !== 'none'
  return (
    <>
      <Item rotulo="Alinhamento">
        <Segmentado rotulo="Alinhamento do texto" icones valor={c.align} aoMudar={(align) => set({ align })} opcoes={[
          { id: 'left', rotulo: 'Esquerda', icone: <AlignLeft className={ic} /> },
          { id: 'center', rotulo: 'Centro', icone: <AlignCenter className={ic} /> },
          { id: 'right', rotulo: 'Direita', icone: <AlignRight className={ic} /> },
          { id: 'justify', rotulo: 'Justificado', icone: <AlignJustify className={ic} /> },
        ]} />
      </Item>
      <Item rotulo="Decoração">
        <Segmentado<'none' | 'underline' | 'strike'> rotulo="Decoração" icones valor={decoracao} aoMudar={(d) => set({ underline: d === 'underline', strikethrough: d === 'strike' ? true : undefined })} opcoes={[
          { id: 'none', rotulo: 'Nenhuma', icone: <Minus className={ic} /> },
          { id: 'underline', rotulo: 'Sublinhado', icone: <Underline className={ic} /> },
          { id: 'strike', rotulo: 'Tachado', icone: <Strikethrough className={ic} /> },
        ]} />
      </Item>
      {linhaAtiva && (
        <div className="space-y-1.5 rounded-lg bg-canvas/60 p-1.5">
          <Item rotulo="Estilo da linha">
            <Segmentado rotulo="Estilo da linha" icones valor={c.decorationStyle ?? 'solid'} aoMudar={(v) => set({ decorationStyle: v === 'solid' ? undefined : v })} opcoes={[
              { id: 'solid', rotulo: 'Contínua', icone: <IconeLinha estilo="solid" /> },
              { id: 'dotted', rotulo: 'Pontilhada', icone: <IconeLinha estilo="dotted" /> },
              { id: 'wavy', rotulo: 'Ondulada', icone: <IconeLinha estilo="wavy" /> },
            ]} />
          </Item>
          <Item rotulo="Espessura">
            <CampoNum prefixo={<IconeEspessura />} rotulo="Espessura da linha" valor={c.decorationThickness ?? null} vazio="Auto" base={Math.max(1, Math.round(c.fontSize / 14))} min={0.5} max={100} passo={0.5} casas={1} sufixo="px" aoMudar={(v) => set({ decorationThickness: v })} aoLimpar={() => set({ decorationThickness: undefined })} />
          </Item>
          {c.underline && (
            <Item rotulo="Deslocamento">
              <CampoNum prefixo={<IconeDeslocamento />} rotulo="Distância do sublinhado" valor={c.decorationOffset ?? null} vazio="Auto" base={Math.round(c.fontSize / 10)} min={-100} max={100} passo={1} casas={1} sufixo="px" aoMudar={(v) => set({ decorationOffset: v })} aoLimpar={() => set({ decorationOffset: undefined })} />
            </Item>
          )}
          <Item rotulo="Pular descend.">
            <span className="flex-1 truncate text-[12px] text-texto3">{c.decorationSkipInk === false ? 'Linha corrida' : 'Contorna g, p, y'}</span>
            <Interruptor rotulo="Pular descendentes" ativo={c.decorationSkipInk !== false} aoMudar={(v) => set({ decorationSkipInk: v ? undefined : false })} />
          </Item>
          <Item rotulo="Cor da linha">
            <CampoCor rotulo="Cor da linha" permitirVazio valor={c.decorationColor} aoMudar={(decorationColor) => set({ decorationColor })} />
          </Item>
        </div>
      )}
      <Item rotulo="Caixa">
        <Segmentado<CamadaTexto['transform']> rotulo="Caixa" icones valor={c.transform} aoMudar={(transform) => set({ transform })} opcoes={[
          { id: 'none', rotulo: 'Como digitado', icone: <Minus className={ic} /> },
          { id: 'uppercase', rotulo: 'MAIÚSCULAS', icone: <span className="text-[11px] font-medium">AA</span> },
          { id: 'lowercase', rotulo: 'minúsculas', icone: <span className="text-[11px] font-medium">aa</span> },
          { id: 'capitalize', rotulo: 'Primeira Maiúscula', icone: <span className="text-[11px] font-medium">Aa</span> },
          { id: 'smallCaps', rotulo: 'Versalete', icone: <span className="text-[11px] font-medium" style={{ fontVariantCaps: 'small-caps' }}>Aa</span> },
          { id: 'allSmallCaps', rotulo: 'Versalete forçado', icone: <span className="text-[11px] font-medium" style={{ fontVariantCaps: 'all-small-caps' }}>Aa</span> },
        ]} />
      </Item>
      <Item rotulo="Corte vertical" dica="Justo: a caixa vai da altura das maiúsculas até a linha de base (sem o respiro da entrelinha em cima e embaixo). Alinha o texto certinho com outras camadas.">
        <Segmentado<'none' | 'cap'> rotulo="Corte vertical" valor={c.leadingTrim ?? 'none'} aoMudar={(v) => set({ leadingTrim: v === 'cap' ? 'cap' : undefined })} opcoes={[
          { id: 'none', rotulo: 'Padrão' },
          { id: 'cap', rotulo: 'Justo' },
        ]} />
      </Item>
      <Item rotulo="Lista">
        <Segmentado<'none' | 'bullet' | 'number'> rotulo="Estilo de lista" icones valor={c.listStyle ?? 'none'} aoMudar={(v) => set({ listStyle: v === 'none' ? undefined : v })} opcoes={[
          { id: 'none', rotulo: 'Sem lista', icone: <Minus className={ic} /> },
          { id: 'bullet', rotulo: 'Marcadores', icone: <List className={ic} /> },
          { id: 'number', rotulo: 'Numerada', icone: <ListOrdered className={ic} /> },
        ]} />
      </Item>
      <Item rotulo="Parágrafos">
        <CampoNum prefixo={<IconeParagrafo />} rotulo="Espaço entre parágrafos" valor={c.paragraphSpacing ?? 0} min={0} max={1000} sufixo="px" aoMudar={(v) => set({ paragraphSpacing: v || undefined })} />
      </Item>
      <Item rotulo="Truncar texto" dica="Corta com reticências (…) no fim da caixa ou no número máximo de linhas">
        <span className="flex-1 truncate text-[12px] text-texto3">{c.truncate ? 'Com reticências' : 'Desligado'}</span>
        <Interruptor rotulo="Truncar texto" ativo={!!c.truncate} aoMudar={(v) => set({ truncate: v || undefined })} />
      </Item>
      {c.truncate && (
        <Item rotulo="Máx. de linhas">
          <CampoNum prefixo={<IconeLinhas />} rotulo="Máximo de linhas" valor={c.maxLines ?? null} vazio={c.sizingH === 'hug' ? 'Sem limite' : 'Até a caixa'} base={1} min={1} max={999} aoMudar={(v) => set({ maxLines: Math.max(1, Math.round(v)) })} aoLimpar={() => set({ maxLines: undefined })} />
        </Item>
      )}
    </>
  )
}

function Detalhes({ c, set }: { c: CamadaTexto; set: Set }) {
  const hug = c.sizingW === 'hug'
  return (
    <>
      <Item rotulo="Quebra de linha" dica={hug ? 'Com largura automática o texto não quebra linha' : 'Equilibrada: linhas de tamanho parecido (títulos). Bonita: evita uma palavra sozinha na última linha.'}>
        <Segmentado<'auto' | 'balance' | 'pretty'> rotulo="Quebra de linha" valor={c.textWrap ?? 'auto'} aoMudar={(v) => set({ textWrap: v === 'auto' ? undefined : v })} opcoes={[
          { id: 'auto', rotulo: 'Auto' },
          { id: 'balance', rotulo: 'Equilibrada' },
          { id: 'pretty', rotulo: 'Bonita' },
        ]} />
      </Item>
      {hug && <p className="pl-[92px] text-[12px] text-texto3">Vale com largura fixa ou altura automática.</p>}
      <Item rotulo="Algarismos">
        <Segmentado<'p' | 't'> rotulo="Algarismos" valor={c.tabularNums ? 't' : 'p'} aoMudar={(v) => set({ tabularNums: v === 't' ? true : undefined })} opcoes={[
          { id: 'p', rotulo: 'Proporcionais' },
          { id: 't', rotulo: 'Tabulares' },
        ]} />
      </Item>
      <Item rotulo="Ligaduras" dica="Ligaduras comuns da fonte (fi, fl)">
        <span className="flex-1 truncate text-[12px] text-texto3" style={{ fontVariantLigatures: c.ligatures === false ? 'none' : undefined }}>fi fl</span>
        <Interruptor rotulo="Ligaduras" ativo={c.ligatures !== false} aoMudar={(v) => set({ ligatures: v ? undefined : false })} />
      </Item>
    </>
  )
}

function IconeLinha({ estilo }: { estilo: 'solid' | 'dotted' | 'wavy' }) {
  return (
    <svg viewBox="0 0 16 8" className="h-2 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      {estilo === 'solid' && <path d="M1 4h14" />}
      {estilo === 'dotted' && <path d="M1.5 4h0M5 4h0M8.5 4h0M12 4h0M15 4h0" strokeWidth="1.8" />}
      {estilo === 'wavy' && <path d="M1 5c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0" />}
    </svg>
  )
}
function IconeEspessura() {
  return <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden><rect x="1" y="2" width="10" height="1" rx=".5" /><rect x="1" y="5" width="10" height="1.6" rx=".8" /><rect x="1" y="8.5" width="10" height="2.4" rx="1.2" /></svg>
}
function IconeDeslocamento() {
  return <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden><path d="M3 1.5v5M9 1.5v5M3 4h6M1 10.5h10" /></svg>
}
function IconeParagrafo() {
  return <span className="text-[11px]">¶</span>
}
function IconeLinhas() {
  return <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden><path d="M1.5 3h9M1.5 6h9M1.5 9h5" /><circle cx="9.5" cy="9" r=".4" fill="currentColor" /></svg>
}
