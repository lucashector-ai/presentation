'use client'
/**
 * Conexão do editor com a sala do projeto (WebSocket com o Durable Object). Leva as operações do motor para o
 * servidor em lotes (~40 ms), aplica as das outras pessoas, mantém a presença (quem está, onde, cursor e seleção)
 * e reconecta sozinha: sem rede, o editor continua editando localmente (fila do motor) e sincroniza ao voltar.
 */
import type { DocumentoProjeto } from '@/lib/scene/schema'
import type { MotorDocumento } from './motor'
import { PING, type MensagemServidor, type Papel, type Pessoa } from './protocolo'

export type EstadoConexao = 'conectando' | 'online' | 'offline' | 'reconectando' | 'encerrada'

export interface InstantaneoSala {
  conexao: EstadoConexao
  eu: Pessoa | null
  /** As outras conexões na sala (a mesma pessoa em duas abas aparece duas vezes; a UI agrupa por userId). */
  pessoas: Pessoa[]
  papel: Papel | null
  /** Revisão do banco que a sala gravou por último (base para publicar). */
  revisao: number
  salvoEm: string | null
  /** Há mudança minha ainda não confirmada pela sala ou ainda não gravada no banco. */
  pendente: boolean
  /** Última falha de gravação informada pela sala (null = tudo certo). */
  falha: string | null
  /** A sala encerrou esta conexão de vez (sem acesso, projeto removido). */
  fim: string | null
}

const ENVIO_MS = 40
const PRESENCA_MS = 50
const PING_MS = 15_000
const SILENCIO_MAX_MS = 40_000
const MAX_EM_VOO = 6

const MOTIVOS_FIM: Record<string, string> = {
  sem_acesso: 'Você não tem mais acesso a este projeto.',
  projeto_removido: 'Este projeto foi para a lixeira.',
  sessao_expirada: 'Sua sessão expirou. Entre de novo para continuar.',
}

function idCliente(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export interface OuvintesSala {
  /** O documento local mudou por causa da sala (operação de outra pessoa, reconexão, lote recusado). */
  aoDocumento: (doc: DocumentoProjeto) => void
  aoAviso: (texto: string, tipo: 'info' | 'erro') => void
  /** A sala recusou a conexão porque a sessão caiu (o editor manda para o login). */
  aoSemSessao?: () => void
}

export class ConexaoSala {
  readonly clienteId = idCliente()
  private ws: WebSocket | null = null
  private inst: InstantaneoSala
  private ouvintes = new Set<() => void>()
  private pessoas = new Map<string, Pessoa>()
  private fechada = false
  private tentativas = 0
  private abriuAlgumaVez = false
  private timerReconectar: number | undefined
  private timerEnvio: number | undefined
  private timerPing: number | undefined
  private timerPresenca: number | undefined
  private ultimoContato = 0
  private salvoSeq = 0
  private presencaPendente: { cenaId?: string | null; cursor?: { x: number; y: number } | null; selecao?: string[] } | null = null
  private ultimaPresenca: { cenaId: string | null; selecao: string[] } = { cenaId: null, selecao: [] }
  private esperas: { resolver: (ok: boolean) => void; pediu: boolean; timer: number }[] = []

  constructor(private projetoId: string, private motor: MotorDocumento, private ouvir: OuvintesSala) {
    this.inst = { conexao: 'conectando', eu: null, pessoas: [], papel: null, revisao: 0, salvoEm: null, pendente: false, falha: null, fim: null }
  }

  // ---------- estado observável ----------
  assinar = (f: () => void) => {
    this.ouvintes.add(f)
    return () => { this.ouvintes.delete(f) }
  }
  instantaneo = () => this.inst
  private atualizar(patch: Partial<InstantaneoSala> = {}) {
    const pendente = this.motor.pendente || this.motor.meuSeq > this.salvoSeq
    this.inst = { ...this.inst, ...patch, pendente, pessoas: patch.pessoas ?? this.inst.pessoas }
    this.ouvintes.forEach((f) => f())
    this.conferirEsperas()
  }
  private atualizarPessoas() {
    this.atualizar({ pessoas: [...this.pessoas.values()] })
  }

  // ---------- conexão ----------
  conectar() {
    if (this.fechada || typeof window === 'undefined') return
    window.clearTimeout(this.timerReconectar)
    if (!navigator.onLine) { this.atualizar({ conexao: 'offline' }); return }
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/projects/${this.projetoId}/sala?cliente=${this.clienteId}`
    let ws: WebSocket
    try { ws = new WebSocket(url) } catch { this.agendarReconexao(); return }
    this.ws = ws
    if (this.inst.conexao !== 'online') this.atualizar({ conexao: this.abriuAlgumaVez ? 'reconectando' : 'conectando' })
    ws.onopen = () => { this.ultimoContato = Date.now() }
    ws.onmessage = (ev) => {
      this.ultimoContato = Date.now()
      if (typeof ev.data !== 'string') return
      let m: MensagemServidor
      try { m = JSON.parse(ev.data) as MensagemServidor } catch { return }
      this.receber(m)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      window.clearInterval(this.timerPing)
      this.pessoas.clear()
      this.esperas.splice(0).forEach((e) => { window.clearTimeout(e.timer); e.resolver(false) })
      if (this.fechada || this.inst.fim) { this.atualizar({ conexao: 'encerrada', pessoas: [] }); return }
      this.atualizar({ conexao: navigator.onLine ? 'reconectando' : 'offline', pessoas: [] })
      this.agendarReconexao()
    }
    window.clearInterval(this.timerPing)
    this.timerPing = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return
      if (Date.now() - this.ultimoContato > SILENCIO_MAX_MS) { ws.close(); return }
      ws.send(PING)
    }, PING_MS)
    window.addEventListener('online', this.aoOnline)
    window.addEventListener('offline', this.aoOffline)
  }

  private aoOnline = () => { if (!this.ws && !this.fechada) { this.tentativas = 0; this.conectar() } }
  /** Sem rede: fecha já (o navegador demoraria a perceber) e passa a editar só localmente. */
  private aoOffline = () => {
    const ws = this.ws
    if (ws) { this.ws = null; ws.onclose = null; ws.close(); window.clearInterval(this.timerPing) }
    this.pessoas.clear()
    this.esperas.splice(0).forEach((e) => { window.clearTimeout(e.timer); e.resolver(false) })
    if (!this.fechada) this.atualizar({ conexao: 'offline', pessoas: [] })
  }

  private agendarReconexao() {
    if (this.fechada) return
    this.tentativas++
    // a conexão nunca abriu algumas vezes seguidas: confere se a sessão ou o acesso caíram (o WebSocket não diz o status)
    if (this.tentativas === 3) void this.diagnosticar()
    const espera = Math.min(10_000, 400 * 2 ** Math.min(this.tentativas, 5)) * (0.75 + Math.random() * 0.5)
    this.timerReconectar = window.setTimeout(() => this.conectar(), espera)
  }

  private async diagnosticar() {
    try {
      const r = await fetch(`/api/projects/${this.projetoId}`, { credentials: 'same-origin' })
      if (r.status === 401) { this.encerrar('sessao_expirada'); this.ouvir.aoSemSessao?.() }
      else if (r.status === 404) this.encerrar('sem_acesso')
    } catch { /* sem rede: segue tentando */ }
  }

  private encerrar(motivo: string) {
    window.clearTimeout(this.timerReconectar)
    this.ouvir.aoAviso(MOTIVOS_FIM[motivo] ?? 'A sala encerrou esta conexão.', 'erro')
    this.atualizar({ fim: motivo, conexao: 'encerrada', pessoas: [] })
    const ws = this.ws
    this.ws = null
    ws?.close()
  }

  /** Fecha de vez (o editor saiu): manda o que faltava antes. */
  fechar() {
    this.enviarFila()
    this.fechada = true
    window.clearTimeout(this.timerReconectar)
    window.clearTimeout(this.timerEnvio)
    window.clearTimeout(this.timerPresenca)
    window.clearInterval(this.timerPing)
    window.removeEventListener('online', this.aoOnline)
    window.removeEventListener('offline', this.aoOffline)
    this.ws?.close(1000)
    this.ws = null
  }

  // ---------- mensagens do servidor ----------
  private receber(m: MensagemServidor) {
    switch (m.t) {
      case 'bemvindo': {
        this.abriuAlgumaVez = true
        this.tentativas = 0
        const enviados = this.motor.enviados.map((l) => l.lote)
        const doc = this.motor.reiniciar(m.doc, m.seq, m.ultimoLote)
        // um lote meu que o servidor já tinha (o ack se perdeu na queda) conta como meu
        if (enviados.some((l) => l <= m.ultimoLote)) this.motor.meuSeq = Math.max(this.motor.meuSeq, m.seq)
        this.salvoSeq = m.salvoSeq
        this.pessoas = new Map(m.pessoas.map((p) => [p.id, p]))
        this.ouvir.aoDocumento(doc)
        this.atualizar({ conexao: 'online', eu: m.eu, papel: m.eu.papel, revisao: m.revisao, salvoEm: m.salvoEm, pessoas: [...this.pessoas.values()], falha: null })
        // a presença desta aba volta a valer para os outros
        this.presenca({ ...this.ultimaPresenca })
        this.enviarFila()
        return
      }
      case 'ops':
        this.ouvir.aoDocumento(this.motor.remoto(m.seq, m.ops))
        this.atualizar()
        return
      case 'ack':
        this.motor.confirmar(m.lote, m.seq)
        this.atualizar()
        if (this.motor.fila.length) this.enviarFila()
        return
      case 'rejeitado':
        this.ouvir.aoDocumento(this.motor.rejeitar(m.lote))
        this.ouvir.aoAviso(`Uma mudança não foi aceita pelo servidor e foi desfeita: ${m.motivo}`, 'erro')
        this.atualizar()
        return
      case 'pessoa':
        if (m.pessoa.id === this.inst.eu?.id) return
        this.pessoas.set(m.pessoa.id, m.pessoa)
        this.atualizarPessoas()
        return
      case 'saiu':
        if (this.pessoas.delete(m.id)) this.atualizarPessoas()
        return
      case 'salvo':
        this.salvoSeq = Math.max(this.salvoSeq, m.seq)
        this.atualizar({ revisao: m.revisao, salvoEm: m.salvoEm, falha: null })
        return
      case 'base':
        this.ouvir.aoDocumento(this.motor.novaBase(m.doc, m.seq))
        this.atualizar({ revisao: m.revisao })
        return
      case 'falha':
        this.atualizar({ falha: m.mensagem })
        this.esperas.filter((e) => e.pediu).forEach((e) => this.resolverEspera(e, false))
        return
      case 'papel':
        this.atualizar({ papel: m.papel, eu: this.inst.eu ? { ...this.inst.eu, papel: m.papel } : null })
        this.ouvir.aoAviso(m.papel === 'viewer' ? 'Seu acesso mudou para visualização.' : 'Agora você pode editar este projeto.', 'info')
        return
      case 'aviso':
        this.ouvir.aoAviso(m.mensagem, 'info')
        return
      case 'fim':
        this.encerrar(m.motivo)
        return
      case 'pong':
        return
    }
  }

  // ---------- envio ----------
  /** Houve edição local: manda em breve (junta as mudanças de ~40 ms num lote). */
  notificarEdicao() {
    this.atualizar()
    if (this.timerEnvio !== undefined) return
    this.timerEnvio = window.setTimeout(() => { this.timerEnvio = undefined; this.enviarFila() }, ENVIO_MS)
  }

  private enviarFila() {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN || this.inst.conexao !== 'online') return
    while (this.motor.fila.length && this.motor.enviados.length < MAX_EM_VOO) {
      const lote = this.motor.proximoLote()
      if (!lote) break
      ws.send(JSON.stringify({ t: 'ops', lote: lote.lote, ops: lote.ops }))
    }
  }

  /** Presença desta aba (tela, cursor em coordenadas da tela, seleção), no máximo a cada 50 ms. */
  presenca(p: { cenaId?: string | null; cursor?: { x: number; y: number } | null; selecao?: string[] }) {
    if (p.cenaId !== undefined) this.ultimaPresenca.cenaId = p.cenaId
    if (p.selecao) this.ultimaPresenca.selecao = p.selecao.slice(0, 100)
    this.presencaPendente = { ...(this.presencaPendente ?? {}), ...p, ...(p.selecao ? { selecao: p.selecao.slice(0, 100) } : {}) }
    if (this.timerPresenca !== undefined) return
    this.timerPresenca = window.setTimeout(() => {
      this.timerPresenca = undefined
      const ws = this.ws
      const pendente = this.presencaPendente
      if (!ws || ws.readyState !== WebSocket.OPEN || !pendente || this.inst.conexao !== 'online') return
      this.presencaPendente = null
      ws.send(JSON.stringify({ t: 'presenca', ...pendente }))
    }, PRESENCA_MS)
  }

  /** Grava agora: espera a sala confirmar minhas mudanças e gravar no banco. false = sem conexão ou falhou. */
  salvarAgora(timeoutMs = 20_000): Promise<boolean> {
    if (this.inst.conexao !== 'online') return Promise.resolve(false)
    this.enviarFila()
    return new Promise((resolver) => {
      const espera = { resolver, pediu: false, timer: 0 }
      espera.timer = window.setTimeout(() => this.resolverEspera(espera, false), timeoutMs)
      this.esperas.push(espera)
      this.conferirEsperas()
    })
  }

  private resolverEspera(e: ConexaoSala['esperas'][number], ok: boolean) {
    const i = this.esperas.indexOf(e)
    if (i < 0) return
    this.esperas.splice(i, 1)
    window.clearTimeout(e.timer)
    e.resolver(ok)
  }

  private conferirEsperas() {
    for (const e of [...this.esperas]) {
      if (!this.motor.pendente && this.motor.meuSeq <= this.salvoSeq) { this.resolverEspera(e, true); continue }
      if (!this.motor.pendente && !e.pediu && this.ws?.readyState === WebSocket.OPEN) {
        e.pediu = true
        this.ws.send(JSON.stringify({ t: 'salvar' }))
      }
    }
  }
}
