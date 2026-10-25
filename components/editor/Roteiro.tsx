'use client'
/**
 * Roteiro: as telas em fila, embaixo do canvas, com a transição entre uma e outra (clique para trocar).
 * Arrastar reordena; no hover, duplicar e apagar; "+" no começo e no fim cria uma tela depois da atual.
 */
import { memo, useMemo, useState } from 'react'
import { Copy, Map as IconeMapa, Plus, Trash2 } from 'lucide-react'
import type { Transicao } from '@/lib/scene/schema'
import { mesmoEditorForaDoCanvas, type Editor } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { TRANSICAO_PADRAO } from '@/lib/scene/morph'
import { MenuSuspenso } from '@/components/ui/MenuSuspenso'
import { BotaoIcone, cx } from '@/components/ui'
import { TRANSICOES } from './animacao/Transicao'
import { MiniaturaCena } from './MiniaturaCena'
import { QuemEstaNaTela } from './Presenca'

const ALTURA = 56
const CURTO: Partial<Record<Transicao['type'], string>> = { auto: 'Auto', none: 'Corte', slide: 'Slide', scale: 'Zoom', push: 'Empurrar' }

export const Roteiro = memo(function Roteiro({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { estado, acoes } = editor
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)
  const mapa = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets])
  const cenas = estado.documento.scenes
  const explorar = estado.documento.mode === 'explorar'
  const trocarTransicao = (id: string, type: Transicao['type']) =>
    acoes.transformarDocumento((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === id ? { ...s, transition: { ...(s.transition ?? TRANSICAO_PADRAO), type } } : s)) }))
  const novaTela = (
    <BotaoIcone rotulo="Nova tela" title="Nova tela (depois da atual)" className="h-7 w-7" onClick={() => acoes.adicionarCena(editor.indiceCena)}><Plus className="h-4 w-4" /></BotaoIcone>
  )
  return (
    <section aria-label="Roteiro" className="hidden h-[104px] shrink-0 border-t border-borda bg-superficie md:flex">
      <div className="flex w-[124px] shrink-0 flex-col justify-center gap-1 border-r border-borda px-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-texto">Roteiro</span>
          {novaTela}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-texto3">{cenas.length} {cenas.length === 1 ? 'tela' : 'telas'}</span>
        {explorar && (
          <button type="button" onClick={() => window.dispatchEvent(new Event('mostra:abrir-mapa'))} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-texto2 hover:text-acento"><IconeMapa className="h-3 w-3" />Mapa das telas</button>
        )}
      </div>
      <div className="rolagem-fina min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <ol role="listbox" aria-label="Telas" aria-orientation="horizontal" className="flex h-full items-center gap-0 px-3">
          {cenas.map((c, i) => {
            const ativa = c.id === estado.cenaId
            const largura = Math.round((ALTURA * c.size.width) / c.size.height)
            const tr = c.transition ?? TRANSICAO_PADRAO
            return (
              <li key={c.id} className="flex shrink-0 items-center">
                {i > 0 && !explorar && (
                  <MenuSuspenso
                    modo="acoes"
                    aparencia="texto"
                    rotulo={`Transição para a tela ${i + 1}`}
                    className="mx-1 !h-5 rounded-full border border-borda bg-superficie px-2 font-mono !text-[9px] uppercase tracking-[0.06em] text-texto2 hover:border-acento hover:text-acento"
                    opcoes={TRANSICOES.map((t) => ({ id: t.id, rotulo: t.rotulo, marcada: tr.type === t.id, aoClicar: () => trocarTransicao(c.id, t.id) }))}
                  >
                    {CURTO[tr.type] ?? TRANSICOES.find((t) => t.id === tr.type)?.rotulo ?? tr.type}
                  </MenuSuspenso>
                )}
                {i > 0 && explorar && <span className="mx-1.5 h-px w-4 bg-bordaForte" aria-hidden />}
                <div
                  role="option"
                  aria-selected={ativa}
                  aria-label={`${String(i + 1).padStart(2, '0')} ${c.title || 'Sem título'}`}
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setArrastando(i) }}
                  onDragOver={(e) => { e.preventDefault(); setSobre(i) }}
                  onDrop={(e) => { e.preventDefault(); if (arrastando != null && arrastando !== i) acoes.moverCena(arrastando, i); setArrastando(null); setSobre(null) }}
                  onDragEnd={() => { setArrastando(null); setSobre(null) }}
                  onClick={() => acoes.irParaCena(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') acoes.irParaCena(c.id)
                    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); acoes.moverCena(i, i - 1) }
                    if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); acoes.moverCena(i, i + 1) }
                  }}
                  className={cx('group relative cursor-pointer outline-none', arrastando === i && 'opacity-40')}
                >
                  {sobre === i && arrastando !== null && arrastando !== i && <span className="absolute -left-1.5 bottom-5 top-0 w-0.5 rounded bg-acento" />}
                  <div className={cx('relative overflow-hidden rounded-[6px] outline outline-[1.5px] outline-offset-2', ativa ? 'outline-acento' : 'outline-transparent group-hover:outline-bordaForte')} style={{ width: largura, height: ALTURA }}>
                    <MiniaturaCena cena={c} assets={mapa} largura={largura} className="rounded-[5px] border-0" />
                    <QuemEstaNaTela sala={editor.sala} cenaId={c.id} />
                  </div>
                  <div className="mt-1.5 flex max-w-full items-center gap-1 text-[11px]" style={{ width: largura }}>
                    <span className="font-mono text-[10px] text-texto3">{String(i + 1).padStart(2, '0')}</span>
                    <span className={cx('truncate', ativa ? 'text-texto' : 'text-texto2')}>{c.title || 'Sem título'}</span>
                  </div>
                  <div className="absolute right-1 top-1 hidden gap-0.5 rounded-md bg-superficie/95 p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
                    <BotaoIcone rotulo="Duplicar tela" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); acoes.duplicarCena(c.id) }}><Copy className="h-3 w-3" /></BotaoIcone>
                    <BotaoIcone rotulo="Apagar tela" className="h-5 w-5" disabled={cenas.length <= 1} onClick={(e) => { e.stopPropagation(); acoes.removerCena(c.id) }}><Trash2 className="h-3 w-3" /></BotaoIcone>
                  </div>
                </div>
              </li>
            )
          })}
          <li className="ml-3 flex shrink-0 items-center pb-5">
            <button type="button" aria-label="Nova tela no fim" title="Nova tela" onClick={() => acoes.adicionarCena(cenas.length - 1)} className="flex items-center justify-center rounded-[6px] border border-dashed border-bordaHover text-texto3 transition-colors hover:border-acento hover:text-acento" style={{ width: Math.round((ALTURA * 16) / 9 * 0.6), height: ALTURA }}>
              <Plus className="h-4 w-4" />
            </button>
          </li>
        </ol>
      </div>
    </section>
  )
}, (a, b) => mesmoEditorForaDoCanvas(a.editor, b.editor) && a.assets === b.assets)
