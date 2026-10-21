/**
 * Protocolo da sala de colaboração (WebSocket entre o editor e o Durable Object do projeto).
 * O servidor valida TUDO o que chega (Zod + limites); o cliente confia nas mensagens do servidor.
 * O conteúdo das camadas/telas é conferido depois de aplicado, com os schemas do documento (`aplicarLote`).
 */
import { z } from 'zod'
import { CamadaSchema, CenaSchema, DocumentoProjetoSchema, IdSchema, type Camada, type Cena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import { aplicarOp, camadaDaOp, type Op } from './ops'

/** Tamanho máximo de uma mensagem do cliente (o cliente divide lotes maiores). */
export const LIMITE_MENSAGEM = 2 * 1024 * 1024
/** Alvo de tamanho de um lote no cliente (bem abaixo do limite). */
export const ALVO_LOTE = 512 * 1024
export const MAX_OPS_POR_LOTE = 1000
/** Taxa: fichas por segundo e rajada por conexão (presença ~20/s + lotes ~20/s cabem com folga). */
export const TAXA_POR_SEGUNDO = 60
export const RAJADA = 120
/** Ping de aplicação (o DO responde sem acordar, via auto-resposta). */
export const PING = '{"t":"ping"}'
export const PONG = '{"t":"pong"}'

const Chave = z.string().min(1).max(64).refine((k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype', 'chave reservada')
const Props = z.record(Chave, z.unknown())
const Chaves = z.array(Chave).max(100)
const ehObjeto = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)

export const OpSchema = z.discriminatedUnion('o', [
  z.object({ o: z.literal('doc'), p: Props.optional(), d: Chaves.optional() }),
  z.object({ o: z.literal('cena+'), cena: z.custom<Cena>(ehObjeto, 'tela inválida'), apos: IdSchema.nullable() }),
  z.object({ o: z.literal('cena-'), id: IdSchema }),
  z.object({ o: z.literal('cena'), id: IdSchema, p: Props.optional(), d: Chaves.optional() }),
  z.object({ o: z.literal('cenas'), ids: z.array(IdSchema).max(300) }),
  z.object({ o: z.literal('cam+'), c: IdSchema, l: z.custom<Camada>(ehObjeto, 'camada inválida'), apos: IdSchema.nullable() }),
  z.object({ o: z.literal('cam-'), c: IdSchema, id: IdSchema }),
  z.object({ o: z.literal('cam'), c: IdSchema, id: IdSchema, p: Props.optional(), d: Chaves.optional() }),
  z.object({ o: z.literal('cams'), c: IdSchema, ids: z.array(IdSchema).max(400) }),
])

const Finito = z.number().finite().min(-1e6).max(1e6)

export const MensagemClienteSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ops'), lote: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), ops: z.array(OpSchema).min(1).max(MAX_OPS_POR_LOTE) }),
  z.object({
    t: z.literal('presenca'),
    cenaId: IdSchema.nullable().optional(),
    cursor: z.object({ x: Finito, y: Finito }).nullable().optional(),
    selecao: z.array(IdSchema).max(100).optional(),
  }),
  z.object({ t: z.literal('salvar') }),
])
export type MensagemCliente = z.infer<typeof MensagemClienteSchema>

const CHAVES_PROIBIDAS = new Set(['__proto__', 'constructor', 'prototype'])

/** Lê uma mensagem do cliente: tamanho, JSON sem chaves que mexem em protótipo, e o schema. null = recusada. */
export function lerMensagemCliente(texto: string): MensagemCliente | null {
  if (texto.length > LIMITE_MENSAGEM) return null
  let bruto: unknown
  try {
    bruto = JSON.parse(texto, (k, v: unknown) => {
      if (CHAVES_PROIBIDAS.has(k)) throw new Error('chave proibida')
      return v
    })
  } catch {
    return null
  }
  const r = MensagemClienteSchema.safeParse(bruto)
  return r.success ? r.data : null
}

export type Papel = 'owner' | 'editor' | 'viewer'

/** Quem está entrando na sala (montado pelo Worker depois de autenticar; nunca vem do cliente). */
export interface InfoEntrada {
  userId: string
  nome: string
  papel: Papel
  workspaceId: string
  projetoId: string
  clienteId: string
}
/** Cabeçalho interno Worker → Durable Object (o DO só é alcançável pelo binding). */
export const CABECALHO_ENTRADA = 'x-mostra-sala'

export interface Pessoa {
  /** Id desta conexão (a mesma pessoa em duas abas = duas conexões). */
  id: string
  userId: string
  nome: string
  cor: string
  papel: Papel
  cenaId: string | null
  cursor: { x: number; y: number } | null
  selecao: string[]
}

export type MensagemServidor =
  | { t: 'bemvindo'; eu: Pessoa; doc: DocumentoProjeto; seq: number; revisao: number; salvoSeq: number; salvoEm: string | null; ultimoLote: number; pessoas: Pessoa[] }
  | { t: 'ops'; seq: number; ops: Op[]; de: string }
  | { t: 'ack'; lote: number; seq: number }
  | { t: 'rejeitado'; lote: number; motivo: string }
  | { t: 'pessoa'; pessoa: Pessoa }
  | { t: 'saiu'; id: string }
  | { t: 'salvo'; seq: number; revisao: number; salvoEm: string }
  /** O banco tinha uma versão mais nova (gravada fora da sala): a sala recomeçou dela, com as mudanças da sala por cima. */
  | { t: 'base'; doc: DocumentoProjeto; seq: number; revisao: number }
  | { t: 'falha'; mensagem: string }
  | { t: 'papel'; papel: Papel }
  | { t: 'aviso'; mensagem: string }
  | { t: 'fim'; motivo: 'sem_acesso' | 'projeto_removido' | 'sessao_expirada' }
  | { t: 'pong' }

/** Cores dos colaboradores (contraste bom sobre o canvas claro e com texto branco). */
export const CORES = ['#E5484D', '#0091FF', '#30A46C', '#F76B15', '#8E4EC6', '#D6409F', '#12A594', '#AD7F58', '#3E63DD', '#E54666'] as const

export function corDe(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return CORES[h % CORES.length]!
}

// ---------- aplicar um lote no servidor (validação do resultado) ----------

const DocSemCenas = DocumentoProjetoSchema.omit({ scenes: true })
const CenaSemCamadas = CenaSchema.omit({ layers: true })

/** Nenhuma chave fora do schema (o parse do Zod descarta chaves desconhecidas; aqui elas são recusadas). */
function semChavesEstranhas(entrada: object, saida: object): boolean {
  for (const k of Object.keys(entrada)) if (!(k in saida)) return false
  return true
}

function camadaValida(l: Camada): boolean {
  const r = CamadaSchema.safeParse(l)
  return r.success && semChavesEstranhas(l, r.data)
}

function cenaValida(c: Cena): boolean {
  if (!Array.isArray(c.layers) || c.layers.length > 400) return false
  const { layers: _l, ...resto } = c
  const r = CenaSemCamadas.safeParse(resto)
  if (!r.success || !semChavesEstranhas(resto, r.data)) return false
  return new Set(c.layers.map((l) => l.id)).size === c.layers.length
}

export type ResultadoLote = { ok: true; doc: DocumentoProjeto } | { ok: false; motivo: string }

/**
 * Aplica um lote (já validado pelo OpSchema) e confere o resultado: o lote inteiro vale ou nada vale.
 * Só revalida o que mudou (camadas tocadas e as telas delas), para caber a cada mensagem.
 */
export function aplicarLote(doc: DocumentoProjeto, ops: Op[], opcoes: { modo: ModoProjeto }): ResultadoLote {
  let d = doc
  const camadas = new Map<string, Set<string>>()
  const cenas = new Set<string>()
  let docMudou = false
  for (const op of ops) {
    if (op.o === 'doc') {
      docMudou = true
      if ((op.p && ('mode' in op.p || 'schemaVersion' in op.p)) || op.d?.some((k) => k === 'mode' || k === 'schemaVersion')) return { ok: false, motivo: 'O modo do documento não pode mudar na sala' }
    }
    if (op.o === 'cena+' || op.o === 'cena') cenas.add(op.o === 'cena+' ? op.cena.id : op.id)
    if (op.o === 'cena+' && Array.isArray(op.cena.layers)) for (const l of op.cena.layers) { const s = camadas.get(op.cena.id) ?? new Set(); s.add((l as { id: string }).id); camadas.set(op.cena.id, s) }
    const cl = camadaDaOp(op)
    if (cl) { const s = camadas.get(cl.c) ?? new Set(); s.add(cl.id); camadas.set(cl.c, s); cenas.add(cl.c) }
    if (op.o === 'cam+' || op.o === 'cams' || op.o === 'cam-') cenas.add(op.c)
    try {
      d = aplicarOp(d, op)
    } catch {
      return { ok: false, motivo: 'Operação inválida' }
    }
  }
  if (d === doc) return { ok: true, doc }
  if (d.scenes.length < 1) return { ok: false, motivo: 'O projeto precisa de pelo menos uma tela' }
  if (d.scenes.length > 300) return { ok: false, motivo: 'Limite de 300 telas' }
  if (new Set(d.scenes.map((s) => s.id)).size !== d.scenes.length) return { ok: false, motivo: 'Tela repetida' }
  if (docMudou) {
    const { scenes: _s, ...resto } = d
    const r = DocSemCenas.safeParse(resto)
    if (!r.success || !semChavesEstranhas(resto, r.data) || d.mode !== opcoes.modo) return { ok: false, motivo: 'Documento inválido' }
  }
  const porId = new Map(d.scenes.map((s) => [s.id, s]))
  for (const id of cenas) {
    const c = porId.get(id)
    if (c && !cenaValida(c)) return { ok: false, motivo: `Tela "${id}" inválida` }
  }
  for (const [cid, ids] of camadas) {
    const c = porId.get(cid)
    if (!c) continue
    for (const l of c.layers) if (ids.has(l.id) && !camadaValida(l)) return { ok: false, motivo: `Camada "${l.id}" inválida` }
  }
  return { ok: true, doc: d }
}
