/**
 * Máscara com forma (⌃⌘M, como "Use as mask" do Figma). A forma marcada com `isMask` não é desenhada;
 * cada camada com `maskId` recebe uma `mask-image` SVG com a geometria da forma no seu próprio sistema de
 * coordenadas (rotação das duas considerada). Funciona igual no editor, visualizador, miniaturas e exportação.
 */
import type { Camada, CamadaForma } from './schema'
import { caminhoDaForma } from './formas'

const n = (v: number) => String(Math.round(v * 1000) / 1000)

export const ehMascara = (c: Camada | undefined): c is CamadaForma => c?.type === 'shape' && !!c.isMask

/** SVG (markup) da máscara no quadro da camada (0..w, 0..h). null se a forma não serve de máscara. */
export function svgDaMascara(camada: Pick<Camada, 'x' | 'y' | 'width' | 'height' | 'rotation'>, mascara: CamadaForma): string | null {
  const d = caminhoDaForma(mascara)
  if (!d) return null
  const lw = camada.width
  const lh = camada.height
  // centro da máscara no sistema local (sem rotação) da camada
  const vx = mascara.x + mascara.width / 2 - (camada.x + lw / 2)
  const vy = mascara.y + mascara.height / 2 - (camada.y + lh / 2)
  const a = (-(camada.rotation || 0) * Math.PI) / 180
  const cx = vx * Math.cos(a) - vy * Math.sin(a) + lw / 2
  const cy = vx * Math.sin(a) + vy * Math.cos(a) + lh / 2
  const giro = (mascara.rotation || 0) - (camada.rotation || 0)
  const regra = mascara.shape === 'path' && mascara.vetor?.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(lw)}" height="${n(lh)}" viewBox="0 0 ${n(lw)} ${n(lh)}"><path transform="translate(${n(cx)} ${n(cy)}) rotate(${n(giro)}) translate(${n(-mascara.width / 2)} ${n(-mascara.height / 2)})" d="${d}" fill="#000"${regra}/></svg>`
}

/** Estilo CSS (mask-image) da camada recortada; undefined sem máscara válida/visível. */
export function estiloMascara(camada: Camada, mapa: ReadonlyMap<string, Camada>): Record<string, string> | undefined {
  if (!camada.maskId) return undefined
  const m = mapa.get(camada.maskId)
  if (!ehMascara(m) || m.hidden || m.id === camada.id) return undefined
  const svg = svgDaMascara(camada, m)
  if (!svg) return undefined
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return { maskImage: url, WebkitMaskImage: url, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }
}

const serveDeMascara = (c: Camada): c is CamadaForma => c.type === 'shape' && c.shape !== 'line' && c.shape !== 'arrow'

/**
 * Usar como máscara (⌃⌘M): como no Figma, a camada de BAIXO (menor z) da seleção vira a máscara das demais
 * (e dos descendentes delas); se a de baixo não for uma forma, usa a forma mais de cima. Tudo vira um grupo.
 * Devolve null se a seleção não tem forma que sirva de máscara.
 */
export function criarMascara(camadas: readonly Camada[], ids: readonly string[], idsComDescendentes: readonly string[], novoGrupo: string): Camada[] | null {
  const sel = camadas.filter((c) => ids.includes(c.id))
  if (sel.length < 2) return null
  const ordem = [...sel].sort((a, b) => a.z - b.z)
  const base = ordem[0]!
  const topo = serveDeMascara(base) ? base : [...ordem].reverse().find(serveDeMascara)
  if (!topo) return null
  const alvo = new Set(idsComDescendentes.filter((id) => id !== topo.id))
  const grupo = new Set(ids)
  return camadas.map((c) => {
    if (c.id === topo.id) return { ...c, isMask: true, groupId: novoGrupo } as Camada
    if (alvo.has(c.id)) return { ...c, maskId: topo.id, ...(grupo.has(c.id) ? { groupId: novoGrupo } : {}) } as Camada
    return c
  })
}

/** Remover máscara: a forma volta a ser desenhada, as camadas recortadas por ela ficam livres e o grupo se desfaz. */
export function removerMascara(camadas: readonly Camada[], ids: readonly string[]): Camada[] {
  const mascaras = new Set(camadas.filter((c) => ids.includes(c.id) && ehMascara(c)).map((c) => c.id))
  for (const c of camadas) if (ids.includes(c.id) && c.maskId) mascaras.add(c.maskId)
  if (!mascaras.size) return camadas as Camada[]
  const grupos = new Set(camadas.filter((c) => mascaras.has(c.id) && c.groupId).map((c) => c.groupId!))
  return camadas.map((c) => {
    if (mascaras.has(c.id)) { const { isMask: _m, groupId: _g, ...r } = c as CamadaForma; return r as Camada }
    if (c.maskId && mascaras.has(c.maskId)) { const { maskId: _i, ...r } = c; return (grupos.has(r.groupId ?? '') ? { ...r, groupId: undefined } : r) as Camada }
    return c
  })
}
