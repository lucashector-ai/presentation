/**
 * Origem pública do Mostra (https://mostra.page), num lugar só. Serve no servidor e no navegador: sem
 * `server-only`, sem dependências. Quem monta URL absoluta (links de compartilhamento, convites, metadados,
 * sitemap), confere origem (CSRF, sala de colaboração) ou redireciona host usa daqui.
 *
 * Configuração: `NEXT_PUBLIC_SITE_URL` (inlinada no build pelo vinext; no Worker também vem de `vars` do
 * wrangler.jsonc). `NEXT_PUBLIC_APP_URL` é o nome antigo e continua aceito. Sem nenhuma, vale o domínio oficial.
 *
 * Transição: enquanto o DNS de mostra.page não aponta para o Cloudflare, o app segue no ar em
 * mostra.oobo-site.workers.dev (e, no local, em localhost). Nesses hosts as URLs montadas usam a origem do
 * próprio pedido, para os links não apontarem para um domínio que ainda não responde. Quando o workers.dev
 * passar a redirecionar para o domínio, basta tirá-lo de `HOSTS_DE_TRANSICAO`.
 */

const PADRAO = 'https://mostra.page'

function origemDe(valor: string | undefined): string | null {
  if (!valor) return null
  try {
    return new URL(valor).origin
  } catch {
    return null
  }
}

/** Origem canônica do site, sem barra no fim (ex.: "https://mostra.page"). */
export const ORIGEM_SITE: string = origemDe(process.env.NEXT_PUBLIC_SITE_URL) ?? origemDe(process.env.NEXT_PUBLIC_APP_URL) ?? PADRAO

/** Host canônico (ex.: "mostra.page"). */
export const HOST_SITE: string = new URL(ORIGEM_SITE).hostname

/** Host que redireciona para o canônico (www.mostra.page → mostra.page). */
export const HOST_WWW: string = `www.${HOST_SITE}`

/** Endereço do Worker antes do domínio próprio; continua respondendo durante a transição. */
export const ORIGEM_WORKERS_DEV = 'https://mostra.oobo-site.workers.dev'

/**
 * Origens em que o app está no ar e das quais o navegador pode mandar pedidos com cookie (checagem de CSRF nas
 * mutações e no WebSocket da sala). A origem do próprio pedido é sempre aceita também, então localhost e
 * previews funcionam sem entrar aqui.
 */
export const ORIGENS_DO_APP: ReadonlySet<string> = new Set([ORIGEM_SITE, ORIGEM_WORKERS_DEV])

/** Hosts de desenvolvimento e de transição: neles, as URLs absolutas usam a origem do pedido, não a canônica. */
const HOSTS_DE_TRANSICAO = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost|.+\.workers\.dev)$/i

export const ehHostDeTransicao = (host: string): boolean => HOSTS_DE_TRANSICAO.test(host.replace(/:\d+$/, ''))

/** Hostname de um pedido, URL ou endereço (sem porta). */
function hostDe(origem: Request | URL | string): string {
  const url = origem instanceof URL ? origem : new URL(typeof origem === 'string' ? origem : origem.url)
  return url.hostname
}

function origemCompleta(origem: Request | URL | string): string {
  const url = origem instanceof URL ? origem : new URL(typeof origem === 'string' ? origem : origem.url)
  return url.origin
}

/**
 * Origem para montar URLs absolutas a partir de um pedido: a canônica quando o app foi acessado pelo domínio
 * (inclusive por www), a do próprio pedido em localhost e no workers.dev.
 */
export function origemCanonica(pedido: Request | URL | string): string {
  const host = hostDe(pedido)
  if (host === HOST_SITE || host === HOST_WWW) return ORIGEM_SITE
  if (ehHostDeTransicao(host)) return origemCompleta(pedido)
  return ORIGEM_SITE
}

/** O mesmo que `origemCanonica`, para código do navegador (no servidor, devolve a canônica). */
export function origemNoNavegador(): string {
  if (typeof window === 'undefined' || !window.location?.href) return ORIGEM_SITE
  return origemCanonica(window.location.href)
}

/** URL absoluta de um caminho do site (ex.: urlDoSite('/p/abc') → "https://mostra.page/p/abc"). */
export function urlDoSite(caminho = '/', origem: string = ORIGEM_SITE): string {
  return new URL(caminho, `${origem}/`).href
}

/**
 * Para onde um pedido deve ser redirecionado (301) por causa do host, ou null se o host já é o certo.
 * Só o www vai para o apex; o workers.dev continua atendendo durante a transição.
 */
export function destinoCanonico(url: URL): string | null {
  if (url.hostname !== HOST_WWW) return null
  return `${ORIGEM_SITE}${url.pathname}${url.search}`
}
