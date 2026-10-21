'use client'
/**
 * Camada 3D com <model-viewer> (Google). Aceita GLB/GLTF exportados do Blender, Cinema 4D, Spline etc.
 * O componente web é carregado sob demanda (só quem tem 3D baixa three.js).
 *
 * Sangria: a sombra de contato (e partes do modelo) costuma passar da caixa da camada, e o <canvas> do
 * model-viewer cortava tudo na borda. O elemento é renderizado maior que a caixa (SANGRIA por lado) com a
 * MESMA câmera (mesma distância) e um campo de visão proporcionalmente maior: a área central fica idêntica
 * à de antes, e a sombra continua para fora da caixa. O clique/arraste só vale dentro da caixa original.
 */
import { useEffect, useRef, useState } from 'react'
import { Box } from 'lucide-react'
import type { CamadaModelo3d } from '@/lib/scene/schema'
import { SANGRIA, enquadramentoComSangria } from './enquadramento3d'

let carregando: Promise<unknown> | null = null
/** Baixa e avalia o model-viewer (three.js). O visualizador chama antes da tela com 3D entrar. */
export function carregarModelViewer() {
  if (!carregando) carregando = import('@google/model-viewer')
  return carregando
}

const bool = (v: boolean) => (v ? '' : undefined)

export function Modelo3d({ camada: c, src, poster, interativo, estatico }: { camada: CamadaModelo3d; src?: string; poster?: string; interativo: boolean; estatico: boolean }) {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const [alvoNaCaixa, setAlvoNaCaixa] = useState(false)
  const ref = useRef<HTMLElement>(null)
  // com fundo próprio a caixa é visível: a sombra fica dentro dela, como antes
  const enq = c.background ? null : enquadramentoComSangria(c.cameraOrbit, c.fieldOfView)
  const s = enq ? SANGRIA : 0

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
    const ok = () => setCarregado(true)
    el.addEventListener('error', falha)
    el.addEventListener('load', ok)
    if ((el as HTMLElement & { loaded?: boolean }).loaded) setCarregado(true)
    return () => {
      el.removeEventListener('error', falha)
      el.removeEventListener('load', ok)
    }
  }, [pronto, src])

  // área de clique/arraste = só a caixa original (a sangria não rouba cliques das camadas vizinhas)
  useEffect(() => {
    const el = ref.current
    const raiz = el?.shadowRoot
    const entrada = raiz?.querySelector<HTMLElement>('.userInput')
    if (!el || !s || !interativo || !raiz || !entrada) return setAlvoNaCaixa(false)
    const p = (s / (1 + 2 * s)) * 100
    const estilo = document.createElement('style')
    estilo.textContent = `.userInput{pointer-events:none;outline:none!important}.mostra-alvo{position:absolute;left:${p}%;top:${p}%;right:${p}%;bottom:${p}%;pointer-events:auto;border-radius:8px}.userInput:focus-visible .mostra-alvo{outline:2px solid #5965F2;outline-offset:-2px}`
    const alvo = document.createElement('div')
    alvo.className = 'mostra-alvo'
    raiz.appendChild(estilo)
    entrada.appendChild(alvo)
    setAlvoNaCaixa(true)
    return () => {
      estilo.remove()
      alvo.remove()
    }
  }, [pronto, s, interativo])

  const fallback = (comPoster: boolean) => (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4%', background: c.background ?? 'transparent', color: 'rgba(23,23,23,.45)', fontFamily: 'var(--font-geist-mono), monospace', fontSize: Math.max(14, Math.min(c.width, c.height) * 0.05) }}>
      {comPoster && poster ? <img src={poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : (
        <>
          <Box style={{ width: '18%', height: '18%' }} strokeWidth={1.2} />
          <span>{erro ? 'Não foi possível carregar o modelo 3D' : !src || estatico ? 'Modelo 3D' : 'Carregando 3D…'}</span>
        </>
      )}
    </div>
  )

  if (estatico || !src || erro || !pronto) return fallback(true)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: c.background }}>
      <model-viewer
        ref={ref}
        src={src}
        alt={c.ariaLabel || c.name || 'Modelo 3D'}
        auto-rotate={bool(c.autoRotate)}
        rotation-per-second={`${c.rotationSpeed}deg`}
        auto-rotate-delay="0"
        camera-controls={bool(c.cameraControls && interativo)}
        disable-zoom={bool(!interativo)}
        interaction-prompt="none"
        camera-orbit={enq?.cameraOrbit ?? c.cameraOrbit}
        max-camera-orbit={enq?.maxCameraOrbit}
        field-of-view={enq?.fieldOfView ?? `${c.fieldOfView}deg`}
        max-field-of-view={enq?.maxFieldOfView}
        min-field-of-view={enq?.minFieldOfView}
        exposure={String(c.exposure)}
        shadow-intensity={String(c.shadowIntensity)}
        shadow-softness={String(c.shadowSoftness)}
        environment-image={c.environment === 'none' ? undefined : c.environment}
        animation-name={c.animation}
        autoplay={bool(c.autoplay)}
        ar={bool(c.ar && interativo)}
        ar-modes="webxr scene-viewer quick-look"
        loading="eager"
        style={{
          position: 'absolute',
          left: `${-s * 100}%`,
          top: `${-s * 100}%`,
          width: `${(1 + 2 * s) * 100}%`,
          height: `${(1 + 2 * s) * 100}%`,
          background: 'transparent',
          pointerEvents: interativo && !alvoNaCaixa ? 'auto' : 'none',
          ['--poster-color' as string]: 'transparent',
        }}
      />
      {/* pôster na caixa original até o modelo carregar (o do model-viewer ocuparia a área com sangria) */}
      {!carregado && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{fallback(true)}</div>}
    </div>
  )
}
