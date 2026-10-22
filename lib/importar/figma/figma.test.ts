/**
 * Colar do Figma (⌘C normal).
 *
 * Fixtures em __fixtures__/:
 * - *-clipboard.html (exceto sds-*): cópias REAIS do Figma (text/html da área de transferência), do repositório
 *   gridaco/grida (fixtures/test-fig/clipboard, Apache-2.0, dez/2025).
 * - sds-texto-vetor-instancia.clipboard.html: nós REAIS (texto com estilos mistos, vetores com geometria,
 *   instância de botão com propriedades/overrides) tirados do arquivo da comunidade "Simple Design System"
 *   (.fig, mesmo formato Kiwi) e recodificados com o schema REAL de uma cópia do Figma, no mesmo envelope HTML.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pontosEstrela } from '@/lib/scene/formas'
import { describe, expect, it } from 'vitest'
import DOMPurify from 'isomorphic-dompurify'
import { compileSchema, encodeBinarySchema } from 'kiwi-schema'
import { deflateSync } from 'fflate'
import { converterMensagem, gradienteCss, pesoDoEstilo } from './converter'
import { criarDecodificador, decodificarFigma, descomprimir, ehHtmlFigma, extrairBufferFigma, lerArquivoKiwi } from './decodificar'
import { comandosParaPath, elipsePath, estrelaPath, lerRedeVetorial, redeParaPaths, retanguloPath } from './geometria'
import { figmaParaCamadas, tentarFigmaParaCamadas } from './index'
import type { MensagemFigma, NodeChange } from './tipos'
import { interpretar } from '../clipboard'
import { dimensoesSvg, sanitizarSvg } from '../svg'
import { parseCamada } from '@/lib/scene/schema'

const fixture = (n: string) => readFileSync(join(__dirname, '__fixtures__', n), 'utf8')
const CENA = { width: 1920, height: 1080 }
/** Caixa do texto sem o respiro (padding) que evita cortar ascendentes/descendentes. */
const conteudo = (c: Record<string, unknown>) => {
  const p = (c.padding as number) ?? 0
  return { x: (c.x as number) + p, y: (c.y as number) + p, w: (c.width as number) - 2 * p, h: (c.height as number) - 2 * p }
}
const camadas = (html: string, opcoes = {}) => figmaParaCamadas(html, { cena: CENA, ...opcoes }).camadas.map((c) => c.camada)

describe('decodificação (cópia real do Figma)', () => {
  it('reconhece o HTML, separa os blocos fig-kiwi e decodifica schema + mensagem', () => {
    const html = fixture('frame-with-r-g-b-rect.clipboard.html')
    expect(ehHtmlFigma(html)).toBe(true)
    const ext = extrairBufferFigma(html)!
    expect(ext.meta.dataType).toBe('scene')
    const arq = lerArquivoKiwi(ext.bytes)
    expect(arq.preludio).toBe('fig-kiwi')
    expect(arq.blocos.length).toBeGreaterThanOrEqual(2)
    const { mensagem, schema } = decodificarFigma(html)
    expect(schema.definitions.some((d) => d.name === 'NodeChange')).toBe(true)
    expect(mensagem.type).toBe('NODE_CHANGES')
    expect(mensagem.nodeChanges!.map((n) => n.type)).toEqual(expect.arrayContaining(['DOCUMENT', 'CANVAS', 'FRAME', 'ROUNDED_RECTANGLE']))
  })

  it('o interpretador guiado pelo schema dá o mesmo resultado que o compileSchema do kiwi', () => {
    for (const f of ['frame-with-stroke.clipboard.html', 'component-component-instance-blue-with-overrides.clipboard.html', 'sds-texto-vetor-instancia.clipboard.html']) {
      const { mensagem, schema } = decodificarFigma(fixture(f))
      const dados = descomprimir(lerArquivoKiwi(extrairBufferFigma(fixture(f))!.bytes).blocos[1]!)
      expect(mensagem).toEqual(compileSchema(schema).decodeMessage(dados))
      expect(criarDecodificador(schema)(dados)).toEqual(mensagem)
    }
  })

  it('aceita o HTML com entidades escapadas (Clipboard API do Chrome)', () => {
    const html = fixture('ellipse-circle-100x100-black.clipboard.html').replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;').replace(/"/g, '&quot;')
    expect(decodificarFigma(html).mensagem.nodeChanges!.some((n) => n.type === 'ELLIPSE')).toBe(true)
  })

  it('interpretar() devolve as camadas do Figma; conteúdo corrompido volta ao aviso', () => {
    const r = interpretar({ arquivos: [], texto: '', html: fixture('star-5-40-100x100-black.clipboard.html') })
    expect(r.tipo).toBe('figma')
    const quebrado = interpretar({ arquivos: [], texto: '', html: '<span data-buffer="<!--(figma)ZmlnLWtpd2kAAAAA(/figma)-->"></span>' })
    expect(quebrado.tipo).toBe('aviso')
    expect(tentarFigmaParaCamadas('<span data-buffer="<!--(figma)AAAA(/figma)-->"></span>', { cena: CENA })).toBeNull()
  })
})

describe('conversão de cópias reais', () => {
  it('frame com 3 retângulos: cores, espaçamento e grupo, centralizado na tela', () => {
    const cs = camadas(fixture('frame-with-r-g-b-rect.clipboard.html'))
    expect(cs.map((c) => [c.type, c.fill, c.width, c.height])).toEqual([
      ['shape', '#ff0000', 100, 100],
      ['shape', '#00ff00', 100, 100],
      ['shape', '#0000ff', 100, 100],
    ])
    expect(cs.map((c) => c.x)).toEqual([800, 910, 1020])
    expect(new Set(cs.map((c) => c.y))).toEqual(new Set([490]))
    expect(new Set(cs.map((c) => c.groupId)).size).toBe(1)
    for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
  })

  it('grupo do Figma (FRAME resizeToFit) mantém posições relativas', () => {
    const cs = camadas(fixture('group-with-r-g-b-rect.clipboard.html'))
    expect(cs.map((c) => (c.x as number) - (cs[0]!.x as number))).toEqual([0, 110, 220])
  })

  it('frame com contorno, elipse e override de instância', () => {
    const [frame] = camadas(fixture('frame-with-stroke.clipboard.html'))
    expect(frame).toMatchObject({ type: 'shape', shape: 'rect', stroke: '#000000', strokeWidth: 1 })
    const [elipse] = camadas(fixture('ellipse-circle-100x100-black.clipboard.html'))
    expect(elipse).toMatchObject({ type: 'shape', shape: 'ellipse', fill: '#000000', width: 100, height: 100 })
    const [inst] = camadas(fixture('component-component-instance-blue-with-overrides.clipboard.html'))
    // override da instância: azul com 50% e contorno preto
    expect(inst).toMatchObject({ type: 'shape', fill: '#0000ff80', stroke: '#000000' })
  })

  it('estrela vira forma editável (5 pontas, 40%) ocupando a mesma área do Figma', () => {
    const [s] = camadas(fixture('star-5-40-100x100-black.clipboard.html'))
    expect(s).toMatchObject({ type: 'shape', shape: 'star', count: 5, ratio: 0.4 })
    expect(() => parseCamada(s)).not.toThrow()
    // a figura desenhada (não a caixa) mede 100 × 100, como no Figma
    const pts = pontosEstrela(s!.width as number, s!.height as number, 5, 0.4)
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 0)
  })

  it('nós reais: texto com estilos mistos, vetores, instância com propriedades', () => {
    const r = figmaParaCamadas(fixture('sds-texto-vetor-instancia.clipboard.html'), { cena: CENA })
    const cs = r.camadas.map((c) => c.camada)
    for (const c of cs) expect(() => parseCamada(c)).not.toThrow()
    const textos = cs.filter((c) => c.type === 'text')
    // trechos em negrito/itálico/sublinhado viram pedaços com o estilo certo
    expect(textos.find((t) => t.text === 'bold (strong)')).toMatchObject({ fontFamily: 'Inter', fontWeight: 700 })
    expect(textos.find((t) => t.text === 'italic')).toMatchObject({ italic: true })
    expect(textos.find((t) => t.text === 'or underlines')).toMatchObject({ underline: true, fontFamily: 'Roboto Mono' })
    // mesma linha: o trecho seguinte começa à direita do anterior
    const bold = textos.find((t) => t.text === 'bold (strong)')!
    const virgula = textos.find((t) => t.text === ',')!
    expect(virgula.y).toBe(bold.y)
    expect(virgula.x as number).toBeGreaterThan(bold.x as number)
    expect(r.fontesAusentes).toContain('Roboto Mono')
    // botão (instância) com o texto da propriedade e o fundo do componente
    expect(textos.some((t) => t.text === 'Register' && t.fontWeight === 700)).toBe(true)
    expect(cs.some((c) => c.type === 'shape' && c.name === 'Button' && c.radius === 8)).toBe(true)
    // vetores com geometria real
    expect(cs.filter((c) => c.type === 'svg').length).toBeGreaterThan(0)
    // cada raiz colada é um grupo
    expect(new Set(cs.map((c) => c.groupId)).size).toBe(4)
  })

  it('todo SVG gerado sobrevive ao sanitizador mantendo recortes, máscaras e gradientes', () => {
    for (const f of ['sds-texto-vetor-instancia.clipboard.html', 'star-5-40-100x100-black.clipboard.html']) {
      for (const c of camadas(fixture(f)).filter((x) => x.type === 'svg')) {
        const limpo = sanitizarSvg(c.markup as string, DOMPurify)
        expect(limpo).toMatch(/^<svg/)
        expect((limpo.match(/<path/g) ?? []).length).toBe(((c.markup as string).match(/<path/g) ?? []).length)
        if ((c.markup as string).includes('clipPath')) expect(limpo).toContain('clipPath')
      }
    }
  })
})

// ---------- mensagens montadas com os nomes de campo do schema real ----------

const G = (localID: number) => ({ sessionID: 1, localID })
const PAGINA = G(1)
const T = (x: number, y: number, rot = 0) => {
  const r = (rot * Math.PI) / 180
  return { m00: Math.cos(r), m01: -Math.sin(r), m02: x, m10: Math.sin(r), m11: Math.cos(r), m12: y }
}
const solido = (r: number, g: number, b: number, a = 1, opacity = 1) => ({ type: 'SOLID', color: { r, g, b, a }, opacity, visible: true, blendMode: 'NORMAL' })
function msg(nos: NodeChange[], blobs: Uint8Array[] = []): MensagemFigma {
  return {
    type: 'NODE_CHANGES',
    nodeChanges: [{ guid: G(0), type: 'DOCUMENT' }, { guid: PAGINA, type: 'CANVAS', parentIndex: { guid: G(0), position: '!' } }, ...nos],
    blobs: blobs.map((bytes) => ({ bytes })),
  }
}
const filho = (pai: { sessionID: number; localID: number }, pos: string) => ({ parentIndex: { guid: pai, position: pos } })

function blobComandos(cmds: (string | number)[]): Uint8Array {
  const out: number[] = []
  const dv = new DataView(new ArrayBuffer(4))
  const f = (v: number) => {
    dv.setFloat32(0, v, true)
    out.push(...new Uint8Array(dv.buffer))
  }
  for (const c of cmds) {
    if (typeof c === 'number') f(c)
    else out.push({ Z: 0, M: 1, L: 2, Q: 3, C: 4 }[c]!)
  }
  return new Uint8Array(out)
}

describe('mapeamento de propriedades', () => {
  it('rotação, opacidade, mesclagem, sombra e desfoque em retângulo', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'ROUNDED_RECTANGLE', name: 'card', size: { x: 200, y: 100 }, transform: T(0, 0, 30), cornerRadius: 12, opacity: 0.5, blendMode: 'MULTIPLY', fillPaints: [solido(1, 0.5, 0)], effects: [{ type: 'DROP_SHADOW', offset: { x: 0, y: 8 }, radius: 24, spread: -4, color: { r: 0, g: 0, b: 0, a: 0.25 }, visible: true }, { type: 'BACKGROUND_BLUR', radius: 20, visible: true }] },
      ]),
      { cena: CENA }
    )
    const c = r.camadas[0]!.camada
    expect(c).toMatchObject({ type: 'shape', shape: 'rect', radius: 12, rotation: 30, opacity: 0.5, width: 200, height: 100, fill: '#ff8000' })
    expect(c.effects).toMatchObject({ blend: 'multiply', backdropBlur: 10, shadow: { y: 8, blur: 24, spread: -4, color: '#00000040' } })
    // centro preservado (rotação em torno do centro, como o Figma gira em torno do canto)
    expect((c.x as number) + 100).toBeCloseTo(960, 1)
    expect((c.y as number) + 50).toBeCloseTo(540, 1)
  })

  it('posição relativa com rotação: filho girado dentro de frame', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'FRAME', name: 'f', size: { x: 400, y: 400 }, transform: T(1000, 1000), fillPaints: [solido(1, 1, 1)], frameMaskDisabled: true },
        { guid: G(3), ...filho(G(2), '!'), type: 'RECTANGLE', size: { x: 100, y: 50 }, transform: T(200, 100, 90), fillPaints: [solido(0, 0, 0)] },
      ]),
      { cena: CENA, ponto: { x: 200, y: 200 } }
    )
    const [frame, ret] = r.camadas.map((c) => c.camada)
    expect(frame).toMatchObject({ x: 0, y: 0, width: 400, height: 400 })
    // canto em (200,100) girado 90°: centro em (200-25, 100+50)
    expect((ret!.x as number) + 50).toBeCloseTo(175, 1)
    expect((ret!.y as number) + 25).toBeCloseTo(150, 1)
    expect(ret!.rotation).toBe(90)
  })

  it('gradiente linear vira o gradiente da Mostra com ângulo CSS', () => {
    // transform identidade: da esquerda (0) para a direita (1) → 90deg
    const g = gradienteCss({ type: 'GRADIENT_LINEAR', transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }, stops: [{ color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 }, { color: { r: 0, g: 0, b: 1, a: 1 }, position: 1 }] }, 200, 100)
    expect(g).toEqual({ type: 'linear', angle: 90, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }] })
    // de cima para baixo (rotação de 90° no espaço do gradiente) → 180deg
    const v = gradienteCss({ type: 'GRADIENT_LINEAR', transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }, stops: [{ color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 }, { color: { r: 0, g: 0, b: 0, a: 1 }, position: 1 }] }, 100, 100)
    expect(v?.angle).toBe(180)
    expect(v?.stops.map((s) => s.pos)).toEqual([0, 100])
  })

  it('retângulo simples com cantos independentes vira forma com radii (sem SVG)', () => {
    const r = converterMensagem(
      msg([
        {
          guid: G(2),
          ...filho(PAGINA, '!'),
          type: 'ROUNDED_RECTANGLE',
          size: { x: 200, y: 100 },
          transform: T(0, 0),
          rectangleCornerRadiiIndependent: true,
          rectangleTopLeftCornerRadius: 24,
          rectangleTopRightCornerRadius: 8,
          rectangleBottomRightCornerRadius: 0,
          rectangleBottomLeftCornerRadius: 80,
          fillPaints: [solido(0, 0, 1)],
        },
      ]),
      { cena: CENA }
    )
    const c = r.camadas[0]!.camada
    // o canto de 80 é limitado à metade do lado menor (50), como no Figma
    expect(c).toMatchObject({ type: 'shape', shape: 'rect', radii: [24, 8, 0, 50], radius: 50, fill: '#0000ff' })
    expect(parseCamada(c)).toMatchObject({ radii: [24, 8, 0, 50] })
  })

  it('gradiente radial, sombra interna e cantos diferentes viram SVG com defs', () => {
    const r = converterMensagem(
      msg([
        {
          guid: G(2),
          ...filho(PAGINA, '!'),
          type: 'ROUNDED_RECTANGLE',
          size: { x: 100, y: 60 },
          transform: T(0, 0),
          rectangleCornerRadiiIndependent: true,
          rectangleTopLeftCornerRadius: 20,
          fillPaints: [{ type: 'GRADIENT_RADIAL', visible: true, opacity: 1, transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }, stops: [{ color: { r: 1, g: 1, b: 0, a: 1 }, position: 0 }, { color: { r: 0, g: 0.5, b: 1, a: 1 }, position: 1 }] }],
          strokePaints: [solido(0, 0, 0)],
          strokeWeight: 2,
          strokeAlign: 'OUTSIDE',
          effects: [{ type: 'INNER_SHADOW', offset: { x: 0, y: 2 }, radius: 4, color: { r: 0, g: 0, b: 0, a: 0.5 }, visible: true }],
        },
      ]),
      { cena: CENA }
    )
    const c = r.camadas[0]!.camada
    expect(c.type).toBe('svg')
    const m = c.markup as string
    expect(m).toContain('<radialGradient')
    expect(m).toContain('<filter')
    expect(m).toContain('<mask') // contorno externo
    // contorno de fora (2px) e sombra aumentam a caixa
    expect(c.width as number).toBeGreaterThan(100)
    const limpo = sanitizarSvg(m, DOMPurify)
    for (const tag of ['radialGradient', 'filter', 'feGaussianBlur', 'mask']) expect(limpo).toContain(tag)
  })

  it('imagem sem bytes vira marcador listrado; com bytes vira camada de imagem', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const r = converterMensagem(
      msg(
        [
          { guid: G(2), ...filho(PAGINA, '!'), type: 'ROUNDED_RECTANGLE', name: 'foto', size: { x: 300, y: 200 }, transform: T(0, 0), cornerRadius: 16, fillPaints: [{ type: 'IMAGE', visible: true, opacity: 1, imageScaleMode: 'FILL', image: { hash: new Uint8Array(20) } }] },
          { guid: G(3), ...filho(PAGINA, '"'), type: 'ELLIPSE', name: 'avatar', size: { x: 64, y: 64 }, transform: T(400, 0), fillPaints: [{ type: 'IMAGE', visible: true, opacity: 1, imageScaleMode: 'FIT', image: { hash: new Uint8Array(20), dataBlob: 0 } }] },
        ],
        [png]
      ),
      { cena: CENA }
    )
    expect(r.imagensFaltando).toBe(1)
    const [foto, avatar] = r.camadas
    expect(foto!.imagemFaltando).toBe(true)
    expect(foto!.camada).toMatchObject({ type: 'shape', pattern: 'stripes', width: 300, height: 200, radius: 16 })
    expect(avatar!.imagem?.mime).toBe('image/png')
    expect(avatar!.camada).toMatchObject({ type: 'image', fit: 'contain', mask: 'ellipse', width: 64, height: 64 })
  })

  it('booleana sem geometria (subtração) e máscara viram um SVG com <mask>', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'BOOLEAN_OPERATION', booleanOperation: 'SUBTRACT', size: { x: 100, y: 100 }, transform: T(0, 0), fillPaints: [solido(0, 0, 0)] },
        { guid: G(3), ...filho(G(2), '!'), type: 'RECTANGLE', size: { x: 100, y: 100 }, transform: T(0, 0) },
        { guid: G(4), ...filho(G(2), '"'), type: 'ELLIPSE', size: { x: 50, y: 50 }, transform: T(25, 25) },
        { guid: G(5), ...filho(PAGINA, '"'), type: 'GROUP', size: { x: 80, y: 80 }, transform: T(200, 0) },
        { guid: G(6), ...filho(G(5), '!'), type: 'ELLIPSE', mask: true, size: { x: 80, y: 80 }, transform: T(0, 0), fillPaints: [solido(1, 1, 1)] },
        { guid: G(7), ...filho(G(5), '"'), type: 'RECTANGLE', size: { x: 80, y: 80 }, transform: T(0, 0), fillPaints: [solido(1, 0, 0)] },
      ]),
      { cena: CENA }
    )
    const [bool, grupo] = r.camadas.map((c) => c.camada)
    expect(bool!.type).toBe('svg')
    expect(bool!.markup).toMatch(/<mask[^>]*>.*fill="#fff".*fill="#000"/)
    expect(grupo!.type).toBe('svg')
    expect(grupo!.markup).toContain('mask-type:alpha')
  })

  it('máscara de texto, alfa e luminância em frame com texto/imagem viram isMask + maskType + maskId', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const foto = (guid: number, pos: string, x: number) => ({ guid: G(guid), ...filho(G(10), pos), type: 'RECTANGLE', name: `foto${guid}`, size: { x: 200, y: 100 }, transform: T(x, 0), fillPaints: [{ type: 'IMAGE', visible: true, opacity: 1, imageScaleMode: 'FILL', image: { hash: new Uint8Array(20), dataBlob: 0 } }] })
    const r = converterMensagem(
      msg(
        [
          { guid: G(10), ...filho(PAGINA, '!'), type: 'FRAME', name: 'f', size: { x: 900, y: 300 }, transform: T(0, 0), fillPaints: [] },
          // texto-máscara (de baixo) recorta a foto acima dele
          { guid: G(11), ...filho(G(10), '!'), type: 'TEXT', mask: true, name: 'FOTO', size: { x: 200, y: 100 }, transform: T(0, 0), fontSize: 80, fontName: { family: 'Inter', style: 'Black' }, fillPaints: [solido(0, 0, 0)], textData: { characters: 'FOTO' } },
          foto(12, '"', 0),
          // imagem como máscara de luminância recorta o retângulo acima
          { ...foto(13, '#', 300), mask: true, maskType: 'LUMINANCE' },
          { guid: G(14), ...filho(G(10), '$'), type: 'RECTANGLE', name: 'cor', size: { x: 200, y: 100 }, transform: T(300, 0), fillPaints: [solido(1, 0, 0)] },
        ],
        [png]
      ),
      { cena: CENA }
    )
    const cs = r.camadas.map((c) => c.camada)
    const texto = cs.find((c) => c.type === 'text')!
    const foto12 = cs.find((c) => c.name === 'foto12')!
    const foto13 = cs.find((c) => c.name === 'foto13')!
    const cor = cs.find((c) => c.name === 'cor')!
    expect(texto).toMatchObject({ isMask: true, maskType: 'alpha', text: 'FOTO' })
    expect(foto12.maskId).toBe(texto.id)
    expect(foto13).toMatchObject({ type: 'image', isMask: true, maskType: 'luminance' })
    expect(foto13.maskId).toBeUndefined()
    expect(cor.maskId).toBe(foto13.id)
    // passa no schema
    for (const c of cs) expect(() => parseCamada({ ...c, assetId: c.type === 'image' ? 'a' : undefined })).not.toThrow()
  })

  it('vetor só com vector network vira caminho; geometria assada tem prioridade', () => {
    // rede: 3 vértices, 3 segmentos retos, 1 região
    const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]
    const f32 = (v: number) => Array.from(new Uint8Array(new Float32Array([v]).buffer))
    const rede = new Uint8Array([
      ...u32(3), ...u32(3), ...u32(1),
      ...u32(0), ...f32(0), ...f32(0), ...u32(0), ...f32(10), ...f32(0), ...u32(0), ...f32(0), ...f32(10),
      ...[[0, 1], [1, 2], [2, 0]].flatMap(([a, b]) => [...u32(0), ...u32(a!), ...f32(0), ...f32(0), ...u32(b!), ...f32(0), ...f32(0)]),
      ...u32(1), ...u32(1), ...u32(3), ...u32(0), ...u32(1), ...u32(2),
    ])
    const lida = lerRedeVetorial(rede)!
    expect(lida.vertices).toHaveLength(3)
    expect(redeParaPaths(lida).regioes[0]!.d).toBe('M0 0L10 0L0 10L0 0Z')
    const assada = blobComandos(['M', 0, 0, 'L', 5, 5, 'Z'])
    const r = converterMensagem(msg([{ guid: G(2), ...filho(PAGINA, '!'), type: 'VECTOR', size: { x: 10, y: 10 }, transform: T(0, 0), vectorData: { vectorNetworkBlob: 0 }, fillPaints: [solido(0, 0, 1)] }, { guid: G(3), ...filho(PAGINA, '"'), type: 'VECTOR', size: { x: 10, y: 10 }, transform: T(20, 0), fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: 1 }], fillPaints: [solido(0, 0, 1)] }], [rede, assada]), { cena: CENA })
    expect(r.camadas[0]!.camada.markup).toContain('M0 0L10 0L0 10L0 0Z')
    expect(r.camadas[1]!.camada.markup).toContain('M0 0L5 5Z')
  })

  it('texto: fonte, peso, itálico, entrelinha, espaçamento, alinhamento, caixa e cor', () => {
    const r = converterMensagem(
      msg([
        {
          guid: G(2),
          ...filho(PAGINA, '!'),
          type: 'TEXT',
          size: { x: 300, y: 48 },
          transform: T(0, 0),
          fontSize: 32,
          fontName: { family: 'Space Grotesk', style: 'SemiBold Italic' },
          lineHeight: { value: 150, units: 'PERCENT' },
          letterSpacing: { value: -2, units: 'PERCENT' },
          textAlignHorizontal: 'CENTER',
          textAlignVertical: 'CENTER',
          textCase: 'UPPER',
          textDecoration: 'UNDERLINE',
          textAutoResize: 'NONE',
          fillPaints: [solido(0.1, 0.2, 0.3, 1, 0.8)],
          textData: { characters: 'Olá Mostra' },
        },
      ]),
      { cena: CENA }
    )
    expect(r.camadas[0]!.camada).toMatchObject({ type: 'text', text: 'Olá Mostra', fontFamily: 'Space Grotesk', fontWeight: 600, italic: true, fontSize: 32, lineHeight: 1.5, letterSpacing: -0.64, align: 'center', valign: 'middle', transform: 'uppercase', underline: true, color: '#1a334dcc' })
    expect(conteudo(r.camadas[0]!.camada)).toMatchObject({ w: 300, h: 48 })
    expect(r.fontesAusentes).toEqual([])
    expect(pesoDoEstilo('ExtraBold')).toBe(800)
    expect(pesoDoEstilo('Light Italic')).toBe(300)
  })

  it('texto: opções do "Type settings" (corte vertical, tachado ondulado, versalete, lista, parágrafos, truncar)', () => {
    const r = converterMensagem(
      msg([
        {
          guid: G(2),
          ...filho(PAGINA, '!'),
          type: 'TEXT',
          size: { x: 300, y: 70 },
          transform: T(10, 20),
          fontSize: 20,
          fontName: { family: 'Inter', style: 'Regular' },
          textDecoration: 'STRIKETHROUGH',
          textDecorationStyle: 'WAVY',
          textDecorationThickness: { value: 2, units: 'PIXELS' },
          textDecorationSkipInk: false,
          textDecorationFillPaints: [solido(1, 0, 0)],
          textCase: 'SMALL_CAPS',
          fontVariantNumericSpacing: 'TABULAR',
          fontVariantCommonLigatures: false,
          leadingTrim: 'CAP_HEIGHT',
          textTruncation: 'ENDING',
          maxLines: 3,
          paragraphSpacing: 12,
          fillPaints: [solido(0, 0, 0)],
          textData: { characters: 'Um\nDois', lines: [{ lineType: 'UNORDERED_LIST' }, { lineType: 'UNORDERED_LIST' }] },
          // com corte vertical as linhas passam da caixa do nó (o Figma mede da maiúscula à linha de base)
          derivedTextData: { baselines: [{ firstCharacter: 0, endCharacter: 3, lineY: -6, lineHeight: 24, position: { x: 0, y: 14 }, width: 30 }, { firstCharacter: 3, endCharacter: 7, lineY: 42, lineHeight: 24, position: { x: 0, y: 62 }, width: 40 }] },
        },
      ]),
      { cena: CENA }
    )
    const t = r.camadas[0]!.camada
    expect(t).toMatchObject({ type: 'text', strikethrough: true, underline: false, decorationStyle: 'wavy', decorationThickness: 2, decorationSkipInk: false, decorationColor: '#ff0000', transform: 'smallCaps', tabularNums: true, ligatures: false, leadingTrim: 'cap', truncate: true, maxLines: 3, paragraphSpacing: 12, listStyle: 'bullet', padding: 0 })
    // a caixa é a do nó (justa), sem o respiro que evita cortar letras
    expect(t).toMatchObject({ width: 300, height: 70 })
    expect(r.avisos.join(' ')).not.toMatch(/riscado|versalete/i)
    expect(() => parseCamada({ ...t, id: 'x' })).not.toThrow()
  })

  it('texto: lista misturada com parágrafos comuns fica sem marcadores (com aviso)', () => {
    const r = converterMensagem(msg([{ guid: G(2), ...filho(PAGINA, '!'), type: 'TEXT', size: { x: 300, y: 50 }, transform: T(0, 0), fontSize: 20, fontName: { family: 'Inter', style: 'Regular' }, fillPaints: [solido(0, 0, 0)], textData: { characters: 'Título\nItem', lines: [{ lineType: 'PLAIN' }, { lineType: 'ORDERED_LIST' }] } }]), { cena: CENA })
    expect(r.camadas[0]!.camada.listStyle).toBeUndefined()
    expect(r.avisos.join(' ')).toMatch(/Listas misturadas/)
  })

  it('texto com estilo por parágrafo vira uma caixa por parágrafo nas alturas do Figma', () => {
    const r = converterMensagem(
      msg([
        {
          guid: G(2),
          ...filho(PAGINA, '!'),
          type: 'TEXT',
          size: { x: 400, y: 100 },
          transform: T(0, 0),
          fontSize: 40,
          fontName: { family: 'Inter', style: 'Bold' },
          fillPaints: [solido(0, 0, 0)],
          textData: {
            characters: 'Título\nSubtítulo',
            characterStyleIDs: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            styleOverrideTable: [{ styleID: 1, fontSize: 20, fontName: { family: 'Inter', style: 'Regular' } }],
          },
          derivedTextData: {
            baselines: [
              { firstCharacter: 0, endCharacter: 7, lineY: 0, lineHeight: 48, position: { x: 0, y: 38 }, width: 120 },
              { firstCharacter: 7, endCharacter: 16, lineY: 48, lineHeight: 24, position: { x: 0, y: 67 }, width: 90 },
            ],
          },
        },
      ]),
      { cena: CENA }
    )
    const [t1, t2] = r.camadas.map((c) => c.camada)
    expect(t1).toMatchObject({ text: 'Título', fontSize: 40, fontWeight: 700, lineHeight: 1.2 })
    expect(t2).toMatchObject({ text: 'Subtítulo', fontSize: 20, fontWeight: 400, lineHeight: 1.2 })
    expect(conteudo(t2!).y - conteudo(t1!).y).toBe(48)
    expect(t1!.groupId).toBe(t2!.groupId)
  })

  it('seleção maior que a tela é reduzida proporcionalmente (texto e contorno junto)', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'FRAME', size: { x: 3840, y: 2160 }, transform: T(0, 0), fillPaints: [solido(1, 1, 1)], strokePaints: [solido(0, 0, 0)], strokeWeight: 4, strokeAlign: 'INSIDE' },
        { guid: G(3), ...filho(G(2), '!'), type: 'TEXT', size: { x: 1000, y: 200 }, transform: T(100, 100), fontSize: 160, fontName: { family: 'Inter', style: 'Regular' }, fillPaints: [solido(0, 0, 0)], textData: { characters: 'Grande' } },
      ]),
      { cena: CENA }
    )
    expect(r.escala).toBe(0.5)
    const [frame, texto] = r.camadas.map((c) => c.camada)
    expect(frame).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080, strokeWidth: 2 })
    expect(texto).toMatchObject({ fontSize: 80 })
    expect(conteudo(texto!)).toMatchObject({ x: 50, y: 50 })
  })

  it('frame que recorta: filho totalmente fora some; vetor parcialmente fora é cortado no viewBox', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'FRAME', size: { x: 100, y: 100 }, transform: T(0, 0), fillPaints: [solido(1, 1, 1)], frameMaskDisabled: false },
        { guid: G(3), ...filho(G(2), '!'), type: 'TEXT', size: { x: 50, y: 20 }, transform: T(0, 0), fontSize: 12, fontName: { family: 'Inter', style: 'Regular' }, textData: { characters: 'x' }, fillPaints: [solido(0, 0, 0)] },
        { guid: G(4), ...filho(G(2), '"'), type: 'STAR', size: { x: 100, y: 100 }, transform: T(50, 0), fillPaints: [solido(0, 0, 0)], count: 5, starInnerScale: 0.4 },
        { guid: G(5), ...filho(G(2), '#'), type: 'RECTANGLE', size: { x: 10, y: 10 }, transform: T(500, 500), fillPaints: [solido(0, 0, 0)] },
      ]),
      { cena: CENA }
    )
    const cs = r.camadas.map((c) => c.camada)
    expect(cs).toHaveLength(3)
    const estrela = cs.find((c) => c.type === 'svg')!
    expect(estrela.width).toBe(50)
    expect(dimensoesSvg(estrela.markup as string)).toEqual({ width: 50, height: 100 })
  })
})

describe('geometria', () => {
  it('commandsBlob → d', () => {
    expect(comandosParaPath(blobComandos(['M', 0, 0, 'C', 1, 2, 3, 4, 5, 6, 'Q', 1, 1, 2, 2, 'Z']))).toEqual({ d: 'M0 0C1 2 3 4 5 6Q1 1 2 2Z', caixa: { x: 0, y: 0, w: 5, h: 6 } })
    expect(comandosParaPath(new Uint8Array([9]))).toBeNull()
  })

  it('retângulo com cantos, elipse com arco/anel e estrela', () => {
    expect(retanguloPath(10, 10)).toBe('M0 0H10V10H0Z')
    expect(retanguloPath(10, 10, [50, 0, 0, 0])).toContain('M5 0')
    expect(elipsePath(10, 10)).toContain('A5 5')
    expect(elipsePath(10, 10, { startingAngle: 0, endingAngle: Math.PI, innerRadius: 0.5 })).toMatch(/A2\.5 2\.5/)
    expect(estrelaPath(100, 100, 5, 0.4).match(/[ML]/g)).toHaveLength(10)
  })
})

describe('compatibilidade com o schema real ao recodificar', () => {
  it('mensagem codificada com o schema da cópia real é lida de volta e convertida', () => {
    const { schema } = decodificarFigma(fixture('frame-with-stroke.clipboard.html'))
    const compilado = compileSchema(schema)
    const m = msg([{ guid: G(2), ...filho(PAGINA, '!'), type: 'TEXT', name: 'oi', size: { x: 80, y: 20 }, transform: T(0, 0), fontSize: 16, fontName: { family: 'Inter', style: 'Medium', postscript: '' }, fillPaints: [solido(0, 0, 0)], textData: { characters: 'Oi' } } as NodeChange])
    const dados = compilado.encodeMessage(m)
    const bin = [deflateSync(encodeBinarySchema(schema)), deflateSync(dados)]
    const total = 12 + bin.reduce((s, b) => s + 4 + b.length, 0)
    const buf = new Uint8Array(total)
    buf.set(new TextEncoder().encode('fig-kiwi'))
    const dv = new DataView(buf.buffer)
    dv.setUint32(8, 101, true)
    let o = 12
    for (const b of bin) {
      dv.setUint32(o, b.length, true)
      buf.set(b, o + 4)
      o += 4 + b.length
    }
    let s = ''
    for (const b of buf) s += String.fromCharCode(b)
    const html = `<meta charset="utf-8" /><span data-metadata="<!--(figmeta)${btoa('{"dataType":"scene"}')}(/figmeta)-->"></span><span data-buffer="<!--(figma)${btoa(s)}(/figma)-->"></span>`
    const [c] = camadas(html)
    expect(c).toMatchObject({ type: 'text', text: 'Oi', fontWeight: 500 })
  })
})

describe('traços, sombras e cantos do Figma nos campos novos', () => {
  it('traço de fora, tracejado e duas sombras (projetada + interna) viram strokes/shadows, não SVG', () => {
    const r = converterMensagem(
      msg([
        {
          guid: G(2), ...filho(PAGINA, '!'), type: 'ROUNDED_RECTANGLE', size: { x: 120, y: 80 }, transform: T(0, 0), cornerRadius: 16, cornerSmoothing: 0.6,
          fillPaints: [solido(1, 1, 1)],
          strokePaints: [solido(0, 0, 1)], strokeWeight: 3, strokeAlign: 'OUTSIDE', dashPattern: [6, 4],
          effects: [
            { type: 'DROP_SHADOW', offset: { x: 0, y: 4 }, radius: 8, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.25 }, visible: true },
            { type: 'INNER_SHADOW', offset: { x: 0, y: 2 }, radius: 4, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.5 }, visible: true },
          ],
        },
      ]),
      { cena: CENA }
    )
    const c = r.camadas[0]!.camada
    expect(c).toMatchObject({ type: 'shape', shape: 'rect', radius: 16, cornerSmoothing: 0.6 })
    expect(c.strokes).toEqual([expect.objectContaining({ color: '#0000ff', weight: 3, position: 'outside', style: 'dashed', dash: 6, gap: 4 })])
    const ef = c.effects as { shadows: { inner?: boolean; y: number }[] }
    expect(ef.shadows).toHaveLength(2)
    // de cima para baixo como no painel (o Figma guarda de baixo para cima)
    expect(ef.shadows[0]).toMatchObject({ inner: true, y: 2 })
    expect(ef.shadows[1]).toMatchObject({ y: 4 })
    expect(() => parseCamada(c)).not.toThrow()
  })

  it('espessura por lado e traço centralizado em elipse', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'RECTANGLE', size: { x: 100, y: 50 }, transform: T(0, 0), fillPaints: [solido(1, 0, 0)], strokePaints: [solido(0, 0, 0)], strokeWeight: 1, strokeAlign: 'INSIDE', borderStrokeWeightsIndependent: true, borderTopWeight: 0, borderBottomWeight: 4, borderLeftWeight: 0, borderRightWeight: 0 },
        { guid: G(3), ...filho(PAGINA, '"'), type: 'ELLIPSE', size: { x: 50, y: 50 }, transform: T(200, 0), fillPaints: [solido(0, 1, 0)], strokePaints: [solido(0, 0, 0)], strokeWeight: 2, strokeAlign: 'CENTER' },
      ]),
      { cena: CENA }
    )
    const [ret, eli] = r.camadas.map((x) => x.camada)
    expect(ret!.strokes).toEqual([expect.objectContaining({ sides: { top: 0, right: 0, bottom: 4, left: 0 }, weight: 4, position: 'inside' })])
    expect(eli).toMatchObject({ type: 'shape', shape: 'ellipse' })
    expect(eli!.strokes).toEqual([expect.objectContaining({ weight: 2, position: 'center' })])
  })

  it('contorno de texto vira traço das letras; polígono vira forma com lados', () => {
    const r = converterMensagem(
      msg([
        { guid: G(2), ...filho(PAGINA, '!'), type: 'TEXT', size: { x: 80, y: 20 }, transform: T(0, 0), fontSize: 16, fontName: { family: 'Inter', style: 'Regular' }, textData: { characters: 'Oi' }, fillPaints: [solido(0, 0, 0)], strokePaints: [solido(1, 0, 0)], strokeWeight: 1 },
        { guid: G(3), ...filho(PAGINA, '"'), type: 'REGULAR_POLYGON', size: { x: 60, y: 60 }, transform: T(200, 0), fillPaints: [solido(0, 0, 1)], count: 6 },
      ]),
      { cena: CENA }
    )
    const cs = r.camadas.map((x) => x.camada)
    expect(cs.find((c) => c.type === 'text')!.strokes).toEqual([expect.objectContaining({ color: '#ff0000', weight: 1, position: 'outside' })])
    expect(cs.find((c) => c.type === 'shape')).toMatchObject({ shape: 'polygon', count: 6, width: 60, height: 60 })
    expect(r.avisos.join(' ')).not.toContain('Contorno em texto')
  })
})
