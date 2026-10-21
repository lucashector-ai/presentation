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
import { Botao, CarregandoBloco, EstadoErro, EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

function Cabecalho({ rotulo, titulo, descricao, acao }: { rotulo: string; titulo: string; descricao: string; acao?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
      <div>
        <div className="rotulo-mono">{rotulo}</div>
        <h1 className="titulo-display mt-2.5 text-[32px] sm:text-[40px]">{titulo}</h1>
        <p className="mt-3 max-w-xl text-[14px] text-texto2">{descricao}</p>
      </div>
      {acao}
    </div>
  )
}

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
    <div>
      <Cabecalho
        rotulo="Lixeira"
        titulo="Lixeira."
        descricao="Projetos excluídos ficam aqui por 30 dias. Restaure a qualquer momento; depois disso são apagados com suas mídias não usadas."
        acao={projetos.length > 1 ? <Botao variante="perigo" tamanho="sm" onClick={() => setExcluir('todos')}>Esvaziar lixeira</Botao> : undefined}
      />
      {erro && !projetos.length ? <EstadoErro titulo="Não foi possível abrir a lixeira" mensagem={erro} aoTentar={tentarDeNovo} /> : carregando && !projetos.length ? <CarregandoBloco texto="Carregando a lixeira…" /> : projetos.length === 0 ? <EstadoVazio icone={<Trash2 className="h-5 w-5" />} titulo="A lixeira está vazia" descricao="Projetos que você mover para a lixeira aparecem aqui e podem ser restaurados." acao={<Link href="/app" className="rounded-[9px] border-[1.5px] border-bordaForte px-4 py-2 text-[14px] font-medium">Voltar ao início</Link>} /> : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {projetos.map((p) => (
            <li key={p.id}>
              <div className="overflow-hidden rounded-[8px] border border-black/5 opacity-70 grayscale-[40%]">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[15px] font-medium">{p.nome}</div><div className="text-[12px] text-texto3">Excluído {formatarRelativo(p.excluidoEm!).replace('Editado ', '')}</div></div>
                <div className="flex gap-1">
                  <button onClick={() => void restaurar(p)} className="flex h-8 items-center gap-1.5 rounded-md border border-bordaForte px-2.5 text-[13px] hover:border-[#D4D4D4]"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>
                  <button aria-label={`Excluir ${p.nome} definitivamente`} onClick={() => setExcluir(p.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-perigo hover:bg-perigo/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
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
    </div>
  )
}

type Filtro = 'tudo' | 'image' | 'svg' | 'model3d' | 'video' | 'lottie'

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
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void enviar(Array.from(e.dataTransfer.files)) }}>
      <Cabecalho
        rotulo="Biblioteca"
        titulo="Biblioteca."
        descricao={`Todos os arquivos do espaço: fotos, vetores do Figma e do Illustrator, modelos 3D do Blender, vídeos e animações Lottie. ${assets.length} arquivos · ${formatarBytes(total)}.`}
        acao={<>
          <input ref={entrada} type="file" multiple accept={EXTENSOES_ACEITAS} className="hidden" onChange={(e) => { void enviar(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          <Botao icone={<Upload className="h-4 w-4" />} carregando={!!enviando} onClick={() => entrada.current?.click()}>{enviando ? `Enviando ${enviando.slice(0, 18)}…` : 'Enviar arquivos'}</Botao>
        </>}
      />
      <div className="mb-6 flex flex-wrap gap-1 text-[14px]">
        {([['tudo', 'Tudo'], ['image', 'Imagens'], ['svg', 'Vetores'], ['model3d', '3D'], ['video', 'Vídeos'], ['lottie', 'Lottie']] as const).map(([id, r]) => (
          <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={cx('rounded-full px-3 py-1.5', filtro === id ? 'bg-grafite text-fundo' : 'text-texto2 hover:text-texto')}>{r}</button>
        ))}
      </div>
      {erro && !assets.length ? <EstadoErro titulo="Não foi possível carregar a biblioteca" mensagem={erro} aoTentar={tentarDeNovo} /> : carregando && !assets.length ? <CarregandoBloco texto="Carregando arquivos…" /> : (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {lista.map((a) => {
          const I = Icone(a.tipo)
          const uso = usoDe(a.id)
          return (
            <li key={a.id} className="group relative">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-borda bg-superficie2">
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" className={a.tipo === 'svg' ? 'h-full w-full object-contain p-4' : 'h-full w-full object-cover'} /> : <I className="h-8 w-8 text-texto3" strokeWidth={1.2} />}
              </div>
              <div className="mt-2 truncate text-[13px]">{a.nome}</div>
              <div className="text-[11px] text-texto3">{formatarBytes(a.bytes)}{uso == null ? '' : ` · ${uso ? `em ${uso} ${uso === 1 ? 'projeto' : 'projetos'}` : 'sem uso'}`}</div>
              <button aria-label={`Excluir ${a.nome}`} onClick={() => setExcluindo({ asset: a, usos: dados.projetosQueUsam(a.id)?.map((p) => p.nome) ?? null })} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-superficie/95 text-texto2 shadow-sm hover:text-perigo sm:hidden sm:group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          )
        })}
      </ul>
      )}
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
    </div>
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
    <div>
      <Cabecalho rotulo="Enviados" titulo="Enviados." descricao="Apresentações que você enviou por link privado. Veja quantas vezes cada uma foi aberta, publique ajustes sem reenviar nada e revogue o acesso quando quiser." />

      <dl className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['No ar', comLink.size, comLink.size === 1 ? 'apresentação com link ativo' : 'apresentações com link ativo'],
          ['Visualizações', totalViews, 'nos links ativos'],
          ['Com senha', ativos.filter((l) => l.senhaHash).length, 'links protegidos'],
          ['Ajustes pendentes', pendentes, 'mudanças ainda não publicadas'],
        ].map(([r, v, d]) => (
          <div key={String(r)} className="rounded-xl border border-borda bg-superficie p-4">
            <dt className="rotulo-mono text-[10px]">{r}</dt>
            <dd className="mt-2 text-[26px] font-medium leading-none tracking-[-0.04em]">{v}</dd>
            <dd className="mt-1 text-[12px] text-texto2">{d}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium">Links</h2>
        <label className="flex items-center gap-2 text-[13px] text-texto2"><input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} className="accent-grafite" />Mostrar revogados e expirados</label>
      </div>
      {erro && !linhas.length ? (
        <EstadoErro titulo="Não foi possível carregar os envios" mensagem={erro} aoTentar={tentarDeNovo} />
      ) : carregando && !linhas.length ? (
        <CarregandoBloco texto="Carregando links…" />
      ) : linhas.length === 0 ? (
        <EstadoVazio icone={<Send className="h-5 w-5" />} titulo="Nada enviado ainda" descricao="Publique um projeto e gere um link em Compartilhar. As visualizações do cliente aparecem aqui." acao={prontos[0] ? <Link href={`/app/projects/${prontos[0].id}/share`} className="rounded-[9px] bg-grafite px-4 py-2.5 text-[14px] font-medium text-fundo">Enviar “{prontos[0].nome}”</Link> : <Link href="/app" className="rounded-[9px] border-[1.5px] border-bordaForte px-4 py-2 text-[14px] font-medium">Ver projetos</Link>} />
      ) : (
        <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
          {linhas.map(({ p, ativos: at, todos }) => {
            const views = (mostrarInativos ? todos : at).reduce((s, l) => s + l.visualizacoes, 0)
            const pendente = p.revisaoPublicada != null && p.revisaoAtual > p.revisaoPublicada
            const expira = at.map((l) => l.expiraEm).filter(Boolean).sort()[0]
            return (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                <Link href={`/app/projects/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="w-24 shrink-0 overflow-hidden rounded-md border border-black/5 sm:w-28">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{p.nome}</div>
                    {p.cliente && <div className="truncate text-[12px] text-texto3">{p.cliente}</div>}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-texto2">
                      <span className={cx('flex items-center gap-1', at.length ? 'text-sucesso' : 'text-texto3')}><span className="h-1.5 w-1.5 rounded-full bg-current" />{at.length ? `${at.length} ${at.length === 1 ? 'link ativo' : 'links ativos'}` : 'sem link ativo'}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{views} {views === 1 ? 'visualização' : 'visualizações'}</span>
                      {at.some((l) => l.senhaHash) && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />com senha</span>}
                      {expira && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />expira em {new Date(expira).toLocaleDateString('pt-BR')}</span>}
                    </div>
                    {pendente && <div className="mt-1.5 text-[12px] text-[#B7791F]">O cliente vê a revisão {p.revisaoPublicada}; o rascunho está na {p.revisaoAtual}.</div>}
                  </div>
                </Link>
                <div className="flex shrink-0 gap-2">
                  {pendente && at.length > 0 && <Botao tamanho="sm" onClick={() => void publicarAgora(p)}>Publicar ajustes</Botao>}
                  <Link href={`/app/projects/${p.id}/share`} className="inline-flex h-8 items-center rounded-md border-[1.5px] border-bordaForte px-3 text-[13px] font-medium hover:border-[#D4D4D4]">Gerenciar links</Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {prontos.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-medium">Prontos para enviar</h2>
          <p className="mt-1 text-[13px] text-texto2">Publicados, mas sem link ativo. Gere um link e mande para o cliente.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {prontos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-borda bg-superficie p-3">
                <div className="w-20 shrink-0 overflow-hidden rounded-md border border-black/5">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{p.nome}</div><div className="text-[12px] text-texto3">Revisão {p.revisaoPublicada} publicada</div></div>
                <Link href={`/app/projects/${p.id}/share`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-acento px-3 text-[13px] font-medium text-white hover:bg-[#4A55E0]"><Send className="h-3.5 w-3.5" />Gerar link</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
