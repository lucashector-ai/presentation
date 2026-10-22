'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { Box, Clock, Eye, Film, Image as ImageIcon, Lock, PenTool, RotateCcw, Send, Sparkles, Trash2, Upload } from 'lucide-react'
import { dados, ehErroDados, mensagemDeErro, useCarregar, useDados, type AssetDemo, type LinkCompartilhado, type Projeto } from '@/lib/dados'
import { estadoDoLink } from '@/lib/share/token'
import { formatarBytes } from '@/lib/planos'
import { EXTENSOES_ACEITAS } from '@/lib/importar/arquivos'
import { sanitizarSvgNavegador } from '@/lib/editor/importar'
import { CapaProjeto } from './CapaProjeto'
import { formatarRelativo } from './Dashboard'
import { Botao, EstadoErro, EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { CabecalhoPagina as Cabecalho, Esqueleto, FiltroFichas, Grade, PaginaPainel, SPAN, Secao } from './Layout'
import { useToast } from '@/components/ui/toast'

export function Lixeira() {
  const { carregando, erro, tentarDeNovo } = useCarregar(['lixeira', 'assets'])
  const projetos = useDados((e) => e.projetos.filter((p) => !!p.excluidoEm))
  const assets = useDados((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const [excluir, setExcluir] = useState<string | 'todos' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const { mostrar } = useToast()
  const restaurar = async (p: Projeto) => {
    try {
      await dados.restaurarProjeto(p.id)
      mostrar('Projeto restaurado. Links revogados continuam revogados: gere um novo em Compartilhar.', 'sucesso')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível restaurar.'), 'erro')
    }
  }
  return (
    <PaginaPainel>
      <Cabecalho
        rotulo="Lixeira"
        titulo="Lixeira."
        descricao="Projetos excluídos ficam aqui por 30 dias. Restaure a qualquer momento; depois disso são apagados com suas mídias não usadas."
        acao={projetos.length > 1 ? <Botao variante="perigo" tamanho="sm" onClick={() => setExcluir('todos')}>Esvaziar lixeira</Botao> : undefined}
      />
      {/* mesma grade dos Projetos do Início: 3, 2 e 1 por linha */}
      <Grade as="ul" className="gap-y-8 sm:gap-y-8">
        {erro && !projetos.length ? <li className="col-span-full"><EstadoErro titulo="Não foi possível abrir a lixeira" mensagem={erro} aoTentar={tentarDeNovo} /></li> : carregando && !projetos.length ? <EsqueletosCapa n={3} /> : projetos.length === 0 ? <li className="col-span-full"><EstadoVazio icone={<Trash2 className="h-5 w-5" />} titulo="A lixeira está vazia" descricao="Projetos que você mover para a lixeira aparecem aqui e podem ser restaurados." acao={<Link href="/app" className="inline-flex h-10 items-center rounded-controle border-[1.5px] border-bordaForte px-4 text-[14px] font-medium">Voltar ao início</Link>} /></li> : (
          projetos.map((p) => (
            <li key={p.id} className={cx(SPAN.terco, 'min-w-0')}>
              <div className="overflow-hidden rounded-cartao border border-black/5 opacity-70 grayscale-[40%]">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[15px] font-medium">{p.nome}</div><div className="mt-1 text-[12px] text-texto3">Excluído {formatarRelativo(p.excluidoEm!).replace('Editado ', '')}</div></div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => void restaurar(p)} className="flex h-8 items-center gap-2 rounded-controle border border-bordaForte px-2 text-[13px] hover:border-[#D4D4D4]"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>
                  <button aria-label={`Excluir ${p.nome} definitivamente`} onClick={() => setExcluir(p.id)} className="flex h-8 w-8 items-center justify-center rounded-controle text-perigo hover:bg-perigo/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </li>
          ))
        )}
      </Grade>
      <ModalConfirmar
        aberto={!!excluir}
        aoFechar={() => setExcluir(null)}
        titulo={excluir === 'todos' ? `Excluir ${projetos.length} projetos definitivamente?` : 'Excluir definitivamente?'}
        descricao="Os projetos, seus links e snapshots serão apagados. Esta ação não pode ser desfeita."
        rotuloConfirmar="Excluir para sempre"
        perigoso
        carregando={ocupado}
        aoConfirmar={async () => {
          const alvo = excluir
          setOcupado(true)
          try {
            if (alvo === 'todos') for (const p of projetos) await dados.excluirDefinitivo(p.id)
            else if (alvo) await dados.excluirDefinitivo(alvo)
            mostrar(alvo === 'todos' ? 'Lixeira esvaziada.' : 'Projeto excluído definitivamente.')
          } catch (e) {
            mostrar(mensagemDeErro(e, 'Não foi possível excluir.'), 'erro')
          } finally {
            setOcupado(false)
            setExcluir(null)
          }
        }}
      />
    </PaginaPainel>
  )
}

/** Esqueletos de capa (16/10 e duas linhas) na mesma grade da lista que vai chegar. */
function EsqueletosCapa({ n }: { n: number }) {
  return <>{Array.from({ length: n }, (_, i) => (
    <li key={i} className={SPAN.terco} aria-hidden>
      <Esqueleto className="aspect-[16/10] rounded-cartao" />
      <Esqueleto className="mt-4 h-4 w-2/3" />
      <Esqueleto className="mt-2 h-3 w-1/2" />
    </li>
  ))}</>
}

type Filtro = 'tudo' | 'image' | 'svg' | 'model3d' | 'video' | 'lottie'
const FILTROS_BIBLIOTECA: { id: Filtro; rotulo: string }[] = [{ id: 'tudo', rotulo: 'Tudo' }, { id: 'image', rotulo: 'Imagens' }, { id: 'svg', rotulo: 'Vetores' }, { id: 'model3d', rotulo: '3D' }, { id: 'video', rotulo: 'Vídeos' }, { id: 'lottie', rotulo: 'Lottie' }]

export function Biblioteca() {
  const { carregando, erro, tentarDeNovo } = useCarregar(['assets', 'projetos'])
  const assets = useDados((e) => e.assets)
  const projetos = useDados((e) => e.projetos)
  // contagem de usos só quando dá para saber no cliente (modo real lista só a capa dos projetos)
  const usoDe = (id: string) => (projetos.length || !carregando ? dados.projetosQueUsam(id)?.length ?? null : null)
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [excluindo, setExcluindo] = useState<{ asset: AssetDemo; usos: string[] | null } | null>(null)
  const [apagando, setApagando] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const { mostrar } = useToast()
  const lista = assets.filter((a) => filtro === 'tudo' || a.tipo === filtro || (filtro === 'image' && a.tipo === 'gif'))
  const total = assets.reduce((s, a) => s + a.bytes, 0)
  const Icone = (t: AssetDemo['tipo']) => (t === 'model3d' ? Box : t === 'video' ? Film : t === 'lottie' ? Sparkles : t === 'svg' ? PenTool : ImageIcon)

  const enviar = async (arquivos: File[]) => {
    let ok = 0
    for (const f of arquivos) {
      setEnviando(f.name)
      try { await dados.enviarArquivo(f, () => undefined, { sanitizarSvg: sanitizarSvgNavegador }); ok++ } catch (e) { mostrar(`${f.name}: ${mensagemDeErro(e, 'não foi possível enviar.')}`, 'erro') }
    }
    setEnviando(null)
    if (ok) mostrar(`${ok} ${ok === 1 ? 'arquivo enviado' : 'arquivos enviados'} para a biblioteca.`, 'sucesso')
  }

  return (
    <PaginaPainel onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void enviar(Array.from(e.dataTransfer.files)) }}>
      <Cabecalho
        rotulo="Biblioteca"
        titulo="Biblioteca."
        descricao={`Todos os arquivos do espaço: fotos, vetores do Figma e do Illustrator, modelos 3D do Blender, vídeos e animações Lottie. ${assets.length} arquivos · ${formatarBytes(total)}.`}
        acao={<>
          <input ref={entrada} type="file" multiple accept={EXTENSOES_ACEITAS} className="hidden" onChange={(e) => { void enviar(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          <Botao icone={<Upload className="h-4 w-4" />} carregando={!!enviando} onClick={() => entrada.current?.click()}>{enviando ? `Enviando ${enviando.slice(0, 18)}…` : 'Enviar arquivos'}</Botao>
        </>}
      />
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <FiltroFichas rotulo="Filtrar arquivos por tipo" valor={filtro} aoMudar={setFiltro} opcoes={FILTROS_BIBLIOTECA} />
      </div>
      {/* miniaturas em 2 colunas do grid: 2, 4 e 6 por linha, sempre em fronteiras pares */}
      <Grade as="ul" className="gap-y-6 sm:gap-y-8">
        {erro && !assets.length ? <li className="col-span-full"><EstadoErro titulo="Não foi possível carregar a biblioteca" mensagem={erro} aoTentar={tentarDeNovo} /></li> : carregando && !assets.length ? Array.from({ length: 12 }, (_, i) => <li key={i} className={SPAN.sexto} aria-hidden><Esqueleto className="aspect-square rounded-cartao" /></li>) : lista.map((a) => {
          const I = Icone(a.tipo)
          const uso = usoDe(a.id)
          return (
            <li key={a.id} className={cx(SPAN.sexto, 'group relative min-w-0')}>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-cartao border border-borda bg-superficie2">
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" className={a.tipo === 'svg' ? 'h-full w-full object-contain p-4' : 'h-full w-full object-cover'} /> : <I className="h-8 w-8 text-texto3" strokeWidth={1.2} />}
              </div>
              <div className="mt-2 truncate text-[13px]">{a.nome}</div>
              <div className="mt-1 text-[11px] text-texto3">{formatarBytes(a.bytes)}{uso == null ? '' : ` · ${uso ? `em ${uso} ${uso === 1 ? 'projeto' : 'projetos'}` : 'sem uso'}`}</div>
              <button aria-label={`Excluir ${a.nome}`} onClick={() => setExcluindo({ asset: a, usos: dados.projetosQueUsam(a.id)?.map((p) => p.nome) ?? null })} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-controle bg-superficie/95 text-texto2 shadow-sm hover:text-perigo sm:hidden sm:group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          )
        })}
      </Grade>
      {!lista.length && !(carregando || erro) && <EstadoVazio icone={<Upload className="h-5 w-5" />} titulo={assets.length ? 'Nenhum arquivo neste filtro' : 'A biblioteca está vazia'} descricao="Envie arquivos aqui, solte-os nesta página ou cole direto no canvas do editor (⌘V do Figma e do Illustrator)." acao={<Botao variante="secundario" onClick={() => entrada.current?.click()}>Enviar arquivos</Botao>} />}
      <ModalConfirmar aberto={!!excluindo} aoFechar={() => setExcluindo(null)} titulo="Excluir arquivo?" carregando={apagando}
        descricao={!excluindo ? undefined : excluindo.usos == null ? 'Se algum projeto usar este arquivo, avisamos antes de excluir.' : excluindo.usos.length ? `Usado em ${excluindo.usos.join(', ')}. As telas mostrarão “mídia indisponível”.` : 'Nenhum projeto usa este arquivo.'}
        rotuloConfirmar={excluindo?.usos?.length ? 'Excluir mesmo assim' : 'Excluir'} perigoso
        aoConfirmar={async () => {
          if (!excluindo) return
          setApagando(true)
          try {
            // sem a lista de usos (modo real), o servidor recusa mídia em uso e devolve os projetos: pergunta de novo
            await dados.excluirAsset(excluindo.asset.id, excluindo.usos != null)
            setExcluindo(null)
            mostrar('Arquivo excluído.')
          } catch (e) {
            const usos = ehErroDados(e, 'entrada_invalida') ? (e.details as { projetos?: string[] } | undefined)?.projetos : undefined
            if (usos?.length) setExcluindo({ asset: excluindo.asset, usos })
            else { setExcluindo(null); mostrar(mensagemDeErro(e, 'Não foi possível excluir.'), 'erro') }
          } finally {
            setApagando(false)
          }
        }} />
    </PaginaPainel>
  )
}

const ativo = (l: LinkCompartilhado) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo'

/**
 * Enviados: o acompanhamento depois de mandar o link ao cliente — quais apresentações estão no ar,
 * quantas vezes foram abertas, quais têm ajustes ainda não publicados e quais estão prontas para enviar.
 */
export function Compartilhados() {
  const { carregando, erro, tentarDeNovo } = useCarregar(['projetos', 'links', 'assets'])
  const projetos = useDados((e) => e.projetos.filter((p) => !p.excluidoEm))
  const links = useDados((e) => e.links)
  const assets = useDados((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { mostrar } = useToast()

  const linhas = projetos
    .map((p) => {
      const todos = links.filter((l) => l.projectId === p.id)
      return { p, todos, ativos: todos.filter(ativo) }
    })
    .filter((x) => (mostrarInativos ? x.todos.length : x.ativos.length))
    .sort((a, b) => Math.max(...b.todos.map((l) => +new Date(l.criadoEm))) - Math.max(...a.todos.map((l) => +new Date(l.criadoEm))))
  const comLink = new Set(links.filter(ativo).map((l) => l.projectId))
  const prontos = projetos.filter((p) => p.status !== 'archived' && p.revisaoPublicada != null && !comLink.has(p.id))
  const ativos = links.filter(ativo)
  const totalViews = ativos.reduce((s, l) => s + l.visualizacoes, 0)
  const pendentes = projetos.filter((p) => comLink.has(p.id) && p.revisaoPublicada != null && p.revisaoAtual > p.revisaoPublicada).length

  const publicarAgora = async (p: Projeto) => {
    try {
      const r = await dados.publicar(p.id, p.revisaoAtual)
      mostrar(`Revisão ${r.publishedRevision} publicada. Quem tem o link já vê a versão nova.`, 'sucesso')
    } catch (e) {
      mostrar(mensagemDeErro(e, 'Não foi possível publicar.'), 'erro')
    }
  }

  return (
    <PaginaPainel>
      <Cabecalho rotulo="Enviados" titulo="Enviados." descricao="Apresentações que você enviou por link privado. Veja quantas vezes cada uma foi aberta, publique ajustes sem reenviar nada e revogue o acesso quando quiser." />

      {/* KPIs em 1/4 (xl), 1/2 (tablet e celular): fronteiras 1/4/7/10, as mesmas dos "Prontos para enviar" abaixo */}
      <Grade as="dl">
        {[
          ['No ar', comLink.size, comLink.size === 1 ? 'apresentação com link ativo' : 'apresentações com link ativo'],
          ['Visualizações', totalViews, 'nos links ativos'],
          ['Com senha', ativos.filter((l) => l.senhaHash).length, 'links protegidos'],
          ['Ajustes pendentes', pendentes, 'mudanças ainda não publicadas'],
        ].map(([r, v, d]) => (
          <div key={String(r)} className={cx(SPAN.quarto, 'flex min-w-0 flex-col rounded-cartao border border-borda bg-superficie p-4 sm:p-6')}>
            <dt className="rotulo-mono text-[10px]">{r}</dt>
            <dd className="mt-2 text-[28px] font-medium leading-none tracking-[-0.04em] sm:text-[32px]">{carregando && !links.length ? '–' : v}</dd>
            <dd className="mt-2 text-[12px] text-texto2">{d}</dd>
          </div>
        ))}
      </Grade>

      <Secao titulo="Links" acao={<label className="flex items-center gap-2 text-[13px] text-texto2"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="accent-grafite" />Mostrar revogados e expirados</label>}>
        {erro && !linhas.length ? (
          <EstadoErro titulo="Não foi possível carregar os envios" mensagem={erro} aoTentar={tentarDeNovo} />
        ) : carregando && !linhas.length ? (
          <div className="divide-y divide-borda rounded-cartao border border-borda bg-superficie" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6"><Esqueleto className="aspect-[16/10] w-24 shrink-0 sm:w-28" /><div className="flex-1"><Esqueleto className="h-4 w-1/3" /><Esqueleto className="mt-2 h-3 w-1/2" /></div></div>)}
          </div>
        ) : linhas.length === 0 ? (
          <EstadoVazio icone={<Send className="h-5 w-5" />} titulo="Nada enviado ainda" descricao="Publique um projeto e gere um link em Compartilhar. As visualizações do cliente aparecem aqui." acao={prontos[0] ? <Link href={`/app/projects/${prontos[0].id}/share`} className="inline-flex h-10 items-center rounded-controle bg-grafite px-4 text-[14px] font-medium text-fundo">Enviar “{prontos[0].nome}”</Link> : <Link href="/app" className="inline-flex h-10 items-center rounded-controle border-[1.5px] border-bordaForte px-4 text-[14px] font-medium">Ver projetos</Link>} />
        ) : (
          <ul className="divide-y divide-borda rounded-cartao border border-borda bg-superficie">
            {linhas.map(({ p, ativos: at, todos }) => {
              const views = (mostrarInativos ? todos : at).reduce((s, l) => s + l.visualizacoes, 0)
              const pendente = p.revisaoPublicada != null && p.revisaoAtual > p.revisaoPublicada
              const expira = at.map((l) => l.expiraEm).filter(Boolean).sort()[0]
              return (
                <li key={p.id} className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                  <Link href={`/app/projects/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="w-24 shrink-0 overflow-hidden rounded-controle border border-black/5 sm:w-28">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-medium">{p.nome}</div>
                      {p.cliente && <div className="truncate text-[12px] text-texto3">{p.cliente}</div>}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-texto2">
                        <span className={cx('flex items-center gap-1', at.length ? 'text-sucesso' : 'text-texto3')}><span className="h-2 w-2 rounded-full bg-current" />{at.length ? `${at.length} ${at.length === 1 ? 'link ativo' : 'links ativos'}` : 'sem link ativo'}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{views} {views === 1 ? 'visualização' : 'visualizações'}</span>
                        {at.some((l) => l.senhaHash) && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />com senha</span>}
                        {expira && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />expira em {new Date(expira).toLocaleDateString('pt-BR')}</span>}
                      </div>
                      {pendente && <div className="mt-2 text-[12px] text-[#B7791F]">O cliente vê a revisão {p.revisaoPublicada}; o rascunho está na {p.revisaoAtual}.</div>}
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    {pendente && at.length > 0 && <Botao tamanho="sm" onClick={() => void publicarAgora(p)}>Publicar ajustes</Botao>}
                    <Link href={`/app/projects/${p.id}/share`} className="inline-flex h-8 items-center rounded-controle border-[1.5px] border-bordaForte px-4 text-[13px] font-medium hover:border-[#D4D4D4]">Gerenciar links</Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Secao>

      {prontos.length > 0 && (
        <Secao titulo="Prontos para enviar" descricao="Publicados, mas sem link ativo. Gere um link e mande para o cliente.">
          <Grade as="ul">
            {prontos.map((p) => (
              <li key={p.id} className={cx(SPAN.metade, 'flex min-w-0 items-center gap-4 rounded-cartao border border-borda bg-superficie p-4')}>
                <div className="w-20 shrink-0 overflow-hidden rounded-controle border border-black/5">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{p.nome}</div><div className="mt-1 text-[12px] text-texto3">Revisão {p.revisaoPublicada} publicada</div></div>
                <Link href={`/app/projects/${p.id}/share`} className="inline-flex h-8 shrink-0 items-center gap-2 rounded-controle bg-acento px-4 text-[13px] font-medium text-white hover:bg-[#4A55E0]"><Send className="h-3.5 w-3.5" />Gerar link</Link>
              </li>
            ))}
          </Grade>
        </Secao>
      )}
    </PaginaPainel>
  )
}
