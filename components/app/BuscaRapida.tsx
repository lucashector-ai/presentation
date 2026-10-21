'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CornerDownLeft, FilePlus2, Folder, Library, Search, Send, Settings2, Sparkles, Trash2, Wallet } from 'lucide-react'
import { useDados } from '@/lib/dados'
import { cx } from '@/components/ui'
import { useCreditos } from './Creditos'

interface Item { id: string; rotulo: string; dica?: string; grupo: 'Ações' | 'Projetos' | 'Ir para'; icone: React.ReactNode; executar: () => void }

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca rápida (⌘K / Ctrl+K): projetos, ações de criação e áreas do app, de qualquer tela com a barra lateral. */
export function BuscaRapida({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const router = useRouter()
  const { abrirCompra } = useCreditos()
  const projetos = useDados((e) => e.projetos.filter((p) => !p.excluidoEm).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)))
  const [q, setQ] = useState('')
  const [ativo, setAtivo] = useState(0)
  const entrada = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!aberta) return
    setQ('')
    setAtivo(0)
    const t = setTimeout(() => entrada.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [aberta])

  const itens = useMemo<Item[]>(() => {
    const ir = (href: string) => () => { aoFechar(); router.push(href) }
    const acoes: Item[] = [
      { id: 'ia', rotulo: 'Criar apresentação com IA', dica: q.trim() ? `“${q.trim().slice(0, 40)}”` : undefined, grupo: 'Ações', icone: <Sparkles />, executar: ir(q.trim() ? `/app/criar?${new URLSearchParams({ prompt: q.trim() })}` : '/app/criar') },
      { id: 'novo', rotulo: 'Novo projeto em branco', grupo: 'Ações', icone: <FilePlus2 />, executar: ir('/app/novo') },
      { id: 'template', rotulo: 'Novo projeto a partir de template', grupo: 'Ações', icone: <FilePlus2 />, executar: ir('/app/novo?comeco=template') },
      { id: 'importar', rotulo: 'Importar arquivos (Figma, Illustrator, Blender…)', grupo: 'Ações', icone: <FilePlus2 />, executar: ir('/app/novo?passo=arquivos') },
      { id: 'comprar', rotulo: 'Comprar créditos', grupo: 'Ações', icone: <Wallet />, executar: () => { aoFechar(); abrirCompra() } },
    ]
    const areas: Item[] = [
      { id: 'enviados', rotulo: 'Enviados', dica: 'links e visualizações', grupo: 'Ir para', icone: <Send />, executar: ir('/app/compartilhados') },
      { id: 'biblioteca', rotulo: 'Biblioteca', grupo: 'Ir para', icone: <Library />, executar: ir('/app/biblioteca') },
      { id: 'lixeira', rotulo: 'Lixeira', grupo: 'Ir para', icone: <Trash2 />, executar: ir('/app/lixeira') },
      { id: 'config', rotulo: 'Plano, créditos e conta', grupo: 'Ir para', icone: <Settings2 />, executar: ir('/app/settings') },
    ]
    const nq = normalizar(q.trim())
    const casa = (t: string) => !nq || normalizar(t).includes(nq)
    const projs: Item[] = projetos
      .filter((p) => casa(`${p.nome} ${p.cliente ?? ''}`))
      .slice(0, nq ? 8 : 5)
      .map((p) => ({ id: p.id, rotulo: p.nome, dica: p.cliente, grupo: 'Projetos', icone: <Folder />, executar: ir(`/app/projects/${p.id}`) }))
    // com texto digitado, "Criar com IA" continua disponível (vira o prompt); as demais ações filtram
    return [...projs, ...acoes.filter((a) => a.id === 'ia' || casa(a.rotulo)), ...areas.filter((a) => casa(a.rotulo))]
  }, [q, projetos, router, aoFechar, abrirCompra])

  useEffect(() => { setAtivo(0) }, [q])
  useEffect(() => { lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [ativo])

  if (!aberta) return null
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); aoFechar() }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(itens.length - 1, a + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(0, a - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); itens[ativo]?.executar() }
  }
  let grupoAnterior = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div role="dialog" aria-modal="true" aria-label="Busca rápida" className="w-full max-w-[560px] overflow-hidden rounded-xl border border-borda bg-superficie shadow-painel" onKeyDown={tecla}>
        <div className="flex items-center gap-2.5 border-b border-borda px-4">
          <Search className="h-4 w-4 text-texto3" />
          <input ref={entrada} role="combobox" aria-expanded aria-controls="busca-rapida-lista" aria-activedescendant={itens[ativo] ? `busca-${itens[ativo]!.id}` : undefined} aria-label="Buscar projetos e ações" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar projetos, criar, ir para…" className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-texto3 focus-visible:outline-none" />
          <kbd className="mono rounded border border-borda px-1.5 text-[10px] text-texto3">esc</kbd>
        </div>
        <ul ref={lista} id="busca-rapida-lista" role="listbox" aria-label="Resultados" className="max-h-[56vh] overflow-y-auto p-1.5">
          {itens.map((it, i) => {
            const cabecalho = it.grupo !== grupoAnterior ? it.grupo : null
            grupoAnterior = it.grupo
            return (
              <li key={`${it.grupo}-${it.id}`} role="presentation">
                {cabecalho && <div className="rotulo-mono px-2.5 pb-1 pt-2.5 text-[10px]">{cabecalho}</div>}
                <div id={`busca-${it.id}`} role="option" aria-selected={i === ativo} onMouseMove={() => setAtivo(i)} onClick={it.executar} className={cx('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-texto3', i === ativo && 'bg-hover')}>
                  {it.icone}
                  <span className="min-w-0 truncate">{it.rotulo}</span>
                  {it.dica && <span className="min-w-0 truncate text-[12px] text-texto3">{it.dica}</span>}
                  {i === ativo && <CornerDownLeft className="ml-auto" />}
                </div>
              </li>
            )
          })}
          {!itens.length && <li className="px-3 py-6 text-center text-[13px] text-texto2">Nada encontrado.</li>}
        </ul>
      </div>
    </div>
  )
}
