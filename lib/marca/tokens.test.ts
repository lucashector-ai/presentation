/** Design system em formato técnico: tokens JSON (W3C, Tokens Studio, Style Dictionary), CSS e tema de .pptx. */
import { zipSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { montarCatalogo, type CatalogoBruto } from '@/lib/fontes/catalogo'
import bruto from '@/lib/fontes/catalogo-google.json'
import { perfilDoPptx } from './pptx'
import { corCss, papelDoNome, perfilDeCss, perfilDeTokens } from './tokens'
import { combinarPerfis } from './perfil'

const cat = montarCatalogo(bruto as unknown as CatalogoBruto)
const papeis = (p: ReturnType<typeof perfilDeTokens>) => Object.fromEntries(p.cores.map((c) => [c.hex, c.papel]))

describe('tokens JSON', () => {
  it('W3C Design Tokens: $value/$type, grupos e referências', () => {
    const p = perfilDeTokens({
      color: {
        $type: 'color',
        brand: { primary: { $value: '#0B4F8A' }, secondary: { $value: '#F28C28' } },
        background: { dark: { $value: '{color.base.night}' }, default: { $value: '#F6F1E7' } },
        base: { night: { $value: '#0E1726' } },
        feedback: { success: { $value: 'rgb(22, 167, 101)' } },
      },
      font: { heading: { $type: 'fontFamily', $value: ['Montserrat', 'sans-serif'] }, body: { $type: 'fontFamily', $value: 'Helvetica Neue, Arial, sans-serif' } },
    }, cat, 'tokens.json')
    expect(papeis(p)).toMatchObject({ '#0B4F8A': 'principal', '#F28C28': 'secundaria', '#0E1726': 'fundoEscuro', '#F6F1E7': 'fundoClaro', '#16A765': 'positivo' })
    expect(p.fontes.titulos).toMatchObject({ familia: 'Montserrat', substituta: false })
    expect(p.fontes.textos).toMatchObject({ familia: 'Inter', substituta: true, original: 'Helvetica Neue' })
    expect(p.origem.arquivos).toEqual(['tokens.json'])
  })

  it('Tokens Studio: value/type, conjunto "global" e token de tipografia', () => {
    const p = perfilDeTokens({
      global: {
        primaria: { value: '#5965F2', type: 'color' },
        texto: { value: '#171717', type: 'color' },
        titulo: { value: { fontFamily: '{fontFamilies.display}', fontWeight: '700' }, type: 'typography' },
        fontFamilies: { display: { value: 'Playfair Display', type: 'fontFamilies' }, corpo: { value: 'Lato', type: 'fontFamilies' } },
      },
    }, cat)
    expect(papeis(p)).toMatchObject({ '#5965F2': 'principal', '#171717': 'texto' })
    expect(p.fontes.titulos?.familia).toBe('Playfair Display')
    expect(p.fontes.textos?.familia).toBe('Lato')
  })

  it('Style Dictionary: value em grupos aninhados; escala sem papel não toma o lugar da principal', () => {
    const p = perfilDeTokens({ color: { blue: { 100: { value: '#E8F0FF' }, 900: { value: '#0A1F44' } }, brand: { value: '#E4572E' } } }, cat)
    expect(p.cores[0]).toMatchObject({ hex: '#E4572E', papel: 'principal' })
    expect(p.cores.map((c) => c.hex)).toEqual(expect.arrayContaining(['#E8F0FF', '#0A1F44']))
  })
})

describe('CSS com variáveis', () => {
  it(':root com --cor-*, var(), font-family de títulos e corpo e o @import do Google Fonts', () => {
    const css = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@400;700&display=swap');
      /* tokens da marca */
      :root { --cor-primaria: #1F6FEB; --cor-fundo-escuro: #0B1F3A; --cor-destaque: var(--laranja); --laranja: hsl(24, 85%, 55%); --cor-texto: #141414; --fonte-titulos: "DM Serif Display", serif; --fonte-corpo: 'Manrope', sans-serif; --tamanho-base: 16px }
      h1, h2 { font-family: var(--fonte-titulos) }
      body { font-family: var(--fonte-corpo); color: var(--cor-texto) }`
    const p = perfilDeCss(css, cat, 'marca.css')
    expect(papeis(p)).toMatchObject({ '#1F6FEB': 'principal', '#0B1F3A': 'fundoEscuro', '#141414': 'texto' })
    const destaque = p.cores.find((c) => c.papel === 'destaque')
    expect(destaque?.hex).toMatch(/^#E[0-9A-F]{5}$/)
    expect(p.fontes.titulos?.familia).toBe('DM Serif Display')
    expect(p.fontes.textos?.familia).toBe('Manrope')
  })
  it('cores CSS: hex curto, rgba transparente fica de fora, hsl e cmyk', () => {
    expect(corCss('#abc')).toBe('#AABBCC')
    expect(corCss('rgba(0, 0, 0, 0.1)')).toBeNull()
    expect(corCss('hsl(0, 100%, 50%)')).toBe('#FF0000')
    expect(corCss('cmyk(0%, 100%, 100%, 0%)')).toBe('#FF0000')
    expect(papelDoNome('--color-primary-hover')).toBeNull()
  })
})

describe('tema de uma apresentação antiga (.pptx)', () => {
  it('lê a paleta (accent1…6, dk2, lt2) e as fontes major/minor do theme1.xml', () => {
    const tema = `<?xml version="1.0"?><a:theme xmlns:a="x"><a:themeElements><a:clrScheme name="Vela">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="0E1726"/></a:dk2><a:lt2><a:srgbClr val="F6F1E7"/></a:lt2>
      <a:accent1><a:srgbClr val="0B4F8A"/></a:accent1><a:accent2><a:srgbClr val="F28C28"/></a:accent2><a:accent3><a:srgbClr val="4DFF8C"/></a:accent3>
      </a:clrScheme><a:fontScheme name="Vela"><a:majorFont><a:latin typeface="Montserrat"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`
    const zip = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'ppt/theme/theme1.xml': strToU8(tema), 'ppt/slides/slide1.xml': strToU8('<p:sld/>') })
    const p = perfilDoPptx(zip, cat, 'antiga.pptx')
    expect(papeis(p)).toEqual({ '#0B4F8A': 'principal', '#0E1726': 'fundoEscuro', '#F6F1E7': 'fundoClaro', '#F28C28': 'secundaria', '#4DFF8C': 'destaque' })
    expect(p.fontes.titulos).toMatchObject({ familia: 'Montserrat', substituta: false })
    expect(p.fontes.textos).toMatchObject({ familia: 'Carlito', substituta: true })
  })
  it('arquivo que não é .pptx dá erro com mensagem', () => {
    expect(() => perfilDoPptx(new Uint8Array([1, 2, 3]), cat)).toThrow(/não é um .pptx/)
  })
})

describe('combinar fontes do manual', () => {
  it('o PDF manda; os tokens completam sem repetir cor nem tomar papel único', () => {
    const pdf = perfilDeTokens({ a: { primary: { value: '#0B4F8A', type: 'color' } } }, cat, 'manual.pdf')
    const tokens = perfilDeTokens({ b: { primary: { value: '#E4572E', type: 'color' }, bg: { value: '#F6F1E7', type: 'color' } } }, cat, 'tokens.json')
    const p = combinarPerfis(pdf, tokens)
    expect(papeis(p)).toEqual({ '#0B4F8A': 'principal', '#E4572E': 'apoio', '#F6F1E7': 'fundoClaro' })
    expect(p.origem.arquivos).toEqual(['manual.pdf', 'tokens.json'])
  })
})
