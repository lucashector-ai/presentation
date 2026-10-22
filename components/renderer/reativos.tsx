'use client'
/**
 * Efeitos interativos da camada no renderizador: parallax (mouse, rolagem do Story, transição entre telas e voo
 * do Explorar), tilt 3D e luz que seguem o mouse. A lógica (quanto anda, quanto inclina) é lib/scene/reativos.ts.
 *
 * Leve por construção:
 * - só transform/opacity, em invólucros próprios dentro da camada (o estilo dela e o resto da tela não mudam);
 * - nenhum estado React por quadro: o mouse é lido por UM ouvinte passivo da janela e UM requestAnimationFrame
 *   para todas as camadas, que escreve o transform direto no invólucro e para quando tudo assenta;
 * - nenhuma leitura de layout por quadro (a caixa da camada é lida uma vez, quando o mouse entra);
 * - parallax da rolagem do Story é uma scroll-driven animation (CSS `animation-timeline: view()`), fora da thread
 *   principal; sem suporte, um ouvinte de rolagem passivo com rAF faz o mesmo;
 * - a transição entre telas e o voo do Explorar são animações de uma vez só (CSS / Web Animations API).
 * Movimento reduzido: nada se mexe. Toque (sem hover): sem tilt, luz nem parallax de mouse.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { EfeitosInterativos } from '@/lib/scene/schema'
import { PARALLAX_PX, deslocamentoMouse, deslocamentoRolagem, luzDe, passoSuave, ponteiroSimulado, transformTilt, type Parallax } from '@/lib/scene/reativos'
import { movimentoReduzido } from './animacao'

/** Duração do ponteiro simulado (prévia no editor). */
export const DURACAO_SIMULACAO_MS = 2400

// ---------- ponteiro da janela: um ouvinte e um quadro para todas as camadas ----------

type Assinante = (nx: number, ny: number, dt: number) => boolean
const ponteiro = { nx: 0, ny: 0 }
const assinantes = new Set<Assinante>()
let quadro = 0
let ultimo = 0

function tique(t: number) {
  quadro = 0
  const dt = ultimo ? Math.min(100, t - ultimo) : 1000 / 60
  ultimo = t
  let mexendo = false
  assinantes.forEach((f) => { if (f(ponteiro.nx, ponteiro.ny, dt)) mexendo = true })
  if (mexendo) quadro = requestAnimationFrame(tique)
  else ultimo = 0
}
function agendar() {
  if (!quadro && assinantes.size) quadro = requestAnimationFrame(tique)
}
function aoMover(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  // tamanho da janela, não a caixa da tela: não força layout
  ponteiro.nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1
  ponteiro.ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1
  agendar()
}
function aoSairDaJanela() {
  ponteiro.nx = 0
  ponteiro.ny = 0
  agendar()
}
/** Recebe o ponteiro normalizado (−1…1) a cada quadro em que algo se mexe; devolver true pede mais um quadro. */
function assinarPonteiro(f: Assinante): () => void {
  if (!assinantes.size) {
    window.addEventListener('pointermove', aoMover, { passive: true })
    document.documentElement.addEventListener('pointerleave', aoSairDaJanela, { passive: true })
  }
  assinantes.add(f)
  agendar()
  return () => {
    assinantes.delete(f)
    if (assinantes.size) return
    window.removeEventListener('pointermove', aoMover)
    document.documentElement.removeEventListener('pointerleave', aoSairDaJanela)
    cancelAnimationFrame(quadro)
    quadro = 0
    ultimo = 0
  }
}

/** scroll-driven animations (`animation-timeline: view()`) disponíveis? */
export const rolagemPorCss = () => typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline: view()')

const t3 = (x: number, y: number) => `translate3d(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px, 0px)`

// ---------- invólucro da camada ----------

export interface PropsReativa {
  efeitos: EfeitosInterativos
  modo: 'editor' | 'viewer' | 'miniatura'
  reduzir: boolean
  semHover: boolean
  /** Story: o parallax acompanha a rolagem. */
  rolagem?: boolean
  largura: number
  altura: number
  /** Raio dos cantos da camada (a luz fica dentro deles). */
  raio?: CSSProperties['borderRadius']
  /** Prévia no editor: muda a cada pedido e toca o ponteiro simulado. */
  simular?: number
  children: ReactNode
}

export function CamadaReativa({ efeitos, modo, reduzir, semHover, rolagem = false, largura, altura, raio, simular, children }: PropsReativa) {
  const plx = efeitos.parallax?.depth ? efeitos.parallax : undefined
  const tilt = efeitos.tilt
  const luz = efeitos.spotlight ? luzDe(efeitos.spotlight) : undefined
  const raiz = useRef<HTMLDivElement>(null)
  const refMouse = useRef<HTMLDivElement>(null)
  const refTilt = useRef<HTMLDivElement>(null)
  const refLuz = useRef<HTMLDivElement>(null)
  const refPonto = useRef<HTMLDivElement>(null)
  const vivo = modo === 'viewer' && !reduzir
  const comMouse = vivo && !semHover
  const rolagemCss = vivo && rolagem && !!plx && rolagemPorCss()

  // diâmetro do círculo de luz: luz = 2 × raio; lanterna = cobre a camada de qualquer ponto
  const maior = Math.max(largura, altura)
  const raioLuz = luz ? (luz.size / 100) * maior : 0
  const diametro = luz ? (luz.mode === 'dark' ? 2 * (Math.hypot(largura, altura) + raioLuz) : 2 * raioLuz) : 0
  const fundoLuz = luz
    ? luz.mode === 'dark'
      ? `radial-gradient(circle closest-side, transparent ${Math.round((raioLuz / (diametro / 2)) * 55)}%, rgba(0, 0, 0, ${Math.round(luz.intensity * 78) / 100}) ${Math.round((raioLuz / (diametro / 2)) * 100)}%)`
      : `radial-gradient(circle closest-side, ${hexComAlfa(luz.color, luz.intensity * 0.75)}, ${hexComAlfa(luz.color, 0)})`
    : undefined

  // parallax pelo mouse (e ponteiro simulado na prévia)
  const chavePlx = plx ? `${plx.depth}|${plx.axis ?? 'both'}` : ''
  useEffect(() => {
    const el = refMouse.current
    if (!plx || !el || reduzir || movimentoReduzido()) return
    const p: Parallax = { depth: plx.depth, axis: plx.axis }
    let x = 0
    let y = 0
    const escrever = (nx: number, ny: number, dt: number, k = passoSuave(0.6, dt)) => {
      const [ax, ay] = deslocamentoMouse(p, nx, ny)
      x += (ax - x) * k
      y += (ay - y) * k
      const parado = Math.abs(ax - x) < 0.05 && Math.abs(ay - y) < 0.05
      if (parado) { x = ax; y = ay }
      el.style.transform = t3(x, y)
      return !parado
    }
    if (simular && modo === 'editor') return simularPonteiro((px, py, dt) => escrever((px - 0.5) * 2, (py - 0.5) * 2, dt, 1), () => { el.style.transform = '' })
    if (!comMouse) return
    return assinarPonteiro((nx, ny, dt) => escrever(nx, ny, dt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePlx, comMouse, reduzir, simular, modo])

  // parallax pela rolagem sem scroll-driven animations: ouvinte passivo + rAF (lê a caixa uma vez por quadro)
  useEffect(() => {
    const el = raiz.current
    if (!plx || !el || !vivo || !rolagem || rolagemCss || movimentoReduzido()) return
    const rolador = el.closest<HTMLElement>('.overflow-y-auto') ?? window
    let raf = 0
    const quadroRolagem = () => {
      raf = 0
      const caixa = (el.parentElement ?? el).getBoundingClientRect()
      const alt = window.innerHeight
      el.style.transform = `translateY(${deslocamentoRolagem({ depth: plx.depth }, (alt - caixa.top) / Math.max(1, alt + caixa.height))}px)`
    }
    const aoRolar = () => { if (!raf) raf = requestAnimationFrame(quadroRolagem) }
    aoRolar()
    rolador.addEventListener('scroll', aoRolar, { passive: true })
    return () => { rolador.removeEventListener('scroll', aoRolar); cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePlx, vivo, rolagem, rolagemCss])

  // tilt 3D e luz: seguem o ponteiro dentro da camada (com inércia) e voltam ao repouso quando ele sai
  const chaveTilt = JSON.stringify([tilt, luz, largura, altura])
  useEffect(() => {
    const alvoTilt = refTilt.current
    const area = raiz.current?.parentElement
    if ((!tilt && !luz) || !alvoTilt || !area || reduzir || movimentoReduzido()) return
    const capa = refLuz.current
    const ponto = refPonto.current
    const suavidade = tilt?.smooth ?? 0.5
    const atual = { x: 0.5, y: 0.5, h: 0 }
    const alvo = { x: 0.5, y: 0.5, h: 0 }
    let caixa: DOMRect | null = null
    let raf = 0
    let ultimoT = 0
    const desenhar = () => {
      if (tilt) alvoTilt.style.transform = transformTilt(tilt, atual.x, atual.y, atual.h)
      if (ponto) ponto.style.transform = t3(atual.x * largura - diametro / 2, atual.y * altura - diametro / 2)
    }
    const passo = (t: number) => {
      const dt = ultimoT ? Math.min(100, t - ultimoT) : 1000 / 60
      ultimoT = t
      const k = passoSuave(suavidade, dt)
      atual.x += (alvo.x - atual.x) * k
      atual.y += (alvo.y - atual.y) * k
      atual.h += (alvo.h - atual.h) * passoSuave(Math.max(0.55, suavidade), dt)
      const parado = Math.abs(alvo.x - atual.x) < 0.001 && Math.abs(alvo.y - atual.y) < 0.001 && Math.abs(alvo.h - atual.h) < 0.002
      if (parado) Object.assign(atual, alvo)
      desenhar()
      raf = parado ? 0 : requestAnimationFrame(passo)
      if (parado) ultimoT = 0
    }
    const agendarPasso = () => { if (!raf) raf = requestAnimationFrame(passo) }

    if (simular && modo === 'editor') {
      capa?.setAttribute('data-acesa', '')
      return simularPonteiro((px, py, _dt, env) => {
        Object.assign(atual, { x: px, y: py, h: env })
        desenhar()
        return true
      }, () => { capa?.removeAttribute('data-acesa'); alvoTilt.style.transform = ''; if (ponto) ponto.style.transform = '' })
    }
    if (!comMouse) return
    const mover = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (!caixa) caixa = area.getBoundingClientRect()
      alvo.x = (e.clientX - caixa.left) / Math.max(1, caixa.width)
      alvo.y = (e.clientY - caixa.top) / Math.max(1, caixa.height)
      agendarPasso()
    }
    const entrar = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      caixa = area.getBoundingClientRect()
      alvo.h = 1
      capa?.setAttribute('data-acesa', '')
      mover(e)
      // a luz nasce onde o mouse entrou (sem deslizar do centro)
      if (!atual.h) { atual.x = alvo.x; atual.y = alvo.y }
    }
    const sair = () => {
      caixa = null
      alvo.h = 0
      alvo.x = 0.5
      alvo.y = 0.5
      capa?.removeAttribute('data-acesa')
      agendarPasso()
    }
    area.addEventListener('pointerenter', entrar, { passive: true })
    area.addEventListener('pointermove', mover, { passive: true })
    area.addEventListener('pointerleave', sair, { passive: true })
    return () => {
      area.removeEventListener('pointerenter', entrar)
      area.removeEventListener('pointermove', mover)
      area.removeEventListener('pointerleave', sair)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveTilt, comMouse, reduzir, simular, modo, diametro])

  let conteudo: ReactNode = children
  if (tilt || luz) {
    conteudo = (
      <div ref={refTilt} className="camada-tilt" style={comMouse && tilt ? { willChange: 'transform' } : undefined}>
        {children}
        {luz && (
          <div ref={refLuz} aria-hidden className="camada-luz" style={{ borderRadius: raio }}>
            <div ref={refPonto} className="camada-luz-ponto" style={{ width: diametro, height: diametro, background: fundoLuz, transform: t3(largura / 2 - diametro / 2, altura / 2 - diametro / 2) }} />
          </div>
        )}
      </div>
    )
  }
  if (plx) {
    conteudo = (
      <div className={`camada-plx${rolagemCss ? ' plx-rolagem' : ''}`} data-plx={plx.depth} style={{ ['--plx' as string]: plx.depth / 100 }}>
        <div ref={refMouse} className="camada-plx-mouse" style={comMouse ? { willChange: 'transform' } : undefined}>{conteudo}</div>
      </div>
    )
  }
  return <div ref={raiz} className="camada-reativa" style={{ position: 'absolute', inset: 0 }}>{conteudo}</div>
}

/**
 * Ponteiro simulado (prévia no editor): um oito pela camada, com entrada e saída suaves. `f(px, py, dt, envelope)`
 * a cada quadro; `fim` no final ou ao desmontar.
 */
function simularPonteiro(f: (px: number, py: number, dt: number, envelope: number) => boolean, fim: () => void): () => void {
  let raf = 0
  let t0 = 0
  let ultimoT = 0
  const passo = (t: number) => {
    if (!t0) t0 = t
    const u = Math.min(1, (t - t0) / DURACAO_SIMULACAO_MS)
    const [px, py] = ponteiroSimulado(u)
    f(px, py, ultimoT ? t - ultimoT : 1000 / 60, Math.sin(u * Math.PI))
    ultimoT = t
    if (u < 1) raf = requestAnimationFrame(passo)
    else fim()
  }
  raf = requestAnimationFrame(passo)
  return () => { cancelAnimationFrame(raf); fim() }
}

/** #RRGGBB (ou #RGB) + alfa → rgba(). */
function hexComAlfa(hex: string, alfa: number): string {
  const h = hex.replace('#', '')
  const cheio = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(cheio, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(Math.max(0, Math.min(1, alfa)) * 1000) / 1000})`
}

/**
 * Parallax no voo da câmera do Explorar: as camadas com profundidade da tela que chega entram deslocadas no
 * sentido do voo (as mais perto, mais) e assentam junto com a câmera. Uma animação por camada, de uma vez só.
 */
export function parallaxDoVoo(raizTela: HTMLElement, dx: number, dy: number, duracao: number, atraso: number, curva: string) {
  if (movimentoReduzido() || typeof raizTela.animate !== 'function') return
  const n = Math.hypot(dx, dy)
  if (n < 1) return
  const ux = dx / n
  const uy = dy / n
  raizTela.querySelectorAll<HTMLElement>('.camada-plx').forEach((el) => {
    const k = (Number(el.dataset.plx ?? 0) / 100) * PARALLAX_PX.voo
    if (!k) return
    el.animate([{ transform: t3(ux * k, uy * k) }, { transform: 'translate3d(0px, 0px, 0px)' }], { duration: duracao, delay: atraso, easing: curva, fill: 'backwards' })
  })
}
