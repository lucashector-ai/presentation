import { describe, expect, it } from 'vitest'
import { FORMATOS, SCHEMA_VERSION, novaCena, parseCamada, type Camada, type DocumentoProjeto } from '@/lib/scene/schema'
import { MotorDocumento } from './motor'
import { aplicarLote } from './protocolo'
import type { Op } from './ops'

const camada = (id: string, x = 0) => parseCamada({ id, type: 'shape', x, y: 0, width: 50, height: 50 })
function base(): DocumentoProjeto {
  return { schemaVersion: SCHEMA_VERSION, mode: 'slides', scenes: [novaCena({ id: 'tela-1', size: FORMATOS.slides169, layers: [camada('a'), camada('b'), camada('c')] })] }
}
const mudar = (d: DocumentoProjeto, id: string, patch: Partial<Camada>): DocumentoProjeto => ({ ...d, scenes: d.scenes.map((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Camada) : l)) })) })
const camadaDe = (d: DocumentoProjeto, id: string) => d.scenes[0]!.layers.find((l) => l.id === id)

/** Servidor de mentira: ordena os lotes, aplica e devolve ack/ops como o Durable Object. */
class Servidor {
  doc = base()
  seq = 0
  clientes: { motor: MotorDocumento; caixa: { tipo: 'ops' | 'ack'; seq: number; ops?: Op[]; lote?: number }[] }[] = []
  conectar(motor: MotorDocumento) { const c = { motor, caixa: [] as Servidor['clientes'][number]['caixa'] }; this.clientes.push(c); motor.reiniciar(this.doc, this.seq, 0); return c }
  receber(de: MotorDocumento, lote: { lote: number; ops: Op[] }) {
    const r = aplicarLote(this.doc, lote.ops, { modo: 'slides' })
    if (!r.ok) throw new Error(r.motivo)
    this.doc = r.doc
    this.seq++
    for (const c of this.clientes) c.caixa.push(c.motor === de ? { tipo: 'ack', seq: this.seq, lote: lote.lote } : { tipo: 'ops', seq: this.seq, ops: lote.ops })
  }
  entregar() {
    for (const c of this.clientes) {
      for (const m of c.caixa.splice(0)) {
        if (m.tipo === 'ack') c.motor.confirmar(m.lote!, m.seq)
        else c.motor.remoto(m.seq, m.ops!)
      }
    }
  }
}

describe('MotorDocumento', () => {
  it('duas pessoas editando ao mesmo tempo convergem para o mesmo documento, sem perder edições', () => {
    const s = new Servidor()
    const ana = new MotorDocumento(base())
    const bruno = new MotorDocumento(base())
    s.conectar(ana)
    s.conectar(bruno)
    // as duas editam antes de ver a mudança da outra
    ana.editar(mudar(ana.local, 'a', { x: 100 }))
    bruno.editar(mudar(bruno.local, 'b', { x: 200 }))
    bruno.editar(mudar(bruno.local, 'a', { y: 50 }))
    s.receber(ana, ana.proximoLote()!)
    s.receber(bruno, bruno.proximoLote()!)
    s.entregar()
    expect(ana.pendente).toBe(false)
    expect(bruno.pendente).toBe(false)
    expect(ana.local).toEqual(s.doc)
    expect(bruno.local).toEqual(s.doc)
    expect(camadaDe(s.doc, 'a')).toMatchObject({ x: 100, y: 50 })
    expect(camadaDe(s.doc, 'b')).toMatchObject({ x: 200 })
  })

  it('mudança local pendente continua na tela quando chega uma remota na mesma propriedade, e o servidor decide pela ordem', () => {
    const s = new Servidor()
    const ana = new MotorDocumento(base())
    const bruno = new MotorDocumento(base())
    s.conectar(ana)
    s.conectar(bruno)
    ana.editar(mudar(ana.local, 'c', { x: 1 }))
    bruno.editar(mudar(bruno.local, 'c', { x: 2 }))
    const la = ana.proximoLote()!
    const lb = bruno.proximoLote()!
    s.receber(bruno, lb)
    // Ana recebe a do Bruno antes do próprio ack: a dela (pendente) continua valendo na tela
    s.entregar()
    expect(camadaDe(ana.local, 'c')!.x).toBe(1)
    s.receber(ana, la)
    s.entregar()
    expect(camadaDe(ana.local, 'c')!.x).toBe(1)
    expect(camadaDe(bruno.local, 'c')!.x).toBe(1)
    expect(ana.local).toEqual(bruno.local)
  })

  it('offline: edita localmente, reconecta, reenvia o que faltava e converge', () => {
    const s = new Servidor()
    const ana = new MotorDocumento(base())
    const bruno = new MotorDocumento(base())
    s.conectar(ana)
    s.conectar(bruno)
    // Bruno manda um lote, cai antes do ack (o servidor aplicou) e continua editando offline
    bruno.editar(mudar(bruno.local, 'b', { x: 10 }))
    s.receber(bruno, bruno.proximoLote()!)
    s.clientes[1]!.caixa = []
    bruno.editar(mudar(bruno.local, 'b', { y: 20 }))
    bruno.editar(mudar(bruno.local, 'c', { width: 99 }))
    // Ana segue online
    ana.editar(mudar(ana.local, 'a', { x: 7 }))
    s.receber(ana, ana.proximoLote()!)
    s.entregar()
    // Bruno volta: o servidor diz que já aplicou o lote 1
    bruno.reiniciar(s.doc, s.seq, 1)
    let l
    while ((l = bruno.proximoLote())) s.receber(bruno, l)
    s.entregar()
    expect(bruno.local).toEqual(s.doc)
    expect(ana.local).toEqual(s.doc)
    expect(camadaDe(s.doc, 'a')).toMatchObject({ x: 7 })
    expect(camadaDe(s.doc, 'b')).toMatchObject({ x: 10, y: 20 })
    expect(camadaDe(s.doc, 'c')).toMatchObject({ width: 99 })
  })

  it('aleatório: muitas edições concorrentes de três pessoas sempre convergem', () => {
    let semente = 42
    const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const s = new Servidor()
    const pessoas = [new MotorDocumento(base()), new MotorDocumento(base()), new MotorDocumento(base())]
    for (const p of pessoas) s.conectar(p)
    for (let passo = 0; passo < 400; passo++) {
      const p = pessoas[Math.floor(rnd() * 3)]!
      const acao = rnd()
      const ids = p.local.scenes[0]!.layers.map((l) => l.id)
      if (acao < 0.5 && ids.length) p.editar(mudar(p.local, ids[Math.floor(rnd() * ids.length)]!, { x: Math.round(rnd() * 500), opacity: Math.round(rnd() * 10) / 10 }))
      else if (acao < 0.65) p.editar({ ...p.local, scenes: p.local.scenes.map((c) => ({ ...c, layers: [...c.layers, camada(`n${passo}`, passo)] })) })
      else if (acao < 0.75 && ids.length > 1) p.editar({ ...p.local, scenes: p.local.scenes.map((c) => ({ ...c, layers: c.layers.filter((l) => l.id !== ids[0]) })) })
      else if (acao < 0.85) p.editar({ ...p.local, scenes: p.local.scenes.map((c) => ({ ...c, layers: [...c.layers].reverse() })) })
      else { const l = p.proximoLote(); if (l) s.receber(p, l) }
      if (rnd() < 0.3) s.entregar()
    }
    for (const p of pessoas) { let l; while ((l = p.proximoLote())) s.receber(p, l) }
    s.entregar()
    for (const p of pessoas) expect(p.local).toEqual(s.doc)
  })
})
