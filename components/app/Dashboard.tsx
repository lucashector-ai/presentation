'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, Copy, FolderOpen, MoreHorizontal, Pencil, Play, Search, Share2, Trash2 } from 'lucide-react'
import { atualizarProjeto, criarProjeto, duplicarProjeto, ErroDemo, excluirProjeto, listarProjetos } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import type { Projeto } from '@/lib/demo/tipos'
import { FORMATOS } from '@/lib/scene/schema'
import { MiniaturaCena } from '@/components/editor/MiniaturaCena'
import { Abas, Botao, Campo, Entrada, EstadoVazio, Modal, ModalConfirmar, Selo, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

type Filtro = 'todos' | 'recentes' | 'arquivados'

export function Dashboard() {
  const router = useRouter()
  const params = useSearchParams()
  const { mostrar } = useToast()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ tipo: 'arquivar' | 'excluir'; projeto: Projeto } | null>(null)
  const versao = useDemo((e) => e.projetos)
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))

  useEffect(() => { if (params.get('novo') === '1') setNovo(true) }, [params])

  const projetos = useMemo(() => {
    void versao
    const lista = listarProjetos({ q: busca, status: filtro === 'arquivados' ? 'archived' : 'all' })
    if (filtro === 'recentes') return lista.slice(0, 6)
    return lista
  }, [versao, busca, filtro])

  const agir = (fn: () => void, msg?: string) => {
    try { fn(); if (msg) mostrar(msg, 'sucesso') } catch (e) { mostrar(e instanceof ErroDemo ? e.message : 'Algo deu errado.', 'erro', e instanceof ErroDemo && e.code === 'limite_do_plano' ? { rotulo: 'Ver planos', aoClicar: () => router.push('/app/settings') } : undefined) }
    setMenu(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Projetos</h1>
        <span className="flex-1" />
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto2" />
          <Entrada aria-label="Buscar projetos" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-56 pl-9" />
        </label>
        <Abas rotulo="Filtro" valor={filtro} onChange={setFiltro} opcoes={[{ id: 'todos', rotulo: 'Todos' }, { id: 'recentes', rotulo: 'Recentes' }, { id: 'arquivados', rotulo: 'Arquivados' }]} />
      </div>

      {projetos.length === 0 ? (
        <EstadoVazio icone={<FolderOpen className="h-5 w-5" />} titulo={busca ? 'Nada encontrado' : filtro === 'arquivados' ? 'Nenhum projeto arquivado' : 'Seu próximo projeto começa aqui.'} descricao={busca ? 'Tente outro termo.' : 'Arraste imagens ou crie a primeira tela.'} acao={!busca && filtro !== 'arquivados' ? <Botao onClick={() => setNovo(true)}>Criar projeto</Botao> : undefined} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projetos.map((p) => {
            const capa = p.documento.scenes[0]
            return (
              <li key={p.id} className="group relative rounded-2xl border bg-superficie p-3 transition-shadow hover:shadow-suave">
                <Link href={`/app/projects/${p.id}`} className="block">
                  <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-superficie2">
                    {capa && <MiniaturaCena cena={capa} assets={assets} largura={p.modo === 'story' ? 150 : 336} className="border-0" />}
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{p.nome}</h3>
                      <p className="text-xs text-texto2">Editado {formatarRelativo(p.atualizadoEm)} · {p.documento.scenes.length} cena(s)</p>
                    </div>
                    <Selo tom={p.status === 'published' ? 'sucesso' : p.status === 'archived' ? 'neutro' : 'aviso'}>{{ draft: 'rascunho', published: 'publicado', archived: 'arquivado' }[p.status]}</Selo>
                  </div>
                </Link>
                <div className="absolute right-4 top-4">
                  <button aria-label={`Ações de ${p.nome}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)} className={cx('rounded-lg bg-superficie/90 p-1.5 shadow-sm hover:bg-superficie', menu !== p.id && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}><MoreHorizontal className="h-4 w-4" /></button>
                  {menu === p.id && (
                    <div role="menu" className="absolute right-0 z-10 mt-1 w-48 rounded-xl border bg-superficie p-1 text-sm shadow-suave">
                      <Item icone={<Pencil />} onClick={() => router.push(`/app/projects/${p.id}/edit`)}>Editar</Item>
                      <Item icone={<Play />} onClick={() => router.push(`/app/projects/${p.id}/apresentar`)}>Apresentar</Item>
                      <Item icone={<Share2 />} onClick={() => router.push(`/app/projects/${p.id}/share`)}>Compartilhar</Item>
                      <Item icone={<Copy />} onClick={() => agir(() => duplicarProjeto(p.id), 'Projeto duplicado.')}>Duplicar</Item>
                      {p.status === 'archived'
                        ? <Item icone={<Archive />} onClick={() => agir(() => atualizarProjeto(p.id, { status: 'draft' }), 'Projeto restaurado.')}>Restaurar</Item>
                        : <Item icone={<Archive />} onClick={() => { setConfirmar({ tipo: 'arquivar', projeto: p }); setMenu(null) }}>Arquivar</Item>}
                      <Item icone={<Trash2 />} perigo onClick={() => { setConfirmar({ tipo: 'excluir', projeto: p }); setMenu(null) }}>Excluir</Item>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <NovoProjeto aberto={novo} aoFechar={() => { setNovo(false); if (params.get('novo')) router.replace('/app') }} />

      <ModalConfirmar
        aberto={!!confirmar}
        aoFechar={() => setConfirmar(null)}
        titulo={confirmar?.tipo === 'excluir' ? 'Excluir definitivamente?' : 'Arquivar projeto?'}
        descricao={confirmar?.tipo === 'excluir' ? `“${confirmar.projeto.nome}” e seus links serão removidos. Esta ação não pode ser desfeita.` : `“${confirmar?.projeto.nome}” sai da lista principal. Links ativos continuam funcionando.`}
        rotuloConfirmar={confirmar?.tipo === 'excluir' ? 'Excluir' : 'Arquivar'}
        perigoso={confirmar?.tipo === 'excluir'}
        aoConfirmar={() => { if (!confirmar) return; const { tipo, projeto } = confirmar; setConfirmar(null); agir(() => (tipo === 'excluir' ? excluirProjeto(projeto.id) : atualizarProjeto(projeto.id, { status: 'archived' })), tipo === 'excluir' ? 'Projeto excluído.' : 'Projeto arquivado.') }}
      />
    </div>
  )
}

function Item({ icone, children, onClick, perigo }: { icone: React.ReactNode; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-superficie2 [&>svg]:h-4 [&>svg]:w-4', perigo && 'text-perigo')}>
      {icone} {children}
    </button>
  )
}

export function NovoProjeto({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const router = useRouter()
  const { mostrar } = useToast()
  const [nome, setNome] = useState('')
  const [formato, setFormato] = useState<keyof typeof FORMATOS>('slides169')
  const [erro, setErro] = useState<string | null>(null)
  const criar = () => {
    try {
      const p = criarProjeto({ nome, modo: formato === 'story' ? 'story' : 'slides', formato })
      aoFechar()
      router.push(`/app/projects/${p.id}/edit`)
    } catch (e) {
      const msg = e instanceof ErroDemo ? e.message : 'Não foi possível criar.'
      setErro(msg)
      if (e instanceof ErroDemo && e.code === 'limite_do_plano') mostrar(msg, 'info', { rotulo: 'Ver planos', aoClicar: () => router.push('/app/settings') })
    }
  }
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo projeto" rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao onClick={criar}>Criar e abrir editor</Botao></>}>
      <div className="space-y-4">
        <Campo rotulo="Nome" erro={erro ?? undefined}><Entrada autoFocus value={nome} onChange={(e) => { setNome(e.target.value); setErro(null) }} placeholder="Ex.: Identidade visual — Cliente" onKeyDown={(e) => e.key === 'Enter' && criar()} /></Campo>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Formato</legend>
          <div className="grid grid-cols-3 gap-2">
            {([['slides169', 'Slides 16:9', 'aspect-video'], ['slides43', 'Slides 4:3', 'aspect-[4/3]'], ['story', 'Story vertical', 'aspect-[9/16] max-h-20']] as const).map(([id, rotulo, cls]) => (
              <button key={id} type="button" onClick={() => setFormato(id)} aria-pressed={formato === id} className={cx('flex flex-col items-center gap-2 rounded-xl border p-3 text-xs hover:bg-superficie2', formato === id && 'border-texto bg-superficie2')}>
                <span className={cx('w-full rounded bg-texto/80', cls)} style={{ maxWidth: id === 'story' ? 36 : undefined }} />
                {rotulo}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}

export function formatarRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d} dia(s)`
  return new Date(iso).toLocaleDateString('pt-BR')
}
