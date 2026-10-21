/**
 * Leitura do corpo de um upload (arquivo enviado direto para a rota do app) com limite de tamanho, e
 * validação do conteúdo dos formatos de texto. Sem dependência de Node: roda no Worker e nos testes.
 */
import { ehSvg, sanitizarSvg, type Purificador } from '@/lib/importar/svg'
import { ehLottie, gltfAutocontido } from '@/lib/importar/arquivos'

export class ErroCorpo extends Error {}

/** Lê o stream inteiro; passa de `max` bytes → ErroCorpo (sem continuar lendo). */
export async function lerTudo(corpo: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const leitor = corpo.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await leitor.cancel().catch(() => {})
      throw new ErroCorpo('Arquivo maior que o declarado')
    }
    partes.push(value)
  }
  return juntar(partes, total)
}

function juntar(partes: Uint8Array[], total: number): Uint8Array {
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { saida.set(p, pos); pos += p.byteLength }
  return saida
}

/**
 * Separa os primeiros `n` bytes (para conferir o MIME real) e devolve um stream com o arquivo INTEIRO que
 * falha se o total não for exatamente `esperado` bytes. Assim o arquivo vai para o R2 sem ficar todo na memória.
 */
export async function separarCabeca(corpo: ReadableStream<Uint8Array>, n: number, esperado: number): Promise<{ cabeca: Uint8Array; corpo: ReadableStream<Uint8Array> }> {
  const leitor = corpo.getReader()
  const partes: Uint8Array[] = []
  let lidos = 0
  let fim = false
  while (lidos < n) {
    const { done, value } = await leitor.read()
    if (done) { fim = true; break }
    partes.push(value)
    lidos += value.byteLength
  }
  const inicio = juntar(partes, lidos)
  if (lidos > esperado) {
    await leitor.cancel().catch(() => {})
    throw new ErroCorpo('Arquivo maior que o declarado')
  }
  let total = lidos
  let entregouInicio = false
  const stream = new ReadableStream<Uint8Array>({
    async pull(c) {
      if (!entregouInicio) {
        entregouInicio = true
        if (inicio.byteLength) { c.enqueue(inicio); return }
      }
      if (fim) {
        if (total !== esperado) c.error(new ErroCorpo('Tamanho do arquivo não corresponde ao declarado'))
        else c.close()
        return
      }
      const { done, value } = await leitor.read()
      if (done) {
        fim = true
        if (total !== esperado) c.error(new ErroCorpo('Tamanho do arquivo não corresponde ao declarado'))
        else c.close()
        return
      }
      total += value.byteLength
      if (total > esperado) {
        await leitor.cancel().catch(() => {})
        c.error(new ErroCorpo('Arquivo maior que o declarado'))
        return
      }
      c.enqueue(value)
    },
    cancel(motivo) { return leitor.cancel(motivo) },
  })
  return { cabeca: inicio.slice(0, n), corpo: stream }
}

/**
 * Formatos de texto não têm bytes mágicos: o conteúdo inteiro é conferido. SVG volta SANITIZADO (é o que
 * vai para o armazenamento: o bucket nunca guarda SVG com script); glTF precisa ser autocontido; JSON precisa ser Lottie.
 */
export function validarTexto(mime: string, texto: string, purificador: Purificador): { ok: true; conteudo: string } | { ok: false; motivo: string } {
  if (mime === 'image/svg+xml') {
    if (!ehSvg(texto)) return { ok: false, motivo: 'O arquivo não é um SVG válido' }
    const limpo = sanitizarSvg(texto, purificador)
    if (!ehSvg(limpo)) return { ok: false, motivo: 'O SVG ficou vazio depois da limpeza de segurança' }
    return { ok: true, conteudo: limpo }
  }
  let json: unknown
  try { json = JSON.parse(texto) } catch { return { ok: false, motivo: 'JSON inválido' } }
  if (mime === 'model/gltf+json' && !gltfAutocontido(json)) return { ok: false, motivo: 'O glTF precisa ser autocontido (texturas embutidas). Exporte como .glb no Blender.' }
  if (mime === 'application/json' && !ehLottie(json)) return { ok: false, motivo: 'O JSON não é uma animação Lottie' }
  return { ok: true, conteudo: texto }
}
