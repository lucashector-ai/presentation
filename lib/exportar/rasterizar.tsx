'use client'
/**
 * Rasteriza telas pelo MESMO renderizador DOM do editor/visualizador (SceneRenderer em modo "miniatura",
 * mas com as mídias originais): monta a cena fora da tela, espera fontes, imagens e Lottie, e captura com
 * modern-screenshot (SVG foreignObject → canvas, com fontes e imagens embutidas). 3D e incorporados saem
 * com o pôster/placeholder estático. PDF: uma página por tela com jsPDF (carregado sob demanda).
 */
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Cena, DocumentoProjeto } from '@/lib/scene/schema'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { carregarFontes, fontesDoDocumento } from '@/components/renderer/fontes'
import { escalaSegura, paginaPdf, type FormatoImagem } from './medidas'

export interface OpcoesRaster {
  escala: number
  formato: FormatoImagem
  /** Qualidade do JPG (0–1). */
  qualidade?: number
}

/** Sem miniaturas: a exportação usa sempre o arquivo original. */
function originais(assets: AssetsResolvidos): AssetsResolvidos {
  return Object.fromEntries(Object.entries(assets).map(([id, a]) => [id, { url: a.url, posterUrl: a.posterUrl }]))
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)))

async function esperarMidias(el: HTMLElement, cena: Cena) {
  // imagens com loading="lazy" fora da tela nunca carregariam
  const imgs = Array.from(el.querySelectorAll('img'))
  imgs.forEach((i) => { i.loading = 'eager' })
  await Promise.race([
    Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? Promise.resolve() : i.decode().catch(() => undefined)))),
    esperar(8000),
  ])
  const lotties = cena.layers.filter((l) => l.type === 'lottie' && !l.hidden).map((l) => l.id)
  for (let t = 0; lotties.length && t < 40; t++) {
    if (lotties.every((id) => el.querySelector(`[data-layer-id="${CSS.escape(id)}"] svg`))) break
    await esperar(100)
  }
  if (typeof document !== 'undefined' && document.fonts) await Promise.race([document.fonts.ready, esperar(4000)])
  await quadro()
  await quadro()
}

/** Renderiza a cena fora da tela e devolve o canvas no tamanho da cena × escala. */
export async function rasterizarCena(cena: Cena, assets: AssetsResolvidos, { escala, formato }: OpcoesRaster): Promise<HTMLCanvasElement> {
  const { domToCanvas } = await import('modern-screenshot')
  carregarFontes(fontesDoDocumento({ scenes: [cena] }))
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', width: `${cena.size.width}px`, height: `${cena.size.height}px`, pointerEvents: 'none', zIndex: '-1' })
  document.body.appendChild(host)
  const raiz = createRoot(host)
  try {
    flushSync(() => raiz.render(<SceneRenderer cena={cena} assets={originais(assets)} escala={1} modo="miniatura" />))
    const alvo = host.firstElementChild as HTMLElement | null
    if (!alvo) throw new Error('Nada para exportar.')
    await esperarMidias(alvo, cena)
    const s = escalaSegura(cena.size, escala)
    const canvas = await domToCanvas(alvo, { width: cena.size.width, height: cena.size.height, scale: s, timeout: 15000, font: {} })
    if (formato !== 'jpg') return canvas
    // JPG não tem transparência: compõe sobre branco (o fundo da tela continua o da própria tela)
    const final = document.createElement('canvas')
    final.width = canvas.width
    final.height = canvas.height
    const ctx = final.getContext('2d')
    if (!ctx) return canvas
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, final.width, final.height)
    ctx.drawImage(canvas, 0, 0)
    return final
  } finally {
    raiz.unmount()
    host.remove()
  }
}

export async function cenaParaBlob(cena: Cena, assets: AssetsResolvidos, opcoes: OpcoesRaster): Promise<Blob> {
  const canvas = await rasterizarCena(cena, assets, opcoes)
  const tipo = opcoes.formato === 'jpg' ? 'image/jpeg' : 'image/png'
  return await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), tipo, opcoes.qualidade ?? 0.92))
}

/** PDF com uma página por tela (no tamanho da tela). `progresso(i, total)` a cada tela pronta. */
export async function documentoParaPdf(doc: Pick<DocumentoProjeto, 'scenes'>, assets: AssetsResolvidos, progresso?: (feitas: number, total: number) => void): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const telas = doc.scenes
  const primeira = telas[0]
  if (!primeira) throw new Error('Nenhuma tela para exportar.')
  const p0 = paginaPdf(primeira.size)
  const pdf = new jsPDF({ unit: 'pt', format: [p0.largura, p0.altura], orientation: p0.orientacao, compress: true })
  for (let i = 0; i < telas.length; i++) {
    const cena = telas[i]!
    const p = paginaPdf(cena.size)
    if (i > 0) pdf.addPage([p.largura, p.altura], p.orientacao)
    // 1,5× de densidade: nítido em tela cheia sem deixar o arquivo enorme
    const canvas = await rasterizarCena(cena, assets, { escala: 1.5, formato: 'jpg' })
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, p.largura, p.altura, undefined, 'FAST')
    progresso?.(i + 1, telas.length)
  }
  return pdf.output('blob')
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
