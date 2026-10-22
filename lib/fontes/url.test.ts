import { describe, expect, it } from 'vitest'
import { ajustarVariantes, lerPedido, reescreverCss, urlArquivoGoogle, urlFolha, urlGoogle, type InfoFamilia } from './url'

const INFO: Record<string, InfoFamilia> = {
  'Playfair Display': { pesos: { tipo: 'faixa', min: 400, max: 900 }, italico: { tipo: 'faixa', min: 400, max: 900 } },
  'Bebas Neue': { pesos: { tipo: 'lista', valores: [400] }, italico: null },
  Buda: { pesos: { tipo: 'lista', valores: [300] }, italico: null },
  Lato: { pesos: { tipo: 'lista', valores: [100, 300, 400, 700, 900] }, italico: { tipo: 'lista', valores: [100, 300, 400, 700, 900] } },
}
const info = (f: string) => INFO[f]

describe('pedido do navegador (/fontes/css)', () => {
  it('monta uma URL estável (ordem não importa) e lê de volta', () => {
    const a = urlFolha({ familias: [{ familia: 'Playfair Display', variantes: [{ peso: 700, italico: false }, { peso: 400, italico: true }, { peso: 400, italico: false }] }] })
    const b = urlFolha({ familias: [{ familia: 'Playfair Display', variantes: [{ peso: 400, italico: false }, { peso: 400, italico: true }, { peso: 700, italico: false }, { peso: 700, italico: false }] }] })
    expect(a).toBe(b)
    expect(a).toBe('/fontes/css?f=Playfair+Display%3A400%2C700%2Ci400')
    const p = lerPedido(new URL(a, 'https://x').searchParams)
    expect(p).toEqual({ familias: [{ familia: 'Playfair Display', variantes: [{ peso: 400, italico: false }, { peso: 700, italico: false }, { peso: 400, italico: true }] }] })
  })

  it('texto da prévia: só os caracteres únicos', () => {
    const u = urlFolha({ familias: [{ familia: 'Inter', variantes: [{ peso: 400, italico: false }] }], texto: 'InterInter' })
    expect(new URL(u, 'https://x').searchParams.get('t')).toBe('Ienrt')
  })

  it('recusa pedidos inválidos', () => {
    const ler = (q: string) => lerPedido(new URLSearchParams(q))
    expect(ler('')).toBeNull()
    expect(ler('f=Inter:950')).toBeNull()
    expect(ler('f=Inter:abc')).toBeNull()
    expect(ler('f=<script>:400')).toBeNull()
    expect(ler(`f=${'A'.repeat(81)}:400`)).toBeNull()
    expect(ler(Array.from({ length: 41 }, (_, i) => `f=F${i}:400`).join('&'))).toBeNull()
    expect(ler('f=Inter')).toEqual({ familias: [{ familia: 'Inter', variantes: [{ peso: 400, italico: false }] }] })
  })
})

describe('URL do Google (css2)', () => {
  it('só variantes que existem (senão o Google responde 400)', () => {
    expect(ajustarVariantes(INFO['Bebas Neue']!, [{ peso: 700, italico: true }, { peso: 400, italico: false }])).toEqual([{ peso: 400, italico: false }])
    expect(ajustarVariantes(INFO.Lato!, [{ peso: 500, italico: false }, { peso: 600, italico: true }])).toEqual([{ peso: 400, italico: false }, { peso: 700, italico: true }])
    expect(ajustarVariantes(INFO['Playfair Display']!, [{ peso: 300, italico: false }, { peso: 950, italico: false }])).toEqual([{ peso: 400, italico: false }, { peso: 900, italico: false }])
  })

  it('formato do css2: ital,wght em ordem, display=swap, famílias fora do catálogo ficam de fora', () => {
    expect(urlGoogle({ familias: [{ familia: 'Playfair Display', variantes: [{ peso: 700, italico: false }, { peso: 400, italico: true }] }] }, info))
      .toBe('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&display=swap')
    expect(urlGoogle({ familias: [{ familia: 'Buda', variantes: [{ peso: 400, italico: false }] }, { familia: 'Helvetica Neue', variantes: [{ peso: 400, italico: false }] }] }, info))
      .toBe('https://fonts.googleapis.com/css2?family=Buda:wght@300&display=swap')
    expect(urlGoogle({ familias: [{ familia: 'Helvetica Neue', variantes: [{ peso: 400, italico: false }] }] }, info)).toBeNull()
    expect(urlGoogle({ familias: [{ familia: 'Bebas Neue', variantes: [{ peso: 400, italico: false }] }], texto: 'Bebas Neue' }, info))
      .toBe('https://fonts.googleapis.com/css2?family=Bebas+Neue:wght@400&text=Bebas%20Neue&display=swap')
  })
})

const CSS_GOOGLE = `/* cyrillic */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/playfairdisplay/v40/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin-ext */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/playfairdisplay/v40/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/playfairdisplay/v40/lat.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`

describe('folha reescrita pelo proxy', () => {
  it('arquivos pela mesma origem e só os subconjuntos latinos (português)', () => {
    const css = reescreverCss(CSS_GOOGLE)
    expect(css).not.toContain('fonts.gstatic.com')
    expect(css).not.toContain('cyr.woff2')
    expect(css).toContain('url(/fontes/arquivo/s/playfairdisplay/v40/ext.woff2)')
    expect(css).toContain('url(/fontes/arquivo/s/playfairdisplay/v40/lat.woff2)')
    expect(css.match(/@font-face/g)).toHaveLength(2)
  })

  it('folha de prévia (text=, sem marcas de subconjunto) fica inteira', () => {
    const css = reescreverCss("@font-face {\n  font-family: 'Inter';\n  src: url(https://fonts.gstatic.com/l/font?kit=abcdefgh123&skey=c491285d6722e4fa&v=v20) format('woff2');\n}\n")
    expect(css).toContain('url(/fontes/arquivo/l/font?kit=abcdefgh123&skey=c491285d6722e4fa&v=v20)')
  })

  it('caminhos de arquivo: só os formatos do gstatic', () => {
    expect(urlArquivoGoogle('/fontes/arquivo/s/playfairdisplay/v40/lat.woff2', '')).toBe('https://fonts.gstatic.com/s/playfairdisplay/v40/lat.woff2')
    expect(urlArquivoGoogle('/fontes/arquivo/l/font', 'kit=abcdefgh123&skey=c491285d6722e4fa&v=v20&x=1')).toBe('https://fonts.gstatic.com/l/font?kit=abcdefgh123&skey=c491285d6722e4fa&v=v20')
    expect(urlArquivoGoogle('/fontes/arquivo/s/../../etc/passwd', '')).toBeNull()
    expect(urlArquivoGoogle('/fontes/arquivo/s/a/v1/x.woff2', 'q=1')).toBeNull()
    expect(urlArquivoGoogle('/fontes/arquivo/l/font', 'kit=<x>')).toBeNull()
    expect(urlArquivoGoogle('/fontes/arquivo/outra/coisa', '')).toBeNull()
  })
})
