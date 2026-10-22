/**
 * Efeitos interativos da camada — parallax, tilt 3D e luz que segue o mouse — em lógica pura (sem React/DOM):
 * padrões, intensidades de um clique, o deslocamento/inclinação de cada quadro e a profundidade automática da
 * tela. O renderizador (components/renderer/reativos.tsx) só aplica o que sai daqui, então editor (prévia),
 * visualizador, Story e Explorar mostram o mesmo movimento.
 */
import type { Camada, Cena, EfeitosInterativos } from './schema'

export type Parallax = NonNullable<EfeitosInterativos['parallax']>
export type Tilt = NonNullable<EfeitosInterativos['tilt']>
export type Luz = NonNullable<EfeitosInterativos['spotlight']>
export type TipoInterativo = 'parallax' | 'tilt' | 'spotlight'

// ---------- padrões e faixas ----------

/** Profundidade padrão (Média): a camada anda 45% do máximo. */
export const PARALLAX_PADRAO: Parallax = { depth: 45 }
export const TILT_PADRAO: Required<Tilt> = { angle: 8, scale: 1.03, perspective: 1000, smooth: 0.5 }
export const LUZ_PADRAO: Required<Luz> = { mode: 'light', size: 60, intensity: 0.5, color: '#FFFFFF' }

/**
 * Quanto o parallax anda com profundidade 100, em px da cena. Movimentos curtos: com o mouse no canto, a camada
 * mais próxima desliza 40 px; na rolagem do Story, 160 px ao longo da passagem inteira pela janela; na transição
 * entre telas (deslizar/empurrar), entra 240 px além do resto; no voo do Explorar, 280 px.
 */
export const PARALLAX_PX = { mouse: 40, rolagem: 160, transicao: 240, voo: 280 } as const

/** Intensidades de um clique (Fraca/Média/Forte) de cada efeito. */
export const INTENSIDADES_INTERATIVAS: { id: 'fraca' | 'media' | 'forte'; rotulo: string; parallax: number; tilt: number; luz: number }[] = [
  { id: 'fraca', rotulo: 'Fraca', parallax: 20, tilt: 4, luz: 0.3 },
  { id: 'media', rotulo: 'Média', parallax: 45, tilt: 8, luz: 0.5 },
  { id: 'forte', rotulo: 'Forte', parallax: 80, tilt: 14, luz: 0.8 },
]

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function tiltDe(t: Tilt): Required<Tilt> {
  return {
    angle: limitar(t.angle, 1, 30),
    scale: limitar(t.scale ?? TILT_PADRAO.scale, 1, 1.2),
    perspective: limitar(t.perspective ?? TILT_PADRAO.perspective, 300, 4000),
    smooth: limitar(t.smooth ?? TILT_PADRAO.smooth, 0, 1),
  }
}
export function luzDe(l: Luz): Required<Luz> {
  return { mode: l.mode, size: limitar(l.size ?? LUZ_PADRAO.size, 5, 150), intensity: limitar(l.intensity ?? LUZ_PADRAO.intensity, 0, 1), color: l.color ?? LUZ_PADRAO.color }
}

/** A camada tem algum efeito interativo? */
export function temInterativo(c: Pick<Camada, 'interactiveEffects'>): boolean {
  const e = c.interactiveEffects
  return !!e && (!!e.parallax?.depth || !!e.tilt || !!e.spotlight)
}

// ---------- quadro a quadro ----------

/**
 * Deslocamento do parallax pelo mouse (px da cena). `nx`, `ny`: posição do ponteiro na janela, de −1 (esquerda/
 * topo) a 1. Camadas mais perto andam ao contrário do mouse (como quando a cabeça se mexe diante de uma cena);
 * as mais longe, a favor e menos.
 */
export function deslocamentoMouse(p: Parallax, nx: number, ny: number): [number, number] {
  const k = (-limitar(p.depth, -100, 100) / 100) * PARALLAX_PX.mouse
  const eixo = p.axis ?? 'both'
  return [eixo === 'y' ? 0 : arred(k * limitar(nx, -1, 1)), eixo === 'x' ? 0 : arred(k * limitar(ny, -1, 1))]
}

/** Deslocamento do parallax num instante da rolagem (`progresso`: 0 = a camada entrando por baixo, 1 = saindo por cima). */
export function deslocamentoRolagem(p: Parallax, progresso: number): number {
  return arred((limitar(p.depth, -100, 100) / 100) * PARALLAX_PX.rolagem * (0.5 - limitar(progresso, 0, 1)))
}

/**
 * Transform do tilt 3D. `px`, `py`: ponteiro dentro da camada (0–1); `h`: quanto o efeito está ligado (0 = em
 * repouso, 1 = mouse em cima; a transição entre os dois é suave). O lado sob o mouse afunda, como um cartão
 * apertado.
 */
export function transformTilt(t: Tilt, px: number, py: number, h: number): string {
  const d = tiltDe(t)
  const ry = arred((limitar(px, 0, 1) - 0.5) * 2 * d.angle * h)
  const rx = arred((0.5 - limitar(py, 0, 1)) * 2 * d.angle * h)
  const s = arred(1 + (d.scale - 1) * h, 1000)
  return `perspective(${d.perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`
}

/**
 * Fração do caminho até o alvo que o efeito anda por quadro (60 Hz), pela suavidade (0 = cola no mouse, 1 = bem
 * macio). Com quadros mais longos, o passo cresce na mesma proporção (o tempo para assentar não muda).
 */
export function passoSuave(suavidade: number, dtMs = 1000 / 60): number {
  const porQuadro = 1 - limitar(suavidade, 0, 1) * 0.92
  return 1 - Math.pow(1 - porQuadro, Math.max(0.25, dtMs / (1000 / 60)))
}

/**
 * Caminho de um ponteiro simulado (prévia no editor e cartões da galeria): um oito deitado que passa pelos
 * cantos e volta ao centro. `t`: 0–1. Devolve x, y de 0 a 1.
 */
export function ponteiroSimulado(t: number): [number, number] {
  const a = limitar(t, 0, 1) * Math.PI * 2
  const amp = Math.sin(limitar(t, 0, 1) * Math.PI) // começa e termina no centro
  return [arred(0.5 + 0.45 * Math.sin(a) * amp, 1000), arred(0.5 + 0.35 * Math.sin(2 * a) * amp, 1000)]
}

const arred = (n: number, f = 100) => Math.round(n * f) / f

// ---------- um clique: dar profundidade à tela inteira ----------

/**
 * Profundidade automática: fundos bem longe, imagens e formas um pouco longe, títulos à frente e o texto de
 * apoio um pouco à frente. Só mexe no parallax (mantém tilt e luz); hotspots e camadas ocultas ficam de fora.
 * `forca`: multiplicador (1 = Média).
 */
export function profundidadeAutomatica(cena: Cena, forca = 1): Camada[] {
  const area = cena.size.width * cena.size.height
  const maiorFonte = Math.max(0, ...cena.layers.map((c) => (c.type === 'text' ? c.fontSize : 0)))
  const profundidade = (c: Camada): number => {
    const a = Math.min(c.width, cena.size.width) * Math.min(c.height, cena.size.height)
    if (c.type !== 'text' && a >= area * 0.85) return -40
    if (c.type === 'text') return c.fontSize >= Math.max(40, maiorFonte * 0.75) ? 45 : 20
    if (c.type === 'image' || c.type === 'video' || c.type === 'model3d' || c.type === 'lottie') return -15
    return a >= area * 0.25 ? -25 : 10
  }
  return cena.layers.map((c) => {
    if (c.type === 'hotspot' || c.hidden) return c
    const depth = Math.round(limitar(profundidade(c) * forca, -100, 100))
    return { ...c, interactiveEffects: { ...c.interactiveEffects, parallax: { ...c.interactiveEffects?.parallax, depth } } } as Camada
  })
}

/** Remove o parallax de todas as camadas (mantém tilt e luz). */
export function semProfundidade(camadas: Camada[]): Camada[] {
  return camadas.map((c) => {
    if (!c.interactiveEffects?.parallax) return c
    const { parallax: _p, ...resto } = c.interactiveEffects
    const vazio = !resto.tilt && !resto.spotlight
    if (vazio) {
      const { interactiveEffects: _e, ...sem } = c
      return sem as Camada
    }
    return { ...c, interactiveEffects: resto } as Camada
  })
}
