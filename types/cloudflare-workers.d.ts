/**
 * Tipos mínimos do runtime do Cloudflare usados pela sala de colaboração (Durable Object + WebSocket).
 * Os tipos vêm do pacote @cloudflare/workers-types na forma de módulo (index.ts), sem os globais dele, que
 * brigariam com os tipos do DOM do resto do app. Só o que o runtime injeta (o módulo `cloudflare:workers` e
 * alguns globais, em cloudflare-globais.d.ts) é declarado aqui.
 */
declare module 'cloudflare:workers' {
  type EstadoDurableObject = import('@cloudflare/workers-types/index.ts').DurableObjectState
  export abstract class DurableObject<Env = unknown> {
    protected ctx: EstadoDurableObject
    protected env: Env
    constructor(ctx: EstadoDurableObject, env: Env)
  }
}
