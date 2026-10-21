/**
 * Único ponto de acesso aos bindings do Cloudflare (declarados em wrangler.jsonc). No Worker (vinext/workerd)
 * eles vêm de `env` em `cloudflare:workers`; fora dele (vitest, Node) esse módulo não existe e tudo devolve null.
 * O import é dinâmico e protegido, para que importar este arquivo nunca quebre fora do Worker.
 */
import type { R2Bucket } from '@cloudflare/workers-types/index.ts'

export type { R2Bucket }

/** Bindings do wrangler.jsonc que o app usa. */
interface AmbienteCf {
  MIDIAS?: R2Bucket
}

// especificador numa variável: o Vite não tenta resolvê-lo fora do Worker (no build do Worker ele é externo)
const MODULO_CF = 'cloudflare:workers'
let ambiente: Promise<AmbienteCf | null> | undefined

function carregarAmbiente(): Promise<AmbienteCf | null> {
  ambiente ??= import(/* @vite-ignore */ MODULO_CF).then(
    (m: { env?: AmbienteCf }) => m.env ?? null,
    () => null
  )
  return ambiente
}

/** Bucket R2 das mídias (binding `MIDIAS`), ou null fora do Worker. */
export async function obterBucketMidias(): Promise<R2Bucket | null> {
  return (await carregarAmbiente())?.MIDIAS ?? null
}
