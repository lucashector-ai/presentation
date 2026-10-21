'use client'
import type { Cena } from '@/lib/scene/schema'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { gradienteCss } from '@/components/renderer/estilos'

/**
 * Miniatura de cena: mesmo renderizador, escala reduzida. A caixa usa o próprio fundo da cena e a altura
 * exata (sem arredondar): assim não sobra uma faixa de outra cor na base nem nos cantos arredondados.
 */
export function MiniaturaCena({ cena, assets, largura = 160, className }: { cena: Cena; assets: AssetsResolvidos; largura?: number; className?: string }) {
  const escala = largura / cena.size.width
  const fundo = cena.backgroundGradient ? gradienteCss(cena.backgroundGradient) : cena.background
  return (
    <div className={`relative isolate overflow-hidden rounded-lg border ${className ?? ''}`} style={{ width: largura, aspectRatio: `${cena.size.width} / ${cena.size.height}`, background: fundo }} aria-hidden>
      <SceneRenderer cena={cena} assets={assets} escala={escala} modo="miniatura" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* contorno interno: telas claras não se perdem no painel branco */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]" />
    </div>
  )
}
