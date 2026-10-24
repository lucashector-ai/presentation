'use client'
/**
 * Explorar: as telas ficam espalhadas num mapa; a "câmera" voa até a tela atual (pan + zoom animados).
 * Hotspots com "Ir para tela" conectam caminhos independentes; a visão geral (G) mostra o mapa inteiro.
 *
 * Animações, na mesma ordem dos slides: (1) a tela que sai toca as saídas, (2) a câmera voa,
 * (3) a entrada da tela nova começa quando a câmera está chegando. As outras telas do mapa ficam paradas
 * no estado final (sem animar), como contexto.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { tempoSaida } from '@/lib/scene/animacoes'
import type { Cena, DocumentoProjeto } from '@/lib/scene/schema'
import type { EstadoRuntime } from '@/lib/scene/motor'
import { SceneRenderer, type SceneRendererProps } from '@/components/renderer/SceneRenderer'
import { envolvente } from '@/lib/scene/transform'
import { parallaxDoVoo } from '@/components/renderer/reativos'

type Comum = Omit<SceneRendererProps, 'cena' | 'escala' | 'runtime' | 'chaveEntrada'>

const ESPACO = 360
/** Voo da câmera e momento (no voo) em que a entrada da tela nova começa. */
const VOO_MS = 900
const CHEGANDO_MS = 520
const CURVA_VOO = 'cubic-bezier(.65,0,.25,1)'

/** Posição no mapa: a salva na tela ou uma grade automática. */
export function posicoesNoMapa(cenas: Cena[]): { x: number; y: number }[] {
  const colunas = Math.max(1, Math.ceil(Math.sqrt(cenas.length)))
  return cenas.map((c, i) => c.map ?? { x: (i % colunas) * (c.size.width + ESPACO), y: Math.floor(i / colunas) * (c.size.height + ESPACO) })
}

export function ExplorarView({ documento, tamanho, runtime, visaoGeral, preencher = false, iniciado = true, aoEscolher, ...comum }: { documento: DocumentoProjeto; tamanho: { width: number; height: number }; runtime: EstadoRuntime; visaoGeral: boolean; preencher?: boolean; iniciado?: boolean; aoEscolher: (i: number) => void } & Comum) {
  const pos = useMemo(() => posicoesNoMapa(documento.scenes), [documento.scenes])
  // navegação: tela que saiu (toca a saída), vez (reinicia a entrada) e espera (entrada pausada até a câmera chegar)
  const [nav, setNav] = useState({ indice: runtime.indice, de: null as number | null, vez: 0, esperando: false })
  if (nav.indice !== runtime.indice) setNav({ indice: runtime.indice, de: nav.indice, vez: nav.vez + 1, esperando: true })
  const reduzir = !!comum.reduzirMovimento
  const sai = nav.de !== null ? documento.scenes[nav.de] : undefined
  const saidaMs = sai ? (reduzir ? Math.min(150, tempoSaida(sai)) : tempoSaida(sai)) : 0
  useEffect(() => {
    if (!nav.vez) return
    const t1 = window.setTimeout(() => setNav((n) => ({ ...n, esperando: false })), saidaMs + (reduzir ? 0 : CHEGANDO_MS))
    const t2 = window.setTimeout(() => setNav((n) => ({ ...n, de: null })), saidaMs + (reduzir ? 0 : VOO_MS))
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [nav.vez, saidaMs, reduzir])
  const atraso = nav.de !== null && !reduzir ? saidaMs : 0
  // parallax no voo: as camadas com profundidade da tela que chega entram deslocadas no sentido do voo
  const telas = useRef(new Map<number, HTMLDivElement>())
  useEffect(() => {
    if (!nav.vez || nav.de === null || reduzir || visaoGeral) return
    const de = pos[nav.de]
    const para = pos[nav.indice]
    const el = telas.current.get(nav.indice)
    if (de && para && el) parallaxDoVoo(el, para.x - de.x, para.y - de.y, VOO_MS, saidaMs, CURVA_VOO)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.vez])
  const retangulos = documento.scenes.map((c, i) => ({ x: pos[i]!.x, y: pos[i]!.y, width: c.size.width, height: c.size.height }))
  const atual = retangulos[runtime.indice] ?? retangulos[0]!
  const alvo = visaoGeral ? envolvente(retangulos) : atual
  const margem = visaoGeral ? 80 : 0
  // "Preencher tela" vale para a tela atual (a visão geral sempre mostra o mapa inteiro)
  const ajuste = preencher && !visaoGeral ? Math.max : Math.min
  const escala = tamanho.width ? ajuste((tamanho.width - margem * 2) / alvo.width, (tamanho.height - margem * 2) / alvo.height) : 0
  const tx = tamanho.width / 2 - (alvo.x + alvo.width / 2) * escala
  const ty = tamanho.height / 2 - (alvo.y + alvo.height / 2) * escala
  if (!tamanho.width) return null
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: visaoGeral ? '#171717' : undefined }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${escala})`, transition: reduzir ? 'none' : `transform ${VOO_MS}ms ${CURVA_VOO} ${atraso}ms` }}>
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
          const atual = i === runtime.indice
          const saindo = i === nav.de && saidaMs > 0
          return (
            <div
              key={c.id}
              ref={(el) => { if (el) telas.current.set(i, el); else telas.current.delete(i) }}
              className={atual && (nav.esperando || !iniciado) ? 'animacoes-em-espera' : undefined}
              style={{ position: 'absolute', left: pos[i]!.x, top: pos[i]!.y, opacity: visaoGeral || ativa ? 1 : 0.35, transition: `opacity 500ms ease ${atraso}ms`, cursor: ativa ? undefined : 'var(--cursor-pointer)', borderRadius: 12, boxShadow: visaoGeral ? '0 40px 120px -40px rgba(0,0,0,.6)' : undefined }}
              onClick={ativa ? undefined : (e) => { e.stopPropagation(); aoEscolher(i) }}
              role={ativa ? undefined : 'button'}
              aria-label={ativa ? undefined : `Ir para ${c.title || `tela ${i + 1}`}`}
            >
              <SceneRenderer cena={c} escala={1} runtime={atual ? runtime : undefined} chaveEntrada={atual ? `${c.id}-${nav.vez}` : c.id} animar={atual || saindo} saida={saindo} {...comum} aoInteragir={ativa ? comum.aoInteragir : undefined} />
              {visaoGeral && <div className="mono" style={{ position: 'absolute', left: 0, top: -64, fontSize: 40, color: '#A3A3A3' }}>{String(i + 1).padStart(2, '0')} — {c.title || 'Sem título'}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
