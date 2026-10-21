'use client'
import { useState } from 'react'
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { MiniaturaCena } from './MiniaturaCena'
import { BotaoIcone, cx } from '@/components/ui'

export function PainelCenas({ editor, assets }: { editor: Editor; assets: AssetsResolvidos }) {
  const { estado, acoes } = editor
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)
  const cenas = estado.documento.scenes

  return (
    <aside aria-label="Cenas" className="flex h-full w-full flex-col border-r bg-superficie">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-texto2">Cenas · {cenas.length}</span>
        <BotaoIcone rotulo="Adicionar cena" onClick={() => acoes.adicionarCena(editor.indiceCena)}><Plus className="h-4 w-4" /></BotaoIcone>
      </div>
      <ol className="rolagem-fina flex-1 space-y-2 overflow-y-auto px-3 pb-3" role="listbox" aria-label="Lista de cenas">
        {cenas.map((c, i) => {
          const ativa = c.id === estado.cenaId
          return (
            <li
              key={c.id}
              role="option"
              aria-selected={ativa}
              tabIndex={0}
              draggable
              onDragStart={() => setArrastando(i)}
              onDragOver={(e) => { e.preventDefault(); setSobre(i) }}
              onDragLeave={() => setSobre(null)}
              onDrop={() => { if (arrastando != null && arrastando !== i) acoes.moverCena(arrastando, i); setArrastando(null); setSobre(null) }}
              onDragEnd={() => { setArrastando(null); setSobre(null) }}
              onClick={() => acoes.irParaCena(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') acoes.irParaCena(c.id)
                if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); acoes.moverCena(i, i - 1) }
                if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); acoes.moverCena(i, i + 1) }
              }}
              className={cx('group relative cursor-pointer rounded-xl border p-1.5 transition-colors', ativa ? 'border-texto/60 bg-superficie2' : 'hover:bg-superficie2', sobre === i && arrastando !== i && 'border-dashed border-texto')}
            >
              <div className="flex items-start gap-1.5">
                <span className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-texto2">
                  <GripVertical className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" aria-hidden />
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <MiniaturaCena cena={c} assets={assets} largura={168} />
                  <p className="mt-1 truncate text-xs">{c.title || 'Sem título'}</p>
                </div>
              </div>
              <div className="absolute right-1 top-1 hidden gap-0.5 rounded-lg bg-superficie/90 p-0.5 group-hover:flex group-focus-within:flex">
                <BotaoIcone rotulo="Duplicar cena" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); acoes.duplicarCena(c.id) }}><Copy className="h-3.5 w-3.5" /></BotaoIcone>
                <BotaoIcone rotulo="Apagar cena" className="h-7 w-7" disabled={cenas.length <= 1} onClick={(e) => { e.stopPropagation(); acoes.removerCena(c.id) }}><Trash2 className="h-3.5 w-3.5" /></BotaoIcone>
              </div>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
