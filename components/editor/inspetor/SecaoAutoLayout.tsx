'use client'
/**
 * Auto layout no painel Design (modelo do Figma):
 * - frame com auto layout: direção (horizontal, vertical, quebra), gap (número ou automático), padding
 *   (horizontal/vertical ou por lado), alinhamento 3×3, largura/altura Hug/Fixo/Fill, recorte e aparência do frame
 * - filho de auto layout: dimensionamento por eixo e posição absoluta
 * - texto: largura automática / altura automática / fixo
 * - outras seleções: "+" envolve num frame com auto layout (Shift+A)
 * Usa só os controles de ./controles (sem estilo próprio além do pad 3×3).
 */
import { useState } from 'react'
import { ArrowDown, ArrowRight, Columns2, Frame, Minus, MoveHorizontal, Plus, Square, Type, WrapText } from 'lucide-react'
import type { AutoLayout, Camada, CamadaFrame, Dimensionamento } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { LAYOUT_PADRAO } from '@/lib/editor/autolayout'
import { mapaDe, paiDe, temAutoLayout } from '@/lib/scene/arvore'
import { dimensionamentoDoModo, modoTexto, type ModoTexto } from '@/lib/editor/medirTexto'
import { BotaoIcone, cx } from '@/components/ui'
import { CampoCor, CampoNum, Interruptor, Linha, Secao, Segmentado, SeletorLista } from './controles'

const NOMES_DIM: Record<Dimensionamento, string> = { fixed: 'Fixo', hug: 'Abraçar', fill: 'Preencher' }
const POS = ['start', 'center', 'end'] as const
const NOMES_V = { start: 'em cima', center: 'no meio', end: 'embaixo' }
const NOMES_H = { start: 'à esquerda', center: 'ao centro', end: 'à direita' }

export function SecaoAutoLayout({ editor }: { editor: Editor }) {
  const { camadasSelecionadas: sel, acoes, cena } = editor
  if (!cena || !sel.length) return null
  const ids = sel.map((l) => l.id)
  const unica = sel.length === 1 ? sel[0]! : undefined
  const mapa = mapaDe(cena.layers)
  const pai = unica ? paiDe(unica, mapa) : undefined
  const paiComLayout = temAutoLayout(pai)

  return (
    <>
      {unica?.type === 'text' && <RedimensionamentoTexto camada={unica} aoMudar={(m) => acoes.atualizarCamadas([unica.id], dimensionamentoDoModo(m))} />}
      {unica && paiComLayout && <FilhoDoLayout camada={unica} editor={editor} />}
      {unica?.type === 'frame' ? (
        <>
          <PainelLayout frame={unica} editor={editor} podeFill={paiComLayout} />
          <AparenciaFrame frame={unica} editor={editor} />
        </>
      ) : (
        <Secao
          titulo="Auto layout"
          acao={<BotaoIcone rotulo="Adicionar auto layout (Shift+A)" className="h-6 w-6" onClick={() => acoes.adicionarAutoLayout(ids)}><Plus className="h-3.5 w-3.5" /></BotaoIcone>}
        >
          <p className="text-[12px] text-texto2">Envolve {sel.length > 1 ? 'a seleção' : 'a camada'} num frame que se ajusta ao conteúdo. <button type="button" className="text-acento hover:underline" onClick={() => acoes.emoldurar(ids)}>Só frame (Ctrl+Alt+G)</button></p>
        </Secao>
      )}
    </>
  )
}

function RedimensionamentoTexto({ camada, aoMudar }: { camada: Camada; aoMudar: (m: ModoTexto) => void }) {
  return (
    <Secao titulo="Redimensionar texto">
      <Segmentado<ModoTexto>
        rotulo="Redimensionar texto"
        valor={modoTexto(camada)}
        aoMudar={aoMudar}
        icones
        opcoes={[
          { id: 'larguraAuto', rotulo: 'Redimensionar: automático na horizontal', icone: <span className="flex items-center gap-1 text-[11px]"><MoveHorizontal className="h-3.5 w-3.5" /> Largura</span> },
          { id: 'alturaAuto', rotulo: 'Redimensionar: automático na vertical', icone: <span className="flex items-center gap-1 text-[11px]"><Type className="h-3.5 w-3.5" /> Altura</span> },
          { id: 'fixo', rotulo: 'Redimensionar: tamanho fixo', icone: <span className="flex items-center gap-1 text-[11px]"><Square className="h-3 w-3" /> Fixo</span> },
        ]}
      />
    </Secao>
  )
}

function FilhoDoLayout({ camada: l, editor }: { camada: Camada; editor: Editor }) {
  const { acoes } = editor
  const podeHug = (l.type === 'frame' && !!l.layout) || l.type === 'text'
  const opcoes = (['fixed', ...(podeHug ? (['hug'] as const) : []), 'fill'] as Dimensionamento[]).map((d) => ({ id: d, rotulo: NOMES_DIM[d] }))
  return (
    <Secao titulo="No auto layout">
      {!l.absolute && (
        <div className="grid grid-cols-2 gap-2">
          <SeletorLista rotulo="Dimensionamento horizontal no auto layout" valor={l.sizingW ?? 'fixed'} opcoes={opcoes} aoMudar={(v) => acoes.atualizarCamadas([l.id], { sizingW: v as Dimensionamento })} />
          <SeletorLista rotulo="Dimensionamento vertical no auto layout" valor={l.sizingH ?? 'fixed'} opcoes={opcoes} aoMudar={(v) => acoes.atualizarCamadas([l.id], { sizingH: v as Dimensionamento })} />
        </div>
      )}
      <Linha rotulo="Absoluta"><Interruptor rotulo="Posição absoluta (ignorar auto layout)" ativo={!!l.absolute} aoMudar={(v) => acoes.atualizarCamadas([l.id], { absolute: v || undefined })} /></Linha>
    </Secao>
  )
}

function PainelLayout({ frame: f, editor, podeFill }: { frame: CamadaFrame; editor: Editor; podeFill: boolean }) {
  const { acoes } = editor
  const [porLado, setPorLado] = useState(false)
  if (!f.layout) {
    return (
      <Secao titulo="Auto layout" acao={<BotaoIcone rotulo="Adicionar auto layout (Shift+A)" className="h-6 w-6" onClick={() => acoes.adicionarAutoLayout([f.id])}><Plus className="h-3.5 w-3.5" /></BotaoIcone>}>
        <p className="text-[12px] text-texto2">Frame livre: os filhos ficam onde você colocar.</p>
      </Secao>
    )
  }
  const L = { ...LAYOUT_PADRAO, ...f.layout }
  const set = (patch: Partial<AutoLayout>) => acoes.atualizarLayout(f.id, patch)
  const horizontal = L.direction !== 'vertical'
  const pad = L.padding
  const opcoesDim = (['fixed', 'hug', ...(podeFill ? (['fill'] as const) : [])] as Dimensionamento[]).map((d) => ({ id: d, rotulo: NOMES_DIM[d] }))
  const setGapAuto = (auto: boolean) => {
    set({ gapAuto: auto })
    // como no Figma: espaço automático não combina com abraçar no eixo principal
    if (auto) acoes.atualizarCamadas([f.id], horizontal ? (f.sizingW === 'hug' ? { sizingW: 'fixed' } : {}) : f.sizingH === 'hug' ? { sizingH: 'fixed' } : {})
  }
  return (
    <Secao titulo="Auto layout" acao={<BotaoIcone rotulo="Remover auto layout (Shift+Alt+A)" className="h-6 w-6" onClick={() => acoes.removerAutoLayout(f.id)}><Minus className="h-3.5 w-3.5" /></BotaoIcone>}>
      <Segmentado<AutoLayout['direction']>
        rotulo="Direção do auto layout"
        icones
        valor={L.direction}
        aoMudar={(direction) => set({ direction })}
        opcoes={[
          { id: 'vertical', rotulo: 'Vertical', icone: <ArrowDown className="h-3.5 w-3.5" /> },
          { id: 'horizontal', rotulo: 'Horizontal', icone: <ArrowRight className="h-3.5 w-3.5" /> },
          { id: 'wrap', rotulo: 'Quebrar linha', icone: <WrapText className="h-3.5 w-3.5" /> },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <SeletorLista rotulo="Dimensionamento horizontal do frame" valor={f.sizingW ?? 'fixed'} opcoes={opcoesDim.map((o) => ({ ...o, rotulo: `L · ${o.rotulo}` }))} aoMudar={(v) => acoes.atualizarCamadas([f.id], { sizingW: v as Dimensionamento })} />
        <SeletorLista rotulo="Dimensionamento vertical do frame" valor={f.sizingH ?? 'fixed'} opcoes={opcoesDim.map((o) => ({ ...o, rotulo: `A · ${o.rotulo}` }))} aoMudar={(v) => acoes.atualizarCamadas([f.id], { sizingH: v as Dimensionamento })} />
      </div>
      <div className="flex gap-3">
        <PadAlinhamento valor={{ x: L.alignX, y: L.alignY }} horizontal={horizontal} espacoAuto={L.gapAuto} aoMudar={(x, y) => set({ alignX: x, alignY: y })} />
        <div className="min-w-0 flex-1 space-y-2">
          {L.gapAuto ? (
            <button type="button" aria-label="Espaço entre itens: automático (clique para número)" onClick={() => setGapAuto(false)} className="flex h-7 w-full items-center gap-1.5 rounded-md bg-superficie2 px-2 text-left text-[13px] text-texto">
              <Columns2 className="h-3 w-3 text-texto3" /> Auto
            </button>
          ) : (
            <CampoNum prefixo={<Columns2 className={cx('h-3 w-3', !horizontal && 'rotate-90')} />} rotulo="Espaço entre itens" valor={L.gap} min={-2000} max={2000} aoMudar={(gap) => set({ gap })} />
          )}
          <button type="button" aria-pressed={L.gapAuto} onClick={() => setGapAuto(!L.gapAuto)} className={cx('h-6 w-full rounded-md text-[12px]', L.gapAuto ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover')}>
            {L.gapAuto ? 'Espaço automático' : 'Usar espaço automático'}
          </button>
          {L.direction === 'wrap' && <CampoNum prefixo="↕" rotulo="Espaço entre linhas" valor={L.rowGap ?? L.gap} min={-2000} max={2000} aoMudar={(rowGap) => set({ rowGap })} />}
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[12px] text-texto2">Padding</span>
        <button type="button" aria-pressed={porLado} onClick={() => setPorLado((v) => !v)} className={cx('rounded px-1.5 py-0.5 text-[11px]', porLado ? 'bg-acentoSuave text-acento' : 'text-texto2 hover:bg-hover')}>Por lado</button>
      </div>
      {porLado ? (
        <div className="grid grid-cols-2 gap-2">
          <CampoNum prefixo="↑" rotulo="Padding superior" valor={pad.top} min={0} max={2000} aoMudar={(top) => set({ padding: { ...pad, top } })} />
          <CampoNum prefixo="→" rotulo="Padding direito" valor={pad.right} min={0} max={2000} aoMudar={(right) => set({ padding: { ...pad, right } })} />
          <CampoNum prefixo="↓" rotulo="Padding inferior" valor={pad.bottom} min={0} max={2000} aoMudar={(bottom) => set({ padding: { ...pad, bottom } })} />
          <CampoNum prefixo="←" rotulo="Padding esquerdo" valor={pad.left} min={0} max={2000} aoMudar={(left) => set({ padding: { ...pad, left } })} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <CampoNum prefixo="⇹" rotulo="Padding horizontal" valor={pad.left === pad.right ? pad.left : Math.round((pad.left + pad.right) / 2)} min={0} max={2000} aoMudar={(v) => set({ padding: { ...pad, left: v, right: v } })} />
          <CampoNum prefixo="⇳" rotulo="Padding vertical" valor={pad.top === pad.bottom ? pad.top : Math.round((pad.top + pad.bottom) / 2)} min={0} max={2000} aoMudar={(v) => set({ padding: { ...pad, top: v, bottom: v } })} />
        </div>
      )}
    </Secao>
  )
}

/** Grade 3×3 de alinhamento (como no Figma): clique escolhe x/y; com espaço automático só o eixo cruzado importa. */
function PadAlinhamento({ valor, horizontal, espacoAuto, aoMudar }: { valor: { x: AutoLayout['alignX']; y: AutoLayout['alignY'] }; horizontal: boolean; espacoAuto: boolean; aoMudar: (x: AutoLayout['alignX'], y: AutoLayout['alignY']) => void }) {
  return (
    <div role="radiogroup" aria-label="Alinhamento" className="grid h-[68px] w-[68px] shrink-0 grid-cols-3 grid-rows-3 rounded-md bg-superficie2 p-1">
      {POS.map((y) =>
        POS.map((x) => {
          const ativo = espacoAuto ? (horizontal ? valor.y === y : valor.x === x) : valor.x === x && valor.y === y
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={`Alinhar ${NOMES_V[y]} ${NOMES_H[x]}`}
              title={`Alinhar ${NOMES_V[y]} ${NOMES_H[x]}`}
              onClick={() => aoMudar(x, y)}
              className="group flex items-center justify-center rounded-[4px] hover:bg-superficie"
            >
              {ativo ? (
                <span className={cx('flex gap-[2px]', horizontal ? 'flex-row' : 'flex-col', { start: horizontal ? 'items-start' : 'items-start', center: 'items-center', end: 'items-end' }[horizontal ? y : x])}>
                  <span className={cx('rounded-[1px] bg-acento', horizontal ? 'h-[9px] w-[3px]' : 'h-[3px] w-[9px]')} />
                  <span className={cx('rounded-[1px] bg-acento', horizontal ? 'h-[6px] w-[3px]' : 'h-[3px] w-[6px]')} />
                </span>
              ) : (
                <span className="h-[3px] w-[3px] rounded-full bg-texto3/60 group-hover:bg-texto2" />
              )}
            </button>
          )
        })
      )}
    </div>
  )
}

function AparenciaFrame({ frame: f, editor }: { frame: CamadaFrame; editor: Editor }) {
  const set = (p: Partial<CamadaFrame>) => editor.acoes.atualizarCamadas([f.id], p as Partial<Camada>)
  return (
    <Secao titulo="Frame" acao={<Frame className="h-3.5 w-3.5 text-texto3" />}>
      <Linha rotulo="Preenchimento"><CampoCor rotulo="Preenchimento do frame" permitirVazio valor={f.fill} aoMudar={(fill) => set({ fill })} /></Linha>
      <Linha rotulo="Contorno"><CampoCor rotulo="Contorno do frame" permitirVazio valor={f.stroke} aoMudar={(stroke) => set({ stroke, strokeWidth: stroke && !f.strokeWidth ? 1 : f.strokeWidth })} /></Linha>
      {f.stroke && <Linha rotulo="Espessura"><CampoNum rotulo="Espessura do contorno do frame" valor={f.strokeWidth} min={0} max={100} aoMudar={(strokeWidth) => set({ strokeWidth })} /></Linha>}
      <Linha rotulo="Recortar"><Interruptor rotulo="Recortar conteúdo" ativo={f.clip} aoMudar={(clip) => set({ clip })} /></Linha>
    </Secao>
  )
}
