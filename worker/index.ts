/**
 * Entrada do Worker do Mostra: o vinext atende o app inteiro; só algumas coisas são atendidas antes, aqui:
 * o WebSocket da sala de colaboração (GET /api/projects/:id/sala, repassado ao Durable Object do projeto) e o
 * proxy das fontes do Google (GET /fontes/css e /fontes/arquivo/…, lib/fontes/proxy.ts) e o atalho de quem já está
 * conectado (/, /login e /signup → painel, lib/auth/entrada.ts).
 * A classe do Durable Object precisa ser exportada pelo módulo principal do Worker (wrangler.jsonc → "exports").
 */
import handler from 'vinext/server/fetch-handler'
import { entrarNaSala, ROTA_SALA, type NamespaceSalas } from '@/lib/colab/entrada'
import { atenderFontes, ehRotaFontes } from '@/lib/fontes/proxy'
import { destinoCanonico, HOST_SITE } from '@/lib/site'
import { entrarDiretoSeConectado } from '@/lib/auth/entrada'

export { SalaProjeto } from '@/lib/colab/sala'

/**
 * Domínio próprio (lib/site.ts): www.mostra.page → 301 para mostra.page, com caminho e consulta. Em mostra.page,
 * HSTS (o TLD .page já está na lista de pré-carregamento dos navegadores, então só HTTPS chega aqui; o cabeçalho
 * fixa isso também para quem digitou o endereço). O workers.dev continua atendendo normalmente durante a
 * transição; o redirecionamento dele fica para depois de o DNS apontar para o Cloudflare (docs/dominio.md).
 */
const HSTS = 'max-age=31536000; includeSubDomains'

function comCabecalhosCanonicos(resposta: Response): Response {
  if (resposta.status === 101 || resposta.headers.has('strict-transport-security')) return resposta
  try {
    resposta.headers.set('strict-transport-security', HSTS)
    return resposta
  } catch {
    const copia = new Response(resposta.body, resposta)
    copia.headers.set('strict-transport-security', HSTS)
    return copia
  }
}

interface AmbienteWorker {
  ASSETS?: { fetch(request: Request): Promise<Response> | Response }
  /** Binding do Durable Object das salas (wrangler.jsonc). */
  SALAS?: NamespaceSalas
}

type ContextoExecucao = Parameters<typeof handler.fetch>[2]

const worker = {
  async fetch(request: Request, env: AmbienteWorker, ctx: ContextoExecucao): Promise<Response> {
    const url = new URL(request.url)
    const destino = destinoCanonico(url)
    if (destino) return Response.redirect(destino, 301)
    const caminho = url.pathname
    // fontes do Google pela mesma origem (lib/fontes/proxy.ts: privacidade, exportação e cache da borda)
    if (ehRotaFontes(caminho)) return (await atenderFontes(request, ctx))!
    const m = caminho.match(ROTA_SALA)
    if (m) {
      try {
        return await entrarNaSala(request, env.SALAS, m[1]!)
      } catch (e) {
        console.error(JSON.stringify({ nivel: 'erro', origem: 'sala', mensagem: e instanceof Error ? e.message.slice(0, 200) : 'falha na entrada' }))
        return new Response('Não foi possível entrar na sala agora', { status: 500 })
      }
    }
    // conectado: página inicial, login e cadastro levam direto ao painel (lib/auth/entrada.ts)
    const direto = await entrarDiretoSeConectado(request)
    if (direto) return url.hostname === HOST_SITE ? comCabecalhosCanonicos(direto) : direto
    const resposta = await handler.fetch(request, env, ctx)
    return url.hostname === HOST_SITE ? comCabecalhosCanonicos(resposta) : resposta
  },
}

export default worker
