/** Máscaras de texto, imagem (alfa/luminância/contorno) e SVG — lógica pura (lib/scene/mascara.ts). */
import { describe, expect, it } from 'vitest'
import { DocumentoProjetoSchema, parseCamada, type Camada, type CamadaTexto } from './schema'
import { chaveFonte, chaveImagem, criarMascara, estiloMascara, herdarAnimacoesDaMascara, htmlDoTexto, recursosDasMascaras, removerMascara, svgDaMascara, tipoMascara } from './mascara'
import { mapaDe } from './arvore'
import { clonarCamadas } from '@/lib/editor/useEditor'

const foto = parseCamada({ id: 'foto', type: 'image', assetId: 'a1', x: 0, y: 0, width: 800, height: 400, z: 2 })
const titulo = parseCamada({ id: 't', type: 'text', text: 'FOTO', fontFamily: 'Inter', fontSize: 200, fontWeight: 800, x: 100, y: 50, width: 600, height: 240, z: 1 }) as CamadaTexto
const svgDe = (est: ReturnType<typeof estiloMascara>) => decodeURIComponent(String(est?.maskImage ?? '').replace(/^url\("data:image\/svg\+xml,/, '').replace(/"\)$/, ''))

describe('máscara: schema e tipo', () => {
  it('documento antigo com forma-máscara abre igual (contorno); campos novos são aditivos', () => {
    const doc = DocumentoProjetoSchema.parse({ schemaVersion: 2, mode: 'slides', scenes: [{ id: 's', size: { width: 100, height: 100 }, layers: [{ id: 'm', type: 'shape', isMask: true, x: 0, y: 0, width: 10, height: 10 }, { id: 'f', type: 'image', assetId: 'x', maskId: 'm', x: 0, y: 0, width: 10, height: 10 }] }] })
    const m = doc.scenes[0]!.layers[0]!
    expect(m.isMask).toBe(true)
    expect(m.maskType).toBeUndefined()
    expect(tipoMascara(m)).toBe('outline')
    expect(tipoMascara(titulo)).toBe('alpha')
    expect(() => parseCamada({ ...titulo, isMask: true, maskType: 'luminance' })).not.toThrow()
    expect(() => parseCamada({ ...titulo, maskType: 'outro' })).toThrow()
  })
})

describe('texto como máscara', () => {
  const [f, t] = criarMascara([foto, titulo], ['foto', 't'], ['foto', 't'], 'g1')!.sort((a, b) => b.z - a.z) as [Camada, CamadaTexto]
  it('o texto de baixo vira máscara (alfa) da foto, num grupo', () => {
    expect(t).toMatchObject({ isMask: true, maskType: 'alpha', groupId: 'g1' })
    expect(f).toMatchObject({ maskId: 't', groupId: 'g1' })
  })
  it('as letras vão num foreignObject com o mesmo HTML/CSS do renderizador, no quadro da foto', () => {
    const svg = svgDe(estiloMascara(f, mapaDe([f, t])))
    expect(svg).toContain('<foreignObject')
    expect(svg).toContain('>FOTO<')
    expect(svg).toContain('font-size:200px')
    expect(svg).toContain('font-family:&quot;Inter&quot;')
    expect(svg).toContain('translate(400 200)') // centro da foto
    expect(svg).toContain('translate(0 -30)') // centro do texto − centro da foto
  })
  it('editar o texto, a fonte ou o corte vertical muda o recorte; fonte embutida entra no <style>', () => {
    const t2 = { ...t, text: 'NOVO <&>', fontFamily: 'Geist', leadingTrim: 'cap' as const }
    const svg = svgDe(estiloMascara(f, mapaDe([f, t2]), new Map([[chaveFonte(t2), '@font-face{font-family:"Geist Variable";src:url(data:font/woff2;base64,AA)}']])))
    expect(svg).toContain('NOVO &lt;&amp;&gt;')
    expect(svg).toContain('font-family:&quot;Geist Variable&quot;')
    expect(svg).toContain('@font-face')
    expect(svg).toContain('texto-corte')
    expect(svg).toContain('text-box:trim-both cap alphabetic')
  })
  it('contorno pinta tudo de preto opaco; alfa mantém cor e gradiente; opacidade da máscara entra no alfa', () => {
    const grad = { ...t, color: '#FFFFFF80', gradient: { type: 'linear' as const, angle: 90, stops: [{ color: '#ff0000', pos: 0 }, { color: '#0000ff', pos: 100 }] } }
    expect(htmlDoTexto(grad, 'outline')).toContain('color:#000')
    expect(htmlDoTexto(grad, 'outline')).not.toContain('linear-gradient')
    expect(htmlDoTexto(grad, 'alpha')).toContain('linear-gradient')
    expect(svgDaMascara(f, { ...grad, opacity: 0.5 })).toContain('opacity="0.5"')
    expect(svgDaMascara(f, { ...grad, opacity: 0.5, maskType: 'outline' })).not.toContain('opacity=')
  })
  it('lista e parágrafos saem como no renderizador', () => {
    const lista = { ...t, text: 'Um\nDois', listStyle: 'bullet' as const }
    expect(htmlDoTexto(lista, 'alpha')).toContain('data-paragrafo="1"')
    expect(htmlDoTexto(lista, 'alpha')).toContain('list-item')
  })
  it('pede a fonte da família/peso/estilo do texto; remover desfaz', () => {
    expect(recursosDasMascaras([f, t], {})).toEqual([{ tipo: 'fonte', chave: chaveFonte(t), familia: 'Inter', peso: 800, italico: false, todos: false }])
    expect(recursosDasMascaras([f, { ...t, hidden: true }], {})).toEqual([])
    const r = removerMascara([f, t], ['t'])
    expect(r.every((c) => !c.isMask && !c.maskType && !c.maskId && !c.groupId)).toBe(true)
  })
})

describe('imagem como máscara (alfa, contorno, luminância)', () => {
  const png = parseCamada({ id: 'p', type: 'image', assetId: 'logo', x: 0, y: 0, width: 400, height: 400, z: 1, isMask: true, maskType: 'alpha', fit: 'contain' })
  const cor = parseCamada({ id: 'c', type: 'shape', fill: '#5965F2', x: 0, y: 0, width: 400, height: 400, z: 2, maskId: 'p' })
  const assets = { logo: { url: 'https://cdn/logo.png' } }
  it('carregando: a camada recortada espera escondida; pronta: a foto embutida entra na máscara', () => {
    expect(estiloMascara(cor, mapaDe([png, cor]), new Map(), assets)).toEqual({ visibility: 'hidden' })
    const est = estiloMascara(cor, mapaDe([png, cor]), new Map([[chaveImagem('https://cdn/logo.png'), 'data:image/png;base64,QQ']]), assets)
    const svg = svgDe(est)
    expect(svg).toContain('<img src="data:image/png;base64,QQ"')
    expect(svg).toContain('object-fit:contain')
    expect(est?.maskMode).toBeUndefined()
    expect(recursosDasMascaras([png, cor], assets)).toEqual([{ tipo: 'imagem', chave: chaveImagem('https://cdn/logo.png'), url: 'https://cdn/logo.png' }])
  })
  it('luminância liga mask-mode; contorno usa a caixa (sem precisar do arquivo); falha cai para a caixa', () => {
    const lum = estiloMascara(cor, mapaDe([{ ...png, maskType: 'luminance' }, cor]), new Map([[chaveImagem('https://cdn/logo.png'), 'data:image/png;base64,QQ']]), assets)
    expect(lum?.maskMode).toBe('luminance')
    const cont = svgDe(estiloMascara(cor, mapaDe([{ ...png, maskType: 'outline' }, cor]), new Map(), assets))
    expect(cont).toContain('background:#000')
    expect(cont).not.toContain('<img')
    const falhou = svgDe(estiloMascara(cor, mapaDe([png, cor]), new Map([[chaveImagem('https://cdn/logo.png'), null]]), assets))
    expect(falhou).toContain('background:#000')
  })
  it('SVG colado vira máscara direto do markup; contorno usa o filtro de silhueta', () => {
    const vet = parseCamada({ id: 'v', type: 'svg', markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>', x: 0, y: 0, width: 100, height: 100, isMask: true })
    const alvo = { ...cor, maskId: 'v' }
    expect(svgDe(estiloMascara(alvo, mapaDe([vet, alvo])))).toContain('<image href="data:image/svg+xml')
    expect(svgDe(estiloMascara(alvo, mapaDe([{ ...vet, maskType: 'outline' } as Camada, alvo])))).toContain('feFuncA')
  })
  it('máscara desligada (oculta) não recorta', () => {
    expect(estiloMascara(cor, mapaDe([{ ...png, hidden: true }, cor]), new Map(), assets)).toBeUndefined()
  })
})

describe('forma como máscara', () => {
  it('alfa usa a cor (com alfa) e o gradiente da forma; contorno é preto', () => {
    const c = parseCamada({ id: 'c', type: 'shape', shape: 'ellipse', fill: '#00000080', x: 0, y: 0, width: 100, height: 100, isMask: true, maskType: 'alpha' })
    const alvo = parseCamada({ id: 'a', type: 'image', assetId: 'x', x: 0, y: 0, width: 100, height: 100, maskId: 'c' })
    expect(svgDaMascara(alvo, c as never)).toContain('fill="#00000080"')
    expect(svgDaMascara(alvo, { ...c, maskType: undefined } as never)).toContain('fill="#000"')
    const g = { ...c, gradient: { type: 'linear' as const, angle: 0, stops: [{ color: '#fff', pos: 0 }, { color: '#000', pos: 100 }] } }
    expect(svgDaMascara(alvo, g as never)).toContain('url(#mg)')
  })
  it('rotação e espelho das duas camadas entram na transformação', () => {
    const c = parseCamada({ id: 'c', type: 'shape', x: 0, y: 0, width: 100, height: 100, rotation: 30, flipX: true, isMask: true })
    const alvo = parseCamada({ id: 'a', type: 'image', assetId: 'x', x: 0, y: 0, width: 100, height: 100, rotation: 10, flipY: true })
    const svg = svgDaMascara(alvo, c as never)!
    expect(svg).toContain('scale(1 -1) rotate(-10)')
    expect(svg).toContain('rotate(30) scale(-1 1)')
  })
})

describe('animações e cópias', () => {
  it('a camada recortada sem animação anima com a máscara; com animação própria fica a dela', () => {
    const entrada = { type: 'slideUp', duration: 600, delay: 0, easing: 'easeOut' }
    const m = parseCamada({ ...titulo, isMask: true, enterAnimation: entrada })
    const a = parseCamada({ ...foto, maskId: 't' })
    const b = parseCamada({ ...foto, id: 'b', maskId: 't', enterAnimation: { ...entrada, type: 'fadeIn' } })
    const r = herdarAnimacoesDaMascara([m, a, b])
    expect(r[1]!.enterAnimation?.type).toBe('slideUp')
    expect(r[2]!.enterAnimation?.type).toBe('fadeIn')
    const semMascara = [foto]
    expect(herdarAnimacoesDaMascara(semMascara)).toBe(semMascara)
  })
  it('copiar/duplicar a máscara com as recortadas aponta as cópias para a nova máscara', () => {
    const [f, t] = criarMascara([foto, titulo], ['foto', 't'], ['foto', 't'], 'g1')!
    const copias = clonarCamadas([f!, t!], [f!, t!])
    const novaMascara = copias.find((c) => c.isMask)!
    const novaFoto = copias.find((c) => !c.isMask)!
    expect(novaMascara.id).not.toBe('t')
    expect(novaFoto.maskId).toBe(novaMascara.id)
  })
})
