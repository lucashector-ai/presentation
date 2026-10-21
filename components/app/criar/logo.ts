'use client'
/**
 * Leitura do logo no navegador, sem IA e sem servidor: tamanho (proporção) e os pixels, que viram a paleta em
 * lib/ia/marca.ts. Funciona com PNG, JPG, WebP, GIF e SVG (o SVG é desenhado no canvas como imagem).
 */
import { coresDoLogo, type CoresDoLogo } from '@/lib/ia/marca'

export interface LogoAnalisado extends CoresDoLogo { largura: number; altura: number }

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem do logo.'))
    img.src = url
  })
}

/** Proporção de um SVG pelo viewBox ou width/height (SVG sem tamanho próprio carrega com 0×0 em alguns navegadores). */
function tamanhoDoSvg(texto: string): { w: number; h: number } | null {
  const raiz = texto.match(/<svg\b[^>]*>/i)?.[0] ?? ''
  const vb = raiz.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (vb) return { w: Number(vb[1]), h: Number(vb[2]) }
  const w = raiz.match(/\swidth\s*=\s*["']?([\d.]+)/i)
  const h = raiz.match(/\sheight\s*=\s*["']?([\d.]+)/i)
  return w && h ? { w: Number(w[1]), h: Number(h[1]) } : null
}

export async function analisarLogo(arquivo: File): Promise<LogoAnalisado> {
  const svg = arquivo.type === 'image/svg+xml' || /\.svg$/i.test(arquivo.name)
  const texto = svg ? await arquivo.text() : null
  const doSvg = texto ? tamanhoDoSvg(texto) : null
  const url = URL.createObjectURL(svg && texto ? new Blob([texto], { type: 'image/svg+xml' }) : arquivo)
  try {
    const img = await carregarImagem(url)
    const largura = img.naturalWidth || doSvg?.w || 400
    const altura = img.naturalHeight || doSvg?.h || 200
    // amostra pequena: a paleta não precisa de todos os pixels
    const escala = Math.min(1, 180 / Math.max(largura, altura))
    const cw = Math.max(1, Math.round(largura * escala))
    const ch = Math.max(1, Math.round(altura * escala))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const g = canvas.getContext('2d', { willReadFrequently: true })
    if (!g) return { largura, altura, cores: [], media: '#808080', neutro: true }
    g.drawImage(img, 0, 0, cw, ch)
    const dados = g.getImageData(0, 0, cw, ch).data
    return { largura: doSvg?.w && !img.naturalWidth ? doSvg.w : largura, altura: doSvg?.h && !img.naturalHeight ? doSvg.h : altura, ...coresDoLogo(dados) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
