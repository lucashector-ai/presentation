'use client'
/**
 * Prévias do seletor de fonte: cada família escrita com ela mesma, carregando só os glifos do nome (`text=` do
 * Google, via /fontes/css). As linhas visíveis da lista são pedidas em lote (uma folha por lote, arquivos de
 * poucos KB). A família da prévia ganha um apelido ("mp-<nome>"): a fonte recortada não pode se misturar com a
 * fonte inteira usada no documento (com o mesmo nome, letras fora do recorte cairiam na fonte de reserva).
 */
import { urlFolha } from './url'

export const apelidoPrevia = (familia: string) => `mp-${familia}`

const pedidas = new Set<string>()
let fila = new Map<string, number>()
let espera: ReturnType<typeof setTimeout> | null = null
let estilo: HTMLStyleElement | null = null
const LOTE = 24

/** Pede a prévia da família (peso padrão dela); repetir não custa nada. */
export function pedirPrevia(familia: string, peso = 400) {
  if (typeof document === 'undefined' || pedidas.has(familia)) return
  pedidas.add(familia)
  fila.set(familia, peso)
  espera ??= setTimeout(esvaziar, 60)
}

function esvaziar() {
  espera = null
  const todas = [...fila]
  fila = new Map()
  for (let i = 0; i < todas.length; i += LOTE) {
    const lote = todas.slice(i, i + LOTE)
    const texto = lote.map(([f]) => f).join('')
    const url = urlFolha({ familias: lote.map(([familia, peso]) => ({ familia, variantes: [{ peso, italico: false }] })), texto })
    void fetch(url)
      .then((r) => (r.ok ? r.text() : ''))
      .then((css) => {
        if (!css.includes('@font-face')) return
        estilo ??= Object.assign(document.createElement('style'), { id: 'mostra-previas-fontes' })
        if (!estilo.isConnected) document.head.appendChild(estilo)
        estilo.append(css.replace(/font-family:\s*'([^']+)'/g, (_, n: string) => `font-family: '${apelidoPrevia(n)}'`))
      })
      .catch(() => lote.forEach(([f]) => pedidas.delete(f)))
  }
}

// ---------- recentes (só neste navegador; conveniência)

const CHAVE_RECENTES = 'mostra.fontes.recentes'
export function lerRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}
export function lembrarRecente(familia: string) {
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify([familia, ...lerRecentes().filter((f) => f !== familia)].slice(0, 8)))
  } catch { /* armazenamento bloqueado: sem recentes */ }
}
