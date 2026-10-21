'use client'
/** Seções próprias da Mostra no painel Design: Protótipo (animação, interações, link), Responsivo e Acessibilidade. */
import { Link2 } from 'lucide-react'
import type { Camada, Interacao } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { Interruptor, Linha, LinhaResumo, Secao, Segmentado } from './controles'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { MISTO } from './campos'

const NOMES_ANIM: Record<string, string> = { none: 'Nenhuma', fadeIn: 'Fade', fadeOut: 'Sumir', slideUp: 'Subir', slideDown: 'Descer', slideLeft: 'Deslizar ←', slideRight: 'Deslizar →', scaleIn: 'Escala', scaleOut: 'Encolher', blurIn: 'Desfoque', rotateIn: 'Girar', reveal: 'Máscara' }
const NOMES_GATILHO: Record<Interacao['trigger'], string> = { click: 'Clique', hover: 'Hover', sceneEnter: 'Automático', scrollThreshold: 'Scroll' }
const NOMES_ACAO: Record<Interacao['do']['action'], string> = { nextScene: 'Próxima tela', prevScene: 'Tela anterior', goToScene: 'Navegar para tela', openLink: 'Abrir link', toggleLayer: 'Revelar elemento', toggleVideo: 'Reproduzir vídeo', animate: 'Animar' }

export function resumoInteracoes(c: Camada): string {
  if (!c.interactions.length) return 'Nenhuma'
  const i = c.interactions[0]!
  return `${NOMES_GATILHO[i.trigger]} → ${NOMES_ACAO[i.do.action]}${c.interactions.length > 1 ? ` +${c.interactions.length - 1}` : ''}`
}

export function SecoesPrototipo({ editor }: PropsSecao) {
  const { sel } = useCamadas(editor)
  const l = sel[0]
  if (!l || sel.length > 1) return null
  return (
    <>
      <LinhaResumo titulo="Animação" valor={l.enterAnimation && l.enterAnimation.type !== 'none' ? `${NOMES_ANIM[l.enterAnimation.type]} · ${l.enterAnimation.duration}ms` : 'Nenhuma'} aoClicar={() => editor.acoes.ui({ abaDireita: 'animacao' })} />
      <LinhaResumo titulo="Interações" valor={resumoInteracoes(l)} destaque={l.interactions.length > 0} aoClicar={() => editor.acoes.ui({ abaDireita: 'interacoes' })} />
      <LinkRapido camada={l} editor={editor} />
    </>
  )
}

/** Campo "Link": https://… ou nome/número de uma tela. Cria/edita a interação de clique. */
function LinkRapido({ camada, editor }: { camada: Camada; editor: Editor }) {
  const it = camada.interactions.find((i) => i.trigger === 'click' && (i.do.action === 'openLink' || i.do.action === 'goToScene'))
  const telas = editor.estado.documento.scenes
  const valor = it?.do.action === 'openLink' ? it.do.url : it?.do.action === 'goToScene' ? `→ ${telas.find((t) => it.do.action === 'goToScene' && t.id === it.do.targetSceneId)?.title ?? ''}` : ''
  const aplicar = (texto: string) => {
    const t = texto.trim()
    const sem = camada.interactions.filter((i) => i !== it)
    if (!t) return editor.acoes.atualizarCamadas([camada.id], { interactions: sem } as Partial<Camada>)
    let nova: Interacao | null = null
    if (/^https?:\/\//i.test(t)) nova = { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'openLink', url: t, newTab: true } }
    else {
      const busca = t.replace(/^→\s*/, '').toLowerCase()
      const n = Number(busca)
      const tela = Number.isInteger(n) && n >= 1 ? telas[n - 1] : telas.find((s) => s.title.toLowerCase() === busca)
      if (tela) nova = { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: tela.id } }
    }
    if (nova) editor.acoes.atualizarCamadas([camada.id], { interactions: [...sem, nova] } as Partial<Camada>)
  }
  return (
    <Secao titulo="Link">
      <div className="flex h-8 items-center gap-1 rounded-md bg-superficie2 pr-2 ring-inset hover:ring-1 hover:ring-bordaForte focus-within:!ring-1 focus-within:!ring-acento">
        <span className="flex h-full w-7 items-center justify-center text-texto3"><Link2 className="h-3.5 w-3.5" /></span>
        <input key={valor} aria-label="Link" list="mostra-telas" defaultValue={valor} placeholder="https:// ou escolha uma tela" onBlur={(e) => e.target.value !== valor && aplicar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="h-full min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-texto3" />
        <datalist id="mostra-telas">{telas.map((t, i) => <option key={t.id} value={`→ ${t.title || `Tela ${i + 1}`}`} />)}</datalist>
      </div>
    </Secao>
  )
}

export function SecaoResponsivo({ editor }: PropsSecao) {
  const { sel, set } = useCamadas(editor)
  const l = sel[0]
  if (!l) return null
  const oculto = comum(sel, (c) => !!c.mobile?.hidden)
  const midia = sel.every((c) => c.type === 'image' || c.type === 'video')
  const fit = comum(sel, (c) => c.mobile?.fit ?? '')
  return (
    <Secao titulo="Responsivo" recolhivel aberta={!!l.mobile?.hidden || !!l.mobile?.fit}>
      <p className="text-[11px] leading-relaxed text-texto2">A tela escala proporcionalmente em qualquer dispositivo. Ajustes para celular:</p>
      <Linha rotulo="Ocultar no celular"><Interruptor rotulo="Ocultar no celular" ativo={oculto === true} aoMudar={(v) => editor.acoes.atualizarCamadas(sel.map((c) => c.id), (c) => ({ ...c, mobile: { ...c.mobile, hidden: v } }))} /></Linha>
      {midia && (
        <Segmentado rotulo="Ajuste no celular" valor={fit === MISTO ? MISTO : (fit as '' | 'contain' | 'cover') || 'igual'} aoMudar={(v) => set({ mobile: { ...l.mobile, fit: v === 'igual' ? undefined : v } })} opcoes={[{ id: 'igual', rotulo: 'Igual' }, { id: 'contain', rotulo: 'Conter' }, { id: 'cover', rotulo: 'Cobrir' }]} />
      )}
    </Secao>
  )
}

export function SecaoAcessibilidade({ editor }: PropsSecao) {
  const { sel, ids } = useCamadas(editor)
  const l = sel[0]
  if (!l || sel.length > 1 || l.type === 'hotspot') return null
  const falta = l.interactions.length > 0 && !l.ariaLabel && l.type !== 'text'
  return (
    <Secao titulo="Acessibilidade" recolhivel aberta={falta || !!l.ariaLabel}>
      <input aria-label="Descrição para leitores de tela" placeholder="Descrição para leitores de tela" value={l.ariaLabel ?? ''} onChange={(e) => editor.acoes.atualizarCamadas(ids, { ariaLabel: e.target.value || undefined }, false)} onBlur={() => editor.acoes.atualizarCamadas(ids, (c) => c)} className="h-8 w-full rounded-md bg-superficie2 px-2 text-[12px] outline-none ring-inset placeholder:text-texto3 hover:ring-1 hover:ring-bordaForte focus:!ring-1 focus:!ring-acento" />
      {falta && <p className="text-[11px] text-perigo">Elemento interativo precisa de descrição.</p>}
    </Secao>
  )
}
