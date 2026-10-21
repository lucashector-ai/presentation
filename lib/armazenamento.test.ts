import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { armazenamentoDisco, armazenamentoMemoria, armazenamentoR2, chaveOriginal, ErroArmazenamento, ErroIntervalo, resolverIntervalo, type Armazenamento, type BucketR2, type ObjetoR2 } from './armazenamento'

const texto = async (s: ReadableStream<Uint8Array>) => new TextDecoder().decode(await new Response(s).arrayBuffer())
const streamDe = (s: string) => new Response(s).body as ReadableStream<Uint8Array>

/** Bucket R2 falso, com a mesma forma do binding do Workers (head/get com range/put/delete/list paginado). */
function bucketFalso(): BucketR2 & { dados: Map<string, { bytes: Uint8Array; tipo?: string }> } {
  const dados = new Map<string, { bytes: Uint8Array; tipo?: string }>()
  const meta = (key: string, o: { bytes: Uint8Array; tipo?: string }): ObjetoR2 => ({ key, size: o.bytes.byteLength, etag: 'e', httpEtag: `"${key.length}-${o.bytes.byteLength}"`, uploaded: new Date(0), httpMetadata: { contentType: o.tipo } })
  return {
    dados,
    async head(key) { const o = dados.get(key); return o ? meta(key, o) : null },
    async get(key, opcoes) {
      const o = dados.get(key)
      if (!o) return null
      const r = opcoes?.range
      const bytes = r ? o.bytes.slice(r.offset, r.length != null ? r.offset + r.length : undefined) : o.bytes
      return { ...meta(key, o), body: new Response(bytes.slice()).body as ReadableStream }
    },
    async put(key, value, opcoes) {
      const bytes = value instanceof ReadableStream ? new Uint8Array(await new Response(value).arrayBuffer()) : typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array((value as Uint8Array).buffer)
      dados.set(key, { bytes, tipo: opcoes?.httpMetadata?.contentType })
    },
    async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) dados.delete(k) },
    async list(opcoes) {
      const todas = [...dados.keys()].filter((k) => k.startsWith(opcoes?.prefix ?? '')).sort()
      const inicio = Number(opcoes?.cursor ?? 0)
      const pagina = todas.slice(inicio, inicio + 2) // página pequena para exercitar o cursor
      const fim = inicio + 2 >= todas.length
      return { objects: pagina.map((k) => meta(k, dados.get(k)!)), truncated: !fim, cursor: fim ? undefined : String(inicio + 2) }
    },
  }
}

let pastaDisco = ''
afterAll(async () => { if (pastaDisco) await rm(pastaDisco, { recursive: true, force: true }) })

const backends: [string, () => Promise<Armazenamento>][] = [
  ['memória', async () => armazenamentoMemoria()],
  ['disco', async () => armazenamentoDisco((pastaDisco = await mkdtemp(path.join(tmpdir(), 'mostra-arm-'))))],
  ['R2 (binding falso)', async () => armazenamentoR2(bucketFalso())],
]

describe.each(backends)('armazenamento: %s', (_nome, criar) => {
  it('guarda, lê, informa, lista e remove', async () => {
    const arm = await criar()
    const ws = '11111111-1111-4111-8111-111111111111'
    const chave = chaveOriginal(ws, 'a1', 'png')
    expect(chave).toBe(`${ws}/a1/original.png`)
    await arm.guardar(chave, 'conteúdo', { tipo: 'image/png' })
    await arm.guardar(`${ws}/a2/original.svg`, streamDe('<svg/>'), { tipo: 'image/svg+xml', tamanho: 6 })
    await arm.guardar('outro-ws/a3/original.png', new Uint8Array([1, 2, 3]), { tipo: 'image/png' })

    const lido = await arm.ler(chave)
    expect(lido).not.toBeNull()
    expect(lido!.tipo).toBe('image/png')
    expect(lido!.tamanho).toBe(new TextEncoder().encode('conteúdo').byteLength)
    expect(await texto(lido!.corpo)).toBe('conteúdo')
    expect(await texto((await arm.ler(`${ws}/a2/original.svg`))!.corpo)).toBe('<svg/>')

    const info = await arm.info(chave)
    expect(info?.tamanho).toBe(lido!.tamanho)
    expect(info?.etag).toBeTruthy()
    expect(await arm.info(`${ws}/nao-existe`)).toBeNull()
    expect(await arm.ler(`${ws}/nao-existe`)).toBeNull()

    // listar respeita o prefixo do workspace (e pagina no R2)
    expect(await arm.listar(`${ws}/`)).toEqual([`${ws}/a1/original.png`, `${ws}/a2/original.svg`])

    await arm.remover([chave, `${ws}/a2/original.svg`])
    expect(await arm.info(chave)).toBeNull()
    expect(await arm.listar(`${ws}/`)).toEqual([])
    expect(await arm.listar('outro-ws/')).toEqual(['outro-ws/a3/original.png'])
  })

  it('lê intervalos (Range) e recusa intervalo fora do arquivo', async () => {
    const arm = await criar()
    await arm.guardar('w/v/original.mp4', '0123456789', { tipo: 'video/mp4' })
    const parte = await arm.ler('w/v/original.mp4', { intervalo: { inicio: 2, fim: 5 } })
    expect(parte!.intervalo).toEqual({ inicio: 2, fim: 5 })
    expect(parte!.tamanho).toBe(10)
    expect(await texto(parte!.corpo)).toBe('2345')
    const ate = await arm.ler('w/v/original.mp4', { intervalo: { inicio: 7 } })
    expect(await texto(ate!.corpo)).toBe('789')
    await expect(arm.ler('w/v/original.mp4', { intervalo: { inicio: 50 } })).rejects.toBeInstanceOf(ErroIntervalo)
  })

  it('recusa chaves que escapam da pasta', async () => {
    const arm = await criar()
    for (const ruim of ['../etc/passwd', '/abs/x', 'a//b', 'a/./b', 'a\\b', '']) {
      await expect(arm.guardar(ruim, 'x', { tipo: 'text/plain' })).rejects.toBeInstanceOf(ErroArmazenamento)
    }
  })
})

describe('resolverIntervalo', () => {
  it('limita o fim ao tamanho e rejeita início além do fim', () => {
    expect(resolverIntervalo({ inicio: 0 }, 10)).toEqual({ inicio: 0, fim: 9 })
    expect(resolverIntervalo({ inicio: 3, fim: 99 }, 10)).toEqual({ inicio: 3, fim: 9 })
    expect(resolverIntervalo({ inicio: 10 }, 10)).toBeNull()
    expect(resolverIntervalo({ inicio: 0 }, 0)).toBeNull()
  })
})
