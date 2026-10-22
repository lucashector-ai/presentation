/**
 * Perfil de marca: o que o manual da marca (PDF, imagens, tokens, CSS ou tema de um .pptx) diz sobre a
 * identidade — paleta com papéis, tipografia por nível, tom de voz, termos, faz/não faz, logo, imagens, ícones,
 * grafismos e densidade. Montado sem IA (lib/marca/extrair.ts e vizinhos) e, se a pessoa quiser, resumido pelo
 * Claude (lib/marca/resumo.ts); revisado pela pessoa e salvo no kit de marca do espaço (brand_kits.brand_profile).
 *
 * Prioridade: o pedido escrito pela pessoa manda sobre o manual quando os dois conflitam (cores citadas no pedido
 * ficam no lugar das do manual; o prompt diz ao modelo para seguir o pedido). O texto do manual é sempre tratado
 * como dado, nunca como instrução (ver lib/marca/prompt.ts).
 * Puro: sem rede, sem DOM. Compartilhado entre servidor e cliente.
 */
import { z } from 'zod'

const RE_HEX6 = /^#[0-9a-f]{6}$/i

/** Papel de cada cor da paleta (a montagem usa principal, fundos, cartão e indicadores; o resto vai ao prompt). */
export const PAPEIS_COR = ['principal', 'secundaria', 'destaque', 'fundoEscuro', 'fundoClaro', 'cartao', 'texto', 'positivo', 'negativo', 'apoio'] as const
export type PapelCor = (typeof PAPEIS_COR)[number]
export const NOMES_PAPEL: Record<PapelCor, string> = {
  principal: 'Principal', secundaria: 'Secundária', destaque: 'Destaque', fundoEscuro: 'Fundo escuro', fundoClaro: 'Fundo claro',
  cartao: 'Cartões', texto: 'Texto', positivo: 'Positivo', negativo: 'Negativo', apoio: 'Apoio',
}

export const NIVEIS_FONTE = ['titulos', 'textos', 'numeros'] as const
export type NivelFonte = (typeof NIVEIS_FONTE)[number]
export const NOMES_NIVEL: Record<NivelFonte, string> = { titulos: 'Títulos', textos: 'Textos', numeros: 'Números' }

export const DENSIDADES_MARCA = ['baixa', 'media', 'alta'] as const
export type DensidadeMarca = (typeof DENSIDADES_MARCA)[number]

const texto = (max: number) => z.string().trim().max(max)
const lista = (max: number, tamanho: number) => z.array(z.string().trim().min(1).max(tamanho)).max(max).default([])

export const CorPerfilSchema = z.object({
  hex: z.string().trim().regex(RE_HEX6, 'Cor deve ser #RRGGBB').transform((c) => c.toUpperCase()),
  papel: z.enum(PAPEIS_COR),
  /** Nome no manual ("Azul Aurora · Pantone 2955 C"). */
  nome: texto(80).default(''),
})
export type CorPerfil = z.infer<typeof CorPerfilSchema>

export const FontePerfilSchema = z.object({
  /** Família usada nas telas (do Google Fonts ou local do app). */
  familia: texto(80).min(1),
  /** Como o manual escreve ("Gotham Bold"). */
  original: texto(80).default(''),
  /** A fonte do manual não existe no Google: `familia` é a mais parecida (avisado na revisão). */
  substituta: z.boolean().default(false),
})
export type FontePerfil = z.infer<typeof FontePerfilSchema>

export const PerfilMarcaSchema = z.object({
  versao: z.literal(1).default(1),
  /** De onde veio: nomes dos arquivos lidos e se o Claude resumiu. */
  origem: z.object({ arquivos: lista(12, 120), resumidoPorIa: z.boolean().default(false) }).default({ arquivos: [], resumidoPorIa: false }),
  cores: z.array(CorPerfilSchema).max(12).default([]),
  fontes: z.object({ titulos: FontePerfilSchema.nullable().default(null), textos: FontePerfilSchema.nullable().default(null), numeros: FontePerfilSchema.nullable().default(null) }).default({ titulos: null, textos: null, numeros: null }),
  /** Tom de voz, em frases curtas ("próximo e direto, sem jargão"). */
  tom: lista(8, 240),
  /** Termos da marca: os que se usam e os que se evitam. */
  termos: z.object({ usar: lista(20, 60), evitar: lista(20, 60) }).default({ usar: [], evitar: [] }),
  faz: lista(15, 240),
  naoFaz: lista(15, 240),
  logo: z.object({ areaProtecao: texto(240).default(''), tamanhoMinimo: texto(240).default(''), regras: lista(8, 240) }).default({ areaProtecao: '', tamanhoMinimo: '', regras: [] }),
  /** Estilo de foto e imagem. */
  imagens: lista(6, 240),
  icones: lista(4, 240),
  grafismos: lista(6, 240),
  densidade: z.enum(DENSIDADES_MARCA).nullable().default(null),
})
export type PerfilMarca = z.infer<typeof PerfilMarcaSchema>
export type EntradaPerfil = z.input<typeof PerfilMarcaSchema>

export const PERFIL_VAZIO: PerfilMarca = PerfilMarcaSchema.parse({})

/** Perfil válido a partir de qualquer coisa (kit antigo, JSON do banco): o que não passa vira null. */
export function lerPerfil(v: unknown): PerfilMarca | null {
  if (!v || typeof v !== 'object') return null
  const r = PerfilMarcaSchema.safeParse(v)
  return r.success ? r.data : null
}

/** O perfil tem alguma coisa além da origem? */
export const perfilTemConteudo = (p: PerfilMarca | null | undefined): p is PerfilMarca =>
  !!p && (p.cores.length > 0 || !!(p.fontes.titulos || p.fontes.textos || p.fontes.numeros) || contarRegras(p) > 0)

/** Regras de texto do perfil (tom, termos, faz/não faz, logo, imagens, ícones, grafismos). */
export function contarRegras(p: PerfilMarca): number {
  return p.tom.length + p.termos.usar.length + p.termos.evitar.length + p.faz.length + p.naoFaz.length + p.logo.regras.length + (p.logo.areaProtecao ? 1 : 0) + (p.logo.tamanhoMinimo ? 1 : 0) + p.imagens.length + p.icones.length + p.grafismos.length
}

const corDe = (p: PerfilMarca, papel: PapelCor) => p.cores.find((c) => c.papel === papel)?.hex

/**
 * O que o perfil vira na marca da montagem (lib/ia/designSystem.ts, `aplicarMarca`): até 4 cores na ordem que a
 * montagem entende (principal, fundo escuro, segunda cor de destaque, apoio), os papéis de fundo claro, cartão
 * e indicadores, e o par de fontes (títulos + textos).
 */
export function marcaDoPerfil(p: PerfilMarca): { cores: string[]; papeis: { claro?: string; cartao?: string; positivo?: string; negativo?: string } | null; fontes: { titulo: string; texto: string } | null } {
  const principal = corDe(p, 'principal') ?? p.cores.find((c) => !['fundoClaro', 'fundoEscuro', 'texto', 'cartao', 'positivo', 'negativo'].includes(c.papel))?.hex
  const escuro = corDe(p, 'fundoEscuro')
  const outras = ['secundaria', 'destaque', 'apoio'].flatMap((papel) => p.cores.filter((c) => c.papel === papel).map((c) => c.hex))
  const cores = [...new Set([principal, escuro, ...outras].filter((c): c is string => !!c))].slice(0, 4)
  const papeis = { ...(corDe(p, 'fundoClaro') ? { claro: corDe(p, 'fundoClaro') } : {}), ...(corDe(p, 'cartao') ? { cartao: corDe(p, 'cartao') } : {}), ...(corDe(p, 'positivo') ? { positivo: corDe(p, 'positivo') } : {}), ...(corDe(p, 'negativo') ? { negativo: corDe(p, 'negativo') } : {}) }
  const titulo = p.fontes.titulos?.familia ?? p.fontes.textos?.familia
  const textoF = p.fontes.textos?.familia ?? p.fontes.titulos?.familia
  return { cores, papeis: Object.keys(papeis).length ? papeis : null, fontes: titulo && textoF ? { titulo, texto: textoF } : null }
}

const juntarListas = (a: string[], b: string[], max: number) => {
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const x of [...a, ...b]) {
    const k = x.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!k || vistos.has(k)) continue
    vistos.add(k)
    saida.push(x)
  }
  return saida.slice(0, max)
}

/**
 * Junta dois perfis (ex.: o PDF do manual + os tokens do design system): `a` manda no que os dois têm (papel de
 * cor, fonte de cada nível); listas são somadas sem repetir.
 */
export function combinarPerfis(a: PerfilMarca, b: PerfilMarca): PerfilMarca {
  const cores: CorPerfil[] = [...a.cores]
  for (const c of b.cores) {
    if (cores.some((x) => x.hex === c.hex)) continue
    // papel único já ocupado pelo perfil `a`: entra como apoio
    const unico = ['principal', 'fundoEscuro', 'fundoClaro', 'cartao', 'texto', 'positivo', 'negativo'].includes(c.papel) && cores.some((x) => x.papel === c.papel)
    cores.push(unico ? { ...c, papel: 'apoio' } : c)
  }
  return PerfilMarcaSchema.parse({
    versao: 1,
    origem: { arquivos: juntarListas(a.origem.arquivos, b.origem.arquivos, 12), resumidoPorIa: a.origem.resumidoPorIa || b.origem.resumidoPorIa },
    cores: cores.slice(0, 12),
    fontes: { titulos: a.fontes.titulos ?? b.fontes.titulos, textos: a.fontes.textos ?? b.fontes.textos, numeros: a.fontes.numeros ?? b.fontes.numeros },
    tom: juntarListas(a.tom, b.tom, 8),
    termos: { usar: juntarListas(a.termos.usar, b.termos.usar, 20), evitar: juntarListas(a.termos.evitar, b.termos.evitar, 20) },
    faz: juntarListas(a.faz, b.faz, 15),
    naoFaz: juntarListas(a.naoFaz, b.naoFaz, 15),
    logo: { areaProtecao: a.logo.areaProtecao || b.logo.areaProtecao, tamanhoMinimo: a.logo.tamanhoMinimo || b.logo.tamanhoMinimo, regras: juntarListas(a.logo.regras, b.logo.regras, 8) },
    imagens: juntarListas(a.imagens, b.imagens, 6),
    icones: juntarListas(a.icones, b.icones, 4),
    grafismos: juntarListas(a.grafismos, b.grafismos, 6),
    densidade: a.densidade ?? b.densidade,
  })
}

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "6 cores · 3 fontes · 14 regras" (resumo do que foi reconhecido). */
export function resumoPerfil(p: PerfilMarca): string {
  const fontes = [p.fontes.titulos, p.fontes.textos, p.fontes.numeros].filter(Boolean).map((f) => f!.familia)
  const partes = [
    ...(p.cores.length ? [pl(p.cores.length, 'cor', 'cores')] : []),
    ...(fontes.length ? [pl(new Set(fontes).size, 'fonte', 'fontes')] : []),
    ...(contarRegras(p) ? [pl(contarRegras(p), 'regra', 'regras')] : []),
  ]
  return partes.join(' · ') || 'nada reconhecido'
}
