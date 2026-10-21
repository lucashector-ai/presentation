/**
 * Decodifica a cópia normal do Figma (⌘C) a partir do `text/html` da área de transferência.
 *
 * Formato (verificado com cópias reais do Figma):
 *   <span data-metadata="<!--(figmeta)BASE64(/figmeta)-->">   JSON { fileKey, pasteID, dataType }
 *   <span data-buffer="<!--(figma)BASE64(/figma)-->">         arquivo "fig-kiwi"
 *
 * Arquivo fig-kiwi: 8 bytes de prelúdio ("fig-kiwi"), uint32 LE de versão e depois blocos
 * [uint32 LE tamanho][bytes]. Bloco 0 = schema Kiwi binário (deflate), bloco 1 = mensagem (deflate ou zstd).
 * O schema vem dentro de cada cópia, então a decodificação é guiada por ele (nomes de campos nunca são
 * adivinhados) e tolera campos ausentes/novos. Não usa `compileSchema` (que gera código com `new Function`):
 * um interpretador pequeno lê a mensagem direto do schema, sem depender de eval nem de CSP.
 *
 * Puro (sem DOM): roda no navegador e nos testes.
 */
import { ByteBuffer, decodeBinarySchema, type Definition, type Schema } from 'kiwi-schema'
import { inflateSync, unzlibSync } from 'fflate'
import { decompress as zstd } from 'fzstd'
import type { MensagemFigma } from './tipos'

export interface MetaFigma {
  fileKey?: string
  pasteID?: number
  dataType?: string
}

export interface FigmaDecodificado {
  meta: MetaFigma
  versao: number
  schema: Schema
  mensagem: MensagemFigma
}

const PRELUDIOS = ['fig-kiwi', 'fig-jam.', 'fig-deck']

/** O HTML colado veio do Figma (cópia normal)? */
export function ehHtmlFigma(html: string): boolean {
  return /\(figma\)|\(figmeta\)/.test(html)
}

/** O Chrome (Clipboard API assíncrona) às vezes escapa os comentários dentro dos atributos. */
function desescapar(html: string): string {
  return html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

function base64ParaBytes(b64: string): Uint8Array {
  const limpo = b64.replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(limpo)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Extrai metadados e o buffer binário do HTML do Figma. */
export function extrairBufferFigma(html: string): { meta: MetaFigma; bytes: Uint8Array } | null {
  const h = html.includes('&lt;') ? desescapar(html) : html
  const buf = h.match(/\(figma\)([A-Za-z0-9+/=_\s-]+?)\(\/figma\)/)?.[1]
  if (!buf) return null
  let meta: MetaFigma = {}
  const m = h.match(/\(figmeta\)([A-Za-z0-9+/=_\s-]+?)\(\/figmeta\)/)?.[1]
  if (m) {
    try {
      meta = JSON.parse(new TextDecoder().decode(base64ParaBytes(m))) as MetaFigma
    } catch {
      meta = {}
    }
  }
  return { meta, bytes: base64ParaBytes(buf) }
}

/** Separa o arquivo fig-kiwi em prelúdio, versão e blocos. */
export function lerArquivoKiwi(bytes: Uint8Array): { preludio: string; versao: number; blocos: Uint8Array[] } {
  if (bytes.length < 12) throw new Error('Buffer do Figma curto demais')
  const preludio = String.fromCharCode(...bytes.subarray(0, 8))
  if (!PRELUDIOS.includes(preludio)) throw new Error(`Prelúdio inesperado: ${preludio}`)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const versao = dv.getUint32(8, true)
  const blocos: Uint8Array[] = []
  let o = 12
  while (o + 4 <= bytes.length) {
    const n = dv.getUint32(o, true)
    o += 4
    if (o + n > bytes.length) throw new Error('Bloco do Figma truncado')
    blocos.push(bytes.subarray(o, o + n))
    o += n
  }
  return { preludio, versao, blocos }
}

/** zstd (assinatura 28 B5 2F FD), deflate cru ou zlib. */
export function descomprimir(b: Uint8Array): Uint8Array {
  if (b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd) return zstd(b)
  try {
    return inflateSync(b)
  } catch (e) {
    if (b[0] === 0x78) return unzlibSync(b)
    throw e
  }
}

// ---------- interpretador Kiwi guiado pelo schema ----------

type Leitor = (bb: ByteBuffer) => unknown

export function criarDecodificador(schema: Schema): (dados: Uint8Array, raiz?: string) => unknown {
  const defs = new Map<string, Definition>(schema.definitions.map((d) => [d.name, d]))
  const leitores = new Map<string, Leitor>()

  const primitivo = (tipo: string): Leitor | null => {
    switch (tipo) {
      case 'bool':
        return (bb) => !!bb.readByte()
      case 'byte':
        return (bb) => bb.readByte()
      case 'int':
        return (bb) => bb.readVarInt()
      case 'uint':
        return (bb) => bb.readVarUint()
      case 'float':
        return (bb) => bb.readVarFloat()
      case 'string':
        return (bb) => bb.readString()
      case 'int64':
        return (bb) => bb.readVarInt64()
      case 'uint64':
        return (bb) => bb.readVarUint64()
      default:
        return null
    }
  }

  const leitorDoTipo = (tipo: string): Leitor => {
    const p = primitivo(tipo)
    if (p) return p
    const cache = leitores.get(tipo)
    if (cache) return cache
    const def = defs.get(tipo)
    if (!def) throw new Error(`Tipo desconhecido no schema: ${tipo}`)
    // registra um proxy antes de montar (tipos recursivos, ex.: NodeChange dentro de NodeChange)
    let real: Leitor | null = null
    leitores.set(tipo, (bb) => real!(bb))
    real = montar(def)
    leitores.set(tipo, real)
    return real
  }

  const leitorDoCampo = (tipo: string, ehArray: boolean): Leitor => {
    if (ehArray && tipo === 'byte') return (bb) => bb.readByteArray()
    if (!ehArray) return (bb) => leitorDoTipo(tipo)(bb)
    return (bb) => {
      const n = bb.readVarUint()
      const ler = leitorDoTipo(tipo)
      const arr: unknown[] = new Array(n)
      for (let i = 0; i < n; i++) arr[i] = ler(bb)
      return arr
    }
  }

  const montar = (def: Definition): Leitor => {
    if (def.kind === 'ENUM') {
      const nomes = new Map(def.fields.map((f) => [f.value, f.name]))
      return (bb) => {
        const v = bb.readVarUint()
        return nomes.get(v) ?? v
      }
    }
    const campos = def.fields.map((f) => ({ f, ler: leitorDoCampo(f.type ?? '', f.isArray) }))
    if (def.kind === 'STRUCT') {
      return (bb) => {
        const r: Record<string, unknown> = {}
        for (const { f, ler } of campos) {
          const v = ler(bb)
          if (!f.isDeprecated) r[f.name] = v
        }
        return r
      }
    }
    const porId = new Map(campos.map((c) => [c.f.value, c]))
    return (bb) => {
      const r: Record<string, unknown> = {}
      for (;;) {
        const id = bb.readVarUint()
        if (id === 0) return r
        const c = porId.get(id)
        if (!c) throw new Error(`Campo ${id} inválido em ${def.name}`)
        const v = c.ler(bb)
        if (!c.f.isDeprecated) r[c.f.name] = v
      }
    }
  }

  return (dados, raiz = 'Message') => leitorDoTipo(raiz)(new ByteBuffer(dados))
}

/** Decodifica um arquivo fig-kiwi (o mesmo formato do canvas.fig dentro de um .fig). */
export function decodificarArquivoKiwi(bytes: Uint8Array): { versao: number; schema: Schema; mensagem: MensagemFigma } {
  const { versao, blocos } = lerArquivoKiwi(bytes)
  const [blocoSchema, blocoDados] = blocos
  if (!blocoSchema || !blocoDados) throw new Error('Cópia do Figma sem schema ou sem dados')
  const schema = decodeBinarySchema(descomprimir(blocoSchema))
  const mensagem = criarDecodificador(schema)(descomprimir(blocoDados)) as MensagemFigma
  if (!Array.isArray(mensagem.nodeChanges)) throw new Error('Cópia do Figma sem camadas')
  return { versao, schema, mensagem }
}

/** HTML do Figma → schema + mensagem decodificada. Lança erro se o conteúdo não for decodificável. */
export function decodificarFigma(html: string): FigmaDecodificado {
  const ext = extrairBufferFigma(html)
  if (!ext) throw new Error('HTML sem buffer do Figma')
  return { meta: ext.meta, ...decodificarArquivoKiwi(ext.bytes) }
}
