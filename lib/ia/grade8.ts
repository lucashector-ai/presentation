/**
 * Regra do 8 nas telas geradas pela IA: o último passo da montagem (`montarTela`) põe na grade de 8 px a posição,
 * o tamanho e os espaçamentos de todas as camadas — margens, gaps e paddings de auto layout, vãos entre rótulo,
 * título e conteúdo, colunas e calhas, cartões, gráficos, tabelas, ícones e imagens. Vale para slides, story e
 * explorar, em todos os estilos, com o desenho do Claude ou o local. Determinístico e puro (sem rede, sem DOM).
 *
 * Como:
 *  1. gaps e paddings (dos frames e das etiquetas de texto) vão para o múltiplo de 8 mais próximo; o que não é zero
 *     nunca some (um vão de 6 vira 8);
 *  2. traços finos e barras de dados que estão no fluxo de um auto layout ganham uma faixa de 8 em 8 em volta
 *     (frame sem fundo), para a espessura de 2 px ou o comprimento da barra não empurrar o resto para fora da grade;
 *  3. as bordas de cada caixa vão para a grade. O arredondamento é monótono, então bordas iguais continuam iguais,
 *     o que não se sobrepunha continua sem se sobrepor e nada sai da tela (1920 e 1080 são múltiplos de 8). Num
 *     fluxo, a borda de baixo de um item e a de cima do seguinte diferem pelo gap (múltiplo de 8): os vãos ficam
 *     exatos e o total não cresce. Quadrados (avatares, marcadores) continuam quadrados; pílulas e círculos
 *     acompanham o raio;
 *  4. texto nunca fica menor que as próprias linhas (medidas de novo na largura final) nem mais estreito que antes;
 *  5. o auto layout é resolvido de novo com os tamanhos novos — o editor abre sem mover nada — e um item
 *     centralizado que caiu em meio passo ganha 8 px de caixa (texto centrado, sem mudar onde as letras ficam).
 *
 * Exceções (não vão para a grade, de propósito):
 *  - espessura de traços de até 6 px (fios, divisores, sublinhados, pontos da textura): a posição vai, a espessura não;
 *  - comprimento das barras de dados (é o valor, não espaço) e os marcadores sobre os pontos de um gráfico de linha:
 *    a âncora da barra (a base, o início ou o centro) vai para a grade; o logo tem um lado na grade e o outro na
 *    proporção do arquivo;
 *  - item centralizado (marcador, avatar) num espaço cujo vão livre não fecha em 16: fica a 4 px (meio passo);
 *  - tamanho de fonte (escala tipográfica do tema), raio, rotação, opacidade e efeitos. A entrelinha fica em
 *    múltiplos de 4 px (montagem), então mesmo medida de novo no editor a caixa de texto segue o ritmo de 4/8.
 */
import { calcularLayout } from '@/lib/editor/autolayout'
import type { Camada as CamadaCena } from '@/lib/scene/schema'
import { GRADE } from './designSystem'

export type CamadaGrade = Record<string, unknown> & { id: string; x: number; y: number; width: number; height: number }
type Camada = CamadaGrade
type Alin = 'start' | 'center' | 'end'
interface Layout { direction: 'horizontal' | 'vertical' | 'wrap'; gap: number; rowGap?: number; gapAuto: boolean; padding: { top: number; right: number; bottom: number; left: number }; alignX: Alin; alignY: Alin }

/** Espessura máxima de um traço (fio, divisor, ponto): a espessura fica fora da grade. */
export const TRACO_MAX = 6

/** Múltiplo de 8 mais próximo (monótono: a ordem entre medidas se mantém). */
export const naGrade = (n: number) => Math.round(n / GRADE) * GRADE
/** Múltiplo de 8 igual ou acima (para o que não pode encolher, como a altura das linhas de um texto; tolera 0,1 px). */
export const acimaNaGrade = (n: number) => Math.ceil(n / GRADE - 0.0125) * GRADE
/**
 * Gap ou padding na grade: zero continua zero, o resto nunca some (2 → 8). No meio do caminho arredonda para baixo
 * (12 → 8, 20 → 16): o respiro fica no ritmo sem empurrar o conteúdo para fora da área.
 */
export const espacoNaGrade = (n: number) => (n <= 0 ? 0 : Math.max(GRADE, Math.ceil(n / GRADE - 0.5) * GRADE))
/**
 * Entrelinha na grade para o corpo dado: múltiplos de 8 px nos corpos de 40 px para cima (títulos, números) e de
 * 4 px nos menores, então a caixa de N linhas fecha no ritmo de 8 (ou 4) mesmo quando o editor mede de novo.
 */
export function entrelinhaNaGrade(tamanho: number, lh: number): number {
  const passo = tamanho >= 40 ? GRADE : GRADE / 2
  // o mais perto (no meio do caminho, a menor), sem apertar abaixo do corpo (entrelinha < 1 encosta as linhas)
  let px = Math.max(passo, Math.ceil((tamanho * lh) / passo - 0.5) * passo)
  if (px < tamanho * Math.min(lh, 1) - 1e-6) px += passo
  return Math.round((px / tamanho) * 1e4) / 1e4
}

/**
 * Colunas iguais na grade: `cols` colunas com largura múltipla de 8 que, com a calha, fecham a largura `w` (que já
 * está na grade). Procura a calha mais perto da pedida (até 8 px de diferença); se nenhuma fecha, as colunas ficam
 * no múltiplo de 8 abaixo com a calha pedida (sobra um resto à direita, menor que 8 px por coluna).
 */
export function colunasNaGrade(w: number, cols: number, gap: number): { largura: number; gap: number } {
  const g0 = espacoNaGrade(gap)
  if (cols <= 1) return { largura: Math.max(GRADE, Math.floor(w / GRADE) * GRADE), gap: g0 }
  for (const g of [g0, g0 + GRADE, g0 - GRADE]) {
    if (g < GRADE) continue
    const largura = (w - (cols - 1) * g) / cols
    if (largura > 0 && Number.isInteger(largura) && largura % GRADE === 0) return { largura, gap: g }
  }
  return { largura: Math.max(GRADE, Math.floor((w - (cols - 1) * g0) / cols / GRADE) * GRADE), gap: g0 }
}

/**
 * Divide `total` (na grade) em partes proporcionais aos pesos, cada uma múltipla de 8, somando exatamente o total
 * (o que sobra do arredondamento vai, de 8 em 8, para as partes com a maior fração).
 */
export function repartirNaGrade(total: number, pesos: readonly number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0) || 1
  const unidades = Math.floor(total / GRADE)
  const exatas = pesos.map((p) => (unidades * p) / soma)
  const base = exatas.map(Math.floor)
  let resto = unidades - base.reduce((a, b) => a + b, 0)
  for (const k of exatas.map((v, k) => ({ k, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f || a.k - b.k).map((x) => x.k)) {
    if (resto <= 0) break
    base[k]!++
    resto--
  }
  return base.map((u) => u * GRADE)
}

/**
 * Medida exata num eixo — o comprimento de uma barra de dados (é o valor) ou o lado de um logo que segue a proporção
 * do arquivo; só a âncora (início, centro ou fim) vai para a grade.
 */
export interface MedidaDado { eixo: 'x' | 'y'; ancora: 'inicio' | 'centro' | 'fim' }

export interface OpcoesGrade {
  /** Medidas exatas por id (barras de dados, logos). */
  dados?: ReadonlyMap<string, MedidaDado>
  /** Camadas que ficam exatamente onde estão (marcadores sobre os pontos de um gráfico de linha). */
  exatas?: ReadonlySet<string>
  /** Id das faixas criadas em volta de traços e barras no fluxo. */
  uid: (papel: string) => string
  /** Altura das linhas de um texto na largura atual da camada (sem a folga de baixo); ausente = não mede. */
  alturaTexto?: (l: Camada) => number
}

const resolver = (L: Camada[]): Camada[] => calcularLayout(L.map((l, i) => ({ ...l, z: i })) as unknown as CamadaCena[]) as unknown as Camada[]
const layoutDe = (l: Camada | undefined) => (l && l.type === 'frame' && l.layout ? (l.layout as Layout) : null)
const ehTraco = (l: Camada) => l.type === 'shape' && Math.min(l.width, l.height) <= TRACO_MAX
const fora = (v: number) => Math.abs(v - naGrade(v)) > 1e-6

/** Põe as camadas montadas de uma tela na grade de 8 px (ver o comentário do arquivo). Devolve o layout resolvido. */
export function alinharNaGrade(camadas: readonly Camada[], o: OpcoesGrade): Camada[] {
  const dados = o.dados ?? new Map<string, MedidaDado>()
  const exatas = o.exatas ?? new Set<string>()
  let L: Camada[] = camadas.map((l) => ({ ...l, ...(l.layout ? { layout: { ...(l.layout as Layout), padding: { ...(l.layout as Layout).padding } } } : {}) }) as Camada)

  // 1. espaçamentos: gaps, paddings e o padding das etiquetas de texto
  for (const l of L) {
    const lay = layoutDe(l)
    if (lay) {
      lay.gap = espacoNaGrade(lay.gap)
      if (lay.rowGap !== undefined) lay.rowGap = espacoNaGrade(lay.rowGap)
      for (const k of ['top', 'right', 'bottom', 'left'] as const) lay.padding[k] = espacoNaGrade(lay.padding[k])
    }
    if (l.type === 'text' && typeof l.padding === 'number' && l.padding > 0) l.padding = espacoNaGrade(l.padding)
  }

  // 2. faixas de 8 em 8 em volta de traços e barras no fluxo (a espessura ou o comprimento ficam dentro dela)
  const porId = () => new Map(L.map((l) => [l.id, l]))
  {
    const mapa = porId()
    const saida: Camada[] = []
    for (const l of L) {
      const pai = typeof l.parentId === 'string' && !l.absolute ? mapa.get(l.parentId) : undefined
      const lay = layoutDe(pai)
      const dado = dados.get(l.id)
      if (!pai || !lay || lay.direction === 'wrap') { saida.push(l); continue }
      const horizontal = lay.direction === 'horizontal'
      const principal = horizontal ? 'width' : 'height'
      const cruzado = horizontal ? 'height' : 'width'
      const dimP = horizontal ? 'sizingW' : 'sizingH'
      const dimC = horizontal ? 'sizingH' : 'sizingW'
      const dadoP = !!dado && (dado.eixo === 'x') === horizontal
      const tracoP = ehTraco(l) && l[principal] <= TRACO_MAX
      if (!dadoP && !tracoP) { saida.push(l); continue }
      // barra com o dado no eixo cruzado (a da tabela): a faixa preenche e alinha a barra como o pai alinharia
      const dadoC = !!dado && !dadoP
      const preencheC = l[dimC] === 'fill' || dadoC
      const alinC: Alin = preencheC ? (horizontal ? lay.alignY : lay.alignX) : 'start'
      const alinP: Alin = tracoP ? 'center' : 'start'
      const faixa = {
        id: o.uid('faixa'), type: 'frame', x: l.x, y: l.y,
        [principal]: Math.max(GRADE, acimaNaGrade(l[principal])), [cruzado]: l[cruzado],
        [dimP]: 'fixed', [dimC]: preencheC ? 'fill' : 'fixed', parentId: pai.id,
        layout: { direction: horizontal ? 'horizontal' : 'vertical', gap: 0, gapAuto: false, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignX: horizontal ? alinP : alinC, alignY: horizontal ? alinC : alinP },
      } as unknown as Camada
      saida.push(faixa, { ...l, parentId: faixa.id, [dimP]: 'fixed' })
    }
    L = saida
  }

  // 3. bordas na grade (sobre o layout resolvido, com os espaçamentos novos)
  const aplicarBordas = () => {
    const R = resolver(L)
    const mapa = porId()
    for (const b of R) {
      const l = mapa.get(b.id)!
      if (exatas.has(b.id)) { Object.assign(l, { x: b.x, y: b.y, width: b.width, height: b.height }); continue }
      const dado = dados.get(b.id)
      const traco = ehTraco(b)
      /** Início e tamanho na grade num eixo. */
      const eixo = (p0: number, tam: number, e: 'x' | 'y'): [number, number] => {
        if (dado?.eixo === e) {
          // comprimento exato (é o valor); a âncora na grade
          if (dado.ancora === 'fim') return [naGrade(p0 + tam) - tam, tam]
          if (dado.ancora === 'centro') return [naGrade(p0 + tam / 2) - tam / 2, tam]
          return [naGrade(p0), tam]
        }
        if (traco && tam <= TRACO_MAX) return [naGrade(p0), tam]
        const i = naGrade(p0)
        return [i, Math.max(GRADE, naGrade(p0 + tam) - i)]
      }
      const [x0, w] = eixo(b.x, b.width, 'x')
      const y0 = eixo(b.y, b.height, 'y')[0]
      let h = eixo(b.y, b.height, 'y')[1]
      let w1 = w
      // texto: a caixa abraça as linhas medidas no múltiplo de 8 de cima (a folga vem da grade, não da estimativa)
      if (b.type === 'text' && o.alturaTexto) h = Math.max(GRADE, acimaNaGrade(o.alturaTexto(b) + (typeof b.padding === 'number' && b.background ? b.padding * 2 : 0)))
      // quadrados continuam quadrados (avatares, marcadores, formas do motivo)
      if (!dado && !traco && Math.abs(b.width - b.height) < 0.5) w1 = h = Math.max(GRADE, naGrade(b.width))
      // pílulas e círculos acompanham o tamanho novo
      const raio = typeof b.radius === 'number' ? b.radius : 0
      if (raio > 0 && raio < 999 && raio >= Math.min(b.width, b.height) / 2 - 0.5) l.radius = Math.min(w1, h) / 2
      Object.assign(l, { x: x0, y: y0, width: w1, height: h })
    }
  }
  aplicarBordas()

  // 3b. o que a grade alargou cabe no pai: filho no máximo do tamanho da área interna (eixo fixo do pai) e, numa
  // fila horizontal de largura fixa, o excesso sai do texto mais largo (que ganha linhas no passo 4, se precisar)
  {
    const filhosDe = new Map<string, Camada[]>()
    for (const l of L) if (typeof l.parentId === 'string' && !l.absolute && !l.hidden) filhosDe.set(l.parentId, [...(filhosDe.get(l.parentId) ?? []), l])
    for (const f of L) {
      const lay = layoutDe(f)
      const filhos = filhosDe.get(f.id)
      if (!lay || !filhos || lay.direction === 'wrap') continue
      const internoW = f.width - lay.padding.left - lay.padding.right
      const internoH = f.height - lay.padding.top - lay.padding.bottom
      for (const c of filhos) {
        if (f.sizingW !== 'hug' && c.sizingW !== 'fill' && c.width > internoW && !dados.has(c.id)) c.width = Math.max(GRADE, internoW)
        if (f.sizingH !== 'hug' && c.sizingH !== 'fill' && c.height > internoH && c.type !== 'text' && !dados.has(c.id)) c.height = Math.max(GRADE, internoH)
      }
      if (lay.direction !== 'horizontal' || f.sizingW === 'hug' || filhos.some((c) => c.sizingW === 'fill')) continue
      const excesso = filhos.reduce((soma, c) => soma + c.width, 0) + (lay.gapAuto ? 0 : lay.gap * (filhos.length - 1)) - internoW
      const alvo = filhos.filter((c) => c.type === 'text' && c.width - excesso >= GRADE).sort((a, b) => b.width - a.width)[0]
      if (excesso > 0 && alvo) alvo.width -= acimaNaGrade(excesso)
    }
  }

  // 4. texto nunca menor que as próprias linhas (na largura final), itens centralizados fora de meio passo, frames de
  // altura fixa que comportam o conteúdo e espaço automático que fecha na grade
  for (let rodada = 0; rodada < 4; rodada++) {
    const R = resolver(L)
    const mapaR = new Map(R.map((l) => [l.id, l]))
    const mapa = porId()
    let mudou = false
    for (const b of R) {
      const l = mapa.get(b.id)!
      if (b.type !== 'text' || exatas.has(b.id)) continue
      const pad = typeof b.padding === 'number' && b.background ? b.padding * 2 : 0
      const precisa = o.alturaTexto ? acimaNaGrade(o.alturaTexto(b) + pad) : 0
      if (precisa > b.height + 1e-6) { l.height = precisa; mudou = true; continue }
      // centralizado pelo pai em meio passo: a caixa cresce 8 px e o texto fica onde estava (centrado na caixa)
      const pai = typeof b.parentId === 'string' && !b.absolute ? mapaR.get(b.parentId) : undefined
      const lay = layoutDe(pai)
      if (!lay || lay.gapAuto) continue
      const horizontal = lay.direction !== 'vertical'
      const centroX = lay.alignX === 'center' && (horizontal || b.sizingW !== 'fill')
      const centroY = lay.alignY === 'center' && (!horizontal || b.sizingH !== 'fill')
      if (centroX && fora(b.x) && b.align === 'center' && b.sizingW !== 'fill' && b.width + GRADE <= pai!.width) { l.width = b.width + GRADE; mudou = true }
      if (centroY && fora(b.y) && b.height + GRADE <= pai!.height) { l.height = b.height + GRADE; l.valign = 'middle'; mudou = true }
    }
    // frame de altura fixa (cartões igualados, linhas de tabela) cujo conteúdo cresceu na grade: cresce junto com os
    // irmãos da mesma altura (continuam iguais)
    const crescer = new Map<string, number>()
    for (const f of R) {
      const lay = layoutDe(mapa.get(f.id))
      if (!lay || lay.direction === 'wrap' || f.sizingH !== 'fixed') continue
      const filhos = R.filter((c) => c.parentId === f.id && !c.absolute && !c.hidden)
      if (!filhos.length) continue
      // (no espaço automático, o gap gravado é o vão mínimo)
      const conteudo = lay.direction === 'vertical' ? filhos.reduce((soma, c) => soma + c.height, 0) + lay.gap * (filhos.length - 1) : Math.max(...filhos.map((c) => c.height))
      const precisa = lay.padding.top + lay.padding.bottom + conteudo
      if (precisa > f.height + 1e-6) crescer.set(f.id, precisa)
    }
    for (const [id, precisa] of crescer) {
      const f = mapaR.get(id)!
      // irmãos: mesma altura fixa e mesmo papel, no mesmo pai (linhas de tabela) ou na mesma linha (cartões igualados)
      const papel = (id: string) => id.replace(/-[^-]+$/, '')
      const irmaos = R.filter((c) => c.type === 'frame' && c.sizingH === 'fixed' && Math.abs(c.height - f.height) < 0.5 && papel(c.id) === papel(f.id) && (c.parentId === f.parentId || Math.abs(c.y - f.y) < 0.5))
      const alvo = Math.max(precisa, ...irmaos.map((c) => crescer.get(c.id) ?? 0))
      for (const c of irmaos.length ? irmaos : [f]) { mapa.get(c.id)!.height = acimaNaGrade(alvo); mudou = true }
    }
    // espaço automático (space-between) com 3 ou mais itens: o que não fecha em 8 por vão vai para o padding do fim
    for (const f of R) {
      const lay = layoutDe(mapa.get(f.id))
      if (!lay || !lay.gapAuto || lay.direction === 'wrap') continue
      const horizontal = lay.direction === 'horizontal'
      if ((horizontal ? f.sizingW : f.sizingH) === 'hug') continue
      const filhos = R.filter((c) => c.parentId === f.id && !c.absolute && !c.hidden)
      if (filhos.length < 3) continue
      const interno = horizontal ? f.width - lay.padding.left - lay.padding.right : f.height - lay.padding.top - lay.padding.bottom
      const sobra = interno - filhos.reduce((soma, c) => soma + (horizontal ? c.width : c.height), 0)
      const resto = sobra > 0 ? sobra % (GRADE * (filhos.length - 1)) : 0
      if (resto > 0) { lay.padding[horizontal ? 'right' : 'bottom'] += resto; mudou = true }
    }
    if (!mudou) break
  }
  return resolver(L)
}
