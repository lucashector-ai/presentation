/**
 * Bento grid como auto layout aninhado (como se faz no Figma): um frame externo com auto layout, linhas/colunas
 * como frames internos com auto layout, e os cartões como frames que recebem conteúdo (imagem, texto, vídeo),
 * com "Recortar conteúdo" próprio. Tudo em múltiplos de 8 (grade do app). Puro: só calcula camadas.
 */
import { parseCamada, type Camada, type CamadaFrame } from '@/lib/scene/schema'

/** Árvore do preset: `h`/`v` distribuem os filhos no eixo pelos pesos; número = cartão com esse peso. */
type No = number | { dir: 'h' | 'v'; peso?: number; filhos: No[] }

export const PRESETS_BENTO: { id: string; nome: string; arvore: No }[] = [
  { id: 'classico', nome: 'Clássico (destaque + alto)', arvore: { dir: 'h', filhos: [{ dir: 'v', peso: 2, filhos: [1, { dir: 'h', filhos: [1, 1] }] }, 1] } },
  { id: 'grade', nome: 'Grade 2 × 2', arvore: { dir: 'v', filhos: [{ dir: 'h', filhos: [1, 1] }, { dir: 'h', filhos: [1, 1] }] } },
  { id: 'destaque', nome: 'Destaque à esquerda', arvore: { dir: 'h', filhos: [2, { dir: 'v', filhos: [1, 1] }] } },
  { id: 'mosaico', nome: 'Mosaico 2 + 2', arvore: { dir: 'v', filhos: [{ dir: 'h', filhos: [2, 1] }, { dir: 'h', filhos: [1, 2] }] } },
  { id: 'tres', nome: 'Três colunas', arvore: { dir: 'h', filhos: [1, 1, 1] } },
  { id: 'seis', nome: 'Seis cartões', arvore: { dir: 'v', filhos: [{ dir: 'h', filhos: [1, 1, 1] }, { dir: 'h', filhos: [1, 1, 1] }] } },
]
export const CORES_BENTO = ['#171717', '#D7F25C', '#F2F1EF', '#5965F2', '#E4572E', '#F2C14E']

export interface OpcoesBento { preset: string; gap: number; radius: number; clip: boolean; cores?: string[]; padding?: number }
export interface BentoMeta { preset: string; gap: number; radius: number; padding?: number }

const g8 = (v: number) => Math.round(v / 8) * 8
const peso = (n: No) => (typeof n === 'number' ? n : (n.peso ?? 1))

/**
 * Gera as camadas do bento dentro de `rect` (x, y, largura, altura absolutos na cena). Devolve o frame externo
 * primeiro; as demais apontam para o pai por `parentId`. `prefixo` evita colisão de ids com o documento.
 */
export function gerarBento(rect: { x: number; y: number; width: number; height: number }, op: OpcoesBento, prefixo: string): Camada[] {
  const preset = PRESETS_BENTO.find((p) => p.id === op.preset) ?? PRESETS_BENTO[0]!
  const cores = op.cores?.length ? op.cores : CORES_BENTO
  const saida: Camada[] = []
  let n = 0
  let cartoes = 0
  const id = (tipo: string) => `${prefixo}-${tipo}-${++n}`
  const frame = (dados: Partial<CamadaFrame> & { id: string; x: number; y: number; width: number; height: number }): CamadaFrame => parseCamada({ type: 'frame', z: saida.length, fill: undefined, ...dados }) as CamadaFrame

  const desenhar = (no: No, r: { x: number; y: number; width: number; height: number }, parentId: string | undefined, raizId?: string) => {
    if (typeof no === 'number') {
      const f = frame({ id: id('cartao'), name: `Cartão ${++cartoes}`, ...r, parentId, fill: cores[(cartoes - 1) % cores.length], radius: op.radius, clip: op.clip, sizingW: 'fill', sizingH: 'fill', layoutGrow: peso(no) })
      saida.push(f)
      return
    }
    const meu = raizId ?? id(no.dir === 'h' ? 'linha' : 'coluna')
    if (!raizId) saida.push(frame({ id: meu, name: no.dir === 'h' ? 'Linha' : 'Coluna', ...r, parentId, sizingW: 'fill', sizingH: 'fill', layoutGrow: peso(no), layout: { direction: no.dir === 'h' ? 'horizontal' : 'vertical', gap: op.gap, gapAuto: false, padding: { top: 0, right: 0, bottom: 0, left: 0 }, alignX: 'start', alignY: 'start' } }))
    const total = no.filhos.reduce<number>((s, f) => s + peso(f), 0)
    const livre = (no.dir === 'h' ? r.width : r.height) - op.gap * (no.filhos.length - 1)
    let cursor = no.dir === 'h' ? r.x : r.y
    no.filhos.forEach((f, i) => {
      const ultimo = i === no.filhos.length - 1
      const fim = no.dir === 'h' ? r.x + r.width : r.y + r.height
      const tam = ultimo ? fim - cursor : g8((livre * peso(f)) / total)
      const sub = no.dir === 'h' ? { x: cursor, y: r.y, width: tam, height: r.height } : { x: r.x, y: cursor, width: r.width, height: tam }
      desenhar(f, sub, meu)
      cursor += tam + op.gap
    })
  }

  const raizId = `${prefixo}-bento`
  const raiz = preset.arvore
  const pad = g8(op.padding ?? 0)
  const interno = { x: rect.x + pad, y: rect.y + pad, width: Math.max(8, rect.width - pad * 2), height: Math.max(8, rect.height - pad * 2) }
  const externo = frame({ id: raizId, name: 'Bento grid', ...rect, clip: true, layout: typeof raiz === 'number' ? undefined : { direction: raiz.dir === 'h' ? 'horizontal' : 'vertical', gap: op.gap, gapAuto: false, padding: { top: pad, right: pad, bottom: pad, left: pad }, alignX: 'start', alignY: 'start' }, bento: { preset: preset.id, gap: op.gap, radius: op.radius, padding: pad } })
  saida.push(externo)
  desenhar(raiz, interno, undefined, raizId)
  return saida
}

/** Cartões (folhas) de um bento já criado, na ordem das camadas. */
export function cartoesDoBento(raizId: string, camadas: readonly Camada[]): Camada[] {
  const filhos = new Map<string, Camada[]>()
  for (const c of camadas) if (c.parentId) filhos.set(c.parentId, [...(filhos.get(c.parentId) ?? []), c])
  const saida: Camada[] = []
  const andar = (id: string) => { for (const c of filhos.get(id) ?? []) { if (c.type === 'frame' && c.layout && (filhos.get(c.id)?.length ?? 0) > 0 && !c.name?.startsWith('Cartão')) andar(c.id); else saida.push(c) } }
  andar(raizId)
  return saida.filter((c) => c.type === 'frame' && c.name?.startsWith('Cartão'))
}
