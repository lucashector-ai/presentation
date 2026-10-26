'use client'
/**
 * Menu suspenso "Estilo: Corporativo ▾" da apresentação gerada: os estilos agrupados por família, cada um com a
 * amostra (fundo da capa + destaque, já com as cores da marca) e, no fim, a galeria completa. Trocar é grátis.
 */
import { useEffect, useState } from 'react'
import { Check, ChevronDown, LayoutGrid } from 'lucide-react'
import { cx } from '@/components/ui'
import { NOMES_CATEGORIA, TEMAS, resolverTema, type Marca, type TemaId, type TemaVisual } from '@/lib/ia/designSystem'

const amostra = (t: TemaVisual, marca: Marca) => {
  const r = resolverTema(t.id, marca)
  return `linear-gradient(135deg, ${r.capa === 'escuro' ? r.escuro.fundo : r.claro.fundo} 50%, ${r.acento} 50%)`
}

export function MenuEstilos({ valor, aoEscolher, marca, aoVerGaleria, desativado }: { valor: TemaId; aoEscolher: (id: TemaId) => void; marca: Marca; aoVerGaleria: () => void; desativado?: boolean }) {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto])
  const temas = TEMAS as readonly TemaVisual[]
  const atual = temas.find((t) => t.id === valor) ?? temas[0]!
  // famílias na ordem da galeria; estilos sem família no fim
  const grupos = [...new Set(temas.map((t) => t.categoria ?? ''))].map((c) => ({ c, itens: temas.filter((t) => (t.categoria ?? '') === c) }))
  return (
    <div className="relative">
      <button type="button" disabled={desativado} aria-haspopup="true" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="flex h-9 items-center gap-2 rounded-full border border-borda bg-superficie pl-1.5 pr-3 text-[13px] hover:border-bordaForte disabled:opacity-40">
        <span className="h-6 w-6 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]" style={{ background: amostra(atual, marca) }} />
        <span className="text-texto3">Estilo</span>
        <span className="font-medium">{atual.nome}</span>
        <ChevronDown className={cx('h-3.5 w-3.5 text-texto3 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setAberto(false)} />
          <div className="absolute left-0 top-11 z-50 flex max-h-[min(460px,70vh)] w-[300px] flex-col overflow-hidden rounded-[14px] border border-borda bg-superficie shadow-painel">
            <div role="radiogroup" aria-label="Trocar estilo" className="min-h-0 flex-1 overflow-y-auto p-1.5 rolagem-fina">
              {grupos.map(({ c, itens }) => (
                <div key={c || 'outros'} className="pb-1">
                  <div className="rotulo-mono px-2 pb-1 pt-2">{c ? NOMES_CATEGORIA[c as keyof typeof NOMES_CATEGORIA] : 'Outros'}</div>
                  {itens.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={valor === t.id} title={t.descricao} onClick={() => { aoEscolher(t.id as TemaId); setAberto(false) }} className={cx('flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13px]', valor === t.id ? 'bg-acentoSuave text-texto' : 'hover:bg-hover')}>
                      <span className="h-5 w-5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]" style={{ background: amostra(t, marca) }} />
                      <span className="min-w-0 flex-1 truncate">{t.nome}</span>
                      {valor === t.id && <Check className="h-3.5 w-3.5 text-acento" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setAberto(false); aoVerGaleria() }} className="flex h-10 shrink-0 items-center gap-2 border-t border-borda px-3.5 text-[13px] font-medium text-texto2 hover:bg-hover hover:text-texto">
              <LayoutGrid className="h-3.5 w-3.5" />Ver a galeria com prévias
            </button>
          </div>
        </>
      )}
    </div>
  )
}
