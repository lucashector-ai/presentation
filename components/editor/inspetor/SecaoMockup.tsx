'use client'
/** Mockup (frame com `mockup`): troca o modelo e a cor da moldura; regenera a moldura mantendo o que está na tela. */
import type { Camada, CamadaFrame } from '@/lib/scene/schema'
import { comDescendentes } from '@/lib/scene/arvore'
import { gerarMockup, MODELOS_MOCKUP } from '@/lib/editor/mockups'
import { BotaoCor } from './CampoCor'
import { Secao, SeletorLista } from './controles'
import { useCamadas, type PropsSecao } from './selecao'

export function SecaoMockup({ editor }: PropsSecao) {
  const { sel } = useCamadas(editor)
  const { cena, acoes } = editor
  const raiz = sel.length === 1 && sel[0]!.type === 'frame' && sel[0]!.mockup ? (sel[0] as CamadaFrame) : null
  if (!raiz || !cena) return null
  const meta = raiz.mockup!
  const camadas = cena.layers
  const telaAntiga = camadas.find((l) => l.parentId === raiz.id && l.type === 'frame' && l.name?.startsWith('Tela'))
  const conteudo = telaAntiga ? camadas.filter((l) => l.parentId === telaAntiga.id) : []

  const regenerar = (novo: Partial<typeof meta>) => {
    const m = { ...meta, ...novo }
    const geradas = gerarMockup(m.modelo, { x: raiz.x, y: raiz.y, largura: raiz.width }, m, `${raiz.id}-r${Date.now().toString(36)}`)
    const [externo, ...filhas] = geradas
    const novas = filhas.map((c) => (c.parentId === externo!.id ? { ...c, parentId: raiz.id } : c)) as Camada[]
    const telaNova = novas.find((l) => l.type === 'frame' && l.name?.startsWith('Tela'))
    const velhas = comDescendentes([raiz.id], camadas).filter((id) => id !== raiz.id && !conteudo.some((c) => c.id === id))
    acoes.removerCamadas(velhas, false)
    acoes.atualizarCamadas([raiz.id], { mockup: m, width: externo!.width, height: externo!.height } as Partial<Camada>, false)
    acoes.inserirCamadas(novas)
    // o que estava na tela antiga vai para a nova, centralizado
    if (telaNova && conteudo.length) acoes.atualizarCamadas(conteudo.map((c) => c.id), (l) => ({ ...l, parentId: telaNova.id, x: Math.round(telaNova.x + (telaNova.width - l.width) / 2), y: Math.round(telaNova.y + (telaNova.height - l.height) / 2) }), false)
    acoes.selecionar([raiz.id])
  }

  return (
    <Secao titulo="Mockup">
      <SeletorLista rotulo="Modelo do mockup" valor={meta.modelo} opcoes={MODELOS_MOCKUP.map((m) => ({ id: m.id, rotulo: m.nome }))} aoMudar={(modelo) => regenerar({ modelo })} />
      <div className="flex items-center justify-between text-[12px]"><span className="text-texto2">Cor da moldura</span><BotaoCor rotulo="Cor da moldura" cor={meta.cor} aoMudar={(cor) => regenerar({ cor })} /></div>
      <p className="text-[11px] leading-relaxed text-texto2">Arraste uma imagem ou vídeo para dentro de "Tela": ela fica recortada no formato do aparelho. Trocar o modelo mantém o conteúdo.</p>
    </Secao>
  )
}
