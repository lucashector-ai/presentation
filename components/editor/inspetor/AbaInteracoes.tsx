'use client'
import { Clock, Eye, EyeOff, Hand, MousePointerClick, Plus, ScrollText, Trash2 } from 'lucide-react'
import type { Acao, Camada, Interacao, Transicao, Trigger } from '@/lib/scene/schema'
import { ACOES_POR_TRIGGER } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { MiniaturaCena } from '../MiniaturaCena'
import { cx } from '@/components/ui'
import { CampoNum, GradeCartoes, Secao, Segmentado, Deslizante, SeletorLista, Interruptor, Linha } from './controles'
import { CurvaEasing } from './CurvaEasing'
import { OPCOES_EASING } from './AbaAnimacao'
import { NOME_TIPO } from './AbaDesign'

const GATILHOS: { id: Trigger; rotulo: string; icone: JSX.Element }[] = [
  { id: 'click', rotulo: 'Clique', icone: <MousePointerClick className="h-4 w-4" /> },
  { id: 'hover', rotulo: 'Hover', icone: <Hand className="h-4 w-4" /> },
  { id: 'scrollThreshold', rotulo: 'Scroll', icone: <ScrollText className="h-4 w-4" /> },
  { id: 'sceneEnter', rotulo: 'Automático', icone: <Clock className="h-4 w-4" /> },
]

/** Ações na linguagem do design → ação do schema. */
const ACOES: { id: string; rotulo: string; acao: Acao['action']; modo?: string }[] = [
  { id: 'navegar', rotulo: 'Navegar para tela', acao: 'goToScene' },
  { id: 'proxima', rotulo: 'Próxima tela', acao: 'nextScene' },
  { id: 'anterior', rotulo: 'Tela anterior', acao: 'prevScene' },
  { id: 'revelar', rotulo: 'Revelar elemento', acao: 'toggleLayer', modo: 'show' },
  { id: 'alternar', rotulo: 'Alternar estado', acao: 'toggleLayer', modo: 'toggle' },
  { id: 'esconder', rotulo: 'Esconder elemento', acao: 'toggleLayer', modo: 'hide' },
  { id: 'video', rotulo: 'Reproduzir vídeo', acao: 'toggleVideo', modo: 'toggle' },
  { id: 'animar', rotulo: 'Animar elemento', acao: 'animate' },
  { id: 'link', rotulo: 'Abrir link', acao: 'openLink' },
]

function idAcao(a: Acao): string {
  if (a.action === 'toggleLayer') return a.mode === 'show' ? 'revelar' : a.mode === 'hide' ? 'esconder' : 'alternar'
  return ACOES.find((x) => x.acao === a.action)?.id ?? 'navegar'
}

export function AbaInteracoes({ editor, assets }: { editor: Editor; assets: AssetsResolvidos }) {
  const { cena, camadasSelecionadas: sel, acoes, estado } = editor
  if (!cena) return null
  const lista = cena.layers.filter((l) => l.interactions.length > 0)
  const l = sel.length === 1 ? sel[0]! : undefined

  return (
    <div>
      <Secao titulo="Hotspots nesta tela" acao={<button type="button" onClick={() => acoes.ui({ mostrarHotspots: !estado.mostrarHotspots })} className="flex items-center gap-1 text-[12px] text-acento hover:underline">{estado.mostrarHotspots ? <><EyeOff className="h-3 w-3" /> Ocultar no canvas</> : <><Eye className="h-3 w-3" /> Mostrar no canvas</>}</button>}>
        {lista.length === 0 && <p className="text-[12px] text-texto2">Nenhum elemento interativo. Selecione algo na tela e escolha um gatilho abaixo.</p>}
        {lista.map((c, i) => (
          <button key={c.id} type="button" onClick={() => acoes.selecionarExato([c.id])} className={cx('flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left', l?.id === c.id ? 'border-acento bg-acentoSuave/60' : 'border-borda hover:border-[#D4D4D4]')}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-acento text-[11px] font-medium text-white">{i + 1}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{NOME_TIPO[c.type]} · {c.name || c.id}</span>
              <span className="block truncate text-[11px] text-texto2">{c.interactions.map((it) => `${GATILHOS.find((g) => g.id === it.trigger)?.rotulo} → ${ACOES.find((a) => a.id === idAcao(it.do))?.rotulo}`).join(' · ')}</span>
            </span>
          </button>
        ))}
      </Secao>
      {l ? <EditorInteracoes camada={l} editor={editor} assets={assets} /> : sel.length > 1 ? <p className="px-4 py-4 text-[12px] text-texto2">Selecione um único elemento para editar interações.</p> : null}
    </div>
  )
}

function EditorInteracoes({ camada, editor, assets }: { camada: Camada; editor: Editor; assets: AssetsResolvidos }) {
  const { acoes, estado, cena } = editor
  const story = estado.documento.mode === 'story'
  const salvar = (interactions: Interacao[]) => acoes.atualizarCamadas([camada.id], { interactions } as Partial<Camada>)
  const outraTela = estado.documento.scenes.find((s) => s.id !== cena?.id) ?? estado.documento.scenes[0]!
  const outraCamada = cena?.layers.find((x) => x.id !== camada.id)

  const acaoPadrao = (id: string): Acao => {
    const d = ACOES.find((a) => a.id === id)!
    switch (d.acao) {
      case 'goToScene': return { action: 'goToScene', targetSceneId: outraTela.id }
      case 'openLink': return { action: 'openLink', url: 'https://', newTab: true }
      case 'toggleLayer': return { action: 'toggleLayer', targetLayerId: outraCamada?.id ?? camada.id, mode: (d.modo ?? 'toggle') as 'show' | 'hide' | 'toggle' }
      case 'toggleVideo': return { action: 'toggleVideo', targetLayerId: cena?.layers.find((x) => x.type === 'video')?.id ?? camada.id, mode: 'toggle' }
      case 'animate': return { action: 'animate', targetLayerId: camada.id, animation: { type: 'scaleIn', duration: 500, delay: 0, easing: 'spring' } }
      case 'nextScene': return { action: 'nextScene' }
      case 'prevScene': return { action: 'prevScene' }
    }
  }

  const adicionar = () => salvar([...camada.interactions, { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: acaoPadrao('navegar'), transition: { type: 'fade', duration: 500, easing: 'easeInOut' } }])

  if (!camada.interactions.length) {
    return (
      <Secao titulo="Interação">
        <p className="text-[12px] text-texto2">Um evento, uma ação. Ex.: clique no botão → vai para a tela 05 com morph.</p>
        <button type="button" onClick={adicionar} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-acento text-[13px] font-medium text-white hover:bg-[#4A55E0]"><Plus className="h-4 w-4" /> Adicionar interação</button>
      </Secao>
    )
  }

  return (
    <>
      {camada.interactions.map((it, idx) => {
        const set = (patch: Partial<Interacao>) => salvar(camada.interactions.map((x, j) => (j === idx ? { ...x, ...patch } : x)))
        const setAcao = (a: Acao) => set({ do: a })
        const permitidas = ACOES.filter((a) => ACOES_POR_TRIGGER[it.trigger].includes(a.acao))
        const navega = ['goToScene', 'nextScene', 'prevScene'].includes(it.do.action)
        const tr: Transicao = it.transition ?? { type: 'fade', duration: 500, easing: 'easeInOut' }
        return (
          <div key={idx}>
            {camada.interactions.length > 1 && (
              <div className="flex items-center justify-between bg-superficie2 px-4 py-2 text-[12px] text-texto2">
                <span>Interação {idx + 1}</span>
                <button type="button" aria-label={`Remover interação ${idx + 1}`} onClick={() => salvar(camada.interactions.filter((_, j) => j !== idx))} className="hover:text-perigo"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <Secao titulo="Gatilho">
              <GradeCartoes rotulo="Gatilho" colunas={story ? 4 : 3} valor={it.trigger} aoMudar={(trigger) => { const ok = ACOES_POR_TRIGGER[trigger].includes(it.do.action); set({ trigger, do: ok ? it.do : acaoPadrao(ACOES.find((a) => ACOES_POR_TRIGGER[trigger].includes(a.acao))!.id) }) }} opcoes={GATILHOS.filter((g) => g.id !== 'scrollThreshold' || story)} />
              {it.trigger === 'hover' && <p className="text-[11px] text-texto2">No celular, hover vira toque.</p>}
              {it.trigger === 'scrollThreshold' && <Linha rotulo="Visível"><Deslizante rotulo="Fração visível para disparar" valor={Math.round(it.conditions.threshold * 100)} aoMudar={(v) => set({ conditions: { ...it.conditions, threshold: v / 100 } })} formatar={(v) => `${v}%`} /></Linha>}
              <Linha rotulo="Só uma vez"><Interruptor rotulo="Disparar só uma vez" ativo={it.conditions.once} aoMudar={(once) => set({ conditions: { ...it.conditions, once } })} /></Linha>
            </Secao>
            <Secao titulo="Ação">
              <div role="radiogroup" aria-label="Ação" className="space-y-0.5">
                {permitidas.map((a) => {
                  const ativo = idAcao(it.do) === a.id
                  return (
                    <button key={a.id} type="button" role="radio" aria-checked={ativo} onClick={() => setAcao(acaoPadrao(a.id))} className={cx('flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13px]', ativo ? 'bg-acentoSuave/70 text-texto' : 'text-[#525252] hover:bg-hover')}>
                      <span className={cx('flex h-3.5 w-3.5 items-center justify-center rounded-full border', ativo ? 'border-acento' : 'border-[#D4D4D4]')}>{ativo && <span className="h-2 w-2 rounded-full bg-acento" />}</span>
                      {a.rotulo}
                    </button>
                  )
                })}
              </div>
              {it.do.action === 'goToScene' && (
                <>
                  <div className="pt-2 text-[13px] text-texto2">Destino</div>
                  <div className="grid grid-cols-3 gap-2">
                    {estado.documento.scenes.map((s, i) => {
                      const ativo = it.do.action === 'goToScene' && it.do.targetSceneId === s.id
                      if (s.id === cena?.id) return null
                      return (
                        <button key={s.id} type="button" aria-label={`Ir para ${String(i + 1).padStart(2, '0')} ${s.title}`} aria-pressed={ativo} onClick={() => setAcao({ action: 'goToScene', targetSceneId: s.id })} className="text-left">
                          <span className={cx('block overflow-hidden rounded-md border-[1.5px]', ativo ? 'border-acento' : 'border-transparent')}><MiniaturaCena cena={s} assets={assets} largura={76} className="rounded-[5px] border-0" /></span>
                          <span className={cx('mt-1 block truncate text-[11px]', ativo ? 'text-acento' : 'text-texto2')}>{String(i + 1).padStart(2, '0')} {s.title}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              {it.do.action === 'openLink' && (
                <input aria-label="URL do link" defaultValue={it.do.url} placeholder="https://" onBlur={(e) => { try { const u = new URL(e.target.value); if (u.protocol === 'http:' || u.protocol === 'https:') setAcao({ action: 'openLink', url: e.target.value, newTab: true }) } catch { /* inválida */ } }} className="h-8 w-full rounded-md border border-borda px-2 text-[13px] outline-none focus:border-acento" />
              )}
              {(it.do.action === 'toggleLayer' || it.do.action === 'toggleVideo' || it.do.action === 'animate') && (
                <Linha rotulo="Elemento">
                  <SeletorLista rotulo="Elemento alvo" valor={it.do.targetLayerId} aoMudar={(targetLayerId) => setAcao({ ...it.do, targetLayerId } as Acao)} opcoes={(cena?.layers ?? []).filter((x) => it.do.action !== 'toggleVideo' || x.type === 'video').map((x) => ({ id: x.id, rotulo: `${NOME_TIPO[x.type]} · ${x.name || (x.type === 'text' ? x.text.slice(0, 18) : x.id)}` }))} />
                </Linha>
              )}
            </Secao>
            {navega && (
              <Secao titulo="Animação">
                <GradeCartoes rotulo="Transição" colunas={4} valor={tr.type === 'none' ? 'fade' : tr.type} aoMudar={(type) => set({ transition: { ...tr, type } })} opcoes={[
                  { id: 'fade', rotulo: 'Fade', icone: <span className="block h-3 w-4 rounded-[2px] bg-current opacity-40" /> },
                  { id: 'slide', rotulo: 'Slide', icone: <span className="flex gap-0.5"><span className="block h-3 w-2 rounded-[2px] bg-current opacity-40" /><span className="block h-3 w-2 rounded-[2px] bg-current" /></span> },
                  { id: 'scale', rotulo: 'Scale', icone: <span className="flex h-3 w-4 items-center justify-center rounded-[2px] border border-current"><span className="block h-1.5 w-2 rounded-[1px] bg-current" /></span> },
                  { id: 'morph', rotulo: 'Morph', icone: <span className="block h-3 w-4 rounded-[2px] bg-current" style={{ borderRadius: '2px 6px 2px 6px' }} /> },
                ] as const} />
                {tr.type === 'morph' && <p className="text-[11px] text-texto2">Elementos com o mesmo nome nas duas telas deslizam e mudam de cor/tamanho. Dê nomes iguais na aba Design.</p>}
                <Linha rotulo="Duração"><Deslizante rotulo="Duração da transição" valor={tr.duration} min={100} max={2000} passo={50} aoMudar={(duration) => set({ transition: { ...tr, duration } })} formatar={(v) => `${v}ms`} /></Linha>
                <Segmentado rotulo="Curva da transição" valor={tr.easing === 'ease' || tr.easing === 'easeIn' ? 'easeOut' : tr.easing} aoMudar={(easing) => set({ transition: { ...tr, easing } })} opcoes={OPCOES_EASING} />
                <CurvaEasing easing={tr.easing} duracao={tr.duration} chave={`${tr.type}-${tr.easing}-${tr.duration}`} />
              </Secao>
            )}
            {it.do.action === 'animate' && (
              <Secao titulo="Animação do elemento">
                <div className="grid grid-cols-2 gap-1.5">
                  <CampoNum prefixo="Duração" rotulo="Duração da animação" valor={it.do.animation.duration} min={100} max={3000} passo={50} sufixo="ms" aoMudar={(duration) => it.do.action === 'animate' && setAcao({ ...it.do, animation: { ...it.do.animation, duration } })} />
                  <SeletorLista rotulo="Efeito" valor={it.do.animation.type} aoMudar={(type) => it.do.action === 'animate' && setAcao({ ...it.do, animation: { ...it.do.animation, type: type as never } })} opcoes={[['fadeIn', 'Fade'], ['scaleIn', 'Escala'], ['slideUp', 'Subir'], ['blurIn', 'Desfoque'], ['rotateIn', 'Girar'], ['reveal', 'Máscara']].map(([id, rotulo]) => ({ id: id!, rotulo: rotulo! }))} />
                </div>
              </Secao>
            )}
          </div>
        )
      })}
      <div className="flex gap-2 px-4 py-4">
        <button type="button" onClick={adicionar} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-borda text-[13px] hover:border-[#D4D4D4]"><Plus className="h-3.5 w-3.5" /> Outra interação</button>
        <button type="button" onClick={() => salvar([])} className="h-8 rounded-md px-3 text-[13px] text-texto2 hover:text-perigo">Remover</button>
      </div>
    </>
  )
}
