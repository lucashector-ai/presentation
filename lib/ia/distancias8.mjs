/**
 * Conferência da regra do 8 pelas DISTÂNCIAS, como o editor mede (Alt sobre um vizinho): em cada tela, a distância
 * borda a borda entre vizinhos e de cada filho até as bordas do pai é múltipla de 8. Puro (sem DOM): recebe as
 * camadas (id, tipo, pai) e as caixas finais em coordenadas da cena — no navegador, as caixas reais do DOM
 * (e2e/fluxo.mjs); nos testes, o layout depois de medir os textos de novo (lib/ia/grade8.test.ts).
 *
 * Confere:
 *  - vizinhos horizontais (irmãos no mesmo pai, sobrepostos no eixo vertical, nada entre os dois);
 *  - vizinhos verticais (sobrepostos no eixo horizontal);
 *  - de cada filho até as quatro bordas do pai (padding).
 * Irmãos de pais diferentes não precisam de conferência: a distância entre eles é a soma das distâncias até as
 * bordas dos pais e entre os pais.
 *
 * Exceções (documentadas em lib/ia/grade8.ts):
 *  - espessura de fios (formas de até 6 px num eixo): nesse eixo, as distâncias do fio não contam;
 *  - comprimento das barras de dados (ids "barra-" e "gap-"): a ponta fora da grade é o valor. Conta só a distância
 *    da ponta até o rótulo que a acompanha (o texto a menos de 32 px dela); as outras distâncias desse rótulo, no
 *    mesmo eixo, carregam o comprimento da barra e não contam. Barra centrada (as duas pontas fora da grade): nenhuma
 *    distância das pontas conta;
 *  - marcadores sobre os pontos do gráfico de linha (ids "marcador-" numa tela com "area-").
 */

const TOL = 0.5
const GRADE = 8
const de8 = (v) => Math.abs(v / 8 - Math.round(v / 8)) * 8 < TOL
const arred = (v) => Math.round(v * 100) / 100

/**
 * @param {{ id: string, type: string, parentId?: string, hidden?: boolean, text?: string }[]} camadas
 * @param {Map<string, { x: number, y: number, w: number, h: number }>} caixas caixas finais (cena), por id
 * @param {{ width: number, height: number }} tamanho tamanho da tela
 * @returns {{ problemas: string[], conferidas: number }}
 */
export function distanciasForaDe8(camadas, caixas, tamanho) {
  const linha = camadas.some((l) => /^area-/.test(l.id))
  const filhosDe = new Map()
  for (const l of camadas) {
    if (l.hidden || !caixas.has(l.id)) continue
    if (linha && /^marcador-/.test(l.id)) continue
    const p = typeof l.parentId === 'string' && caixas.has(l.parentId) ? l.parentId : ''
    filhosDe.set(p, [...(filhosDe.get(p) ?? []), l])
  }
  const problemas = []
  let conferidas = 0
  const nome = (l) => `${l.id}${l.type === 'text' ? ` "${String(l.text ?? '').slice(0, 24)}"` : ''}`
  const fino = (l, eixo) => l.type === 'shape' && (eixo === 'x' ? caixas.get(l.id).w : caixas.get(l.id).h) <= 6
  const barra = (l) => /^(barra|gap)-/.test(l.id)
  for (const [pai, filhos] of filhosDe) {
    const P = pai ? caixas.get(pai) : { x: 0, y: 0, w: tamanho.width, h: tamanho.height }
    // barras: qual ponta está fora da grade (a partir do pai) em cada eixo — 'fim', 'inicio' ou 'ambas'
    const ponta = new Map()
    for (const l of filhos) {
      if (!barra(l)) continue
      const b = caixas.get(l.id)
      const p = {}
      for (const [e, t] of [['x', 'w'], ['y', 'h']]) {
        const ini = de8(b[e] - P[e])
        const fim = de8(b[e] + b[t] - P[e])
        if (!ini || !fim) p[e] = ini ? 'fim' : fim ? 'inicio' : 'ambas'
      }
      ponta.set(l.id, p)
    }
    /** Pares vizinhos num eixo: [A, B, distância], A antes de B, sobrepostos no outro eixo, nada entre os dois. */
    const pares = (eixo) => {
      const [p0, t0, q0, u0] = eixo === 'x' ? ['x', 'w', 'y', 'h'] : ['y', 'h', 'x', 'w']
      const sobre = (a, b) => Math.min(a[q0] + a[u0], b[q0] + b[u0]) - Math.max(a[q0], b[q0]) > TOL
      const r = []
      for (const A of filhos) for (const B of filhos) {
        if (A === B) continue
        const a = caixas.get(A.id)
        const b = caixas.get(B.id)
        if (b[p0] < a[p0] + a[t0] - TOL || !sobre(a, b)) continue
        const entre = filhos.some((C) => {
          if (C === A || C === B) return false
          const c = caixas.get(C.id)
          return c[p0] >= a[p0] + a[t0] - TOL && c[p0] + c[t0] <= b[p0] + TOL && (sobre(c, a) || sobre(c, b))
        })
        if (!entre) r.push([A, B, b[p0] - (a[p0] + a[t0])])
      }
      return r
    }
    /** Rótulos que acompanham a ponta de uma barra, por eixo: id → 'depois' (vem depois da ponta) ou 'antes'. */
    const seguidor = { x: new Map(), y: new Map() }
    const paresPorEixo = { x: pares('x'), y: pares('y') }
    for (const eixo of ['x', 'y']) {
      for (const [A, B, d] of paresPorEixo[eixo]) {
        if (d >= 32 || d < -TOL) continue
        const pa = ponta.get(A.id)?.[eixo]
        const pb = ponta.get(B.id)?.[eixo]
        if ((pa === 'fim' || pa === 'ambas') && B.type === 'text') seguidor[eixo].set(B.id, { lado: 'depois', de: A.id })
        if ((pb === 'inicio' || pb === 'ambas') && A.type === 'text') seguidor[eixo].set(A.id, { lado: 'antes', de: B.id })
      }
      // o que vem colado no rótulo (a porcentagem logo depois do valor) também acompanha a ponta
      for (let i = 0; i < 3; i++) {
        for (const [A, B, d] of paresPorEixo[eixo]) {
          if (d >= GRADE || d < -TOL) continue
          if (seguidor[eixo].get(A.id)?.lado === 'depois' && B.type === 'text' && !seguidor[eixo].has(B.id)) seguidor[eixo].set(B.id, { lado: 'depois', de: A.id })
          if (seguidor[eixo].get(B.id)?.lado === 'antes' && A.type === 'text' && !seguidor[eixo].has(A.id)) seguidor[eixo].set(A.id, { lado: 'antes', de: B.id })
        }
      }
    }
    for (const eixo of ['x', 'y']) {
      for (const [A, B, d] of paresPorEixo[eixo]) {
        if (fino(A, eixo) || fino(B, eixo)) continue
        const pa = ponta.get(A.id)?.[eixo]
        const pb = ponta.get(B.id)?.[eixo]
        // ponta da barra: só conta a distância até o rótulo que a acompanha
        if ((pa === 'fim' || pa === 'ambas') && seguidor[eixo].get(B.id)?.de !== A.id) continue
        if ((pb === 'inicio' || pb === 'ambas') && seguidor[eixo].get(A.id)?.de !== B.id) continue
        // a posição do rótulo que acompanha a ponta carrega o comprimento da barra: só conta a distância até ela
        if (seguidor[eixo].has(A.id) && seguidor[eixo].get(A.id).de !== B.id) continue
        if (seguidor[eixo].has(B.id) && seguidor[eixo].get(B.id).de !== A.id) continue
        conferidas++
        if (!de8(d)) problemas.push(`${pai || 'tela'}: ${nome(A)} → ${nome(B)} (${eixo === 'x' ? 'horizontal' : 'vertical'}) = ${arred(d)}`)
      }
    }
    // do filho até as bordas do pai
    if (!pai) continue
    for (const l of filhos) {
      const b = caixas.get(l.id)
      for (const [lado, d, eixo, fim] of [['esquerda', b.x - P.x, 'x', false], ['direita', P.x + P.w - b.x - b.w, 'x', true], ['topo', b.y - P.y, 'y', false], ['base', P.y + P.h - b.y - b.h, 'y', true]]) {
        if (fino(l, eixo)) continue
        const p = ponta.get(l.id)?.[eixo]
        if (p === 'ambas' || (p === 'fim' && fim) || (p === 'inicio' && !fim)) continue
        const s = seguidor[eixo].get(l.id)
        if (s && (s.lado === 'depois') === fim) continue
        conferidas++
        if (!de8(d)) problemas.push(`${pai}: ${nome(l)} até a borda (${lado}) = ${arred(d)}`)
      }
    }
  }
  return { problemas, conferidas }
}
