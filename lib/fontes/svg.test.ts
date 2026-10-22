import { describe, expect, it } from 'vitest'
import DOMPurify from 'isomorphic-dompurify'
import bruto from './catalogo-google.json'
import { montarCatalogo, type CatalogoBruto } from './catalogo'
import { embutirFontesNoSvg, fontesDoSvg, textoDoSvg, trocarFamilias } from './svg'
import { motivoSvgInseguro, sanitizarSvg } from '@/lib/importar/svg'

const cat = montarCatalogo(bruto as unknown as CatalogoBruto)
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><style>.t{font-family:"Inter", sans-serif}</style><text x="0" y="40" font-family="PlayfairDisplay-Bold" font-weight="700">Olá, coração</text><text class="t" y="80" style="font-family: 'Helvetica Neue'">Ação &amp; ok</text></svg>`

describe('SVG importado com textos', () => {
  it('lê o texto visível e mapeia as famílias para o catálogo', () => {
    expect(textoDoSvg(SVG)).toBe('Olá, coraçãoAção & ok')
    const { pedido, trocas } = fontesDoSvg(SVG, cat)
    expect(Object.fromEntries(trocas)).toEqual({ 'PlayfairDisplay-Bold': 'Playfair Display', '"Inter", sans-serif': 'Inter' })
    expect(pedido.find((p) => p.familia === 'Playfair Display')!.variantes).toEqual([{ peso: 700, italico: false }])
  })

  it('troca nomes sem quebrar as aspas dos atributos', () => {
    const r = trocarFamilias(`<text font-family="Inter" style="font-family: Inter; fill:red">x</text>`, () => "'Inter', Inter")
    expect(r).toBe(`<text font-family="'Inter', Inter" style="font-family: 'Inter', Inter; fill:red">x</text>`)
  })

  it('embute as fontes recortadas (base64) e o resultado passa pela limpeza e pela conferência do servidor', async () => {
    const urls: string[] = []
    const buscar = async (u: string) => {
      urls.push(u)
      if (u.startsWith('/fontes/css')) return new Response("@font-face {\n  font-family: 'Playfair Display';\n  font-weight: 700;\n  src: url(/fontes/arquivo/l/font?kit=abcdefgh123&v=v40) format('woff2');\n}\n")
      return new Response(new Uint8Array([1, 2, 3, 4]))
    }
    const m = await embutirFontesNoSvg(SVG, cat, buscar)
    const pedido = new URL(urls[0]!, 'https://x').searchParams
    expect(pedido.getAll('f').sort()).toEqual(['Inter:400,700', 'Playfair Display:700'])
    expect(pedido.get('t')).toContain('ç')
    expect(m).toContain("src: url(data:font/woff2;base64,AQIDBA==) format('woff2');")
    expect(m).toContain(`font-family="'Playfair Display', PlayfairDisplay-Bold"`)
    expect(m).toContain(`<style>.t{font-family:"Inter", "Inter", sans-serif}</style>`)
    expect(m).toContain(`style="font-family: 'Helvetica Neue'"`) // fora do catálogo: fica como estava
    const limpo = sanitizarSvg(m, DOMPurify)
    expect(limpo).toContain('data:font/woff2;base64,AQIDBA==')
    expect(motivoSvgInseguro(limpo)).toBeNull()
    // url() externo continua recusado
    expect(motivoSvgInseguro(limpo.replace('data:font/woff2;base64,AQIDBA==', 'https://evil.example/f.woff2'))).not.toBeNull()
  })

  it('sem texto ou sem rede: o SVG fica como veio (só com os nomes do catálogo)', async () => {
    const semTexto = '<svg><rect width="1" height="1"/></svg>'
    expect(await embutirFontesNoSvg(semTexto, cat)).toBe(semTexto)
    const m = await embutirFontesNoSvg(SVG, cat, async () => { throw new Error('rede') })
    expect(m).not.toContain('@font-face')
    expect(m).toContain("'Playfair Display'")
  })
})
