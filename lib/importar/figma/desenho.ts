/**
 * Desenha nós do Figma como SVG (coordenadas locais do nó): preenchimentos sólidos/gradientes/imagens,
 * traços com alinhamento (centro/dentro/fora), cantos, sombras/desfoque como filtros SVG, opacidade,
 * mesclagem, recorte de frames, máscaras e operações booleanas.
 *
 * Usado para vetores, ícones, booleanas, estrelas/polígonos e qualquer forma que a camada `shape` da Mostra
 * não represente com exatidão. O markup sai sem scripts nem referências externas e ainda passa pelo
 * sanitizador antes de virar camada.
 */
import type { CorFigma, Efeito, NodeChange, Paint } from './tipos'
import { deFigma, elipsePath, estrelaPath, expandir, inverter, intersecao, linhaPath, multiplicar, num, poligonoPath, retanguloPath, comandosParaPath, lerRedeVetorial, redeParaPaths, svgMatriz, transformarCaixa, uniao, ehIdentidade, type Caixa, type M } from './geometria'

export interface No {
  nc: NodeChange
  filhos: No[]
}

export interface Contexto {
  blob(indice: number | undefined): Uint8Array | null
  avisos: Set<string>
  imagensFaltando: number
}

export const TIPOS_CONTAINER = new Set(['FRAME', 'GROUP', 'SYMBOL', 'INSTANCE', 'SECTION', 'SLIDE', 'COMPONENT', 'COMPONENT_SET'])
export const TIPOS_VETORIAIS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'REGULAR_POLYGON', 'LINE'])

export function ehContainer(no: No): boolean {
  return TIPOS_CONTAINER.has(no.nc.type ?? '') || (no.filhos.length > 0 && no.nc.type !== 'BOOLEAN_OPERATION')
}

/** Frame recorta o conteúdo? (grupos — FRAME com resizeToFit — nunca recortam) */
export function recorta(nc: NodeChange): boolean {
  return ['FRAME', 'SYMBOL', 'INSTANCE', 'SECTION', 'SLIDE'].includes(nc.type ?? '') && !nc.frameMaskDisabled && !nc.resizeToFit
}

export function visivel(nc: NodeChange): boolean {
  return nc.visible !== false
}

export function tamanho(nc: NodeChange): { w: number; h: number } {
  return { w: Math.max(0, nc.size?.x ?? 0), h: Math.max(0, nc.size?.y ?? 0) }
}

// ---------- cores e pinturas ----------

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')

/** #rrggbb e alfa separados (para fill + fill-opacity, que mantém o recolorir do painel funcionando). */
export function corEAlfa(c: CorFigma | undefined, opacidade = 1): { hex: string; alfa: number } {
  return { hex: `#${hex2(c?.r ?? 0)}${hex2(c?.g ?? 0)}${hex2(c?.b ?? 0)}`, alfa: Math.max(0, Math.min(1, (c?.a ?? 1) * opacidade)) }
}

/** #rrggbb ou #rrggbbaa (formato do schema da Mostra). */
export function corHex(c: CorFigma | undefined, opacidade = 1): string {
  const { hex, alfa } = corEAlfa(c, opacidade)
  return alfa >= 0.999 ? hex : `${hex}${hex2(alfa)}`
}

export function pinturasVisiveis(p: Paint[] | undefined): Paint[] {
  return (p ?? []).filter((x) => x.visible !== false && (x.opacity ?? 1) > 0 && !!x.type)
}

export function efeitosVisiveis(e: Efeito[] | undefined): Efeito[] {
  return (e ?? []).filter((x) => x.visible !== false && !!x.type)
}

export function mimeDeBytes(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp'
  return null
}

/** Bytes da imagem de uma pintura, quando a cópia os traz (normalmente o Figma manda só o hash). */
export function bytesDaImagem(p: Paint, ctx: Contexto): { bytes: Uint8Array; mime: string } | null {
  const b = p.image?.dataBlob !== undefined ? ctx.blob(p.image.dataBlob) : null
  const mime = b ? mimeDeBytes(b) : null
  return b && mime ? { bytes: b, mime } : null
}

function base64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

// ---------- documento SVG ----------

export class DocSvg {
  defs: string[] = []
  private n = 0
  id(p: string): string {
    this.n += 1
    return `${p}${this.n}`
  }
}

/** Atributos de uma pintura sólida/gradiente para `fill` ou `stroke`. Imagem devolve null. */
function atributosPintura(p: Paint, alvo: 'fill' | 'stroke', w: number, h: number, doc: DocSvg, ctx: Contexto): string | null {
  const op = p.opacity ?? 1
  if (p.type === 'SOLID') {
    const { hex, alfa } = corEAlfa(p.color, op)
    return `${alvo}="${hex}"${alfa < 0.999 ? ` ${alvo}-opacity="${num(alfa)}"` : ''}`
  }
  if (p.type?.startsWith('GRADIENT_')) {
    const id = doc.id('g')
    // Paint.transform leva do espaço normalizado do nó (0–1) ao espaço do gradiente; invertemos e esticamos para px
    const g = multiplicar({ a: Math.max(w, 1e-6), b: 0, c: 0, d: Math.max(h, 1e-6), e: 0, f: 0 }, inverter(deFigma(p.transform)))
    const stops = (p.stops ?? []).map((s) => {
      const c = corEAlfa(s.color)
      return `<stop offset="${num(Math.max(0, Math.min(1, s.position ?? 0)))}" stop-color="${c.hex}"${c.alfa < 0.999 ? ` stop-opacity="${num(c.alfa)}"` : ''}/>`
    })
    if (p.type === 'GRADIENT_LINEAR') doc.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform="${svgMatriz(g)}">${stops.join('')}</linearGradient>`)
    else {
      if (p.type === 'GRADIENT_ANGULAR' || p.type === 'GRADIENT_DIAMOND') ctx.avisos.add('Gradientes angulares e em diamante viraram radiais (aproximação).')
      doc.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0.5" cy="0.5" r="0.5" gradientTransform="${svgMatriz(g)}">${stops.join('')}</radialGradient>`)
    }
    return `${alvo}="url(#${id})"${op < 0.999 ? ` ${alvo}-opacity="${num(op)}"` : ''}`
  }
  return null
}

const MESCLAGEM_CSS: Record<string, string> = {
  DARKEN: 'darken',
  MULTIPLY: 'multiply',
  COLOR_BURN: 'color-burn',
  LIGHTEN: 'lighten',
  SCREEN: 'screen',
  COLOR_DODGE: 'color-dodge',
  OVERLAY: 'overlay',
  SOFT_LIGHT: 'soft-light',
  HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity',
  LINEAR_BURN: 'multiply',
  LINEAR_DODGE: 'screen',
}

// ---------- geometria de um nó ----------

export interface Geo {
  fills: { d: string; evenodd: boolean }[]
  tracos: { d: string; evenodd: boolean }[]
  /** Contorno para traço gerado e para recortar traços dentro/fora. */
  base: string | null
  aberto: boolean
  caixa: Caixa | null
}

export function raiosDe(nc: NodeChange): [number, number, number, number] {
  if (nc.rectangleCornerRadiiIndependent) return [nc.rectangleTopLeftCornerRadius ?? 0, nc.rectangleTopRightCornerRadius ?? 0, nc.rectangleBottomRightCornerRadius ?? 0, nc.rectangleBottomLeftCornerRadius ?? 0]
  const r = nc.cornerRadius ?? 0
  return [r, r, r, r]
}

function lerPaths(paths: NodeChange['fillGeometry'], ctx: Contexto): { d: string; evenodd: boolean; caixa: Caixa | null }[] {
  const r: { d: string; evenodd: boolean; caixa: Caixa | null }[] = []
  for (const p of paths ?? []) {
    const b = ctx.blob(p.commandsBlob)
    const c = b ? comandosParaPath(b) : null
    if (c) r.push({ d: c.d, evenodd: p.windingRule === 'ODD' || p.windingRule === 'EVENODD', caixa: c.caixa })
  }
  return r
}

export function geometriaDe(nc: NodeChange, ctx: Contexto): Geo {
  const { w, h } = tamanho(nc)
  const fillsLidos = lerPaths(nc.fillGeometry, ctx)
  const tracosLidos = lerPaths(nc.strokeGeometry, ctx)
  let base: string | null = null
  let aberto = false
  let regioesRede: { d: string; evenodd: boolean }[] = []
  switch (nc.type) {
    case 'ELLIPSE':
      base = elipsePath(w, h, nc.arcData)
      break
    case 'STAR':
      base = estrelaPath(w, h, nc.count ?? 5, nc.starInnerScale ?? 0.382)
      break
    case 'REGULAR_POLYGON':
      base = poligonoPath(w, h, nc.count ?? 3)
      break
    case 'LINE':
      base = linhaPath(w)
      aberto = true
      break
    case 'VECTOR': {
      const b = ctx.blob(nc.vectorData?.vectorNetworkBlob)
      const rede = b ? lerRedeVetorial(b) : null
      if (rede) {
        const ns = nc.vectorData?.normalizedSize
        const p = redeParaPaths(rede, ns?.x ? w / ns.x : 1, ns?.y ? h / ns.y : 1)
        regioesRede = p.regioes.map((r) => ({ d: r.d, evenodd: !r.nonzero }))
        base = p.traco
        aberto = !p.regioes.length
      }
      break
    }
    case 'BOOLEAN_OPERATION':
    case 'TEXT':
      break
    default:
      base = retanguloPath(w, h, raiosDe(nc))
  }
  let fills: { d: string; evenodd: boolean }[] = fillsLidos
  if (!fills.length) fills = regioesRede.length ? regioesRede : base && !aberto && nc.type !== 'VECTOR' ? [{ d: base, evenodd: nc.type === 'ELLIPSE' && (nc.arcData?.innerRadius ?? 0) > 0 }] : []
  if (!base && fills.length) base = fills.map((f) => f.d).join('')
  let caixa: Caixa | null = null
  for (const f of [...fillsLidos, ...tracosLidos]) caixa = uniao(caixa, f.caixa)
  if (!fillsLidos.length) caixa = uniao(caixa, { x: 0, y: 0, w, h })
  return { fills: fills.map(({ d, evenodd }) => ({ d, evenodd })), tracos: tracosLidos.map(({ d, evenodd }) => ({ d, evenodd })), base, aberto, caixa }
}

// ---------- caixa (para o viewBox) ----------

function margemEfeitos(nc: NodeChange): number {
  let m = 0
  for (const e of efeitosVisiveis(nc.effects)) {
    const r = e.radius ?? 0
    if (e.type === 'DROP_SHADOW') m = Math.max(m, Math.max(Math.abs(e.offset?.x ?? 0), Math.abs(e.offset?.y ?? 0)) + r * 1.5 + Math.max(0, e.spread ?? 0))
    if (e.type === 'FOREGROUND_BLUR') m = Math.max(m, r * 1.5)
  }
  return m
}

function pesoTraco(nc: NodeChange): number {
  if (!pinturasVisiveis(nc.strokePaints).length) return 0
  if (nc.borderStrokeWeightsIndependent) return Math.max(nc.borderTopWeight ?? 0, nc.borderBottomWeight ?? 0, nc.borderLeftWeight ?? 0, nc.borderRightWeight ?? 0)
  return nc.strokeWeight ?? 0
}

const cacheCaixa = new WeakMap<No, [Caixa | null | undefined, Caixa | null | undefined]>()

/** Caixa do conteúdo visível em coordenadas locais do nó (memorizada: a árvore é percorrida várias vezes). */
export function caixaNo(no: No, ctx: Contexto, comEfeitos = true): Caixa | null {
  const memo = cacheCaixa.get(no) ?? [undefined, undefined]
  const i = comEfeitos ? 1 : 0
  if (memo[i] !== undefined) return memo[i] ?? null
  const c = calcularCaixa(no, ctx, comEfeitos)
  memo[i] = c
  cacheCaixa.set(no, memo)
  return c
}

function calcularCaixa(no: No, ctx: Contexto, comEfeitos: boolean): Caixa | null {
  const nc = no.nc
  const { w, h } = tamanho(nc)
  let c: Caixa | null = null
  if (ehContainer(no) || (nc.type === 'BOOLEAN_OPERATION' && !nc.fillGeometry?.length)) {
    for (const f of no.filhos) {
      if (!visivel(f.nc)) continue
      const cf = caixaNo(f, ctx)
      if (cf) c = uniao(c, transformarCaixa(deFigma(f.nc.transform), cf))
    }
    if (recorta(nc) && c) c = intersecao(c, { x: 0, y: 0, w, h })
    if (ehContainer(no) && (pinturasVisiveis(nc.fillPaints).length || pinturasVisiveis(nc.strokePaints).length || recorta(nc))) c = uniao(c, { x: 0, y: 0, w, h })
  } else c = geometriaDe(nc, ctx).caixa
  if (!c) return null
  const peso = pesoTraco(nc)
  if (peso && !nc.strokeGeometry?.length) c = expandir(c, nc.strokeAlign === 'INSIDE' ? 0 : nc.strokeAlign === 'OUTSIDE' ? peso : peso / 2 + (nc.type === 'LINE' || nc.type === 'VECTOR' ? peso : 0))
  if (comEfeitos) {
    const m = margemEfeitos(nc)
    if (m) c = expandir(c, m)
  }
  return c
}

// ---------- desenho ----------

function caminho(d: string, evenodd: boolean, attrs: string): string {
  return `<path d="${d}"${evenodd ? ' fill-rule="evenodd"' : ''} ${attrs}/>`
}

/** Pinta `fills` com as pinturas (de baixo para cima, como no Figma). */
function pintar(paths: { d: string; evenodd: boolean }[], pinturas: Paint[], w: number, h: number, doc: DocSvg, ctx: Contexto): string {
  if (!paths.length) return ''
  const out: string[] = []
  for (const p of pinturas) {
    const attrs = atributosPintura(p, 'fill', w, h, doc, ctx)
    if (attrs) {
      for (const f of paths) out.push(caminho(f.d, f.evenodd, attrs))
      continue
    }
    if (p.type === 'IMAGE') {
      const clip = doc.id('c')
      doc.defs.push(`<clipPath id="${clip}">${paths.map((f) => caminho(f.d, f.evenodd, '')).join('')}</clipPath>`)
      const img = bytesDaImagem(p, ctx)
      if (img) {
        const ajuste = p.imageScaleMode === 'FIT' ? 'xMidYMid meet' : p.imageScaleMode === 'STRETCH' ? 'none' : 'xMidYMid slice'
        out.push(`<image href="data:${img.mime};base64,${base64(img.bytes)}" x="0" y="0" width="${num(w)}" height="${num(h)}" preserveAspectRatio="${ajuste}" clip-path="url(#${clip})"${(p.opacity ?? 1) < 0.999 ? ` opacity="${num(p.opacity ?? 1)}"` : ''}/>`)
      } else {
        ctx.imagensFaltando += 1
        out.push(`<rect x="0" y="0" width="${num(w)}" height="${num(h)}" fill="#d4d4d4" clip-path="url(#${clip})"/>`)
      }
      continue
    }
    ctx.avisos.add('Alguns preenchimentos especiais (vídeo, padrão, ruído) foram ignorados.')
  }
  return out.join('')
}

function tracar(nc: NodeChange, geo: Geo, doc: DocSvg, ctx: Contexto): string {
  const pinturas = pinturasVisiveis(nc.strokePaints)
  const peso = pesoTraco(nc)
  if (!pinturas.length || peso <= 0) return ''
  const { w, h } = tamanho(nc)
  const alinhamento = geo.aberto ? 'CENTER' : (nc.strokeAlign ?? 'CENTER')
  const out: string[] = []
  if (geo.tracos.length) {
    out.push(pintar(geo.tracos, pinturas, w, h, doc, ctx))
  } else if (nc.borderStrokeWeightsIndependent && !geo.aberto) {
    // pesos por lado: faixas internas
    const t = nc.borderTopWeight ?? 0
    const b = nc.borderBottomWeight ?? 0
    const l = nc.borderLeftWeight ?? 0
    const r = nc.borderRightWeight ?? 0
    const faixas = [t ? `M0 0H${num(w)}V${num(t)}H0Z` : '', b ? `M0 ${num(h - b)}H${num(w)}V${num(h)}H0Z` : '', l ? `M0 0H${num(l)}V${num(h)}H0Z` : '', r ? `M${num(w - r)} 0H${num(w)}V${num(h)}H${num(w - r)}Z` : ''].join('')
    if (faixas) out.push(pintar([{ d: faixas, evenodd: false }], pinturas, w, h, doc, ctx))
  } else if (geo.base) {
    const largura = alinhamento === 'CENTER' ? peso : peso * 2
    const extra = [
      `stroke-width="${num(largura)}"`,
      nc.strokeJoin && nc.strokeJoin !== 'MITER' ? `stroke-linejoin="${nc.strokeJoin.toLowerCase()}"` : '',
      nc.strokeCap === 'ROUND' ? 'stroke-linecap="round"' : nc.strokeCap === 'SQUARE' ? 'stroke-linecap="square"' : '',
      nc.dashPattern?.length ? `stroke-dasharray="${nc.dashPattern.map(num).join(' ')}"` : '',
    ]
      .filter(Boolean)
      .join(' ')
    for (const p of pinturas) {
      const attrs = atributosPintura(p, 'stroke', w, h, doc, ctx)
      if (attrs) out.push(`<path d="${geo.base}" fill="none" ${attrs} ${extra}/>`)
    }
  }
  const corpo = out.join('')
  if (!corpo || alinhamento === 'CENTER' || !geo.fills.length) return corpo
  if (alinhamento === 'INSIDE') {
    const id = doc.id('c')
    doc.defs.push(`<clipPath id="${id}">${geo.fills.map((f) => caminho(f.d, f.evenodd, '')).join('')}</clipPath>`)
    return `<g clip-path="url(#${id})">${corpo}</g>`
  }
  const id = doc.id('m')
  const caixa = expandir(geo.caixa ?? { x: 0, y: 0, w, h }, peso * 2 + 2)
  doc.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${num(caixa.x)}" y="${num(caixa.y)}" width="${num(caixa.w)}" height="${num(caixa.h)}"><rect x="${num(caixa.x)}" y="${num(caixa.y)}" width="${num(caixa.w)}" height="${num(caixa.h)}" fill="#fff"/>${geo.fills.map((f) => caminho(f.d, f.evenodd, 'fill="#000"')).join('')}</mask>`)
  return `<g mask="url(#${id})">${corpo}</g>`
}

/** Sombras, sombra interna e desfoque da camada como filtro SVG. */
function filtro(nc: NodeChange, caixa: Caixa | null, doc: DocSvg, ctx: Contexto, aninhado: boolean): string | null {
  const efeitos = efeitosVisiveis(nc.effects).filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW' || e.type === 'FOREGROUND_BLUR')
  if (!efeitos.length) return null
  const id = doc.id('f')
  const r = caixa ?? { x: -1000, y: -1000, w: 3000, h: 3000 }
  const p: string[] = []
  const baixo: string[] = []
  const cima: string[] = []
  let desfoque = 0
  efeitos.forEach((e, i) => {
    const raio = Math.max(0, e.radius ?? 0)
    const spread = e.spread ?? 0
    const { hex, alfa } = corEAlfa(e.color)
    if (e.type === 'FOREGROUND_BLUR') desfoque = Math.max(desfoque, raio)
    else if (e.type === 'DROP_SHADOW') {
      let fonte = 'SourceAlpha'
      if (spread) {
        p.push(`<feMorphology in="SourceAlpha" operator="${spread > 0 ? 'dilate' : 'erode'}" radius="${num(Math.abs(spread))}" result="sp${i}"/>`)
        fonte = `sp${i}`
      }
      p.push(`<feGaussianBlur in="${fonte}" stdDeviation="${num(raio / 2)}" result="b${i}"/>`)
      p.push(`<feOffset in="b${i}" dx="${num(e.offset?.x ?? 0)}" dy="${num(e.offset?.y ?? 0)}" result="o${i}"/>`)
      p.push(`<feFlood flood-color="${hex}" flood-opacity="${num(alfa)}" result="c${i}"/>`)
      p.push(`<feComposite in="c${i}" in2="o${i}" operator="in" result="s${i}"/>`)
      baixo.push(`s${i}`)
    } else {
      let fonte = 'SourceAlpha'
      if (spread > 0) {
        p.push(`<feMorphology in="SourceAlpha" operator="erode" radius="${num(spread)}" result="sp${i}"/>`)
        fonte = `sp${i}`
      }
      p.push(`<feOffset in="${fonte}" dx="${num(e.offset?.x ?? 0)}" dy="${num(e.offset?.y ?? 0)}" result="o${i}"/>`)
      p.push(`<feGaussianBlur in="o${i}" stdDeviation="${num(raio / 2)}" result="b${i}"/>`)
      p.push(`<feComposite in="SourceAlpha" in2="b${i}" operator="out" result="x${i}"/>`)
      p.push(`<feFlood flood-color="${hex}" flood-opacity="${num(alfa)}" result="c${i}"/>`)
      p.push(`<feComposite in="c${i}" in2="x${i}" operator="in" result="s${i}"/>`)
      cima.push(`s${i}`)
    }
  })
  p.push(`<feMerge result="m">${[...baixo, 'SourceGraphic', ...cima].map((n) => `<feMergeNode in="${n}"/>`).join('')}</feMerge>`)
  if (desfoque) p.push(`<feGaussianBlur in="m" stdDeviation="${num(desfoque / 2)}"/>`)
  doc.defs.push(`<filter id="${id}" filterUnits="userSpaceOnUse" x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" color-interpolation-filters="sRGB">${p.join('')}</filter>`)
  if (aninhado && efeitosVisiveis(nc.effects).some((e) => e.type === 'BACKGROUND_BLUR')) ctx.avisos.add('Desfoque de fundo dentro de vetores não é suportado e foi ignorado.')
  return id
}

/** Envolve o conteúdo com opacidade, mesclagem e efeitos do nó. */
function embrulhar(nc: NodeChange, corpo: string, caixaSemEfeitos: Caixa | null, doc: DocSvg, ctx: Contexto, comOpacidade: boolean): string {
  if (!corpo) return ''
  const f = filtro(nc, caixaSemEfeitos ? expandir(caixaSemEfeitos, margemEfeitos(nc) + 2) : null, doc, ctx, comOpacidade)
  if (f) corpo = `<g filter="url(#${f})">${corpo}</g>`
  const op = nc.opacity ?? 1
  // na raiz, opacidade e mesclagem vão para a camada (um <img> SVG não mescla com o que está atrás)
  const mescla = comOpacidade ? MESCLAGEM_CSS[nc.blendMode ?? ''] : undefined
  const attrs = [comOpacidade && op < 0.999 ? `opacity="${num(op)}"` : '', mescla ? `style="mix-blend-mode:${mescla}"` : ''].filter(Boolean).join(' ')
  return attrs ? `<g ${attrs}>${corpo}</g>` : corpo
}

// ---------- booleanas sem geometria assada ----------

function regiaoFilho(no: No, cor: string, doc: DocSvg, ctx: Contexto, caixa: Caixa): string {
  const m = deFigma(no.nc.transform)
  const r = regiaoLocal(no, cor, doc, ctx, transformarCaixa(inverter(m), caixa))
  return ehIdentidade(m) ? r : `<g transform="${svgMatriz(m)}">${r}</g>`
}

function retangulo(c: Caixa, attrs: string): string {
  return `<rect x="${num(c.x)}" y="${num(c.y)}" width="${num(c.w)}" height="${num(c.h)}" ${attrs}/>`
}

function mascara(conteudo: string, caixa: Caixa, doc: DocSvg): string {
  const id = doc.id('m')
  doc.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${num(caixa.x)}" y="${num(caixa.y)}" width="${num(caixa.w)}" height="${num(caixa.h)}">${retangulo(caixa, 'fill="#000"')}${conteudo}</mask>`)
  return id
}

/** Região (área preenchida) de um nó desenhada com `cor`, em coordenadas locais. */
function regiaoLocal(no: No, cor: string, doc: DocSvg, ctx: Contexto, caixa: Caixa): string {
  const nc = no.nc
  const filhos = no.filhos.filter((f) => visivel(f.nc))
  if (nc.type === 'BOOLEAN_OPERATION' && !nc.fillGeometry?.length && filhos.length) {
    const op = nc.booleanOperation ?? 'UNION'
    if (op === 'UNION') return filhos.map((f) => regiaoFilho(f, cor, doc, ctx, caixa)).join('')
    let dentro: string
    if (op === 'SUBTRACT') dentro = filhos.map((f, i) => regiaoFilho(f, i === 0 ? '#fff' : '#000', doc, ctx, caixa)).join('')
    else if (op === 'INTERSECT') dentro = filhos.reduce((acc, f) => `<g mask="url(#${mascara(regiaoFilho(f, '#fff', doc, ctx, caixa), caixa, doc)})">${acc}</g>`, retangulo(caixa, 'fill="#fff"'))
    else {
      // XOR: união menos a interseção (exato para dois operandos)
      const uniaoW = filhos.map((f) => regiaoFilho(f, '#fff', doc, ctx, caixa)).join('')
      const inter = filhos.reduce((acc, f) => `<g mask="url(#${mascara(regiaoFilho(f, '#fff', doc, ctx, caixa), caixa, doc)})">${acc}</g>`, retangulo(caixa, 'fill="#000"'))
      dentro = uniaoW + inter
    }
    return `<g mask="url(#${mascara(dentro, caixa, doc)})">${retangulo(caixa, `fill="${cor}"`)}</g>`
  }
  if (ehContainer(no)) return filhos.map((f) => regiaoFilho(f, cor, doc, ctx, caixa)).join('')
  const geo = geometriaDe(nc, ctx)
  return geo.fills.map((f) => caminho(f.d, f.evenodd, `fill="${cor}"`)).join('')
}

// ---------- API ----------

/** Desenha o nó (e filhos) em coordenadas locais. `comOpacidade=false` deixa a opacidade para a camada. */
export function desenharNo(no: No, doc: DocSvg, ctx: Contexto, comOpacidade = true): string {
  const nc = no.nc
  if (!visivel(nc)) return ''
  const { w, h } = tamanho(nc)
  const caixaSemEfeitos = caixaNo(no, ctx, false)
  if (nc.type === 'TEXT') {
    ctx.avisos.add('Textos dentro de ícones foram mantidos como texto separado.')
    return ''
  }
  if (nc.type === 'BOOLEAN_OPERATION' && !nc.fillGeometry?.length) {
    const caixa = expandir(caixaSemEfeitos ?? { x: 0, y: 0, w, h }, 1)
    const id = mascara(regiaoLocal(no, '#fff', doc, ctx, caixa), caixa, doc)
    const corpo = pintar([{ d: `M${num(caixa.x)} ${num(caixa.y)}h${num(caixa.w)}v${num(caixa.h)}h${num(-caixa.w)}Z`, evenodd: false }], pinturasVisiveis(nc.fillPaints), w, h, doc, ctx)
    if (pinturasVisiveis(nc.strokePaints).length && !nc.strokeGeometry?.length) ctx.avisos.add('Contornos de operações booleanas foram ignorados.')
    return embrulhar(nc, corpo ? `<g mask="url(#${id})">${corpo}</g>` : '', caixaSemEfeitos, doc, ctx, comOpacidade)
  }
  if (ehContainer(no)) {
    const geo = { fills: [{ d: retanguloPath(w, h, raiosDe(nc)), evenodd: false }], tracos: [], base: retanguloPath(w, h, raiosDe(nc)), aberto: false, caixa: { x: 0, y: 0, w, h } }
    const fundo = pintar(geo.fills, pinturasVisiveis(nc.fillPaints), w, h, doc, ctx)
    let filhos = desenharLista(no.filhos, 0, doc, ctx)
    if (filhos && recorta(nc)) {
      const id = doc.id('c')
      doc.defs.push(`<clipPath id="${id}"><path d="${geo.base}"/></clipPath>`)
      filhos = `<g clip-path="url(#${id})">${filhos}</g>`
    }
    return embrulhar(nc, fundo + filhos + tracar(nc, geo, doc, ctx), caixaSemEfeitos, doc, ctx, comOpacidade)
  }
  const geo = geometriaDe(nc, ctx)
  const corpo = pintar(geo.fills, pinturasVisiveis(nc.fillPaints), w, h, doc, ctx) + tracar(nc, geo, doc, ctx)
  return embrulhar(nc, corpo, caixaSemEfeitos, doc, ctx, comOpacidade)
}

/** Lista de irmãos (de baixo para cima), aplicando máscaras: um nó `mask` recorta os irmãos acima dele. */
function desenharLista(filhos: No[], ini: number, doc: DocSvg, ctx: Contexto): string {
  const out: string[] = []
  for (let i = ini; i < filhos.length; i++) {
    const f = filhos[i]!
    if (!visivel(f.nc)) continue
    if (f.nc.mask) {
      const resto = desenharLista(filhos, i + 1, doc, ctx)
      if (!resto) break
      const caixa = transformarCaixa(deFigma(f.nc.transform), caixaNo(f, ctx) ?? { x: 0, y: 0, w: 0, h: 0 })
      const id = doc.id('m')
      const tipo = f.nc.maskType === 'LUMINANCE' ? 'luminance' : 'alpha'
      const conteudo = f.nc.maskType === 'OUTLINE' ? regiaoFilho(f, '#fff', doc, ctx, expandir(caixa, 1)) : desenharFilho(f, doc, ctx)
      doc.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="${num(caixa.x - 1)}" y="${num(caixa.y - 1)}" width="${num(caixa.w + 2)}" height="${num(caixa.h + 2)}" style="mask-type:${tipo}">${conteudo}</mask>`)
      out.push(`<g mask="url(#${id})">${resto}</g>`)
      break
    }
    out.push(desenharFilho(f, doc, ctx))
  }
  return out.join('')
}

export function desenharFilho(no: No, doc: DocSvg, ctx: Contexto): string {
  const m = deFigma(no.nc.transform)
  const corpo = desenharNo(no, doc, ctx)
  if (!corpo) return ''
  return ehIdentidade(m) ? corpo : `<g transform="${svgMatriz(m)}">${corpo}</g>`
}

/** Documento SVG completo para um nó, com viewBox `vb` (coordenadas locais) e uma matriz extra opcional. */
export function montarSvg(conteudo: string, doc: DocSvg, vb: Caixa, extra?: M): string {
  const corpo = extra && !ehIdentidade(extra) ? `<g transform="${svgMatriz(extra)}">${conteudo}</g>` : conteudo
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h)}" width="${num(vb.w)}" height="${num(vb.h)}" fill="none">${doc.defs.length ? `<defs>${doc.defs.join('')}</defs>` : ''}${corpo}</svg>`
}

