/**
 * Fotos do feed do Instagram: foto do perfil, capas dos destaques e os posts da grade. Cada "lugar" de foto
 * aponta para as camadas que mostram aquela imagem — trocar a foto do post 3 troca a célula da grade e a foto 3
 * do post em destaque (o que aparece ao clicar nele); a foto do perfil vai também para o cabeçalho do post e
 * esconde as iniciais. Puro: devolve as camadas atualizadas, quem aplica é o inspetor / o colar / o soltar.
 */
import type { Camada, CamadaFrame } from '@/lib/scene/schema'
import { ancestrais, descendentes, mapaDe } from '@/lib/scene/arvore'
import { MODELO_FEED } from './mockups'

export type LugarFoto = { tipo: 'perfil' } | { tipo: 'destaque'; i: number } | { tipo: 'post'; i: number }

export interface FotoFeed { lugar: LugarFoto; chave: string; rotulo: string; assetId?: string }

export const chaveDoLugar = (l: LugarFoto) => (l.tipo === 'perfil' ? 'perfil' : `${l.tipo}-${l.i}`)

/** A raiz do feed que contém a camada (ou a própria camada, se for a raiz). */
export function raizDoFeed(c: Camada, camadas: readonly Camada[]): CamadaFrame | undefined {
  const ehFeed = (f: Camada): f is CamadaFrame => f.type === 'frame' && f.mockup?.modelo === MODELO_FEED
  if (ehFeed(c)) return c
  return ancestrais(c, mapaDe(camadas)).find(ehFeed)
}

/** O lugar de foto que a camada representa (pelo nome), se ela estiver dentro de um feed. */
export function lugarDaCamada(c: Camada): LugarFoto | null {
  const n = c.name ?? ''
  if (n === 'Foto do perfil' || n === 'Foto do perfil no post') return { tipo: 'perfil' }
  let m = /^Capa do destaque (\d+)$/.exec(n)
  if (m) return { tipo: 'destaque', i: Number(m[1]) }
  m = /^(?:Post|Destaque|Imagem do post) (\d+)$/.exec(n)
  if (m && (c.type === 'frame' || c.type === 'shape' || c.type === 'image')) return { tipo: 'post', i: Number(m[1]) }
  return null
}

const assetDe = (c: Camada | undefined): string | undefined =>
  !c ? undefined : c.type === 'image' ? c.assetId : c.type === 'frame' || c.type === 'shape' ? c.fillImage?.assetId : undefined

/** Camadas que mostram a foto de um lugar (a primeira é a principal, de onde a foto atual é lida). */
function camadasDoLugar(lugar: LugarFoto, dentro: readonly Camada[]): Camada[] {
  const nome = (n: string) => dentro.filter((c) => c.name === n)
  if (lugar.tipo === 'perfil') return [...nome('Foto do perfil'), ...nome('Foto do perfil no post')]
  if (lugar.tipo === 'destaque') return nome(`Capa do destaque ${lugar.i}`)
  return [...nome(`Post ${lugar.i}`).filter((c) => c.type === 'frame'), ...nome(`Imagem do post ${lugar.i}`), ...nome(`Destaque ${lugar.i}`)]
}

/** Os lugares de foto do feed, na ordem do inspetor: perfil, destaques, posts (só os que existem nele). */
export function fotosDoFeed(raizId: string, camadas: readonly Camada[]): FotoFeed[] {
  const dentro = descendentes(raizId, camadas)
  const lugares: LugarFoto[] = [{ tipo: 'perfil' }, ...[1, 2, 3, 4].map((i) => ({ tipo: 'destaque' as const, i })), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ tipo: 'post' as const, i }))]
  return lugares.flatMap((lugar) => {
    const cs = camadasDoLugar(lugar, dentro)
    if (!cs.length) return []
    const rotulo = lugar.tipo === 'perfil' ? 'Foto do perfil' : lugar.tipo === 'destaque' ? (dentro.find((c) => c.name === `Rótulo do destaque ${lugar.i}` && c.type === 'text') as { text?: string } | undefined)?.text || `Destaque ${lugar.i}` : `Post ${lugar.i}`
    // imagem filha (feeds antigos) vale mais que o preenchimento do frame
    const assetId = lugar.tipo === 'post' ? assetDe(cs.find((c) => c.name === `Imagem do post ${lugar.i}`)) ?? assetDe(cs[0]) : assetDe(cs[0])
    return [{ lugar, chave: chaveDoLugar(lugar), rotulo, assetId }]
  })
}

/**
 * Põe a foto `assetId` num lugar do feed (ou tira, com `null`): imagem troca o arquivo; forma ou frame recebe o
 * preenchimento com imagem (cobrir). Na foto do perfil, as iniciais somem com a foto e voltam sem ela.
 */
export function aplicarFotoFeed(raizId: string, camadas: readonly Camada[], lugar: LugarFoto, assetId: string | null): Camada[] {
  const dentro = descendentes(raizId, camadas)
  const saida: Camada[] = camadasDoLugar(lugar, dentro).flatMap((c): Camada[] => {
    if (c.type === 'image') return assetId ? [{ ...c, assetId }] : []
    if (c.type === 'frame' || c.type === 'shape') return [{ ...c, fillImage: assetId ? { assetId, fit: 'cover' } : undefined } as Camada]
    return []
  })
  if (lugar.tipo === 'perfil') {
    for (const c of dentro) if (c.type === 'text' && (c.name === 'Inicial do perfil' || c.name === 'Inicial do post')) saida.push({ ...c, hidden: !!assetId })
  }
  return saida
}

/** Lugar de foto sob um ponto da tela (o mais de cima), para soltar uma imagem direto num post ou destaque. */
export function lugarNoPonto(camadas: readonly Camada[], p: { x: number; y: number }): { raiz: CamadaFrame; lugar: LugarFoto; camada: Camada } | null {
  const ocultas = new Set(camadas.filter((c) => c.hidden).map((c) => c.id))
  const candidatas = camadas
    .filter((c) => !ocultas.has(c.id) && p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height)
    .sort((a, b) => b.z - a.z)
  for (const c of candidatas) {
    const lugar = lugarDaCamada(c)
    if (!lugar) continue
    const raiz = raizDoFeed(c, camadas)
    if (raiz) return { raiz, lugar, camada: c }
  }
  return null
}
