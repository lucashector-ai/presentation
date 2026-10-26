/**
 * Cores do logo em SVG: regras para o logo seguir a identidade visual. Quem decide é a regra escolhida (ou lida
 * do pedido: "logo em branco", "logo nas cores da marca"…); o resultado é um mapa de troca de cores por fundo
 * (camada SVG com `recolor`, editável depois no painel "Cores do vetor"). Regras que valem sempre:
 *  - o logo nunca some no fundo: sem contraste, vira uma cor só (branco no fundo escuro, a cor escura da marca no claro);
 *  - detalhes claros por dentro (texto vazado num selo) continuam vazados: na versão de uma cor eles levam a cor do fundo;
 *  - cinzas e pretos/brancos do logo são neutros: só as cores com matiz viram as cores da marca.
 * Puro, sem IA.
 */
import { contraste, luminanciaRelativa } from '@/lib/ia/designSystem'

export const MODOS_LOGO = ['auto', 'original', 'marca', 'mono', 'personalizado'] as const
export type ModoLogo = (typeof MODOS_LOGO)[number]

export interface RegraLogo {
  modo: ModoLogo
  /** Uma cor só (modo "mono"): 'auto' = branco no escuro, a cor escura da marca no claro. */
  cor?: string
  /** Troca cor a cor (modo "personalizado"): cor do logo → nova cor. */
  mapa?: Record<string, string>
}

export const NOMES_MODO_LOGO: Record<ModoLogo, string> = {
  auto: 'Automático',
  original: 'Original',
  marca: 'Cores da marca',
  mono: 'Uma cor',
  personalizado: 'Personalizado',
}
export const DICAS_MODO_LOGO: Record<ModoLogo, string> = {
  auto: 'Original onde dá leitura; nas cores da marca ou numa cor só onde sumiria.',
  original: 'As cores do arquivo (vira uma cor só apenas onde sumiria no fundo).',
  marca: 'As cores com matiz viram as cores da identidade, na mesma ordem de destaque.',
  mono: 'Uma cor só, com os detalhes vazados preservados.',
  personalizado: 'Você escolhe a nova cor de cada cor do logo.',
}

const hex = (c: string) => c.trim().toLowerCase()
const rgb = (c: string) => { const h = hex(c).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number] }
/** Saturação (0–1) no modelo HSL: abaixo de ~0,15 a cor é neutra (cinza, preto, branco). */
export function saturacao(c: string): number {
  const [r, g, b] = rgb(c)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  return (max - min) / (l > 0.5 ? 2 - max - min : max + min)
}
/** Neutra: pouca cor (cinza) ou quase preta/quase branca — um azul-marinho de fundo conta como neutro escuro. */
const neutra = (c: string) => { const [r, g, b] = rgb(c); const croma = Math.max(r, g, b) - Math.min(r, g, b); const l = luminanciaRelativa(c); return saturacao(c) < 0.15 || croma < 0.12 || l < 0.03 || l > 0.9 }
const clara = (c: string) => luminanciaRelativa(c) > 0.75
const escura = (c: string) => luminanciaRelativa(c) < 0.3

/** Contraste mínimo para o logo ser lido no fundo (marca gráfica: 3:1, como elementos de interface). */
export const CONTRASTE_LOGO = 3

export interface EntradaRecolor {
  regra: RegraLogo
  /** Cores do SVG (normalizadas #rrggbb), da mais usada para a menos usada. */
  cores: readonly string[]
  /** Fundo atrás do logo nesta tela. */
  fundo: string
  /** Cores da identidade (a 1ª é a principal). */
  marca: readonly string[]
}

/** Cor só do logo para este fundo: branco no escuro; no claro, a cor escura da marca que contrasta (ou quase preto). */
export function corUnicaAuto(fundo: string, marca: readonly string[]): string {
  if (luminanciaRelativa(fundo) < 0.4) {
    const claraMarca = marca.find((c) => clara(c) && contraste(c, fundo) >= 4.5)
    return claraMarca ? hex(claraMarca) : '#ffffff'
  }
  const escuraMarca = [...marca].sort((a, b) => luminanciaRelativa(a) - luminanciaRelativa(b)).find((c) => contraste(c, fundo) >= 4.5)
  return escuraMarca ? hex(escuraMarca) : '#111111'
}

/** A cor que manda na leitura do logo: a mais usada que não é um detalhe claro por dentro. */
function principal(cores: readonly string[]): string | undefined {
  return cores.find((c) => !clara(c)) ?? cores[0]
}

/** O logo, depois da troca, é lido neste fundo? (a cor principal contrasta) */
export function legivel(cores: readonly string[], mapa: Record<string, string>, fundo: string): boolean {
  const p = principal(cores)
  if (!p) return true
  return contraste(mapa[hex(p)] ?? p, fundo) >= CONTRASTE_LOGO
}

/** Uma cor só, com os detalhes claros por dentro levando a cor do fundo (continuam vazados). */
export function mapaUmaCor(cores: readonly string[], cor: string, fundo: string): Record<string, string> {
  const duasCamadas = cores.some(clara) && cores.some((c) => !clara(c))
  const m: Record<string, string> = {}
  for (const c of cores) m[hex(c)] = duasCamadas && clara(c) ? hex(fundo) : hex(cor)
  return m
}

/** Cores com matiz do logo → cores com matiz da marca, na ordem de destaque; neutros ficam (pretos podem virar a cor escura da marca). */
export function mapaDaMarca(cores: readonly string[], marca: readonly string[]): Record<string, string> {
  const vivasMarca = marca.filter((c) => !neutra(c))
  const fonte = vivasMarca.length ? vivasMarca : marca
  const escuraMarca = [...marca].filter(escura).sort((a, b) => luminanciaRelativa(a) - luminanciaRelativa(b))[0]
  const m: Record<string, string> = {}
  let k = 0
  for (const c of cores) {
    if (neutra(c)) {
      if (escura(c) && escuraMarca) m[hex(c)] = hex(escuraMarca)
      continue
    }
    const alvo = fonte[k % Math.max(1, fonte.length)]
    if (alvo) m[hex(c)] = hex(alvo)
    k++
  }
  return m
}

/**
 * Mapa de troca de cores do logo para um fundo, pela regra. Nunca devolve um logo que some: se a versão da regra
 * não contrasta com o fundo, vira uma cor só (automática).
 */
export function recolorDoLogo({ regra, cores, fundo, marca }: EntradaRecolor): Record<string, string> {
  if (!cores.length) return {}
  const seguro = (m: Record<string, string>) => (legivel(cores, m, fundo) ? m : mapaUmaCor(cores, corUnicaAuto(fundo, marca), fundo))
  switch (regra.modo) {
    case 'original':
      return seguro({})
    case 'marca':
      return marca.length ? seguro(mapaDaMarca(cores, marca)) : seguro({})
    case 'mono': {
      const cor = !regra.cor || regra.cor === 'auto' ? corUnicaAuto(fundo, marca) : regra.cor
      return seguro(mapaUmaCor(cores, cor, fundo))
    }
    case 'personalizado':
      return seguro(Object.fromEntries(Object.entries(regra.mapa ?? {}).map(([a, b]) => [hex(a), hex(b)])))
    case 'auto':
    default: {
      if (legivel(cores, {}, fundo)) return {}
      if (marca.length) { const m = mapaDaMarca(cores, marca); if (legivel(cores, m, fundo)) return m }
      return mapaUmaCor(cores, corUnicaAuto(fundo, marca), fundo)
    }
  }
}

/** Regra do logo escrita no pedido ("logo em branco", "logo nas cores da marca", "manter o logo original", "logo #0B4F8A"). */
export function regraLogoDoPedido(texto: string): { regra: RegraLogo; motivo: string } | null {
  const t = texto.toLowerCase()
  // trechos que falam do logo (até ~60 caracteres depois da palavra)
  const trechos = [...t.matchAll(/\b(logo(?:tipo|marca)?|marca gr[aá]fica|s[ií]mbolo)\b([^.\n;]{0,60})/g)].map((m) => m[2] ?? '')
  for (const s of trechos) {
    if (/(original|cores originais|sem alterar|n[aã]o alter|como est[aá]|sem mudar)/.test(s)) return { regra: { modo: 'original' }, motivo: 'manter o logo nas cores originais' }
    const h = s.match(/#[0-9a-f]{6}\b/)
    if (h) return { regra: { modo: 'mono', cor: h[0] }, motivo: `logo na cor ${h[0].toUpperCase()}` }
    if (/\b(branc[oa]|negativ[oa]|vazad[oa])\b/.test(s)) return { regra: { modo: 'mono', cor: '#ffffff' }, motivo: 'logo em branco (escuro onde o fundo for claro, para não sumir)' }
    if (/\b(pret[oa]|positiv[oa])\b/.test(s)) return { regra: { modo: 'mono', cor: '#111111' }, motivo: 'logo em preto (branco onde o fundo for escuro, para não sumir)' }
    if (/monocrom|uma (s[oó] )?cor|cor [uú]nica/.test(s)) return { regra: { modo: 'mono', cor: 'auto' }, motivo: 'logo em uma cor só' }
    if (/(cores? da (marca|identidade|paleta|empresa)|identidade visual|nova (paleta|identidade)|cor principal|paleta nova|nas cores)/.test(s)) return { regra: { modo: 'marca' }, motivo: 'logo nas cores da identidade' }
  }
  return null
}

/** Frase curta da regra (resumo das decisões e mensagens do agente). */
export function descreverRegra(regra: RegraLogo | null | undefined): string {
  if (!regra || regra.modo === 'auto') return 'cores automáticas'
  if (regra.modo === 'mono') return !regra.cor || regra.cor === 'auto' ? 'uma cor só' : `uma cor (${regra.cor.toUpperCase()})`
  if (regra.modo === 'personalizado') return 'cores personalizadas'
  return NOMES_MODO_LOGO[regra.modo].toLowerCase()
}
