/**
 * Contrato do "Criar com IA": o pedido que o navegador envia e a resposta da rota
 * POST /api/ai/roteiro. Compartilhado entre servidor e cliente.
 */
import { z } from 'zod'
import { ESTILOS, RoteiroSchema, TIPOS_TELA, type Roteiro } from './roteiro'

export const ORIGENS = ['zero', 'texto', 'arquivo'] as const
export const FORMATOS_IA = ['slides', 'story', 'explorar'] as const
export const QUANTIDADES_TELAS = [6, 8, 10, 12] as const

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
}).refine((p) => p.prompt.length >= 3 || p.conteudo.length >= 20, { message: 'Descreva a apresentação ou cole um texto.', path: ['prompt'] })
export type PedidoRoteiro = z.infer<typeof PedidoRoteiroSchema>

export interface RespostaRoteiro {
  roteiro: Roteiro
  /** claude = gerado pelo modelo; local = gerador determinístico (sem chave de API ou modo demo). */
  gerador: 'claude' | 'local'
  modelo: string | null
}

/**
 * Formato pedido ao modelo: só tipos simples e campos obrigatórios (compatível com saídas
 * estruturadas). Os limites de tamanho são aplicados depois, em `normalizarRoteiro`.
 */
export const RoteiroModeloSchema = z.object({
  titulo: z.string(),
  telas: z.array(
    z.object({
      tipo: z.enum(TIPOS_TELA),
      titulo: z.string(),
      texto: z.string(),
      itens: z.array(z.string()),
      notas: z.string(),
    })
  ),
})
export type RoteiroModelo = z.infer<typeof RoteiroModeloSchema>

const corta = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

/** Ajusta qualquer roteiro "quase certo" aos limites do schema; nunca lança para entrada bem tipada. */
export function normalizarRoteiro(bruto: RoteiroModelo, maxTelas = 100): Roteiro {
  const telas = bruto.telas.slice(0, maxTelas).map((t) => ({
    tipo: t.tipo,
    titulo: corta(t.titulo.trim() || 'Sem título', 120),
    texto: corta(t.texto.trim(), 600),
    itens: t.itens.map((i) => corta(i.trim(), 160)).filter(Boolean).slice(0, 6),
    notas: corta(t.notas.trim(), 1200),
  }))
  return RoteiroSchema.parse({
    titulo: corta(bruto.titulo.trim() || telas[0]?.titulo || 'Nova apresentação', 120),
    telas: telas.length ? telas : [{ tipo: 'capa', titulo: bruto.titulo.trim() || 'Nova apresentação', texto: '', itens: [], notas: '' }],
  })
}
