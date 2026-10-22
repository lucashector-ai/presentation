/**
 * Estado do "Criar com IA" em passos: o que a pessoa diz antes de gerar (briefing, marca, material, estilo e
 * tamanho) e como isso vira o pedido do roteiro e as opções da montagem. Tudo o que é marca, estilo, fotos e
 * números é aplicado sem IA ou entra no roteiro de uma vez (não gera de novo depois).
 */
import type { MaterialLido } from '@/lib/pdf/material'
import type { Estilo } from '@/lib/ia/roteiro'
import type { PapeisMarca, TemaId } from '@/lib/ia/designSystem'
import type { PerfilMarca } from '@/lib/marca/perfil'
import type { Idioma } from '@/lib/ia/pedido'
import type { TipoPedido, Tom } from '@/lib/ia/tiposApresentacao'

export const PASSOS = ['briefing', 'marca', 'material', 'estilo', 'tamanho', 'revisar', 'roteiro', 'design'] as const
export type Passo = (typeof PASSOS)[number]
/** Passos antes de gerar (o roteiro e o design vêm depois do "Gerar roteiro"). */
export const PASSOS_PEDIDO = ['briefing', 'marca', 'material', 'estilo', 'tamanho', 'revisar'] as const satisfies readonly Passo[]

export const INFO_PASSO: Record<Passo, { nome: string; dica: string; opcional?: boolean }> = {
  briefing: { nome: 'Briefing', dica: 'o que é, para quem, tom e idioma' },
  marca: { nome: 'Marca', dica: 'manual, logo, cores e fontes', opcional: true },
  material: { nome: 'Material', dica: 'texto, PDF, fotos e números', opcional: true },
  estilo: { nome: 'Estilo', dica: 'mais de 20 estilos de design', opcional: true },
  tamanho: { nome: 'Tamanho', dica: 'formato e número de telas' },
  revisar: { nome: 'Revisar e gerar', dica: 'resumo e custo exato' },
  roteiro: { nome: 'Roteiro', dica: 'edite antes do design' },
  design: { nome: 'Design', dica: 'as telas desenhadas' },
}

/** Chave da sessão do navegador com um pedido longo colado no painel (vai inteiro para o editor do Criar com IA). */
export const CHAVE_PEDIDO_COLADO = 'mostra:pedido-colado'

export type Formato = 'slides' | 'story' | 'explorar'
export type Origem = 'zero' | 'texto' | 'arquivo'

export interface LogoEscolhido {
  assetId: string
  url: string
  nome: string
  largura: number
  altura: number
  /** Cor média (silhueta automática quando some no fundo). */
  cor: string
  /** Cores marcantes lidas do logo. */
  cores: string[]
}

export interface FotoEscolhida { assetId: string; url: string; nome: string; legenda: string }

export interface Briefing {
  prompt: string
  tipo: TipoPedido
  publico: string
  tom: Tom | ''
  idioma: Idioma
}

export interface MarcaEscolhida {
  nome: string
  cores: string[]
  /** Usar as cores da marca sobre o estilo (desligado = cores do estilo). */
  aplicarCores: boolean
  fontes: { titulo: string; texto: string } | null
  logo: LogoEscolhido | null
  logoRodape: boolean
  /** Kit de marca salvo de onde veio (para atualizar em vez de criar outro). */
  kitId: string | null
  /** Papéis de cor citados no pedido (fundo claro, cartão, positivo, negativo), aplicados sem digitar de novo. */
  papeis?: PapeisMarca | null
  /** Perfil do manual da marca (revisado), salvo no kit e usado no roteiro, no design e na montagem. */
  perfil?: PerfilMarca | null
}

export interface MaterialEscolhido {
  origem: Origem
  conteudo: string
  arquivo: string | null
  lido: MaterialLido | null
  numeros: string
  obrigatorio: string
  evitar: string
  fotos: FotoEscolhida[]
}

export interface EstiloEscolhido {
  /** 'auto' = a IA sugere no roteiro. */
  tema: TemaId | 'auto'
  /** 'auto' = a energia padrão do estilo. */
  energia: Estilo | 'auto'
}

export const MARCA_VAZIA: MarcaEscolhida = { nome: '', cores: [], aplicarCores: true, fontes: null, logo: null, logoRodape: false, kitId: null, papeis: null, perfil: null }
export const MATERIAL_VAZIO: MaterialEscolhido = { origem: 'zero', conteudo: '', arquivo: null, lido: null, numeros: '', obrigatorio: '', evitar: '', fotos: [] }

/** Números-chave digitados (um por linha: "38% | mais passageiros") no formato do roteiro ("valor|legenda"). */
export function linhasDeNumeros(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter((l) => /\d/.test(l))
    .map((l) => (l.includes('|') ? l.split('|').map((x) => x.trim()).join('|') : l.replace(/^(\S+)\s+[—–:-]?\s*/, '$1|')))
    .slice(0, 12)
}
