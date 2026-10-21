/**
 * Preload de DESENVOLVIMENTO: encaminha o fetch de saída do Worker (workerd, dentro do `vite dev`) pelo Node.
 *
 * Para quê: em ambientes onde o workerd não resolve DNS (a internet só sai por um proxy HTTP, como nas sessões de
 * agente), as rotas /api não alcançam o Neon (Postgres por HTTP e Neon Auth). O Node respeita HTTPS_PROXY com
 * NODE_USE_ENV_PROXY=1; este preload faz o plugin do Cloudflare criar o Miniflare com `outboundService` apontando
 * para o `fetch` do Node. Não entra no build nem no Worker de produção.
 *
 * Uso: NODE_USE_ENV_PROXY=1 node --import ./e2e/saida-pelo-node.mjs node_modules/vite/bin/vite.js dev --port 3104
 * Limite: só HTTP(S). WebSocket de saída (Pool do driver do Neon) não passa por aqui; as rotas usam o driver HTTP.
 */
import { createRequire, register } from 'node:module'

const require = createRequire(import.meta.url)
const { Response: RespostaMf } = require('miniflare')

async function encaminhar(req) {
  const corpo = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer()
  const headers = new Headers()
  for (const [k, v] of req.headers) if (!/^(host|connection|keep-alive|transfer-encoding|content-length|mf-|cf-)/i.test(k)) headers.append(k, v)
  let r
  try {
    r = await fetch(req.url, { method: req.method, headers, body: corpo, redirect: 'manual' })
  } catch (e) {
    console.error('[saida-pelo-node]', req.method, new URL(req.url).host, e?.cause?.code ?? e?.cause?.message ?? e?.message)
    throw e
  }
  const cabecalhos = new Headers(r.headers)
  // o fetch do Node já descomprime o corpo: o cabeçalho original enganaria o workerd
  cabecalhos.delete('content-encoding')
  cabecalhos.delete('content-length')
  return new RespostaMf(r.status === 204 || r.status === 304 ? null : await r.arrayBuffer(), { status: r.status, statusText: r.statusText, headers: [...cabecalhos] })
}

/** Acrescenta o outboundService a cada Worker (aceita as opções no formato v4 e no atual, com `dev`). */
globalThis.__mostraSaidaPeloNode = (opcoes) => {
  for (const w of opcoes?.workers ?? []) {
    if (w.dev && typeof w.dev === 'object') w.dev = { ...w.dev, outboundService: { type: 'fetcher', handler: encaminhar } }
    else w.outboundService = encaminhar
  }
  return opcoes
}

// reescreve, só em memória, as duas chamadas do plugin que criam/atualizam o Miniflare
const gancho = `
export async function load(url, context, next) {
  const r = await next(url, context)
  if (!url.includes('@cloudflare/vite-plugin/dist/index.mjs')) return r
  const fonte = String(r.source)
    .replace('new Miniflare(options)', 'new Miniflare(globalThis.__mostraSaidaPeloNode(options))')
    .replace('miniflare.setOptions(options)', 'miniflare.setOptions(globalThis.__mostraSaidaPeloNode(options))')
  return { ...r, source: fonte, shortCircuit: true }
}`
register(`data:text/javascript,${encodeURIComponent(gancho)}`, import.meta.url)
