'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDemo } from '@/lib/demo/useDemo'
import { Viewer } from '@/components/viewer/Viewer'
import { Apresentador } from '@/components/viewer/Apresentador'
import { nomeCanal } from '@/components/viewer/canal'

/** Rota limpa para o autor apresentar o rascunho atual. Com ?canal=1 é a janela do público controlada pelo apresentador. */
export function Apresentar({ id, apresentador }: { id: string; apresentador?: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === id && !p.excluidoEm))
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  if (!projeto) return null
  if (apresentador) return <Apresentador projetoId={id} nome={projeto.nome} documento={projeto.documento} assets={assets} aoSair={() => router.push(`/app/projects/${id}/edit`)} />
  const comCanal = params.get('canal') === '1'
  return (
    <div className="h-dvh w-full bg-black">
      <Viewer documento={projeto.documento} assets={assets} nome={projeto.nome} indiceInicial={Number(params.get('inicio') ?? 0) || 0} canal={comCanal ? nomeCanal(id) : undefined} aoSair={comCanal ? () => window.close() : () => router.push(`/app/projects/${id}`)} />
    </div>
  )
}
