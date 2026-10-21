'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, Copy, FolderOpen, MoreHorizontal, Pencil, Play, Plus, Search, Share2, Trash2 } from 'lucide-react'
import { atualizarProjeto, duplicarProjeto, ErroDemo, excluirProjeto } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import type { Projeto } from '@/lib/demo/tipos'
import { estadoDoLink } from '@/lib/share/token'
import { CapaProjeto } from './CapaProjeto'
import { EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { abrirApresentacao } from '@/components/viewer/retorno'

type Filtro = 'todos' | 'recentes' | 'rascunhos' | 'publicados' | 'privados' | 'arquivados'

/** Status exibido no card: Publicado (link ativo), Privado (publicado sem link aberto), Rascunho. */
export function statusExibido(p: Projeto, linksAtivos: Set<string>): { rotulo: string; cor: string } {
  if (p.status === 'archived') return { rotulo: 'Arquivado', cor: '#A3A3A3' }
  if (p.status === 'draft' || p.revisaoPublicada == null) return { rotulo: 'Rascunho', cor: '#A3A3A3' }
  return linksAtivos.has(p.id) ? { rotulo: 'Publicado', cor: '#22A06B' } : { rotulo: 'Privado', cor: '#5965F2' }
}

export function formatarRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'Editado agora'
  if (min < 60) return `Editado há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return 'Editado hoje'
  if (h < 48) return 'Editado ontem'
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Dashboard() {
  const router = useRouter()
  const params = useSearchParams()
  const { mostrar } = useToast()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ tipo: 'arquivar' | 'excluir'; projeto: Projeto } | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const projetosTodos = useDemo((e) => e.projetos)
  const links = useDemo((e) => e.links)
  const usuario = useDemo((e) => e.usuario)
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const linksAtivos = useMemo(() => new Set(links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo').map((l) => l.projectId)), [links])

  useEffect(() => { if (params.get('novo') === '1') router.replace('/app/novo') }, [params, router])
  useEffect(() => { if (params.get('filtro') === 'meus') setFiltro('todos') }, [params])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); buscaRef.current?.focus() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const projetos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let lista = projetosTodos.filter((p) => !p.excluidoEm).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
    lista = filtro === 'arquivados' ? lista.filter((p) => p.status === 'archived') : lista.filter((p) => p.status !== 'archived')
    if (filtro === 'recentes') lista = lista.slice(0, 6)
    if (filtro === 'rascunhos') lista = lista.filter((p) => statusExibido(p, linksAtivos).rotulo === 'Rascunho')
    if (filtro === 'publicados') lista = lista.filter((p) => statusExibido(p, linksAtivos).rotulo === 'Publicado')
    if (filtro === 'privados') lista = lista.filter((p) => statusExibido(p, linksAtivos).rotulo === 'Privado')
    if (q) lista = lista.filter((p) => p.nome.toLowerCase().includes(q) || p.cliente?.toLowerCase().includes(q))
    return lista
  }, [projetosTodos, filtro, busca, linksAtivos])

  const agir = (fn: () => void, msg?: string) => {
    try { fn(); if (msg) mostrar(msg, 'sucesso') } catch (e) { mostrar(e instanceof ErroDemo ? e.message : 'Algo deu errado.', 'erro', e instanceof ErroDemo && e.code === 'limite_do_plano' ? { rotulo: 'Ver planos', aoClicar: () => router.push('/app/settings') } : undefined) }
    setMenu(null)
  }

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const filtros: { id: Filtro; rotulo: string }[] = [{ id: 'todos', rotulo: 'Todos' }, { id: 'recentes', rotulo: 'Recentes' }, { id: 'rascunhos', rotulo: 'Rascunhos' }, { id: 'publicados', rotulo: 'Publicados' }, { id: 'privados', rotulo: 'Privados' }, { id: 'arquivados', rotulo: 'Arquivados' }]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="rotulo-mono">{hoje}</div>
          <h1 className="titulo-display mt-2.5 text-[40px]">{saudacao()}, {usuario.nome.split(' ')[0]}.</h1>
        </div>
        <div className="flex gap-2.5">
          <Link href="/criar" className="flex h-10 items-center gap-2 rounded-[9px] border-[1.5px] border-bordaForte bg-superficie px-4 text-[14px] font-medium hover:border-acento hover:text-acento"><span className="h-2 w-2 rounded-full bg-acento" />Criar com IA</Link>
          <Link href="/app/novo" className="flex h-10 items-center gap-2 rounded-[9px] bg-grafite px-4 text-[14px] font-medium text-fundo hover:bg-[#2a2a2a]"><Plus className="h-4 w-4" strokeWidth={2} />Novo projeto</Link>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-borda pb-4">
        <div className="flex flex-wrap gap-1 text-[14px]" role="tablist" aria-label="Filtrar projetos">
          {filtros.map((f) => (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} className={cx('rounded-full px-3 py-1.5 transition-colors', filtro === f.id ? 'bg-grafite text-fundo' : 'text-texto2 hover:text-texto')}>{f.rotulo}</button>
          ))}
        </div>
        <label className="flex h-9 w-[280px] max-w-full items-center gap-2 rounded-[9px] border border-[#E7E5E4] bg-superficie px-3">
          <Search className="h-[15px] w-[15px] text-texto3" strokeWidth={1.75} />
          <input ref={buscaRef} aria-label="Buscar projetos" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projetos" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-texto3" />
          <kbd className="mono rounded border border-borda px-1.5 text-[10px] text-texto3">⌘K</kbd>
        </label>
      </div>

      {projetos.length === 0 ? (
        <div className="mt-10">
          <EstadoVazio icone={<FolderOpen className="h-5 w-5" />} titulo={busca ? 'Nada encontrado' : 'Seu próximo projeto começa aqui.'} descricao={busca ? 'Tente outro termo.' : 'Crie do zero, importe suas artes ou peça para a IA montar o roteiro.'} acao={!busca ? <div className="flex gap-2"><Link href="/app/novo" className="rounded-[9px] bg-grafite px-4 py-2.5 text-[14px] font-medium text-fundo">Novo projeto</Link><Link href="/criar" className="rounded-[9px] border-[1.5px] border-bordaForte px-4 py-2.5 text-[14px] font-medium">Criar com IA</Link></div> : undefined} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {projetos.map((p) => {
            const capa = p.documento.scenes[0]
            const st = statusExibido(p, linksAtivos)
            return (
              <li key={p.id} className="group relative">
                <Link href={`/app/projects/${p.id}`} className="block">
                  <div className="overflow-hidden rounded-[8px] border border-black/5 transition-transform duration-normal group-hover:-translate-y-0.5 group-hover:shadow-suave">
                    {capa && <CapaProjeto cena={capa} assets={assets} />}
                  </div>
                  <div className="mt-3.5 pr-8">
                    <h3 className="truncate text-[15px] font-medium tracking-[-0.01em]">{p.nome}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-texto3">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.cor }} />
                      <span style={{ color: st.cor === '#A3A3A3' ? undefined : st.cor }}>{st.rotulo}</span>
                      <span>·</span>
                      <span>{formatarRelativo(p.atualizadoEm)}</span>
                    </p>
                  </div>
                </Link>
                <div className="absolute bottom-6 right-0">
                  <button aria-label={`Ações de ${p.nome}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-md p-1.5 text-texto3 hover:bg-hover hover:text-texto"><MoreHorizontal className="h-4 w-4" /></button>
                  {menu === p.id && (
                    <div role="menu" className="absolute bottom-9 right-0 z-10 w-48 rounded-lg border border-borda bg-superficie p-1 text-[13px] shadow-painel" onMouseLeave={() => setMenu(null)}>
                      <Item icone={<Pencil />} onClick={() => router.push(`/app/projects/${p.id}/edit`)}>Editar</Item>
                      <Item icone={<Play />} onClick={() => abrirApresentacao(router, p.id)}>Apresentar</Item>
                      <Item icone={<Share2 />} onClick={() => router.push(`/app/projects/${p.id}/share`)}>Compartilhar</Item>
                      <Item icone={<Copy />} onClick={() => agir(() => duplicarProjeto(p.id), 'Projeto duplicado.')}>Duplicar</Item>
                      {p.status === 'archived'
                        ? <Item icone={<Archive />} onClick={() => agir(() => atualizarProjeto(p.id, { status: p.revisaoPublicada ? 'published' : 'draft' }), 'Projeto restaurado.')}>Restaurar</Item>
                        : <Item icone={<Archive />} onClick={() => { setConfirmar({ tipo: 'arquivar', projeto: p }); setMenu(null) }}>Arquivar</Item>}
                      <Item icone={<Trash2 />} perigo onClick={() => { setConfirmar({ tipo: 'excluir', projeto: p }); setMenu(null) }}>Mover para a lixeira</Item>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ModalConfirmar
        aberto={!!confirmar}
        aoFechar={() => setConfirmar(null)}
        titulo={confirmar?.tipo === 'excluir' ? 'Mover para a lixeira?' : 'Arquivar projeto?'}
        descricao={confirmar?.tipo === 'excluir' ? `“${confirmar.projeto.nome}” vai para a lixeira e os links param de funcionar. Você pode restaurar depois.` : `“${confirmar?.projeto.nome}” sai da lista principal. Links ativos continuam funcionando.`}
        rotuloConfirmar={confirmar?.tipo === 'excluir' ? 'Mover para a lixeira' : 'Arquivar'}
        perigoso={confirmar?.tipo === 'excluir'}
        aoConfirmar={() => { if (!confirmar) return; const { tipo, projeto } = confirmar; setConfirmar(null); agir(() => (tipo === 'excluir' ? excluirProjeto(projeto.id) : atualizarProjeto(projeto.id, { status: 'archived' })), tipo === 'excluir' ? 'Projeto movido para a lixeira.' : 'Projeto arquivado.') }}
      />
    </div>
  )
}

function Item({ icone, children, onClick, perigo }: { icone: React.ReactNode; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-hover [&>svg]:h-4 [&>svg]:w-4', perigo && 'text-perigo')}>
      {icone} {children}
    </button>
  )
}
