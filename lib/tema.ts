/**
 * Tema da interface (claro, escuro ou automático = segue o sistema).
 * - A preferência fica em localStorage e no cookie `tema` (o servidor renderiza o `data-tema` certo, sem piscar).
 * - `<html data-tema>` guarda o tema EFETIVO (claro | escuro): os tokens de app/globals.css e a variante `dark:`
 *   do Tailwind leem daí. Com "auto", o valor acompanha `prefers-color-scheme` (e o CSS tem a mesma regra em
 *   @media, para quando o script ainda não rodou ou o JS está desligado).
 * - O conteúdo das apresentações não muda com o tema (SceneRenderer fixa color-scheme e cores do documento).
 * Sem diretiva 'use client': o layout (servidor) importa SCRIPT_TEMA; as funções que tocam o DOM só rodam no cliente.
 */
export const TEMAS = ['auto', 'claro', 'escuro'] as const
export type Tema = (typeof TEMAS)[number]
export type TemaEfetivo = Exclude<Tema, 'auto'>

export const CHAVE_TEMA = 'tema'
const UM_ANO = 60 * 60 * 24 * 365

/** Cor da barra do navegador (meta theme-color) por tema efetivo — o `--cor-fundo` de cada um. */
export const COR_BARRA: Record<TemaEfetivo, string> = { claro: '#FAFAF9', escuro: '#121110' }

export const ROTULOS_TEMA: Record<Tema, { rotulo: string; descricao: string }> = {
  auto: { rotulo: 'Automático', descricao: 'Segue o sistema' },
  claro: { rotulo: 'Claro', descricao: 'Sempre claro' },
  escuro: { rotulo: 'Escuro', descricao: 'Sempre escuro' },
}

export const ehTema = (v: unknown): v is Tema => typeof v === 'string' && (TEMAS as readonly string[]).includes(v)

/** Lê a preferência de um cabeçalho Cookie (servidor). */
export function temaDoCookie(cookie: string | null | undefined): Tema {
  const m = cookie?.match(/(?:^|;\s*)tema=(auto|claro|escuro)(?:;|$)/)
  return m && ehTema(m[1]) ? m[1] : 'auto'
}

/**
 * Script inline do <head>, antes do CSS pintar: resolve a preferência (localStorage → cookie → auto) no tema
 * efetivo e grava em <html data-tema>. Sem dependências e sem nada que lance para fora do try.
 */
export const SCRIPT_TEMA = `(function(){try{var h=document.documentElement,t=null;try{t=localStorage.getItem('${CHAVE_TEMA}')}catch(e){}if(!t){var m=document.cookie.match(/(?:^|;\\s*)${CHAVE_TEMA}=(auto|claro|escuro)/);t=m?m[1]:null}if(t!=='claro'&&t!=='escuro')t='auto';var e=t==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'escuro':'claro'):t;h.dataset.tema=e;h.dataset.temaPref=t;var c=document.querySelector('meta[name="color-scheme"]');if(c)c.setAttribute('content',t==='auto'?'light dark':t==='claro'?'only light':'dark');var cores={claro:'${COR_BARRA.claro}',escuro:'${COR_BARRA.escuro}'};document.querySelectorAll('meta[name="theme-color"]').forEach(function(n){n.setAttribute('content',cores[e])})}catch(e){}})()`

const ouvintes = new Set<() => void>()
let midia: MediaQueryList | null = null

/** Preferência salva (cliente). */
export function lerTema(): Tema {
  if (typeof document === 'undefined') return 'auto'
  try {
    const v = localStorage.getItem(CHAVE_TEMA)
    if (ehTema(v)) return v
  } catch { /* sem armazenamento */ }
  return temaDoCookie(document.cookie)
}

export const prefereEscuro = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches

export const temaEfetivo = (t: Tema): TemaEfetivo => (t === 'auto' ? (prefereEscuro() ? 'escuro' : 'claro') : t)

/** Aplica no documento: <html data-tema>, meta color-scheme e theme-color. */
export function aplicarTema(t: Tema = lerTema()) {
  if (typeof document === 'undefined') return
  const e = temaEfetivo(t)
  const h = document.documentElement
  h.dataset.tema = e
  h.dataset.temaPref = t
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t === 'auto' ? 'light dark' : t === 'claro' ? 'only light' : 'dark')
  document.querySelectorAll('meta[name="theme-color"]').forEach((n) => n.setAttribute('content', COR_BARRA[e]))
  // com "auto", acompanha o sistema enquanto a página está aberta
  if (!midia && typeof matchMedia !== 'undefined') {
    midia = matchMedia('(prefers-color-scheme: dark)')
    midia.addEventListener('change', () => { if (lerTema() === 'auto') aplicarTema('auto'); ouvintes.forEach((f) => f()) })
  }
}

/** Salva a preferência (localStorage + cookie), aplica e avisa quem usa `useTema`. */
export function definirTema(t: Tema) {
  try { localStorage.setItem(CHAVE_TEMA, t) } catch { /* ignorar */ }
  try { document.cookie = `${CHAVE_TEMA}=${t}; path=/; max-age=${UM_ANO}; SameSite=Lax` } catch { /* ignorar */ }
  aplicarTema(t)
  ouvintes.forEach((f) => f())
}

export function assinarTema(f: () => void) {
  ouvintes.add(f)
  return () => { ouvintes.delete(f) }
}
