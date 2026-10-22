/**
 * Fontes citadas num manual de marca → famílias que as telas conseguem usar: o catálogo do Google Fonts (e as
 * locais do app) e, para as fontes comerciais que não estão no Google (Gotham, Helvetica, Futura…), a mais
 * parecida, com aviso. Puro: o catálogo chega por parâmetro (lib/fontes/catalogo.ts).
 */
import { chaveFonte, mapearFonte, type Catalogo } from '@/lib/fontes/catalogo'

/**
 * Fontes comerciais (ou de sistema) frequentes em manuais de marca e a família do Google mais parecida em
 * desenho, proporção e tom. A chave é o nome normalizado (`chaveFonte`).
 */
const PARECIDAS: Record<string, string> = {
  helvetica: 'Inter', helveticaneue: 'Inter', arial: 'Arimo', univers: 'Inter', akzidenzgrotesk: 'Inter', neuehaasgrotesk: 'Inter', neuehaasunica: 'Inter',
  sanfrancisco: 'Inter', sfpro: 'Inter', sfprodisplay: 'Inter', sfprotext: 'Inter', segoeui: 'Open Sans', calibri: 'Carlito', cambria: 'Caladea', verdana: 'Noto Sans', tahoma: 'Noto Sans',
  gotham: 'Montserrat', gothamrounded: 'Nunito', proximanova: 'Montserrat', avenir: 'Nunito Sans', avenirnext: 'Nunito Sans', futura: 'Jost', futurapt: 'Jost', centurygothic: 'Questrial',
  circular: 'DM Sans', circularstd: 'DM Sans', graphik: 'Inter', gilroy: 'Plus Jakarta Sans', sofiapro: 'Plus Jakarta Sans', brandongrotesque: 'Josefin Sans', museosans: 'Mulish',
  gillsans: 'Lato', frutiger: 'Hind', myriad: 'Source Sans 3', myriadpro: 'Source Sans 3', din: 'Barlow', dinpro: 'Barlow', dinnext: 'Barlow', ffdin: 'Barlow', tradegothic: 'Archivo Narrow',
  franklingothic: 'Libre Franklin', itcfranklingothic: 'Libre Franklin', optima: 'Marcellus', eurostile: 'Michroma', bebas: 'Bebas Neue', aktivgrotesk: 'Inter', apercu: 'Work Sans', gtwalsheim: 'Work Sans',
  gtamerica: 'Inter', suisseintl: 'Inter', tttnorms: 'Manrope', ttnorms: 'Manrope', aeonik: 'Manrope', neuemontreal: 'Inter', sharpgrotesk: 'Space Grotesk', founders: 'Inter', foundersgrotesk: 'Inter',
  timesnewroman: 'Tinos', times: 'Tinos', garamond: 'EB Garamond', adobegaramond: 'EB Garamond', baskerville: 'Libre Baskerville', bodoni: 'Bodoni Moda', didot: 'Playfair Display', caslon: 'Libre Caslon Text',
  minion: 'Crimson Pro', minionpro: 'Crimson Pro', palatino: 'EB Garamond', rockwell: 'Roboto Slab', clarendon: 'Domine', chronicle: 'Source Serif 4', tiempos: 'Source Serif 4', tiemposheadline: 'DM Serif Display',
  canela: 'DM Serif Display', freight: 'Crimson Pro', freightdisplay: 'Playfair Display', saol: 'Playfair Display', recoleta: 'Fraunces', cooper: 'Fraunces', georgiapro: 'Gelasio',
  couriernew: 'Courier Prime', courier: 'Courier Prime', consolas: 'Inconsolata', menlo: 'JetBrains Mono', sfmono: 'JetBrains Mono', monaco: 'JetBrains Mono',
}

/** Palavras que, sozinhas, não são nome de fonte (aparecem junto do nome: "Montserrat Bold", "Display"). */
const GENERICAS = new Set(['display', 'sans', 'serif', 'regular', 'bold', 'light', 'medium', 'black', 'italic', 'book', 'mono', 'text', 'texto', 'fonte', 'fontes', 'tipografia', 'titulos', 'titulo', 'pro', 'std', 'neue', 'semibold', 'thin', 'heavy', 'condensed', 'extended', 'variable', 'web', 'google', 'font', 'fonts', 'typeface', 'familia', 'principal', 'secundaria', 'apoio', 'headline', 'body', 'numeros', 'dados', 'peso', 'pesos', 'corpo', 'cor', 'cores', 'logo', 'marca', 'uso', 'para', 'com', 'em', 'de', 'e', 'a', 'o'])
/** Sufixos que denunciam um nome de fonte desconhecido ("Acme Sans", "Nova Grotesk"). */
const RE_CARA_DE_FONTE = /\b(sans|serif|grotesk|grotesque|gothic|mono|slab|display|script|pro|std|neue|text)\b/i
/** Pesos e estilos no fim do nome ("Gotham Bold", "Inter SemiBold Italic"). */
const RE_PESO = /\s+(?:thin|hairline|extra ?light|ultra ?light|light|regular|normal|book|roman|medium|semi ?bold|demi ?bold|bold|extra ?bold|ultra ?bold|black|heavy|italic|oblique|condensed|variable)\b.*$/i

export interface FonteReconhecida {
  /** Família que as telas usam. */
  familia: string
  /** Como apareceu no manual. */
  original: string
  /** Não está no catálogo: `familia` é a mais parecida. */
  substituta: boolean
}

/** Família parecida para um nome fora do catálogo, pela categoria que o nome sugere. */
function parecidaPorCategoria(nome: string): string {
  if (/mono|code|courier/i.test(nome)) return 'IBM Plex Mono'
  if (/slab/i.test(nome)) return 'Roboto Slab'
  if (/script|hand|brush|signature/i.test(nome)) return 'Caveat'
  if (/serif/i.test(nome) && !/sans/i.test(nome)) return 'Source Serif 4'
  return 'Inter'
}

/**
 * Reconhece um nome de fonte: no catálogo (com ou sem peso no nome), na tabela de comerciais parecidas, ou com
 * cara de fonte ("Acme Sans") — esta última só com `aceitarDesconhecida`. Devolve null quando não parece fonte.
 */
export function reconhecerFonte(cat: Catalogo, nome: string, aceitarDesconhecida = false): FonteReconhecida | null {
  const original = nome.replace(/\s+/g, ' ').trim().replace(/^['"“”]|['"“”]$/g, '').replace(/\s+(?:t[ií]tulos?|textos?|n[uú]meros?|corpo|body|e|and)$/i, '')
  if (!original || original.length > 60) return null
  const chave = chaveFonte(original)
  if (!chave || GENERICAS.has(chave)) return null
  const doCatalogo = mapearFonte(cat, original)
  if (doCatalogo && !GENERICAS.has(chaveFonte(doCatalogo.familia))) return { familia: doCatalogo.familia, original, substituta: false }
  const semPeso = original.replace(RE_PESO, '').trim()
  const chaveBase = chaveFonte(semPeso)
  if (semPeso !== original && !GENERICAS.has(chaveBase)) {
    const base = cat.porChave.get(chaveBase)
    if (base) return { familia: base.familia, original, substituta: false }
  }
  // comerciais conhecidas: "Gotham Rounded" antes de "Gotham"
  const candidatas = [chave, chaveBase, chaveBase.replace(/(pro|std|lt|mt|ltstd)$/, '')]
  for (const c of candidatas) {
    const parecida = PARECIDAS[c]
    if (parecida && cat.porNome.has(parecida)) return { familia: parecida, original: semPeso || original, substituta: true }
  }
  if (aceitarDesconhecida && RE_CARA_DE_FONTE.test(original) && /^[A-Z]/.test(original)) {
    const parecida = parecidaPorCategoria(original)
    if (cat.porNome.has(parecida)) return { familia: parecida, original: semPeso || original, substituta: true }
  }
  return null
}

/**
 * Nomes de fonte numa linha de texto: janelas de 1 a 4 palavras com inicial maiúscula (ou entre aspas),
 * da mais longa para a mais curta, sem sobrepor. "Títulos: Montserrat Bold · Textos: Source Sans 3".
 */
export function fontesNaLinha(cat: Catalogo, linha: string, aceitarDesconhecida = false): FonteReconhecida[] {
  const saida: FonteReconhecida[] = []
  const palavras = [...linha.matchAll(/[\p{L}\d][\p{L}\d'’.+-]*/gu)].map((m) => ({ p: m[0], i: m.index ?? 0 }))
  let k = 0
  while (k < palavras.length) {
    let achou: { f: FonteReconhecida; n: number } | null = null
    // a janela começa num nome (não em "Fonte", "Tipografia", "Display"…)
    if (/^[\p{Lu}\d]/u.test(palavras[k]!.p) && !/^\d+$/.test(palavras[k]!.p) && !GENERICAS.has(chaveFonte(palavras[k]!.p))) {
      // só palavras com maiúscula ou número ("Source Serif 4"): "IBM Plex Mono para números" para no "para"
      let ate = k + 1
      while (ate < palavras.length && ate - k < 4 && /^[\p{Lu}\d]/u.test(palavras[ate]!.p)) ate++
      for (let n = ate - k; n >= 1 && !achou; n--) {
        const janela = palavras.slice(k, k + n)
        // a janela não pode atravessar pontuação forte ("Montserrat, Lato")
        const trecho = linha.slice(janela[0]!.i, janela[n - 1]!.i + janela[n - 1]!.p.length)
        if (/[,;:|·/()]/.test(trecho)) continue
        const f = reconhecerFonte(cat, trecho, aceitarDesconhecida && n >= 2)
        if (f) achou = { f, n }
      }
    }
    if (achou) {
      if (!saida.some((x) => x.familia === achou!.f.familia)) saida.push(achou.f)
      k += achou.n
    } else k++
  }
  return saida
}
