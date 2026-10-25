/**
 * Feed do Instagram (frame com `mockup.modelo = 'feed-instagram'`): a foto de cada post da grade é a mesma do
 * post em destaque que abre ao clicar nele ("Post N" / "Imagem do post N" → "Destaque N"). Puro; serve para
 * documentos já salvos (ao abrir) e para cada edição no editor, qualquer que seja o caminho que trocou a foto
 * (preenchimento do inspetor, colar, soltar, seção do feed).
 */
export const MODELO_FEED = 'feed-instagram'

type Solta = { id: string; type: string; name?: string; parentId?: string; assetId?: string; fillImage?: { assetId: string; fit?: string }; mockup?: { modelo?: string } }

const assetDe = (c: Solta | undefined) => (!c ? undefined : c.type === 'image' ? c.assetId : c.fillImage?.assetId)

/** Foto de cada post (por número) e o "Destaque N" correspondente, dentro de cada feed. */
function postsDosFeeds(camadas: readonly Solta[]): { foto?: string; destaque: Solta }[] {
  const raizes = new Set(camadas.filter((c) => c.type === 'frame' && c.mockup?.modelo === MODELO_FEED).map((c) => c.id))
  if (!raizes.size) return []
  const pai = new Map(camadas.map((c) => [c.id, c.parentId]))
  const raizDe = (c: Solta) => {
    let p = c.parentId
    for (let i = 0; p && i < 32; i++) { if (raizes.has(p)) return p; p = pai.get(p) }
    return undefined
  }
  const porFeed = new Map<string, { post: Map<number, Solta>; imagem: Map<number, Solta>; destaque: Map<number, Solta> }>()
  for (const c of camadas) {
    const m = /^(Post|Imagem do post|Destaque) (\d+)$/.exec(c.name ?? '')
    if (!m) continue
    const raiz = raizDe(c)
    if (!raiz) continue
    const f = porFeed.get(raiz) ?? { post: new Map(), imagem: new Map(), destaque: new Map() }
    porFeed.set(raiz, f)
    const n = Number(m[2])
    if (m[1] === 'Post' && c.type === 'frame') f.post.set(n, c)
    else if (m[1] === 'Imagem do post' && c.type === 'image') f.imagem.set(n, c)
    else if (m[1] === 'Destaque' && (c.type === 'image' || c.type === 'shape' || c.type === 'frame')) f.destaque.set(n, c)
  }
  const r: { foto?: string; destaque: Solta }[] = []
  for (const f of porFeed.values()) {
    for (const [n, destaque] of f.destaque) r.push({ foto: assetDe(f.imagem.get(n)) ?? assetDe(f.post.get(n)), destaque })
  }
  return r
}

const comFoto = <T extends Solta>(d: T, assetId: string): T => (d.type === 'image' ? { ...d, assetId } : { ...d, fillImage: { assetId, fit: 'cover' } })

/**
 * Leva a foto de cada post para o destaque dele. Com `antes`, só os posts cuja foto mudou nesta edição (o
 * destaque pode ter uma foto própria, diferente); sem `antes` (documento aberto), só os destaques ainda sem foto.
 * Devolve a mesma lista quando nada muda.
 */
export function sincronizarDestaques<T extends Solta>(camadas: readonly T[], antes?: readonly T[]): T[] {
  const pares = postsDosFeeds(camadas)
  if (!pares.length) return camadas as T[]
  const fotoAntes = antes ? new Map(postsDosFeeds(antes).map((p) => [p.destaque.id, p.foto])) : null
  const trocar = new Map<string, string>()
  for (const { foto, destaque } of pares) {
    if (!foto || foto === assetDe(destaque)) continue
    if (fotoAntes ? fotoAntes.get(destaque.id) === foto : !!assetDe(destaque)) continue
    trocar.set(destaque.id, foto)
  }
  if (!trocar.size) return camadas as T[]
  return camadas.map((c) => (trocar.has(c.id) ? comFoto(c, trocar.get(c.id)!) : c))
}
