/**
 * Guias inteligentes (smart guides) e distribuição. Puro e testável.
 * Ao mover uma caixa, procura bordas/centros alinháveis nas outras camadas e na tela,
 * devolve o deslocamento ajustado e as linhas a desenhar.
 */
import type { Retangulo, Tamanho } from '@/lib/scene/transform'

export interface Guia {
  /** 'v' = linha vertical em x; 'h' = linha horizontal em y. */
  eixo: 'v' | 'h'
  pos: number
  /** extensão da linha (de/até no outro eixo) */
  de: number
  ate: number
}

export interface ResultadoEncaixe {
  x: number
  y: number
  guias: Guia[]
}

const pontosX = (r: Retangulo) => [r.x, r.x + r.width / 2, r.x + r.width]
const pontosY = (r: Retangulo) => [r.y, r.y + r.height / 2, r.y + r.height]

/**
 * @param movendo caixa na posição proposta
 * @param outros caixas de referência (outras camadas)
 * @param cena tamanho da tela (bordas e centro também são alvos)
 * @param limiar distância máxima de encaixe (em px da cena)
 */
export function encaixar(movendo: Retangulo, outros: Retangulo[], cena: Tamanho, limiar: number): ResultadoEncaixe {
  const alvosX: { v: number; ref: Retangulo }[] = []
  const alvosY: { v: number; ref: Retangulo }[] = []
  const telaRef = { x: 0, y: 0, width: cena.width, height: cena.height }
  for (const v of pontosX(telaRef)) alvosX.push({ v, ref: telaRef })
  for (const v of pontosY(telaRef)) alvosY.push({ v, ref: telaRef })
  for (const o of outros) {
    for (const v of pontosX(o)) alvosX.push({ v, ref: o })
    for (const v of pontosY(o)) alvosY.push({ v, ref: o })
  }

  let melhorX: { d: number; ajuste: number; alvo: number } | null = null
  for (const p of pontosX(movendo)) {
    for (const a of alvosX) {
      const d = Math.abs(a.v - p)
      if (d <= limiar && (!melhorX || d < melhorX.d)) melhorX = { d, ajuste: a.v - p, alvo: a.v }
    }
  }
  let melhorY: { d: number; ajuste: number; alvo: number } | null = null
  for (const p of pontosY(movendo)) {
    for (const a of alvosY) {
      const d = Math.abs(a.v - p)
      if (d <= limiar && (!melhorY || d < melhorY.d)) melhorY = { d, ajuste: a.v - p, alvo: a.v }
    }
  }

  const x = movendo.x + (melhorX?.ajuste ?? 0)
  const y = movendo.y + (melhorY?.ajuste ?? 0)
  const final = { ...movendo, x, y }
  const guias: Guia[] = []
  if (melhorX) {
    const refs = [telaRef, ...outros].filter((r) => pontosX(r).some((v) => Math.abs(v - melhorX!.alvo) < 0.5))
    const ys = [final.y, final.y + final.height, ...refs.flatMap((r) => (r === telaRef ? [] : [r.y, r.y + r.height]))]
    const ehTela = refs.length === 1 && refs[0] === telaRef
    guias.push({ eixo: 'v', pos: melhorX.alvo, de: ehTela ? 0 : Math.min(...ys), ate: ehTela ? cena.height : Math.max(...ys) })
  }
  if (melhorY) {
    const refs = [telaRef, ...outros].filter((r) => pontosY(r).some((v) => Math.abs(v - melhorY!.alvo) < 0.5))
    const xs = [final.x, final.x + final.width, ...refs.flatMap((r) => (r === telaRef ? [] : [r.x, r.x + r.width]))]
    const ehTela = refs.length === 1 && refs[0] === telaRef
    guias.push({ eixo: 'h', pos: melhorY.alvo, de: ehTela ? 0 : Math.min(...xs), ate: ehTela ? cena.width : Math.max(...xs) })
  }
  return { x, y, guias }
}

/** Distribui caixas com espaçamento igual no eixo (precisa de 3+). Mantém as extremidades. */
export function distribuir<T extends Retangulo & { id: string }>(caixas: T[], eixo: 'h' | 'v'): T[] {
  if (caixas.length < 3) return caixas
  const ord = [...caixas].sort((a, b) => (eixo === 'h' ? a.x - b.x : a.y - b.y))
  const primeiro = ord[0]!
  const ultimo = ord[ord.length - 1]!
  const inicio = eixo === 'h' ? primeiro.x : primeiro.y
  const fim = eixo === 'h' ? ultimo.x + ultimo.width : ultimo.y + ultimo.height
  const ocupado = ord.reduce((s, c) => s + (eixo === 'h' ? c.width : c.height), 0)
  const espaco = (fim - inicio - ocupado) / (ord.length - 1)
  let cursor = inicio
  const pos = new Map<string, number>()
  for (const c of ord) {
    pos.set(c.id, cursor)
    cursor += (eixo === 'h' ? c.width : c.height) + espaco
  }
  return caixas.map((c) => (eixo === 'h' ? { ...c, x: pos.get(c.id)! } : { ...c, y: pos.get(c.id)! }))
}

/** Retângulos que intersectam a seleção por área (marquee). */
export function intersecta(a: Retangulo, b: Retangulo): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

/** Ângulo (graus) do centro ao ponteiro, com encaixe opcional a cada 15°. */
export function anguloRotacao(centro: { x: number; y: number }, ponteiro: { x: number; y: number }, encaixe15: boolean): number {
  const a = (Math.atan2(ponteiro.y - centro.y, ponteiro.x - centro.x) * 180) / Math.PI + 90
  let n = ((a + 540) % 360) - 180
  if (encaixe15) n = Math.round(n / 15) * 15
  return Math.round(n * 10) / 10
}
