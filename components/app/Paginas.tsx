'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Box, Film, Image as ImageIcon, Lock, PenTool, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { excluirAsset, excluirDefinitivo, projetosQueUsam, restaurarProjeto } from '@/lib/demo/store'
import { useDemo } from '@/lib/demo/useDemo'
import { estadoDoLink } from '@/lib/share/token'
import { formatarBytes } from '@/lib/planos'
import type { AssetDemo } from '@/lib/demo/tipos'
import { CapaProjeto } from './CapaProjeto'
import { formatarRelativo } from './Dashboard'
import { EstadoVazio, ModalConfirmar, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

function Cabecalho({ rotulo, titulo, descricao }: { rotulo: string; titulo: string; descricao: string }) {
  return (
    <div className="mb-8 border-b border-borda pb-6">
      <div className="rotulo-mono">{rotulo}</div>
      <h1 className="titulo-display mt-2.5 text-[40px]">{titulo}</h1>
      <p className="mt-3 max-w-xl text-[14px] text-texto2">{descricao}</p>
    </div>
  )
}

export function Lixeira() {
  const projetos = useDemo((e) => e.projetos.filter((p) => !!p.excluidoEm))
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const [excluir, setExcluir] = useState<string | null>(null)
  const { mostrar } = useToast()
  return (
    <div>
      <Cabecalho rotulo="Lixeira" titulo="Lixeira." descricao="Projetos excluídos ficam aqui por 30 dias. Restaure a qualquer momento; depois disso são apagados com suas mídias não usadas." />
      {projetos.length === 0 ? <EstadoVazio icone={<Trash2 className="h-5 w-5" />} titulo="A lixeira está vazia" /> : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {projetos.map((p) => (
            <li key={p.id}>
              <div className="overflow-hidden rounded-[8px] border border-black/5 opacity-70 grayscale-[40%]">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} />}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[15px] font-medium">{p.nome}</div><div className="text-[12px] text-texto3">Excluído {formatarRelativo(p.excluidoEm!).replace('Editado ', '')}</div></div>
                <div className="flex gap-1">
                  <button onClick={() => { restaurarProjeto(p.id); mostrar('Projeto restaurado.', 'sucesso') }} className="flex h-8 items-center gap-1.5 rounded-md border border-bordaForte px-2.5 text-[13px] hover:border-[#D4D4D4]"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>
                  <button aria-label={`Excluir ${p.nome} definitivamente`} onClick={() => setExcluir(p.id)} className="flex h-8 w-8 items-center justify-center rounded-md text-perigo hover:bg-perigo/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ModalConfirmar aberto={!!excluir} aoFechar={() => setExcluir(null)} titulo="Excluir definitivamente?" descricao="O projeto, seus links e snapshots serão apagados. Esta ação não pode ser desfeita." rotuloConfirmar="Excluir para sempre" perigoso aoConfirmar={() => { if (excluir) excluirDefinitivo(excluir); setExcluir(null); mostrar('Projeto excluído definitivamente.') }} />
    </div>
  )
}

type Filtro = 'tudo' | 'image' | 'svg' | 'model3d' | 'video' | 'lottie'

export function Biblioteca() {
  const assets = useDemo((e) => e.assets)
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [excluindo, setExcluindo] = useState<AssetDemo | null>(null)
  const { mostrar } = useToast()
  const lista = assets.filter((a) => filtro === 'tudo' || a.tipo === filtro || (filtro === 'image' && a.tipo === 'gif'))
  const total = assets.reduce((s, a) => s + a.bytes, 0)
  const Icone = (t: AssetDemo['tipo']) => (t === 'model3d' ? Box : t === 'video' ? Film : t === 'lottie' ? Sparkles : t === 'svg' ? PenTool : ImageIcon)
  return (
    <div>
      <Cabecalho rotulo="Biblioteca" titulo="Biblioteca." descricao={`Todos os arquivos do espaço: fotos, vetores do Figma e do Illustrator, modelos 3D do Blender, vídeos e animações Lottie. ${assets.length} arquivos · ${formatarBytes(total)}.`} />
      <div className="mb-6 flex flex-wrap gap-1 text-[14px]">
        {([['tudo', 'Tudo'], ['image', 'Imagens'], ['svg', 'Vetores'], ['model3d', '3D'], ['video', 'Vídeos'], ['lottie', 'Lottie']] as const).map(([id, r]) => (
          <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={cx('rounded-full px-3 py-1.5', filtro === id ? 'bg-grafite text-fundo' : 'text-texto2 hover:text-texto')}>{r}</button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {lista.map((a) => {
          const I = Icone(a.tipo)
          const uso = projetosQueUsam(a.id).length
          return (
            <li key={a.id} className="group relative">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-borda bg-superficie2">
                {a.thumbUrl ? <img src={a.thumbUrl} alt="" className={a.tipo === 'svg' ? 'h-full w-full object-contain p-4' : 'h-full w-full object-cover'} /> : <I className="h-8 w-8 text-texto3" strokeWidth={1.2} />}
              </div>
              <div className="mt-2 truncate text-[13px]">{a.nome}</div>
              <div className="text-[11px] text-texto3">{formatarBytes(a.bytes)} · {uso ? `em ${uso} projeto(s)` : 'sem uso'}</div>
              <button aria-label={`Excluir ${a.nome}`} onClick={() => setExcluindo(a)} className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md bg-superficie/95 text-texto2 shadow-sm hover:text-perigo group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          )
        })}
      </ul>
      {!lista.length && <EstadoVazio titulo="Nenhum arquivo neste filtro" descricao="Importe arquivos pelo editor (aba Arquivos) ou colando direto no canvas." />}
      <ModalConfirmar aberto={!!excluindo} aoFechar={() => setExcluindo(null)} titulo="Excluir arquivo?" descricao={excluindo && projetosQueUsam(excluindo.id).length ? `Usado em ${projetosQueUsam(excluindo.id).map((p) => p.nome).join(', ')}. As telas mostrarão “mídia indisponível”.` : 'Nenhum projeto usa este arquivo.'} rotuloConfirmar="Excluir" perigoso aoConfirmar={() => { if (excluindo) excluirAsset(excluindo.id, true); setExcluindo(null); mostrar('Arquivo excluído.') }} />
    </div>
  )
}

export function Compartilhados() {
  const projetos = useDemo((e) => e.projetos.filter((p) => !p.excluidoEm))
  const links = useDemo((e) => e.links)
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const comLinks = projetos.map((p) => ({ p, ativos: links.filter((l) => l.projectId === p.id && estadoDoLink({ expiresAt: l.expiraEm, revokedAt: l.revogadoEm }) === 'ativo') })).filter((x) => x.ativos.length)
  return (
    <div>
      <Cabecalho rotulo="Compartilhados" titulo="Compartilhados." descricao="Projetos com links privados ativos. Revogue um link e quem tem o endereço perde o acesso na hora." />
      {comLinks.length === 0 ? <EstadoVazio titulo="Nenhum link ativo" descricao="Publique um projeto e gere um link em Compartilhar." /> : (
        <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
          {comLinks.map(({ p, ativos }) => (
            <li key={p.id} className="flex items-center gap-4 p-4">
              <div className="w-28 shrink-0 overflow-hidden rounded-md">{p.documento.scenes[0] && <CapaProjeto cena={p.documento.scenes[0]} assets={assets} proporcao={16 / 10} />}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{p.nome}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-texto2">
                  <span>{ativos.length} link(s) ativo(s)</span>
                  <span>{ativos.reduce((s, l) => s + l.visualizacoes, 0)} visualizações</span>
                  {ativos.some((l) => l.senhaHash) && <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> com senha</span>}
                </div>
              </div>
              <Link href={`/app/projects/${p.id}/share`} className="rounded-md border border-bordaForte px-3 py-1.5 text-[13px] hover:border-[#D4D4D4]">Gerenciar</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
