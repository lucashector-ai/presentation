'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Archive, MonitorPlay, Pencil, Play, Share2, Trash2 } from 'lucide-react'
import { dados, mensagemDeErro, useCarregar, useDados, useProjetoCompleto } from '@/lib/dados'
import { estadoDoLink } from '@/lib/share/token'
import { assetsDaCamada } from '@/lib/scene/schema'
import { CapaProjeto } from './CapaProjeto'
import { BarraPublicacao } from './BarraPublicacao'
import { MiniaturaCena } from '@/components/editor/MiniaturaCena'
import { formatarRelativo, statusExibido } from './Dashboard'
import { CarregandoBloco, EstadoErro, EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { Grade, PaginaPainel, SPAN } from './Layout'
import { useToast } from '@/components/ui/toast'
import { abrirApresentacao } from '@/components/viewer/retorno'

export function DetalheProjeto({ id }: { id: string }) {
  const { projeto, carregando, ausente, erro, tentarDeNovo } = useProjetoCompleto(id)
  useCarregar(['assets', 'links'])
  const assets = useDados((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const links = useDados((e) => e.links.filter((l) => l.projectId === id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)))
  const router = useRouter()
  const { mostrar } = useToast()
  const [excluir, setExcluir] = useState(false)
  const agir = async (fn: () => Promise<unknown>, msg: string, depois?: () => void) => {
    try {
      await fn()
      mostrar(msg)
      depois?.()
    } catch (e) {
      mostrar(mensagemDeErro(e), 'erro')
    }
  }

  if (carregando) return <CarregandoBloco texto="Abrindo o projeto…" />
  if (erro) return <EstadoErro titulo="Não foi possível abrir o projeto" mensagem={erro} aoTentar={tentarDeNovo} />
  if (ausente || !projeto) return <EstadoVazio titulo="Projeto não encontrado" descricao="Ele pode ter sido movido para a lixeira ou excluído." acao={<div className="flex gap-2"><Link href="/app" className="inline-flex h-10 items-center rounded-controle bg-grafite px-4 text-[14px] font-medium text-fundo">Voltar ao início</Link><Link href="/app/lixeira" className="inline-flex h-10 items-center rounded-controle border-[1.5px] border-bordaForte px-4 text-[14px] font-medium">Abrir a lixeira</Link></div>} />
  const ativos = links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo')
  const st = statusExibido(projeto, new Set(ativos.length ? [projeto.id] : []))
  const midias = new Set(projeto.documento.scenes.flatMap((s) => [...s.layers.flatMap(assetsDaCamada), ...(s.backgroundAssetId ? [s.backgroundAssetId] : [])]))
  const tipos = new Set(projeto.documento.scenes.flatMap((s) => s.layers.map((l) => l.type)))
  const interacoes = projeto.documento.scenes.reduce((n, s) => n + s.layers.reduce((m, l) => m + l.interactions.length, 0), 0)

  return (
    // conteúdo em 2/3 e detalhes em 1/3 do grid do painel (abaixo de xl, os detalhes descem)
    <PaginaPainel>
      <Grade>
        <div className={cx(SPAN.doisTercos, 'min-w-0')}>
          <nav aria-label="Trilha" className="mb-4 flex items-center gap-2 text-[13px] text-texto2"><Link href="/app" className="hover:text-texto">Início</Link><span className="text-[#D4D4D4]">/</span><span className="truncate text-texto">{projeto.nome}</span></nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="rotulo-mono">{projeto.categoria ?? projeto.modo}{projeto.cliente ? ` · ${projeto.cliente}` : ''}</div>
              <h1 className="titulo-display mt-2 text-[32px] sm:text-[40px]">{projeto.nome}</h1>
              <p className="mt-2 flex items-center gap-2 text-[13px] text-texto3"><span className="h-2 w-2 rounded-full" style={{ background: st.cor }} /> <span style={{ color: st.cor }}>{st.rotulo}</span> · {formatarRelativo(projeto.atualizadoEm)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => router.push(`/app/projects/${id}/edit`)} className="flex h-10 items-center gap-2 rounded-controle bg-grafite px-4 text-[14px] font-medium text-fundo hover:bg-[#2a2a2a]"><Pencil className="h-4 w-4" /> Editar</button>
              <button onClick={() => abrirApresentacao(router, id)} className="flex h-10 items-center gap-2 rounded-controle border-[1.5px] border-bordaForte bg-superficie px-4 text-[14px] font-medium hover:border-[#D4D4D4]"><Play className="h-4 w-4" /> Apresentar</button>
              <button onClick={() => abrirApresentacao(router, id, { apresentador: true })} className="flex h-10 items-center gap-2 rounded-controle border-[1.5px] border-bordaForte bg-superficie px-4 text-[14px] font-medium hover:border-[#D4D4D4]"><MonitorPlay className="h-4 w-4" /> Apresentador</button>
              <button onClick={() => router.push(`/app/projects/${id}/share`)} className="flex h-10 items-center gap-2 rounded-controle bg-acento px-4 text-[14px] font-medium text-white hover:bg-[#4A55E0]"><Share2 className="h-4 w-4" /> Compartilhar</button>
            </div>
          </div>
          <BarraPublicacao projetoId={id} className="mt-6" />
          <div className="mt-6 overflow-hidden rounded-cartao border border-black/5">{projeto.documento.scenes[0] && <CapaProjeto cena={projeto.documento.scenes[0]} assets={assets} proporcao={16 / 9} />}</div>
          <h2 className="mt-12 text-[20px] font-medium leading-7 tracking-[-0.02em]">Telas · {projeto.documento.scenes.length}</h2>
          {/* grade aninhada com as mesmas colunas e calhas: as miniaturas caem nas colunas da página */}
          <Grade as="ul" className="mt-4 xl:grid-cols-8">
            {projeto.documento.scenes.map((s, i) => (
              <li key={s.id} className={cx(SPAN.sexto, 'min-w-0')}>
                <Link href={`/app/projects/${id}/edit`} className="block">
                  <div className="overflow-hidden rounded-controle"><CapaProjeto cena={s} assets={assets} proporcao={16 / 10} /></div>
                  <div className="mt-2 flex gap-2 text-[12px]"><span className="mono text-texto3">{String(i + 1).padStart(2, '0')}</span><span className="truncate">{s.title || 'Sem título'}</span></div>
                </Link>
              </li>
            ))}
          </Grade>
          <div className="mt-12">
            <label className="block"><span className="mb-2 block text-[13px] font-medium">Descrição</span>
              <textarea rows={3} defaultValue={projeto.descricao} placeholder="Contexto do projeto, cliente, objetivo…" onBlur={(e) => { if (e.target.value !== projeto.descricao) void agir(() => dados.atualizarProjeto(id, { descricao: e.target.value }), 'Descrição salva.') }} className="w-full rounded-controle border border-[#E7E5E4] bg-superficie px-4 py-2 text-[14px] leading-6 outline-none focus:border-acento" />
            </label>
          </div>
        </div>
        <aside className={cx(SPAN.lateral, 'min-w-0 space-y-6')}>
          <div className="rounded-cartao border border-borda bg-superficie p-4 text-[13px] sm:p-6">
            <h2 className="mb-4 font-medium">Detalhes</h2>
            <dl className="space-y-2 text-texto2">
              {[
                ['Formato', { slides: 'Slides', story: 'Story', explorar: 'Explorar' }[projeto.modo]],
                ['Telas', projeto.documento.scenes.length],
                ['Arquivos usados', midias.size],
                ['Interações', interacoes],
                ['Conteúdo', [tipos.has('model3d') && '3D', tipos.has('svg') && 'vetores', tipos.has('video') && 'vídeo', tipos.has('lottie') && 'Lottie', tipos.has('embed') && 'embeds'].filter(Boolean).join(', ') || '—'],
                ['Revisão do rascunho', projeto.revisaoAtual],
                ['Revisão publicada', projeto.revisaoPublicada ?? '—'],
                ['Criado em', new Date(projeto.criadoEm).toLocaleDateString('pt-BR')],
              ].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-4"><dt>{k}</dt><dd className="text-right text-texto">{v}</dd></div>)}
            </dl>
          </div>
          <div className="rounded-cartao border border-borda bg-superficie p-4 text-[13px] sm:p-6">
            <h2 className="mb-1 font-medium">Links ativos · {ativos.length}</h2>
            <p className="text-texto2">{ativos.reduce((s, l) => s + l.visualizacoes, 0)} visualizações no total.</p>
            <Link href={`/app/projects/${id}/share`} className="mt-4 inline-block text-acento hover:underline">Gerenciar links</Link>
          </div>
          {projeto.documento.scenes.some((s) => s.notes) && (
            <div className="rounded-cartao border border-borda bg-superficie p-4 text-[13px] sm:p-6">
              <h2 className="mb-4 font-medium">Notas do apresentador</h2>
              {projeto.documento.scenes.filter((s) => s.notes).slice(0, 3).map((s) => <div key={s.id} className="mb-2 flex gap-2"><MiniaturaCena cena={s} assets={assets} largura={56} /><p className="line-clamp-3 text-texto2">{s.notes}</p></div>)}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => void agir(() => dados.atualizarProjeto(id, { status: projeto.status === 'archived' ? (projeto.revisaoPublicada ? 'published' : 'draft') : 'archived' }), projeto.status === 'archived' ? 'Projeto restaurado.' : 'Projeto arquivado.')} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-controle border border-bordaForte text-[13px] hover:border-[#D4D4D4]"><Archive className="h-3.5 w-3.5" /> {projeto.status === 'archived' ? 'Restaurar' : 'Arquivar'}</button>
            <button onClick={() => setExcluir(true)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-controle border border-bordaForte text-[13px] text-perigo hover:bg-perigo/5"><Trash2 className="h-3.5 w-3.5" /> Lixeira</button>
          </div>
        </aside>
      </Grade>
      <ModalConfirmar aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Mover para a lixeira?" descricao="Os links param de funcionar. Você pode restaurar pela Lixeira." rotuloConfirmar="Mover para a lixeira" perigoso aoConfirmar={() => { setExcluir(false); void agir(() => dados.excluirProjeto(id), 'Projeto movido para a lixeira.', () => router.push('/app')) }} />
    </PaginaPainel>
  )
}
