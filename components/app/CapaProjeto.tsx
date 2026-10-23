'use client'
import { useTamanho } from '@/components/renderer/useTamanho'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import type { Cena } from '@/lib/scene/schema'

/**
 * Capa do card: a primeira tela renderizada em "cover" (preenche a caixa e corta as sobras).
 * Telas verticais (Story) numa caixa horizontal aparecem inteiras, centralizadas sobre um fundo neutro,
 * em vez de virar uma faixa cortada do meio.
 */
export function CapaProjeto({ cena, assets, proporcao = 4 / 3, className }: { cena: Cena; assets: AssetsResolvidos; proporcao?: number; className?: string }) {
  const { ref, tamanho } = useTamanho<HTMLDivElement>()
  const altura = tamanho.width / proporcao
  const vertical = cena.size.height > cena.size.width && proporcao > 1
  const escala = !tamanho.width ? 0 : vertical ? (altura * 0.86) / cena.size.height : Math.max(tamanho.width / cena.size.width, altura / cena.size.height)
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className ?? ''}`} style={{ aspectRatio: String(proporcao), background: vertical ? 'rgb(var(--cor-canvas))' : cena.background }} aria-hidden>
      {escala > 0 && (
        <div style={{ position: 'absolute', left: (tamanho.width - cena.size.width * escala) / 2, top: (altura - cena.size.height * escala) / 2, background: cena.background, borderRadius: vertical ? 4 : 0, overflow: 'hidden', boxShadow: vertical ? '0 6px 18px -8px rgba(0,0,0,.25)' : undefined }}>
          <SceneRenderer cena={cena} assets={assets} escala={escala} modo="miniatura" />
        </div>
      )}
    </div>
  )
}
