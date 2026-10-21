/**
 * Mensagem do Figma (nodeChanges) → camadas da Mostra.
 *
 * 1. Monta a árvore (parentIndex.guid + position) e expande instâncias de componentes a partir do SYMBOL que
 *    vem junto na cópia, aplicando overrides (symbolOverrides), propriedades (componentPropAssignments) e o
 *    layout derivado (derivedSymbolData).
 * 2. Compõe as transformações até cada nó (posição/rotação absolutas) e escolhe a camada:
 *    - TEXT → `text` (fonte, tamanho, peso, itálico, entrelinha, espaçamento, alinhamentos, cor/gradiente,
 *      caixa alta/baixa, sublinhado). Estilos mistos: divide por parágrafo ou por trecho de linha usando o
 *      layout calculado pelo Figma (baselines e glifos), para manter o visual.
 *    - retângulo/elipse simples → `shape` (cor ou gradiente linear, raio, contorno interno, sombra, desfoque).
 *    - imagem → `image` (se a cópia trouxer os bytes) ou um marcador listrado do mesmo tamanho.
 *    - vetores, booleanas, estrelas, polígonos, linhas, ícones (frames/grupos só com vetores) e formas que a
 *      `shape` não representa → `svg` desenhado a partir da geometria.
 *    - frames/grupos → fundo (se tiver) + filhos, agrupados por `groupId` na raiz colada.
 * 3. Centraliza a seleção no ponto de colagem (ou no centro da tela) mantendo o tamanho; só reduz se não couber.
 *
 * Puro: devolve objetos de camada ainda sem validação; o editor sanitiza SVG, envia imagens e valida.
 */
import { FONTES_APRESENTACAO } from '@/lib/design-tokens'
import type { Gradiente } from '@/lib/scene/schema'
import { DocSvg, TIPOS_VETORIAIS, bytesDaImagem, caixaNo, corHex, desenharNo, efeitosVisiveis, ehContainer, montarSvg, pinturasVisiveis, raiosDe, recorta, tamanho, visivel, type Contexto, type No } from './desenho'
import { IDENTIDADE, aplicar, decompor, deFigma, expandir, intersecao, multiplicar, transformarCaixa, uniao, type Caixa, type M } from './geometria'
import type { Baseline, DadosTexto, GUID, MensagemFigma, NodeChange, Numero, Paint, ValorPropriedade } from './tipos'

export interface OpcoesConversao {
  cena: { width: number; height: number }
  /** Centro desejado (coordenadas da tela). Padrão: centro da tela. */
  ponto?: { x: number; y: number }
  /** Achata em SVG todo frame/grupo sem texto (usado quando a seleção tem camadas demais). */
  compacto?: boolean
}

export interface CamadaConvertida {
  /** Objeto de camada da Mostra (antes de parseCamada). SVG já vem montado em `markup`. */
  camada: Record<string, unknown> & { type: string; id: string }
  /** Bytes da imagem quando a cópia os traz; o editor envia e preenche `assetId`. */
  imagem?: { bytes: Uint8Array; mime: string }
  /** Marcador de imagem cujo arquivo não veio na cópia. */
  imagemFaltando?: boolean
}

export interface ResultadoConversao {
  camadas: CamadaConvertida[]
  avisos: string[]
  imagensFaltando: number
  fontesAusentes: string[]
  escala: number
  nomes: string[]
}

// ---------- árvore ----------

const chave = (g: GUID | undefined) => `${g?.sessionID ?? 0}:${g?.localID ?? 0}`
const CAMPOS_FIXOS = new Set(['guid', 'guidPath', 'parentIndex', 'overrideKey', 'phase', 'type'])

function mesclar(base: NodeChange, o: NodeChange): NodeChange {
  const r: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(o)) if (!CAMPOS_FIXOS.has(k) && v !== undefined) r[k] = v
  // texto trocado sem layout novo: o layout antigo não vale mais
  if (o.textData && !o.derivedTextData) delete r.derivedTextData
  return r as NodeChange
}

interface Entrada {
  caminho: string[]
  nc: NodeChange
}

interface CtxInstancia {
  overrides: Entrada[]
  derivados: Entrada[]
  props: Map<string, ValorPropriedade>
  pilha: Set<string>
}

const entradas = (lista: NodeChange[] | undefined): Entrada[] => (lista ?? []).filter((o) => o.guidPath?.guids?.length).map((o) => ({ caminho: o.guidPath!.guids!.map(chave), nc: o }))

function aplicarProps(nc: NodeChange, props: Map<string, ValorPropriedade>): NodeChange {
  if (!nc.componentPropRefs?.length || !props.size) return nc
  let r = nc
  for (const ref of nc.componentPropRefs) {
    if (ref.isDeleted) continue
    const v = props.get(chave(ref.defID))
    if (!v) continue
    if (ref.componentPropNodeField === 'VISIBLE' && v.boolValue !== undefined) r = { ...r, visible: v.boolValue }
    else if (ref.componentPropNodeField === 'TEXT_DATA' && v.textValue) r = mesclar(r, { textData: v.textValue })
    else if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID' && v.guidValue) r = { ...r, overriddenSymbolID: v.guidValue }
  }
  return r
}

class Arvore {
  porGuid = new Map<string, NodeChange>()
  filhosDe = new Map<string, NodeChange[]>()

  constructor(msg: MensagemFigma) {
    for (const nc of msg.nodeChanges ?? []) {
      if (!nc.guid) continue
      this.porGuid.set(chave(nc.guid), nc)
      if (nc.parentIndex?.guid) {
        const k = chave(nc.parentIndex.guid)
        const l = this.filhosDe.get(k) ?? []
        l.push(nc)
        this.filhosDe.set(k, l)
      }
    }
    for (const l of this.filhosDe.values()) l.sort((a, b) => ((a.parentIndex?.position ?? '') < (b.parentIndex?.position ?? '') ? -1 : (a.parentIndex?.position ?? '') > (b.parentIndex?.position ?? '') ? 1 : 0))
  }

  filhos(g: GUID | undefined): NodeChange[] {
    return this.filhosDe.get(chave(g)) ?? []
  }

  /** Nós colados (de baixo para cima). */
  raizes(msg: MensagemFigma): NodeChange[] {
    const sel = (msg.clipboardSelectionRegions ?? []).flatMap((r) => r.nodes ?? []).map((g) => this.porGuid.get(chave(g))).filter((n): n is NodeChange => !!n)
    if (sel.length) return ordenarIrmaos(sel)
    const paginas = [...this.porGuid.values()].filter((n) => n.type === 'CANVAS' && !n.internalOnly)
    const r = paginas.flatMap((p) => this.filhos(p.guid))
    if (r.length) return r
    return [...this.porGuid.values()].filter((n) => n.type !== 'DOCUMENT' && n.type !== 'CANVAS' && !this.porGuid.has(chave(n.parentIndex?.guid)))
  }

  construir(nc: NodeChange, ctx: CtxInstancia | null, prof = 0): No | null {
    if (prof > 60) return null
    let n = nc
    let k = chave(nc.guid)
    if (ctx) {
      const chaves = [k, nc.overrideKey ? chave(nc.overrideKey) : null].filter((x): x is string => !!x)
      const casa = (e: Entrada) => e.caminho.length === 1 && chaves.includes(e.caminho[0]!)
      n = aplicarProps(n, ctx.props)
      for (const e of ctx.overrides) if (casa(e)) n = mesclar(n, e.nc)
      for (const e of ctx.derivados) if (casa(e)) n = mesclar(n, e.nc)
      k = chaves.find((c) => ctx.overrides.some((e) => e.caminho[0] === c) || ctx.derivados.some((e) => e.caminho[0] === c)) ?? k
    }
    if (n.type === 'INSTANCE') return this.instancia(n, ctx, k, prof)
    const filhos = this.filhos(nc.guid)
      .map((f) => this.construir(f, ctx, prof + 1))
      .filter((f): f is No => !!f)
    return { nc: n, filhos }
  }

  private instancia(nc: NodeChange, pai: CtxInstancia | null, k: string, prof: number): No {
    const idSimbolo = nc.overriddenSymbolID ?? nc.symbolData?.symbolID
    const sk = chave(idSimbolo)
    const simbolo = idSimbolo ? this.porGuid.get(sk) : undefined
    const herdar = (l: Entrada[]) => l.filter((e) => e.caminho.length > 1 && e.caminho[0] === k).map((e) => ({ caminho: e.caminho.slice(1), nc: e.nc }))
    const ctx: CtxInstancia = {
      overrides: [...entradas(nc.symbolData?.symbolOverrides), ...(pai ? herdar(pai.overrides) : [])],
      derivados: [...entradas(nc.derivedSymbolData), ...(pai ? herdar(pai.derivados) : [])],
      props: new Map((nc.componentPropAssignments ?? []).filter((a) => a.defID && a.value).map((a) => [chave(a.defID), a.value!])),
      pilha: new Set([...(pai?.pilha ?? []), sk]),
    }
    let origem: NodeChange[] = []
    if (simbolo && !pai?.pilha.has(sk)) origem = this.filhos(simbolo.guid)
    else origem = this.filhos(nc.guid)
    const filhos = origem.map((f) => this.construir(f, ctx, prof + 1)).filter((f): f is No => !!f)
    return { nc, filhos }
  }
}

function ordenarIrmaos(l: NodeChange[]): NodeChange[] {
  return [...l].sort((a, b) => ((a.parentIndex?.position ?? '') < (b.parentIndex?.position ?? '') ? -1 : 1))
}

// ---------- análise ----------

interface Analise {
  texto: boolean
  imagem: boolean
  vetorial: boolean
  mascara: boolean
}

const cacheAnalise = new WeakMap<No, Analise>()
function analisar(no: No): Analise {
  const c = cacheAnalise.get(no)
  if (c) return c
  const nc = no.nc
  const a: Analise = {
    texto: nc.type === 'TEXT',
    imagem: pinturasVisiveis(nc.fillPaints).some((p) => p.type === 'IMAGE') || pinturasVisiveis(nc.strokePaints).some((p) => p.type === 'IMAGE'),
    vetorial: TIPOS_VETORIAIS.has(nc.type ?? '') || (nc.type === 'ELLIPSE' && !!nc.arcData && ((nc.arcData.innerRadius ?? 0) > 0 || Math.abs((nc.arcData.endingAngle ?? Math.PI * 2) - (nc.arcData.startingAngle ?? 0)) < Math.PI * 2 - 1e-3)),
    mascara: !!nc.mask,
  }
  for (const f of no.filhos) {
    if (!visivel(f.nc)) continue
    const af = analisar(f)
    a.texto ||= af.texto
    a.imagem ||= af.imagem
    a.vetorial ||= af.vetorial
    a.mascara ||= af.mascara
  }
  cacheAnalise.set(no, a)
  return a
}

// ---------- camadas internas ----------

interface Geom {
  x: number
  y: number
  w: number
  h: number
  rotacao: number
  espelhoX: boolean
}

interface Interna extends Geom {
  props: Record<string, unknown> & { type: string }
  opacidade: number
  raiz: number
  svg?: { conteudo: string; doc: DocSvg; vb: Caixa; extra?: M }
  imagem?: { bytes: Uint8Array; mime: string }
  imagemFaltando?: boolean
}

interface Estado {
  W: M
  opacidade: number
  recorte: Caixa | null
  raiz: number
}

function normalizarAngulo(a: number): number {
  let r = a % 360
  if (r > 180) r -= 360
  if (r <= -180) r += 360
  return Math.abs(r) < 1e-3 ? 0 : r
}

/** Caixa local transformada por W → geometria de camada (centro preservado, rotação em torno do centro). */
function colocar(W: M, c: Caixa): Geom | null {
  const d = decompor(W)
  if (!d.ortogonal) return null
  const centro = aplicar(W, c.x + c.w / 2, c.y + c.h / 2)
  const w = c.w * d.sx
  const h = c.h * d.sy
  return { x: centro.x - w / 2, y: centro.y - h / 2, w, h, rotacao: normalizarAngulo(d.rotacao), espelhoX: d.espelhoX }
}

const MESCLAGEM: Record<string, string> = { MULTIPLY: 'multiply', SCREEN: 'screen', OVERLAY: 'overlay', DARKEN: 'darken', LIGHTEN: 'lighten', COLOR_DODGE: 'color-dodge', DIFFERENCE: 'difference', LUMINOSITY: 'luminosity' }

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// ---------- gradiente CSS (camadas shape/text) ----------

/** Gradiente linear do Figma → formato da Mostra (ângulo CSS + paradas reprojetadas). null se não couber. */
export function gradienteCss(p: Paint, w: number, h: number, forcar = false): Gradiente | null {
  const stops = p.stops ?? []
  if (p.type !== 'GRADIENT_LINEAR' || stops.length < 2 || stops.length > 8 || w <= 0 || h <= 0) return null
  const T = deFigma(p.transform)
  // coordenada do gradiente gx = T.a·(x/w) + T.c·(y/h) + T.e → gradiente em px
  const gx = T.a / w
  const gy = T.c / h
  const mod = Math.hypot(gx, gy)
  if (mod < 1e-9) return null
  const ux = gx / mod
  const uy = gy / mod
  const ang = (((Math.atan2(ux, -uy) * 180) / Math.PI) % 360 + 360) % 360
  const L = Math.abs(w * ux) + Math.abs(h * uy)
  const cu = (w / 2) * ux + (h / 2) * uy
  const op = p.opacity ?? 1
  const saida: Gradiente['stops'] = []
  for (const s of stops) {
    const t = ((((s.position ?? 0) - T.e) / mod - cu) / L + 0.5) * 100
    if (!forcar && (t < -0.5 || t > 100.5)) return null
    saida.push({ color: corHex(s.color, op), pos: Math.round(limitar(t, 0, 100) * 100) / 100 })
  }
  return { type: 'linear', angle: Math.round(ang * 100) / 100, stops: saida }
}

// ---------- efeitos de camada ----------

function efeitosCamada(nc: NodeChange, ctx: Contexto, permitirSombra = true): { effects?: Record<string, unknown>; complexo: boolean } {
  const efs = efeitosVisiveis(nc.effects)
  const drops = efs.filter((e) => e.type === 'DROP_SHADOW')
  const complexo = efs.some((e) => e.type === 'INNER_SHADOW') || drops.length > 1
  const effects: Record<string, unknown> = {}
  const d = drops[0]
  if (d && permitirSombra) effects.shadow = { x: limitar(d.offset?.x ?? 0, -200, 200), y: limitar(d.offset?.y ?? 0, -200, 200), blur: limitar(d.radius ?? 0, 0, 300), spread: limitar(d.spread ?? 0, -100, 100), color: corHex(d.color) }
  const blur = efs.find((e) => e.type === 'FOREGROUND_BLUR')
  if (blur) effects.blur = limitar((blur.radius ?? 0) / 2, 0, 100)
  const fundo = efs.find((e) => e.type === 'BACKGROUND_BLUR')
  if (fundo) effects.backdropBlur = limitar((fundo.radius ?? 0) / 2, 0, 100)
  const modo = nc.blendMode && nc.blendMode !== 'NORMAL' && nc.blendMode !== 'PASS_THROUGH' ? MESCLAGEM[nc.blendMode] : undefined
  if (modo) effects.blend = modo
  else if (nc.blendMode && nc.blendMode !== 'NORMAL' && nc.blendMode !== 'PASS_THROUGH') ctx.avisos.add('Alguns modos de mesclagem do Figma não existem na Mostra e viraram "normal".')
  return { effects: Object.keys(effects).length ? effects : undefined, complexo }
}

// ---------- forma simples ----------

function formaSimples(nc: NodeChange, forma: 'rect' | 'ellipse', ctx: Contexto): Record<string, unknown> | null {
  const fills = pinturasVisiveis(nc.fillPaints)
  if (fills.length > 1) return null
  const { w, h } = tamanho(nc)
  const props: Record<string, unknown> = { type: 'shape', shape: forma, fill: '#00000000' }
  const f = fills[0]
  if (f) {
    if (f.type === 'SOLID') props.fill = corHex(f.color, f.opacity ?? 1)
    else {
      const g = gradienteCss(f, w, h)
      if (!g) return null
      props.gradient = g
      props.fill = g.stops[0]!.color
    }
  }
  const tracos = pinturasVisiveis(nc.strokePaints)
  const peso = nc.strokeWeight ?? 0
  if (tracos.length > 1) return null
  const t = tracos[0]
  if (t && peso > 0) {
    if (t.type !== 'SOLID' || nc.strokeAlign !== 'INSIDE' || nc.borderStrokeWeightsIndependent || nc.dashPattern?.length || peso > 100) return null
    props.stroke = corHex(t.color, t.opacity ?? 1)
    props.strokeWidth = peso
  }
  if (forma === 'rect') {
    Object.assign(props, propsRaios(raiosDe(nc), w, h))
  } else if (nc.arcData && ((nc.arcData.innerRadius ?? 0) > 0 || Math.abs((nc.arcData.endingAngle ?? Math.PI * 2) - (nc.arcData.startingAngle ?? 0)) < Math.PI * 2 - 1e-3)) return null
  const ef = efeitosCamada(nc, ctx)
  if (ef.complexo) return null
  if (ef.effects) props.effects = ef.effects
  return props
}

/** Raio único (`radius`) ou cantos independentes (`radii`, com `radius` = maior canto para renderizadores antigos). */
export function propsRaios(r: readonly [number, number, number, number], w: number, h: number): { radius: number; radii?: [number, number, number, number] } {
  const max = Math.min(w, h) / 2
  const c = r.map((x) => r2(limitar(Math.min(x, max), 0, 999))) as [number, number, number, number]
  if (c.every((x) => Math.abs(x - c[0]) <= 0.01)) return { radius: c[0] }
  return { radius: Math.max(...c), radii: c }
}

// ---------- texto ----------

interface EstiloTexto {
  familia: string
  estilo: string
  tamanho: number
  peso: number
  italico: boolean
  pinturas: Paint[]
  decoracao: string
  caso: string
  espacamento?: Numero
  alturaLinha?: Numero
}

const PESOS: [RegExp, number][] = [
  [/(hairline|thin)/i, 100],
  [/(extra|ultra)[\s-]?light/i, 200],
  [/light/i, 300],
  [/(semi|demi)[\s-]?bold/i, 600],
  [/(extra|ultra)[\s-]?bold/i, 800],
  [/(black|heavy)/i, 900],
  [/bold/i, 700],
  [/medium/i, 500],
]

export function pesoDoEstilo(estilo: string): number {
  for (const [re, p] of PESOS) if (re.test(estilo)) return p
  return 400
}

function resolverEstilo(base: NodeChange, ov: NodeChange | undefined, dados: DadosTexto | undefined): EstiloTexto {
  const n = ov ? mesclar(base, ov) : base
  const familia = n.fontName?.family || 'Inter'
  const estilo = n.fontName?.style || 'Regular'
  const meta = (base.derivedTextData?.fontMetaData ?? dados?.fontMetaData ?? []).find((m) => m.key?.family === familia && m.key?.style === estilo)
  return {
    familia,
    estilo,
    tamanho: n.fontSize ?? 12,
    peso: limitar(Math.round((meta?.fontWeight ?? pesoDoEstilo(estilo)) / 100) * 100, 100, 900),
    italico: /italic|oblique/i.test(estilo) || meta?.fontStyle === 'ITALIC',
    pinturas: pinturasVisiveis(n.fillPaints),
    decoracao: n.textDecoration ?? 'NONE',
    caso: n.textCase ?? 'ORIGINAL',
    espacamento: n.letterSpacing,
    alturaLinha: n.lineHeight,
  }
}

const chaveEstilo = (e: EstiloTexto) => JSON.stringify([e.familia, e.estilo, e.tamanho, e.decoracao, e.caso, e.espacamento, e.pinturas.map((p) => [p.type, p.color, p.opacity, p.stops])])

function alturaLinhaRelativa(e: EstiloTexto, linhas: Baseline[] | undefined, fontLineHeight?: number): number {
  const l = linhas?.[0]?.lineHeight
  if (l && e.tamanho) return limitar(l / e.tamanho, 0.6, 3)
  const a = e.alturaLinha
  if (!a || a.value === undefined) return 1.2
  if (a.units === 'RAW') return limitar(a.value, 0.6, 3)
  if (a.units === 'PIXELS') return limitar(a.value / (e.tamanho || 1), 0.6, 3)
  if (a.value === 100) return limitar(fontLineHeight ?? 1.2, 0.6, 3)
  return limitar(a.value / 100, 0.6, 3)
}

function propsDeEstilo(e: EstiloTexto, w: number, h: number, ctx: Contexto, fontes: Set<string>): Record<string, unknown> {
  const props: Record<string, unknown> = {
    fontFamily: e.familia.slice(0, 80),
    fontSize: e.tamanho,
    fontWeight: e.peso,
    italic: e.italico,
    underline: e.decoracao === 'UNDERLINE',
    transform: e.caso === 'UPPER' ? 'uppercase' : e.caso === 'LOWER' ? 'lowercase' : 'none',
    letterSpacing: limitar(e.espacamento?.units === 'PIXELS' ? (e.espacamento.value ?? 0) : ((e.espacamento?.value ?? 0) / 100) * e.tamanho, -100, 100),
  }
  if (e.decoracao === 'STRIKETHROUGH') ctx.avisos.add('Texto riscado não existe na Mostra e ficou sem o risco.')
  if (e.caso === 'TITLE' || e.caso.startsWith('SMALL_CAPS')) ctx.avisos.add('Caixa de título e versalete do Figma ficaram como o texto original.')
  if (!(FONTES_APRESENTACAO as readonly string[]).includes(e.familia)) fontes.add(e.familia)
  const p = e.pinturas[e.pinturas.length - 1]
  if (!p) props.color = '#00000000'
  else if (p.type === 'SOLID') props.color = corHex(p.color, p.opacity ?? 1)
  else if (p.type === 'GRADIENT_LINEAR') {
    const g = gradienteCss(p, w, h, true)
    props.color = corHex(p.stops?.[0]?.color, p.opacity ?? 1)
    if (g) props.gradient = g
  } else {
    props.color = corHex(p.stops?.[0]?.color ?? { r: 0.1, g: 0.1, b: 0.1, a: 1 }, p.opacity ?? 1)
    ctx.avisos.add('Textos com gradiente radial ou imagem ficaram com cor sólida.')
  }
  return props
}

interface PedacoTexto {
  texto: string
  caixa: Caixa
  props: Record<string, unknown>
}

function textoParaPedacos(nc: NodeChange, ctx: Contexto, fontes: Set<string>): PedacoTexto[] {
  const dados = nc.textData
  const chars = dados?.characters ?? ''
  if (!chars.trim()) return []
  const { w, h } = tamanho(nc)
  const der = nc.derivedTextData ?? dados
  const linhas = der?.baselines?.length ? der.baselines : undefined
  const glifos = [...(der?.glyphs ?? [])].sort((a, b) => (a.firstCharacter ?? 0) - (b.firstCharacter ?? 0))
  const tabela = new Map((dados?.styleOverrideTable ?? []).map((o) => [o.styleID ?? -1, o]))
  const ids = dados?.characterStyleIDs ?? []
  const estiloBase = resolverEstilo(nc, undefined, dados)
  const cache = new Map<number, EstiloTexto>()
  const estiloDe = (i: number) => {
    const id = ids[i] ?? 0
    if (!id || !tabela.has(id)) return estiloBase
    let e = cache.get(id)
    if (!e) cache.set(id, (e = resolverEstilo(nc, tabela.get(id), dados)))
    return e
  }
  const metaLinha = (der?.fontMetaData ?? []).find((m) => m.key?.family === estiloBase.familia)?.fontLineHeight
  const alinhamento = ({ CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' } as Record<string, string>)[nc.textAlignHorizontal ?? ''] ?? 'left'
  const vertical = ({ CENTER: 'middle', BOTTOM: 'bottom' } as Record<string, string>)[nc.textAlignVertical ?? ''] ?? 'top'
  const autoLargura = nc.textAutoResize === 'WIDTH_AND_HEIGHT'

  // trechos de mesmo estilo
  const runs: { a: number; b: number; e: EstiloTexto }[] = []
  for (let i = 0; i < chars.length; i++) {
    const e = estiloDe(i)
    const ult = runs[runs.length - 1]
    if (ult && chaveEstilo(ult.e) === chaveEstilo(e)) ult.b = i + 1
    else runs.push({ a: i, b: i + 1, e })
  }
  const visiveis = runs.filter((r) => chars.slice(r.a, r.b).trim())
  const uniforme = new Set(visiveis.map((r) => chaveEstilo(r.e))).size <= 1

  const folga = (larg: number, tam: number) => Math.max(4, larg * 0.03, tam * 0.25)
  const pedacoInteiro = (e: EstiloTexto): PedacoTexto => {
    const caixa: Caixa = { x: 0, y: 0, w, h }
    let valign = vertical
    if (linhas) {
      // usa as linhas como o Figma as posicionou: com "corte de entrelinha" (leading trim) ou texto que transborda,
      // a caixa do nó é menor que as linhas e a Mostra cortaria/deslocaria o texto
      const y0 = Math.min(...linhas.map((l) => l.lineY ?? 0))
      const y1 = Math.max(...linhas.map((l) => (l.lineY ?? 0) + (l.lineHeight ?? e.tamanho * 1.2)))
      if (y0 < -0.5 || y1 > h + 0.5) {
        caixa.y = y0
        caixa.h = y1 - y0
        valign = 'top'
      }
    }
    if (autoLargura) {
      const f = folga(w, e.tamanho)
      caixa.w += f
      if (alinhamento === 'center') caixa.x -= f / 2
      else if (alinhamento === 'right') caixa.x -= f
    }
    if (nc.textAutoResize === 'HEIGHT' || autoLargura) caixa.h += Math.max(2, e.tamanho * 0.1)
    return { texto: chars, caixa, props: { ...propsDeEstilo(e, w, h, ctx, fontes), align: alinhamento, valign, lineHeight: alturaLinhaRelativa(e, linhas, metaLinha) } }
  }

  if (uniforme) return [pedacoInteiro(visiveis[0]?.e ?? estiloBase)]

  // estilo por parágrafo?
  if (linhas) {
    const paragrafos: { a: number; b: number }[] = []
    let ini = 0
    for (let i = 0; i <= chars.length; i++) {
      if (i === chars.length || chars[i] === '\n') {
        paragrafos.push({ a: ini, b: i })
        ini = i + 1
      }
    }
    const porParagrafo = paragrafos.every((p) => new Set(runs.filter((r) => r.b > p.a && r.a < p.b && chars.slice(Math.max(r.a, p.a), Math.min(r.b, p.b)).trim()).map((r) => chaveEstilo(r.e))).size <= 1)
    if (porParagrafo) {
      const out: PedacoTexto[] = []
      for (const p of paragrafos) {
        const texto = chars.slice(p.a, p.b)
        if (!texto.trim()) continue
        const ls = linhas.filter((l) => (l.firstCharacter ?? 0) >= p.a && (l.firstCharacter ?? 0) <= Math.max(p.a, p.b - 1))
        if (!ls.length) continue
        const e = estiloDe(p.a + texto.search(/\S/))
        const y0 = Math.min(...ls.map((l) => l.lineY ?? 0))
        const y1 = Math.max(...ls.map((l) => (l.lineY ?? 0) + (l.lineHeight ?? e.tamanho * 1.2)))
        const caixa: Caixa = { x: 0, y: y0, w, h: y1 - y0 + Math.max(2, e.tamanho * 0.1) }
        if (autoLargura) {
          const f = folga(w, e.tamanho)
          caixa.w += f
          if (alinhamento === 'center') caixa.x -= f / 2
          else if (alinhamento === 'right') caixa.x -= f
        }
        out.push({ texto, caixa, props: { ...propsDeEstilo(e, w, h, ctx, fontes), align: alinhamento, valign: 'top', lineHeight: alturaLinhaRelativa(e, ls, metaLinha) } })
      }
      if (out.length) return out
    }
  }

  // estilos dentro da linha: um pedaço por trecho de linha, na posição exata calculada pelo Figma
  if (linhas && glifos.length) {
    const out: PedacoTexto[] = []
    const xDe = (i: number, l: Baseline) => {
      const g = glifos.find((x) => (x.firstCharacter ?? 0) >= i && (x.firstCharacter ?? 0) < (l.endCharacter ?? chars.length))
      return g?.position?.x ?? (l.position?.x ?? 0) + (l.width ?? 0)
    }
    const base0 = linhas[0]!
    const fs0 = estiloBase.tamanho || 12
    // calibra onde o navegador põe a linha de base: baseline = topo + L/2 + k·fs
    const k = ((base0.position?.y ?? 0) - (base0.lineY ?? 0) - (base0.lineHeight ?? fs0 * 1.2) / 2) / fs0
    for (const l of linhas) {
      const la = l.firstCharacter ?? 0
      const lb = l.endCharacter ?? chars.length
      for (const r of runs) {
        let a = Math.max(r.a, la)
        const b = Math.min(r.b, lb)
        if (b <= a) continue
        while (a < b && /\s/.test(chars[a]!)) a++
        const texto = chars.slice(a, b).replace(/\s+$/, '')
        if (!texto) continue
        const x0 = xDe(a, l)
        const x1 = b >= lb ? (l.position?.x ?? 0) + (l.width ?? 0) : xDe(b, l)
        const L = l.lineHeight ?? r.e.tamanho * 1.2
        const topo = (l.position?.y ?? 0) - L / 2 - k * r.e.tamanho
        const larg = Math.max(1, x1 - x0)
        out.push({ texto, caixa: { x: x0, y: topo, w: larg + folga(larg, r.e.tamanho), h: L }, props: { ...propsDeEstilo(r.e, w, h, ctx, fontes), align: 'left', valign: 'top', lineHeight: limitar(L / (r.e.tamanho || 1), 0.6, 3) } })
      }
    }
    if (out.length && out.length <= 80) {
      ctx.avisos.add('Textos com estilos mistos foram divididos em partes para manter o visual do Figma.')
      return out
    }
  }

  // fallback: estilo predominante
  const contagem = new Map<string, { n: number; e: EstiloTexto }>()
  for (const r of visiveis) {
    const c = contagem.get(chaveEstilo(r.e)) ?? { n: 0, e: r.e }
    c.n += r.b - r.a
    contagem.set(chaveEstilo(r.e), c)
  }
  const dominante = [...contagem.values()].sort((a, b) => b.n - a.n)[0]?.e ?? estiloBase
  ctx.avisos.add('Partes de texto com estilo diferente ficaram com o estilo principal.')
  return [pedacoInteiro(dominante)]
}

// ---------- conversão ----------

class Conversor {
  saida: Interna[] = []
  fontes = new Set<string>()
  constructor(
    private ctx: Contexto,
    private compacto: boolean
  ) {}

  private empurrar(i: Interna, est: Estado, nc: NodeChange) {
    if (est.recorte) {
      const alinhada = Math.abs(i.rotacao) < 0.01
      const mundo = caixaGirada(i)
      const inter = intersecao(mundo, est.recorte)
      if (!inter) return // totalmente fora do frame: no Figma não aparece
      const parcial = inter.w < mundo.w - 0.5 || inter.h < mundo.h - 0.5
      if (parcial) {
        if (alinhada && i.svg && !i.svg.extra) {
          const sx = i.svg.vb.w / i.w
          const sy = i.svg.vb.h / i.h
          const dx = i.espelhoX ? i.x + i.w - (inter.x + inter.w) : inter.x - i.x
          i.svg.vb = { x: i.svg.vb.x + dx * sx, y: i.svg.vb.y + (inter.y - i.y) * sy, w: inter.w * sx, h: inter.h * sy }
          Object.assign(i, { x: inter.x, y: inter.y, w: inter.w, h: inter.h })
        } else if (alinhada && (i.props.type === 'shape' || i.props.type === 'image')) {
          Object.assign(i, { x: inter.x, y: inter.y, w: inter.w, h: inter.h })
          if (i.props.type === 'image') i.props.fit = 'cover'
        } else this.ctx.avisos.add('O recorte de alguns frames foi aproximado (a Mostra não recorta grupos).')
      }
    }
    i.props.name ??= (nc.name ?? '').slice(0, 80) || undefined
    this.saida.push(i)
  }

  private interna(props: Interna['props'], g: Geom, est: Estado, extra: Partial<Interna> = {}): Interna {
    return { ...g, props, opacidade: est.opacidade, raiz: est.raiz, ...extra }
  }

  /** Nó (e filhos) desenhado como uma camada SVG. */
  svg(no: No, est: Estado, W: M) {
    const nc = no.nc
    const doc = new DocSvg()
    const conteudo = desenharNo(no, doc, this.ctx, false)
    if (!conteudo) return
    let vb = caixaNo(no, this.ctx)
    if (!vb) return
    if (vb.w < 1) vb = { ...vb, x: vb.x - (1 - vb.w) / 2, w: 1 }
    if (vb.h < 1) vb = { ...vb, y: vb.y - (1 - vb.h) / 2, h: 1 }
    const ef = efeitosCamada(nc, this.ctx, false)
    const props: Interna['props'] = { type: 'svg', fit: 'fill', ...(ef.effects ? { effects: ef.effects } : {}) }
    const g = colocar(W, vb)
    const estN = { ...est, opacidade: est.opacidade * (nc.opacity ?? 1) }
    if (g) this.empurrar(this.interna(props, g, estN, { svg: { conteudo, doc, vb } }), est, nc)
    else {
      const mundo = transformarCaixa(W, vb)
      this.empurrar(this.interna(props, { ...mundo, rotacao: 0, espelhoX: false }, estN, { svg: { conteudo, doc, vb: mundo, extra: W } }), est, nc)
    }
  }

  /** Preenchimento de imagem: camada de imagem (com bytes) ou marcador listrado. */
  private imagem(nc: NodeChange, p: Paint, est: Estado, W: M, forma: 'rect' | 'ellipse') {
    const { w, h } = tamanho(nc)
    const g = colocar(W, { x: 0, y: 0, w, h })
    if (!g) return false
    const raios = forma === 'rect' ? propsRaios(raiosDe(nc), w, h) : { radius: 0 }
    const ef = efeitosCamada(nc, this.ctx)
    const estN = { ...est, opacidade: est.opacidade * (nc.opacity ?? 1) * (p.opacity ?? 1) }
    const bytes = bytesDaImagem(p, this.ctx)
    if (bytes) {
      const fit = p.imageScaleMode === 'FIT' ? 'contain' : p.imageScaleMode === 'STRETCH' ? 'fill' : 'cover'
      this.empurrar(this.interna({ type: 'image', assetId: 'figma-imagem', fit, ...raios, mask: forma === 'ellipse' ? 'ellipse' : 'none', ...(ef.effects ? { effects: ef.effects } : {}) }, g, estN, { imagem: bytes }), est, nc)
    } else {
      this.ctx.imagensFaltando += 1
      this.empurrar(this.interna({ type: 'shape', shape: forma, fill: '#A3A3A340', pattern: 'stripes', ...raios, name: `Imagem: ${nc.name ?? ''}`.slice(0, 80), ...(ef.effects ? { effects: ef.effects } : {}) }, g, estN, { imagemFaltando: true }), est, nc)
    }
    if (pinturasVisiveis(nc.fillPaints).length > 1) this.ctx.avisos.add('Camadas com imagem e outros preenchimentos ficaram só com a imagem.')
    return true
  }

  /** Retângulo/elipse/fundo de frame. */
  private forma(no: No, est: Estado, W: M, forma: 'rect' | 'ellipse') {
    const nc = no.nc
    const img = pinturasVisiveis(nc.fillPaints).find((p) => p.type === 'IMAGE')
    if (img && this.imagem(nc, img, est, W, forma)) return
    const props = formaSimples(nc, forma, this.ctx)
    const { w, h } = tamanho(nc)
    const g = props ? colocar(W, { x: 0, y: 0, w, h }) : null
    if (props && g && w >= 0.5 && h >= 0.5) {
      this.empurrar(this.interna(props as Interna['props'], { ...g, w: Math.max(1, g.w), h: Math.max(1, g.h) }, { ...est, opacidade: est.opacidade * (nc.opacity ?? 1) }), est, nc)
      return
    }
    this.svg({ nc, filhos: [] }, est, W)
  }

  private texto(no: No, est: Estado, W: M) {
    const nc = no.nc
    const pedacos = textoParaPedacos(nc, this.ctx, this.fontes)
    if (pinturasVisiveis(nc.strokePaints).length && (nc.strokeWeight ?? 0) > 0) this.ctx.avisos.add('Contorno em texto não existe na Mostra e foi ignorado.')
    const ef = efeitosCamada(nc, this.ctx)
    for (const p of pedacos) {
      // O Figma não corta letras que passam da entrelinha (ascendentes/descendentes com entrelinha curta);
      // a caixa de texto da Mostra corta. Um respiro (padding) em volta mantém a posição do texto e evita o corte.
      const fs = p.props.fontSize as number
      const respiro = limitar(Math.ceil(Math.max(2, (1.4 * fs - (p.props.lineHeight as number) * fs) / 2)), 0, 200)
      const caixa = expandir(p.caixa, respiro)
      const g = colocar(W, caixa)
      const d = decompor(W)
      const geo = g ?? { ...transformarCaixa(W, caixa), rotacao: 0, espelhoX: false }
      const escala = g ? d.sy : 1
      const props: Interna['props'] = { type: 'text', text: p.texto.slice(0, 5000), ...p.props, padding: respiro, ...(ef.effects ? { effects: ef.effects } : {}) }
      if (Math.abs(escala - 1) > 1e-3) props.fontSize = (props.fontSize as number) * escala
      this.empurrar(this.interna(props, { ...geo, w: Math.max(1, geo.w), h: Math.max(1, geo.h) }, { ...est, opacidade: est.opacidade * (nc.opacity ?? 1) }), est, nc)
    }
  }

  no(no: No, est: Estado) {
    const nc = no.nc
    if (!visivel(nc)) return
    const W = multiplicar(est.W, deFigma(nc.transform))
    if (nc.mask) {
      // máscara fora de um ícone: a Mostra não mascara camadas soltas
      this.ctx.avisos.add('Máscaras do Figma em frames com texto foram aproximadas.')
      return
    }
    const tipo = nc.type ?? ''
    if (tipo === 'TEXT') return this.texto(no, est, W)
    if (ehContainer(no)) {
      const a = analisar(no)
      if (!a.texto && (this.compacto || (!a.imagem && (a.vetorial || a.mascara)))) return this.svg(no, est, W)
      // fundo do frame
      const temFundo = pinturasVisiveis(nc.fillPaints).length || pinturasVisiveis(nc.strokePaints).length || efeitosVisiveis(nc.effects).length
      if (temFundo) this.forma({ nc: { ...nc, opacity: 1 }, filhos: [] }, { ...est, opacidade: est.opacidade * (nc.opacity ?? 1) }, W, 'rect')
      const { w, h } = tamanho(nc)
      let recorte = est.recorte
      if (recorta(nc)) {
        const d = decompor(W)
        if (Math.abs(d.rotacao) < 0.01 && d.ortogonal) {
          const r = transformarCaixa(W, { x: 0, y: 0, w, h })
          recorte = recorte ? (intersecao(recorte, r) ?? { x: r.x, y: r.y, w: 0, h: 0 }) : r
        }
      }
      const estFilhos: Estado = { W, opacidade: est.opacidade * (nc.opacity ?? 1), recorte, raiz: est.raiz }
      // contorno do frame fica por cima dos filhos no Figma; aqui o fundo leva o contorno (aproximação)
      for (const f of no.filhos) this.no(f, estFilhos)
      return
    }
    if (tipo === 'RECTANGLE' || tipo === 'ROUNDED_RECTANGLE') return this.forma(no, est, W, 'rect')
    if (tipo === 'ELLIPSE') return this.forma(no, est, W, 'ellipse')
    if (TIPOS_VETORIAIS.has(tipo) || nc.fillGeometry?.length || nc.strokeGeometry?.length) return this.svg(no, est, W)
    if (tipo === 'SLICE' || tipo === 'CONNECTOR' || tipo === 'STICKY' || tipo === 'SHAPE_WITH_TEXT' || tipo === 'WIDGET' || tipo === 'STAMP') {
      this.ctx.avisos.add('Elementos do FigJam e fatias de exportação foram ignorados.')
      return
    }
    if (pinturasVisiveis(nc.fillPaints).length) this.forma(no, est, W, 'rect')
  }
}

function caixaGirada(i: Geom): Caixa {
  if (!i.rotacao) return { x: i.x, y: i.y, w: i.w, h: i.h }
  const r = (i.rotacao * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const w = i.w * c + i.h * s
  const h = i.w * s + i.h * c
  return { x: i.x + i.w / 2 - w / 2, y: i.y + i.h / 2 - h / 2, w, h }
}

const r2 = (v: number) => Math.round(v * 100) / 100

function escalarProps(p: Record<string, unknown>, s: number) {
  if (s === 1) return
  for (const k of ['fontSize', 'letterSpacing', 'padding', 'radius', 'strokeWidth', 'dash']) if (typeof p[k] === 'number') p[k] = (p[k] as number) * s
  if (Array.isArray(p.radii)) p.radii = (p.radii as number[]).map((r) => Math.min(999, r * s))
  const ef = p.effects as Record<string, unknown> | undefined
  if (ef) {
    for (const k of ['blur', 'backdropBlur']) if (typeof ef[k] === 'number') ef[k] = (ef[k] as number) * s
    const sh = ef.shadow as Record<string, number> | undefined
    if (sh) for (const k of ['x', 'y', 'blur', 'spread']) if (typeof sh[k] === 'number') sh[k] = sh[k]! * s
  }
}

export function converterMensagem(msg: MensagemFigma, opcoes: OpcoesConversao): ResultadoConversao {
  const base = msg.blobBaseIndex ?? 0
  const ctx: Contexto = {
    blob: (i) => (i === undefined ? null : (msg.blobs?.[i - base]?.bytes ?? null)),
    avisos: new Set(),
    imagensFaltando: 0,
  }
  const arvore = new Arvore(msg)
  const raizesNc = arvore.raizes(msg)
  const conv = new Conversor(ctx, !!opcoes.compacto)
  const nomes: string[] = []
  // caixa da seleção como o Figma mede (caixas dos nós colados, sem sombras nem texto que transborda)
  let caixaSelecao: Caixa | null = null
  raizesNc.forEach((nc, i) => {
    const no = arvore.construir(nc, null)
    if (!no || !visivel(nc)) return
    nomes.push(nc.name ?? '')
    caixaSelecao = uniao(caixaSelecao, transformarCaixa(deFigma(nc.transform), { x: 0, y: 0, w: tamanho(nc).w, h: tamanho(nc).h }))
    // raízes ficam no espaço da página; a posição relativa entre elas é preservada
    conv.no(no, { W: IDENTIDADE, opacidade: 1, recorte: null, raiz: i })
  })
  const internas = conv.saida

  // posicionamento: centro da seleção no ponto (ou centro da tela); reduz só se não couber
  let bbox: Caixa | null = caixaSelecao
  if (!bbox || (bbox as Caixa).w <= 0 || (bbox as Caixa).h <= 0) {
    bbox = null
    for (const i of internas) bbox = uniao(bbox, caixaGirada(i))
  }
  const cena = opcoes.cena
  const escala = bbox && bbox.w > 0 && bbox.h > 0 ? Math.min(1, cena.width / bbox.w, cena.height / bbox.h) : 1
  const alvo = opcoes.ponto ?? { x: cena.width / 2, y: cena.height / 2 }
  const cx = bbox ? bbox.x + bbox.w / 2 : 0
  const cy = bbox ? bbox.y + bbox.h / 2 : 0
  if (escala < 1) ctx.avisos.add(`A seleção era maior que a tela e foi reduzida para ${Math.round(escala * 100)}%.`)

  const porRaiz = new Map<number, number>()
  for (const i of internas) porRaiz.set(i.raiz, (porRaiz.get(i.raiz) ?? 0) + 1)

  const camadas: CamadaConvertida[] = internas.map((i, n) => {
    const props = { ...i.props }
    escalarProps(props, escala)
    if (i.svg) props.markup = montarSvg(i.svg.conteudo, i.svg.doc, i.svg.vb, i.svg.extra)
    const camada: CamadaConvertida['camada'] = {
      ...props,
      id: `figma-${n + 1}`,
      x: r2(alvo.x + (i.x - cx) * escala),
      y: r2(alvo.y + (i.y - cy) * escala),
      width: Math.max(1, r2(i.w * escala)),
      height: Math.max(1, r2(i.h * escala)),
      rotation: r2(i.rotacao),
      opacity: Math.round(limitar(i.opacidade, 0, 1) * 1000) / 1000,
      z: n,
      ...(i.espelhoX ? { flipX: true } : {}),
      ...((porRaiz.get(i.raiz) ?? 0) > 1 ? { groupId: `figmagrupo-${i.raiz + 1}` } : {}),
    }
    if (camada.type === 'text') camada.fontSize = limitar(Math.round((camada.fontSize as number) * 100) / 100, 6, 800)
    return { camada, ...(i.imagem ? { imagem: i.imagem } : {}), ...(i.imagemFaltando ? { imagemFaltando: true } : {}) }
  })

  return { camadas, avisos: [...ctx.avisos], imagensFaltando: ctx.imagensFaltando, fontesAusentes: [...conv.fontes], escala, nomes }
}

