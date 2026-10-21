'use client'
import { useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDemo } from '@/lib/demo/useDemo'
import { Viewer } from '@/components/viewer/Viewer'
import { Apresentador } from '@/components/viewer/Apresentador'
import { nomeCanal } from '@/components/viewer/canal'
import { destinoSeguro, ehEditor, lembrarTela, sairDaTelaCheia, veioDe } from '@/components/viewer/retorno'

/**
 * Rota limpa para o autor apresentar o rascunho atual. Com ?canal=1 é a janela do público controlada pelo apresentador.
 * Esc / X / Voltar do navegador levam de volta a `?voltar=` (editor, detalhes, painel…); padrão: detalhes do projeto.
 */
export function Apresentar({ id, apresentador }: { id: string; apresentador?: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const projeto = useDemo((e) => e.projetos.find((p) => p.id === id && !p.excluidoEm))
  const assets = useDemo((e) => Object.fromEntries(e.assets.map((a) => [a.id, a])))
  const voltar = destinoSeguro(params.get('voltar')) ?? `/app/projects/${id}`
  const doEditor = ehEditor(voltar, id)
  const cenas = projeto?.documento.scenes
  const comCanal = params.get('canal') === '1'
  const indiceInicial = useMemo(() => Math.max(0, Math.min((cenas?.length ?? 1) - 1, Number(params.get('inicio') ?? 0) || 0)), [params, cenas?.length])

  // vindo do editor: a tela atual fica guardada para o editor selecioná-la ao voltar (inclusive pelo botão Voltar)
  const aoMudarTela = useCallback((i: number) => { const c = cenas?.[i]; if (doEditor && c) lembrarTela(id, c.id) }, [cenas, doEditor, id])

  const sair = useCallback((i?: number) => {
    if (i != null) aoMudarTela(i)
    sairDaTelaCheia()
    // aberta a partir de `voltar` nesta aba: volta no histórico (sem entrada duplicada); senão, substitui
    if (veioDe(voltar)) router.back()
    else router.replace(voltar)
  }, [aoMudarTela, voltar, router])

  useEffect(() => { document.documentElement.style.background = '#000'; return () => { document.documentElement.style.background = '' } }, [])

  if (!projeto) return <div className={`h-dvh w-full ${apresentador ? 'bg-grafite' : 'bg-[#111]'}`} />
  if (apresentador) return <Apresentador projetoId={id} nome={projeto.nome} documento={projeto.documento} assets={assets} indiceInicial={indiceInicial} aoMudarTela={aoMudarTela} aoSair={sair} />
  return (
    <div className="h-dvh w-full bg-black">
      <Viewer documento={projeto.documento} assets={assets} nome={projeto.nome} indiceInicial={indiceInicial} canal={comCanal ? nomeCanal(id) : undefined} aoMudarTela={comCanal ? undefined : aoMudarTela} aoSair={comCanal ? () => window.close() : sair} />
    </div>
  )
}
