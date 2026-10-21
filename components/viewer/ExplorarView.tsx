'use client'
/**
 * Explorar: as telas ficam espalhadas num mapa; a "câmera" voa até a tela atual (pan + zoom animados).
 * Hotspots com "Ir para tela" conectam caminhos independentes; a visão geral (G) mostra o mapa inteiro.
 */
import { useMemo } from 'react'
import type { Cena, DocumentoProjeto } from '@/lib/scene/schema'
import type { EstadoRuntime } from '@/lib/scene/motor'
import { SceneRenderer, type SceneRendererProps } from '@/components/renderer/SceneRenderer'
import { envolvente } from '@/lib/scene/transform'

type Comum = Omit<SceneRendererProps, 'cena' | 'escala' | 'runtime' | 'chaveEntrada'>

const ESPACO = 360

/** Posição no mapa: a salva na tela ou uma grade automática. */
export function posicoesNoMapa(cenas: Cena[]): { x: number; y: number }[] {
  const colunas = Math.max(1, Math.ceil(Math.sqrt(cenas.length)))
  return cenas.map((c, i) => c.map ?? { x: (i % colunas) * (c.size.width + ESPACO), y: Math.floor(i / colunas) * (c.size.height + ESPACO) })
}

export function ExplorarView({ documento, tamanho, runtime, visaoGeral, aoEscolher, ...comum }: { documento: DocumentoProjeto; tamanho: { width: number; height: number }; runtime: EstadoRuntime; visaoGeral: boolean; aoEscolher: (i: number) => void } & Comum) {
  const pos = useMemo(() => posicoesNoMapa(documento.scenes), [documento.scenes])
  const retangulos = documento.scenes.map((c, i) => ({ x: pos[i]!.x, y: pos[i]!.y, width: c.size.width, height: c.size.height }))
  const atual = retangulos[runtime.indice] ?? retangulos[0]!
  const alvo = visaoGeral ? envolvente(retangulos) : atual
  const margem = visaoGeral ? 80 : 0
  const escala = tamanho.width ? Math.min((tamanho.width - margem * 2) / alvo.width, (tamanho.height - margem * 2) / alvo.height) : 0
  const tx = tamanho.width / 2 - (alvo.x + alvo.width / 2) * escala
  const ty = tamanho.height / 2 - (alvo.y + alvo.height / 2) * escala
  if (!tamanho.width) return null
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: visaoGeral ? '#171717' : undefined }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${escala})`, transition: comum.reduzirMovimento ? 'none' : 'transform 900ms cubic-bezier(.65,0,.25,1)' }}>
        {/* linhas de conexão (hotspots que levam a outras telas) */}
        <svg style={{ position: 'absolute', overflow: 'visible', left: 0, top: 0, pointerEvents: 'none', opacity: visaoGeral ? 1 : 0, transition: 'opacity 400ms' }} aria-hidden>
          {documento.scenes.flatMap((c, i) =>
            c.layers.flatMap((l) =>
              l.interactions
                .filter((it) => it.do.action === 'goToScene')
                .map((it, k) => {
                  const j = documento.scenes.findIndex((s) => it.do.action === 'goToScene' && s.id === it.do.targetSceneId)
                  if (j < 0) return null
                  const a = retangulos[i]!
                  const b = retangulos[j]!
                  return <line key={`${c.id}-${l.id}-${k}`} x1={a.x + a.width / 2} y1={a.y + a.height / 2} x2={b.x + b.width / 2} y2={b.y + b.height / 2} stroke="#5965F2" strokeWidth={8 / Math.max(escala, 0.05)} strokeDasharray="24 18" />
                })
            )
          )}
        </svg>
        {documento.scenes.map((c, i) => {
          const ativa = i === runtime.indice && !visaoGeral
          return (
            <div
              key={c.id}
              style={{ position: 'absolute', left: pos[i]!.x, top: pos[i]!.y, opacity: visaoGeral || ativa ? 1 : 0.35, transition: 'opacity 500ms', pointerEvents: ativa ? 'auto' : 'auto', cursor: ativa ? undefined : 'pointer', borderRadius: 12, boxShadow: visaoGeral ? '0 40px 120px -40px rgba(0,0,0,.6)' : undefined }}
              onClick={ativa ? undefined : (e) => { e.stopPropagation(); aoEscolher(i) }}
              role={ativa ? undefined : 'button'}
              aria-label={ativa ? undefined : `Ir para ${c.title || `tela ${i + 1}`}`}
            >
              <SceneRenderer cena={c} escala={1} runtime={i === runtime.indice ? runtime : undefined} chaveEntrada={ativa ? c.id : undefined} {...comum} aoInteragir={ativa ? comum.aoInteragir : undefined} />
              {visaoGeral && <div className="mono" style={{ position: 'absolute', left: 0, top: -64, fontSize: 40, color: '#A3A3A3' }}>{String(i + 1).padStart(2, '0')} — {c.title || 'Sem título'}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
