'use client'
/**
 * Auto layout no painel Design (modelo do Figma):
 * - frame com auto layout: direção (vertical, horizontal, quebra), alinhamento 3×3, espaço entre itens
 *   (número ou automático) e entre linhas, padding horizontal/vertical ou por lado, largura/altura
 *   Abraçar/Fixo/Preencher e "Recortar conteúdo". Passar o mouse num campo de espaço destaca a área no canvas.
 * - filho de auto layout: dimensionamento por eixo, posição absoluta e ordem (← → / ↑ ↓ no teclado)
 * - outras seleções: "+" envolve num frame com auto layout (⇧A)
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Frame, Minus, Plus } from 'lucide-react'
import type { AutoLayout, Camada, CamadaFrame, Dimensionamento } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { LAYOUT_PADRAO, filhosNoFluxo, moverNoFluxo, type TipoEspaco } from '@/lib/editor/autolayout'
import { mapaDe, paiDe, temAutoLayout } from '@/lib/scene/arvore'
import { cx } from '@/components/ui'
import { BotaoCampo, BotaoMini, CampoNum, Interruptor, Secao, Segmentado, SeletorLista } from './controles'
import { IconeAutoLayout } from './icones'

const NOMES_DIM: Record<Dimensionamento, string> = { fixed: 'Fixo', hug: 'Abraçar', fill: 'Preencher' }
const POS = ['start', 'center', 'end'] as const
const NOMES_V = { start: 'em cima', center: 'no meio', end: 'embaixo' }
const NOMES_H = { start: 'à esquerda', center: 'ao centro', end: 'à direita' }

/** Evento para o canvas destacar (em rosa) o espaço sob o campo com o mouse. */
export const EVENTO_ESPACO = 'mostra:destacar-espaco'
const destacar = (frameId: string | null, tipo?: TipoEspaco) => window.dispatchEvent(new CustomEvent(EVENTO_ESPACO, { detail: frameId ? { frameId, tipo } : null }))
const realce = (frameId: string, tipo: TipoEspaco) => ({ onMouseEnter: () => destacar(frameId, tipo), onMouseLeave: () => destacar(null), onFocus: () => destacar(frameId, tipo), onBlur: () => destacar(null) })

export function SecaoAutoLayout({ editor }: { editor: Editor }) {
  const { camadasSelecionadas: sel, acoes, cena } = editor
  if (!cena || !sel.length) return null
  const ids = sel.map((l) => l.id)
  const unica = sel.length === 1 ? sel[0]! : undefined
  const mapa = mapaDe(cena.layers)
  const pai = sel[0] ? paiDe(sel[0], mapa) : undefined
  const irmaos = !!pai && temAutoLayout(pai) && sel.every((l) => l.parentId === pai.id)

  return (
    <>
      {irmaos && pai?.type === 'frame' && <FilhoDoLayout camadas={sel} pai={pai} editor={editor} />}
      {/* sem auto layout, o fluxo, o recorte e os botões de envolver ficam na seção Layout */}
      {unica?.type === 'frame' && unica.layout && <PainelLayout frame={unica} editor={editor} podeFill={temAutoLayout(paiDe(unica, mapa))} />}
    </>
  )
}

/** Direção que o ⇧A vai inferir (para o ícone do botão). */
function inferirDirecao(sel: readonly Camada[]): 'horizontal' | 'vertical' {
  const xs = sel.map((c) => c.x + c.width / 2)
  const ys = sel.map((c) => c.y + c.height / 2)
  return Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 'horizontal' : 'vertical'
}

function FilhoDoLayout({ camadas, pai, editor }: { camadas: Camada[]; pai: CamadaFrame; editor: Editor }) {
  const { acoes, cena } = editor
  const l = camadas[0]!
  const ids = camadas.map((c) => c.id)
  const podeHug = camadas.every((c) => (c.type === 'frame' && !!c.layout) || c.type === 'text')
  const opcoes = (['fixed', ...(podeHug ? (['hug'] as const) : []), 'fill'] as Dimensionamento[]).map((d) => ({ id: d, rotulo: NOMES_DIM[d] }))
  const direcao = pai.layout?.direction ?? 'horizontal'
  const fluxo = cena ? filhosNoFluxo(pai.id, cena.layers) : []
  const pos = fluxo.findIndex((c) => c.id === l.id)
  const absoluta = camadas.every((c) => c.absolute)
  const mover = (passo: -1 | 1) => acoes.transformarCena((c) => { const r = moverNoFluxo(c.layers, ids, passo); return r === c.layers ? c : { ...c, layers: r } })
  const [ant, prox] = direcao === 'vertical' ? ['↑', '↓'] : ['←', '→']
  const um = camadas.length === 1
  return (
    <Secao titulo="No auto layout" acao={<IconeAutoLayout direcao={direcao} className="h-3.5 w-3.5 text-texto3" />}>
      {!absoluta && (
        <div className="grid grid-cols-2 gap-2">
          <SeletorLista rotulo="Dimensionamento horizontal no auto layout" prefixo={<span className="text-[11px]">L</span>} valor={um ? (l.sizingW ?? 'fixed') : 'fixed'} opcoes={opcoes} aoMudar={(v) => acoes.atualizarCamadas(ids, { sizingW: v as Dimensionamento })} />
          <SeletorLista rotulo="Dimensionamento vertical no auto layout" prefixo={<span className="text-[11px]">A</span>} valor={um ? (l.sizingH ?? 'fixed') : 'fixed'} opcoes={opcoes} aoMudar={(v) => acoes.atualizarCamadas(ids, { sizingH: v as Dimensionamento })} />
        </div>
      )}
      {!absoluta && pos >= 0 && (
        <div className="flex items-center gap-1">
          <BotaoCampo rotulo={`Mover para antes (${ant})`} disabled={pos <= 0} onClick={() => mover(-1)}><ChevronLeft className={cx('h-3.5 w-3.5', direcao === 'vertical' && 'rotate-90')} /></BotaoCampo>
          <span className="min-w-0 flex-1 text-center text-[11px] tabular-nums text-texto2" title={`Use ${ant} ${prox} para mudar a ordem`}>
            {um ? `${pos + 1} de ${fluxo.length}` : `${camadas.length} itens`} <span className="rotulo-mono !text-[10px] text-texto3">· {ant} {prox}</span>
          </span>
          <BotaoCampo rotulo={`Mover para depois (${prox})`} disabled={pos >= fluxo.length - camadas.length} onClick={() => mover(1)}><ChevronRight className={cx('h-3.5 w-3.5', direcao === 'vertical' && 'rotate-90')} /></BotaoCampo>
        </div>
      )}
      <label className="flex h-7 items-center justify-between gap-2">
        <span className="text-[11px] text-texto2">Posição absoluta</span>
        <Interruptor rotulo="Posição absoluta (ignorar auto layout)" ativo={absoluta} aoMudar={(v) => acoes.atualizarCamadas(ids, { absolute: v || undefined })} />
      </label>
    </Secao>
  )
}

function PainelLayout({ frame: f, editor, podeFill }: { frame: CamadaFrame; editor: Editor; podeFill: boolean }) {
  const { acoes } = editor
  const [porLado, setPorLado] = useState(false)
  const setFrame = (p: Partial<CamadaFrame>) => acoes.atualizarCamadas([f.id], p as Partial<Camada>)
  const recortar = (
    <label className="flex h-7 items-center justify-between gap-2">
      <span className="text-[11px] text-texto2">Recortar conteúdo</span>
      <Interruptor rotulo="Recortar conteúdo" ativo={f.clip} aoMudar={(clip) => setFrame({ clip })} />
    </label>
  )
  if (!f.layout) {
    return (
      <Secao titulo="Auto layout" acao={<BotaoMini rotulo="Adicionar auto layout (Shift+A)" onClick={() => acoes.adicionarAutoLayout([f.id])}><Plus className="h-3.5 w-3.5" /></BotaoMini>}>
        {recortar}
      </Secao>
    )
  }
  const L = { ...LAYOUT_PADRAO, ...f.layout }
  const set = (patch: Partial<AutoLayout>) => acoes.atualizarLayout(f.id, patch)
  const horizontal = L.direction !== 'vertical'
  const pad = L.padding
  const ladosDiferentes = pad.left !== pad.right || pad.top !== pad.bottom
  const abertoPorLado = porLado || ladosDiferentes
  const opcoesDim = (['fixed', 'hug', ...(podeFill ? (['fill'] as const) : [])] as Dimensionamento[]).map((d) => ({ id: d, rotulo: NOMES_DIM[d] }))
  const setGapAuto = (auto: boolean) => {
    set({ gapAuto: auto })
    // como no Figma: espaço automático não combina com abraçar no eixo principal
    if (auto) acoes.atualizarCamadas([f.id], horizontal ? (f.sizingW === 'hug' ? { sizingW: 'fixed' } : {}) : f.sizingH === 'hug' ? { sizingH: 'fixed' } : {})
  }
  return (
    <Secao titulo="Auto layout" acao={<BotaoMini rotulo="Remover auto layout (Shift+Alt+A)" onClick={() => acoes.removerAutoLayout(f.id)}><Minus className="h-3.5 w-3.5" /></BotaoMini>}>
      <Segmentado<AutoLayout['direction']>
        rotulo="Direção do auto layout"
        icones
        valor={L.direction}
        aoMudar={(direction) => set({ direction })}
        opcoes={[
          { id: 'vertical', rotulo: 'Vertical (itens um embaixo do outro)', icone: <IconeAutoLayout direcao="vertical" /> },
          { id: 'horizontal', rotulo: 'Horizontal (itens lado a lado)', icone: <IconeAutoLayout direcao="horizontal" /> },
          { id: 'wrap', rotulo: 'Quebrar linha (grade que flui)', icone: <IconeAutoLayout direcao="wrap" /> },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <SeletorLista rotulo="Largura do frame" prefixo={<span className="text-[11px]">L</span>} valor={f.sizingW ?? 'fixed'} opcoes={opcoesDim} aoMudar={(v) => acoes.atualizarCamadas([f.id], { sizingW: v as Dimensionamento })} />
        <SeletorLista rotulo="Altura do frame" prefixo={<span className="text-[11px]">A</span>} valor={f.sizingH ?? 'fixed'} opcoes={opcoesDim} aoMudar={(v) => acoes.atualizarCamadas([f.id], { sizingH: v as Dimensionamento })} />
      </div>
      <div className="flex gap-2">
        <PadAlinhamento valor={{ x: L.alignX, y: L.alignY }} horizontal={horizontal} espacoAuto={L.gapAuto} aoMudar={(x, y) => set({ alignX: x, alignY: y })} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-1" {...realce(f.id, 'gap')}>
            {L.gapAuto ? (
              <button type="button" aria-label="Espaço entre itens: automático (clique para usar número)" onClick={() => setGapAuto(false)} className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md bg-superficie2 px-2 text-left text-[11px] text-texto">
                <IconeEspaco horizontal={horizontal} /> Auto
              </button>
            ) : (
              <CampoNum prefixo={<IconeEspaco horizontal={horizontal} />} rotulo="Espaço entre itens" valor={L.gap} min={-2000} max={2000} aoMudar={(gap) => set({ gap })} />
            )}
            <BotaoCampo rotulo={L.gapAuto ? 'Espaço automático (ligado)' : 'Espaço automático: distribui os itens'} ativo={L.gapAuto} onClick={() => setGapAuto(!L.gapAuto)}>
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden><path d="M1.5 3v8M12.5 3v8M4 7h6M5.5 5.5 4 7l1.5 1.5M8.5 5.5 10 7 8.5 8.5" /></svg>
            </BotaoCampo>
          </div>
          {L.direction === 'wrap' && (
            <div {...realce(f.id, 'rowGap')}>
              <CampoNum prefixo={<IconeEspaco horizontal={false} />} rotulo="Espaço entre linhas" valor={L.rowGap ?? L.gap} min={-2000} max={2000} aoMudar={(rowGap) => set({ rowGap })} />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_28px] gap-2">
        {abertoPorLado ? (
          <>
            <div {...realce(f.id, 'left')}><CampoNum prefixo="←" rotulo="Padding esquerdo" valor={pad.left} min={0} max={2000} aoMudar={(left) => set({ padding: { ...pad, left } })} /></div>
            <div {...realce(f.id, 'top')}><CampoNum prefixo="↑" rotulo="Padding superior" valor={pad.top} min={0} max={2000} aoMudar={(top) => set({ padding: { ...pad, top } })} /></div>
          </>
        ) : (
          <>
            <div {...realce(f.id, 'paddingH')}><CampoNum prefixo={<IconePadding eixo="h" />} rotulo="Padding horizontal" valor={pad.left} min={0} max={2000} aoMudar={(v) => set({ padding: { ...pad, left: v, right: v } })} /></div>
            <div {...realce(f.id, 'paddingV')}><CampoNum prefixo={<IconePadding eixo="v" />} rotulo="Padding vertical" valor={pad.top} min={0} max={2000} aoMudar={(v) => set({ padding: { ...pad, top: v, bottom: v } })} /></div>
          </>
        )}
        <BotaoCampo rotulo="Padding por lado" ativo={abertoPorLado} onClick={() => {
          if (abertoPorLado) { setPorLado(false); if (ladosDiferentes) set({ padding: { top: pad.top, bottom: pad.top, left: pad.left, right: pad.left } }) } else setPorLado(true)
        }} {...realce(f.id, 'padding')}>
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden><rect x="1.5" y="1.5" width="11" height="11" rx="2" /><rect x="4.5" y="4.5" width="5" height="5" rx="1" strokeDasharray="1.4 1.2" /></svg>
        </BotaoCampo>
        {abertoPorLado && (
          <>
            <div {...realce(f.id, 'right')}><CampoNum prefixo="→" rotulo="Padding direito" valor={pad.right} min={0} max={2000} aoMudar={(right) => set({ padding: { ...pad, right } })} /></div>
            <div {...realce(f.id, 'bottom')}><CampoNum prefixo="↓" rotulo="Padding inferior" valor={pad.bottom} min={0} max={2000} aoMudar={(bottom) => set({ padding: { ...pad, bottom } })} /></div>
          </>
        )}
      </div>
      {recortar}
    </Secao>
  )
}

function IconeEspaco({ horizontal }: { horizontal: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className={cx('h-3 w-3', !horizontal && 'rotate-90')} fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <rect x="1" y="2.5" width="3" height="7" rx=".8" /><rect x="8" y="2.5" width="3" height="7" rx=".8" /><path d="M6 4v4" />
    </svg>
  )
}

function IconePadding({ eixo }: { eixo: 'h' | 'v' }) {
  return (
    <svg viewBox="0 0 12 12" className={cx('h-3 w-3', eixo === 'v' && 'rotate-90')} fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <path d="M1 1.5v9M11 1.5v9" /><rect x="3.5" y="3.5" width="5" height="5" rx=".8" />
    </svg>
  )
}

/** Grade 3×3 de alinhamento (como no Figma): clique escolhe x/y; com espaço automático só o eixo cruzado importa. */
function PadAlinhamento({ valor, horizontal, espacoAuto, aoMudar }: { valor: { x: AutoLayout['alignX']; y: AutoLayout['alignY'] }; horizontal: boolean; espacoAuto: boolean; aoMudar: (x: AutoLayout['alignX'], y: AutoLayout['alignY']) => void }) {
  return (
    <div role="radiogroup" aria-label="Alinhamento" className="grid h-[64px] w-[64px] shrink-0 grid-cols-3 grid-rows-3 rounded-md bg-superficie2 p-1">
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
                <span className={cx('flex gap-[2px]', horizontal ? 'flex-row' : 'flex-col', { start: 'items-start', center: 'items-center', end: 'items-end' }[horizontal ? y : x])}>
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
