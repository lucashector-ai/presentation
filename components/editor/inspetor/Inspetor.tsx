'use client'
import type { Editor, AbaDireita } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { cx } from '@/components/ui'
import { AbaDesign } from './AbaDesign'
import { AbaAnimacao } from './AbaAnimacao'
import { AbaInteracoes } from './AbaInteracoes'
import { InspetorTela } from './InspetorTela'

export function Inspetor({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { estado, acoes, camadasSelecionadas, cena } = editor
  const mapa = Object.fromEntries(assets.map((a) => [a.id, a]))
  const totalInter = cena?.layers.filter((l) => l.interactions.length > 0).length ?? 0
  const abas: { id: AbaDireita; rotulo: string }[] = [{ id: 'design', rotulo: 'Design' }, { id: 'animacao', rotulo: 'Animação' }, { id: 'interacoes', rotulo: 'Interações' }]
  const nada = camadasSelecionadas.length === 0
  return (
    <aside aria-label="Propriedades" className="flex h-full flex-col border-l border-borda bg-superficie">
      <div role="tablist" aria-label="Painel de propriedades" className="flex h-[52px] shrink-0 items-end gap-5 border-b border-borda px-4">
        {abas.map((a) => (
          <button key={a.id} role="tab" aria-selected={estado.abaDireita === a.id} onClick={() => acoes.ui({ abaDireita: a.id })} className={cx('flex h-full items-center gap-1.5 border-b-2 text-[13px] transition-colors', estado.abaDireita === a.id ? 'border-texto font-medium text-texto' : 'border-transparent text-texto3 hover:text-texto2')}>
            {a.rotulo}
            {a.id === 'interacoes' && totalInter > 0 && <span className="text-[11px] text-acento">{totalInter}</span>}
          </button>
        ))}
      </div>
      <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto">
        {estado.abaDireita === 'interacoes' ? (
          <AbaInteracoes editor={editor} assets={mapa} />
        ) : estado.abaDireita === 'animacao' ? (
          <AbaAnimacao editor={editor} />
        ) : nada ? (
          <InspetorTela editor={editor} assets={assets} />
        ) : (
          <AbaDesign editor={editor} assets={assets} />
        )}
      </div>
    </aside>
  )
}
