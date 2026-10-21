import { describe, expect, it } from 'vitest'
import DOMPurify from 'isomorphic-dompurify'
import { coresDoSvg, dimensoesSvg, ehSvg, normalizarCor, normalizarSvg, recolorirSvg, sanitizarSvg } from './svg'
import { classificar, ehLottie, gltfAutocontido } from './arquivos'
import { interpretar, serializarCamadas, urlParaEmbed } from './clipboard'

const FIGMA = '<svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="80" rx="8" fill="#5965F2"/><circle cx="60" cy="40" r="20" fill="#D7F25C"/></svg>'
const ILLUSTRATOR = '<?xml version="1.0" encoding="UTF-8"?><!-- Generator: Adobe Illustrator 28.0 --><svg id="Camada_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><style>.cls-1{fill:#e4572e;}.cls-2{fill:#171717;}</style></defs><path class="cls-1" d="M0 0h100v100H0z"/><path class="cls-2" d="M100 0h100v100H100z"/></svg>'

describe('SVG', () => {
  it('reconhece SVG do Figma e do Illustrator (com prólogo e comentário)', () => {
    expect(ehSvg(FIGMA)).toBe(true)
    expect(ehSvg(ILLUSTRATOR)).toBe(true)
    expect(ehSvg('<div>oi</div>')).toBe(false)
    expect(ehSvg('<svg> sem fim')).toBe(false)
  })

  it('sanitiza scripts, handlers, foreignObject e links externos', () => {
    const mau = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)"><script>alert(2)</script><foreignObject><iframe src="https://x"></iframe></foreignObject><a href="javascript:alert(3)"><rect width="10" height="10"/></a><use xlink:href="https://evil.com/s.svg#x"/><image href="https://evil.com/t.png"/><style>@import url(https://evil.com/x.css); .a{fill:url(https://evil.com/p)}</style><rect onclick="alert(4)" fill="#000" width="5" height="5"/></svg>'
    const limpo = sanitizarSvg(mau, DOMPurify)
    expect(limpo).not.toMatch(/script|onload|onclick|foreignObject|iframe|javascript:|evil\.com|@import/i)
    expect(limpo).toContain('<rect')
  })

  it('mantém o <style> do Illustrator e imagens embutidas em base64', () => {
    const limpo = sanitizarSvg(ILLUSTRATOR, DOMPurify)
    expect(limpo).toContain('.cls-1{fill:#e4572e;}')
    const comImg = sanitizarSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA" width="1" height="1"/></svg>', DOMPurify)
    expect(comImg).toContain('data:image/png;base64,AAAA')
  })

  it('dimensões pelo viewBox e normalização', () => {
    expect(dimensoesSvg(FIGMA)).toEqual({ width: 120, height: 80 })
    expect(dimensoesSvg('<svg width="40" height="20"></svg>')).toEqual({ width: 40, height: 20 })
    const n = normalizarSvg('<svg width="40" height="20"><rect/></svg>')
    expect(n).toContain('viewBox="0 0 40 20"')
    expect(n).not.toMatch(/width="40"/)
  })

  it('extrai e troca cores (hex, curto, rgb, nomes, CSS)', () => {
    expect(normalizarCor('#ABC')).toBe('#aabbcc')
    expect(normalizarCor('rgb(89, 101, 242)')).toBe('#5965f2')
    expect(coresDoSvg(FIGMA)).toEqual(['#5965f2', '#d7f25c'])
    expect(coresDoSvg(ILLUSTRATOR)).toEqual(['#e4572e', '#171717'])
    const r = recolorirSvg(ILLUSTRATOR, { '#e4572e': '#1F3B4D' })
    expect(r).toContain('fill:#1F3B4D')
    expect(r).toContain('fill:#171717')
    expect(recolorirSvg('<rect fill="black"/>', { '#000000': '#ffffff' })).toBe('<rect fill="#ffffff"/>')
  })
})

describe('arquivos', () => {
  const vazio = new Uint8Array(0)
  it('GLB pelo cabeçalho glTF, mesmo com MIME genérico', () => {
    expect(classificar('vaso.bin', 'application/octet-stream', new TextEncoder().encode('glTF')).tipo).toBe('model3d')
    expect(classificar('vaso.glb', '', vazio).tipo).toBe('model3d')
  })
  it('imagens, vídeo, svg', () => {
    expect(classificar('a.png', 'image/png', vazio).tipo).toBe('image')
    expect(classificar('a.mp4', '', vazio).tipo).toBe('video')
    expect(classificar('a.svg', '', vazio).tipo).toBe('svg')
  })
  it('Lottie e glTF autocontido por conteúdo JSON', () => {
    const lottie = JSON.stringify({ v: '5.7.4', fr: 30, w: 100, h: 100, layers: [] })
    expect(ehLottie(JSON.parse(lottie))).toBe(true)
    expect(classificar('anim.json', 'application/json', vazio, lottie).tipo).toBe('lottie')
    expect(gltfAutocontido({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AA' }] })).toBe(true)
    const externo = classificar('m.gltf', '', vazio, JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'm.bin' }] }))
    expect(externo.tipo).toBe('nao_suportado')
    expect(externo.dica).toMatch(/\.glb/)
  })
  it('dá dica útil para .ai, .fig, .blend e .psd', () => {
    expect(classificar('logo.ai', '', vazio).dica).toMatch(/Illustrator/)
    expect(classificar('tela.fig', '', vazio).dica).toMatch(/Copiar como SVG/)
    expect(classificar('cena.blend', '', vazio).dica).toMatch(/glTF/)
    expect(classificar('foto.psd', '', vazio).dica).toMatch(/PNG/)
  })
})

describe('área de transferência', () => {
  const base = { arquivos: [] as File[], texto: '', html: '' }
  it('camadas da própria Mostra têm prioridade', () => {
    const r = interpretar({ ...base, texto: serializarCamadas([{ id: 'a' }]) })
    expect(r).toEqual({ tipo: 'camadas', camadas: [{ id: 'a' }] })
  })
  it('SVG colado do Figma e do Illustrator', () => {
    expect(interpretar({ ...base, texto: FIGMA })).toMatchObject({ tipo: 'svg', origem: 'figma' })
    expect(interpretar({ ...base, texto: ILLUSTRATOR })).toMatchObject({ tipo: 'svg', origem: 'illustrator' })
  })
  it('cópia normal do Figma vira aviso com instrução', () => {
    const r = interpretar({ ...base, html: '<meta charset="utf-8"><span data-metadata="<!--(figmeta)abc(/figmeta)-->"></span>' })
    expect(r.tipo).toBe('aviso')
  })
  it('HTML com img e URLs', () => {
    expect(interpretar({ ...base, html: '<img src="https://x.com/a.png">' })).toEqual({ tipo: 'imagemUrl', url: 'https://x.com/a.png' })
    expect(interpretar({ ...base, texto: 'https://x.com/foto.jpg' })).toEqual({ tipo: 'imagemUrl', url: 'https://x.com/foto.jpg' })
    expect(interpretar({ ...base, texto: 'https://youtu.be/abc123' })).toEqual({ tipo: 'embed', url: 'https://www.youtube.com/embed/abc123' })
  })
  it('texto simples vira texto', () => {
    expect(interpretar({ ...base, texto: 'Forma, fogo e tempo.' })).toEqual({ tipo: 'texto', texto: 'Forma, fogo e tempo.' })
  })
  it('converte links para embed', () => {
    expect(urlParaEmbed('https://www.youtube.com/watch?v=XYZ')).toBe('https://www.youtube.com/embed/XYZ')
    expect(urlParaEmbed('https://vimeo.com/123')).toBe('https://player.vimeo.com/video/123')
  })
})
