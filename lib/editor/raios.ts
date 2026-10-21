/**
 * Raio dos cantos (lógica pura do inspetor): raio único ou cantos independentes
 * [sup. esquerdo, sup. direito, inf. direito, inf. esquerdo]. `radius` sempre guarda o maior canto, para que
 * renderizadores antigos (e a detecção de fundo do visualizador) continuem coerentes.
 */
import type { Camada, Raios } from '@/lib/scene/schema'

export const NOMES_CANTOS = ['Canto superior esquerdo', 'Canto superior direito', 'Canto inferior direito', 'Canto inferior esquerdo'] as const

type ComRaio = Camada & { radius?: number; radii?: Raios }

/** Camadas que aceitam cantos independentes. */
export function aceitaCantos(c: Camada): boolean {
  return c.type === 'shape' || c.type === 'frame' || c.type === 'image' || c.type === 'video' || c.type === 'text' || c.type === 'embed' || c.type === 'lottie' || c.type === 'model3d'
}

/** Camadas com suavização de cantos (squircle) desenhada: retângulos, frames e imagens. */
export function aceitaSuavizacao(c: Camada): boolean {
  return (c.type === 'shape' && c.shape === 'rect') || c.type === 'frame' || c.type === 'image'
}

export function raiosDe(c: Camada): Raios {
  const l = c as ComRaio
  if (l.radii) return [...l.radii] as Raios
  const r = l.radius ?? 0
  return [r, r, r, r]
}

/** Raio único (desfaz os cantos independentes). */
export function comRaio(c: Camada, r: number): Camada {
  if (!('radius' in c)) return c
  const v = Math.max(0, Math.min(999, r))
  return { ...c, radius: v, ...(aceitaCantos(c) ? { radii: undefined } : {}) } as Camada
}

/** Muda um canto; se os quatro ficarem iguais, volta a ser um raio único. */
export function comCanto(c: Camada, indice: number, r: number): Camada {
  if (!aceitaCantos(c)) return comRaio(c, r)
  const raios = raiosDe(c)
  raios[indice] = Math.max(0, Math.min(999, r))
  if (raios.every((x) => x === raios[0])) return comRaio(c, raios[0])
  return { ...c, radius: Math.max(...raios), radii: raios } as Camada
}

/** Raio exibido no campo único: o valor comum ou null quando os cantos diferem ("Misto"). */
export function raioUnico(c: Camada): number | null {
  const r = raiosDe(c)
  return r.every((x) => x === r[0]) ? r[0] : null
}
