/**
 * Árvore de camadas (frames → filhos via `parentId`). Puro e sem DOM.
 * As camadas continuam numa lista plana com coordenadas absolutas; a árvore só define
 * pertencimento, ordem de fluxo (z crescente = ordem no auto layout) e empilhamento.
 */
import type { Camada, CamadaFrame } from './schema'

export type MapaCamadas = ReadonlyMap<string, Camada>

export const ehFrame = (c: Camada | undefined): c is CamadaFrame => c?.type === 'frame'
export const temAutoLayout = (c: Camada | undefined): c is CamadaFrame & { layout: NonNullable<CamadaFrame['layout']> } => c?.type === 'frame' && !!c.layout

export function mapaDe(camadas: readonly Camada[]): Map<string, Camada> {
  return new Map(camadas.map((c) => [c.id, c]))
}

/** Pai válido (existe, é frame e não cria ciclo). */
export function paiDe(c: Camada, mapa: MapaCamadas): CamadaFrame | undefined {
  if (!c.parentId || c.parentId === c.id) return undefined
  const p = mapa.get(c.parentId)
  return ehFrame(p) ? p : undefined
}

/** Ancestrais do mais próximo ao mais externo (protegido contra ciclos). */
export function ancestrais(c: Camada, mapa: MapaCamadas): CamadaFrame[] {
  const r: CamadaFrame[] = []
  const vistos = new Set([c.id])
  let p = paiDe(c, mapa)
  while (p && !vistos.has(p.id)) {
    r.push(p)
    vistos.add(p.id)
    p = paiDe(p, mapa)
  }
  return r
}

/** Filhos diretos em ordem de fluxo (z crescente). */
export function filhosDe(id: string, camadas: readonly Camada[]): Camada[] {
  return camadas.filter((c) => c.parentId === id && c.id !== id).sort((a, b) => a.z - b.z)
}

/** Todos os descendentes (qualquer profundidade). */
export function descendentes(id: string, camadas: readonly Camada[]): Camada[] {
  const porPai = new Map<string, Camada[]>()
  for (const c of camadas) if (c.parentId && c.parentId !== c.id) porPai.set(c.parentId, [...(porPai.get(c.parentId) ?? []), c])
  const r: Camada[] = []
  const vistos = new Set([id])
  const pilha = [...(porPai.get(id) ?? [])]
  while (pilha.length) {
    const c = pilha.pop()!
    if (vistos.has(c.id)) continue
    vistos.add(c.id)
    r.push(c)
    pilha.push(...(porPai.get(c.id) ?? []))
  }
  return r
}

/** IDs + todos os descendentes. */
export function comDescendentes(ids: readonly string[], camadas: readonly Camada[]): string[] {
  const s = new Set(ids)
  for (const id of ids) for (const d of descendentes(id, camadas)) s.add(d.id)
  return [...s]
}

/** Mantém só as raízes da seleção (remove itens cujo ancestral também está selecionado). */
export function raizesDaSelecao(ids: readonly string[], camadas: readonly Camada[]): string[] {
  const mapa = mapaDe(camadas)
  const s = new Set(ids)
  return ids.filter((id) => {
    const c = mapa.get(id)
    return c ? !ancestrais(c, mapa).some((a) => s.has(a.id)) : false
  })
}

/** Ancestral mais externo (ou a própria camada). */
export function raizDe(c: Camada, mapa: MapaCamadas): Camada {
  const a = ancestrais(c, mapa)
  return a[a.length - 1] ?? c
}

/**
 * Qual camada um clique seleciona (modelo do Figma): fora de qualquer contexto, o frame mais externo;
 * se a seleção atual já está dentro de um frame (irmãos ou filhos), o clique fica nesse nível.
 * `profundo` (⌘/Ctrl+clique) seleciona direto a camada sob o cursor.
 */
export function alvoDoClique(atingida: Camada, camadas: readonly Camada[], selecao: readonly string[], profundo = false): Camada {
  if (profundo) return atingida
  const mapa = mapaDe(camadas)
  const cadeia: Camada[] = [...ancestrais(atingida, mapa)].reverse()
  cadeia.push(atingida) // externo → atingida
  const sel = selecao.map((id) => mapa.get(id)).filter((x): x is Camada => !!x)
  for (let i = cadeia.length - 1; i >= 0; i--) {
    const nivel = cadeia[i]!
    const paiNivel = nivel.parentId && mapa.has(nivel.parentId) ? nivel.parentId : undefined
    if (paiNivel === undefined) continue
    // a seleção já está neste nível (o próprio item ou um irmão dentro do mesmo frame)
    if (sel.some((s) => s.id === nivel.id || s.parentId === paiNivel)) return nivel
  }
  return cadeia[0]!
}

/**
 * Ordena o empilhamento como árvore: cada frame logo abaixo dos seus descendentes, irmãos por z.
 * Sem frames/parentId devolve a mesma lista (documentos antigos não mudam).
 */
export function normalizarArvore(camadas: readonly Camada[]): Camada[] {
  if (!camadas.some((c) => c.parentId || c.type === 'frame')) return camadas as Camada[]
  const mapa = mapaDe(camadas)
  const porPai = new Map<string | undefined, Camada[]>()
  for (const c of camadas) {
    const pai = paiDe(c, mapa) && !ancestrais(c, mapa).some((a) => a.id === c.id) ? c.parentId : undefined
    porPai.set(pai, [...(porPai.get(pai) ?? []), c])
  }
  for (const l of porPai.values()) l.sort((a, b) => a.z - b.z || camadas.indexOf(a) - camadas.indexOf(b))
  const ordem: Camada[] = []
  const vistos = new Set<string>()
  const visitar = (c: Camada) => {
    if (vistos.has(c.id)) return
    vistos.add(c.id)
    ordem.push(c)
    for (const f of porPai.get(c.id) ?? []) visitar(f)
  }
  for (const r of porPai.get(undefined) ?? []) visitar(r)
  for (const c of camadas) visitar(c) // ciclos/órfãos
  const z = new Map(ordem.map((c, i) => [c.id, i]))
  let mudou = false
  const r = camadas.map((c) => {
    const nz = z.get(c.id)!
    const parentId = c.parentId && !paiDe(c, mapa) ? undefined : c.parentId
    if (nz === c.z && parentId === c.parentId) return c
    mudou = true
    const n = { ...c, z: nz } as Camada
    if (parentId === undefined) delete (n as { parentId?: string }).parentId
    return n
  })
  return mudou ? r : (camadas as Camada[])
}

/** Ocultas por si ou por um ancestral oculto. */
export function ocultasEfetivas(camadas: readonly Camada[]): Set<string> {
  const mapa = mapaDe(camadas)
  const r = new Set<string>()
  for (const c of camadas) if (c.hidden || ancestrais(c, mapa).some((a) => a.hidden)) r.add(c.id)
  return r
}
