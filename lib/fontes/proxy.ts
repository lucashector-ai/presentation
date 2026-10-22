/**
 * Proxy de fontes do Google no Worker (worker/index.ts atende /fontes/* antes do vinext).
 *
 * Por que proxy e não o <link> direto para fonts.googleapis.com:
 * - privacidade: quem abre um link privado (/p/:token) não tem o IP enviado ao Google (o produto é privado por
 *   padrão; o app já usa Referrer-Policy no-referrer);
 * - exportação PNG/PDF: a folha e os arquivos ficam na mesma origem, então o modern-screenshot consegue ler as
 *   regras @font-face (folha de outra origem sem CORS não deixa) e embutir as fontes — antes saía com a de reserva;
 * - robustez: o Worker ajusta o pedido às variantes que a família tem (o css2 do Google responde 400 se um peso
 *   não existe), corta os alfabetos que o português não usa e guarda tudo no cache da borda (caches.default);
 * - CSP: se o app ganhar uma Content-Security-Policy, fontes e estilos seguem em 'self'.
 * Custo: uma ida ao Google por colo na primeira vez; depois, cache (folhas 1 dia, arquivos 1 ano, imutáveis).
 */
import bruto from './catalogo-google.json'
import type { CatalogoBruto } from './catalogo'
import { lerPedido, ROTA_ARQUIVO, ROTA_CSS, reescreverCss, urlArquivoGoogle, urlGoogle, type InfoFamilia } from './url'

/** Agente de um Chrome atual: o Google entrega woff2 com unicode-range (todos os navegadores suportados leem). */
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const CACHE_CSS = 'public, max-age=86400, stale-while-revalidate=604800'
const CACHE_ARQUIVO = 'public, max-age=31536000, immutable'

let infos: Map<string, InfoFamilia> | null = null
function infoDe(familia: string): InfoFamilia | undefined {
  if (!infos) {
    const lerPesos = (s: string): InfoFamilia['pesos'] | null => {
      if (!s) return null
      const m = /^(\d+)\.\.(\d+)$/.exec(s)
      return m ? { tipo: 'faixa', min: Number(m[1]), max: Number(m[2]) } : { tipo: 'lista', valores: s.split(',').map(Number) }
    }
    infos = new Map((bruto as unknown as CatalogoBruto).familias.map(([nome, , p, pi]) => [nome, { pesos: lerPesos(p) ?? { tipo: 'lista', valores: [400] }, italico: lerPesos(pi) }]))
  }
  return infos.get(familia)
}

export const ehRotaFontes = (caminho: string) => caminho === ROTA_CSS || caminho.startsWith(ROTA_ARQUIVO)

interface Contexto { waitUntil(p: Promise<unknown>): void }
type Buscar = (req: Request) => Promise<Response>

const cacheDaBorda = (): Cache | undefined => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default

const SEGURANCA = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }

function cssVazio(motivo: string, cache = 'public, max-age=3600'): Response {
  return new Response(`/* ${motivo} */\n`, { status: 200, headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': cache, ...SEGURANCA } })
}

/** Atende GET /fontes/css e /fontes/arquivo/… (null = não é rota de fontes). */
export async function atenderFontes(request: Request, ctx?: Contexto, buscar: Buscar = (r) => fetch(r)): Promise<Response | null> {
  const url = new URL(request.url)
  if (!ehRotaFontes(url.pathname)) return null
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido', { status: 405, headers: { allow: 'GET, HEAD' } })

  let destino: string | null
  let ehCss = false
  if (url.pathname === ROTA_CSS) {
    const pedido = lerPedido(url.searchParams)
    if (!pedido) return new Response('Pedido de fonte inválido', { status: 400 })
    destino = urlGoogle(pedido, infoDe)
    // família fora do catálogo (fonte do sistema, colada do Figma): folha vazia, a pilha CSS segue para a reserva
    if (!destino) return cssVazio('família fora do catálogo do Google Fonts', 'public, max-age=86400')
    ehCss = true
  } else {
    destino = urlArquivoGoogle(url.pathname, url.search.slice(1))
    if (!destino) return new Response('Arquivo de fonte inválido', { status: 400 })
  }

  const chave = new Request(destino, { method: 'GET' })
  const cache = cacheDaBorda()
  const guardada = await cache?.match(chave).catch(() => undefined)
  if (guardada) return guardada

  let resposta: Response
  try {
    const r = await buscar(new Request(destino, { headers: { 'user-agent': AGENTE, accept: ehCss ? 'text/css,*/*;q=0.1' : '*/*' } }))
    if (!r.ok) {
      console.error(JSON.stringify({ nivel: 'aviso', origem: 'fontes', status: r.status, destino: destino.slice(0, 200) }))
      return ehCss ? cssVazio(`Google Fonts respondeu ${r.status}`, 'no-store') : new Response('Fonte indisponível', { status: 502, headers: { 'cache-control': 'no-store' } })
    }
    if (ehCss) {
      const css = reescreverCss(await r.text())
      resposta = new Response(css, { status: 200, headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': CACHE_CSS, ...SEGURANCA } })
    } else {
      const tipo = r.headers.get('content-type') ?? ''
      resposta = new Response(r.body, { status: 200, headers: { 'content-type': /^font\/|^application\/(font|x-font|octet-stream)/.test(tipo) ? tipo : 'font/woff2', 'cache-control': CACHE_ARQUIVO, 'access-control-allow-origin': '*', ...SEGURANCA } })
    }
  } catch (e) {
    console.error(JSON.stringify({ nivel: 'aviso', origem: 'fontes', mensagem: e instanceof Error ? e.message.slice(0, 200) : 'falha' }))
    return ehCss ? cssVazio('Google Fonts indisponível agora', 'no-store') : new Response('Fonte indisponível', { status: 502, headers: { 'cache-control': 'no-store' } })
  }
  if (cache) {
    const copia = resposta.clone()
    const guardar = cache.put(chave, copia).catch(() => undefined)
    if (ctx) ctx.waitUntil(guardar)
    else await guardar
  }
  return resposta
}
