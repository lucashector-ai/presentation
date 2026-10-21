'use client'
/**
 * Preenche a área em volta da cena (faixas de letterbox) com o fundo da própria cena: cor, gradiente
 * recalculado para a área maior, ou a imagem com o mesmo encaixe (as partes que o "cover" cortava aparecem)
 * e, além dela, a cor média da borda vizinha. Fica atrás da cena e acompanha as transições.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Cena } from '@/lib/scene/schema'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { fundoDaCena, gradienteEstendido, retanguloCover, type Tamanho } from './fundo'

interface InfoImagem extends Tamanho {
  /** Cor média de cada borda da imagem (para as faixas que a imagem não alcança). */
  bordas: { topo: string; base: string; esquerda: string; direita: string } | null
}

/** Tamanho natural e cor média das bordas (canvas pequeno; imagem de outra origem sem CORS → só tamanho). */
function useInfoImagem(url: string | undefined): InfoImagem | null {
  const [info, setInfo] = useState<{ url: string; info: InfoImagem } | null>(null)
  useEffect(() => {
    if (!url) return
    let ativo = true
    const img = new Image()
    if (!url.startsWith('data:') && !url.startsWith('blob:')) img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!ativo || !img.naturalWidth || !img.naturalHeight) return
      let bordas: InfoImagem['bordas'] = null
      try {
        const n = 24
        const cv = document.createElement('canvas')
        cv.width = n
        cv.height = n
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        if (ctx) {
          ctx.drawImage(img, 0, 0, n, n)
          const d = ctx.getImageData(0, 0, n, n).data
          const media = (pontos: [number, number][]) => {
            let r = 0, g = 0, b = 0, a = 0
            for (const [x, y] of pontos) { const i = (y * n + x) * 4; const al = d[i + 3]! / 255; r += d[i]! * al; g += d[i + 1]! * al; b += d[i + 2]! * al; a += al }
            return a < 0.5 ? null : `rgb(${Math.round(r / a)}, ${Math.round(g / a)}, ${Math.round(b / a)})`
          }
          const faixa = (f: (k: number, j: number) => [number, number]) => Array.from({ length: n * 2 }, (_, i) => f(i % n, Math.floor(i / n)))
          const topo = media(faixa((k, j) => [k, j]))
          const base = media(faixa((k, j) => [k, n - 1 - j]))
          const esquerda = media(faixa((k, j) => [j, k]))
          const direita = media(faixa((k, j) => [n - 1 - j, k]))
          if (topo && base && esquerda && direita) bordas = { topo, base, esquerda, direita }
        }
      } catch {
        /* imagem de outra origem sem CORS: sem amostra de cor */
      }
      setInfo({ url, info: { width: img.naturalWidth, height: img.naturalHeight, bordas } })
    }
    img.onerror = () => {
      // sem CORS a imagem nem carrega com crossOrigin: tenta de novo só pelo tamanho
      if (!ativo || !img.crossOrigin) return
      const sem = new Image()
      sem.onload = () => { if (ativo && sem.naturalWidth) setInfo({ url, info: { width: sem.naturalWidth, height: sem.naturalHeight, bordas: null } }) }
      sem.src = url
    }
    img.src = url
    return () => { ativo = false }
  }, [url])
  return info && info.url === url ? info.info : null
}

export interface FundoEstendidoProps {
  cena: Cena
  assets: AssetsResolvidos
  /** Escala da cena (px da cena → px da tela). */
  escala: number
  /** Canto superior esquerdo da cena dentro da área. */
  x: number
  y: number
  /** Tamanho da área a preencher. */
  largura: number
  altura: number
  /** Cor de partida (transição morph): anima até a cor da cena. */
  corInicial?: string
  duracao?: number
  style?: CSSProperties
}

export function FundoEstendido({ cena, assets, escala, x, y, largura, altura, corInicial, duracao = 400, style }: FundoEstendidoProps) {
  const fundo = useMemo(() => fundoDaCena(cena), [cena])
  const [cor, setCor] = useState(corInicial ?? fundo.cor)
  useEffect(() => {
    const r = requestAnimationFrame(() => setCor(fundo.cor))
    return () => cancelAnimationFrame(r)
  }, [fundo.cor])

  const asset = fundo.tipo === 'imagem' ? assets[fundo.assetId] : undefined
  // "contain" já mostra a cor em volta da imagem dentro da cena: fora dela, só a cor (sem emenda)
  const comImagem = fundo.tipo === 'imagem' && !!asset && fundo.fit !== 'contain'
  const info = useInfoImagem(comImagem ? asset?.url : undefined)
  const caixa = { width: cena.size.width * escala, height: cena.size.height * escala }

  let conteudo: React.ReactNode = null
  let corFaixas: string | undefined
  if (fundo.tipo === 'gradiente') {
    conteudo = <div style={{ position: 'absolute', inset: 0, backgroundImage: gradienteEstendido(fundo.gradiente, caixa, { width: largura, height: altura }) }} />
  } else if (fundo.tipo === 'imagem' && comImagem && asset && info) {
    // a imagem inteira, no mesmo lugar e escala da cena (o "cover" cortava o resto)...
    const ret = { x: x + fundo.ret.x * escala, y: y + fundo.ret.y * escala, width: fundo.ret.width * escala, height: fundo.ret.height * escala }
    const img = fundo.fit === 'cover' ? retanguloCover(ret, info) : ret
    // ...e, onde ela não chega, a cor média da borda vizinha
    if (info.bordas) {
      const b = info.bordas
      corFaixas = y > x
        ? `linear-gradient(to bottom, ${b.topo} 0 50%, ${b.base} 50% 100%)`
        : `linear-gradient(to right, ${b.esquerda} 0 50%, ${b.direita} 50% 100%)`
    }
    conteudo = <img src={asset.url} alt="" draggable={false} style={{ position: 'absolute', left: img.x, top: img.y, width: img.width, height: img.height, maxWidth: 'none' }} />
  }

  return (
    <div aria-hidden style={{ position: 'absolute', width: largura, height: altura, overflow: 'hidden', pointerEvents: 'none', backgroundColor: cor, backgroundImage: corFaixas, transition: corInicial ? `background-color ${duracao}ms ease` : undefined, ...style }}>
      {conteudo}
    </div>
  )
}
