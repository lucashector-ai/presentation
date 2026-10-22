/**
 * Conferência da marca nas camadas geradas (depois do desenho, pela IA ou local, e da montagem; sem IA, grátis):
 * com um manual de marca aplicado, toda camada de texto usa uma fonte da marca (títulos, textos ou números) e
 * nenhuma cor saturada fora da paleta sobra nas camadas (ela vira a cor da marca de matiz mais próximo).
 * Neutros (fundos, tintas, cinzas), as cores do tema já com a marca, as da paleta do manual e as variações delas
 * (misturas com o fundo, transparência) ficam como estão; as cores que a pessoa pediu no texto já estão no tema,
 * então o pedido continua mandando sobre o manual.
 * Puro: opera nas telas antes do `parseDocumento` (lib/ia/roteiro.ts, `montarDocumento`).
 */
import { coresIndicador, type Marca, type TemaVisual } from '@/lib/ia/designSystem'
import { hsl } from '@/lib/ia/marca'
import type { PerfilMarca } from './perfil'

type Camada = Record<string, unknown>
interface TelaMontada { background?: unknown; backgroundGradient?: unknown; layers: Camada[] }

const RE_COR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i
const saturada = (hex: string) => { const { s, l } = hsl(hex); return s >= 0.32 && l >= 0.14 && l <= 0.86 }
const difMatiz = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

/** Fontes que a marca permite: as do tema (já com a marca) e a dos números do manual. */
export function fontesDaMarca(tema: TemaVisual, perfil: PerfilMarca | null | undefined): { titulo: string; texto: string; numeros: string } {
  return { titulo: tema.fontes.titulo, texto: tema.fontes.texto, numeros: perfil?.fontes.numeros?.familia ?? tema.fontes.texto }
}

export interface RelatorioMarca { fontesTrocadas: number; coresTrocadas: number }

/**
 * Garante as fontes e as cores da marca nas camadas. Só age com um perfil de marca (manual aplicado); sem ele,
 * as telas ficam como o estilo as montou. Devolve quantas fontes e cores foram trocadas.
 */
export function garantirMarcaNasCamadas(telas: TelaMontada[], tema: TemaVisual, marca: Marca | undefined): RelatorioMarca {
  const r: RelatorioMarca = { fontesTrocadas: 0, coresTrocadas: 0 }
  const perfil = marca?.perfil
  if (!perfil) return r
  const fontes = fontesDaMarca(tema, perfil)
  const permitidas = new Set([fontes.titulo, fontes.texto, fontes.numeros])
  // cores saturadas aceitas: as do tema com a marca, as indicadoras e a paleta do manual e da marca
  const base = [tema.acento, tema.acento2, tema.sobreAcento, tema.claro.fundo, tema.escuro.fundo, tema.claro.tinta, tema.escuro.tinta, ...[tema.claro.fundo, tema.escuro.fundo, tema.acento].flatMap((f) => Object.values(coresIndicador(tema, f))), ...perfil.cores.map((c) => c.hex), ...(marca?.cores ?? [])]
  const aceitas = base.filter((c) => RE_COR.test(c)).map((c) => c.slice(0, 7).toUpperCase()).filter(saturada).map((c) => ({ c, h: hsl(c).h }))
  const alvos = aceitas.filter((x) => x.c === tema.acento.slice(0, 7).toUpperCase() || x.c === tema.acento2.slice(0, 7).toUpperCase())
  const ajustar = (v: unknown): unknown => {
    if (typeof v !== 'string' || !RE_COR.test(v) || !aceitas.length) return v
    const hex = v.slice(0, 7).toUpperCase()
    if (!saturada(hex)) return v
    const h = hsl(hex).h
    if (aceitas.some((x) => difMatiz(x.h, h) <= 22)) return v
    const destino = [...(alvos.length ? alvos : aceitas)].sort((a, b) => difMatiz(a.h, h) - difMatiz(b.h, h))[0]!
    r.coresTrocadas++
    return destino.c + v.slice(7)
  }
  const ajustarGradiente = (g: unknown) => {
    if (!g || typeof g !== 'object' || !Array.isArray((g as { stops?: unknown }).stops)) return g
    const gg = g as { stops: { color: unknown; pos: number }[] }
    return { ...gg, stops: gg.stops.map((s) => ({ ...s, color: ajustar(s.color) })) }
  }
  for (const t of telas) {
    t.background = ajustar(t.background)
    if (t.backgroundGradient) t.backgroundGradient = ajustarGradiente(t.backgroundGradient)
    for (const l of t.layers) {
      for (const k of ['fill', 'color', 'stroke', 'background'] as const) if (k in l) l[k] = ajustar(l[k])
      if (l.gradient) l.gradient = ajustarGradiente(l.gradient)
      if (l.type === 'text' && typeof l.fontFamily === 'string' && !permitidas.has(l.fontFamily)) {
        // mono (rótulos, números de tabela e de gráfico) vira a fonte de números do manual; o resto, a dos textos
        l.fontFamily = /mono/i.test(l.fontFamily) ? fontes.numeros : fontes.texto
        r.fontesTrocadas++
      }
    }
  }
  return r
}
