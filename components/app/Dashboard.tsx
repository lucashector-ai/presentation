'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, ArrowRight, Check, Copy, Eye, FolderOpen, LayoutTemplate, MoreHorizontal, Pencil, Play, Plus, Search, Send, Share2, Sparkles, Trash2, Upload } from 'lucide-react'
import { dados, ehErroDados, mensagemDeErro, telasDo, useCarregar, useDados, type AssetDemo, type Projeto } from '@/lib/dados'
import { estadoDoLink } from '@/lib/share/token'
import { textoTelas } from '@/lib/telasIa'
import { CHAVE_PEDIDO_COLADO } from './criar/estado'
import { CapaProjeto } from './CapaProjeto'
import { CartaoCreditos } from './Creditos'
import { CarregandoBloco, EstadoErro, EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { abrirApresentacao } from '@/components/viewer/retorno'

type Filtro = 'todos' | 'rascunhos' | 'publicados' | 'enviados' | 'arquivados'
type Status = { rotulo: 'Rascunho' | 'Publicado' | 'Enviado' | 'Arquivado'; cor: string; dica: string }

/**
 * Status exibido no card:
 * Rascunho (nunca publicado) → Publicado (revisão pronta, sem link ativo) → Enviado (há link ativo com o cliente).
 */
export function statusExibido(p: Projeto, linksAtivos: Set<string>): Status {
  if (p.status === 'archived') return { rotulo: 'Arquivado', cor: '#A3A3A3', dica: 'Fora da lista principal; links continuam funcionando.' }
  if (p.status === 'draft' || p.revisaoPublicada == null) return { rotulo: 'Rascunho', cor: '#A3A3A3', dica: 'Ainda não publicado: ninguém além de você vê.' }
  return linksAtivos.has(p.id) ? { rotulo: 'Enviado', cor: '#22A06B', dica: 'Há um link ativo com o cliente.' } : { rotulo: 'Publicado', cor: '#5965F2', dica: 'Publicado, mas sem link ativo. Gere um link em Compartilhar.' }
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

const temAlteracoes = (p: Projeto) => p.revisaoPublicada != null && p.revisaoAtual > p.revisaoPublicada

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function Dashboard() {
  const router = useRouter()
  const params = useSearchParams()
  const { mostrar } = useToast()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [ordem, setOrdem] = useState<'recentes' | 'nome'>('recentes')
  const [busca, setBusca] = useState('')
  const [menu, setMenu] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<{ tipo: 'arquivar' | 'excluir'; projeto: Projeto } | null>(null)
  const { carregando, erro, tentarDeNovo } = useCarregar(['projetos', 'links', 'assets'])
  const projetosTodos = useDados((e) => e.projetos)
  const links = useDados((e) => e.links)
  const usuario = useDados((e) => e.usuario)
  const assets = useDados((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const linksAtivos = useMemo(() => new Set(links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo').map((l) => l.projectId)), [links])

  useEffect(() => { if (params.get('novo') === '1') router.replace('/app/novo') }, [params, router])
  useEffect(() => {
    const f = params.get('filtro')
    if (f && ['todos', 'rascunhos', 'publicados', 'enviados', 'arquivados'].includes(f)) setFiltro(f as Filtro)
  }, [params])
  useEffect(() => {
    if (!menu) return
    const fechar = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement).closest('[data-menu-projeto]')) setMenu(null) }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', fechar)
    return () => { document.removeEventListener('mousedown', fechar); document.removeEventListener('keydown', fechar) }
  }, [menu])

  const vivos = useMemo(() => projetosTodos.filter((p) => !p.excluidoEm).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)), [projetosTodos])
  const contagem = useMemo(() => {
    const ativos = vivos.filter((p) => p.status !== 'archived')
    const st = (r: Status['rotulo']) => ativos.filter((p) => statusExibido(p, linksAtivos).rotulo === r).length
    return { todos: ativos.length, rascunhos: st('Rascunho'), publicados: st('Publicado'), enviados: st('Enviado'), arquivados: vivos.length - ativos.length }
  }, [vivos, linksAtivos])

  const projetos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let lista = filtro === 'arquivados' ? vivos.filter((p) => p.status === 'archived') : vivos.filter((p) => p.status !== 'archived')
    if (filtro === 'rascunhos') lista = lista.filter((p) => statusExibido(p, linksAtivos).rotulo === 'Rascunho')
    if (filtro === 'publicados') lista = lista.filter((p) => statusExibido(p, linksAtivos).rotulo === 'Publicado')
    if (filtro === 'enviados') lista = lista.filter((p) => statusExibido(p, linksAtivos).rotulo === 'Enviado')
    if (q) lista = lista.filter((p) => p.nome.toLowerCase().includes(q) || p.cliente?.toLowerCase().includes(q))
    if (ordem === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return lista
  }, [vivos, filtro, busca, linksAtivos, ordem])

  const agir = async (fn: () => Promise<unknown>, msg?: string, desfazer?: () => void) => {
    setMenu(null)
    try {
      await fn()
      if (msg) mostrar(msg, 'sucesso', desfazer ? { rotulo: 'Desfazer', aoClicar: desfazer } : undefined)
    } catch (e) {
      mostrar(mensagemDeErro(e), 'erro', ehErroDados(e, 'limite_do_plano') ? { rotulo: 'Ver planos', aoClicar: () => router.push('/app/settings#plano') } : undefined)
    }
  }

  const novo = !carregando && !erro && vivos.length === 0
  // o Shell só renderiza o painel no navegador (depois de checar a sessão), então data e hora locais são seguras aqui
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const filtros: { id: Filtro; rotulo: string }[] = [{ id: 'todos', rotulo: 'Todos' }, { id: 'rascunhos', rotulo: 'Rascunhos' }, { id: 'publicados', rotulo: 'Publicados' }, { id: 'enviados', rotulo: 'Enviados' }, { id: 'arquivados', rotulo: 'Arquivados' }]

  return (
    <div className="mx-auto max-w-[1240px]">
      <div>
        <div className="rotulo-mono">{hoje}</div>
        <h1 className="titulo-display mt-2.5 text-[32px] sm:text-[40px]">{saudacao()}, {usuario.nome.split(' ')[0]}.</h1>
        {novo && <p className="mt-2 text-[15px] text-texto2">Vamos criar sua primeira apresentação. Escolha um jeito de começar.</p>}
      </div>

      <section aria-label="Começar uma apresentação" className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <CriarComIARapido />
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Atalho href="/app/novo" icone={<Plus />} titulo="Novo projeto" texto="Em branco, no formato que quiser" />
          <Atalho href="/app/novo?comeco=template" icone={<LayoutTemplate />} titulo="Usar template" texto="Estruturas prontas para editar" />
          <Atalho href="/app/novo?passo=arquivos" icone={<Upload />} titulo="Importar arquivos" texto="Figma, Illustrator, Blender, fotos" />
        </div>
      </section>

      {novo ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <PrimeirosPassos />
          <CartaoCreditos />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Continuar projeto={vivos.find((p) => p.status !== 'archived')} assets={assets} />
          <ResumoEnviados />
          <CartaoCreditos className="md:col-span-2 xl:col-span-1" />
        </div>
      )}

      {!novo && <PrimeirosPassos compacto />}

      <section id="projetos" aria-labelledby="titulo-projetos" className="mt-12 scroll-mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="titulo-projetos" className="text-[20px] font-medium tracking-[-0.02em]">Projetos</h2>
          <div className="flex items-center gap-2">
            <label className="flex h-9 w-[220px] max-w-full items-center gap-2 rounded-[9px] border border-[#E7E5E4] bg-superficie px-3 focus-within:border-acento">
              <Search className="h-[15px] w-[15px] text-texto3" strokeWidth={1.75} />
              <input aria-label="Buscar projetos" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome ou cliente" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-texto3 focus-visible:outline-none" />
            </label>
            <select aria-label="Ordenar projetos" value={ordem} onChange={(e) => setOrdem(e.target.value as 'recentes' | 'nome')} className="h-9 rounded-[9px] border border-[#E7E5E4] bg-superficie px-2 text-[13px] text-texto2 outline-none">
              <option value="recentes">Mais recentes</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </div>
        </div>
        <div className="-mx-4 mt-4 overflow-x-auto border-b border-borda px-4 pb-3 sm:mx-0 sm:px-0">
          <div className="flex gap-1 whitespace-nowrap text-[14px]" role="tablist" aria-label="Filtrar projetos">
            {filtros.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors', filtro === f.id ? 'bg-grafite text-fundo' : 'text-texto2 hover:text-texto')}>
                {f.rotulo}<span className={cx('text-[12px]', filtro === f.id ? 'text-fundo/60' : 'text-texto3')}>{contagem[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {erro && !vivos.length ? (
          <div className="mt-8"><EstadoErro titulo="Não foi possível carregar seus projetos" mensagem={erro} aoTentar={tentarDeNovo} /></div>
        ) : carregando && !vivos.length ? (
          <CarregandoBloco texto="Carregando projetos…" className="mt-8" />
        ) : projetos.length === 0 ? (
          <div className="mt-8">
            <EstadoVazio
              icone={<FolderOpen className="h-5 w-5" />}
              titulo={busca ? 'Nada encontrado' : novo ? 'Nenhum projeto ainda' : 'Nenhum projeto neste filtro'}
              descricao={busca ? 'Tente outro nome ou cliente.' : novo ? 'Use um dos caminhos acima: a IA monta uma apresentação a partir de uma frase, ou comece do zero.' : 'Troque o filtro para ver os outros projetos.'}
              acao={busca ? <button onClick={() => setBusca('')} className="rounded-[9px] border-[1.5px] border-bordaForte px-4 py-2 text-[14px] font-medium">Limpar busca</button> : !novo ? <button onClick={() => setFiltro('todos')} className="rounded-[9px] border-[1.5px] border-bordaForte px-4 py-2 text-[14px] font-medium">Ver todos</button> : undefined}
            />
          </div>
        ) : (
          <ul className="mt-7 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {projetos.map((p) => {
              const capa = p.documento.scenes[0]
              const st = statusExibido(p, linksAtivos)
              const telas = telasDo(p)
              return (
                <li key={p.id} className="group relative">
                  <Link href={`/app/projects/${p.id}`} className="block">
                    <div className="overflow-hidden rounded-[8px] border border-black/5 transition-transform duration-normal group-hover:-translate-y-0.5 group-hover:shadow-suave">
                      {capa && <CapaProjeto cena={capa} assets={assets} proporcao={16 / 10} />}
                    </div>
                    <div className="mt-3.5 pr-8">
                      <h3 className="truncate text-[15px] font-medium tracking-[-0.01em]">{p.nome}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-texto3">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.cor }} />
                        <span title={st.dica} style={{ color: st.cor === '#A3A3A3' ? undefined : st.cor }}>{st.rotulo}</span>
                        <span>·</span>
                        <span>{telas} {telas === 1 ? 'tela' : 'telas'}</span>
                        <span>·</span>
                        <span>{formatarRelativo(p.atualizadoEm)}</span>
                        {temAlteracoes(p) && <span className="text-[#B7791F]" title="O link mostra a última revisão publicada">· alterações não publicadas</span>}
                      </p>
                    </div>
                  </Link>
                  <div className="absolute bottom-6 right-0" data-menu-projeto>
                    <button aria-label={`Ações de ${p.nome}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-md p-1.5 text-texto3 hover:bg-hover hover:text-texto"><MoreHorizontal className="h-4 w-4" /></button>
                    {menu === p.id && (
                      <div role="menu" className="absolute bottom-9 right-0 z-10 w-52 rounded-lg border border-borda bg-superficie p-1 text-[13px] shadow-painel">
                        <Item icone={<Pencil />} onClick={() => router.push(`/app/projects/${p.id}/edit`)}>Editar</Item>
                        <Item icone={<Play />} onClick={() => abrirApresentacao(router, p.id)}>Apresentar</Item>
                        <Item icone={<Share2 />} onClick={() => router.push(`/app/projects/${p.id}/share`)}>Compartilhar</Item>
                        <Item icone={<Copy />} onClick={() => void agir(() => dados.duplicarProjeto(p.id), 'Projeto duplicado.')}>Duplicar</Item>
                        {p.status === 'archived'
                          ? <Item icone={<Archive />} onClick={() => void agir(() => dados.atualizarProjeto(p.id, { status: p.revisaoPublicada ? 'published' : 'draft' }), 'Projeto restaurado.')}>Restaurar</Item>
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
      </section>

      <ModalConfirmar
        aberto={!!confirmar}
        aoFechar={() => setConfirmar(null)}
        titulo={confirmar?.tipo === 'excluir' ? 'Mover para a lixeira?' : 'Arquivar projeto?'}
        descricao={confirmar?.tipo === 'excluir' ? `“${confirmar.projeto.nome}” vai para a lixeira e os links param de funcionar. Você pode restaurar o projeto depois.` : `“${confirmar?.projeto.nome}” sai da lista principal. Links ativos continuam funcionando.`}
        rotuloConfirmar={confirmar?.tipo === 'excluir' ? 'Mover para a lixeira' : 'Arquivar'}
        perigoso={confirmar?.tipo === 'excluir'}
        aoConfirmar={() => {
          if (!confirmar) return
          const { tipo, projeto } = confirmar
          setConfirmar(null)
          if (tipo === 'excluir') void agir(() => dados.excluirProjeto(projeto.id), 'Projeto movido para a lixeira.')
          else void agir(() => dados.atualizarProjeto(projeto.id, { status: 'archived' }), 'Projeto arquivado.', () => void agir(() => dados.atualizarProjeto(projeto.id, { status: projeto.status })))
        }}
      />
    </div>
  )
}

/** Atalho de criação (em branco, template, importar). */
function Atalho({ href, icone, titulo, texto }: { href: string; icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-xl border border-borda bg-superficie p-3 transition-colors hover:border-grafite sm:p-4 lg:flex-row lg:items-center lg:gap-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-hover text-texto [&>svg]:h-4 [&>svg]:w-4">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-tight">{titulo}</span>
        <span className="mt-0.5 hidden text-[12px] leading-snug text-texto2 sm:block">{texto}</span>
      </span>
      <ArrowRight className="hidden h-4 w-4 text-texto3 transition-transform group-hover:translate-x-0.5 group-hover:text-texto lg:block" />
    </Link>
  )
}

/**
 * Atalho do painel para o "Criar com IA": um cartão limpo, com uma linha opcional para a ideia e o botão. O pedido
 * de verdade (briefing longo, estrutura, dados) é escrito no editor grande da tela do Criar com IA. Colar um texto
 * longo aqui leva o texto inteiro para lá (nada é cortado).
 */
function CriarComIARapido() {
  const router = useRouter()
  const saldo = useDados((e) => e.creditos.saldo)
  const [ideia, setIdeia] = useState('')
  const abrir = (texto = ideia) => {
    const t = texto.trim()
    if (t.length > 200 || t.includes('\n')) {
      // texto longo colado: vai inteiro para o editor do Criar com IA (pela sessão do navegador, não pela URL)
      try { sessionStorage.setItem(CHAVE_PEDIDO_COLADO, t) } catch { /* sem armazenamento: segue sem o texto */ }
      return router.push('/app/criar?colado=1')
    }
    router.push(t ? `/app/criar?${new URLSearchParams({ prompt: t })}` : '/app/criar')
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); abrir() }} aria-labelledby="titulo-criar-ia" className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border-[1.5px] border-grafite bg-superficie p-4 shadow-[4px_4px_0_#5965F2] sm:p-5 sm:shadow-[5px_5px_0_#5965F2]">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h2 id="titulo-criar-ia" className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]"><span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-acento" />Criar apresentação com IA</h2>
          <p className="mt-1 max-w-[520px] text-[13px] leading-snug text-texto2">Descreva a ideia ou cole um briefing completo (estrutura de telas, dados, cores e regras) na próxima tela. Você revisa o roteiro antes do design.</p>
        </div>
        <span className="mono shrink-0 pt-1 text-[11px] text-texto3">saldo: {textoTelas(saldo)}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="painel-ideia" className="sr-only">Ideia da apresentação, opcional</label>
        <input
          id="painel-ideia"
          type="text"
          value={ideia}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => setIdeia(e.target.value)}
          onPaste={(e) => {
            const colado = e.clipboardData.getData('text')
            if (colado.length > 200 || colado.includes('\n')) { e.preventDefault(); abrir(`${ideia}${colado}`) }
          }}
          placeholder="Ideia em uma linha (opcional)"
          className="h-11 w-full min-w-0 flex-1 rounded-full border-[1.5px] border-borda bg-white px-4 text-[15px] outline-none placeholder:text-texto3 focus:border-grafite"
        />
        <button type="submit" className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-grafite bg-violeta px-5 text-[14px] font-semibold text-white hover:bg-[#4A55E0]">
          <Sparkles className="h-4 w-4" />Criar com IA<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}

function Continuar({ projeto, assets }: { projeto?: Projeto; assets: Record<string, AssetDemo> }) {
  const router = useRouter()
  if (!projeto) return null
  const capa = projeto.documento.scenes[0]
  return (
    <section aria-labelledby="titulo-continuar" className="flex flex-col rounded-xl border border-borda bg-superficie p-5">
      <h2 id="titulo-continuar" className="rotulo-mono">Continuar de onde parou</h2>
      <Link href={`/app/projects/${projeto.id}/edit`} className="mt-3 flex min-w-0 items-center gap-3.5">
        <div className="w-[104px] shrink-0 overflow-hidden rounded-md border border-black/5">{capa && <CapaProjeto cena={capa} assets={assets} proporcao={16 / 10} />}</div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium">{projeto.nome}</div>
          <div className="mt-0.5 text-[12px] text-texto3">{formatarRelativo(projeto.atualizadoEm)} · {telasDo(projeto)} telas</div>
        </div>
      </Link>
      <div className="mt-auto flex gap-2 pt-4">
        <Link href={`/app/projects/${projeto.id}/edit`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-grafite px-3 text-[13px] font-medium text-fundo hover:bg-[#2a2a2a]"><Pencil className="h-3.5 w-3.5" />Abrir no editor</Link>
        <button type="button" onClick={() => abrirApresentacao(router, projeto.id)} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border-[1.5px] border-bordaForte px-3 text-[13px] font-medium hover:border-[#D4D4D4]"><Play className="h-3.5 w-3.5" />Apresentar</button>
      </div>
    </section>
  )
}

/** O que foi enviado e como o cliente interagiu (links ativos, visualizações, revisões pendentes). */
function ResumoEnviados() {
  const resumo = useDados((e) => {
    const ativos = e.links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo')
    const porProjeto = new Map<string, { views: number; ultimo: string }>()
    for (const l of ativos) {
      const atual = porProjeto.get(l.projectId)
      porProjeto.set(l.projectId, { views: (atual?.views ?? 0) + l.visualizacoes, ultimo: atual && atual.ultimo > l.criadoEm ? atual.ultimo : l.criadoEm })
    }
    const itens = e.projetos.filter((p) => !p.excluidoEm && porProjeto.has(p.id)).map((p) => ({ p, ...porProjeto.get(p.id)! })).sort((a, b) => b.ultimo.localeCompare(a.ultimo))
    return { itens, views: itens.reduce((s, i) => s + i.views, 0) }
  })
  return (
    <section aria-labelledby="titulo-enviados" className="flex flex-col rounded-xl border border-borda bg-superficie p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-enviados" className="rotulo-mono">Enviados</h2>
        <Link href="/app/compartilhados" className="text-[12px] text-texto2 hover:text-texto">Ver todos</Link>
      </div>
      {resumo.itens.length === 0 ? (
        <p className="mt-3 text-[13px] text-texto2">Nada enviado ainda. Publique um projeto e gere um link em Compartilhar para acompanhar as visualizações aqui.</p>
      ) : (
        <>
          <div className="mt-3 flex gap-6">
            <div><div className="text-[28px] font-medium leading-none tracking-[-0.04em]">{resumo.itens.length}</div><div className="mt-1 text-[12px] text-texto2">{resumo.itens.length === 1 ? 'apresentação com link' : 'apresentações com link'}</div></div>
            <div><div className="text-[28px] font-medium leading-none tracking-[-0.04em]">{resumo.views}</div><div className="mt-1 text-[12px] text-texto2">visualizações</div></div>
          </div>
          <ul className="mt-3 divide-y divide-borda text-[13px]">
            {resumo.itens.slice(0, 3).map(({ p, views }) => (
              <li key={p.id}>
                <Link href={`/app/projects/${p.id}/share`} className="flex items-center gap-2 py-1.5 hover:text-acento">
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  {temAlteracoes(p) && <span className="shrink-0 text-[11px] text-[#B7791F]">não publicado</span>}
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-texto3"><Eye className="h-3 w-3" />{views}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Checklist de primeira vez: da conta criada até o cliente abrir a apresentação. Some quando tudo foi feito. */
function PrimeirosPassos({ compacto }: { compacto?: boolean }) {
  const passos = useDados((e) => {
    const vivos = e.projetos.filter((p) => !p.excluidoEm)
    const primeiro = vivos[0]
    const publicado = vivos.find((p) => p.revisaoPublicada != null)
    return [
      { feito: vivos.length > 0, titulo: 'Crie sua primeira apresentação', texto: 'Com IA, template ou importando suas artes.', href: '/app/criar' },
      { feito: !!publicado, titulo: 'Publique', texto: '“Publicar” congela uma revisão: é ela que o cliente vê.', href: primeiro ? `/app/projects/${primeiro.id}/share` : '/app/criar' },
      { feito: e.links.length > 0, titulo: 'Envie o link', texto: 'Link privado, com senha e validade opcionais.', href: publicado ? `/app/projects/${publicado.id}/share` : primeiro ? `/app/projects/${primeiro.id}/share` : '/app/criar' },
      { feito: e.links.some((l) => l.visualizacoes > 0), titulo: 'Veja quando o cliente abrir', texto: 'As visualizações aparecem em Enviados.', href: '/app/compartilhados' },
    ]
  })
  const feitos = passos.filter((p) => p.feito).length
  if (feitos === passos.length) return null
  if (compacto && feitos === 0) return null
  const proximo = passos.findIndex((p) => !p.feito)
  return (
    <section aria-labelledby="titulo-passos" className={cx('rounded-xl border border-borda bg-superficie p-5', compacto && 'mt-4')}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-passos" className="rotulo-mono">Primeiros passos · {feitos} de {passos.length}</h2>
        <div className="h-[3px] w-24 overflow-hidden rounded-sm bg-borda" aria-hidden><div className="h-full bg-sucesso" style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {passos.map((p, i) => (
          <li key={p.titulo}>
            <Link href={p.href} className={cx('flex h-full items-start gap-3 rounded-lg border p-3 transition-colors', i === proximo ? 'border-grafite' : 'border-borda hover:border-bordaForte', p.feito && 'opacity-60')}>
              <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold', p.feito ? 'border-sucesso bg-sucesso text-white' : i === proximo ? 'border-grafite' : 'border-[#D4D4D4] text-texto3')}>{p.feito ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className="min-w-0"><span className={cx('block text-[14px] font-medium', p.feito && 'line-through')}>{p.titulo}</span><span className="mt-0.5 block text-[12px] leading-snug text-texto2">{p.texto}</span></span>
              {i === proximo && <Send className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-texto3" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Item({ icone, children, onClick, perigo }: { icone: React.ReactNode; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-hover [&>svg]:h-4 [&>svg]:w-4', perigo && 'text-perigo')}>
      {icone} {children}
    </button>
  )
}
