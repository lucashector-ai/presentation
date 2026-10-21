/**
 * Restrições (constraints do Figma), puras: como uma camada acompanha o pai — frame sem auto layout ou a
 * própria tela — quando ele muda de tamanho. Usadas ao redimensionar frames e em "Converter formato".
 *
 * Horizontal: esquerda (padrão) · direita · esquerda e direita (estica) · centro · escala.
 * Vertical:   topo (padrão) · base · topo e base · centro · escala.
 */
import type { Camada, Restricoes, Tamanho } from './schema'
import type { Retangulo } from './transform'
import { descendentes, mapaDe, paiDe, temAutoLayout } from './arvore'

export const RESTRICAO_PADRAO: Restricoes = { h: 'left', v: 'top' }

type Eixo = 'left' | 'right' | 'leftRight' | 'center' | 'scale'
function eixo(modo: Eixo, p0: number, t: number, P0: number, PT: number, Q0: number, QT: number): [number, number] {
  switch (modo) {
    case 'right': return [Q0 + QT - (P0 + PT - (p0 + t)) - t, t]
    case 'leftRight': { const ini = p0 - P0; const fim = P0 + PT - (p0 + t); return [Q0 + ini, Math.max(1, QT - ini - fim)] }
    case 'center': { const c = p0 + t / 2 - (P0 + PT / 2); return [Q0 + QT / 2 + c - t / 2, t] }
    case 'scale': { const s = PT > 0 ? QT / PT : 1; return [Q0 + (p0 - P0) * s, Math.max(1, t * s)] }
    default: return [Q0 + (p0 - P0), t]
  }
}

const H_PARA_EIXO: Record<Restricoes['h'], Eixo> = { left: 'left', right: 'right', leftRight: 'leftRight', center: 'center', scale: 'scale' }
const V_PARA_EIXO: Record<Restricoes['v'], Eixo> = { top: 'left', bottom: 'right', topBottom: 'leftRight', center: 'center', scale: 'scale' }

/** Nova caixa do filho quando o pai vai de `antes` para `depois`. */
export function aplicarRestricao(filho: Retangulo, antes: Retangulo, depois: Retangulo, r: Restricoes = RESTRICAO_PADRAO): Retangulo {
  const [x, width] = eixo(H_PARA_EIXO[r.h], filho.x, filho.width, antes.x, antes.width, depois.x, depois.width)
  const [y, height] = eixo(V_PARA_EIXO[r.v], filho.y, filho.height, antes.y, antes.height, depois.y, depois.height)
  return { x, y, width, height }
}

const arred = (r: Retangulo): Retangulo => {
  const x = Math.round(r.x)
  const y = Math.round(r.y)
  return { x, y, width: Math.max(1, Math.round(r.x + r.width) - x), height: Math.max(1, Math.round(r.y + r.height) - y) }
}

/**
 * Propaga as restrições dos filhos de frames livres (sem auto layout) que mudaram de tamanho, de fora para
 * dentro. `antes` = camadas antes da edição; só filhos que o usuário não editou junto são reposicionados.
 */
export function propagarRestricoes(antes: readonly Camada[], depois: Camada[]): Camada[] {
  const mapaAntes = mapaDe(antes)
  let lista = depois
  let mapa = mapaDe(lista)
  const frames = lista.filter((f) => f.type === 'frame' && !temAutoLayout(f))
  // de fora para dentro (profundidade crescente)
  const prof = (c: Camada) => { let d = 0; let p = paiDe(c, mapa); while (p && d < 50) { d++; p = paiDe(p, mapa) } return d }
  frames.sort((a, b) => prof(a) - prof(b))
  let mudou = false
  for (const f0 of frames) {
    const f = mapa.get(f0.id)!
    const fa = mapaAntes.get(f.id)
    if (!fa || (fa.width === f.width && fa.height === f.height)) continue
    for (const filho of lista.filter((c) => c.parentId === f.id)) {
      if (!filho.constraints || (filho.constraints.h === 'left' && filho.constraints.v === 'top')) continue
      const ca = mapaAntes.get(filho.id)
      if (!ca) continue
      // o usuário redimensionou o filho junto (seleção múltipla): respeita
      if (ca.width !== filho.width || ca.height !== filho.height) continue
      const nova = arred(aplicarRestricao(ca, fa, f, filho.constraints))
      if (nova.x === filho.x && nova.y === filho.y && nova.width === filho.width && nova.height === filho.height) continue
      const dx = nova.x - filho.x
      const dy = nova.y - filho.y
      const desc = new Set(filho.type === 'frame' ? descendentes(filho.id, lista).map((d) => d.id) : [])
      lista = lista.map((c) => (c.id === filho.id ? ({ ...c, ...nova } as Camada) : desc.has(c.id) ? ({ ...c, x: c.x + dx, y: c.y + dy } as Camada) : c))
      mapa = mapaDe(lista)
      mudou = true
    }
  }
  return mudou ? lista : depois
}

export type ModoSemRestricao = 'escalar' | 'manter'

/** Escala as medidas internas (fonte, raios, traços, sombras) numa conversão proporcional. */
function escalarConteudo(c: Camada, s: number): Camada {
  if (Math.abs(s - 1) < 1e-6) return c
  const n = { ...c } as Record<string, unknown>
  const lim = (v: number, max: number) => Math.min(max, Math.round(v * s * 100) / 100)
  if (c.type === 'text') { n.fontSize = Math.max(6, lim(c.fontSize, 800)); n.letterSpacing = Math.max(-100, lim(c.letterSpacing, 100)); n.padding = lim(c.padding, 200) }
  if ('radius' in c && typeof c.radius === 'number') n.radius = lim(c.radius, 999)
  if ('radii' in c && c.radii) n.radii = c.radii.map((r) => lim(r, 999))
  if ('strokeWidth' in c && typeof c.strokeWidth === 'number') n.strokeWidth = lim(c.strokeWidth, 100)
  if (c.strokes) n.strokes = c.strokes.map((t) => ({ ...t, weight: lim(t.weight, 200), ...(t.sides ? { sides: { top: lim(t.sides.top, 200), right: lim(t.sides.right, 200), bottom: lim(t.sides.bottom, 200), left: lim(t.sides.left, 200) } } : {}) }))
  if (c.type === 'frame' && c.layout) {
    const L = c.layout
    n.layout = { ...L, gap: Math.round(L.gap * s), ...(L.rowGap !== undefined ? { rowGap: Math.round(L.rowGap * s) } : {}), padding: { top: Math.round(L.padding.top * s), right: Math.round(L.padding.right * s), bottom: Math.round(L.padding.bottom * s), left: Math.round(L.padding.left * s) } }
  }
  return n as Camada
}

/**
 * Converter formato da tela (16:9 → 9:16, 1:1…). Camadas da raiz com restrição seguem a restrição em relação à
 * tela; sem restrição, `escalar` encaixa o conteúdo proporcionalmente e centraliza (o padrão), `manter` deixa
 * como está. Descendentes acompanham o frame (escala junto ou restrições próprias).
 */
export function converterFormato(camadas: readonly Camada[], de: Tamanho, para: Tamanho, modo: ModoSemRestricao = 'escalar'): Camada[] {
  const telaA = { x: 0, y: 0, width: de.width, height: de.height }
  const telaB = { x: 0, y: 0, width: para.width, height: para.height }
  const s = Math.min(para.width / de.width, para.height / de.height)
  const ox = (para.width - de.width * s) / 2
  const oy = (para.height - de.height * s) / 2
  const mapa = mapaDe(camadas)
  const porId = new Map<string, Camada>()
  const raizes = camadas.filter((c) => !paiDe(c, mapa))
  for (const r of raizes) {
    const subarvore = [r, ...descendentes(r.id, camadas)]
    if (!r.constraints && modo === 'escalar') {
      for (const c of subarvore) porId.set(c.id, { ...escalarConteudo(c, s), ...arred({ x: ox + c.x * s, y: oy + c.y * s, width: c.width * s, height: c.height * s }) } as Camada)
      continue
    }
    const nova = arred(aplicarRestricao(r, telaA, telaB, r.constraints ?? RESTRICAO_PADRAO))
    porId.set(r.id, { ...r, ...nova } as Camada)
    const dx = nova.x - r.x
    const dy = nova.y - r.y
    for (const d of subarvore.slice(1)) porId.set(d.id, { ...d, x: d.x + dx, y: d.y + dy } as Camada)
  }
  const movidas = camadas.map((c) => porId.get(c.id) ?? c)
  // filhos de frames livres com restrição acompanham o novo tamanho do frame
  return propagarRestricoes(camadas, movidas)
}
