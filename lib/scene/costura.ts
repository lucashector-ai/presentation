/**
 * Costura entre caixas coladas. Com a cena reduzida (transform: scale), duas caixas lado a lado terminam
 * numa borda fracionária de pixel; cada uma é desenhada com antialiasing e o fundo vaza numa linha clara
 * de 1 px. Como o navegador arredonda posições em 1/64 px, alinhar ao pixel não resolve sempre.
 * Solução: a camada de baixo (desenhada antes) avança 1 px de tela por baixo da vizinha de cima, que a cobre.
 * Só para caixas opacas, sem rotação e sem cantos arredondados, onde a sobreposição é invisível.
 */
import type { Camada } from './schema'
import { temTraco } from './tracos'

const TOL = 0.75

const corOpaca = (cor: string) => !/^#[0-9a-f]{8}$/i.test(cor) || cor.slice(7).toLowerCase() === 'ff'

function caixaOpaca(c: Camada): boolean {
  if (c.hidden || c.maskId || c.isMask || (c.opacity ?? 1) < 1 || Math.abs((c.rotation ?? 0) % 360) > 0.01) return false
  if (c.effects && ((c.effects.blur ?? 0) > 0 || (c.effects.blend ?? 'normal') !== 'normal')) return false
  switch (c.type) {
    case 'shape':
      return c.shape === 'rect' && !c.radius && !temTraco(c) && (c.pattern ?? 'none') === 'none' && !c.gradient && corOpaca(c.fill)
    case 'frame':
      return !c.radius && !!c.fill && corOpaca(c.fill) && !c.gradient && !temTraco(c)
    case 'image':
      return !c.radius && c.fit === 'cover' && (c.mask ?? 'none') === 'none'
    default:
      return false
  }
}

const sobrepoe = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > TOL

/**
 * Recebe as camadas já na ordem de desenho (de baixo para cima) e o tamanho de 1 px de tela em unidades da
 * cena. Devolve a mesma lista, com as caixas de baixo estendidas sob as vizinhas coladas.
 */
export function costurar(camadas: Camada[], passo: number | undefined): Camada[] {
  if (!passo || passo <= 0 || camadas.length < 2) return camadas
  const elegiveis = camadas.map(caixaOpaca)
  let mudou = false
  const saida = camadas.map((c, i) => {
    if (!elegiveis[i]) return c
    let { x, y, width, height } = c
    const dir = c.x + c.width
    const base = c.y + c.height
    for (let j = i + 1; j < camadas.length; j++) {
      if (!elegiveis[j]) continue
      const o = camadas[j]!
      const oDir = o.x + o.width
      const oBase = o.y + o.height
      const vertical = sobrepoe(c.y, base, o.y, oBase)
      const horizontal = sobrepoe(c.x, dir, o.x, oDir)
      if (vertical && Math.abs(o.x - dir) <= TOL) width = Math.max(width, dir - x + passo)
      if (vertical && Math.abs(oDir - c.x) <= TOL) { const nx = Math.min(x, c.x - passo); width += x - nx; x = nx }
      if (horizontal && Math.abs(o.y - base) <= TOL) height = Math.max(height, base - y + passo)
      if (horizontal && Math.abs(oBase - c.y) <= TOL) { const ny = Math.min(y, c.y - passo); height += y - ny; y = ny }
    }
    if (x === c.x && y === c.y && width === c.width && height === c.height) return c
    mudou = true
    return { ...c, x, y, width, height }
  })
  return mudou ? saida : camadas
}
