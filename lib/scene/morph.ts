/**
 * Mesmo objeto entre telas (Magic Move / Smart Animate). Uma camada da tela que entra é "o mesmo objeto" de uma
 * camada da tela que sai quando:
 *  1. tem o mesmo ID (foi copiada, colada ou a tela foi duplicada: o ID viaja junto), ou
 *  2. tem o mesmo nome, e esse nome é único nas duas telas (renomear liga objetos criados separadamente).
 * `morph: false` na camada (em qualquer das duas telas) desliga o par: o objeto aparece sem movimento.
 * A transição "Automática" (padrão das telas novas) vira morph quando algum par mudou de lugar, tamanho,
 * rotação, opacidade ou cor; sem nada para mover, é um fade.
 */
import type { Camada, Cena, DocumentoProjeto, Transicao } from './schema'

const nomeDe = (c: Camada) => c.name?.trim().toLowerCase() || ''
const anima = (c: Camada) => c.morph !== false

/** Pares: id da camada na tela que entra → camada correspondente na tela que sai. */
export function pareamentoMorph(origem: Cena | undefined, destino: Cena): Map<string, Camada> {
  const pares = new Map<string, Camada>()
  if (!origem) return pares
  const porId = new Map(origem.layers.map((l) => [l.id, l]))
  const usados = new Set<string>()
  for (const c of destino.layers) {
    const o = porId.get(c.id)
    if (o && anima(o) && anima(c)) { pares.set(c.id, o); usados.add(o.id) }
  }
  // por nome: só nomes únicos nas duas telas (dois "Retângulo" não viram par por acaso)
  const contar = (ls: Camada[]) => { const m = new Map<string, number>(); for (const l of ls) { const n = nomeDe(l); if (n) m.set(n, (m.get(n) ?? 0) + 1) } return m }
  const nOrigem = contar(origem.layers)
  const nDestino = contar(destino.layers)
  const origemPorNome = new Map(origem.layers.filter((l) => nomeDe(l) && !usados.has(l.id)).map((l) => [nomeDe(l), l]))
  for (const c of destino.layers) {
    const n = nomeDe(c)
    if (!n || pares.has(c.id) || nOrigem.get(n) !== 1 || nDestino.get(n) !== 1) continue
    const o = origemPorNome.get(n)
    if (o && anima(o) && anima(c)) pares.set(c.id, o)
  }
  return pares
}

const corDe = (c: Camada): string | undefined => ('fill' in c && typeof c.fill === 'string' ? c.fill : 'color' in c && typeof c.color === 'string' ? c.color : undefined)

/** Algum objeto em comum mudou entre as duas telas? */
export function temMovimento(origem: Cena | undefined, destino: Cena): boolean {
  for (const [id, o] of pareamentoMorph(origem, destino)) {
    const c = destino.layers.find((l) => l.id === id)!
    if (Math.abs(c.x - o.x) > 0.5 || Math.abs(c.y - o.y) > 0.5 || Math.abs(c.width - o.width) > 0.5 || Math.abs(c.height - o.height) > 0.5) return true
    if ((c.rotation ?? 0) !== (o.rotation ?? 0) || (c.opacity ?? 1) !== (o.opacity ?? 1) || corDe(c) !== corDe(o)) return true
  }
  return false
}

export const TRANSICAO_PADRAO: Transicao = { type: 'auto', duration: 600, easing: 'easeInOut' }

/** "Automática" (ou sem transição definida) vira morph quando há o que mover, senão fade. As outras ficam como estão. */
export function resolverTransicao(origem: Cena | undefined, destino: Cena, t: Transicao | undefined | null): Transicao {
  const base = t ?? TRANSICAO_PADRAO
  if (base.type !== 'auto') return base
  return temMovimento(origem, destino) ? { ...base, type: 'morph' } : { ...base, type: 'fade', duration: Math.min(base.duration, 400) }
}

/** Outras telas em que este objeto aparece (mesmo ID, ou mesmo nome único), na ordem da apresentação. */
export function telasComObjeto(doc: DocumentoProjeto, cenaId: string, camada: Camada): Cena[] {
  const n = nomeDe(camada)
  return doc.scenes.filter((s) => s.id !== cenaId && s.layers.some((l) => l.id === camada.id || (!!n && nomeDe(l) === n && s.layers.filter((x) => nomeDe(x) === n).length === 1)))
}
