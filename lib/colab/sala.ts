/**
 * Sala de colaboração: um Durable Object por projeto (nome = id do projeto), com WebSockets em hibernação.
 *
 * - Só chega aqui quem o Worker autenticou (sessão do Neon Auth + membro do workspace do projeto, ver entrada.ts);
 *   o Worker repassa quem é a pessoa num cabeçalho interno (o DO não é alcançável de fora).
 * - Cada lote de operações é validado (Zod + schema do documento), ganha um número de sequência e é repassado a
 *   todos: a ordem do servidor decide (last-writer-wins por propriedade). Visualizador não envia operações.
 * - O documento vive em memória e no SQLite do DO (instantâneo por tela + log das operações ainda não gravadas),
 *   então sobrevive à hibernação e a reinícios. O Neon continua sendo a fonte da verdade: a sala grava o documento
 *   consolidado com a revisão de tempos em tempos (alarme ~2 s depois da primeira mudança) e quando a sala esvazia.
 *   Se alguém gravou fora da sala (revisão mudou), a sala recomeça da versão do banco e reaplica as mudanças dela
 *   por cima, sem 409 para ninguém.
 */
import { DurableObject } from 'cloudflare:workers'
import type { DurableObjectState, WebSocket as WebSocketCf } from '@cloudflare/workers-types/index.ts'
import type { Cena, DocumentoProjeto, ModoProjeto } from '@/lib/scene/schema'
import { aplicarOps, cenaDaOp, type Op } from './ops'
import { aplicarLote, CABECALHO_ENTRADA, corDe, lerMensagemCliente, PING, PONG, RAJADA, TAXA_POR_SEGUNDO, type InfoEntrada, type MensagemServidor, type Papel, type Pessoa } from './protocolo'
import { carregarProjeto, gravarDocumento, papeisAtuais } from './salaServidor'


interface Anexo {
  id: string
  clienteId: string
  userId: string
  nome: string
  cor: string
  papel: Papel
  desde: number
  cenaId: string | null
  selecao: string[]
}

interface Meta {
  projetoId: string
  workspaceId: string
  modo: ModoProjeto
  /** Revisão do Neon que a sala tem como base. */
  revisao: number
  seq: number
  salvoSeq: number
  salvoEm: string | null
  /** Seq do instantâneo gravado no SQLite do DO. */
  instantaneoSeq: number
  /** Propriedades do documento fora as telas (tema…). */
  docMeta: Omit<DocumentoProjeto, 'scenes'>
}

const MAX_CONEXOES = 50
const ATRASO_SALVAR_MS = 2000
const INTERVALO_CONFERIR_MS = 30_000
const VIDA_CONEXAO_MS = 12 * 60 * 60 * 1000

export class SalaProjeto extends DurableObject<Record<string, unknown>> {
  private doc: DocumentoProjeto | null = null
  private meta: Meta | null = null
  private iniciando: Promise<boolean> | null = null
  private salvando: Promise<void> | null = null
  /** Quando o alarme está marcado (undefined = não sabemos, ex.: depois de acordar da hibernação). */
  private alarmeEm: number | null | undefined = undefined
  private conferidoEm = 0
  private falha: string | null = null
  private cenasSujas = new Set<string>()
  private estruturaSuja = true
  private cursores = new Map<string, { x: number; y: number } | null>()
  private fichas = new Map<string, { n: number; t: number; excesso: number }>()

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env)
    // só o schema local (sem I/O externo) dentro do blockConcurrencyWhile
    void ctx.blockConcurrencyWhile(async () => {
      const s = ctx.storage.sql
      s.exec('create table if not exists meta (k text primary key, v text not null)')
      s.exec('create table if not exists cenas (id text primary key, ordem integer not null, json text not null)')
      s.exec('create table if not exists ops (seq integer primary key, json text not null)')
      s.exec('create table if not exists clientes (id text primary key, lote integer not null, em integer not null)')
    })
    // ping/pong da aplicação sem acordar o DO
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG))
  }

  // ---------- entrada ----------

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Esperava WebSocket', { status: 426 })
    let info: InfoEntrada
    try { info = JSON.parse(req.headers.get(CABECALHO_ENTRADA) ?? '') as InfoEntrada } catch { return new Response('Entrada inválida', { status: 400 }) }
    if (!info?.userId || !info.projetoId) return new Response('Entrada inválida', { status: 400 })

    const conectados = this.ctx.getWebSockets()
    if (conectados.length >= MAX_CONEXOES) return new Response('Sala cheia', { status: 503 })
    // sala vazia: (re)começa do banco (pega mudanças feitas fora dela); com gente: memória ou SQLite do DO
    const pronto = conectados.length === 0 ? await this.iniciar(info.projetoId) : this.doc ? true : this.carregarInstantaneo() || (await this.iniciar(info.projetoId))
    if (!pronto || !this.doc || !this.meta) return new Response('Projeto não encontrado', { status: 404 })

    const par = new WebSocketPair()
    const cliente = par[0]
    const servidor = par[1]
    this.ctx.acceptWebSocket(servidor, [info.userId])
    const anexo: Anexo = { id: crypto.randomUUID().slice(0, 12), clienteId: info.clienteId, userId: info.userId, nome: info.nome.slice(0, 80) || 'Alguém', cor: corDe(info.userId), papel: info.papel, desde: Date.now(), cenaId: null, selecao: [] }
    servidor.serializeAttachment(anexo)
    const ultimoLote = this.ctx.storage.sql.exec<{ lote: number }>('select lote from clientes where id = ?', info.clienteId).toArray()[0]?.lote ?? 0
    const pessoas = this.outros(servidor).map((s) => this.pessoaDe(this.anexo(s)))
    this.enviar(servidor, { t: 'bemvindo', eu: this.pessoaDe(anexo), doc: this.doc, seq: this.meta.seq, revisao: this.meta.revisao, salvoSeq: this.meta.salvoSeq, salvoEm: this.meta.salvoEm, ultimoLote, pessoas })
    if (this.falha) this.enviar(servidor, { t: 'falha', mensagem: this.falha })
    this.difundir(servidor, { t: 'pessoa', pessoa: this.pessoaDe(anexo) })
    this.agendar(INTERVALO_CONFERIR_MS)
    return new Response(null, { status: 101, webSocket: cliente })
  }

  /** Carrega do Neon e reaplica as operações que a sala ainda não tinha gravado. */
  private iniciar(projetoId: string): Promise<boolean> {
    this.iniciando ??= (async () => {
      try {
        // uma gravação em andamento (a sala acabou de esvaziar) termina antes de recomeçar do banco
        if (this.salvando) await this.salvando
        const p = await carregarProjeto(projetoId)
        if (!p) return false
        const anterior = this.lerMeta()
        const salvoSeq = anterior?.projetoId === projetoId ? anterior.salvoSeq : 0
        const seq = anterior?.projetoId === projetoId ? anterior.seq : 0
        let doc = p.doc
        for (const ops of this.opsDepoisDe(salvoSeq)) {
          const r = aplicarLote(doc, ops, { modo: p.modo })
          if (r.ok) doc = r.doc
        }
        const { scenes: _s, ...docMeta } = doc
        this.meta = { projetoId, workspaceId: p.workspaceId, modo: p.modo, revisao: p.revisao, seq, salvoSeq, salvoEm: anterior?.salvoEm ?? null, instantaneoSeq: seq, docMeta }
        this.doc = doc
        this.estruturaSuja = true
        this.gravarInstantaneo()
        if (seq > salvoSeq) this.agendar(ATRASO_SALVAR_MS)
        return true
      } finally {
        this.iniciando = null
      }
    })()
    return this.iniciando
  }

  /** Depois da hibernação (com gente conectada): instantâneo do SQLite + operações posteriores. */
  private carregarInstantaneo(): boolean {
    const meta = this.lerMeta()
    if (!meta) return false
    const scenes = this.ctx.storage.sql.exec<{ json: string }>('select json from cenas order by ordem').toArray().map((r) => JSON.parse(r.json) as Cena)
    if (!scenes.length) return false
    let doc: DocumentoProjeto = { ...meta.docMeta, scenes } as DocumentoProjeto
    let seq = meta.instantaneoSeq
    for (const r of this.ctx.storage.sql.exec<{ seq: number; json: string }>('select seq, json from ops where seq > ? order by seq', meta.instantaneoSeq)) {
      doc = aplicarOps(doc, JSON.parse(r.json) as Op[])
      seq = r.seq
    }
    this.meta = { ...meta, seq: Math.max(meta.seq, seq) }
    this.doc = doc
    return true
  }

  // ---------- mensagens ----------

  async webSocketMessage(ws: WebSocketCf, mensagem: string | ArrayBuffer): Promise<void> {
    if (typeof mensagem !== 'string') { ws.close(1003, 'Só texto'); return }
    const a = this.anexo(ws)
    if (!this.taxa(a.id)) {
      const f = this.fichas.get(a.id)!
      if (f.excesso === 1) this.enviar(ws, { t: 'aviso', mensagem: 'Muitas mensagens: algumas foram ignoradas.' })
      if (f.excesso > 400) ws.close(1008, 'Mensagens demais')
      return
    }
    const m = lerMensagemCliente(mensagem)
    if (!m) { this.enviar(ws, { t: 'aviso', mensagem: 'Mensagem recusada pelo servidor.' }); return }
    if (!this.doc && !this.carregarInstantaneo()) { ws.close(1012, 'Sala reiniciando'); return }
    const doc = this.doc!
    const meta = this.meta!

    switch (m.t) {
      case 'ops': {
        if (a.papel === 'viewer') { this.enviar(ws, { t: 'rejeitado', lote: m.lote, motivo: 'Você tem acesso só para ver este projeto.' }); return }
        const r = aplicarLote(doc, m.ops, { modo: meta.modo })
        if (!r.ok) { this.enviar(ws, { t: 'rejeitado', lote: m.lote, motivo: r.motivo }); return }
        const seq = meta.seq + 1
        // persistir antes de responder (as gravações síncronas seguidas são atômicas no SQLite do DO)
        const sqlDo = this.ctx.storage.sql
        sqlDo.exec('insert into ops (seq, json) values (?, ?)', seq, JSON.stringify(m.ops))
        sqlDo.exec('insert into clientes (id, lote, em) values (?, ?, ?) on conflict(id) do update set lote = excluded.lote, em = excluded.em', a.clienteId, m.lote, Date.now())
        meta.seq = seq
        this.gravarMeta()
        this.doc = r.doc
        for (const op of m.ops) {
          const c = cenaDaOp(op)
          if (c) this.cenasSujas.add(c)
          if (op.o === 'cena+' || op.o === 'cena-' || op.o === 'cenas' || op.o === 'doc') this.estruturaSuja = true
        }
        this.enviar(ws, { t: 'ack', lote: m.lote, seq })
        this.difundir(ws, { t: 'ops', seq, ops: m.ops, de: a.id })
        this.agendar(ATRASO_SALVAR_MS)
        return
      }
      case 'presenca': {
        let mudouAnexo = false
        if (m.cenaId !== undefined && m.cenaId !== a.cenaId) { a.cenaId = m.cenaId; mudouAnexo = true }
        if (m.selecao && (m.selecao.length !== a.selecao.length || m.selecao.some((s, i) => s !== a.selecao[i]))) { a.selecao = m.selecao; mudouAnexo = true }
        if (mudouAnexo) ws.serializeAttachment(a)
        if (m.cursor !== undefined) this.cursores.set(a.id, m.cursor)
        this.difundir(ws, { t: 'pessoa', pessoa: this.pessoaDe(a) })
        return
      }
      case 'salvar': {
        if (meta.seq > meta.salvoSeq) await this.salvar()
        if (this.meta && this.meta.seq <= this.meta.salvoSeq) this.enviar(ws, { t: 'salvo', seq: this.meta.salvoSeq, revisao: this.meta.revisao, salvoEm: this.meta.salvoEm ?? new Date().toISOString() })
        else if (this.falha) this.enviar(ws, { t: 'falha', mensagem: this.falha })
        return
      }
    }
  }

  async webSocketClose(ws: WebSocketCf): Promise<void> {
    await this.saiu(ws)
  }

  async webSocketError(ws: WebSocketCf): Promise<void> {
    await this.saiu(ws)
  }

  private async saiu(ws: WebSocketCf) {
    let a: Anexo | null = null
    try { a = this.anexo(ws) } catch { /* sem anexo */ }
    if (a) {
      this.cursores.delete(a.id)
      this.fichas.delete(a.id)
      this.difundir(ws, { t: 'saiu', id: a.id })
    }
    if (this.outros(ws).length) return
    // a sala esvaziou: grava agora o que faltar
    if (!this.doc) this.carregarInstantaneo()
    if (this.meta && this.meta.seq > this.meta.salvoSeq) await this.salvar()
    this.ctx.storage.sql.exec('delete from clientes where em < ?', Date.now() - 7 * 24 * 60 * 60 * 1000)
  }

  // ---------- alarme: gravar no Neon e conferir acessos ----------

  async alarm(): Promise<void> {
    this.alarmeEm = null
    if (!this.doc) this.carregarInstantaneo()
    if (this.meta && this.meta.seq > this.meta.salvoSeq) await this.salvar()
    const vivos = this.ctx.getWebSockets()
    if (vivos.length && this.meta && Date.now() - this.conferidoEm >= INTERVALO_CONFERIR_MS - 1000) await this.conferirAcessos(vivos)
    const sujo = !!this.meta && this.meta.seq > this.meta.salvoSeq
    if (sujo) this.agendar(this.falha ? 15_000 : ATRASO_SALVAR_MS)
    else if (this.ctx.getWebSockets().length) this.agendar(INTERVALO_CONFERIR_MS)
  }

  /** Marca o alarme para daqui a `ms`, sem adiar um que já vai disparar antes. */
  private agendar(ms: number) {
    void (async () => {
      const quando = Date.now() + ms
      if (this.alarmeEm === undefined) this.alarmeEm = await this.ctx.storage.getAlarm()
      if (this.alarmeEm != null && this.alarmeEm <= quando) return
      this.alarmeEm = quando
      await this.ctx.storage.setAlarm(quando)
    })()
  }

  /** Quem saiu do workspace (ou mudou de papel) é desconectado/atualizado; conexões muito antigas reautenticam. */
  private async conferirAcessos(vivos: WebSocketCf[]) {
    this.conferidoEm = Date.now()
    const anexos = vivos.map((ws) => ({ ws, a: this.anexo(ws) }))
    let papeis: Map<string, Papel>
    try {
      papeis = await papeisAtuais(this.meta!.workspaceId, [...new Set(anexos.map((x) => x.a.userId))])
    } catch {
      return
    }
    for (const { ws, a } of anexos) {
      const papel = papeis.get(a.userId)
      if (!papel) { this.enviar(ws, { t: 'fim', motivo: 'sem_acesso' }); ws.close(4003, 'Sem acesso'); continue }
      if (Date.now() - a.desde > VIDA_CONEXAO_MS) { ws.close(4001, 'Reconecte'); continue }
      if (papel !== a.papel) {
        a.papel = papel
        ws.serializeAttachment(a)
        this.enviar(ws, { t: 'papel', papel })
        this.difundir(ws, { t: 'pessoa', pessoa: this.pessoaDe(a) })
      }
    }
  }

  private salvar(): Promise<void> {
    this.salvando ??= this.salvarAgora().finally(() => { this.salvando = null })
    return this.salvando
  }

  private async salvarAgora(): Promise<void> {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const meta = this.meta
      const doc = this.doc
      if (!meta || !doc || meta.seq <= meta.salvoSeq) return
      const alvo = meta.seq
      this.gravarInstantaneo()
      let r
      try {
        r = await gravarDocumento(meta.projetoId, meta.workspaceId, meta.revisao, doc)
      } catch (e) {
        console.error(JSON.stringify({ nivel: 'erro', origem: 'sala', mensagem: 'falha ao gravar no banco', causa: e instanceof Error ? e.message.slice(0, 200) : 'desconhecida' }))
        this.marcarFalha('Não foi possível salvar agora. Suas mudanças estão guardadas na sala e serão salvas em instantes.')
        return
      }
      if (r.ok) {
        meta.revisao = r.revisao
        meta.salvoSeq = Math.max(meta.salvoSeq, alvo)
        meta.salvoEm = r.salvoEm
        this.gravarMeta()
        this.ctx.storage.sql.exec('delete from ops where seq <= ?', Math.min(meta.salvoSeq, meta.instantaneoSeq))
        this.falha = null
        this.difundir(null, { t: 'salvo', seq: meta.salvoSeq, revisao: meta.revisao, salvoEm: r.salvoEm })
        return
      }
      if (r.motivo === 'removido') {
        this.difundir(null, { t: 'fim', motivo: 'projeto_removido' })
        for (const ws of this.ctx.getWebSockets()) ws.close(4004, 'Projeto removido')
        this.ctx.storage.sql.exec('delete from ops')
        meta.salvoSeq = meta.seq
        this.gravarMeta()
        return
      }
      if (r.motivo === 'invalido') {
        this.marcarFalha(`Não foi possível salvar: ${r.mensagem}`)
        return
      }
      // conflito: alguém gravou fora da sala. Recomeça da versão do banco com as mudanças da sala por cima.
      const p = await carregarProjeto(meta.projetoId)
      if (!p) continue
      let novo = p.doc
      for (const ops of this.opsDepoisDe(meta.salvoSeq)) {
        const lote = aplicarLote(novo, ops, { modo: meta.modo })
        if (lote.ok) novo = lote.doc
      }
      this.doc = novo
      meta.revisao = p.revisao
      this.estruturaSuja = true
      this.gravarInstantaneo()
      this.difundir(null, { t: 'base', doc: novo, seq: meta.seq, revisao: meta.revisao })
    }
  }

  private marcarFalha(mensagem: string) {
    this.falha = mensagem
    this.difundir(null, { t: 'falha', mensagem })
  }

  // ---------- armazenamento local do DO ----------

  private lerMeta(): Meta | null {
    const r = this.ctx.storage.sql.exec<{ v: string }>("select v from meta where k = 'meta'").toArray()[0]
    return r ? (JSON.parse(r.v) as Meta) : null
  }

  private gravarMeta() {
    if (!this.meta) return
    this.ctx.storage.sql.exec("insert into meta (k, v) values ('meta', ?) on conflict(k) do update set v = excluded.v", JSON.stringify(this.meta))
  }

  private opsDepoisDe(seq: number): Op[][] {
    return this.ctx.storage.sql.exec<{ json: string }>('select json from ops where seq > ? order by seq', seq).toArray().map((r) => JSON.parse(r.json) as Op[])
  }

  /** Instantâneo no SQLite do DO: só as telas que mudaram (ou todas, se a estrutura mudou). */
  private gravarInstantaneo() {
    const doc = this.doc
    const meta = this.meta
    if (!doc || !meta) return
    const s = this.ctx.storage.sql
    if (this.estruturaSuja) {
      s.exec('delete from cenas')
      doc.scenes.forEach((c, i) => s.exec('insert into cenas (id, ordem, json) values (?, ?, ?)', c.id, i, JSON.stringify(c)))
    } else {
      doc.scenes.forEach((c, i) => { if (this.cenasSujas.has(c.id)) s.exec('insert into cenas (id, ordem, json) values (?, ?, ?) on conflict(id) do update set ordem = excluded.ordem, json = excluded.json', c.id, i, JSON.stringify(c)) })
    }
    const { scenes: _s, ...docMeta } = doc
    meta.docMeta = docMeta
    meta.instantaneoSeq = meta.seq
    this.gravarMeta()
    this.cenasSujas.clear()
    this.estruturaSuja = false
  }

  // ---------- conexões ----------

  private anexo(ws: WebSocketCf): Anexo {
    return ws.deserializeAttachment() as Anexo
  }

  private pessoaDe(a: Anexo): Pessoa {
    return { id: a.id, userId: a.userId, nome: a.nome, cor: a.cor, papel: a.papel, cenaId: a.cenaId, cursor: this.cursores.get(a.id) ?? null, selecao: a.selecao }
  }

  private outros(ws: WebSocketCf | null): WebSocketCf[] {
    return this.ctx.getWebSockets().filter((s) => s !== ws && s.readyState === 1)
  }

  private enviar(ws: WebSocketCf, m: MensagemServidor) {
    try { ws.send(JSON.stringify(m)) } catch { /* conexão fechando */ }
  }

  /** Para todos menos `exceto` (null = todos). */
  private difundir(exceto: WebSocketCf | null, m: MensagemServidor) {
    const texto = JSON.stringify(m)
    for (const s of this.outros(exceto)) {
      try { s.send(texto) } catch { /* conexão fechando */ }
    }
  }

  /** Balde de fichas por conexão (presença + lotes). */
  private taxa(id: string): boolean {
    const agora = Date.now()
    const f = this.fichas.get(id) ?? { n: RAJADA, t: agora, excesso: 0 }
    f.n = Math.min(RAJADA, f.n + ((agora - f.t) / 1000) * TAXA_POR_SEGUNDO)
    f.t = agora
    this.fichas.set(id, f)
    if (f.n < 1) { f.excesso++; return false }
    f.n -= 1
    f.excesso = 0
    return true
  }
}
