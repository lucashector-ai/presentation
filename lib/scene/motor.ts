/**
 * Motor de interação: reducer PURO compartilhado por preview e visualizador.
 * Recebe (documento, estado, interação) e devolve novo estado + efeitos colaterais
 * que a UI executa (abrir link, tocar vídeo). Nunca executa código do autor.
 */
import type { Animacao, Camada, DocumentoProjeto, Interacao, Transicao } from './schema'

export interface AnimacaoPendente {
  animacao: Animacao
  nonce: number
}

export interface EstadoRuntime {
  indice: number
  /** Sobrescritas de visibilidade por camada (toggleLayer). Reinicia ao trocar de cena. */
  visiveis: Record<string, boolean>
  /** Animações disparadas em runtime (animate). */
  animacoes: Record<string, AnimacaoPendente>
  /** Chaves "sceneId:layerId" já disparadas com conditions.once. */
  disparadas: string[]
  transicao: Transicao | null
  historico: number[]
}

export type Efeito =
  | { tipo: 'abrirLink'; url: string; novaAba: boolean }
  | { tipo: 'video'; layerId: string; modo: 'play' | 'pause' | 'toggle' }
  | { tipo: 'anunciar'; texto: string }

export function estadoInicialRuntime(indice = 0): EstadoRuntime {
  return { indice, visiveis: {}, animacoes: {}, disparadas: [], transicao: null, historico: [] }
}

export function cenaAtual(doc: DocumentoProjeto, e: EstadoRuntime) {
  return doc.scenes[Math.max(0, Math.min(doc.scenes.length - 1, e.indice))]
}

export function indiceDaCena(doc: DocumentoProjeto, sceneId: string): number {
  return doc.scenes.findIndex((s) => s.id === sceneId)
}

export function irPara(doc: DocumentoProjeto, e: EstadoRuntime, indice: number, transicao?: Transicao | null): EstadoRuntime {
  const alvo = Math.max(0, Math.min(doc.scenes.length - 1, indice))
  if (alvo === e.indice) return e
  const cena = doc.scenes[alvo]
  return {
    ...e,
    indice: alvo,
    visiveis: {},
    animacoes: {},
    transicao: transicao ?? cena?.transition ?? { type: 'fade', duration: 350 },
    historico: [...e.historico.slice(-50), e.indice],
  }
}

export const proxima = (doc: DocumentoProjeto, e: EstadoRuntime) => irPara(doc, e, e.indice + 1)
export const anterior = (doc: DocumentoProjeto, e: EstadoRuntime) => irPara(doc, e, e.indice - 1)

export function camadaVisivel(c: Camada, e: EstadoRuntime): boolean {
  const sobrescrita = e.visiveis[c.id]
  return sobrescrita ?? !c.hidden
}

/** Executa uma interação disparada em `camada` (origem) na cena atual. */
export function executar(doc: DocumentoProjeto, e: EstadoRuntime, camada: Camada, inter: Interacao): { estado: EstadoRuntime; efeitos: Efeito[] } {
  const cena = cenaAtual(doc, e)
  if (!cena) return { estado: e, efeitos: [] }
  const chaveOnce = `${cena.id}:${camada.id}`
  if (inter.conditions.once && e.disparadas.includes(chaveOnce)) return { estado: e, efeitos: [] }
  const base: EstadoRuntime = inter.conditions.once ? { ...e, disparadas: [...e.disparadas, chaveOnce] } : e
  const efeitos: Efeito[] = []
  const acao = inter.do

  switch (acao.action) {
    case 'nextScene':
      return { estado: irPara(doc, base, e.indice + 1, inter.transition), efeitos }
    case 'prevScene':
      return { estado: irPara(doc, base, e.indice - 1, inter.transition), efeitos }
    case 'goToScene': {
      const i = indiceDaCena(doc, acao.targetSceneId)
      if (i < 0) return { estado: base, efeitos }
      return { estado: irPara(doc, base, i, inter.transition), efeitos }
    }
    case 'openLink':
      efeitos.push({ tipo: 'abrirLink', url: acao.url, novaAba: acao.newTab })
      return { estado: base, efeitos }
    case 'toggleLayer': {
      const alvo = cena.layers.find((l) => l.id === acao.targetLayerId)
      if (!alvo) return { estado: base, efeitos }
      const atual = camadaVisivel(alvo, base)
      const novo = acao.mode === 'show' ? true : acao.mode === 'hide' ? false : !atual
      if (novo === atual) return { estado: base, efeitos }
      return { estado: { ...base, visiveis: { ...base.visiveis, [alvo.id]: novo } }, efeitos }
    }
    case 'toggleVideo':
      efeitos.push({ tipo: 'video', layerId: acao.targetLayerId, modo: acao.mode })
      return { estado: base, efeitos }
    case 'animate': {
      const anterior = base.animacoes[acao.targetLayerId]
      return { estado: { ...base, animacoes: { ...base.animacoes, [acao.targetLayerId]: { animacao: acao.animation, nonce: (anterior?.nonce ?? 0) + 1 } } }, efeitos }
    }
  }
}

/** Interações de entrada de cena (trigger sceneEnter), executadas uma vez ao montar a cena. */
export function aoEntrarNaCena(doc: DocumentoProjeto, e: EstadoRuntime): { estado: EstadoRuntime; efeitos: Efeito[] } {
  const cena = cenaAtual(doc, e)
  if (!cena) return { estado: e, efeitos: [] }
  let estado = e
  const efeitos: Efeito[] = []
  for (const c of cena.layers) {
    if (c.interaction?.trigger === 'sceneEnter') {
      const r = executar(doc, estado, c, c.interaction)
      estado = r.estado
      efeitos.push(...r.efeitos)
    }
  }
  return { estado, efeitos }
}

/** Reverte o efeito de um hover ao sair (apenas para toggleLayer em modo toggle). */
export function aoSairHover(doc: DocumentoProjeto, e: EstadoRuntime, camada: Camada): EstadoRuntime {
  const inter = camada.interaction
  if (!inter || inter.trigger !== 'hover' || inter.do.action !== 'toggleLayer' || inter.do.mode !== 'toggle') return e
  const cena = cenaAtual(doc, e)
  const alvo = cena?.layers.find((l) => l.id === (inter.do as { targetLayerId: string }).targetLayerId)
  if (!alvo) return e
  const { [alvo.id]: _, ...resto } = e.visiveis
  return { ...e, visiveis: resto }
}

/** Com prefers-reduced-motion: substitui por transição instantânea ou fade discreto. */
export function adaptarAnimacao(a: Animacao, reduzirMovimento: boolean): Animacao {
  if (!reduzirMovimento) return a
  if (a.type === 'none') return a
  const saida = a.type === 'fadeOut' || a.type === 'scaleOut'
  return { type: saida ? 'fadeOut' : 'fadeIn', duration: 150, delay: 0, easing: 'linear' }
}

export const EASING_CSS: Record<Animacao['easing'], string> = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
}
