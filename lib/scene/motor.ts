/**
 * Motor de interação: reducer PURO compartilhado por preview e visualizador.
 * Recebe (documento, estado, interação) e devolve novo estado + efeitos colaterais
 * que a UI executa (abrir link, tocar vídeo). Nunca executa código do autor.
 */
import { resolverTransicao } from './morph'
import { ANIMACOES_DE_SAIDA, type Animacao, type Camada, type DocumentoProjeto, type Interacao, type Transicao } from './schema'

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
    // automática (padrão): morph se o mesmo objeto mudou entre as telas, senão fade (lib/scene/morph.ts)
    transicao: cena ? resolverTransicao(doc.scenes[e.indice], cena, transicao ?? cena.transition) : { type: 'fade', duration: 400, easing: 'easeInOut' },
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
    for (const inter of c.interactions) {
      if (inter.trigger !== 'sceneEnter') continue
      const r = executar(doc, estado, c, inter)
      estado = r.estado
      efeitos.push(...r.efeitos)
    }
  }
  return { estado, efeitos }
}

/** Interações da camada para um trigger. */
export function interacoesDe(camada: Camada, trigger: Interacao['trigger']): Interacao[] {
  return camada.interactions.filter((i) => i.trigger === trigger)
}

/** Reverte o efeito de hover ao sair (toggleLayer em modo toggle volta ao estado original). */
export function aoSairHover(doc: DocumentoProjeto, e: EstadoRuntime, camada: Camada): EstadoRuntime {
  const cena = cenaAtual(doc, e)
  let visiveis = e.visiveis
  for (const inter of interacoesDe(camada, 'hover')) {
    if (inter.do.action !== 'toggleLayer' || inter.do.mode !== 'toggle') continue
    const alvoId = inter.do.targetLayerId
    if (!cena?.layers.some((l) => l.id === alvoId)) continue
    const { [alvoId]: _, ...resto } = visiveis
    visiveis = resto
  }
  return visiveis === e.visiveis ? e : { ...e, visiveis }
}

/** Executa todas as interações de um trigger em sequência (ex.: um clique que mostra uma camada e toca um vídeo). */
export function executarTodas(doc: DocumentoProjeto, e: EstadoRuntime, camada: Camada, trigger: Interacao['trigger']): { estado: EstadoRuntime; efeitos: Efeito[] } {
  let estado = e
  const efeitos: Efeito[] = []
  for (const inter of interacoesDe(camada, trigger)) {
    const r = executar(doc, estado, camada, inter)
    estado = r.estado
    efeitos.push(...r.efeitos)
  }
  return { estado, efeitos }
}

/** Com prefers-reduced-motion: substitui por transição instantânea ou fade discreto. */
export function adaptarAnimacao(a: Animacao, reduzirMovimento: boolean): Animacao {
  if (!reduzirMovimento) return a
  if (a.type === 'none') return a
  const saida = (ANIMACOES_DE_SAIDA as readonly string[]).includes(a.type)
  return { type: saida ? 'fadeOut' : 'fadeIn', duration: 150, delay: 0, easing: 'linear' }
}

/** Transição de tela sob reduced-motion: tudo vira fade curto (morph inclusive). */
export function adaptarTransicao(t: Transicao | null, reduzirMovimento: boolean): Transicao | null {
  if (!t || !reduzirMovimento || t.type === 'none') return t
  return { type: 'fade', duration: 150, easing: 'linear' }
}

export const EASING_CSS: Record<Animacao['easing'], string> = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}
