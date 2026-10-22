/**
 * Apresentação antiga da empresa (.pptx) → perfil de marca, sem IA (grátis): o tema do PowerPoint
 * (ppt/theme/theme1.xml) traz a paleta (dk1, lt1, dk2, lt2, accent1…6) e o par de fontes (major = títulos,
 * minor = textos). Só esse XML é descompactado (fflate, com teto de tamanho); nada mais do arquivo é lido.
 * Puro: funciona no navegador e no Node.
 */
import { unzipSync } from 'fflate'
import type { Catalogo } from '@/lib/fontes/catalogo'
import { atribuirPapeis } from './extrair'
import { reconhecerFonte } from './fontes'
import { PerfilMarcaSchema, type PapelCor, type PerfilMarca } from './perfil'

/** Maior .pptx aceito (só o tema é lido, mas o zip inteiro passa pela memória). */
export const MAX_BYTES_PPTX = 60 * 1024 * 1024
const MAX_XML_TEMA = 2 * 1024 * 1024

export class ErroPptx extends Error {
  override name = 'ErroLeitura'
}

/** Papel de cada cor do esquema do tema. */
const PAPEL_DO_SLOT: Record<string, PapelCor | null> = { dk1: 'texto', lt1: null, dk2: 'fundoEscuro', lt2: 'fundoClaro', accent1: 'principal', accent2: 'secundaria', accent3: 'destaque', accent4: 'apoio', accent5: 'apoio', accent6: 'apoio' }

/** XML do tema → perfil (paleta com papéis e as fontes de títulos e textos). */
export function perfilDoTemaXml(xml: string, cat: Catalogo, arquivo = ''): PerfilMarca {
  const esquema = /<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/.exec(xml)?.[0] ?? ''
  const cores: { hex: string; papel: PapelCor | null; nome: string }[] = []
  for (const slot of ['accent1', 'dk2', 'lt2', 'accent2', 'accent3', 'dk1', 'accent4', 'accent5', 'accent6']) {
    const bloco = new RegExp(`<a:${slot}>([\\s\\S]*?)</a:${slot}>`).exec(esquema)?.[1] ?? ''
    const hex = /<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/.exec(bloco)?.[1] ?? /<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(bloco)?.[1]
    if (!hex) continue
    const h = `#${hex}`.toUpperCase()
    // o branco e o preto padrão do Office não dizem nada da marca
    if (cores.some((c) => c.hex === h) || ((slot === 'dk1' || slot === 'lt1') && (h === '#000000' || h === '#FFFFFF'))) continue
    cores.push({ hex: h, papel: PAPEL_DO_SLOT[slot] ?? null, nome: `Tema · ${slot}` })
  }
  const fonte = (tipo: 'major' | 'minor') => {
    const bloco = new RegExp(`<a:${tipo}Font>([\\s\\S]*?)</a:${tipo}Font>`).exec(xml)?.[1] ?? ''
    const nome = /<a:latin\s+typeface="([^"]+)"/.exec(bloco)?.[1] ?? ''
    // "+mj-lt" etc. são referências ao próprio tema; fontes do Office ficam como estão (Calibri → Carlito)
    return nome && !nome.startsWith('+') ? reconhecerFonte(cat, nome, true) : null
  }
  return PerfilMarcaSchema.parse({
    origem: { arquivos: arquivo ? [arquivo.slice(0, 120)] : [], resumidoPorIa: false },
    cores: atribuirPapeis(cores),
    fontes: { titulos: fonte('major'), textos: fonte('minor'), numeros: null },
  })
}

/** .pptx (bytes) → perfil, pelo tema do primeiro slide master. */
export function perfilDoPptx(bytes: Uint8Array, cat: Catalogo, arquivo = ''): PerfilMarca {
  if (bytes.byteLength > MAX_BYTES_PPTX) throw new ErroPptx(`A apresentação passa de ${MAX_BYTES_PPTX / 1024 / 1024} MB.`)
  let arquivos: Record<string, Uint8Array>
  try {
    arquivos = unzipSync(bytes, { filter: (f) => /^ppt\/theme\/theme\d+\.xml$/.test(f.name) && f.originalSize <= MAX_XML_TEMA })
  } catch {
    throw new ErroPptx('Este arquivo não é um .pptx válido.')
  }
  const nome = Object.keys(arquivos).sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]))[0]
  if (!nome) throw new ErroPptx('Não encontramos o tema (cores e fontes) nesta apresentação.')
  return perfilDoTemaXml(new TextDecoder().decode(arquivos[nome]), cat, arquivo)
}
