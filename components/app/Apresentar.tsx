'use client'
import { useRouter } from 'next/navigation'
import { useDemo } from '@/lib/demo/useDemo'
import { Viewer } from '@/components/viewer/Viewer'

/** Rota dedicada e limpa para o autor apresentar o rascunho atual (Fluxo A, passo 08). */
export function Apresentar({ id }: { id: string }) {
  const router = useRouter()
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === id && !p.excluidoEm))
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  if (!projeto) return null
  return (
    <div className="h-dvh w-full bg-black">
      <Viewer documento={projeto.documento} assets={assets} nome={projeto.nome} aoSair={() => router.push(`/app/projects/${id}`)} />
    </div>
  )
}
