'use client'
/**
 * Seção "Guias de layout" do painel Design (como a "Layout guide" do Figma/Framer), para a tela (nada selecionado)
 * e para um frame: "+" acrescenta uma grade de 8 e já abre o popover; cada linha tem o ícone do tipo, o resumo
 * clicável ("Grade 8px", "12 colunas"), o olho e o "−". No título: predefinições (12/8/4 colunas, grade de 8) e
 * copiar/colar as guias entre telas e frames.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ClipboardPaste, Copy, Eye, EyeOff, LayoutTemplate, Minus } from 'lucide-react'
import { MAX_GUIAS, type GuiaLayout } from '@/lib/scene/schema'
import { PREDEFINICOES_GUIA, guiasOuNada, novaGuia, resumoGuia } from '@/lib/scene/guias'
import type { Editor } from '@/lib/editor/useEditor'
import { cx } from '@/components/ui'
import { BotaoMini } from '../inspetor/campos'
import { Secao } from '../inspetor/controles'
import { useHistorico } from '../inspetor/contexto'
import { ICONE_GUIA } from './icones'
import { PopoverGuia } from './PopoverGuia'
import { copiarGuias, useGuiasCopiadas } from './estado'

type Mudar = (f: (lista: GuiaLayout[]) => GuiaLayout[], historico: boolean) => void

export function SecaoGuias({ guias, area, aoMudar }: { guias: readonly GuiaLayout[] | undefined; area: { width: number; height: number }; aoMudar: Mudar }) {
  const lista = guias ?? []
  const historico = useHistorico()
  const [aberta, setAberta] = useState<number | null>(null)
  const linhas = useRef<(HTMLDivElement | null)[]>([])
  const copiadas = useGuiasCopiadas()
  const mudar = (f: (l: GuiaLayout[]) => GuiaLayout[]) => aoMudar(f, historico())
  const cheia = lista.length >= MAX_GUIAS
  // o popover segue a guia; se ela sumiu (desfazer, outra pessoa removeu), fecha
  const aberto = aberta !== null && aberta < lista.length ? aberta : null
  const acrescentar = (g: GuiaLayout) => {
    if (cheia) return
    mudar((l) => [...l, g])
    setAberta(lista.length)
  }
  const remover = (i: number) => {
    mudar((l) => l.filter((_, k) => k !== i))
    setAberta((a) => (a === null || a === i ? null : a > i ? a - 1 : a))
  }
  return (
    <Secao
      titulo="Guias de layout"
      vazia={!lista.length}
      aoAdicionar={cheia ? undefined : () => acrescentar(novaGuia('grid', area))}
      rotuloAdicionar="Adicionar guia de layout"
      acao={
        <>
          {lista.length > 0 && <BotaoMini rotulo="Copiar guias" title="Copiar as guias (para colar em outra tela ou frame)" onClick={() => copiarGuias(lista)}><Copy className="h-3.5 w-3.5" /></BotaoMini>}
          {copiadas && <BotaoMini rotulo="Colar guias" title={`Colar ${copiadas.length === 1 ? 'a guia copiada' : `as ${copiadas.length} guias copiadas`} (substitui as desta)`} onClick={() => { const c = structuredClone(copiadas); mudar(() => c.slice(0, MAX_GUIAS)); setAberta(null) }}><ClipboardPaste className="h-3.5 w-3.5" /></BotaoMini>}
          {!cheia && <Predefinicoes aoEscolher={(id) => { const p = PREDEFINICOES_GUIA.find((x) => x.id === id); if (p) acrescentar(p.criar(area)) }} />}
        </>
      }
    >
      {lista.map((g, i) => {
        const Icone = ICONE_GUIA[g.type]
        const resumo = resumoGuia(g)
        return (
          <div key={i} ref={(el) => { linhas.current[i] = el }} className="flex items-center gap-1" data-guia-linha={resumo}>
            <button type="button" aria-label={`Abrir guia: ${resumo}`} title={resumo} onClick={() => setAberta(aberto === i ? null : i)} className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors', aberto === i ? 'bg-acentoSuave text-acento' : 'bg-superficie2 text-texto2 hover:text-texto', !g.visible && 'opacity-50')}>
              <Icone />
            </button>
            <button type="button" aria-label={`Editar guia: ${resumo}`} aria-haspopup="dialog" aria-expanded={aberto === i} onClick={() => setAberta(aberto === i ? null : i)} className={cx('flex h-7 min-w-0 flex-1 items-center justify-between gap-1 rounded-md bg-superficie2 pl-2 pr-1.5 text-left text-[11px] ring-inset hover:ring-1 hover:ring-bordaForte', aberto === i && '!ring-1 !ring-acento', g.visible ? 'text-texto' : 'text-texto3')}>
              <span className="truncate">{resumo}</span>
              <ChevronDown className="h-3 w-3 shrink-0 text-texto3" aria-hidden />
            </button>
            <BotaoMini rotulo={g.visible ? `Esconder guia: ${resumo}` : `Mostrar guia: ${resumo}`} onClick={() => mudar((l) => l.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)))}>{g.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</BotaoMini>
            <BotaoMini rotulo={`Remover guia: ${resumo}`} onClick={() => remover(i)}><Minus className="h-3.5 w-3.5" /></BotaoMini>
          </div>
        )
      })}
      {aberto !== null && lista[aberto] && (
        <PopoverGuia
          key={aberto}
          ancora={linhas.current[aberto] ?? null}
          guia={lista[aberto]!}
          area={area}
          aoMudar={(f) => mudar((l) => l.map((x, k) => (k === aberto ? f(x) : x)))}
          aoFechar={() => setAberta(null)}
        />
      )}
    </Secao>
  )
}

/** Menu das predefinições no título da seção. */
function Predefinicoes({ aoEscolher }: { aoEscolher: (id: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc, true) }
  }, [aberto])
  return (
    <div ref={ref} className="relative">
      <BotaoMini rotulo="Guias prontas" title="Guias prontas: 12, 8 ou 4 colunas, grade de 8" aria-haspopup="menu" aria-expanded={aberto} ativo={aberto} onClick={() => setAberto((v) => !v)}><LayoutTemplate className="h-3.5 w-3.5" /></BotaoMini>
      {aberto && (
        <div role="menu" aria-label="Guias prontas" className="absolute right-0 top-7 z-40 w-40 rounded-lg border border-borda bg-superficie p-1 shadow-painel">
          {PREDEFINICOES_GUIA.map((p) => {
            const Icone = ICONE_GUIA[p.id.startsWith('grade') ? 'grid' : 'columns']
            return (
              <button key={p.id} type="button" role="menuitem" onClick={() => { setAberto(false); aoEscolher(p.id) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-hover">
                <span className="text-texto2"><Icone /></span>{p.rotulo}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Seção para a tela atual (painel da tela, nada selecionado). */
export function SecaoGuiasTela({ editor }: { editor: Editor }) {
  const { cena, acoes } = editor
  if (!cena) return null
  return <SecaoGuias key={cena.id} guias={cena.guias} area={cena.size} aoMudar={(f, historico) => acoes.transformarCena((c) => ({ ...c, guias: guiasOuNada(f(c.guias ?? [])) }), historico)} />
}

/** Seção para um frame selecionado (só com um frame na seleção). */
export function SecaoGuiasFrame({ editor }: { editor: Editor }) {
  const { camadasSelecionadas, acoes } = editor
  const f = camadasSelecionadas.length === 1 ? camadasSelecionadas[0] : undefined
  if (f?.type !== 'frame') return null
  return <SecaoGuias key={f.id} guias={f.guias} area={f} aoMudar={(fn, historico) => acoes.atualizarCamadas([f.id], (l) => (l.type === 'frame' ? { ...l, guias: guiasOuNada(fn(l.guias ?? [])) } : l), historico)} />
}
