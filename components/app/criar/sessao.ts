/**
 * Sessão do "Criar com IA" guardada na aba (sessionStorage), pelo id na URL (/app/criar?sessao=…): sair para
 * apresentar, abrir o editor ou recarregar e voltar traz a conversa, as decisões, o plano e as telas desenhadas
 * de volta, exatamente como estavam. Grava só o necessário; se passar do limite do navegador, tira o que é
 * pesado e dá para refazer (o material lido e o markup do logo).
 */
import type { Densidade, Estilo, OpcaoImagens, Roteiro } from '@/lib/ia/roteiro'
import type { TemaId } from '@/lib/ia/designSystem'
import type { TelaDesenhada } from '@/lib/ia/montagem'
import type { TipoApresentacao } from '@/lib/ia/tiposApresentacao'
import type { Mensagem } from './chat'
import type { Briefing, Formato, MarcaEscolhida, MaterialEscolhido } from './estado'

export interface SessaoCriar {
  v: 1
  mensagens: Mensagem[]
  briefing: Briefing
  formato: Formato
  telas: number
  marca: MarcaEscolhida
  material: MaterialEscolhido
  tema: TemaId | 'auto'
  energia: Estilo | 'auto'
  roteiro: Roteiro | null
  nota: string
  temaIa: TemaId | null
  tipoIa: TipoApresentacao | null
  imagens: OpcaoImagens | null
  densidade: Densidade
  desenhos: Record<string, TelaDesenhada>
  projetoId: string | null
  vista: string | null
  design: boolean
  /** Todas as telas estavam desenhadas (senão, ao voltar, abre o plano para gerar de novo). */
  pronto: boolean
}

const chave = (id: string) => `mostra:criar:${id}`
export const novoIdSessao = () => Math.random().toString(36).slice(2, 10)

export function lerSessao(id: string | null): SessaoCriar | null {
  if (!id || !/^[a-z0-9]{4,16}$/.test(id)) return null
  try {
    const s = JSON.parse(sessionStorage.getItem(chave(id)) ?? 'null') as SessaoCriar | null
    return s && s.v === 1 ? s : null
  } catch {
    return null
  }
}

export function gravarSessao(id: string, s: SessaoCriar): void {
  try {
    sessionStorage.setItem(chave(id), JSON.stringify(s))
  } catch {
    // cheio: sem o material lido e sem o markup do logo (o texto do material e as cores ficam)
    try {
      const leve: SessaoCriar = { ...s, material: { ...s.material, lido: null }, marca: { ...s.marca, logo: s.marca.logo ? { ...s.marca.logo, svg: s.marca.logo.svg ? { cores: s.marca.logo.svg.cores } : null } : null } }
      sessionStorage.setItem(chave(id), JSON.stringify(leve))
    } catch { /* sem armazenamento: a sessão só não volta */ }
  }
}
