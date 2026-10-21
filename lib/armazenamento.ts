import 'server-only'
/**
 * Armazenamento de mídias (originais e variantes). Em produção é o Cloudflare R2, pelo binding `MIDIAS`
 * do Worker (`obterBucketMidias()` em lib/cf/ambiente.ts). Fora do Worker (dev no Node, testes) usa um
 * armazenamento de desenvolvimento: disco (`ARMAZENAMENTO_DEV_DIR`, padrão `.armazenamento-dev/`) ou
 * memória (`ARMAZENAMENTO_DEV=memoria`). Em produção sem bucket e sem pasta explícita, falha em vez de
 * gravar em disco efêmero.
 *
 * O bucket é PRIVADO: nada aqui gera URL pública. Quem serve os arquivos são as rotas de mídia, depois de
 * conferir a permissão (app/api/midias/[id] e app/api/share/[token]/midias/[id]).
 */
import { obterBucketMidias } from '@/lib/cf/ambiente'

// ---------- contrato mínimo do binding R2 que usamos (o R2Bucket do Workers é compatível) ----------
export interface MetadadosHttpR2 { contentType?: string; cacheControl?: string }
export interface ObjetoR2 { key: string; size: number; etag: string; httpEtag: string; uploaded: Date; httpMetadata?: MetadadosHttpR2 }
export interface ObjetoR2ComCorpo extends ObjetoR2 { body: ReadableStream }
export interface BucketR2 {
  head(key: string): Promise<ObjetoR2 | null>
  get(key: string, options?: { range?: { offset: number; length?: number } }): Promise<ObjetoR2ComCorpo | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: { httpMetadata?: MetadadosHttpR2 }): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: ObjetoR2[]; truncated: boolean; cursor?: string }>
}

// ---------- API do app ----------
export interface InfoObjeto { tamanho: number; tipo: string | null; etag: string }
export interface ObjetoLido extends InfoObjeto {
  corpo: ReadableStream<Uint8Array>
  /** Presente quando foi pedido um intervalo (Range): bytes [inicio, fim] inclusivos. */
  intervalo?: { inicio: number; fim: number }
}
export type Dados = Uint8Array | ArrayBuffer | string | ReadableStream<Uint8Array>
export interface Intervalo { inicio: number; fim?: number }

export interface Armazenamento {
  /** Grava (sobrescreve). Para stream, informe `tamanho`: o R2 exige comprimento conhecido. */
  guardar(chave: string, dados: Dados, opcoes: { tipo: string; tamanho?: number }): Promise<void>
  ler(chave: string, opcoes?: { intervalo?: Intervalo }): Promise<ObjetoLido | null>
  info(chave: string): Promise<InfoObjeto | null>
  remover(chaves: string | string[]): Promise<void>
  listar(prefixo: string): Promise<string[]>
}

export class ErroArmazenamento extends Error {}

/** Chave de um original: {workspace}/{asset}/original.ext — o prefixo do workspace isola os arquivos. */
export function chaveOriginal(workspaceId: string, assetId: string, extensao: string): string {
  return `${workspaceId}/${assetId}/original.${extensao}`
}

function validarChave(chave: string) {
  if (!chave || chave.length > 512 || chave.startsWith('/') || chave.split('/').some((p) => p === '' || p === '.' || p === '..') || /[\\\0]/.test(chave)) {
    throw new ErroArmazenamento('Chave de armazenamento inválida')
  }
}

const etagDe = async (bytes: Uint8Array) => {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice()))
  return Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function paraBytes(dados: Dados): Promise<Uint8Array> {
  if (typeof dados === 'string') return new TextEncoder().encode(dados)
  if (dados instanceof Uint8Array) return dados
  if (dados instanceof ArrayBuffer) return new Uint8Array(dados)
  return new Uint8Array(await new Response(dados).arrayBuffer())
}

/** Normaliza um pedido de intervalo para o tamanho real; null se não puder ser atendido. */
export function resolverIntervalo(intervalo: Intervalo, tamanho: number): { inicio: number; fim: number } | null {
  const fim = Math.min(intervalo.fim ?? tamanho - 1, tamanho - 1)
  if (intervalo.inicio < 0 || intervalo.inicio > fim) return null
  return { inicio: intervalo.inicio, fim }
}

const streamDe = (bytes: Uint8Array) => new ReadableStream<Uint8Array>({ start(c) { if (bytes.byteLength) c.enqueue(bytes); c.close() } })

// ---------- R2 (Worker) ----------
declare const FixedLengthStream: (new (tamanho: number) => { readable: ReadableStream; writable: WritableStream }) | undefined

export function armazenamentoR2(bucket: BucketR2): Armazenamento {
  return {
    async guardar(chave, dados, { tipo, tamanho }) {
      validarChave(chave)
      let valor: ReadableStream | Uint8Array | ArrayBuffer | string = dados
      if (dados instanceof ReadableStream) {
        // R2 só aceita stream com comprimento conhecido: FixedLengthStream (Workers) evita carregar o arquivo na memória
        if (tamanho != null && typeof FixedLengthStream !== 'undefined') {
          const { readable, writable } = new FixedLengthStream(tamanho)
          void dados.pipeTo(writable).catch(() => {})
          valor = readable
        } else {
          valor = await paraBytes(dados)
        }
      }
      await bucket.put(chave, valor, { httpMetadata: { contentType: tipo } })
    },
    async ler(chave, opcoes) {
      validarChave(chave)
      if (opcoes?.intervalo) {
        const cabeca = await bucket.head(chave)
        if (!cabeca) return null
        const r = resolverIntervalo(opcoes.intervalo, cabeca.size)
        if (!r) throw new ErroIntervalo(cabeca.size)
        const obj = await bucket.get(chave, { range: { offset: r.inicio, length: r.fim - r.inicio + 1 } })
        if (!obj) return null
        return { corpo: obj.body as ReadableStream<Uint8Array>, tamanho: obj.size, tipo: obj.httpMetadata?.contentType ?? null, etag: obj.httpEtag, intervalo: r }
      }
      const obj = await bucket.get(chave)
      if (!obj) return null
      return { corpo: obj.body as ReadableStream<Uint8Array>, tamanho: obj.size, tipo: obj.httpMetadata?.contentType ?? null, etag: obj.httpEtag }
    },
    async info(chave) {
      validarChave(chave)
      const obj = await bucket.head(chave)
      return obj ? { tamanho: obj.size, tipo: obj.httpMetadata?.contentType ?? null, etag: obj.httpEtag } : null
    },
    async remover(chaves) {
      const lista = Array.isArray(chaves) ? chaves : [chaves]
      lista.forEach(validarChave)
      // o binding aceita até 1000 chaves por chamada
      for (let i = 0; i < lista.length; i += 1000) await bucket.delete(lista.slice(i, i + 1000))
    },
    async listar(prefixo) {
      const chaves: string[] = []
      let cursor: string | undefined
      do {
        const r = await bucket.list({ prefix: prefixo, cursor, limit: 1000 })
        chaves.push(...r.objects.map((o) => o.key))
        cursor = r.truncated ? r.cursor : undefined
      } while (cursor)
      return chaves
    },
  }
}

/** Intervalo fora do arquivo (o servidor responde 416). */
export class ErroIntervalo extends ErroArmazenamento {
  constructor(public tamanho: number) {
    super('Intervalo inválido')
  }
}

// ---------- memória (testes) ----------
export function armazenamentoMemoria(): Armazenamento & { objetos: Map<string, { bytes: Uint8Array; tipo: string; etag: string }> } {
  const objetos = new Map<string, { bytes: Uint8Array; tipo: string; etag: string }>()
  return {
    objetos,
    async guardar(chave, dados, { tipo }) {
      validarChave(chave)
      const bytes = await paraBytes(dados)
      objetos.set(chave, { bytes, tipo, etag: `"${await etagDe(bytes)}"` })
    },
    async ler(chave, opcoes) {
      validarChave(chave)
      const o = objetos.get(chave)
      if (!o) return null
      if (opcoes?.intervalo) {
        const r = resolverIntervalo(opcoes.intervalo, o.bytes.byteLength)
        if (!r) throw new ErroIntervalo(o.bytes.byteLength)
        return { corpo: streamDe(o.bytes.slice(r.inicio, r.fim + 1)), tamanho: o.bytes.byteLength, tipo: o.tipo, etag: o.etag, intervalo: r }
      }
      return { corpo: streamDe(o.bytes), tamanho: o.bytes.byteLength, tipo: o.tipo, etag: o.etag }
    },
    async info(chave) {
      validarChave(chave)
      const o = objetos.get(chave)
      return o ? { tamanho: o.bytes.byteLength, tipo: o.tipo, etag: o.etag } : null
    },
    async remover(chaves) {
      for (const c of Array.isArray(chaves) ? chaves : [chaves]) { validarChave(c); objetos.delete(c) }
    },
    async listar(prefixo) {
      return [...objetos.keys()].filter((k) => k.startsWith(prefixo)).sort()
    },
  }
}

// ---------- disco (dev local no Node) ----------
export function armazenamentoDisco(pasta: string): Armazenamento {
  const fs = () => import('node:fs/promises')
  const caminho = async (chave: string) => {
    validarChave(chave)
    const { join, resolve, sep } = await import('node:path')
    const raiz = resolve(pasta)
    const alvo = resolve(join(raiz, chave))
    if (!alvo.startsWith(raiz + sep)) throw new ErroArmazenamento('Chave de armazenamento inválida')
    return alvo
  }
  // o tipo fica num arquivo ao lado (o disco não guarda metadados)
  const lerTipo = async (alvo: string) => (await fs()).readFile(`${alvo}.tipo`, 'utf8').catch(() => null)
  const etagArquivo = (st: { size: number; mtimeMs: number }) => `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`

  return {
    async guardar(chave, dados, { tipo }) {
      const alvo = await caminho(chave)
      const f = await fs()
      const { dirname } = await import('node:path')
      await f.mkdir(dirname(alvo), { recursive: true })
      const temporario = `${alvo}.${crypto.randomUUID()}.parcial`
      await f.writeFile(temporario, await paraBytes(dados))
      await f.rename(temporario, alvo)
      await f.writeFile(`${alvo}.tipo`, tipo)
    },
    async ler(chave, opcoes) {
      const alvo = await caminho(chave)
      const f = await fs()
      const st = await f.stat(alvo).catch(() => null)
      if (!st?.isFile()) return null
      const tipo = await lerTipo(alvo)
      let intervalo: { inicio: number; fim: number } | undefined
      if (opcoes?.intervalo) {
        const r = resolverIntervalo(opcoes.intervalo, st.size)
        if (!r) throw new ErroIntervalo(st.size)
        intervalo = r
      }
      // só desenvolvimento: lê o trecho pedido para a memória (sem depender de streams do Node no bundle)
      const inicio = intervalo?.inicio ?? 0
      const bytes = new Uint8Array((intervalo?.fim ?? st.size - 1) - inicio + 1)
      const arquivo = await f.open(alvo, 'r')
      try { await arquivo.read(bytes, 0, bytes.byteLength, inicio) } finally { await arquivo.close() }
      return { corpo: streamDe(bytes), tamanho: st.size, tipo, etag: etagArquivo(st), intervalo }
    },
    async info(chave) {
      const alvo = await caminho(chave)
      const st = await (await fs()).stat(alvo).catch(() => null)
      if (!st?.isFile()) return null
      return { tamanho: st.size, tipo: await lerTipo(alvo), etag: etagArquivo(st) }
    },
    async remover(chaves) {
      const f = await fs()
      for (const c of Array.isArray(chaves) ? chaves : [chaves]) {
        const alvo = await caminho(c)
        await f.rm(alvo, { force: true })
        await f.rm(`${alvo}.tipo`, { force: true })
      }
    },
    async listar(prefixo) {
      const f = await fs()
      const { relative, resolve, sep } = await import('node:path')
      const raiz = resolve(pasta)
      const entradas = await f.readdir(raiz, { recursive: true, withFileTypes: true }).catch(() => [])
      return entradas
        .filter((e) => e.isFile() && !e.name.endsWith('.tipo') && !e.name.endsWith('.parcial'))
        .map((e) => relative(raiz, resolve(e.parentPath, e.name)).split(sep).join('/'))
        .filter((k) => k.startsWith(prefixo))
        .sort()
    },
  }
}

// ---------- seleção ----------
let devCache: Armazenamento | null = null

/** Armazenamento de mídias do ambiente atual (R2 no Worker; desenvolvimento fora dele). */
export function armazenamento(): Armazenamento {
  const bucket = obterBucketMidias()
  if (bucket) return armazenamentoR2(bucket)
  if (devCache) return devCache
  if (process.env.ARMAZENAMENTO_DEV === 'memoria') return (devCache = armazenamentoMemoria())
  const pasta = process.env.ARMAZENAMENTO_DEV_DIR
  if (!pasta && process.env.NODE_ENV === 'production') {
    throw new ErroArmazenamento('Armazenamento de mídias não configurado: falta o binding R2 MIDIAS (ou ARMAZENAMENTO_DEV_DIR fora do Worker).')
  }
  return (devCache = armazenamentoDisco(pasta || '.armazenamento-dev'))
}
