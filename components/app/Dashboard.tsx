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
import { Botao, EstadoErro, EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { CabecalhoPagina, CartaoPainel, Esqueleto, FiltroFichas, Grade, PaginaPainel, SPAN, Secao } from './Layout'
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
  return linksAtivos.has(p.id) ? { rotulo: 'Enviado', cor: 'rgb(var(--cor-sucesso))', dica: 'Há um link ativo com o cliente.' } : { rotulo: 'Publicado', cor: 'rgb(var(--cor-acento))', dica: 'Publicado, mas sem link ativo. Gere um link em Compartilhar.' }
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

  const arquivados = contagem.arquivados

  return (
    <PaginaPainel>
      <CabecalhoPagina rotulo={hoje} titulo={`${saudacao()}, ${usuario.nome.split(' ')[0]}.`} descricao={novo ? 'Vamos criar sua primeira apresentação. Escolha um jeito de começar.' : undefined} />

      {/* um grid só para o topo e os cartões: as bordas da IA e dos atalhos batem com as dos cartões de baixo */}
      <Grade className={cx(novo && 'grid-flow-row-dense')}>
        <CriarComIARapido className={SPAN.doisTercos} />
        <nav aria-label="Outros jeitos de começar" className={cx(SPAN.terco, 'grid grid-rows-3 gap-4')}>
          <Atalho href="/app/novo" icone={<Plus />} titulo="Novo projeto" texto="Em branco, no formato que quiser" />
          <Atalho href="/app/novo?comeco=template" icone={<LayoutTemplate />} titulo="Usar template" texto="Estruturas prontas para editar" />
          <Atalho href="/app/novo?passo=arquivos" icone={<Upload />} titulo="Importar arquivos" texto="Figma, Illustrator, Blender, fotos" />
        </nav>
        {novo ? (
          <>
            {/* conta nova: no xl, passos (8) | créditos (4); no tablet os créditos sobem para o lado dos atalhos (grid denso) */}
            <PrimeirosPassos className={SPAN.doisTercos} />
            <CartaoCreditos className={SPAN.terco} />
          </>
        ) : (
          <>
            <Continuar className={SPAN.terco} projeto={vivos.find((p) => p.status !== 'archived')} assets={assets} carregando={carregando && !vivos.length} erro={erro && !vivos.length ? erro : null} aoTentar={tentarDeNovo} arquivados={arquivados} aoVerArquivados={() => { setFiltro('arquivados'); document.getElementById('projetos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
            <ResumoEnviados className={SPAN.terco} carregando={carregando && !links.length} erro={erro && !links.length ? erro : null} aoTentar={tentarDeNovo} />
            <CartaoCreditos className={SPAN.terco} />
            <PrimeirosPassos compacto className={SPAN.cheio} />
          </>
        )}
      </Grade>

      <Secao
        id="projetos"
        idTitulo="titulo-projetos"
        titulo="Projetos"
        acao={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-controle border border-bordaForte bg-superficie px-4 focus-within:border-acento sm:w-64 sm:flex-none">
              <Search className="h-4 w-4 shrink-0 text-texto3" strokeWidth={1.75} />
              <input aria-label="Buscar projetos" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome ou cliente" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-texto3 focus-visible:outline-none" />
            </label>
            <select aria-label="Ordenar projetos" value={ordem} onChange={(e) => setOrdem(e.target.value as 'recentes' | 'nome')} className="h-10 shrink-0 rounded-controle border border-bordaForte bg-superficie px-2 text-[13px] text-texto2 outline-none">
              <option value="recentes">Mais recentes</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </div>
        }
      >
        {/* as abas rolam dentro do próprio contêiner no celular (sem rolagem lateral da página) */}
        <div className="-mx-4 overflow-x-auto border-b border-borda px-4 pb-4 sm:mx-0 sm:px-0">
          <FiltroFichas abas rotulo="Filtrar projetos" valor={filtro} aoMudar={setFiltro} opcoes={filtros.map((f) => ({ ...f, contagem: contagem[f.id] }))} />
        </div>

        <Grade as="ul" className="mt-6 gap-y-8 sm:gap-y-8">
          {erro && !vivos.length ? (
            <li className="col-span-full"><EstadoErro titulo="Não foi possível carregar seus projetos" mensagem={erro} aoTentar={tentarDeNovo} /></li>
          ) : carregando && !vivos.length ? (
            // esqueletos na mesma grade (capa 16/10 e duas linhas): nada pula quando os projetos chegam
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={SPAN.terco} aria-hidden>
                <Esqueleto className="aspect-[16/10] rounded-cartao" />
                <Esqueleto className="mt-4 h-4 w-2/3" />
                <Esqueleto className="mt-2 h-3 w-1/2" />
              </li>
            ))
          ) : projetos.length === 0 ? (
            <li className="col-span-full">
              <EstadoVazio
                icone={<FolderOpen className="h-5 w-5" />}
                titulo={busca ? 'Nada encontrado' : novo ? 'Nenhum projeto ainda' : 'Nenhum projeto neste filtro'}
                descricao={busca ? 'Tente outro nome ou cliente.' : novo ? 'Use um dos caminhos acima: a IA monta uma apresentação a partir de uma frase, ou comece do zero.' : 'Troque o filtro para ver os outros projetos.'}
                acao={busca ? <Botao variante="secundario" onClick={() => setBusca('')}>Limpar busca</Botao> : !novo ? <Botao variante="secundario" onClick={() => setFiltro('todos')}>Ver todos</Botao> : undefined}
              />
            </li>
          ) : (
            projetos.map((p) => {
              const capa = p.documento.scenes[0]
              const st = statusExibido(p, linksAtivos)
              const telas = telasDo(p)
              return (
                <li key={p.id} className={cx(SPAN.terco, 'group relative min-w-0')}>
                  <Link href={`/app/projects/${p.id}`} className="block">
                    <div className="overflow-hidden rounded-cartao border border-black/5 transition-transform duration-normal group-hover:-translate-y-1 group-hover:shadow-suave">
                      {capa && <CapaProjeto cena={capa} assets={assets} proporcao={16 / 10} />}
                    </div>
                    <div className="mt-4 pr-10">
                      <h3 className="truncate text-[15px] font-medium tracking-[-0.01em]">{p.nome}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[12px] text-texto3">
                        <span className="mr-1 h-2 w-2 rounded-full" style={{ background: st.cor }} />
                        <span title={st.dica} style={{ color: st.cor === '#A3A3A3' ? undefined : st.cor }}>{st.rotulo}</span>
                        <span>·</span>
                        <span>{telas} {telas === 1 ? 'tela' : 'telas'}</span>
                        <span>·</span>
                        <span>{formatarRelativo(p.atualizadoEm)}</span>
                        {temAlteracoes(p) && <span className="text-avisoTexto" title="O link mostra a última revisão publicada">· alterações não publicadas</span>}
                      </p>
                    </div>
                  </Link>
                  <div className="absolute bottom-4 right-0" data-menu-projeto>
                    <button aria-label={`Ações de ${p.nome}`} aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)} className="flex h-8 w-8 items-center justify-center rounded-controle text-texto3 hover:bg-hover hover:text-texto"><MoreHorizontal className="h-4 w-4" /></button>
                    {menu === p.id && (
                      <div role="menu" className="absolute bottom-10 right-0 z-10 w-52 rounded-controle border border-borda bg-superficie p-1 text-[13px] shadow-painel">
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
            })
          )}
        </Grade>
      </Secao>

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
    </PaginaPainel>
  )
}

/** Atalho de criação (em branco, template, importar): sempre na horizontal, com descrição, em todos os tamanhos. */
function Atalho({ href, icone, titulo, texto }: { href: string; icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <Link href={href} className="group flex min-h-[72px] min-w-0 items-center gap-4 rounded-cartao border border-borda bg-superficie p-4 transition-colors hover:border-tinta">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-controle bg-hover text-texto [&>svg]:h-4 [&>svg]:w-4">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium leading-tight">{titulo}</span>
        <span className="mt-1 block truncate text-[12px] leading-snug text-texto2">{texto}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-texto3 transition-transform group-hover:translate-x-1 group-hover:text-texto" />
    </Link>
  )
}

/**
 * Atalho do painel para o "Criar com IA": um cartão limpo, com uma linha opcional para a ideia e o botão. O pedido
 * de verdade (briefing longo, estrutura, dados) é escrito no editor grande da tela do Criar com IA. Colar um texto
 * longo aqui leva o texto inteiro para lá (nada é cortado).
 */
function CriarComIARapido({ className }: { className?: string }) {
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
    <form onSubmit={(e) => { e.preventDefault(); abrir() }} aria-labelledby="titulo-criar-ia" className={cx('flex h-full min-w-0 flex-col justify-between gap-6 rounded-cartao border-[1.5px] border-tinta bg-superficie p-4 shadow-[4px_4px_0_#5965F2] sm:p-6', className)}>
      {/* a sombra carimbo (4 px) cabe na calha; o alinhamento com o grid é pela borda do cartão */}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <h2 id="titulo-criar-ia" className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]"><span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-acento" />Criar apresentação com IA</h2>
          <p className="mt-2 max-w-[520px] text-[13px] leading-snug text-texto2">Descreva a ideia ou cole um briefing completo (estrutura de telas, dados, cores e regras) na próxima tela. Você revisa o roteiro antes do design.</p>
        </div>
        <span className="mono hidden shrink-0 pt-1 text-[11px] text-texto3 sm:block">saldo: {textoTelas(saldo)}</span>
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
          className="h-12 w-full min-w-0 shrink-0 rounded-full border-[1.5px] border-borda bg-superficie px-4 text-[15px] outline-none placeholder:text-texto3 focus:border-tinta sm:w-auto sm:flex-1"
        />
        <button type="submit" className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-tinta bg-violeta px-6 text-[14px] font-semibold text-white hover:bg-acentoHover">
          <Sparkles className="h-4 w-4" />Criar com IA<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}

/** Retomar o último projeto. Sem projeto ativo (todos arquivados), o cartão fica no lugar e explica: a grade não abre buraco. */
function Continuar({ projeto, assets, carregando, erro, aoTentar, arquivados, aoVerArquivados, className }: { projeto?: Projeto; assets: Record<string, AssetDemo>; carregando: boolean; erro: string | null; aoTentar: () => void; arquivados: number; aoVerArquivados: () => void; className?: string }) {
  const router = useRouter()
  const capa = projeto?.documento.scenes[0]
  return (
    <CartaoPainel
      className={className}
      titulo="Continuar de onde parou"
      idTitulo="titulo-continuar"
      rodape={projeto && (
        <>
          <Link href={`/app/projects/${projeto.id}/edit`} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-controle bg-acao px-4 text-[13px] font-medium text-acaoTexto hover:bg-acaoHover"><Pencil className="h-4 w-4" />Abrir no editor</Link>
          <button type="button" onClick={() => abrirApresentacao(router, projeto.id)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-controle border-[1.5px] border-bordaForte px-4 text-[13px] font-medium hover:border-bordaHover"><Play className="h-4 w-4" />Apresentar</button>
        </>
      )}
    >
      {projeto ? (
        <Link href={`/app/projects/${projeto.id}/edit`} className="flex min-w-0 items-center gap-4">
          <div className="w-28 shrink-0 overflow-hidden rounded-controle border border-black/5">{capa && <CapaProjeto cena={capa} assets={assets} proporcao={16 / 10} />}</div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium">{projeto.nome}</div>
            <div className="mt-1 text-[12px] text-texto3">{formatarRelativo(projeto.atualizadoEm)} · {telasDo(projeto)} telas</div>
          </div>
        </Link>
      ) : carregando ? (
        <div className="flex items-center gap-4" aria-busy="true"><Esqueleto className="aspect-[16/10] w-28 shrink-0" /><div className="flex-1"><Esqueleto className="h-4 w-3/4" /><Esqueleto className="mt-2 h-3 w-1/2" /></div></div>
      ) : erro ? (
        <ErroNoCartao aoTentar={aoTentar} />
      ) : (
        <div className="text-[13px] text-texto2">
          <p>Nenhum projeto em andamento.</p>
          {arquivados > 0 && <button type="button" onClick={aoVerArquivados} className="mt-2 font-medium text-acento hover:underline">Ver arquivados</button>}
        </div>
      )}
    </CartaoPainel>
  )
}

/** Falha ao carregar dentro de um cartão do painel: o cartão não some, explica e oferece tentar de novo. */
function ErroNoCartao({ aoTentar }: { aoTentar: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 text-[13px] text-texto2">
      <p>Não deu para carregar.</p>
      <Botao tamanho="sm" variante="secundario" onClick={aoTentar}>Tentar de novo</Botao>
    </div>
  )
}

/** O que foi enviado e como o cliente interagiu (links ativos, visualizações, revisões pendentes). */
function ResumoEnviados({ carregando, erro, aoTentar, className }: { carregando: boolean; erro: string | null; aoTentar: () => void; className?: string }) {
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
    <CartaoPainel className={className} titulo="Enviados" idTitulo="titulo-enviados" acao={<Link href="/app/compartilhados" className="shrink-0 text-[12px] text-texto2 hover:text-texto">Ver todos</Link>}>
      {resumo.itens.length > 0 ? (
        <>
          <div className="flex gap-6">
            <div><div className="text-[28px] font-medium leading-none tracking-[-0.04em]">{resumo.itens.length}</div><div className="mt-2 text-[12px] text-texto2">{resumo.itens.length === 1 ? 'apresentação com link' : 'apresentações com link'}</div></div>
            <div><div className="text-[28px] font-medium leading-none tracking-[-0.04em]">{resumo.views}</div><div className="mt-2 text-[12px] text-texto2">visualizações</div></div>
          </div>
          <ul className="mt-4 divide-y divide-borda text-[13px]">
            {resumo.itens.slice(0, 3).map(({ p, views }) => (
              <li key={p.id}>
                <Link href={`/app/projects/${p.id}/share`} className="flex items-center gap-2 py-2 hover:text-acento">
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  {temAlteracoes(p) && <span className="shrink-0 text-[11px] text-avisoTexto">não publicado</span>}
                  <span className="flex shrink-0 items-center gap-1 text-[12px] text-texto3"><Eye className="h-3 w-3" />{views}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : carregando ? (
        <div aria-busy="true"><Esqueleto className="h-8 w-1/2" /><Esqueleto className="mt-4 h-3 w-full" /><Esqueleto className="mt-4 h-3 w-5/6" /></div>
      ) : erro ? (
        <ErroNoCartao aoTentar={aoTentar} />
      ) : (
        <p className="text-[13px] text-texto2">Nada enviado ainda. Publique um projeto e gere um link em Compartilhar para acompanhar as visualizações aqui.</p>
      )}
    </CartaoPainel>
  )
}

/** Checklist de primeira vez: da conta criada até o cliente abrir a apresentação. Some quando tudo foi feito. */
function PrimeirosPassos({ compacto, className }: { compacto?: boolean; className?: string }) {
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
    <CartaoPainel
      className={className}
      titulo={`Primeiros passos · ${feitos} de ${passos.length}`}
      idTitulo="titulo-passos"
      acao={<div className="h-1 w-24 shrink-0 overflow-hidden rounded-sm bg-borda" aria-hidden><div className="h-full bg-sucesso" style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>}
    >
      <ol className={cx('grid grid-cols-1 gap-4 sm:grid-cols-2', compacto && 'xl:grid-cols-4')}>
        {passos.map((p, i) => (
          <li key={p.titulo} className="min-w-0">
            <Link href={p.href} className={cx('flex h-full items-start gap-2 rounded-controle border p-4 transition-colors', i === proximo ? 'border-tinta' : 'border-borda hover:border-bordaForte', p.feito && 'opacity-60')}>
              <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold', p.feito ? 'border-sucesso bg-sucesso text-white' : i === proximo ? 'border-tinta' : 'border-bordaHover text-texto3')}>{p.feito ? <Check className="h-3 w-3" /> : i + 1}</span>
              <span className="min-w-0"><span className={cx('block text-[14px] font-medium leading-6', p.feito && 'line-through')}>{p.titulo}</span><span className="mt-1 block text-[12px] leading-snug text-texto2">{p.texto}</span></span>
              {i === proximo && <Send className="ml-auto mt-1 h-4 w-4 shrink-0 text-texto3" />}
            </Link>
          </li>
        ))}
      </ol>
    </CartaoPainel>
  )
}

function Item({ icone, children, onClick, perigo }: { icone: React.ReactNode; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cx('flex h-8 w-full items-center gap-2 rounded-controle px-2 text-left hover:bg-hover [&>svg]:h-4 [&>svg]:w-4', perigo && 'text-perigo')}>
      {icone} {children}
    </button>
  )
}
