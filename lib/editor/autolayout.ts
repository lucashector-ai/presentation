/**
 * Auto layout (modelo do Figma), puro e sem DOM. Usado pelo editor (a cada mudança do documento)
 * e pelo renderizador (visualizador/miniaturas), então editor e convidado veem o mesmo resultado.
 *
 * As camadas ficam numa lista plana com coordenadas absolutas. `calcularLayout` resolve x/y/w/h
 * dos filhos de frames com auto layout (e o tamanho de frames que abraçam o conteúdo) e devolve
 * a mesma lista quando nada muda (igualdade referencial para memo).
 *
 * Regras:
 *  - ordem de fluxo = z crescente entre irmãos (o primeiro item é o de baixo na lista de camadas)
 *  - filhos ocultos e com `absolute` não ocupam espaço
 *  - eixo principal: fixed/hug usam o tamanho próprio; fill divide o espaço restante
 *  - eixo cruzado: fill ocupa a área interna; senão alinha (início/centro/fim)
 *  - gap automático = space-between; wrap quebra em linhas (rowGap)
 *  - frame hug = padding + conteúdo; frame mantém o canto superior esquerdo
 *  - posições sempre em pixels inteiros
 */
import type { AutoLayout, Camada, CamadaFrame, Dimensionamento } from '@/lib/scene/schema'
import type { Retangulo } from '@/lib/scene/transform'
import { ancestrais, descendentes, filhosDe, mapaDe, normalizarArvore, paiDe, temAutoLayout } from '@/lib/scene/arvore'

type Caixa = Retangulo
type Tam = { width: number; height: number }

const dimW = (c: Camada): Dimensionamento => c.sizingW ?? 'fixed'
const dimH = (c: Camada): Dimensionamento => c.sizingH ?? 'fixed'

export const LAYOUT_PADRAO: AutoLayout = { direction: 'horizontal', gap: 16, gapAuto: false, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignX: 'start', alignY: 'start' }

/** Filhos que participam do fluxo (visíveis, não absolutos), em ordem. */
export function filhosNoFluxo(frameId: string, camadas: readonly Camada[]): Camada[] {
  return filhosDe(frameId, camadas).filter((c) => !c.hidden && !c.absolute)
}

export function calcularLayout(camadas: readonly Camada[]): Camada[] {
  if (!camadas.some((c) => c.type === 'frame' && c.layout)) return camadas as Camada[]
  const mapa = mapaDe(camadas)
  const porPai = new Map<string, Camada[]>()
  for (const c of camadas) {
    const p = paiDe(c, mapa)
    if (p) porPai.set(p.id, [...(porPai.get(p.id) ?? []), c])
  }
  for (const l of porPai.values()) l.sort((a, b) => a.z - b.z)
  const fluxo = (id: string) => (porPai.get(id) ?? []).filter((c) => !c.hidden && !c.absolute)
  const caixas = new Map<string, Caixa>(camadas.map((c) => [c.id, { x: c.x, y: c.y, width: c.width, height: c.height }]))
  const emCalculo = new Set<string>()

  /** Tamanho intrínseco (hug resolvido; fixed/fill = tamanho atual). */
  const medir = (c: Camada): Tam => {
    const atual = caixas.get(c.id)!
    if (!temAutoLayout(c) || emCalculo.has(c.id)) return { width: atual.width, height: atual.height }
    const hugW = dimW(c) === 'hug'
    const hugH = dimH(c) === 'hug'
    if (!hugW && !hugH) return { width: atual.width, height: atual.height }
    emCalculo.add(c.id)
    const L = c.layout
    const itens = fluxo(c.id).map((f) => ({ c: f, ...medir(f) }))
    emCalculo.delete(c.id)
    const pad = L.padding
    const gap = L.gapAuto ? 0 : L.gap
    let cw = 0
    let ch = 0
    if (L.direction === 'vertical') {
      cw = Math.max(0, ...itens.map((i) => i.width))
      ch = itens.reduce((s, i) => s + i.height, 0) + gap * Math.max(0, itens.length - 1)
    } else if (L.direction === 'wrap' && !hugW) {
      const linhas = quebrarLinhas(itens, atual.width - pad.left - pad.right, gap)
      cw = Math.max(0, ...linhas.map((l) => l.largura))
      ch = linhas.reduce((s, l) => s + l.altura, 0) + (L.rowGap ?? L.gap) * Math.max(0, linhas.length - 1)
    } else {
      cw = itens.reduce((s, i) => s + i.width, 0) + gap * Math.max(0, itens.length - 1)
      ch = Math.max(0, ...itens.map((i) => i.height))
    }
    return {
      width: hugW ? Math.max(1, Math.round(pad.left + pad.right + cw)) : atual.width,
      height: hugH ? Math.max(1, Math.round(pad.top + pad.bottom + ch)) : atual.height,
    }
  }

  const deslocarDescendentes = (id: string, dx: number, dy: number) => {
    if (!dx && !dy) return
    for (const d of descendentes(id, camadas)) {
      const b = caixas.get(d.id)!
      caixas.set(d.id, { ...b, x: b.x + dx, y: b.y + dy })
    }
  }

  const posicionar = (c: Camada, caixa: Caixa, visitados: Set<string>) => {
    if (visitados.has(c.id)) return
    visitados.add(c.id)
    const antes = caixas.get(c.id)!
    caixas.set(c.id, caixa)
    deslocarDescendentes(c.id, caixa.x - antes.x, caixa.y - antes.y)
    const filhos = porPai.get(c.id) ?? []
    const colocados = temAutoLayout(c) ? distribuir(c, caixa) : new Map<string, Caixa>()
    for (const f of filhos) {
      const b = colocados.get(f.id) ?? { ...caixas.get(f.id)!, ...medir(f) }
      posicionar(f, b, visitados)
    }
  }

  const distribuir = (frame: CamadaFrame & { layout: AutoLayout }, caixa: Caixa): Map<string, Caixa> => {
    const L = frame.layout
    const pad = L.padding
    const dentro = { x: caixa.x + pad.left, y: caixa.y + pad.top, width: Math.max(0, caixa.width - pad.left - pad.right), height: Math.max(0, caixa.height - pad.top - pad.bottom) }
    const itens = fluxo(frame.id)
    const r = new Map<string, Caixa>()
    if (!itens.length) return r
    const horizontal = L.direction !== 'vertical'
    const principal = (t: Tam) => (horizontal ? t.width : t.height)
    const dimP = (c: Camada) => (horizontal ? dimW(c) : dimH(c))
    const dimC = (c: Camada) => (horizontal ? dimH(c) : dimW(c))
    const extP = horizontal ? dentro.width : dentro.height
    const extC = horizontal ? dentro.height : dentro.width
    const alinP = horizontal ? L.alignX : L.alignY
    const alinC = horizontal ? L.alignY : L.alignX

    const medidos = itens.map((c) => ({ c, t: medir(c) }))

    if (L.direction === 'wrap') {
      const base = medidos.map(({ c, t }) => ({ c, width: t.width, height: dimH(c) === 'fill' ? t.height : t.height }))
      const linhas = quebrarLinhas(base, dentro.width, L.gapAuto ? 0 : L.gap)
      const rowGap = L.rowGap ?? L.gap
      const totalH = linhas.reduce((s, l) => s + l.altura, 0) + rowGap * Math.max(0, linhas.length - 1)
      let cy = dentro.y + offset(L.alignY, dentro.height - totalH)
      for (const linha of linhas) {
        const n = linha.itens.length
        const soma = linha.itens.reduce((s, i) => s + i.width, 0)
        const gap = L.gapAuto && n > 1 ? Math.max(0, (dentro.width - soma) / (n - 1)) : L.gap
        let cx = dentro.x + (L.gapAuto && n > 1 ? 0 : offset(L.alignX, dentro.width - (soma + gap * (n - 1))))
        for (const it of linha.itens) {
          const y = cy + offset(L.alignY, linha.altura - it.height)
          r.set(it.c.id, { x: Math.round(cx), y: Math.round(y), width: it.width, height: it.height })
          cx += it.width + gap
        }
        cy += linha.altura + rowGap
      }
      return r
    }

    // eixo principal
    const fixos = medidos.filter(({ c }) => dimP(c) !== 'fill')
    const nFill = medidos.length - fixos.length
    const somaFixos = fixos.reduce((s, { t }) => s + principal(t), 0)
    const n = medidos.length
    const gapBase = L.gapAuto ? 0 : L.gap
    const restante = extP - somaFixos - gapBase * (n - 1)
    const fatia = nFill ? Math.max(1, restante / nFill) : 0
    const tamanhosP = medidos.map(({ c, t }) => (dimP(c) === 'fill' ? fatia : principal(t)))
    const total = tamanhosP.reduce((s, v) => s + v, 0)
    const gap = L.gapAuto && n > 1 && !nFill ? Math.max(0, (extP - total) / (n - 1)) : gapBase
    let cursor = (horizontal ? dentro.x : dentro.y) + (L.gapAuto && n > 1 && !nFill ? 0 : offset(alinP, extP - (total + gap * (n - 1))))

    medidos.forEach(({ c, t }, i) => {
      const tp = tamanhosP[i]!
      const p0 = Math.round(cursor)
      const p1 = dimP(c) === 'fill' ? Math.round(cursor + tp) : p0 + tp
      const tc = dimC(c) === 'fill' ? extC : horizontal ? t.height : t.width
      const c0 = Math.round((horizontal ? dentro.y : dentro.x) + offset(alinC, extC - tc))
      const tcR = dimC(c) === 'fill' ? Math.max(1, Math.round((horizontal ? dentro.y : dentro.x) + extC) - c0) : tc
      const tpR = Math.max(1, p1 - p0)
      r.set(c.id, horizontal ? { x: p0, y: c0, width: tpR, height: tcR } : { x: c0, y: p0, width: tcR, height: tpR })
      cursor += tp + gap
    })
    return r
  }

  const visitados = new Set<string>()
  for (const c of camadas) {
    if (paiDe(c, mapa)) continue
    posicionar(c, { ...caixas.get(c.id)!, ...medir(c) }, visitados)
  }
  // ciclos/órfãos não visitados ficam como estão

  let mudou = false
  const r = camadas.map((c) => {
    const b = caixas.get(c.id)!
    if (Math.abs(b.x - c.x) < 1e-6 && Math.abs(b.y - c.y) < 1e-6 && Math.abs(b.width - c.width) < 1e-6 && Math.abs(b.height - c.height) < 1e-6) return c
    mudou = true
    return { ...c, x: b.x, y: b.y, width: b.width, height: b.height } as Camada
  })
  return mudou ? r : (camadas as Camada[])
}

function offset(a: 'start' | 'center' | 'end', livre: number): number {
  return a === 'center' ? livre / 2 : a === 'end' ? livre : 0
}

interface ItemLinha<T> { c: T; width: number; height: number }
function quebrarLinhas<T>(itens: ItemLinha<T>[], largura: number, gap: number) {
  const linhas: { itens: ItemLinha<T>[]; largura: number; altura: number }[] = []
  let atual: ItemLinha<T>[] = []
  let w = 0
  for (const it of itens) {
    const novo = atual.length ? w + gap + it.width : it.width
    if (atual.length && novo > largura + 0.5) {
      linhas.push({ itens: atual, largura: w, altura: Math.max(...atual.map((i) => i.height)) })
      atual = [it]
      w = it.width
    } else {
      atual.push(it)
      w = novo
    }
  }
  if (atual.length) linhas.push({ itens: atual, largura: w, altura: Math.max(...atual.map((i) => i.height)) })
  return linhas
}

// ---------- integração com edições ----------

export interface OpcoesResolver {
  /** Mudança de tamanho vinda da medição de texto: não troca hug/fill por fixo. */
  manterDimensionamento?: boolean
}

/**
 * Normaliza uma edição: (1) frames movidos levam os descendentes que não foram movidos junto;
 * (2) tamanho alterado explicitamente troca hug/fill por fixo (como no Figma);
 * (3) empilhamento em árvore; (4) auto layout.
 */
export function resolverCamadas(antes: readonly Camada[], depois: readonly Camada[], opcoes: OpcoesResolver = {}): Camada[] {
  if (antes === depois) return depois as Camada[]
  const mapaAntes = mapaDe(antes)
  const comDimensionamento = depois.some((c) => c.sizingW || c.sizingH)
  const comFrames = depois.some((c) => c.parentId || c.type === 'frame')
  if (!comFrames && !comDimensionamento) return depois as Camada[]
  let lista = [...depois]

  // 1. propaga movimento de frames
  for (const f of depois) {
    if (f.type !== 'frame') continue
    const a = mapaAntes.get(f.id)
    if (!a) continue
    const dx = f.x - a.x
    const dy = f.y - a.y
    if (!dx && !dy) continue
    const desc = new Set(descendentes(f.id, lista).map((d) => d.id))
    const moveramJunto = lista.some((d) => desc.has(d.id) && (() => { const da = mapaAntes.get(d.id); return !!da && (da.x !== d.x || da.y !== d.y) })())
    if (moveramJunto) continue
    lista = lista.map((d) => (desc.has(d.id) ? ({ ...d, x: d.x + dx, y: d.y + dy } as Camada) : d))
  }

  // 2. tamanho explícito → fixo (texto com largura automática redimensionado vira altura automática etc.)
  let mudou = false
  if (!opcoes.manterDimensionamento && comDimensionamento) {
    lista = lista.map((c) => {
      const a = mapaAntes.get(c.id)
      if (!a) return c
      let n = c
      if (a.width !== c.width && (c.sizingW === 'hug' || c.sizingW === 'fill') && a.sizingW === c.sizingW) n = { ...n, sizingW: 'fixed' } as Camada
      if (a.height !== c.height && (c.sizingH === 'hug' || c.sizingH === 'fill') && a.sizingH === c.sizingH) n = { ...n, sizingH: 'fixed' } as Camada
      if (n !== c) mudou = true
      return n
    })
  }
  if (!comFrames) return mudou ? lista : (depois as Camada[])

  return calcularLayout(normalizarArvore(lista))
}

// ---------- reordenação e inserção ----------

/** Coloca `id` dentro de `frameId` na posição `indice` do fluxo (ou como filho livre de um frame sem auto layout). */
export function inserirNoFrame(camadas: readonly Camada[], id: string, frameId: string | undefined, indice?: number): Camada[] {
  const mapa = mapaDe(camadas)
  const alvo = mapa.get(id)
  if (!alvo) return camadas as Camada[]
  if (frameId && (frameId === id || ancestrais(mapa.get(frameId) ?? alvo, mapa).some((a) => a.id === id))) return camadas as Camada[]
  const irmaos = (frameId ? filhosDe(frameId, camadas) : camadas.filter((c) => !paiDe(c, mapa)).sort((a, b) => a.z - b.z)).filter((c) => c.id !== id)
  const ordem = [...irmaos]
  const fluxo = irmaos.filter((c) => !c.hidden && !c.absolute)
  const i = indice === undefined ? ordem.length : (() => {
    const ref = fluxo[indice]
    return ref ? ordem.indexOf(ref) : fluxo.length ? ordem.indexOf(fluxo[fluxo.length - 1]!) + 1 : ordem.length
  })()
  ordem.splice(i, 0, alvo)
  // só a ordem entre irmãos importa: normalizarArvore agrupa por pai e renumera tudo
  const zs = new Map(ordem.map((c, k) => [c.id, k]))
  const r = camadas.map((c) => {
    const z = zs.get(c.id)
    if (z === undefined) return c
    const n = { ...c, z } as Camada
    if (c.id === id) {
      if (frameId) n.parentId = frameId
      else delete (n as { parentId?: string }).parentId
    }
    return n
  })
  return normalizarArvore(r)
}

export interface Insercao {
  indice: number
  /** Linha azul de inserção em coordenadas da cena. */
  linha: { eixo: 'v' | 'h'; pos: number; de: number; ate: number }
}

/** Índice de inserção no fluxo de um frame com auto layout para um ponto (arrastar para reordenar). */
export function indiceDeInsercao(frame: CamadaFrame, camadas: readonly Camada[], ponto: { x: number; y: number }, ignorar: ReadonlySet<string> = new Set()): Insercao {
  const L = frame.layout ?? LAYOUT_PADRAO
  const itens = filhosNoFluxo(frame.id, camadas).filter((c) => !ignorar.has(c.id))
  const pad = L.padding
  const horizontal = L.direction !== 'vertical'
  if (!itens.length) {
    return horizontal
      ? { indice: 0, linha: { eixo: 'v', pos: frame.x + pad.left, de: frame.y + pad.top, ate: frame.y + frame.height - pad.bottom } }
      : { indice: 0, linha: { eixo: 'h', pos: frame.y + pad.top, de: frame.x + pad.left, ate: frame.x + frame.width - pad.right } }
  }
  let indice = 0
  if (L.direction === 'wrap') {
    for (const c of itens) {
      const mesmaLinha = ponto.y >= c.y && ponto.y <= c.y + c.height
      if (c.y + c.height < ponto.y || (mesmaLinha && c.x + c.width / 2 < ponto.x)) indice++
    }
  } else {
    for (const c of itens) if ((horizontal ? c.x + c.width / 2 : c.y + c.height / 2) < (horizontal ? ponto.x : ponto.y)) indice++
  }
  const ant = itens[indice - 1]
  const prox = itens[indice]
  const meioGap = L.gapAuto ? 0 : L.gap / 2
  if (horizontal) {
    const ref = prox ?? ant!
    const pos = ant && prox && ant.y === prox.y ? (ant.x + ant.width + prox.x) / 2 : prox ? prox.x - meioGap : ant!.x + ant!.width + meioGap
    return { indice, linha: { eixo: 'v', pos, de: ref.y, ate: ref.y + ref.height } }
  }
  const ref = prox ?? ant!
  const pos = ant && prox ? (ant.y + ant.height + prox.y) / 2 : prox ? prox.y - meioGap : ant!.y + ant!.height + meioGap
  return { indice, linha: { eixo: 'h', pos, de: ref.x, ate: ref.x + ref.width } }
}

/** Direção, gap e alinhamento inferidos do arranjo atual (ao envolver uma seleção com ⇧A). */
export function inferirLayout(rects: readonly Retangulo[]): { layout: AutoLayout; ordem: number[] } {
  if (rects.length < 2) return { layout: { ...LAYOUT_PADRAO, gap: 0 }, ordem: rects.map((_, i) => i) }
  const cx = rects.map((r) => r.x + r.width / 2)
  const cy = rects.map((r) => r.y + r.height / 2)
  const horizontal = Math.max(...cx) - Math.min(...cx) >= Math.max(...cy) - Math.min(...cy)
  const ordem = rects.map((_, i) => i).sort((a, b) => (horizontal ? rects[a]!.x - rects[b]!.x : rects[a]!.y - rects[b]!.y))
  const gaps: number[] = []
  for (let k = 1; k < ordem.length; k++) {
    const a = rects[ordem[k - 1]!]!
    const b = rects[ordem[k]!]!
    gaps.push(horizontal ? b.x - (a.x + a.width) : b.y - (a.y + a.height))
  }
  const gap = Math.max(0, Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length))
  // alinhamento no eixo cruzado: o que tiver menor dispersão (início, centro ou fim)
  const disp = (vals: number[]) => Math.max(...vals) - Math.min(...vals)
  const ini = disp(rects.map((r) => (horizontal ? r.y : r.x)))
  const meio = disp(horizontal ? cy : cx)
  const fim = disp(rects.map((r) => (horizontal ? r.y + r.height : r.x + r.width)))
  const alin = meio < ini && meio <= fim ? 'center' : fim < ini ? 'end' : 'start'
  return { layout: { ...LAYOUT_PADRAO, direction: horizontal ? 'horizontal' : 'vertical', gap, alignX: horizontal ? 'start' : alin, alignY: horizontal ? alin : 'start' }, ordem }
}

/**
 * Painel de camadas: solta `id` acima/abaixo de `alvoId` (mesmo pai do alvo) ou dentro do frame `alvoId`.
 * "Acima" na lista = z maior (depois no fluxo do auto layout).
 */
export function moverNaLista(camadas: readonly Camada[], id: string, alvoId: string, onde: 'acima' | 'abaixo' | 'dentro'): Camada[] {
  const mapa = mapaDe(camadas)
  const alvo = mapa.get(alvoId)
  const item = mapa.get(id)
  if (!alvo || !item || id === alvoId) return camadas as Camada[]
  if (onde === 'dentro') return alvo.type === 'frame' ? inserirNoFrame(camadas, id, alvo.id) : (camadas as Camada[])
  const paiId = paiDe(alvo, mapa)?.id
  if (paiId && (paiId === id || ancestrais(mapa.get(paiId)!, mapa).some((a) => a.id === id))) return camadas as Camada[]
  const irmaos = (paiId ? filhosDe(paiId, camadas) : camadas.filter((c) => !paiDe(c, mapa)).sort((a, b) => a.z - b.z)).filter((c) => c.id !== id)
  const i = irmaos.findIndex((c) => c.id === alvoId)
  irmaos.splice(onde === 'acima' ? i + 1 : i, 0, item)
  const zs = new Map(irmaos.map((c, k) => [c.id, k]))
  return normalizarArvore(
    camadas.map((c) => {
      const z = zs.get(c.id)
      if (z === undefined) return c
      const n = { ...c, z } as Camada
      if (c.id === id) {
        if (paiId) n.parentId = paiId
        else delete (n as { parentId?: string }).parentId
      }
      return n
    })
  )
}
