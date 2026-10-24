'use client'
import { Component, memo, useDeferredValue, useMemo, type ReactNode } from 'react'
import type { Editor, AbaDireita } from '@/lib/editor/useEditor'
import type { AssetDemo } from '@/lib/demo/tipos'
import { cx } from '@/components/ui'
import { AbaDesign } from './AbaDesign'
import { AbaAnimacao } from './AbaAnimacao'
import { AbaInteracoes } from './AbaInteracoes'
import { InspetorTela } from './InspetorTela'
import { ProvedorInspetor } from './contexto'
import { useColarLink } from './SecoesMostra'

export function Inspetor({ editor, assets }: { editor: Editor; assets: AssetDemo[] }) {
  const { estado, acoes, camadasSelecionadas, cena } = editor
  // Ctrl+V com uma URL e camadas selecionadas = link nelas (a seção Link aparece no Design)
  useColarLink(editor)
  const mapa = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets])
  const totalInter = cena?.layers.filter((l) => l.interactions.length > 0).length ?? 0
  const abas: { id: AbaDireita; rotulo: string }[] = [{ id: 'design', rotulo: 'Design' }, { id: 'animacao', rotulo: 'Animação' }, { id: 'interacoes', rotulo: 'Interações' }]
  // trocar de aba: o botão marca na hora e o conteúdo novo vem logo depois (adiado), sem segurar a pintura do clique
  const aba = useDeferredValue(estado.abaDireita)
  return (
    <ProvedorInspetor editor={editor} assets={assets}>
      <aside aria-label="Propriedades" className="flex h-full flex-col border-l border-borda bg-superficie">
        <div role="tablist" aria-label="Painel de propriedades" className="flex shrink-0 gap-0.5 border-b border-borda p-2">
          {abas.map((a) => (
            <button key={a.id} role="tab" aria-selected={estado.abaDireita === a.id} onClick={() => acoes.ui({ abaDireita: a.id })} className={cx('flex flex-1 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-[13px] transition-colors', estado.abaDireita === a.id ? 'bg-hover font-medium text-texto' : 'text-texto2 hover:text-texto')}>
              {a.rotulo}
              {a.id === 'interacoes' && totalInter > 0 && <span className="text-[11px] text-acento">{totalInter}</span>}
            </button>
          ))}
        </div>
        <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto">
          <ConteudoAba aba={aba} editor={editor} assets={assets} mapa={mapa} />
        </div>
      </aside>
    </ProvedorInspetor>
  )
}

/**
 * Conteúdo da aba. Enquanto a aba adiada não alcança a escolhida (a passada urgente da troca), fica como estava: a
 * aba antiga não re-renderiza à toa e o clique pinta só a marcação do botão.
 */
const ConteudoAba = memo(function ConteudoAba({ aba, editor, assets, mapa }: { aba: AbaDireita; editor: Editor; assets: AssetDemo[]; mapa: Record<string, AssetDemo> }) {
  const { camadasSelecionadas } = editor
  if (aba === 'interacoes') return <AbaInteracoes editor={editor} assets={mapa} />
  if (aba === 'animacao') {
    return (
      <LimiteErro chave={camadasSelecionadas.map((c) => c.id).join(',')} alternativo={<p className="px-4 py-4 text-[12px] text-texto2">Não foi possível abrir as animações desta seleção. Selecione outro elemento ou recarregue a página.</p>}>
        <AbaAnimacao editor={editor} />
      </LimiteErro>
    )
  }
  return camadasSelecionadas.length === 0 ? <InspetorTela editor={editor} assets={assets} /> : <AbaDesign editor={editor} assets={assets} />
}, (a, b) => b.aba !== b.editor.estado.abaDireita || (a.aba === b.aba && a.editor === b.editor && a.assets === b.assets && a.mapa === b.mapa))

/** Isola falhas de uma aba (ex.: Animação sem seleção) sem derrubar o editor; reinicia quando a seleção muda. */
class LimiteErro extends Component<{ chave: string; alternativo: ReactNode; children: ReactNode }, { erro: boolean; chave: string }> {
  state = { erro: false, chave: this.props.chave }
  static getDerivedStateFromError() { return { erro: true } }
  static getDerivedStateFromProps(p: { chave: string }, s: { erro: boolean; chave: string }) {
    return p.chave !== s.chave ? { erro: false, chave: p.chave } : null
  }
  render() { return this.state.erro ? this.props.alternativo : this.props.children }
}
