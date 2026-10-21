/**
 * Contrato do "Criar com IA" (etapa 1, roteiro): o pedido que o navegador envia e a resposta da rota
 * POST /api/ai/roteiro. Compartilhado entre servidor e cliente.
 */
import { z } from 'zod'
import { MarcaSchema } from './design'
import { TEMA_IDS, type TemaId } from './designSystem'
import { ESTILOS, RoteiroSchema, TIPOS_TELA, type Roteiro } from './roteiro'
import { TIPOS, TIPOS_PEDIDO, TONS, tipoDoPedido, type TipoApresentacao, type Tom } from './tiposApresentacao'

export const ORIGENS = ['zero', 'texto', 'arquivo'] as const
export const FORMATOS_IA = ['slides', 'story', 'explorar'] as const
export const QUANTIDADES_TELAS = [6, 8, 10, 12, 15, 20] as const

export const PedidoRoteiroSchema = z.object({
  origem: z.enum(ORIGENS).default('zero'),
  /** O que o usuário quer apresentar. */
  prompt: z.string().trim().max(4000).default(''),
  /** Texto colado ou extraído de arquivo (roteiro, briefing, artigo). */
  conteudo: z.string().trim().max(60000).default(''),
  formato: z.enum(FORMATOS_IA).default('slides'),
  telas: z.number().int().min(3).max(20).default(8),
  estilo: z.enum(ESTILOS).default('editorial'),
  publico: z.string().trim().max(200).default(''),
  /** Tipo de apresentação ("auto" = descobrir pelo pedido). */
  tipo: z.enum(TIPOS_PEDIDO).default('auto'),
  /** Tom de voz; ausente = o padrão do tipo. */
  tom: z.enum(TONS).optional(),
  marca: MarcaSchema.default({ nome: '', cores: [] }),
}).refine((p) => p.prompt.length >= 3 || p.conteudo.length >= 20, { message: 'Descreva a apresentação ou cole um texto.', path: ['prompt'] })
export type PedidoRoteiro = z.infer<typeof PedidoRoteiroSchema>

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
