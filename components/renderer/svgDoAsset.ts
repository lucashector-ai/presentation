'use client'
/**
 * Texto de um SVG guardado como arquivo (vetores grandes ou .svg enviados viram asset, sem markup inline).
 * Serve para listar e trocar as cores dele (painel "Cores do vetor") e para desenhar a versão recolorida.
 * Cache por URL: cada arquivo é baixado uma vez por sessão.
 */
import { useEffect, useState } from 'react'

const cache = new Map<string, string>()
const pendentes = new Map<string, Promise<string>>()

export function carregarTextoSvg(url: string): Promise<string> {
  const pronto = cache.get(url)
  if (pronto !== undefined) return Promise.resolve(pronto)
  let p = pendentes.get(url)
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '')
      .then((t) => { const svg = /<svg[\s>]/i.test(t) ? t : ''; cache.set(url, svg); pendentes.delete(url); return svg })
    pendentes.set(url, p)
  }
  return p
}

/** Markup do SVG do asset (undefined enquanto baixa ou se não houver URL). */
export function useTextoSvg(url: string | undefined, ativo = true): string | undefined {
  const [texto, setTexto] = useState(() => (url ? cache.get(url) : undefined))
  useEffect(() => {
    if (!url || !ativo) return
    let vivo = true
    void carregarTextoSvg(url).then((t) => vivo && setTexto(t || undefined))
    return () => { vivo = false }
  }, [url, ativo])
  return url && ativo ? texto : undefined
}
