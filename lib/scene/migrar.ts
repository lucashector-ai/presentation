/**
 * Migração de documentos antigos para a versão atual do schema. Pura e idempotente:
 * rode sempre antes de validar (API, store, importação de snapshot).
 *
 * v1 → v2:
 *  - `interaction` (única) vira `interactions: []`
 *  - `shadow: true` (imagem/forma) vira `effects.shadow`
 *  - transição `zoom` vira `scale`
 */
import { SCHEMA_VERSION, DocumentoProjetoSchema, type DocumentoProjeto } from './schema'

type Bruto = Record<string, unknown>
const obj = (v: unknown): v is Bruto => !!v && typeof v === 'object' && !Array.isArray(v)

function migrarTransicao(t: unknown): unknown {
  if (!obj(t)) return t
  return t.type === 'zoom' ? { ...t, type: 'scale' } : t
}

function migrarCamadaV1(c: Bruto): Bruto {
  const { interaction, shadow, ...resto } = c
  const nova: Bruto = { ...resto }
  if (obj(interaction)) nova.interactions = [{ ...interaction, transition: migrarTransicao(interaction.transition) }]
  else if (!Array.isArray(nova.interactions)) nova.interactions = []
  if (shadow === true) nova.effects = { ...(obj(nova.effects) ? nova.effects : {}), shadow: { x: 0, y: 20, blur: 50, spread: -20, color: '#00000073' } }
  return nova
}

export function versaoDe(doc: unknown): number {
  return obj(doc) && typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0
}

export function migrarDocumento(entrada: unknown): unknown {
  if (!obj(entrada)) return entrada
  let doc: Bruto = entrada
  const v = versaoDe(doc)
  if (v > SCHEMA_VERSION) return doc // versão futura: deixa a validação recusar
  if (v <= 1) {
    const scenes = Array.isArray(doc.scenes) ? doc.scenes : []
    doc = {
      ...doc,
      schemaVersion: 2,
      scenes: scenes.map((s) =>
        obj(s)
          ? { ...s, transition: migrarTransicao(s.transition), layers: Array.isArray(s.layers) ? s.layers.map((l) => (obj(l) ? migrarCamadaV1(l) : l)) : [] }
          : s
      ),
    }
  }
  return doc
}

/** Migra + valida + aplica defaults. Lança ZodError em caso inválido. */
export function parseDocumento(entrada: unknown): DocumentoProjeto {
  return DocumentoProjetoSchema.parse(migrarDocumento(entrada))
}
