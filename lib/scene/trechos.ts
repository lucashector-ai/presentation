/**
 * Estilo em parte do texto (rich text): trechos com cor, peso, fonte, itálico e sublinhado próprios, por posição
 * de caractere em `text`. Os trechos ficam ordenados, sem sobreposição e sem trecho vazio; o resto do texto usa o
 * estilo da camada.
 */
import type { CSSProperties } from 'react'
import type { CamadaTexto, Trecho } from './schema'

export type EstiloTrecho = Omit<Trecho, 'inicio' | 'fim'>
export const PROPS_TRECHO = ['color', 'fontWeight', 'fontFamily', 'italic', 'underline'] as const

const temEstilo = (t: EstiloTrecho) => PROPS_TRECHO.some((k) => t[k] !== undefined)
const mesmoEstilo = (a: EstiloTrecho, b: EstiloTrecho) => PROPS_TRECHO.every((k) => a[k] === b[k])
const estiloDe = (t: Trecho): EstiloTrecho => { const { inicio: _i, fim: _f, ...e } = t; return e }

/** Junta vizinhos iguais, tira vazios e sem estilo. */
export function normalizarTrechos(ts: Trecho[], tamanho: number): Trecho[] {
  const out: Trecho[] = []
  for (const t of [...ts].sort((a, b) => a.inicio - b.inicio)) {
    const inicio = Math.max(0, Math.min(tamanho, t.inicio))
    const fim = Math.max(inicio, Math.min(tamanho, t.fim))
    if (fim <= inicio || !temEstilo(t)) continue
    const ult = out[out.length - 1]
    if (ult && ult.fim === inicio && mesmoEstilo(estiloDe(ult), estiloDe(t))) ult.fim = fim
    else out.push({ ...t, inicio, fim })
  }
  return out
}

/** Aplica um estilo em [inicio, fim): divide os trechos nas bordas e mescla o estilo novo (undefined apaga a prop). */
export function aplicarTrecho(ts: Trecho[] | undefined, inicio: number, fim: number, estilo: Partial<EstiloTrecho>, tamanho: number): Trecho[] {
  if (fim <= inicio) return normalizarTrechos(ts ?? [], tamanho)
  // cortes: bordas da seleção e de todos os trechos
  const cortes = [...new Set([0, tamanho, inicio, fim, ...(ts ?? []).flatMap((t) => [t.inicio, t.fim])])].filter((v) => v >= 0 && v <= tamanho).sort((a, b) => a - b)
  const pedacos: Trecho[] = []
  for (let k = 0; k < cortes.length - 1; k++) {
    const a = cortes[k]!, b = cortes[k + 1]!
    const base = (ts ?? []).find((t) => t.inicio <= a && t.fim >= b)
    let e: EstiloTrecho = base ? estiloDe(base) : {}
    if (a >= inicio && b <= fim) {
      e = { ...e, ...estilo }
      for (const p of PROPS_TRECHO) if (e[p] === undefined) delete e[p]
    }
    pedacos.push({ inicio: a, fim: b, ...e })
  }
  return normalizarTrechos(pedacos, tamanho)
}

/** Remove o estilo próprio de [inicio, fim) (volta ao estilo da camada). */
export function limparTrecho(ts: Trecho[] | undefined, inicio: number, fim: number, tamanho: number): Trecho[] {
  return aplicarTrecho(ts, inicio, fim, { color: undefined, fontWeight: undefined, fontFamily: undefined, italic: undefined, underline: undefined }, tamanho)
}

/** Texto editado: os trechos acompanham (o que vem depois da mudança anda; o que foi apagado some). */
export function ajustarTrechos(ts: Trecho[] | undefined, antes: string, depois: string): Trecho[] | undefined {
  if (!ts?.length || antes === depois) return ts
  let p = 0
  while (p < antes.length && p < depois.length && antes[p] === depois[p]) p++
  let s = 0
  while (s < antes.length - p && s < depois.length - p && antes[antes.length - 1 - s] === depois[depois.length - 1 - s]) s++
  const fimAntes = antes.length - s // a região trocada era [p, fimAntes) e virou [p, depois.length - s)
  const delta = depois.length - antes.length
  const mover = (v: number, ehFim: boolean) => (v < p ? v : v >= fimAntes ? v + delta : ehFim ? Math.max(p, depois.length - s) : p)
  return normalizarTrechos(ts.map((t) => ({ ...t, inicio: mover(t.inicio, false), fim: mover(t.fim, true) })), depois.length)
}

/** Pedaços de [inicio, fim) do texto com o estilo de cada um (o que não tem trecho vem com estilo vazio). */
export function segmentar(texto: string, ts: Trecho[] | undefined, inicio = 0, fim = texto.length): { texto: string; estilo: EstiloTrecho }[] {
  const out: { texto: string; estilo: EstiloTrecho }[] = []
  let cursor = inicio
  for (const t of ts ?? []) {
    if (t.fim <= inicio || t.inicio >= fim) continue
    const a = Math.max(inicio, t.inicio), b = Math.min(fim, t.fim)
    if (a > cursor) out.push({ texto: texto.slice(cursor, a), estilo: {} })
    out.push({ texto: texto.slice(a, b), estilo: estiloDe(t) })
    cursor = b
  }
  if (cursor < fim) out.push({ texto: texto.slice(cursor, fim), estilo: {} })
  return out
}

/** CSS de um pedaço (a família vai pela pilha de fontes do renderizador). */
export function cssTrecho(e: EstiloTrecho, pilha: (f: string) => string): CSSProperties {
  return {
    ...(e.color ? { color: e.color } : {}),
    ...(e.fontWeight ? { fontWeight: e.fontWeight } : {}),
    ...(e.fontFamily ? { fontFamily: pilha(e.fontFamily) } : {}),
    ...(e.italic !== undefined ? { fontStyle: e.italic ? 'italic' : 'normal' } : {}),
    ...(e.underline !== undefined ? { textDecorationLine: e.underline ? 'underline' : 'none' } : {}),
  }
}

/** Valor de uma prop em todo o intervalo (undefined = misto ou igual ao da camada em parte). */
export function valorNoIntervalo<K extends (typeof PROPS_TRECHO)[number]>(c: CamadaTexto, inicio: number, fim: number, prop: K): CamadaTexto[K] | undefined {
  const vals = new Set(segmentar(c.text, c.trechos, inicio, fim).map((p) => p.estilo[prop] ?? c[prop]))
  return vals.size === 1 ? ([...vals][0] as CamadaTexto[K]) : undefined
}
