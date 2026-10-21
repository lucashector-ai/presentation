'use client'
import type { Cena } from '@/lib/scene/schema'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'

/** Miniatura de cena: mesmo renderizador, escala reduzida. */
export function MiniaturaCena({ cena, assets, largura = 160, className }: { cena: Cena; assets: AssetsResolvidos; largura?: number; className?: string }) {
  const escala = largura / cena.size.width
  return (
    <div className={`overflow-hidden rounded-lg border bg-black ${className ?? ''}`} style={{ width: largura, height: Math.round(cena.size.height * escala) }} aria-hidden>
      <SceneRenderer cena={cena} assets={assets} escala={escala} modo="miniatura" />
    </div>
  )
}
