'use client'
import { useEffect } from 'react'
import { FONTES_GOOGLE } from '@/lib/design-tokens'
import type { DocumentoProjeto } from '@/lib/scene/schema'

const carregadas = new Set<string>()

/** Injeta o <link> do Google Fonts para as fontes usadas (uma vez por fonte). */
export function carregarFontes(nomes: Iterable<string>) {
  if (typeof document === 'undefined') return
  const faltando = [...new Set(nomes)].filter((n) => FONTES_GOOGLE[n] && !carregadas.has(n))
  if (!faltando.length) return
  faltando.forEach((n) => carregadas.add(n))
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${faltando.map((n) => `family=${FONTES_GOOGLE[n]}`).join('&')}&display=swap`
  document.head.appendChild(link)
}

export function fontesDoDocumento(doc: Pick<DocumentoProjeto, 'scenes'>): string[] {
  const s = new Set<string>()
  for (const c of doc.scenes) for (const l of c.layers) if (l.type === 'text') s.add(l.fontFamily)
  return [...s]
}

export function useFontesDoDocumento(doc: Pick<DocumentoProjeto, 'scenes'>) {
  const chave = fontesDoDocumento(doc).join('|')
  useEffect(() => {
    if (chave) carregarFontes(chave.split('|'))
  }, [chave])
}

/**
 * Espera as folhas do Google Fonts injetadas e as famílias usadas (não rejeita; quem chama põe um tempo-limite).
 * Usado pelo visualizador antes de tirar a tela de carregamento: as entradas não tocam com a fonte trocando.
 */
export async function aguardarFontes(nomes: string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  // o <link> é injetado num efeito: espera um quadro para ele existir
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')]
  await Promise.all(links.map((l) => (l.sheet ? null : new Promise((r) => { l.addEventListener('load', r, { once: true }); l.addEventListener('error', r, { once: true }) }))))
  await Promise.all(nomes.map((n) => document.fonts.load(`16px "${n}"`).catch(() => null)))
  await document.fonts.ready.catch(() => null)
}
