import { describe, expect, it } from 'vitest'
import { FORMATOS, SCHEMA_VERSION, novaCena, parseCamada, type Camada, type DocumentoProjeto } from '@/lib/scene/schema'
import { aplicarOps, compactar, diferenca, iguais } from './ops'
import { aplicarLote, lerMensagemCliente, MensagemClienteSchema } from './protocolo'

const texto = (id: string, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'text', text: id, x: 0, y: 0, width: 100, height: 40, ...extra })
const forma = (id: string, extra: Record<string, unknown> = {}) => parseCamada({ id, type: 'shape', x: 10, y: 10, width: 50, height: 50, ...extra })

function doc(): DocumentoProjeto {
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: 'slides',
    scenes: [
      novaCena({ id: 'tela-1', title: 'Capa', size: FORMATOS.slides169, layers: [texto('t1'), forma('f1')] }),
      novaCena({ id: 'tela-2', title: 'Dois', size: FORMATOS.slides169, layers: [texto('t2')] }),
    ],
  }
}

const mudarCamada = (d: DocumentoProjeto, cena: string, id: string, fn: (l: Camada) => Camada): DocumentoProjeto => ({
  ...d,
  scenes: d.scenes.map((s) => (s.id === cena ? { ...s, layers: s.layers.map((l) => (l.id === id ? fn(l) : l)) } : s)),
})

describe('diferenca / aplicarOps', () => {
  it('sem mudança não gera operação', () => {
    const a = doc()
    expect(diferenca(a, a)).toEqual([])
    expect(diferenca(a, structuredClone(a))).toEqual([])
  })

  it('muda só a propriedade alterada da camada', () => {
    const a = doc()
    const b = mudarCamada(a, 'tela-1', 't1', (l) => ({ ...l, x: 300 }))
    const ops = diferenca(a, b)
    expect(ops).toEqual([{ o: 'cam', c: 'tela-1', id: 't1', p: { x: 300 } }])
    expect(aplicarOps(a, ops)).toEqual(b)
  })

  it('adicionar, remover e reordenar camadas e telas é reproduzido exatamente', () => {
    const a = doc()
    let b = mudarCamada(a, 'tela-1', 'f1', (l) => ({ ...l, opacity: 0.5 }))
    b = { ...b, scenes: [b.scenes[1]!, novaCena({ id: 'tela-3', size: FORMATOS.slides169 }), b.scenes[0]!] }
    b = { ...b, scenes: b.scenes.map((s) => (s.id === 'tela-1' ? { ...s, title: 'Nova capa', layers: [forma('f2'), ...s.layers.filter((l) => l.id !== 't1')].reverse() } : s)) }
    const ops = diferenca(a, b)
    expect(aplicarOps(a, ops)).toEqual(b)
    // o inverso desfaz
    expect(aplicarOps(b, diferenca(b, a))).toEqual(a)
  })

  it('remover uma chave opcional vira `d`', () => {
    const a = mudarCamada(doc(), 'tela-1', 't1', (l) => ({ ...l, ariaLabel: 'rótulo' }))
    const b = mudarCamada(a, 'tela-1', 't1', (l) => { const { ariaLabel: _a, ...resto } = l; return resto as Camada })
    const ops = diferenca(a, b)
    expect(ops).toEqual([{ o: 'cam', c: 'tela-1', id: 't1', d: ['ariaLabel'] }])
    expect(aplicarOps(a, ops)).toEqual(b)
  })

  it('edições em camadas diferentes (ou propriedades diferentes) feitas ao mesmo tempo se somam', () => {
    const base = doc()
    const ana = diferenca(base, mudarCamada(base, 'tela-1', 't1', (l) => ({ ...l, x: 111 })))
    const bruno = diferenca(base, mudarCamada(base, 'tela-1', 't1', (l) => ({ ...l, y: 222 })))
    const outra = diferenca(base, mudarCamada(base, 'tela-1', 'f1', (l) => ({ ...l, width: 333 })))
    const r = aplicarOps(base, [...ana, ...bruno, ...outra])
    const t1 = r.scenes[0]!.layers.find((l) => l.id === 't1')!
    expect([t1.x, t1.y, r.scenes[0]!.layers.find((l) => l.id === 'f1')!.width]).toEqual([111, 222, 333])
  })

  it('operação numa camada apagada por outra pessoa não faz nada', () => {
    const base = doc()
    const apagar = diferenca(base, { ...base, scenes: base.scenes.map((s) => (s.id === 'tela-1' ? { ...s, layers: s.layers.filter((l) => l.id !== 't1') } : s)) })
    const mover = diferenca(base, mudarCamada(base, 'tela-1', 't1', (l) => ({ ...l, x: 5 })))
    const r = aplicarOps(base, [...apagar, ...mover])
    expect(r.scenes[0]!.layers.map((l) => l.id)).toEqual(['f1'])
  })

  it('compactar junta movimentos seguidos sem mudar o resultado', () => {
    const base = doc()
    let d = base
    const ops = []
    for (let i = 1; i <= 60; i++) {
      const n = mudarCamada(d, 'tela-1', 't1', (l) => ({ ...l, x: i, y: i * 2 }))
      ops.push(...diferenca(d, n))
      d = n
    }
    const nova = { ...d, scenes: d.scenes.map((s) => (s.id === 'tela-2' ? { ...s, layers: [...s.layers, forma('f9')] } : s)) }
    ops.push(...diferenca(d, nova))
    const mudou = mudarCamada(nova, 'tela-2', 'f9', (l) => ({ ...l, x: 99 }))
    ops.push(...diferenca(nova, mudou))
    const c = compactar(ops)
    expect(c.length).toBe(2)
    expect(aplicarOps(base, c)).toEqual(aplicarOps(base, ops))
  })

  it('iguais compara estrutura e ignora chaves undefined', () => {
    expect(iguais({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(iguais([1, { x: [2] }], [1, { x: [2] }])).toBe(true)
    expect(iguais({ a: 1 }, { a: 2 })).toBe(false)
  })
})

describe('aplicarLote (servidor)', () => {
  it('aceita um lote válido', () => {
    const base = doc()
    const ops = diferenca(base, mudarCamada(base, 'tela-1', 't1', (l) => ({ ...l, x: 1 })))
    const r = aplicarLote(base, ops, { modo: 'slides' })
    expect(r.ok).toBe(true)
  })

  it('recusa camada inválida, chave desconhecida, apagar a última tela e mudar o modo', () => {
    const base = doc()
    expect(aplicarLote(base, [{ o: 'cam', c: 'tela-1', id: 't1', p: { width: -5 } }], { modo: 'slides' }).ok).toBe(false)
    expect(aplicarLote(base, [{ o: 'cam', c: 'tela-1', id: 't1', p: { lixo: 'x'.repeat(10) } }], { modo: 'slides' }).ok).toBe(false)
    expect(aplicarLote(base, [{ o: 'cena-', id: 'tela-1' }, { o: 'cena-', id: 'tela-2' }], { modo: 'slides' }).ok).toBe(false)
    expect(aplicarLote(base, [{ o: 'doc', p: { mode: 'story' } }], { modo: 'slides' }).ok).toBe(false)
    expect(aplicarLote(base, [{ o: 'cam+', c: 'tela-1', l: { id: 'x', type: 'text' } as unknown as Camada, apos: null }], { modo: 'slides' }).ok).toBe(false)
  })

  it('o schema das mensagens recusa chaves perigosas e lixo', () => {
    expect(lerMensagemCliente('{"t":"ops","lote":1,"ops":[{"o":"cam","c":"tela-1","id":"t1","p":{"__proto__":{"x":1}}}]}')).toBeNull()
    expect(lerMensagemCliente('{"t":"ops","lote":1,"ops":[{"o":"cam","c":"tela-1","id":"t1","p":{"x":1}}]}')).not.toBeNull()
    expect(lerMensagemCliente('não é json')).toBeNull()
    expect(lerMensagemCliente(`{"t":"salvar","x":"${'a'.repeat(3 * 1024 * 1024)}"}`)).toBeNull()
    expect(MensagemClienteSchema.safeParse({ t: 'ops', lote: 1, ops: [{ o: 'cam', c: '../x', id: 't1' }] }).success).toBe(false)
    expect(MensagemClienteSchema.safeParse({ t: 'presenca', cursor: { x: Infinity, y: 0 } }).success).toBe(false)
    expect(MensagemClienteSchema.safeParse({ t: 'qualquer' }).success).toBe(false)
    expect(MensagemClienteSchema.safeParse({ t: 'presenca', cenaId: 'tela-1', cursor: { x: 10, y: 20 }, selecao: ['t1'] }).success).toBe(true)
  })
})
