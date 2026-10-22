/**
 * Entrada do Worker do Mostra: o vinext atende o app inteiro; só duas coisas são atendidas antes, aqui:
 * o WebSocket da sala de colaboração (GET /api/projects/:id/sala, repassado ao Durable Object do projeto) e o
 * proxy das fontes do Google (GET /fontes/css e /fontes/arquivo/…, lib/fontes/proxy.ts).
 * A classe do Durable Object precisa ser exportada pelo módulo principal do Worker (wrangler.jsonc → "exports").
 */
import handler from 'vinext/server/fetch-handler'
import { entrarNaSala, ROTA_SALA, type NamespaceSalas } from '@/lib/colab/entrada'
import { atenderFontes, ehRotaFontes } from '@/lib/fontes/proxy'

export { SalaProjeto } from '@/lib/colab/sala'

interface AmbienteWorker {
  ASSETS?: { fetch(request: Request): Promise<Response> | Response }
  /** Binding do Durable Object das salas (wrangler.jsonc). */
  SALAS?: NamespaceSalas
}

type ContextoExecucao = Parameters<typeof handler.fetch>[2]

const worker = {
  async fetch(request: Request, env: AmbienteWorker, ctx: ContextoExecucao): Promise<Response> {
    const caminho = new URL(request.url).pathname
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
    return handler.fetch(request, env, ctx)
  },
}

export default worker
