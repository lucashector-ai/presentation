/**
 * Máscaras (⌃⌘M, como "Use as mask" do Figma). A camada marcada com `isMask` (forma, texto, imagem ou SVG) não é
 * desenhada; cada camada com `maskId` recebe uma `mask-image` SVG (data URL) com a máscara desenhada no próprio
 * sistema de coordenadas da camada recortada (posição, rotação e espelhamento das duas considerados).
 * Funciona igual no editor, visualizador, miniaturas e exportação (o mesmo renderizador).
 *
 * Tipos (como no Figma): **alfa** usa a transparência da máscara (cor com alfa, gradiente, PNG/SVG transparente,
 * opacidade da camada); **contorno** usa só a silhueta, opaca; **luminância** usa o brilho (claro mostra, escuro
 * esconde; `mask-mode: luminance`).
 *
 * Texto: as letras vão num `<foreignObject>` com o MESMO HTML/CSS do renderizador (lib/scene/tipografia.ts —
 * quebra de linha, corte vertical, lista, truncar), então mudar o texto, a fonte ou o tamanho atualiza o recorte.
 * Uma imagem SVG não enxerga as fontes da página: as fontes (e as imagens usadas como máscara) entram embutidas
 * como data URL — carregadas sob demanda por lib/scene/mascaraRecursos.ts e passadas aqui em `recursos`.
 */
import type { CSSProperties } from 'react'
import type { Camada, CamadaForma, CamadaImagem, CamadaSvg, CamadaTexto, Gradiente, TipoMascara } from './schema'
import { caminhoDaForma } from './formas'
import { corpoTexto, estiloCaixaTexto, estiloParaCss, LINHA_VAZIA } from './tipografia'
import { MASCARAS, gradienteCss, raioCss } from '@/components/renderer/estilos'
import { recolorirSvg, svgParaDataUrl } from '@/lib/importar/svg'

const n = (v: number) => String(Math.round(v * 1000) / 1000)

/** Camadas que podem ser máscara: formas fechadas, textos, imagens e SVG. */
export type CamadaMascara = CamadaForma | CamadaTexto | CamadaImagem | CamadaSvg
export const serveDeMascara = (c: Camada | undefined): c is CamadaMascara =>
  !!c && ((c.type === 'shape' && c.shape !== 'line' && c.shape !== 'arrow') || c.type === 'text' || c.type === 'image' || c.type === 'svg')

export const ehMascara = (c: Camada | undefined): c is CamadaMascara => !!c?.isMask && serveDeMascara(c)

/** Tipo efetivo: ausente = contorno nas formas (como as máscaras antigas) e alfa nos demais. */
export function tipoMascara(c: Pick<Camada, 'type' | 'maskType'>): TipoMascara {
  return c.maskType ?? (c.type === 'shape' ? 'outline' : 'alpha')
}

export const NOMES_TIPO_MASCARA: Record<TipoMascara, string> = { alpha: 'Alfa', outline: 'Contorno', luminance: 'Luminância' }

// ---------- recursos embutidos (fontes e imagens) ----------

/** Fontes (@font-face com data URL) e imagens (data URL; null = falhou) já carregadas, por chave. */
export type RecursosMascara = ReadonlyMap<string, string | null>

/** Nome da família no CSS da página (Geist vem do @fontsource com outro nome). */
export function familiaReal(nome: string): string {
  if (nome === 'Geist') return 'Geist Variable'
  if (nome === 'Geist Mono') return 'Geist Mono Variable'
  return nome
}

/** O texto usa caracteres fora do latim (cirílico, grego, vietnamita…)? Então embute os outros subconjuntos. */
const foraDoLatim = (t: string) => /[^\u0000-ɏḀ-ỿ -⁯₠-⃏℀-↏]/.test(t)

export function chaveFonte(c: Pick<CamadaTexto, 'fontFamily' | 'fontWeight' | 'italic' | 'text'>): string {
  return `fonte|${familiaReal(c.fontFamily)}|${c.fontWeight}|${c.italic ? 'i' : 'n'}|${foraDoLatim(c.text) ? 'x' : 'l'}`
}
export const chaveImagem = (url: string) => `img|${url}`

export type PedidoRecurso =
  | { tipo: 'fonte'; chave: string; familia: string; peso: number; italico: boolean; todos: boolean }
  | { tipo: 'imagem'; chave: string; url: string }

/** Recursos que as máscaras da cena precisam (fontes dos textos-máscara, arquivos das imagens/SVG-máscara). */
export function recursosDasMascaras(camadas: readonly Camada[], assets: Readonly<Record<string, { url: string } | undefined>>): PedidoRecurso[] {
  const usadas = new Set(camadas.filter((c) => c.maskId).map((c) => c.maskId!))
  const r = new Map<string, PedidoRecurso>()
  for (const m of camadas) {
    if (!usadas.has(m.id) || !ehMascara(m) || m.hidden) continue
    if (m.type === 'text') {
      const chave = chaveFonte(m)
      r.set(chave, { tipo: 'fonte', chave, familia: familiaReal(m.fontFamily), peso: m.fontWeight, italico: m.italic, todos: foraDoLatim(m.text) })
    } else if ((m.type === 'image' || (m.type === 'svg' && !m.markup)) && m.assetId) {
      const url = assets[m.assetId]?.url
      if (url) r.set(chaveImagem(url), { tipo: 'imagem', chave: chaveImagem(url), url })
    }
  }
  return [...r.values()]
}

// ---------- conteúdo da máscara (coordenadas locais da máscara: 0..w, 0..h) ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Gradiente SVG igual ao das formas (components/renderer/camadas/Forma.tsx). */
function defsGradiente(id: string, g: Gradiente): string {
  const stops = g.stops.map((s) => `<stop offset="${s.pos}%" stop-color="${esc(s.color)}"/>`).join('')
  return g.type === 'radial' ? `<radialGradient id="${id}">${stops}</radialGradient>` : `<linearGradient id="${id}" gradientTransform="rotate(${n(g.angle - 90)} .5 .5)">${stops}</linearGradient>`
}

function conteudoForma(m: CamadaForma, tipo: TipoMascara): { defs: string; corpo: string } | null {
  const d = caminhoDaForma(m)
  if (!d) return null
  const regra = m.shape === 'path' && m.vetor?.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : ''
  if (tipo === 'outline') return { defs: '', corpo: `<path d="${d}" fill="#000"${regra}/>` }
  return { defs: m.gradient ? defsGradiente('mg', m.gradient) : '', corpo: `<path d="${d}" fill="${m.gradient ? 'url(#mg)' : esc(m.fill)}"${regra}/>` }
}

/** Regras do corte vertical (app/globals.css → .texto-corte), que a imagem SVG não herda da página. */
const CSS_CORTE = '.texto-corte{margin-top:calc(-1*var(--corte-topo,0px));margin-bottom:calc(-1*var(--corte-base,0px))}@supports (text-box:trim-both cap alphabetic){.texto-corte{margin-top:0;margin-bottom:0;text-box:trim-both cap alphabetic}}'

/** HTML do texto (mesma caixa → corpo → parágrafos do renderizador). Contorno: tudo em preto opaco. */
export function htmlDoTexto(c: CamadaTexto, tipo: TipoMascara): string {
  const silhueta = tipo === 'outline'
  const caixa: CSSProperties = {
    ...estiloCaixaTexto(c),
    fontFamily: `"${familiaReal(c.fontFamily)}", system-ui, sans-serif`,
    boxSizing: 'border-box',
    width: c.width,
    height: c.height,
    margin: 0,
    fontSize: c.fontSize,
    letterSpacing: c.letterSpacing,
    color: silhueta ? '#000' : c.color,
    background: c.background ? (silhueta ? '#000' : c.background) : undefined,
    borderRadius: raioCss(c),
    ...(silhueta && (c.underline || c.strikethrough) ? { textDecorationColor: '#000' } : {}),
  }
  const t = corpoTexto(c)
  const pintura: CSSProperties = c.gradient && !silhueta ? { backgroundImage: gradienteCss(c.gradient), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}
  const estiloCorpo = estiloParaCss({ ...t.estilo, ...pintura })
  const texto = t.paragrafos
    ? t.paragrafos.map((p, i) => `<span data-paragrafo="${i}" style="${esc(estiloParaCss(t.paragrafo(i, p)))}">${esc(p || LINHA_VAZIA)}</span>`).join('')
    : esc(!c.text ? LINHA_VAZIA : c.text.endsWith('\n') ? `${c.text}${LINHA_VAZIA}` : c.text)
  const corpo = `<span${t.classe ? ` class="${t.classe}"` : ''}${estiloCorpo ? ` style="${esc(estiloCorpo)}"` : ''}>${texto}</span>`
  return `<div xmlns="http://www.w3.org/1999/xhtml" style="${esc(estiloParaCss(caixa))}">${corpo}</div>`
}

function conteudoTexto(m: CamadaTexto, tipo: TipoMascara, recursos?: RecursosMascara): { estilo: string; corpo: string } {
  const fonte = recursos?.get(chaveFonte(m)) ?? ''
  const estilo = `${fonte}${m.leadingTrim === 'cap' ? CSS_CORTE : ''}`
  // overflow visível: com corte vertical as letras passam da caixa (como no renderizador)
  return { estilo, corpo: `<foreignObject x="0" y="0" width="${n(m.width)}" height="${n(m.height)}" overflow="visible">${htmlDoTexto(m, tipo)}</foreignObject>` }
}

/** Caixa da imagem (cantos, máscara de forma) com a foto dentro (encaixe e recorte iguais ao renderizador). */
function conteudoImagem(m: CamadaImagem, tipo: TipoMascara, src: string | null | undefined): string | null {
  const recorte = m.mask !== 'none' ? MASCARAS[m.mask] : undefined
  const caixa = estiloParaCss({ width: m.width, height: m.height, position: 'relative', overflow: 'hidden', borderRadius: m.mask === 'none' ? raioCss(m) : undefined, clipPath: recorte, background: tipo === 'outline' || src === null ? '#000' : undefined })
  let foto = ''
  if (tipo !== 'outline' && src) {
    const c = m.crop
    const est = c
      ? { position: 'absolute', width: `${100 / c.w}%`, height: `${100 / c.h}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, maxWidth: 'none' }
      : { width: '100%', height: '100%', objectFit: m.fit, display: 'block' }
    foto = `<img src="${esc(src)}" style="${esc(estiloParaCss(est as CSSProperties))}"/>`
  } else if (tipo !== 'outline' && src === undefined) return null // ainda carregando: nada aparece (sem piscar a caixa)
  return `<foreignObject x="0" y="0" width="${n(m.width)}" height="${n(m.height)}"><div xmlns="http://www.w3.org/1999/xhtml" style="${esc(caixa)}">${foto}</div></foreignObject>`
}

/** SVG colado/enviado: o próprio desenho (contorno = silhueta opaca, por um filtro de alfa). */
function conteudoSvg(m: CamadaSvg, tipo: TipoMascara, src: string | null | undefined): { defs: string; corpo: string } | null {
  const url = m.markup ? svgParaDataUrl(recolorirSvg(m.markup, m.recolor)) : src
  if (url === undefined) return null
  if (url === null) return { defs: '', corpo: `<rect width="${n(m.width)}" height="${n(m.height)}" fill="#000"/>` }
  const img = `<image href="${esc(url)}" width="${n(m.width)}" height="${n(m.height)}" preserveAspectRatio="${m.fit === 'fill' ? 'none' : 'xMidYMid meet'}"/>`
  if (tipo !== 'outline') return { defs: '', corpo: img }
  return { defs: '<filter id="ms" x="0" y="0" width="1" height="1"><feComponentTransfer><feFuncA type="discrete" tableValues="0 1 1 1"/></feComponentTransfer></filter>', corpo: `<g filter="url(#ms)">${img}</g>` }
}

// ---------- montagem ----------

type Geo = Pick<Camada, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'>

/**
 * Transformação da máscara para o quadro local da camada recortada: E⁻¹ · M, com E e M as matrizes das duas
 * (centro, rotação, espelho — a mesma ordem do `transform` CSS do renderizador).
 */
function transformacao(camada: Geo, m: Geo): string {
  const p: string[] = [`translate(${n(camada.width / 2)} ${n(camada.height / 2)})`]
  if (camada.flipX || camada.flipY) p.push(`scale(${camada.flipX ? -1 : 1} ${camada.flipY ? -1 : 1})`)
  if (camada.rotation) p.push(`rotate(${n(-camada.rotation)})`)
  p.push(`translate(${n(m.x + m.width / 2 - (camada.x + camada.width / 2))} ${n(m.y + m.height / 2 - (camada.y + camada.height / 2))})`)
  if (m.rotation) p.push(`rotate(${n(m.rotation)})`)
  if (m.flipX || m.flipY) p.push(`scale(${m.flipX ? -1 : 1} ${m.flipY ? -1 : 1})`)
  p.push(`translate(${n(-m.width / 2)} ${n(-m.height / 2)})`)
  return p.join(' ')
}

type Assets = Readonly<Record<string, { url: string } | undefined>>

/** URL embutida da imagem de um asset (undefined = carregando; null = falhou ou sem arquivo). */
function imagemEmbutida(assetId: string, recursos?: RecursosMascara, assets?: Assets): string | null | undefined {
  const url = assets?.[assetId]?.url
  if (!url) return null
  const chave = chaveImagem(url)
  return recursos?.has(chave) ? (recursos.get(chave) ?? null) : undefined
}

/**
 * SVG (markup) da máscara no quadro da camada (0..w, 0..h). null se a camada não serve de máscara ou se o
 * arquivo dela (imagem) ainda está carregando.
 */
export function svgDaMascara(camada: Geo, mascara: CamadaMascara, recursos?: RecursosMascara, assets?: Assets): string | null {
  const tipo = tipoMascara(mascara)
  let defs = ''
  let estilo = ''
  let corpo: string | null = null
  if (mascara.type === 'shape') {
    const r = conteudoForma(mascara, tipo)
    if (r) ({ defs, corpo } = r)
  } else if (mascara.type === 'text') {
    ;({ estilo, corpo } = conteudoTexto(mascara, tipo, recursos))
  } else if (mascara.type === 'image') {
    corpo = conteudoImagem(mascara, tipo, imagemEmbutida(mascara.assetId, recursos, assets))
  } else {
    const r = conteudoSvg(mascara, tipo, mascara.assetId ? imagemEmbutida(mascara.assetId, recursos, assets) : null)
    if (r) ({ defs, corpo } = r)
  }
  if (corpo === null) return null
  // alfa e luminância levam a opacidade da camada-máscara (como no Figma); contorno é opaco
  const op = tipo !== 'outline' && mascara.opacity < 1 ? ` opacity="${n(mascara.opacity)}"` : ''
  const lw = camada.width
  const lh = camada.height
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(lw)}" height="${n(lh)}" viewBox="0 0 ${n(lw)} ${n(lh)}">${estilo ? `<style>${estilo}</style>` : ''}${defs ? `<defs>${defs}</defs>` : ''}<g transform="${transformacao(camada, mascara)}"${op}>${corpo}</g></svg>`
}

/** Estilo CSS (mask-image) da camada recortada; undefined sem máscara válida/visível. */
export function estiloMascara(camada: Camada, mapa: ReadonlyMap<string, Camada>, recursos?: RecursosMascara, assets?: Assets): CSSProperties | undefined {
  if (!camada.maskId) return undefined
  const m = mapa.get(camada.maskId)
  if (!ehMascara(m) || m.hidden || m.id === camada.id) return undefined
  const svg = svgDaMascara(camada, m, recursos, assets)
  // imagem-máscara carregando: a camada recortada fica escondida até a máscara chegar (sem piscar)
  if (!svg) return m.type === 'image' || m.type === 'svg' ? { visibility: 'hidden' } : undefined
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  const est: CSSProperties = { maskImage: url, WebkitMaskImage: url, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }
  if (tipoMascara(m) === 'luminance') est.maskMode = 'luminance'
  return est
}

/**
 * Animações: a máscara anima junto. A camada recortada sem animação própria toca as da máscara (entrada, saída e
 * ênfase em loop) — o recorte acompanha a camada recortada, então o conjunto anima como a máscara.
 */
export function herdarAnimacoesDaMascara(camadas: Camada[]): Camada[] {
  if (!camadas.some((c) => c.maskId)) return camadas
  const mapa = new Map(camadas.map((c) => [c.id, c]))
  let mudou = false
  const r = camadas.map((c) => {
    const m = c.maskId ? mapa.get(c.maskId) : undefined
    if (!m || !ehMascara(m) || (!m.enterAnimation && !m.exitAnimation && !m.loopAnimation)) return c
    const enter = c.enterAnimation ?? m.enterAnimation
    const exit = c.exitAnimation ?? m.exitAnimation
    const loop = c.loopAnimation ?? m.loopAnimation
    if (enter === c.enterAnimation && exit === c.exitAnimation && loop === c.loopAnimation) return c
    mudou = true
    return { ...c, enterAnimation: enter, exitAnimation: exit, loopAnimation: loop } as Camada
  })
  return mudou ? r : camadas
}

// ---------- criar / remover ----------

/**
 * Usar como máscara (⌃⌘M): como no Figma, a camada de BAIXO (menor z) da seleção vira a máscara das demais
 * (e dos descendentes delas); se a de baixo não servir (vídeo, frame…), usa a mais de baixo que sirva. Tudo vira
 * um grupo. Máscara nova é de alfa (o padrão do Figma). Devolve null se nada na seleção serve de máscara.
 */
export function criarMascara(camadas: readonly Camada[], ids: readonly string[], idsComDescendentes: readonly string[], novoGrupo: string): Camada[] | null {
  const sel = camadas.filter((c) => ids.includes(c.id))
  if (sel.length < 2) return null
  const ordem = [...sel].sort((a, b) => a.z - b.z)
  const topo = ordem.find(serveDeMascara)
  if (!topo) return null
  const alvo = new Set(idsComDescendentes.filter((id) => id !== topo.id))
  const grupo = new Set(ids)
  return camadas.map((c) => {
    if (c.id === topo.id) return { ...c, isMask: true, maskType: c.maskType ?? 'alpha', groupId: novoGrupo, maskId: undefined } as Camada
    if (alvo.has(c.id)) return { ...c, maskId: topo.id, ...(grupo.has(c.id) ? { groupId: novoGrupo } : {}) } as Camada
    return c
  })
}

/** Remover máscara: a camada volta a ser desenhada, as recortadas por ela ficam livres e o grupo se desfaz. */
export function removerMascara(camadas: readonly Camada[], ids: readonly string[]): Camada[] {
  const mascaras = new Set(camadas.filter((c) => ids.includes(c.id) && c.isMask).map((c) => c.id))
  for (const c of camadas) if (ids.includes(c.id) && c.maskId) mascaras.add(c.maskId)
  if (!mascaras.size) return camadas as Camada[]
  const grupos = new Set(camadas.filter((c) => mascaras.has(c.id) && c.groupId).map((c) => c.groupId!))
  return camadas.map((c) => {
    if (mascaras.has(c.id)) { const { isMask: _m, maskType: _t, groupId: _g, ...r } = c; return r as Camada }
    if (c.maskId && mascaras.has(c.maskId)) { const { maskId: _i, ...r } = c; return (grupos.has(r.groupId ?? '') ? { ...r, groupId: undefined } : r) as Camada }
    return c
  })
}
