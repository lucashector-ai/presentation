/** Globais do runtime dos Workers usados pela sala de colaboração (ver cloudflare-workers.d.ts). */
import type { WebSocket as WebSocketCf, WebSocketRequestResponsePair as ParCf } from '@cloudflare/workers-types/index.ts'

declare global {
  // eslint-disable-next-line no-var
  var WebSocketPair: { new (): { 0: WebSocketCf; 1: WebSocketCf } }
  // eslint-disable-next-line no-var
  var WebSocketRequestResponsePair: { new (request: string, response: string): ParCf }
  interface ResponseInit {
    /** Workers: resposta 101 que entrega o lado cliente do WebSocket. */
    webSocket?: WebSocketCf | null
  }
}

export {}
