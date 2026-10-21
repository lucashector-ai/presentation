/**
 * Contrato do "Criar com IA" (etapa 1, roteiro): o pedido que o navegador envia e a resposta da rota
 * POST /api/ai/roteiro. Compartilhado entre servidor e cliente.
 */
import { z } from 'zod'
import { MarcaSchema } from './design'
import { TEMA_IDS, type TemaId } from './designSystem'
import { ESTILOS, RoteiroSchema, TIPOS_TELA, type Roteiro } from './roteiro'
import { TIPOS, TIPOS_PEDIDO, TONS, tipoDoPedido, type TipoApresentacao, type Tom } from './tiposApresentacao'
import { ATALHOS_TELAS, MAX_TELAS_IA } from '@/lib/telasIa'

export const ORIGENS = ['zero', 'texto', 'arquivo'] as const
export const FORMATOS_IA = ['slides', 'story', 'explorar'] as const
/** Atalhos de tamanho (o campo livre aceita qualquer número de 6 até o limite do plano). */
export const QUANTIDADES_TELAS = ATALHOS_TELAS
export const IDIOMAS = ['pt-BR', 'en', 'es'] as const
export type Idioma = (typeof IDIOMAS)[number]
export const NOMES_IDIOMA: Record<Idioma, string> = { 'pt-BR': 'Português', en: 'Inglês', es: 'Espanhol' }

/**
 * O que a pessoa já tem e entra no roteiro de uma vez (sem gerar de novo depois): números-chave (valor|legenda),
 * o que não pode faltar, o que evitar e a legenda de cada foto própria (as fotos entram nos espaços de imagem na
 * montagem, sem IA).
 */
export const MaterialSchema = z.object({
  numeros: z.array(z.string().trim().max(120)).max(12).default([]),
  obrigatorio: z.string().trim().max(1500).default(''),
  evitar: z.string().trim().max(800).default(''),
  fotos: z.array(z.string().trim().max(120)).max(20).default([]),
})
export type MaterialPedido = z.infer<typeof MaterialSchema>
const MATERIAL_VAZIO: MaterialPedido = { numeros: [], obrigatorio: '', evitar: '', fotos: [] }

export const PedidoRoteiroSchema = z.object({
  origem: z.enum(ORIGENS).default('zero'),
  /** O que o usuário quer apresentar. */
  prompt: z.string().trim().max(4000).default(''),
  /** Texto colado ou extraído de arquivo (roteiro, briefing, artigo). */
  conteudo: z.string().trim().max(60000).default(''),
  formato: z.enum(FORMATOS_IA).default('slides'),
  telas: z.number().int().min(3).max(MAX_TELAS_IA).default(8),
  estilo: z.enum(ESTILOS).default('editorial'),
  /** Estilo visual já escolhido pela pessoa (ausente = a IA sugere um). */
  tema: z.enum(TEMA_IDS).optional(),
  publico: z.string().trim().max(200).default(''),
  /** Tipo de apresentação ("auto" = descobrir pelo pedido). */
  tipo: z.enum(TIPOS_PEDIDO).default('auto'),
  /** Tom de voz; ausente = o padrão do tipo. */
  tom: z.enum(TONS).optional(),
  idioma: z.enum(IDIOMAS).default('pt-BR'),
  marca: MarcaSchema.default({ nome: '', cores: [], aplicarCores: true }),
  material: MaterialSchema.default(MATERIAL_VAZIO),
}).refine((p) => p.prompt.length >= 3 || p.conteudo.length >= 20, { message: 'Descreva a apresentação ou cole um texto.', path: ['prompt'] })
export type PedidoRoteiro = z.infer<typeof PedidoRoteiroSchema>

/**
 * Caracteres de material que entram no preço do roteiro (texto colado/importado + números, o que não pode faltar
 * e o que evitar). Mesma conta no navegador e na rota: o custo mostrado antes é o cobrado.
 */
export function caracteresMaterial(p: { conteudo?: string; material?: Partial<MaterialPedido> }): number {
  const m = p.material ?? {}
  return (p.conteudo?.trim().length ?? 0) + (m.numeros ?? []).join('\n').length + (m.obrigatorio?.trim().length ?? 0) + (m.evitar?.trim().length ?? 0)
}

/** Tipo efetivo do pedido ("auto" → reconhecido pelo texto). */
export const tipoEfetivo = (p: Pick<PedidoRoteiro, 'tipo' | 'prompt' | 'conteudo'>): TipoApresentacao => (p.tipo === 'auto' ? tipoDoPedido(`${p.prompt} ${p.conteudo.slice(0, 2000)}`) : p.tipo)
export const tomEfetivo = (p: Pick<PedidoRoteiro, 'tipo' | 'prompt' | 'conteudo' | 'tom'>): Tom => p.tom ?? TIPOS[tipoEfetivo(p)].tom

export interface RespostaRoteiro {
  roteiro: Roteiro
  /** claude = gerado pelo modelo; local = gerador determinístico (sem chave de API ou modo demo). */
  gerador: 'claude' | 'local'
  modelo: string | null
  /** Tipo de apresentação usado (o reconhecido quando o pedido veio em "auto"). */
  tipo: TipoApresentacao
  /** Tema sugerido para o conteúdo. */
  tema: TemaId
  /** Créditos cobrados pelo roteiro. */
  creditos: number
}

/**
 * Formato pedido ao modelo: só tipos simples e campos obrigatórios (compatível com saídas
 * estruturadas). Os limites de tamanho são aplicados depois, em `normalizarRoteiro`.
 */
export const RoteiroModeloSchema = z.object({
  titulo: z.string(),
  tema: z.enum(TEMA_IDS),
  telas: z.array(
    z.object({
      tipo: z.enum(TIPOS_TELA),
      rotulo: z.string(),
      titulo: z.string(),
      texto: z.string(),
      itens: z.array(z.string()),
      notas: z.string(),
    })
  ),
})
export type RoteiroModelo = z.infer<typeof RoteiroModeloSchema>
type TelaModelo = RoteiroModelo['telas'][number]
/** Entrada de `normalizarRoteiro`: o que o modelo devolve (rótulo opcional para o gerador local). */
export interface RoteiroBruto { titulo: string; telas: (Omit<TelaModelo, 'rotulo'> & { rotulo?: string })[] }

const corta = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

/** Ajusta qualquer roteiro "quase certo" aos limites do schema; nunca lança para entrada bem tipada. */
export function normalizarRoteiro(bruto: RoteiroBruto, maxTelas = 100): Roteiro {
  const telas = bruto.telas.slice(0, maxTelas).map((t) => ({
    tipo: t.tipo,
    rotulo: corta((t.rotulo ?? '').replace(/\s+/g, ' ').trim(), 40),
    titulo: corta(t.titulo.replace(/\s+/g, ' ').trim() || 'Sem título', t.tipo === 'citacao' ? 160 : 120),
    texto: corta(t.texto.trim(), 600),
    itens: t.itens.map((i) => corta(i.replace(/\s*\n\s*/g, ' ').trim(), 160)).filter(Boolean).slice(0, 6),
    notas: corta(t.notas.trim(), 1200),
  }))
  return RoteiroSchema.parse({
    titulo: corta(bruto.titulo.trim() || telas[0]?.titulo || 'Nova apresentação', 120),
    telas: telas.length ? telas : [{ tipo: 'capa', titulo: bruto.titulo.trim() || 'Nova apresentação' }],
  })
}
