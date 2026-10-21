/**
 * Operações de edição do documento (colaboração em tempo real).
 *
 * Modelo: o documento é uma árvore de objetos com propriedades (documento → telas → camadas). Cada mudança local
 * vira uma lista de operações por objeto e por PROPRIEDADE (`diferenca`), e o servidor (Durable Object da sala)
 * as ordena com um número de sequência. A propriedade mais recente vence (last-writer-wins por propriedade, na
 * ordem do servidor), como no Figma: duas pessoas mexendo em camadas diferentes, ou em propriedades diferentes da
 * mesma camada, nunca se atrapalham; na MESMA propriedade, vale a última que chegou ao servidor.
 *
 * Tudo aqui é puro e determinístico: o servidor e cada cliente aplicam as mesmas operações na mesma ordem e chegam
 * ao mesmo documento (`aplicarOps`). O desfazer de cada pessoa é a diferença inversa da ação dela (`diferenca(depois,
 * antes)`), aplicada sobre o documento ATUAL — então só desfaz o que ela mesma fez.
 */
import type { Camada, Cena, DocumentoProjeto } from '@/lib/scene/schema'

export type Props = Record<string, unknown>

export type Op =
  /** Propriedades do documento (tema…), exceto `scenes`. `d` = chaves removidas. */
  | { o: 'doc'; p?: Props; d?: string[] }
  /** Insere (ou substitui) uma tela inteira depois de `apos` (null = no início). */
  | { o: 'cena+'; cena: Cena; apos: string | null }
  | { o: 'cena-'; id: string }
  /** Propriedades de uma tela, exceto `layers` e `id`. */
  | { o: 'cena'; id: string; p?: Props; d?: string[] }
  /** Ordem relativa das telas listadas (as não listadas ficam onde estão). */
  | { o: 'cenas'; ids: string[] }
  /** Insere (ou substitui) uma camada na tela `c`, depois de `apos` na lista (null = no início). */
  | { o: 'cam+'; c: string; l: Camada; apos: string | null }
  | { o: 'cam-'; c: string; id: string }
  /** Propriedades de uma camada, exceto `id`. */
  | { o: 'cam'; c: string; id: string; p?: Props; d?: string[] }
  /** Ordem relativa das camadas listadas na lista da tela `c`. */
  | { o: 'cams'; c: string; ids: string[] }

// ---------- igualdade estrutural (valores JSON) ----------

export function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a !== a && b !== b // NaN
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!iguais(a[i], b[i])) return false
    return true
  }
  if (Array.isArray(b)) return false
  const ka = Object.keys(a as object).filter((k) => (a as Props)[k] !== undefined)
  const kb = Object.keys(b as object).filter((k) => (b as Props)[k] !== undefined)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (!iguais((a as Props)[k], (b as Props)[k])) return false
  return true
}

/** Chaves que nunca entram num patch (estrutura ou identidade). */
const RESERVADAS = new Set(['__proto__', 'constructor', 'prototype'])

function patch(x: object, y: object, fora: string): { p?: Props; d?: string[] } | null {
  const a = x as Props
  const b = y as Props
  let p: Props | undefined
  let d: string[] | undefined
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of chaves) {
    if (k === fora || k === 'id' || RESERVADAS.has(k)) continue
    const va = a[k]
    const vb = b[k]
    if (vb === undefined) {
      if (va !== undefined) (d ??= []).push(k)
    } else if (va === undefined || !iguais(va, vb)) (p ??= {})[k] = vb
  }
  return p || d ? { ...(p ? { p } : {}), ...(d ? { d } : {}) } : null
}

function mesmaOrdem(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

function diferencaCamadas(c: string, a: Camada[], b: Camada[], ops: Op[]) {
  const ma = new Map(a.map((l) => [l.id, l]))
  const mb = new Map(b.map((l) => [l.id, l]))
  for (const l of a) if (!mb.has(l.id)) ops.push({ o: 'cam-', c, id: l.id })
  const comunsA = a.filter((l) => mb.has(l.id)).map((l) => l.id)
  const comunsB = b.filter((l) => ma.has(l.id)).map((l) => l.id)
  if (!mesmaOrdem(comunsA, comunsB)) ops.push({ o: 'cams', c, ids: comunsB })
  b.forEach((l, i) => {
    const antes = ma.get(l.id)
    if (!antes) {
      ops.push({ o: 'cam+', c, l, apos: i ? b[i - 1]!.id : null })
      return
    }
    if (antes === l) return
    const pc = patch(antes, l, 'id')
    if (pc) ops.push({ o: 'cam', c, id: l.id, ...pc })
  })
}

/** Operações que levam `a` a `b`. `diferenca(b, a)` é o inverso (desfazer). */
export function diferenca(a: DocumentoProjeto, b: DocumentoProjeto): Op[] {
  if (a === b) return []
  const ops: Op[] = []
  const pd = patch(a, b, 'scenes')
  if (pd) ops.push({ o: 'doc', ...pd })
  if (a.scenes === b.scenes) return ops
  const ma = new Map(a.scenes.map((s) => [s.id, s]))
  const mb = new Map(b.scenes.map((s) => [s.id, s]))
  for (const s of a.scenes) if (!mb.has(s.id)) ops.push({ o: 'cena-', id: s.id })
  const comunsA = a.scenes.filter((s) => mb.has(s.id)).map((s) => s.id)
  const comunsB = b.scenes.filter((s) => ma.has(s.id)).map((s) => s.id)
  if (!mesmaOrdem(comunsA, comunsB)) ops.push({ o: 'cenas', ids: comunsB })
  b.scenes.forEach((s, i) => {
    const antes = ma.get(s.id)
    if (!antes) {
      ops.push({ o: 'cena+', cena: s, apos: i ? b.scenes[i - 1]!.id : null })
      return
    }
    if (antes === s) return
    const pc = patch(antes, s, 'layers')
    if (pc) ops.push({ o: 'cena', id: s.id, ...pc })
    if (antes.layers !== s.layers) diferencaCamadas(s.id, antes.layers, s.layers, ops)
  })
  return ops
}

// ---------- aplicar ----------

function mesclar<T extends object>(obj: T, p: Props | undefined, d: string[] | undefined, protegidas: string[]): T {
  let mudou = false
  const novo: Props = { ...(obj as Props) }
  if (p) {
    for (const [k, v] of Object.entries(p)) {
      if (protegidas.includes(k) || RESERVADAS.has(k)) continue
      if (novo[k] !== v) { novo[k] = v; mudou = true }
    }
  }
  if (d) {
    for (const k of d) {
      if (protegidas.includes(k) || RESERVADAS.has(k)) continue
      if (k in novo) { delete novo[k]; mudou = true }
    }
  }
  return mudou ? (novo as T) : obj
}

function inserirDepois<T extends { id: string }>(lista: T[], item: T, apos: string | null): T[] {
  const sem = lista.filter((x) => x.id !== item.id)
  const i = apos === null ? -1 : sem.findIndex((x) => x.id === apos)
  const pos = apos === null ? 0 : i < 0 ? sem.length : i + 1
  sem.splice(pos, 0, item)
  return sem
}

/** Reordena só os itens listados, nos lugares que eles já ocupam; os demais não se movem. */
function reordenar<T extends { id: string }>(lista: T[], ids: string[]): T[] {
  const alvo = new Set(ids)
  const porId = new Map(lista.map((x) => [x.id, x]))
  const ordem = ids.filter((id, i) => porId.has(id) && ids.indexOf(id) === i).map((id) => porId.get(id)!)
  const vagas = lista.filter((x) => alvo.has(x.id)).length
  if (ordem.length !== vagas) return lista
  let k = 0
  let mudou = false
  const nova = lista.map((x) => {
    if (!alvo.has(x.id)) return x
    const y = ordem[k++]!
    if (y !== x) mudou = true
    return y
  })
  return mudou ? nova : lista
}

function naCena(doc: DocumentoProjeto, id: string, fn: (c: Cena) => Cena): DocumentoProjeto {
  let mudou = false
  const scenes = doc.scenes.map((s) => {
    if (s.id !== id) return s
    const n = fn(s)
    if (n !== s) mudou = true
    return n
  })
  return mudou ? { ...doc, scenes } : doc
}

export function aplicarOp(doc: DocumentoProjeto, op: Op): DocumentoProjeto {
  switch (op.o) {
    case 'doc':
      return mesclar(doc, op.p, op.d, ['scenes'])
    case 'cena+':
      return { ...doc, scenes: inserirDepois(doc.scenes, op.cena, op.apos) }
    case 'cena-': {
      if (!doc.scenes.some((s) => s.id === op.id)) return doc
      return { ...doc, scenes: doc.scenes.filter((s) => s.id !== op.id) }
    }
    case 'cena':
      return naCena(doc, op.id, (s) => mesclar(s, op.p, op.d, ['id', 'layers']))
    case 'cenas': {
      const scenes = reordenar(doc.scenes, op.ids)
      return scenes === doc.scenes ? doc : { ...doc, scenes }
    }
    case 'cam+':
      return naCena(doc, op.c, (s) => ({ ...s, layers: inserirDepois(s.layers, op.l, op.apos) }))
    case 'cam-':
      return naCena(doc, op.c, (s) => (s.layers.some((l) => l.id === op.id) ? { ...s, layers: s.layers.filter((l) => l.id !== op.id) } : s))
    case 'cam':
      return naCena(doc, op.c, (s) => {
        let mudou = false
        const layers = s.layers.map((l) => {
          if (l.id !== op.id) return l
          const n = mesclar(l, op.p, op.d, ['id'])
          if (n !== l) mudou = true
          return n
        })
        return mudou ? { ...s, layers } : s
      })
    case 'cams':
      return naCena(doc, op.c, (s) => {
        const layers = reordenar(s.layers, op.ids)
        return layers === s.layers ? s : { ...s, layers }
      })
  }
}

export function aplicarOps(doc: DocumentoProjeto, ops: readonly Op[]): DocumentoProjeto {
  let d = doc
  for (const op of ops) d = aplicarOp(d, op)
  return d
}

// ---------- compactar (fila offline, gestos contínuos) ----------

function juntarPatch(alvo: { p?: Props; d?: string[] }, novo: { p?: Props; d?: string[] }): { p?: Props; d?: string[] } {
  const p: Props = { ...(alvo.p ?? {}) }
  const d = new Set(alvo.d ?? [])
  for (const [k, v] of Object.entries(novo.p ?? {})) { p[k] = v; d.delete(k) }
  for (const k of novo.d ?? []) { delete p[k]; d.add(k) }
  return { ...(Object.keys(p).length ? { p } : {}), ...(d.size ? { d: [...d] } : {}) }
}

/**
 * Junta mudanças de propriedade seguidas do mesmo objeto (ex.: 60 movimentos de um arraste viram um só).
 * Só junta quando nada estrutural daquele objeto (ou da tela dele) aconteceu no meio, então o resultado de
 * aplicar a lista compactada é o mesmo de aplicar a original.
 */
export function compactar(ops: readonly Op[]): Op[] {
  const saida: (Op | null)[] = []
  const ultimo = new Map<string, number>()
  const esquecerCena = (c: string) => { for (const k of [...ultimo.keys()]) if (k === `cena:${c}` || k.startsWith(`cam:${c}:`)) ultimo.delete(k) }
  for (const op of ops) {
    switch (op.o) {
      case 'doc': {
        const i = ultimo.get('doc')
        if (i !== undefined) { const a = saida[i] as Extract<Op, { o: 'doc' }>; saida[i] = { o: 'doc', ...juntarPatch(a, op) }; continue }
        ultimo.set('doc', saida.push(op) - 1)
        continue
      }
      case 'cena+':
        esquecerCena(op.cena.id)
        ultimo.set(`cena:${op.cena.id}`, saida.push(op) - 1)
        continue
      case 'cena-':
        esquecerCena(op.id)
        saida.push(op)
        continue
      case 'cena': {
        const i = ultimo.get(`cena:${op.id}`)
        const a = i === undefined ? null : saida[i]
        if (a?.o === 'cena') { saida[i!] = { o: 'cena', id: op.id, ...juntarPatch(a, op) }; continue }
        if (a?.o === 'cena+') { saida[i!] = { ...a, cena: mesclar(a.cena, op.p, op.d, ['id', 'layers']) }; continue }
        ultimo.set(`cena:${op.id}`, saida.push(op) - 1)
        continue
      }
      case 'cam+':
        ultimo.set(`cam:${op.c}:${op.l.id}`, saida.push(op) - 1)
        continue
      case 'cam-':
        ultimo.delete(`cam:${op.c}:${op.id}`)
        saida.push(op)
        continue
      case 'cam': {
        const chave = `cam:${op.c}:${op.id}`
        const i = ultimo.get(chave)
        const a = i === undefined ? null : saida[i]
        if (a?.o === 'cam') { saida[i!] = { o: 'cam', c: op.c, id: op.id, ...juntarPatch(a, op) }; continue }
        if (a?.o === 'cam+') { saida[i!] = { ...a, l: mesclar(a.l, op.p, op.d, ['id']) }; continue }
        ultimo.set(chave, saida.push(op) - 1)
        continue
      }
      case 'cenas':
      case 'cams':
        saida.push(op)
        continue
    }
  }
  return saida.filter((o): o is Op => {
    if (!o) return false
    if (o.o === 'cam' || o.o === 'cena' || o.o === 'doc') return (!!o.p && Object.keys(o.p).length > 0) || !!o.d?.length
    return true
  })
}

/** Tela que a operação toca (null = documento/ordem das telas). */
export function cenaDaOp(op: Op): string | null {
  switch (op.o) {
    case 'cena+': return op.cena.id
    case 'cena-': case 'cena': return op.id
    case 'cam+': case 'cam-': case 'cam': case 'cams': return op.c
    default: return null
  }
}

/** Camada que a operação toca (com a tela), para validar só o que mudou. */
export function camadaDaOp(op: Op): { c: string; id: string } | null {
  switch (op.o) {
    case 'cam+': return { c: op.c, id: op.l.id }
    case 'cam': return { c: op.c, id: op.id }
    default: return null
  }
}
