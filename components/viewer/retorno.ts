'use client'
/**
 * Ida e volta da apresentação. Quem abre a apresentação passa `?voltar=<url atual>`; ao sair (Esc, X ou
 * botão Voltar do navegador) a pessoa volta exatamente para onde estava — sem entrada duplicada no
 * histórico. Vindo do editor, a tela que estava sendo apresentada fica selecionada ao voltar.
 */

const CHAVE_ORIGEM = 'mostra.apresentacao.origem'
const chaveTela = (projetoId: string) => `mostra.apresentacao.tela.${projetoId}`

function sessao(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Só caminhos internos (evita redirecionamento aberto: "//site", "https://…", "javascript:"). */
export function destinoSeguro(v: string | null | undefined): string | null {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return null
  return v
}

export function ehEditor(url: string, projetoId: string) {
  return url.split(/[?#]/)[0] === `/app/projects/${projetoId}/edit`
}

/** URL da apresentação (ou da visão do apresentador) com o caminho de volta = página atual. */
export function urlApresentar(projetoId: string, opcoes: { inicio?: number; apresentador?: boolean; voltar?: string } = {}) {
  const voltar = opcoes.voltar ?? (typeof window !== 'undefined' ? window.location.pathname + window.location.search : `/app/projects/${projetoId}`)
  const q = new URLSearchParams()
  if (opcoes.inicio) q.set('inicio', String(opcoes.inicio))
  q.set('voltar', voltar)
  return `/app/projects/${projetoId}/${opcoes.apresentador ? 'apresentador' : 'apresentar'}?${q.toString()}`
}

/** Marca que a apresentação foi aberta a partir de `voltar` nesta aba (então "voltar" = history.back()). */
export function marcarOrigem(voltar: string) {
  try { sessao()?.setItem(CHAVE_ORIGEM, voltar) } catch { /* sem storage: volta com replace */ }
}

export function veioDe(voltar: string): boolean {
  try { return sessao()?.getItem(CHAVE_ORIGEM) === voltar } catch { return false }
}

/** Tela sendo apresentada (lida pelo editor ao voltar). */
export function lembrarTela(projetoId: string, cenaId: string) {
  try { sessao()?.setItem(chaveTela(projetoId), cenaId) } catch { /* opcional */ }
}

/** Lê e apaga a tela apresentada por último (o editor seleciona essa tela ao voltar). */
export function consumirTela(projetoId: string): string | null {
  try {
    const s = sessao()
    const v = s?.getItem(chaveTela(projetoId)) ?? null
    s?.removeItem(chaveTela(projetoId))
    return v
  } catch {
    return null
  }
}

/** Sai da tela cheia antes de navegar (senão a página de destino continuaria em tela cheia). */
export function sairDaTelaCheia() {
  if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
}

/** Pede tela cheia no gesto do clique (antes de navegar para a apresentação). */
export function pedirTelaCheia() {
  try {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen().catch(() => undefined)
  } catch {
    /* sem suporte (iOS): apresenta na janela */
  }
}

/** Abre a apresentação (ou a visão do apresentador) lembrando a página atual como destino da volta. */
export function abrirApresentacao(router: { push: (url: string) => void }, projetoId: string, opcoes: { inicio?: number; apresentador?: boolean } = {}) {
  const voltar = window.location.pathname + window.location.search
  marcarOrigem(voltar)
  router.push(urlApresentar(projetoId, { ...opcoes, voltar }))
}
