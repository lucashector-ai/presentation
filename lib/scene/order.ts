/**
 * Normalização de ordem de cenas e de profundidade (z) de camadas.
 * Operações puras, usadas pelo editor e pelo backend (reordenação transacional).
 */
import type { Camada, Cena } from './schema'

export function moverItem<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de < 0 || de >= lista.length) return [...lista]
  const destino = Math.max(0, Math.min(lista.length - 1, para))
  const copia = [...lista]
  const [item] = copia.splice(de, 1)
  copia.splice(destino, 0, item as T)
  return copia
}

export function moverCena(cenas: readonly Cena[], de: number, para: number): Cena[] {
  return moverItem(cenas, de, para)
}

/** Garante z contínuo (0..n-1) preservando a ordem relativa atual. */
export function normalizarZ(camadas: readonly Camada[]): Camada[] {
  return [...camadas]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.z - b.c.z || a.i - b.i)
    .map(({ c }, z) => (c.z === z ? c : { ...c, z }))
}

export function trazerParaFrente(camadas: readonly Camada[], id: string): Camada[] {
  const max = Math.max(-1, ...camadas.map((c) => c.z))
  return normalizarZ(camadas.map((c) => (c.id === id ? { ...c, z: max + 1 } : c)))
}

export function enviarParaTras(camadas: readonly Camada[], id: string): Camada[] {
  const min = Math.min(0, ...camadas.map((c) => c.z))
  return normalizarZ(camadas.map((c) => (c.id === id ? { ...c, z: min - 1 } : c)))
}

export function avancarUm(camadas: readonly Camada[], id: string): Camada[] {
  const ordenadas = normalizarZ(camadas)
  const i = ordenadas.findIndex((c) => c.id === id)
  if (i < 0 || i === ordenadas.length - 1) return ordenadas
  return normalizarZ(moverItem(ordenadas, i, i + 1).map((c, z) => ({ ...c, z })))
}

export function recuarUm(camadas: readonly Camada[], id: string): Camada[] {
  const ordenadas = normalizarZ(camadas)
  const i = ordenadas.findIndex((c) => c.id === id)
  if (i <= 0) return ordenadas
  return normalizarZ(moverItem(ordenadas, i, i - 1).map((c, z) => ({ ...c, z })))
}

/** Ordena para renderização (menor z primeiro). */
export function ordenarParaRender(camadas: readonly Camada[]): Camada[] {
  return [...camadas].sort((a, b) => a.z - b.z)
}

/** Gera ID curto, único dentro de uma lista. Não é credencial: só precisa ser único no projeto. */
export function novoId(prefixo: string, existentes: Iterable<{ id: string }>): string {
  const usados = new Set(Array.from(existentes, (e) => e.id))
  for (let tentativa = 0; tentativa < 1000; tentativa++) {
    const id = `${prefixo}-${Math.random().toString(36).slice(2, 8)}`
    if (!usados.has(id)) return id
  }
  return `${prefixo}-${Date.now().toString(36)}`
}
