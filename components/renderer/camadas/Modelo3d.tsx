'use client'
/**
 * Camada 3D com <model-viewer> (Google). Aceita GLB/GLTF exportados do Blender, Cinema 4D, Spline etc.
 * O componente web é carregado sob demanda (só quem tem 3D baixa three.js).
 */
import { useEffect, useRef, useState } from 'react'
import { Box } from 'lucide-react'
import type { CamadaModelo3d } from '@/lib/scene/schema'

let carregando: Promise<unknown> | null = null
function carregarModelViewer() {
  if (!carregando) carregando = import('@google/model-viewer')
  return carregando
}

const bool = (v: boolean) => (v ? '' : undefined)

export function Modelo3d({ camada: c, src, poster, interativo, estatico }: { camada: CamadaModelo3d; src?: string; poster?: string; interativo: boolean; estatico: boolean }) {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (estatico) return
    let ativo = true
    carregarModelViewer().then(() => ativo && setPronto(true)).catch(() => ativo && setErro(true))
    return () => {
      ativo = false
    }
  }, [estatico])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const falha = () => setErro(true)
    el.addEventListener('error', falha)
    return () => el.removeEventListener('error', falha)
  }, [pronto])

  if (estatico || !src || erro || !pronto) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4%', background: c.background ?? 'transparent', color: 'rgba(23,23,23,.45)', fontFamily: 'var(--font-geist-mono), monospace', fontSize: Math.max(14, Math.min(c.width, c.height) * 0.05) }}>
        {poster ? <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : (
          <>
            <Box style={{ width: '18%', height: '18%' }} strokeWidth={1.2} />
            <span>{erro ? 'Não foi possível carregar o modelo 3D' : !src || estatico ? 'Modelo 3D' : 'Carregando 3D…'}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <model-viewer
      ref={ref}
      src={src}
      poster={poster}
      alt={c.ariaLabel || c.name || 'Modelo 3D'}
      auto-rotate={bool(c.autoRotate)}
      rotation-per-second={`${c.rotationSpeed}deg`}
      auto-rotate-delay="0"
      camera-controls={bool(c.cameraControls && interativo)}
      disable-zoom={bool(!interativo)}
      interaction-prompt="none"
      camera-orbit={c.cameraOrbit}
      field-of-view={`${c.fieldOfView}deg`}
      exposure={String(c.exposure)}
      shadow-intensity={String(c.shadowIntensity)}
      shadow-softness={String(c.shadowSoftness)}
      environment-image={c.environment === 'none' ? undefined : c.environment}
      animation-name={c.animation}
      autoplay={bool(c.autoplay)}
      ar={bool(c.ar && interativo)}
      ar-modes="webxr scene-viewer quick-look"
      loading="eager"
      style={{ width: '100%', height: '100%', background: c.background ?? 'transparent', pointerEvents: interativo ? 'auto' : 'none', ['--poster-color' as string]: 'transparent' }}
    />
  )
}
