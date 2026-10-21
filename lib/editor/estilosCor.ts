/**
 * Estilos de cor do documento (lógica pura, testada em estilosCor.test.ts).
 * Os estilos moram em `theme.colorStyles`; uma camada liga uma propriedade de cor a um estilo em
 * `colorStyleIds[prop]` e continua guardando a cor literal (renderizadores e versões antigas não mudam).
 * Editar o estilo reescreve a cor de todas as camadas ligadas, em todas as telas.
 */
import { TemaSchema, type Camada, type DocumentoProjeto, type EstiloCor } from '@/lib/scene/schema'
import { novoId } from '@/lib/scene/order'

export const PROPS_COR = ['fill', 'color', 'stroke', 'background'] as const
export type PropCor = (typeof PROPS_COR)[number]

export function estilosDo(doc: Pick<DocumentoProjeto, 'theme'>): EstiloCor[] {
  return doc.theme?.colorStyles ?? []
}

function comEstilos(doc: DocumentoProjeto, estilos: EstiloCor[]): DocumentoProjeto {
  const tema = doc.theme ?? TemaSchema.parse({})
  return { ...doc, theme: { ...tema, colorStyles: estilos } }
}

/** Nome padrão "Cor 1", "Cor 2"… sem repetir. */
export function proximoNome(estilos: readonly EstiloCor[]): string {
  const usados = new Set(estilos.map((e) => e.name))
  let n = estilos.length + 1
  while (usados.has(`Cor ${n}`)) n++
  return `Cor ${n}`
}

export function criarEstilo(doc: DocumentoProjeto, nome: string, cor: string): { documento: DocumentoProjeto; estilo: EstiloCor } {
  const estilos = estilosDo(doc)
  const estilo: EstiloCor = { id: novoId('cor', estilos), name: (nome.trim() || proximoNome(estilos)).slice(0, 60), color: cor }
  return { documento: adicionarEstilo(doc, estilo), estilo }
}

/** Acrescenta um estilo já criado (ignora se o id já existir). */
export function adicionarEstilo(doc: DocumentoProjeto, estilo: EstiloCor): DocumentoProjeto {
  const estilos = estilosDo(doc)
  return estilos.some((e) => e.id === estilo.id) ? doc : comEstilos(doc, [...estilos, estilo])
}

/**
 * Escreve a cor na propriedade. Com a lista de traços nova (`strokes`), o estilo de traço vale para o
 * primeiro traço da lista (o de cima, como no Figma) e o gradiente dele sai.
 */
function comCorNaProp(c: Camada, prop: PropCor, cor: string): Camada {
  if (prop === 'stroke' && c.strokes?.length) return { ...c, strokes: c.strokes.map((t, i) => (i === 0 ? { ...t, color: cor, gradient: undefined } : t)) } as Camada
  return { ...c, [prop]: cor } as Camada
}

/** Liga a propriedade ao estilo (e aplica a cor). Gradiente de preenchimento/texto sai, como no Figma. */
export function ligarEstilo(c: Camada, prop: PropCor, estilo: EstiloCor): Camada {
  if (!(prop in c) && !(prop === 'stroke' || prop === 'background')) return c
  const limpaGradiente = (prop === 'fill' || prop === 'color') && 'gradient' in c ? { gradient: undefined } : {}
  return { ...comCorNaProp(c, prop, estilo.color), ...limpaGradiente, colorStyleIds: { ...c.colorStyleIds, [prop]: estilo.id } } as Camada
}

/** Remove a ligação (a cor literal fica). */
export function desligarEstilo(c: Camada, prop: PropCor): Camada {
  if (!c.colorStyleIds?.[prop]) return c
  const { [prop]: _fora, ...resto } = c.colorStyleIds
  return { ...c, colorStyleIds: Object.keys(resto).length ? resto : undefined } as Camada
}

/** Grava uma cor numa propriedade: com `estiloId` liga ao estilo, sem ele desliga (editar a cor solta o estilo). */
export function gravarCor(c: Camada, prop: PropCor, cor: string, estiloId?: string): Camada {
  const n = comCorNaProp(c, prop, cor)
  return estiloId ? ({ ...n, colorStyleIds: { ...c.colorStyleIds, [prop]: estiloId } } as Camada) : desligarEstilo(n, prop)
}

function mapearCamadas(doc: DocumentoProjeto, f: (c: Camada) => Camada): DocumentoProjeto {
  let mudou = false
  const scenes = doc.scenes.map((s) => {
    let m = false
    const layers = s.layers.map((l) => { const n = f(l); if (n !== l) m = true; return n })
    if (!m) return s
    mudou = true
    return { ...s, layers }
  })
  return mudou ? { ...doc, scenes } : doc
}

/** Renomeia e/ou troca a cor de um estilo; a cor nova vai para todas as camadas ligadas. */
export function atualizarEstilo(doc: DocumentoProjeto, id: string, patch: Partial<Pick<EstiloCor, 'name' | 'color'>>): DocumentoProjeto {
  const estilos = estilosDo(doc)
  if (!estilos.some((e) => e.id === id)) return doc
  const novos = estilos.map((e) => (e.id === id ? { ...e, ...(patch.name?.trim() ? { name: patch.name.trim().slice(0, 60) } : {}), ...(patch.color ? { color: patch.color } : {}) } : e))
  let d = comEstilos(doc, novos)
  if (patch.color) {
    const cor = patch.color
    d = mapearCamadas(d, (l) => {
      const ids = l.colorStyleIds
      if (!ids) return l
      const props = PROPS_COR.filter((p) => ids[p] === id)
      if (!props.length) return l
      return props.reduce((c, p) => comCorNaProp(c, p, cor), l)
    })
  }
  return d
}

/** Exclui o estilo; as camadas ligadas mantêm a cor e perdem a ligação. */
export function removerEstilo(doc: DocumentoProjeto, id: string): DocumentoProjeto {
  const d = comEstilos(doc, estilosDo(doc).filter((e) => e.id !== id))
  return mapearCamadas(d, (l) => PROPS_COR.reduce((c, p) => (c.colorStyleIds?.[p] === id ? desligarEstilo(c, p) : c), l))
}

/** Quantas camadas usam o estilo (para o aviso ao excluir). */
export function usosDoEstilo(doc: Pick<DocumentoProjeto, 'scenes'>, id: string): number {
  let n = 0
  for (const s of doc.scenes) for (const l of s.layers) if (l.colorStyleIds && PROPS_COR.some((p) => l.colorStyleIds![p] === id)) n++
  return n
}
