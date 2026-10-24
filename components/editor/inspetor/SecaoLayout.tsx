'use client'
/** Layout (como no Figma): fluxo do frame (livre/vertical/horizontal), dimensões com travar proporção e recorte. */
import { useState } from 'react'
import { Frame, LayoutPanelLeft, Link2, MoveHorizontal, Square, Type, Unlink2 } from 'lucide-react'
import { comDimensionamento, dimensionamentoDoModo, modoTexto, type ModoTexto } from '@/lib/editor/medirTexto'
import { mapaDe, paiDe, temAutoLayout } from '@/lib/scene/arvore'
import { abrirPreencher } from '../PreencherGrade'
import { parseCamada, type Camada, type CamadaForma, type CamadaFrame } from '@/lib/scene/schema'
import { BotaoMini, CampoNum, LinhaCampos, Secao, Segmentado } from './controles'
import { IconeAutoLayout } from './icones'
import { comum, useCamadas, type PropsSecao } from './selecao'

const travas = new Map<string, boolean>()
const proporcionalPorPadrao = (c: Camada) => c.type === 'svg' || c.type === 'image' || c.type === 'model3d' || c.type === 'lottie'
const travada = (c: Camada) => travas.get(c.id) ?? proporcionalPorPadrao(c)

type Fluxo = 'livre' | 'vertical' | 'horizontal'

/** Retângulo → frame com recorte (mesmo ID, lugar, cor, gradiente, raio, traço, efeitos e animações). */
function retanguloEmFrame(r: CamadaForma): Camada {
  const { shape: _s, fill, pattern: _p, patternScale: _ps, patternWeight: _pw, patternOpacity: _po, dash: _d, count: _c, ratio: _r, vetor: _v, fillRule: _f, ...resto } = r as CamadaForma & Record<string, unknown>
  return parseCamada({ ...resto, type: 'frame', fill, clip: true, name: r.name ?? 'Frame' })
}

export function SecaoLayout({ editor }: PropsSecao) {
  const { sel, ids, setFn } = useCamadas(editor)
  const { acoes } = editor
  const [, atualizar] = useState(0)
  const l = sel[0]
  if (!l) return null
  const frame = sel.length === 1 && l.type === 'frame' ? (l as CamadaFrame) : undefined
  const retangulo = sel.length === 1 && l.type === 'shape' && l.shape === 'rect' && !l.isMask ? (l as CamadaForma) : undefined
  const trava = sel.every(travada)
  const w = comum(sel, (c) => Math.round(c.width * 100) / 100)
  const h = comum(sel, (c) => Math.round(c.height * 100) / 100)
  const largura = (fn: (c: Camada) => number) => setFn((c) => { const width = Math.max(1, fn(c)); return { ...c, width, height: trava ? Math.max(1, Math.round((width * c.height) / c.width)) : c.height } })
  const altura = (fn: (c: Camada) => number) => setFn((c) => { const height = Math.max(1, fn(c)); return { ...c, height, width: trava ? Math.max(1, Math.round((height * c.width) / c.height)) : c.width } })
  return (
    <Secao
      titulo="Layout"
      // como no Figma: as ações ficam no título (preencher a tela; envolver num frame ou num auto layout)
      acao={
        <>
          <BotaoMini rotulo="Preencher a tela: metades, terços, quartos ou células (Ctrl+Alt+setas)" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); abrirPreencher(r.left - 250, r.bottom + 6) }}><LayoutPanelLeft className="h-3.5 w-3.5" /></BotaoMini>
          {!frame && <BotaoMini rotulo="Envolver num frame (Ctrl+Alt+G)" onClick={() => acoes.emoldurar(ids)}><Frame className="h-3.5 w-3.5" /></BotaoMini>}
          {!frame && <BotaoMini rotulo={`Adicionar auto layout (Shift+A): envolve ${sel.length > 1 ? 'a seleção' : 'a camada'} num frame que se ajusta ao conteúdo`} onClick={() => acoes.adicionarAutoLayout(ids)}><IconeAutoLayout mais /></BotaoMini>}
        </>
      }
    >
      {frame && (
        <LinhaCampos rotulo="Fluxo">
          <Segmentado<Fluxo>
            rotulo="Fluxo do frame"
            icones
            valor={!frame.layout ? 'livre' : frame.layout.direction === 'vertical' ? 'vertical' : 'horizontal'}
            aoMudar={(f) => {
              if (f === 'livre') return frame.layout && acoes.removerAutoLayout(frame.id)
              if (!frame.layout) acoes.adicionarAutoLayout([frame.id])
              acoes.atualizarLayout(frame.id, { direction: f })
            }}
            opcoes={[
              { id: 'livre', rotulo: 'Livre (sem auto layout)', icone: <Frame className="h-3.5 w-3.5" /> },
              { id: 'vertical', rotulo: 'Auto layout vertical', icone: <IconeAutoLayout direcao="vertical" /> },
              { id: 'horizontal', rotulo: 'Auto layout horizontal', icone: <IconeAutoLayout direcao="horizontal" /> },
            ]}
          />
        </LinhaCampos>
      )}
      <LinhaCampos rotulo="Tamanho">
      <div className="grid grid-cols-[1fr_1fr_22px] items-center gap-1.5">
        <CampoNum prefixo="W" rotulo="Largura" valor={w} min={1} aoMudar={(v) => largura(() => v)} aoDelta={(d) => largura((c) => c.width + d)} />
        <CampoNum prefixo="H" rotulo="Altura" valor={h} min={1} aoMudar={(v) => altura(() => v)} aoDelta={(d) => altura((c) => c.height + d)} />
        <BotaoMini rotulo={trava ? 'Destravar proporção' : 'Travar proporção'} ativo={trava} onClick={() => { sel.forEach((c) => travas.set(c.id, !trava)); atualizar((n) => n + 1) }}>
          {trava ? <Link2 className="h-3.5 w-3.5" /> : <Unlink2 className="h-3.5 w-3.5" />}
        </BotaoMini>
      </div>
      </LinhaCampos>
      {/* recorte: no frame liga o clip; num retângulo, ele vira um frame que recorta o que for colocado dentro */}
      {(frame || retangulo) && (
        <label className="ml-[54px] flex h-6 cursor-pointer items-center gap-2 text-[11px] text-texto2 hover:text-texto" title={frame ? 'Esconde o que passar das bordas do frame' : 'Transforma o retângulo num frame (mesma cor, raio e traço) que recorta o que for colocado dentro'}>
          <input type="checkbox" checked={!!frame?.clip} onChange={(e) => (frame ? acoes.atualizarCamadas([frame.id], { clip: e.target.checked } as Partial<Camada>) : retangulo && acoes.atualizarCamadas([retangulo.id], (c) => retanguloEmFrame(c as CamadaForma)))} className="h-3.5 w-3.5 accent-[rgb(var(--cor-acento))]" />
          Recortar conteúdo
        </label>
      )}
      {sel.length === 1 && l.type === 'text' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-texto3">Redimensionar</span>
          <div className="w-[104px]">
            <Segmentado<ModoTexto>
              rotulo="Redimensionar texto"
              valor={modoTexto(l)}
              // já com o tamanho medido: um único passo de desfazer volta também a altura/largura de antes
              aoMudar={(m) => setFn((c) => (c.type === 'text' ? comDimensionamento(c, dimensionamentoDoModo(m), !temAutoLayout(paiDe(c, mapaDe(editor.cena?.layers ?? [])))) : c), { manterDimensionamento: true })}
              icones
              opcoes={[
                { id: 'larguraAuto', rotulo: 'Auto horizontal (cresce com o texto)', icone: <MoveHorizontal className="h-3.5 w-3.5" /> },
                { id: 'alturaAuto', rotulo: 'Auto vertical (quebra linha)', icone: <Type className="h-3.5 w-3.5" /> },
                { id: 'fixo', rotulo: 'Tamanho fixo', icone: <Square className="h-3 w-3" /> },
              ]}
            />
          </div>
        </div>
      )}
    </Secao>
  )
}
