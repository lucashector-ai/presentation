/** Arranjos prontos do mapa do modo Explorar (components/editor/MapaExplorar.tsx). */
import type { Cena } from '@/lib/scene/schema'

const ESPACO = 360
export type Arranjo = 'linha' | 'coluna' | 'grade' | 'zigue'

/** Posições de um arranjo pronto (na ordem das telas). */
export function arranjar(cenas: Cena[], tipo: Arranjo): { x: number; y: number }[] {
  const w = Math.max(...cenas.map((c) => c.size.width)) + ESPACO
  const h = Math.max(...cenas.map((c) => c.size.height)) + ESPACO
  const colunas = Math.max(1, Math.ceil(Math.sqrt(cenas.length)))
  return cenas.map((_, i) => {
    if (tipo === 'linha') return { x: i * w, y: 0 }
    if (tipo === 'coluna') return { x: 0, y: i * h }
    if (tipo === 'grade') return { x: (i % colunas) * w, y: Math.floor(i / colunas) * h }
    // zigue-zague: vai para a direita numa linha e volta na de baixo (a câmera faz um "S")
    const linha = Math.floor(i / colunas)
    const col = i % colunas
    return { x: (linha % 2 ? colunas - 1 - col : col) * w, y: linha * h }
  })
}
