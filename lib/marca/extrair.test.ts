/**
 * Leitura do manual da marca sem IA: um manual fictício gerado aqui (jsPDF, com logo, cores, fontes e regras),
 * lido pelo pdf.js no Node (mesmo `extrairPaginas` e `estruturarPdf` do navegador), e textos soltos.
 */
import { jsPDF } from 'jspdf'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import { beforeAll, describe, expect, it } from 'vitest'
import { montarCatalogo, type Catalogo, type CatalogoBruto } from '@/lib/fontes/catalogo'
import bruto from '@/lib/fontes/catalogo-google.json'
import { extrairPaginas } from '@/lib/pdf/ler'
import { estruturarPdf } from '@/lib/pdf/texto'
import { atribuirPapeis, cmykParaHex, coresDoManual, fontesDoManual, perfilDoTexto, regrasDoManual } from './extrair'
import { reconhecerFonte } from './fontes'
import { gerarManualFicticio, MANUAL_FICTICIO } from './fixtures/manual-ficticio.mjs'
import { analisarImagem, imagensEAmostrasDoPdf, notaDeLogo } from './pdf'
import { marcaDoPerfil } from './perfil'
import { distancia } from '@/lib/ia/marca'

const cat: Catalogo = montarCatalogo(bruto as unknown as CatalogoBruto)

async function abrir(bytes: Uint8Array) {
  const tarefa = pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 })
  return { doc: await tarefa.promise, fechar: () => tarefa.destroy() }
}

describe('manual da marca em PDF (fictício)', () => {
  let texto = ''
  let bytes: Uint8Array
  beforeAll(async () => {
    bytes = gerarManualFicticio({ jsPDF, createCanvas: (w, h) => createCanvas(w, h) })
    const { doc, fechar } = await abrir(bytes)
    try {
      texto = estruturarPdf(await extrairPaginas(doc, (a, b) => pdfjs.Util.transform(a, b) as number[])).texto
    } finally {
      await fechar()
    }
  })

  it('reconhece as cores com os papéis do rótulo, o CMYK convertido e o Pantone', () => {
    const p = perfilDoTexto(texto, cat, 'manual.pdf')
    const papel = (hex: string) => p.cores.find((c) => c.hex === hex)?.papel
    expect(papel(MANUAL_FICTICIO.cores.principal)).toBe('principal')
    expect(papel(MANUAL_FICTICIO.cores.secundaria)).toBe('secundaria')
    expect(papel(MANUAL_FICTICIO.cores.fundoEscuro)).toBe('fundoEscuro')
    expect(papel(MANUAL_FICTICIO.cores.fundoClaro)).toBe('fundoClaro')
    const [c, m, y, k] = MANUAL_FICTICIO.cores.destaqueCmyk
    expect(papel(cmykParaHex(c, m, y, k))).toBe('destaque')
    expect(p.cores.find((x) => x.hex === MANUAL_FICTICIO.cores.principal)?.nome).toMatch(/Azul Vela.*Pantone 2154 C/)
    // RGB e CMYK da mesma cor não viram cores a mais
    expect(p.cores).toHaveLength(5)
    expect(p.origem.arquivos).toEqual(['manual.pdf'])
  })

  it('reconhece as fontes por nível e troca a comercial pela mais parecida do Google, com aviso', () => {
    const p = perfilDoTexto(texto, cat)
    expect(p.fontes.titulos).toMatchObject({ familia: 'Montserrat', substituta: false })
    expect(p.fontes.textos).toMatchObject({ familia: MANUAL_FICTICIO.fontes.textosNoGoogle, substituta: true })
    expect(p.fontes.textos?.original).toMatch(/^Helvetica Neue/)
    expect(p.fontes.numeros).toMatchObject({ familia: 'IBM Plex Mono', substituta: false })
  })

  it('reconhece as regras: área de proteção, tamanho mínimo, não usar, tom de voz, fotos, grafismos e densidade', () => {
    const p = perfilDoTexto(texto, cat)
    expect(p.logo.areaProtecao).toMatch(/área de proteção/)
    expect(p.logo.tamanhoMinimo).toMatch(/24 mm/)
    expect(p.naoFaz.join(' ')).toMatch(/distorça/)
    expect(p.naoFaz.join(' ')).toMatch(/gradientes/)
    expect(p.tom.join(' ')).toMatch(/otimismo/)
    expect(p.termos.evitar).toEqual(expect.arrayContaining(['barato', 'imperdível']))
    expect(p.imagens.join(' ')).toMatch(/luz natural/)
    expect(p.grafismos.join(' ')).toMatch(/Linhas finas/)
    expect(p.densidade).toBe('baixa')
    // a paleta e a tipografia não viram "regras"
    expect([...p.faz, ...p.naoFaz].join(' ')).not.toMatch(/#0B4F8A|Montserrat/)
  })

  it('o perfil vira a marca da montagem: principal, fundo escuro e as outras cores; papéis de fundo claro; fontes', () => {
    const m = marcaDoPerfil(perfilDoTexto(texto, cat))
    expect(m.cores.slice(0, 2)).toEqual([MANUAL_FICTICIO.cores.principal, MANUAL_FICTICIO.cores.fundoEscuro])
    expect(m.cores).toContain(MANUAL_FICTICIO.cores.secundaria)
    expect(m.papeis).toMatchObject({ claro: MANUAL_FICTICIO.cores.fundoClaro })
    expect(m.fontes).toEqual({ titulo: 'Montserrat', texto: 'Inter' })
  })

  it('acha o logo entre as imagens do PDF e as amostras de cor desenhadas', async () => {
    const { doc, fechar } = await abrir(bytes)
    try {
      const r = await imagensEAmostrasDoPdf(doc, pdfjs.OPS as never)
      expect(r.imagens).toHaveLength(1)
      const img = r.imagens[0]!
      expect(img).toMatchObject({ pagina: 1, largura: 360, altura: 120 })
      const analise = analisarImagem(img.rgba!)
      expect(analise.transparencia).toBeGreaterThan(0.2)
      expect(analise.cores[0]).toMatch(/^#/)
      expect(notaDeLogo({ ...img, analise })).toBeGreaterThanOrEqual(5)
      // as amostras são os quadrados de cor da página 2
      // (o pdf.js arredonda os canais: a amostra fica a 1 ponto do hex do manual)
      for (const hex of [MANUAL_FICTICIO.cores.secundaria, MANUAL_FICTICIO.cores.fundoEscuro]) expect(r.amostras.some((a) => distancia(a.hex, hex) < 8)).toBe(true)
    } finally {
      await fechar()
    }
  })
})

describe('cores em texto solto', () => {
  it('hex na mesma linha de vários rótulos, tabela e cor sem hex (RGB)', () => {
    const c = coresDoManual('Primária #1F3B4D · Secundária #E4572E\n\n| Cor | Hex |\n| --- | --- |\n| Fundo escuro | #111111 |\n\nApoio\nRGB 200 200 200')
    expect(c.map((x) => [x.hex, x.papel])).toEqual([['#1F3B4D', 'principal'], ['#E4572E', 'secundaria'], ['#111111', 'fundoEscuro'], ['#C8C8C8', 'apoio']])
  })
  it('sem rótulo: a mais saturada vira a principal, a escura o fundo escuro, a clara o fundo claro', () => {
    const papeis = atribuirPapeis(['#F7F7F2', '#101010', '#2F6BFF', '#9AA0A6'].map((hex) => ({ hex, papel: null, nome: '' })))
    expect(Object.fromEntries(papeis.map((p) => [p.hex, p.papel]))).toEqual({ '#F7F7F2': 'fundoClaro', '#101010': 'fundoEscuro', '#2F6BFF': 'principal', '#9AA0A6': 'secundaria' })
  })
  it('papel único repetido vira apoio', () => {
    expect(atribuirPapeis([{ hex: '#111111', papel: 'principal', nome: '' }, { hex: '#222222', papel: 'principal', nome: '' }]).map((c) => c.papel)).toEqual(['principal', 'apoio'])
  })
})

describe('fontes', () => {
  it('casa com o catálogo (com peso no nome) e sugere a parecida para as comerciais', () => {
    expect(reconhecerFonte(cat, 'PlayfairDisplay-BoldItalic')).toMatchObject({ familia: 'Playfair Display', substituta: false })
    expect(reconhecerFonte(cat, 'Gotham Book')).toMatchObject({ familia: 'Montserrat', substituta: true, original: 'Gotham' })
    expect(reconhecerFonte(cat, 'Futura PT')).toMatchObject({ familia: 'Jost', substituta: true })
    expect(reconhecerFonte(cat, 'Display')).toBeNull()
  })
  it('só procura fontes nas linhas de tipografia (palavras comuns não viram fontes)', () => {
    const f = fontesDoManual('A Prata e a Mate são nossas linhas de produto.\n\n## Tipografia\nTítulos: Lora · Textos: Inter', cat)
    expect(f.titulos?.familia).toBe('Lora')
    expect(f.textos?.familia).toBe('Inter')
    expect(f.outras).toEqual([])
  })
})

describe('regras', () => {
  it('seções e palavras-chave', () => {
    const r = regrasDoManual('## Tom de voz\nSomos calorosos e diretos.\n## Usos incorretos\nDeformar o símbolo.\n## Ícones\nÍcones de traço fino, cantos arredondados.\nSempre use o logo em uma cor.')
    expect(r.tom).toEqual(['Somos calorosos e diretos.'])
    expect(r.naoFaz).toContain('Deformar o símbolo.')
    expect(r.icones[0]).toMatch(/traço fino/)
    expect(r.logo.regras).toContain('Sempre use o logo em uma cor.')
  })
})
