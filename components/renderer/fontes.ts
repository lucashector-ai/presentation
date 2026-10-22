'use client'
/**
 * Carregamento sob demanda das fontes do Google — o MESMO caminho no editor, visualizador/apresentação, Story,
 * Explorar, miniaturas, página pública e exportação PNG/PDF (o SceneRenderer chama `useFontesDaCena`).
 *
 * Só as famílias e as variantes (peso × itálico) usadas pelas camadas de texto são pedidas, numa folha da mesma
 * origem (/fontes/css, proxy do Worker em lib/fontes/proxy.ts). Cada variante é pedida uma vez por página.
 * Fontes locais (Geist, Geist Mono, Georgia, system-ui) não passam por aqui; famílias fora do catálogo do Google
 * (coladas do Figma, do sistema) recebem uma folha vazia e seguem para a reserva da pilha CSS.
 */
import { useEffect, useMemo } from 'react'
import type { Cena, DocumentoProjeto } from '@/lib/scene/schema'
import { NOMES_LOCAIS } from '@/lib/fontes/catalogo'
import { chaveVariante, lerVariante, urlFolha, type Variante } from '@/lib/fontes/url'

/** Família → variantes usadas ("400", "i700"). */
export type UsoFontes = Map<string, Set<string>>

const GENERICAS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|inherit|initial)$/i
export const precisaCarregar = (familia: string) => !!familia && !NOMES_LOCAIS.has(familia) && !GENERICAS.test(familia)

function somar(uso: UsoFontes, familia: string, v: Variante) {
  if (!precisaCarregar(familia)) return
  let s = uso.get(familia)
  if (!s) uso.set(familia, (s = new Set()))
  s.add(chaveVariante(v))
}

/** Variantes usadas pelas camadas de texto das telas. */
export function usoDasCenas(cenas: readonly Pick<Cena, 'layers'>[]): UsoFontes {
  const uso: UsoFontes = new Map()
  for (const c of cenas) for (const l of c.layers) if (l.type === 'text') somar(uso, l.fontFamily, { peso: l.fontWeight ?? 400, italico: !!l.italic })
  return uso
}

/** Nomes → uso com regular e negrito (quem só tem o nome: pares de fontes, prévias de estilo). */
export function usoDosNomes(nomes: Iterable<string>, pesos: number[] = [400, 700]): UsoFontes {
  const uso: UsoFontes = new Map()
  for (const n of nomes) for (const p of pesos) somar(uso, n, { peso: p, italico: false })
  return uso
}

export function fontesDoDocumento(doc: Pick<DocumentoProjeto, 'scenes'>): string[] {
  const s = new Set<string>()
  for (const c of doc.scenes) for (const l of c.layers) if (l.type === 'text') s.add(l.fontFamily)
  return [...s]
}

const pedidas = new Map<string, Set<string>>()
const folhas = new Set<HTMLLinkElement>()

/** Injeta a folha /fontes/css com as variantes que ainda não foram pedidas (uma por família nova). */
export function carregarFontes(entrada: Iterable<string> | UsoFontes) {
  if (typeof document === 'undefined') return
  const uso = entrada instanceof Map ? entrada : usoDosNomes(entrada)
  for (const [familia, chaves] of uso) {
    let ja = pedidas.get(familia)
    if (!ja) pedidas.set(familia, (ja = new Set()))
    const faltam = [...chaves].filter((k) => !ja!.has(k))
    if (!faltam.length) continue
    faltam.forEach((k) => ja!.add(k))
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = urlFolha({ familias: [{ familia, variantes: faltam.map(lerVariante).filter((v): v is Variante => !!v) }] })
    link.dataset.mostraFonte = familia
    document.head.appendChild(link)
    folhas.add(link)
  }
}

const chaveUso = (uso: UsoFontes) => [...uso].map(([f, vs]) => `${f}:${[...vs].sort().join(',')}`).sort().join('|')
const lerChave = (chave: string): UsoFontes => new Map(chave ? chave.split('|').map((p) => { const i = p.lastIndexOf(':'); return [p.slice(0, i), new Set(p.slice(i + 1).split(','))] as const }) : [])

/** Carrega as fontes de uma tela (usado pelo SceneRenderer: vale para toda superfície que desenha telas). */
export function useFontesDaCena(cena: Pick<Cena, 'layers'>) {
  const chave = useMemo(() => chaveUso(usoDasCenas([cena])), [cena])
  useEffect(() => { if (chave) carregarFontes(lerChave(chave)) }, [chave])
}

export function useFontesDoDocumento(doc: Pick<DocumentoProjeto, 'scenes'>) {
  const chave = chaveUso(usoDasCenas(doc.scenes))
  useEffect(() => { if (chave) carregarFontes(lerChave(chave)) }, [chave])
}

const fonteCss = (familia: string, v: Variante) => `${v.italico ? 'italic ' : ''}${v.peso} 16px "${familia.replace(/"/g, '\\"')}"`

/**
 * Espera as folhas de fontes injetadas e as variantes usadas (não rejeita; quem chama põe um tempo-limite).
 * Recebe nomes (todas as variantes já pedidas dessas famílias) ou o uso exato. `texto` escolhe os subconjuntos
 * (unicode-range) a baixar: sem ele, só o latino básico.
 * Usado pelo visualizador antes de tirar a tela de carregamento e pela exportação antes da captura.
 */
export async function aguardarFontes(entrada: string[] | UsoFontes, texto?: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  // o <link> é injetado num efeito: espera um quadro para ele existir
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  const uso: UsoFontes = entrada instanceof Map ? entrada : new Map(entrada.filter(precisaCarregar).map((n) => [n, pedidas.get(n) ?? new Set(['400'])]))
  if (entrada instanceof Map) carregarFontes(entrada)
  const links = [...folhas].filter((l) => l.isConnected && uso.has(l.dataset.mostraFonte ?? ''))
  await Promise.all(links.map((l) => (l.sheet ? null : new Promise((r) => { l.addEventListener('load', r, { once: true }); l.addEventListener('error', r, { once: true }) }))))
  const amostra = texto && texto.trim() ? texto.slice(0, 2000) : undefined
  await Promise.all([...uso].flatMap(([familia, chaves]) => [...chaves].map(lerVariante).filter((v): v is Variante => !!v).map((v) => document.fonts.load(fonteCss(familia, v), amostra).catch(() => null))))
  await document.fonts.ready.catch(() => null)
}
