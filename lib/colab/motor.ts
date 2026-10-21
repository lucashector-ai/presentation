/**
 * Motor de sincronização do cliente (reconciliação com o servidor, sem dependência de rede).
 *
 *   confirmado = documento do servidor (todas as operações até `seq`, na ordem dele)
 *   enviados   = lotes locais já mandados, esperando confirmação
 *   fila       = operações locais ainda não mandadas (offline, ou à espera do próximo envio)
 *   local      = confirmado + enviados + fila  ← o que o editor mostra
 *
 * Quando chega uma operação de outra pessoa, ela entra no `confirmado` e as pendentes locais são reaplicadas por
 * cima: a edição local continua valendo na tela até o servidor responder (e lá ela também vence, porque chega
 * depois). Quando não há nada pendente, `local === confirmado`, idêntico ao do servidor: convergência garantida.
 */
import type { DocumentoProjeto } from '@/lib/scene/schema'
import { aplicarOps, compactar, diferenca, type Op } from './ops'
import { ALVO_LOTE, MAX_OPS_POR_LOTE } from './protocolo'

export interface Lote { lote: number; ops: Op[] }

export class MotorDocumento {
  confirmado: DocumentoProjeto
  seq: number
  local: DocumentoProjeto
  enviados: Lote[] = []
  fila: Op[] = []
  /** Seq do último lote meu confirmado (para saber se o servidor já gravou o que eu fiz). */
  meuSeq = 0
  private proximo = 1

  constructor(doc: DocumentoProjeto, seq = 0) {
    this.confirmado = doc
    this.local = doc
    this.seq = seq
  }

  get pendente(): boolean {
    return this.enviados.length > 0 || this.fila.length > 0
  }

  /** Mudança local: o editor calculou o documento novo. Devolve as operações (vazio = nada mudou de fato). */
  editar(depois: DocumentoProjeto): Op[] {
    if (depois === this.local) return []
    const ops = diferenca(this.local, depois)
    this.local = depois
    if (ops.length) this.fila.push(...ops)
    return ops
  }

  /** Aplica operações como mudança local (desfazer/refazer) e devolve o documento resultante. */
  aplicarLocal(ops: readonly Op[]): DocumentoProjeto {
    const depois = aplicarOps(this.local, ops)
    this.editar(depois)
    return depois
  }

  /** Recomeça só no cliente (modo sem sala, ou "recarregar do servidor"). */
  substituir(doc: DocumentoProjeto, seq = this.seq) {
    this.confirmado = doc
    this.local = doc
    this.seq = seq
    this.enviados = []
    this.fila = []
  }

  /** Tira da fila o próximo lote para enviar (compactado, dividido para caber numa mensagem). */
  proximoLote(): Lote | null {
    if (!this.fila.length) return null
    const todas = compactar(this.fila)
    const ops: Op[] = []
    let tamanho = 0
    let i = 0
    for (; i < todas.length; i++) {
      const t = JSON.stringify(todas[i]).length
      if (ops.length && (tamanho + t > ALVO_LOTE || ops.length >= MAX_OPS_POR_LOTE)) break
      ops.push(...dividir(todas[i]!, t))
      tamanho += t
    }
    this.fila = todas.slice(i)
    const lote = { lote: this.proximo++, ops }
    this.enviados.push(lote)
    return lote
  }

  /** Operações de outra pessoa (já ordenadas pelo servidor). */
  remoto(seq: number, ops: readonly Op[]): DocumentoProjeto {
    this.confirmado = aplicarOps(this.confirmado, ops)
    this.seq = seq
    return this.rebase()
  }

  /** O servidor aplicou meu lote com o número `seq`. */
  confirmar(lote: number, seq: number) {
    const i = this.enviados.findIndex((l) => l.lote === lote)
    if (i < 0) return
    // o servidor responde na ordem de envio: lotes anteriores sem resposta não existem (se existirem, saem)
    const confirmados = this.enviados.splice(0, i + 1)
    this.confirmado = aplicarOps(this.confirmado, confirmados[confirmados.length - 1]!.ops)
    this.seq = seq
    this.meuSeq = seq
    if (confirmados.length > 1) this.rebase()
  }

  /** O servidor recusou o lote (inválido): a mudança sai da tela. */
  rejeitar(lote: number): DocumentoProjeto {
    this.enviados = this.enviados.filter((l) => l.lote !== lote)
    return this.rebase()
  }

  /**
   * (Re)conexão: o servidor mandou o documento dele. Lotes que ele já tinha aplicado (até `ultimoLote`) saem;
   * os demais voltam para a frente da fila e serão reenviados.
   */
  reiniciar(doc: DocumentoProjeto, seq: number, ultimoLote: number): DocumentoProjeto {
    this.confirmado = doc
    this.seq = seq
    const reenviar = this.enviados.filter((l) => l.lote > ultimoLote).flatMap((l) => l.ops)
    this.enviados = []
    this.fila = [...reenviar, ...this.fila]
    if (ultimoLote >= this.proximo) this.proximo = ultimoLote + 1
    return this.rebase()
  }

  /** O servidor recomeçou de outra base (versão mais nova gravada fora da sala). */
  novaBase(doc: DocumentoProjeto, seq: number): DocumentoProjeto {
    this.confirmado = doc
    this.seq = seq
    return this.rebase()
  }

  private rebase(): DocumentoProjeto {
    const pendentes = [...this.enviados.flatMap((l) => l.ops), ...this.fila]
    this.local = pendentes.length ? aplicarOps(this.confirmado, pendentes) : this.confirmado
    return this.local
  }
}

/** Uma tela grande demais para uma mensagem vai em partes: a tela sem camadas e depois cada camada. */
function dividir(op: Op, tamanho: number): Op[] {
  if (tamanho <= ALVO_LOTE || op.o !== 'cena+' || op.cena.layers.length < 2) return [op]
  const partes: Op[] = [{ o: 'cena+', cena: { ...op.cena, layers: [] }, apos: op.apos }]
  op.cena.layers.forEach((l, i) => partes.push({ o: 'cam+', c: op.cena.id, l, apos: i ? op.cena.layers[i - 1]!.id : null }))
  return partes
}
