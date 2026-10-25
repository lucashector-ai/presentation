'use client'
/**
 * Bento grid (frame externo com `bento`): preset, espaço, raio e recorte dos cartões. Trocar o preset ou o
 * espaço regenera as linhas/colunas e os cartões enquanto eles estão vazios; com conteúdo dentro, só raio e
 * recorte mudam (para não jogar fora o que a pessoa já colocou).
 */
import { RefreshCw } from 'lucide-react'
import type { Camada, CamadaFrame } from '@/lib/scene/schema'
import { comDescendentes } from '@/lib/scene/arvore'
import { cartoesDoBento, gerarBento, PRESETS_BENTO } from '@/lib/editor/bento'
import { BotaoMini, CampoNum, Interruptor, Secao, SeletorLista } from './controles'
import { useCamadas, type PropsSecao } from './selecao'

export function SecaoBento({ editor }: PropsSecao) {
  const { sel } = useCamadas(editor)
  const { cena, acoes } = editor
  const raiz = sel.length === 1 && sel[0]!.type === 'frame' && sel[0]!.bento ? (sel[0] as CamadaFrame) : null
  if (!raiz || !cena) return null
  const meta = raiz.bento!
  const camadas = cena.layers
  const cartoes = cartoesDoBento(raiz.id, camadas)
  const comConteudo = cartoes.some((k) => camadas.some((l) => l.parentId === k.id))
  const clip = cartoes.length > 0 && cartoes.every((k) => k.type === 'frame' && k.clip)

  const regenerar = (novo: Partial<typeof meta>) => {
    const m = { ...meta, ...novo }
    const geradas = gerarBento({ x: raiz.x, y: raiz.y, width: raiz.width, height: raiz.height }, { preset: m.preset, gap: m.gap, radius: m.radius, padding: m.padding, clip, cores: cartoes.map((k) => (k as CamadaFrame).fill ?? '#F2F1EF') }, `${raiz.id}-r${Date.now().toString(36)}`)
    const [externo, ...filhas] = geradas
    const novas = filhas.map((c) => (c.parentId === externo!.id ? { ...c, parentId: raiz.id } : c)) as Camada[]
    const velhas = comDescendentes([raiz.id], camadas).filter((id) => id !== raiz.id)
    acoes.removerCamadas(velhas, false)
    acoes.atualizarCamadas([raiz.id], { bento: m, layout: (externo as CamadaFrame).layout } as Partial<Camada>, false)
    acoes.inserirCamadas(novas)
    acoes.selecionar([raiz.id])
  }

  return (
    <Secao titulo="Bento grid">
      <SeletorLista rotulo="Formato do bento" valor={meta.preset} opcoes={PRESETS_BENTO.map((p) => ({ id: p.id, rotulo: p.nome }))} aoMudar={(preset) => !comConteudo && regenerar({ preset })} />
      <div className="grid grid-cols-3 gap-1">
        <CampoNum prefixo="Esp." rotulo="Espaço entre cartões" valor={meta.gap} min={0} max={200} aoMudar={(gap) => !comConteudo && regenerar({ gap: Math.round(gap / 8) * 8 })} />
        <CampoNum prefixo="Marg." rotulo="Margem interna (espaço ao redor)" valor={meta.padding ?? 0} min={0} max={400} aoMudar={(padding) => !comConteudo && regenerar({ padding: Math.round(padding / 8) * 8 })} />
        <CampoNum prefixo="Raio" rotulo="Raio dos cartões" valor={meta.radius} min={0} max={200} aoMudar={(radius) => { acoes.atualizarCamadas([raiz.id], { bento: { ...meta, radius } } as Partial<Camada>, false); acoes.atualizarCamadas(cartoes.map((k) => k.id), { radius } as Partial<Camada>) }} />
      </div>
      <Interruptor rotulo="Recortar conteúdo dos cartões" ativo={clip} aoMudar={(v) => acoes.atualizarCamadas(cartoes.map((k) => k.id), { clip: v } as Partial<Camada>)} />
      <div className="flex items-center justify-between gap-2 text-[11px] text-texto2">
        <span>{comConteudo ? 'Cartões com conteúdo: esvazie-os para trocar o formato, o espaço ou a margem.' : `${cartoes.length} cartões vazios. Redimensione o bento: os cartões acompanham.`}</span>
        {!comConteudo && <BotaoMini rotulo="Regerar cartões" onClick={() => regenerar({})}><RefreshCw className="h-3.5 w-3.5" /></BotaoMini>}
      </div>
    </Secao>
  )
}
