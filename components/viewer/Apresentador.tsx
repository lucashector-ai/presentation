'use client'
/**
 * Visão do apresentador: tela atual, próxima tela, notas, cronômetro e relógio.
 * Controla a janela do público (aberta com "Abrir tela do público") pelo BroadcastChannel.
 */
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { MiniaturaCena } from '@/components/editor/MiniaturaCena'
import { useFontesDoDocumento } from '@/components/renderer/fontes'
import { useTamanho } from '@/components/renderer/useTamanho'
import { nomeCanal, useCanal } from './canal'
import { Marca } from '@/components/ui/Logo'

function formatarTempo(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function Apresentador({ projetoId, nome, documento, assets, aoSair }: { projetoId: string; nome: string; documento: DocumentoProjeto; assets: AssetsResolvidos; aoSair: () => void }) {
  useFontesDoDocumento(documento)
  const [indice, setIndice] = useState(0)
  const [publicoConectado, setPublicoConectado] = useState(false)
  const [inicio, setInicio] = useState<number | null>(null)
  const [pausadoEm, setPausadoEm] = useState<number | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const total = documento.scenes.length
  const atual = documento.scenes[indice]
  const proxima = documento.scenes[indice + 1]
  const { ref: refAtual, tamanho: tamAtual } = useTamanho<HTMLDivElement>()

  const enviar = useCanal(nomeCanal(projetoId), (m) => {
    if (m.tipo === 'estado') {
      setPublicoConectado(true)
      setIndice(m.indice)
    }
  })

  useEffect(() => {
    enviar({ tipo: 'pedirEstado' })
    const t = window.setInterval(() => setAgora(Date.now()), 500)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ir = useCallback(
    (i: number) => {
      const alvo = Math.max(0, Math.min(total - 1, i))
      setIndice(alvo)
      enviar({ tipo: 'ir', indice: alvo })
      setInicio((v) => v ?? Date.now())
    },
    [enviar, total]
  )

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(indice + 1) }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(indice - 1) }
      if (e.key === 'Escape') aoSair()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ir, indice, aoSair])

  const abrirPublico = () => {
    window.open(`/app/projects/${projetoId}/apresentar?canal=1&inicio=${indice}`, `mostra-publico-${projetoId}`, 'popup=yes,width=1280,height=720')
    setInicio((v) => v ?? Date.now())
  }

  const decorrido = inicio ? (pausadoEm ?? agora) - inicio : 0
  const larguraAtual = atual ? Math.min(tamAtual.width, (tamAtual.height * atual.size.width) / atual.size.height) : 0

  return (
    <div className="flex h-dvh flex-col bg-grafite text-[#FAFAF9]">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 px-5">
        <Marca className="text-[18px]" />
        <span className="text-white/30">/</span>
        <span className="truncate text-sm">{nome}</span>
        <span className="rotulo-mono !text-white/40">Visão do apresentador</span>
        <span className="flex-1" />
        <span className={`flex items-center gap-2 text-xs ${publicoConectado ? 'text-[#22A06B]' : 'text-white/50'}`}>
          <span className={`h-2 w-2 rounded-full ${publicoConectado ? 'bg-[#22A06B]' : 'bg-white/30'}`} />
          {publicoConectado ? 'Tela do público conectada' : 'Tela do público fechada'}
        </span>
        <button onClick={abrirPublico} className="flex h-9 items-center gap-2 rounded-lg bg-violeta px-3 text-sm font-medium hover:bg-[#4A55E0]"><ExternalLink className="h-4 w-4" /> Abrir tela do público</button>
        <button aria-label="Sair da visão do apresentador" onClick={() => { enviar({ tipo: 'encerrar' }); aoSair() }} className="rounded-lg p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 flex-col gap-3">
          <div className="rotulo-mono !text-white/40">Agora · {String(indice + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} {atual?.title ? `— ${atual.title}` : ''}</div>
          <div ref={refAtual} className="flex min-h-0 flex-1 items-center justify-center">
            {atual && larguraAtual > 0 && <MiniaturaCena cena={atual} assets={assets} largura={larguraAtual} className="border-white/10 shadow-painel" />}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button aria-label="Tela anterior" onClick={() => ir(indice - 1)} disabled={indice === 0} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
            <button aria-label="Próxima tela" onClick={() => ir(indice + 1)} disabled={indice === total - 1} className="flex h-11 items-center gap-2 rounded-full bg-[#FAFAF9] px-6 text-sm font-medium text-grafite hover:bg-white disabled:opacity-30">Próxima <ChevronRight className="h-4 w-4" /></button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-5">
          <div>
            <div className="rotulo-mono mb-2 !text-white/40">Próxima</div>
            {proxima ? <MiniaturaCena cena={proxima} assets={assets} largura={380} className="border-white/10" /> : <div className="flex aspect-video items-center justify-center rounded-lg border border-white/10 text-sm text-white/40">Fim da apresentação</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-4">
              <div className="rotulo-mono mb-1 !text-white/40">Tempo</div>
              <div className="mono text-3xl tabular-nums" aria-live="off">{formatarTempo(decorrido)}</div>
              <div className="mt-2 flex gap-1">
                <button aria-label={pausadoEm ? 'Continuar cronômetro' : 'Pausar cronômetro'} onClick={() => { if (!inicio) setInicio(Date.now()); else if (pausadoEm) { setInicio(inicio + (Date.now() - pausadoEm)); setPausadoEm(null) } else setPausadoEm(Date.now()) }} className="rounded-md p-1.5 hover:bg-white/10">{pausadoEm || !inicio ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
                <button aria-label="Zerar cronômetro" onClick={() => { setInicio(null); setPausadoEm(null) }} className="rounded-md p-1.5 hover:bg-white/10"><RotateCcw className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <div className="rotulo-mono mb-1 flex items-center gap-1 !text-white/40"><Clock className="h-3 w-3" /> Relógio</div>
              <div className="mono text-3xl tabular-nums">{new Date(agora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="rotulo-mono mb-2 !text-white/40">Notas</div>
            <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white/5 p-4 text-[17px] leading-relaxed text-white/90">{atual?.notes || <span className="text-white/40">Sem notas para esta tela. Escreva no editor, na aba Telas.</span>}</div>
          </div>
        </aside>
      </div>
    </div>
  )
}
