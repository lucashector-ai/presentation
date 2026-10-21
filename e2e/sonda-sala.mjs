/**
 * Sonda da entrada da sala (WebSocket) sem navegador: confere que o handshake é recusado sem sessão, com origem de
 * outro site e para quem não é membro. Uso: node e2e/sonda-sala.mjs http://localhost:3105 <projetoId> [cookie]
 */
import WebSocket from 'ws'

const [base = 'http://localhost:3105', projeto = '00000000-0000-4000-8000-000000000000', cookie = ''] = process.argv.slice(2)

export function tentar(baseUrl, projetoId, { origem, cookie: c } = {}) {
  const url = `${baseUrl.replace(/^http/, 'ws')}/api/projects/${projetoId}/sala?cliente=sonda12345678`
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { headers: { ...(origem ? { origin: origem } : {}), ...(c ? { cookie: c } : {}) } })
    const fim = (r) => { try { ws.terminate() } catch { /* já fechado */ } resolve(r) }
    ws.on('unexpected-response', (_req, res) => fim({ aberto: false, status: res.statusCode }))
    ws.on('open', () => {
      ws.once('message', (m) => fim({ aberto: true, primeira: String(m).slice(0, 40) }))
      setTimeout(() => fim({ aberto: true }), 3000)
    })
    ws.on('error', (e) => fim({ aberto: false, erro: e.message }))
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('sem sessão:', await tentar(base, projeto, { origem: base }))
  console.log('origem de outro site:', await tentar(base, projeto, { origem: 'https://malicioso.example', cookie }))
  if (cookie) console.log('com sessão:', await tentar(base, projeto, { origem: base, cookie }))
}
