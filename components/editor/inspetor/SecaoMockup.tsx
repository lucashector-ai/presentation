'use client'
/**
 * Mockup (frame com `mockup`): troca o modelo e a cor da moldura (preto, titânio natural, prata, branco ou
 * qualquer cor) regenerando a moldura e mantendo o que está na tela. No feed do Instagram, a cor muda só o metal
 * do celular e os campos rápidos editam nome, @, contadores, curtidas e legenda.
 */
import type { Camada, CamadaFrame } from '@/lib/scene/schema'
import { descendentes } from '@/lib/scene/arvore'
import { CAMPOS_FEED, CORES_MOLDURA, editarCampoFeed, MODELO_FEED, MODELOS_MOCKUP, regenerarMoldura, valorCampoFeed, type MockupMeta } from '@/lib/editor/mockups'
import { svgCelular, temaMoldura } from '@/lib/editor/mockupsSvg'
import { BotaoCor } from './CampoCor'
import { CampoTexto, Linha, Secao, SeletorLista } from './controles'
import { useCamadas, type PropsSecao } from './selecao'

export function SecaoMockup({ editor }: PropsSecao) {
  const { sel } = useCamadas(editor)
  const { cena, acoes } = editor
  const raiz = sel.length === 1 && sel[0]!.type === 'frame' && sel[0]!.mockup ? (sel[0] as CamadaFrame) : null
  if (!raiz || !cena) return null
  const meta = raiz.mockup!
  const camadas = cena.layers
  const feed = meta.modelo === MODELO_FEED

  const regenerar = (novo: Partial<MockupMeta>) => {
    const m = { ...meta, ...novo }
    const r = regenerarMoldura(raiz, camadas, m, `${raiz.id}-r${Date.now().toString(36)}`)
    // o conteúdo da tela sai dela antes (removerCamadas leva os descendentes), a moldura troca e ele volta para a tela nova
    if (r.soltar.length) acoes.atualizarCamadas(r.soltar, { parentId: raiz.id } as Partial<Camada>, false)
    acoes.removerCamadas(r.remover, false)
    acoes.atualizarCamadas([raiz.id], r.raiz as Partial<Camada>, false)
    acoes.inserirCamadas(r.inserir)
    if (r.conteudo.length) {
      const patches = new Map(r.conteudo.map((c) => [c.id, c.patch]))
      acoes.atualizarCamadas([...patches.keys()], (l) => ({ ...l, ...patches.get(l.id) }) as Camada, false)
    }
    acoes.selecionar([raiz.id])
  }

  // feed: a cor troca só o desenho do corpo do celular (posts, imagens e textos ficam como estão)
  const corDoFeed = (cor: string) => {
    const corpo = descendentes(raiz.id, camadas).find((c) => c.type === 'svg' && c.name === 'Corpo')
    if (corpo) acoes.atualizarCamadas([corpo.id], { markup: svgCelular(temaMoldura(cor)) } as Partial<Camada>, false)
    acoes.atualizarCamadas([raiz.id], { mockup: { ...meta, cor } } as Partial<Camada>)
  }
  const mudarCor = (cor: string) => (feed ? corDoFeed(cor) : regenerar({ cor }))
  const predefinida = CORES_MOLDURA.find((c) => c.id.toLowerCase() === meta.cor.toLowerCase())

  return (
    <Secao titulo={feed ? 'Feed do Instagram' : 'Mockup'} resumo={feed ? 'Feed' : MODELOS_MOCKUP.find((m) => m.id === meta.modelo)?.nome}>
      {!feed && <SeletorLista rotulo="Modelo do mockup" valor={meta.modelo} opcoes={MODELOS_MOCKUP.map((m) => ({ id: m.id, rotulo: m.nome }))} aoMudar={(modelo) => regenerar({ modelo })} />}
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <SeletorLista rotulo="Cor da moldura" valor={predefinida?.id ?? 'outra'} opcoes={[...CORES_MOLDURA.map((c) => ({ id: c.id, rotulo: c.nome })), ...(predefinida ? [] : [{ id: 'outra', rotulo: 'Cor personalizada' }])]} aoMudar={(cor) => cor !== 'outra' && mudarCor(cor)} />
        </div>
        <BotaoCor rotulo="Cor personalizada da moldura" cor={meta.cor} aoMudar={mudarCor} />
      </div>
      {feed ? (
        <>
          {CAMPOS_FEED.map((c) => (
            <Linha key={c.id} rotulo={c.rotulo}>
              <CampoTexto rotulo={c.rotulo} valor={valorCampoFeed(raiz.id, camadas, c.id)} aoConfirmar={(v) => { for (const m of editarCampoFeed(raiz.id, camadas, c.id, v)) acoes.atualizarCamadas([m.id], { text: m.text } as Partial<Camada>) }} />
            </Linha>
          ))}
          <p className="text-[11px] leading-relaxed text-texto2">Solte uma imagem em cada &ldquo;Post&rdquo; e em &ldquo;Destaque&rdquo; com o mesmo número. Na apresentação, clicar num post mostra o destaque dele à esquerda.</p>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-texto2">Arraste uma imagem ou vídeo para dentro de &ldquo;Tela&rdquo;: ela fica recortada no formato do aparelho. Trocar o modelo ou a cor mantém o conteúdo.</p>
      )}
    </Secao>
  )
}
