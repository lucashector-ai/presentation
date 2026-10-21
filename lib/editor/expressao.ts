/** Avalia expressões aritméticas simples (+ - * / e parênteses) sem eval. */
export function avaliar(t: string): number | null {
  const fonte = t.replace(/,/g, '.').replace(/\s+/g, '')
  if (!fonte || !/^[-+*/().\d]+$/.test(fonte)) return null
  let i = 0
  const numero = (): number => {
    if (fonte[i] === '(') { i++; const v = soma(); if (fonte[i] !== ')') throw new Error('('); i++; return v }
    if (fonte[i] === '-') { i++; return -numero() }
    if (fonte[i] === '+') { i++; return numero() }
    const m = /^\d*\.?\d+/.exec(fonte.slice(i))
    if (!m) throw new Error('n')
    i += m[0].length
    return Number(m[0])
  }
  const produto = (): number => {
    let v = numero()
    while (fonte[i] === '*' || fonte[i] === '/') { const op = fonte[i++]; const d = numero(); v = op === '*' ? v * d : v / d }
    return v
  }
  const soma = (): number => {
    let v = produto()
    while (fonte[i] === '+' || fonte[i] === '-') { const op = fonte[i++]; const d = produto(); v = op === '+' ? v + d : v - d }
    return v
  }
  try {
    const v = soma()
    return i === fonte.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}
