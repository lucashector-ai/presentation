/**
 * Vitrine pública: os exemplos fixos da demonstração (LINKS_DEMO com `tokenDemo`) abrem também no modo real, só
 * leitura, para a landing ("Explorar a plataforma", "Ver um exemplo") não depender de um projeto publicado no Neon.
 * Nada é gravado nem contado; links revogados ou com senha da demo continuam indisponíveis. Carregado sob demanda
 * (import dinâmico em lib/dados/real.ts), então os dados da demo não entram no bundle principal do modo real.
 */
import type { ResolucaoLink } from '@/lib/dados/tipos'
import { estadoDoLink } from '@/lib/share/token'
import { ASSETS_DEMO, LINKS_DEMO, PROJETOS_DEMO, SNAPSHOTS_DEMO } from './dados'

export function resolverVitrine(token: string): ResolucaoLink {
  const link = LINKS_DEMO.find((l) => l.tokenDemo === token)
  if (!link || link.senhaHash || estadoDoLink({ expiresAt: link.expiraEm, revokedAt: link.revogadoEm }) !== 'ativo') return { state: 'unavailable' }
  const p = PROJETOS_DEMO.find((x) => x.id === link.projectId && !x.excluidoEm)
  const snap = p && SNAPSHOTS_DEMO.find((s) => s.projectId === p.id && s.revisao === p.revisaoPublicada)
  if (!p || !snap) return { state: 'unavailable' }
  return { state: 'ready', projectName: p.nome, documento: snap.documento, assets: Object.fromEntries(ASSETS_DEMO.map((a) => [a.id, a])), marca: true }
}
