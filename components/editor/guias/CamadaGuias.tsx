'use client'
/**
 * Desenho das guias de layout no canvas do editor: um único <canvas> do tamanho da área visível, por cima da tela,
 * sem eventos. Colunas e linhas são faixas preenchidas na cor da guia; a grade, linhas de 1 px do dispositivo. A
 * grade some quando a célula fica menor que GRADE_MIN_TELA px na tela (como no Figma).
 *
 * Barato de propósito: nada por camada, um redesenho só quando as guias, o enquadramento ou o tamanho mudam (memo);
 * arrastar uma camada não redesenha. Só o editor monta isto — visualizador, miniaturas e exportação nunca veem.
 */
import { memo, useLayoutEffect, useRef } from 'react'
import { faixasDaGuia, gradeLegivel, resumoGuia, type AreaGuias } from '@/lib/scene/guias'

export interface Enquadramento { s: number; ox: number; oy: number }

export const CamadaGuias = memo(function CamadaGuias({ areas, vp, largura, altura }: { areas: readonly AreaGuias[]; vp: Enquadramento; largura: number; altura: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const c = ref.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    const dpr = window.devicePixelRatio || 1
    const W = Math.max(1, Math.round(largura * dpr))
    const H = Math.max(1, Math.round(altura * dpr))
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, W, H)
    // tudo em px do dispositivo: bordas das faixas e linhas da grade caem em pixels inteiros (nítidas em qualquer zoom)
    const px = (v: number) => Math.round(v * dpr)
    for (const a of areas) {
      const x0 = vp.ox + a.area.x * vp.s
      const y0 = vp.oy + a.area.y * vp.s
      const ax = px(x0), ay = px(y0), aw = px(x0 + a.area.width * vp.s) - ax, ah = px(y0 + a.area.height * vp.s) - ay
      // recorte: a área (tela ou frame) ∩ a parte visível
      const cx0 = Math.max(0, ax), cy0 = Math.max(0, ay), cx1 = Math.min(W, ax + aw), cy1 = Math.min(H, ay + ah)
      if (cx1 <= cx0 || cy1 <= cy0) continue
      g.save()
      g.beginPath()
      g.rect(cx0, cy0, cx1 - cx0, cy1 - cy0)
      g.clip()
      for (const guia of a.guias) {
        if (!guia.visible) continue
        if (guia.type === 'grid') {
          if (!gradeLegivel(guia.size, vp.s)) continue
          const passo = guia.size * vp.s * dpr
          g.strokeStyle = guia.color
          g.lineWidth = 1
          g.beginPath()
          // só as linhas visíveis (a área pode ser bem maior que a janela no zoom alto)
          for (let k = Math.max(1, Math.ceil((cx0 - ax) / passo)); ax + k * passo < cx1; k++) { const x = Math.round(ax + k * passo) + 0.5; g.moveTo(x, cy0); g.lineTo(x, cy1) }
          for (let k = Math.max(1, Math.ceil((cy0 - ay) / passo)); ay + k * passo < cy1; k++) { const y = Math.round(ay + k * passo) + 0.5; g.moveTo(cx0, y); g.lineTo(cx1, y) }
          g.stroke()
          continue
        }
        g.fillStyle = guia.color
        for (const f of faixasDaGuia(guia, a.area)) {
          const fx = px(vp.ox + f.x * vp.s), fy = px(vp.oy + f.y * vp.s)
          g.fillRect(fx, fy, Math.max(1, px(vp.ox + (f.x + f.width) * vp.s) - fx), Math.max(1, px(vp.oy + (f.y + f.height) * vp.s) - fy))
        }
      }
      g.restore()
    }
  }, [areas, vp.s, vp.ox, vp.oy, largura, altura])
  // resumo do que está desenhado (testes e leitores de acessibilidade ignoram o canvas em si)
  const desenhadas = areas.flatMap((a) => a.guias.filter((g) => g.visible && (g.type !== 'grid' || gradeLegivel(g.size, vp.s))).map(resumoGuia))
  const gradeMiuda = areas.some((a) => a.guias.some((g) => g.visible && g.type === 'grid' && !gradeLegivel(g.size, vp.s)))
  return <canvas ref={ref} aria-hidden data-testid="guias-layout" data-guias={desenhadas.join('|')} data-grade-miuda={gradeMiuda || undefined} className="pointer-events-none absolute left-0 top-0 z-[2]" style={{ width: largura, height: altura }} />
})
