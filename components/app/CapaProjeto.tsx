'use client'
import { useTamanho } from '@/components/renderer/useTamanho'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import type { Cena } from '@/lib/scene/schema'

/** Capa do card: a primeira tela renderizada em "cover" (preenche a caixa e corta as sobras). */
export function CapaProjeto({ cena, assets, proporcao = 4 / 3, className }: { cena: Cena; assets: AssetsResolvidos; proporcao?: number; className?: string }) {
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const altura = tamanho.width / proporcao
  const escala = tamanho.width ? Math.max(tamanho.width / cena.size.width, altura / cena.size.height) : 0
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className ?? ''}`} style={{ aspectRatio: String(proporcao), background: cena.background }} aria-hidden>
      {escala > 0 && (
        <div style={{ position: 'absolute', left: (tamanho.width - cena.size.width * escala) / 2, top: (altura - cena.size.height * escala) / 2 }}>
          <SceneRenderer cena={cena} assets={assets} escala={escala} modo="miniatura" />
        </div>
      )}
    </div>
  )
}
