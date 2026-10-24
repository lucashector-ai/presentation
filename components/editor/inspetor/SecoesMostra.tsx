'use client'
/**
 * Seções próprias da Mostra no painel Design: Protótipo (animação, interações, link), Responsivo e Acessibilidade.
 * A seção Link só aparece quando a camada já tem link — ou quando a pessoa cola (Ctrl+V) uma URL com a camada
 * selecionada (`useColarLink`): o link é aplicado e a seção surge.
 */
import { useEffect } from 'react'
import { Link2 } from 'lucide-react'
import { nomeAnimacao } from '@/lib/scene/animacoes'
import type { Camada, Interacao } from '@/lib/scene/schema'
import type { Editor } from '@/lib/editor/useEditor'
import { useToast } from '@/components/ui/toast'
import { Interruptor, Linha, LinhaResumo, Secao, Segmentado } from './controles'
import { comum, useCamadas, type PropsSecao } from './selecao'
import { MISTO } from './campos'

const interacaoDeLink = (c: Camada) => c.interactions.find((i) => i.trigger === 'click' && (i.do.action === 'openLink' || i.do.action === 'goToScene'))
const ehUrl = (t: string) => /^https?:\/\/\S+$/i.test(t.trim()) && !/\s/.test(t.trim())
const linkPara = (url: string): Interacao => ({ trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'openLink', url, newTab: true } })

/**
 * Colar (Ctrl+V) uma URL com camadas selecionadas vira link de clique nelas (e a seção Link aparece no Design).
 * Corre antes do colar geral do editor (fase de captura) e só quando a área de transferência tem apenas a URL
 * em texto; dentro de campos de texto não interfere.
 */
export function useColarLink(editor: Editor) {
  const { mostrar } = useToast()
  const { acoes } = editor
  const selecao = editor.estado.selecao
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)) return
      if (!selecao.length || !e.clipboardData) return
      if (e.clipboardData.files.length || e.clipboardData.types.includes('text/html')) return
      const texto = e.clipboardData.getData('text/plain')
      if (!ehUrl(texto)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const url = texto.trim()
      acoes.atualizarCamadas(selecao, (c) => ({ ...c, interactions: [...c.interactions.filter((i) => i !== interacaoDeLink(c)), linkPara(url)] }) as Camada)
      acoes.ui({ abaDireita: 'design' })
      mostrar(selecao.length > 1 ? `Link aplicado a ${selecao.length} camadas.` : 'Link aplicado à camada.', 'sucesso')
    }
    window.addEventListener('paste', colar, true)
    return () => window.removeEventListener('paste', colar, true)
  }, [selecao, acoes, mostrar])
}

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
      <LinhaResumo titulo="Animação" valor={l.enterAnimation && l.enterAnimation.type !== 'none' ? `${nomeAnimacao(l.enterAnimation.type)} · ${l.enterAnimation.duration}ms` : 'Nenhuma'} aoClicar={() => editor.acoes.ui({ abaDireita: 'animacao' })} />
      <LinhaResumo titulo="Interações" valor={resumoInteracoes(l)} destaque={l.interactions.length > 0} aoClicar={() => editor.acoes.ui({ abaDireita: 'interacoes' })} />
      <LinkRapido camada={l} editor={editor} />
    </>
  )
}

/** Campo "Link": https://… ou nome/número de uma tela. Só aparece quando a camada já tem link (ver `useColarLink`). */
function LinkRapido({ camada, editor }: { camada: Camada; editor: Editor }) {
  const it = interacaoDeLink(camada)
  const telas = editor.estado.documento.scenes
  if (!it) return null
  const valor = it?.do.action === 'openLink' ? it.do.url : it?.do.action === 'goToScene' ? `→ ${telas.find((t) => it.do.action === 'goToScene' && t.id === it.do.targetSceneId)?.title ?? ''}` : ''
  const aplicar = (texto: string) => {
    const t = texto.trim()
    const sem = camada.interactions.filter((i) => i !== it)
    if (!t) return editor.acoes.atualizarCamadas([camada.id], { interactions: sem } as Partial<Camada>)
    let nova: Interacao | null = null
    if (/^https?:\/\//i.test(t)) nova = linkPara(t)
    else {
      const busca = t.replace(/^→\s*/, '').toLowerCase()
      const n = Number(busca)
      const tela = Number.isInteger(n) && n >= 1 ? telas[n - 1] : telas.find((s) => s.title.toLowerCase() === busca)
      if (tela) nova = { trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'goToScene', targetSceneId: tela.id } }
    }
    if (nova) editor.acoes.atualizarCamadas([camada.id], { interactions: [...sem, nova] } as Partial<Camada>)
  }
  return (
    <Secao titulo="Link" resumo={valor} aoRemover={() => aplicar('')} rotuloRemover="Remover link">
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
