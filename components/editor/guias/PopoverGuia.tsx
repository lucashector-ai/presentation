'use client'
/**
 * Popover de uma guia de layout (como no Figma/Framer): o tipo no topo (Grade · Colunas · Linhas) e os campos do
 * tipo — grade: tamanho e cor; colunas/linhas: quantidade, cor, tipo (Esticar/Esquerda/Centro/Direita), largura
 * (Auto ao esticar), margem (deslocamento quando não estica) e calha. Fica ao lado do painel, como o seletor de cor.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { GuiaFaixas, GuiaLayout } from '@/lib/scene/schema'
import { NOMES_TIPO_GUIA, larguraEsticada, trocarTipo } from '@/lib/scene/guias'
import { BotaoMini, CampoNum } from '../inspetor/campos'
import { SeletorLista } from '../inspetor/controles'
import { LinhaPintura } from '../inspetor/CampoCor'

type Area = { width: number; height: number }

const ALINHAMENTOS: Record<GuiaFaixas['type'], { id: GuiaFaixas['alignment']; rotulo: string }[]> = {
  columns: [{ id: 'stretch', rotulo: 'Esticar' }, { id: 'start', rotulo: 'Esquerda' }, { id: 'center', rotulo: 'Centro' }, { id: 'end', rotulo: 'Direita' }],
  rows: [{ id: 'stretch', rotulo: 'Esticar' }, { id: 'start', rotulo: 'Topo' }, { id: 'center', rotulo: 'Centro' }, { id: 'end', rotulo: 'Base' }],
}

export function PopoverGuia({ ancora, guia, area, aoMudar, aoFechar }: { ancora: HTMLElement | null; guia: GuiaLayout; area: Area; aoMudar: (f: (g: GuiaLayout) => GuiaLayout) => void; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // ao lado do painel (à esquerda da linha), sem sair da janela
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const posicionar = () => {
      const a = ancora?.getBoundingClientRect() ?? { left: window.innerWidth - 300, right: window.innerWidth - 300, top: 80 }
      const w = el.offsetWidth, h = el.offsetHeight
      let left = a.left - w - 12
      if (left < 8) left = Math.min(window.innerWidth - w - 8, a.right + 12)
      setPos({ left: Math.max(8, left), top: Math.max(8, Math.min(window.innerHeight - h - 8, a.top - 12)) })
    }
    posicionar()
    const ro = new ResizeObserver(posicionar)
    ro.observe(el)
    window.addEventListener('resize', posicionar)
    return () => { ro.disconnect(); window.removeEventListener('resize', posicionar) }
  }, [ancora])

  // o primeiro campo já vem focado e selecionado (digitar troca o valor, como no Figma); Esc e clique fora fecham
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar
  useEffect(() => {
    const el = ref.current
    const anterior = document.activeElement as HTMLElement | null
    const campo = el?.querySelector<HTMLInputElement>('[data-primeiro] input')
    campo?.focus({ preventScroll: true })
    campo?.select()
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Element
      // o seletor de cor aberto daqui fica em outro portal: clicar nele não fecha a guia
      if (el?.contains(alvo) || ancora?.contains(alvo) || alvo.closest?.('[role=dialog]')) return
      fechar.current()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role=dialog][aria-label^="Seletor de cor"]')) return
      e.preventDefault()
      fechar.current()
    }
    document.addEventListener('pointerdown', fora, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora, true)
      document.removeEventListener('keydown', esc)
      const ativo = document.activeElement
      if (anterior && document.contains(anterior) && (!ativo || ativo === document.body || el?.contains(ativo))) anterior.focus({ preventScroll: true })
    }
  }, [ancora])

  const set = (patch: Partial<GuiaFaixas>) => aoMudar((g) => (g.type === 'grid' ? g : ({ ...g, ...patch } as GuiaLayout)))
  const nome = NOMES_TIPO_GUIA[guia.type]
  const cor = (
    <div className="min-w-0 flex-1">
      <LinhaPintura rotulo={`Cor da guia (${nome.toLowerCase()})`} valor={{ tipo: 'solido', cor: guia.color }} aoMudar={(p) => p.tipo === 'solido' && aoMudar((g) => ({ ...g, color: p.cor }))} />
    </div>
  )

  const conteudo = (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Guia de layout: ${nome}`}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-[65] w-[264px] rounded-xl border border-borda bg-superficie text-texto shadow-painel outline-none"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      <div className="flex h-11 items-center gap-2 border-b border-borda pl-2.5 pr-1.5">
        <span className="w-[112px]">
          <SeletorLista rotulo="Tipo da guia" valor={guia.type} aoMudar={(t) => aoMudar((g) => trocarTipo(g, t as GuiaLayout['type'], area))} opcoes={(['grid', 'columns', 'rows'] as const).map((t) => ({ id: t, rotulo: NOMES_TIPO_GUIA[t] }))} />
        </span>
        <span className="flex-1" />
        <BotaoMini rotulo="Fechar guia" onClick={aoFechar}><X className="h-3.5 w-3.5" /></BotaoMini>
      </div>
      <div className="space-y-1.5 p-2.5">
        {guia.type === 'grid' ? (
          <>
            <Campo rotulo="Tamanho" primeiro><CampoNum rotulo="Tamanho da grade" valor={guia.size} min={1} max={1000} sufixo="px" aoMudar={(size) => aoMudar((g) => (g.type === 'grid' ? { ...g, size: Math.round(size) } : g))} /></Campo>
            <Campo rotulo="Cor">{cor}</Campo>
          </>
        ) : (
          <CamposFaixas guia={guia} area={area} set={set} cor={cor} />
        )}
      </div>
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(conteudo, document.body)
}

function CamposFaixas({ guia, area, set, cor }: { guia: GuiaFaixas; area: Area; set: (p: Partial<GuiaFaixas>) => void; cor: ReactNode }) {
  const colunas = guia.type === 'columns'
  const plural = colunas ? 'colunas' : 'linhas'
  const esticar = guia.alignment === 'stretch'
  const auto = Math.max(1, Math.round(larguraEsticada(guia, area)))
  return (
    <>
      <Campo rotulo="Quantidade" primeiro><CampoNum rotulo={`Quantidade de ${plural}`} valor={guia.count} min={1} max={100} aoMudar={(count) => set({ count: Math.round(count) })} /></Campo>
      <Campo rotulo="Cor">{cor}</Campo>
      <Campo rotulo="Tipo">
        <SeletorLista
          rotulo={`Tipo das ${plural}`}
          valor={guia.alignment}
          // sair do esticar fixa a largura que as faixas tinham (nada pula na tela)
          aoMudar={(v) => set({ alignment: v as GuiaFaixas['alignment'], ...(v !== 'stretch' && guia.alignment === 'stretch' ? { width: auto } : {}) })}
          opcoes={ALINHAMENTOS[guia.type]}
        />
      </Campo>
      <Campo rotulo={colunas ? 'Largura' : 'Altura'}>
        <CampoNum rotulo={colunas ? 'Largura das colunas' : 'Altura das linhas'} valor={esticar ? null : (guia.width ?? auto)} vazio="Auto" desativado={esticar} titulo={esticar ? 'Auto: as faixas esticam entre as margens' : undefined} min={1} max={8192} base={auto} aoMudar={(width) => set({ width })} />
      </Campo>
      <Campo rotulo={esticar ? 'Margem' : 'Deslocamento'}>
        <CampoNum rotulo={esticar ? 'Margem' : 'Deslocamento'} valor={guia.alignment === 'center' ? null : guia.margin} vazio="—" desativado={guia.alignment === 'center'} titulo={guia.alignment === 'center' ? 'Centralizadas: sem margem' : undefined} min={0} max={8192} aoMudar={(margin) => set({ margin })} />
      </Campo>
      <Campo rotulo="Calha"><CampoNum rotulo="Calha" titulo={`Espaço entre as ${plural}`} valor={guia.gutter} min={0} max={8192} aoMudar={(gutter) => set({ gutter })} /></Campo>
    </>
  )
}

/** Linha "rótulo | campo" do popover (div, não label: a cor tem dois controles). */
function Campo({ rotulo, primeiro, children }: { rotulo: string; primeiro?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-[32px] items-center gap-2" data-primeiro={primeiro || undefined}>
      <span className="w-[84px] shrink-0 truncate text-[12px] text-texto2">{rotulo}</span>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  )
}
