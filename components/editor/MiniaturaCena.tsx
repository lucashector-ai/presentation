'use client'
import { memo, useDeferredValue, type CSSProperties } from 'react'
import type { Cena } from '@/lib/scene/schema'
import { SceneRenderer, type AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { gradienteCss } from '@/components/renderer/estilos'

const CenaMiniatura = memo(SceneRenderer)
const ESTILO: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

/**
 * Miniatura de cena: mesmo renderizador, escala reduzida. A caixa usa o próprio fundo da cena e a altura
 * exata (sem arredondar): assim não sobra uma faixa de outra cor na base nem nos cantos arredondados.
 * As camadas entram num render adiado: abrir a lista de telas (ou arrastar na tela atual) não espera o desenho
 * de cada miniatura; a caixa com o fundo aparece na hora.
 */
export const MiniaturaCena = memo(function MiniaturaCena({ cena, assets, largura = 160, className }: { cena: Cena; assets: AssetsResolvidos; largura?: number; className?: string }) {
  const fundo = cena.backgroundGradient ? gradienteCss(cena.backgroundGradient) : cena.background
  const conteudo = useDeferredValue<Cena | null>(cena, null)
  return (
    <div className={`relative isolate overflow-hidden rounded-lg border ${className ?? ''}`} style={{ width: largura, aspectRatio: `${cena.size.width} / ${cena.size.height}`, background: fundo }} aria-hidden>
      {conteudo && <CenaMiniatura cena={conteudo} assets={assets} escala={largura / conteudo.size.width} modo="miniatura" style={ESTILO} />}
      {/* contorno interno: telas claras não se perdem no painel branco */}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]" />
    </div>
  )
})
