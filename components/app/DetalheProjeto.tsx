'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Archive, Pencil, Play, Share2, Trash2 } from 'lucide-react'
import { atualizarProjeto, excluirProjeto, listarLinks } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { estadoDoLink } from '@/lib/share/token'
import { MiniaturaCena } from '@/components/editor/MiniaturaCena'
import { AreaTexto, Botao, Cartao, ModalConfirmar, Selo } from '@/components/ui'
import { useToast } from '@/components/ui/toast'
import { formatarRelativo } from './Dashboard'

export function DetalheProjeto({ id }: { id: string }) {
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === id && !p.excluidoEm))
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const links = useDemo(() => listarLinks(id))
  const router = useRouter()
  const { mostrar } = useToast()
  const [excluir, setExcluir] = useState(false)

  if (!projeto) return <p className="text-sm text-texto2">Projeto não encontrado. <Link href="/app" className="underline">Voltar</Link></p>
  const ativos = links.filter((l) => estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo')
  const midias = new Set(JSON.stringify(projeto.documento).match(/"as(set)?Id":"([^"]+)"/g)?.map((m) => m.split('"')[3]) ?? [])

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href="/app" className="text-sm text-texto2 hover:underline">Projetos</Link><span className="text-texto2">/</span>
          <h1 className="text-xl font-bold tracking-tight">{projeto.nome}</h1>
          <Selo tom={projeto.status === 'published' ? 'sucesso' : projeto.status === 'archived' ? 'neutro' : 'aviso'}>{{ draft: 'rascunho', published: 'publicado', archived: 'arquivado' }[projeto.status]}</Selo>
        </div>
        <Cartao className="overflow-hidden">
          <div className="flex items-center justify-center bg-superficie2 p-6">
            {projeto.documento.scenes[0] && <MiniaturaCena cena={projeto.documento.scenes[0]} assets={assets} largura={projeto.modo === 'story' ? 220 : 560} />}
          </div>
        </Cartao>
        <div className="mt-4 flex flex-wrap gap-2">
          <Botao icone={<Pencil className="h-4 w-4" />} onClick={() => router.push(`/app/projects/${id}/edit`)}>Editar</Botao>
          <Botao variante="secundario" icone={<Play className="h-4 w-4" />} onClick={() => router.push(`/app/projects/${id}/apresentar`)}>Apresentar</Botao>
          <Botao variante="secundario" icone={<Share2 className="h-4 w-4" />} onClick={() => router.push(`/app/projects/${id}/share`)}>Compartilhar</Botao>
          <span className="flex-1" />
          <Botao variante="fantasma" icone={<Archive className="h-4 w-4" />} onClick={() => { atualizarProjeto(id, { status: projeto.status === 'archived' ? 'draft' : 'archived' }); mostrar(projeto.status === 'archived' ? 'Projeto restaurado.' : 'Projeto arquivado.') }}>{projeto.status === 'archived' ? 'Restaurar' : 'Arquivar'}</Botao>
          <Botao variante="perigo" icone={<Trash2 className="h-4 w-4" />} onClick={() => setExcluir(true)}>Excluir</Botao>
        </div>
        <Cartao className="mt-6 p-5">
          <h2 className="mb-2 text-sm font-semibold">Descrição</h2>
          <AreaTexto rows={3} defaultValue={projeto.descricao} placeholder="Contexto do projeto, cliente, objetivo…" onBlur={(e) => e.target.value !== projeto.descricao && atualizarProjeto(id, { descricao: e.target.value })} />
        </Cartao>
      </div>
      <aside className="space-y-4">
        <Cartao className="p-5 text-sm">
          <h2 className="mb-3 font-semibold">Metadados</h2>
          <dl className="space-y-2 text-texto2">
            <div className="flex justify-between"><dt>Modo</dt><dd className="text-texto">{projeto.modo === 'slides' ? 'Slides' : 'Story'}</dd></div>
            <div className="flex justify-between"><dt>Cenas</dt><dd className="text-texto">{projeto.documento.scenes.length}</dd></div>
            <div className="flex justify-between"><dt>Mídias usadas</dt><dd className="text-texto">{midias.size}</dd></div>
            <div className="flex justify-between"><dt>Revisão do rascunho</dt><dd className="text-texto">{projeto.revisaoAtual}</dd></div>
            <div className="flex justify-between"><dt>Revisão publicada</dt><dd className="text-texto">{projeto.revisaoPublicada ?? '—'}</dd></div>
            <div className="flex justify-between"><dt>Última edição</dt><dd className="text-texto">{formatarRelativo(projeto.atualizadoEm)}</dd></div>
            <div className="flex justify-between"><dt>Criado em</dt><dd className="text-texto">{new Date(projeto.criadoEm).toLocaleDateString('pt-BR')}</dd></div>
          </dl>
        </Cartao>
        <Cartao className="p-5 text-sm">
          <h2 className="mb-1 font-semibold">Links ativos · {ativos.length}</h2>
          <p className="text-texto2">{ativos.reduce((s, l) => s + l.visualizacoes, 0)} visualizações no total.</p>
          <Link href={`/app/projects/${id}/share`} className="mt-3 inline-block text-texto underline-offset-2 hover:underline">Gerenciar links</Link>
        </Cartao>
      </aside>
      <ModalConfirmar aberto={excluir} aoFechar={() => setExcluir(false)} titulo="Excluir definitivamente?" descricao="O projeto e seus links serão removidos. Esta ação não pode ser desfeita." rotuloConfirmar="Excluir" perigoso aoConfirmar={() => { excluirProjeto(id); mostrar('Projeto excluído.'); router.push('/app') }} />
    </div>
  )
}
