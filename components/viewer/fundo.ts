/**
 * Fundo estendido da apresentação: quando a proporção da tela é diferente da do projeto, as "faixas" em
 * volta da cena são preenchidas com o próprio fundo da cena (cor, gradiente ou imagem), sem bordas visíveis.
 * Funções puras (testadas em fundo.test.ts).
 */
import type { Cena, Gradiente } from '@/lib/scene/schema'
import { ordenarParaRender } from '@/lib/scene/order'

export interface Tamanho {
  width: number
  height: number
}
export interface Retangulo extends Tamanho {
  x: number
  y: number
}

export type ModoEncaixe = 'ajustar' | 'preencher'

/** Encaixe da cena na tela: "ajustar" mostra tudo (contain); "preencher" cobre a tela cortando o mínimo (cover). */
export function encaixar(cena: Tamanho, tela: Tamanho, modo: ModoEncaixe = 'ajustar') {
  const sx = Math.max(1, tela.width) / cena.width
  const sy = Math.max(1, tela.height) / cena.height
  const scale = modo === 'preencher' ? Math.max(sx, sy) : Math.min(sx, sy)
  const width = cena.width * scale
  const height = cena.height * scale
  // origem em pixel inteiro: com as bordas das camadas também alinhadas ao pixel, nada vaza entre caixas coladas
  return { scale, width, height, offsetX: Math.round((tela.width - width) / 2), offsetY: Math.round((tela.height - height) / 2) }
}

const rad = (g: number) => (g * Math.PI) / 180
const arred = (n: number) => Math.round(n * 1000) / 1000

/**
 * Gradiente da cena pintado numa área maior e concêntrica (a tela inteira) com as mesmas cores dentro da
 * caixa da cena. Fora dela, as cores continuam (linear) ou se mantêm na última parada (CSS faz o resto).
 */
export function gradienteEstendido(g: Gradiente, caixa: Tamanho, area: Tamanho): string {
  const paradas = [...g.stops].sort((a, b) => a.pos - b.pos)
  if (g.type === 'radial') {
    // "circle at center" sem tamanho = farthest-corner: raio = meia diagonal
    const f = Math.hypot(caixa.width, caixa.height) / Math.max(1, Math.hypot(area.width, area.height))
    return `radial-gradient(circle at center, ${paradas.map((s) => `${s.color} ${arred(s.pos * f)}%`).join(', ')})`
  }
  // comprimento da linha do gradiente CSS para um ângulo: |w·sen| + |h·cos|
  const linha = (t: Tamanho) => Math.abs(t.width * Math.sin(rad(g.angle))) + Math.abs(t.height * Math.cos(rad(g.angle)))
  const f = linha(caixa) / Math.max(1e-6, linha(area))
  return `linear-gradient(${g.angle}deg, ${paradas.map((s) => `${s.color} ${arred(50 + (s.pos - 50) * f)}%`).join(', ')})`
}

export type FundoDaCena =
  | { tipo: 'cor'; cor: string }
  | { tipo: 'gradiente'; cor: string; gradiente: Gradiente }
  | { tipo: 'imagem'; cor: string; assetId: string; fit: 'cover' | 'contain' | 'fill'; ret: Retangulo }

const cobre = (r: Retangulo, t: Tamanho) => r.x <= 0.5 && r.y <= 0.5 && r.x + r.width >= t.width - 0.5 && r.y + r.height >= t.height - 0.5
const centrado = (r: Retangulo, t: Tamanho) => Math.abs(r.x + r.width / 2 - t.width / 2) < 1 && Math.abs(r.y + r.height / 2 - t.height / 2) < 1

/**
 * O que estender para fora da cena: imagem de fundo, gradiente ou cor. Se a camada mais ao fundo cobre a
 * cena inteira (foto ou retângulo "sangrado", comum em artes vindas do Figma), ela é o fundo de verdade.
 */
export function fundoDaCena(cena: Cena): FundoDaCena {
  const cor = cena.background
  const tela = cena.size
  const base = ordenarParaRender(cena.layers).find((c) => !c.hidden)
  if (base && base.opacity >= 1 && !base.rotation && !base.flipX && !base.flipY && !base.effects && cobre(base, tela)) {
    if (base.type === 'image' && !base.crop && !base.adjust && base.mask === 'none' && !base.radius) {
      return { tipo: 'imagem', cor, assetId: base.assetId, fit: base.fit, ret: { x: base.x, y: base.y, width: base.width, height: base.height } }
    }
    if (base.type === 'shape' && base.shape === 'rect' && !base.radius && base.pattern === 'none' && !base.strokeWidth) {
      if (!base.gradient) return { tipo: 'cor', cor: base.fill }
      if (centrado(base, tela)) return { tipo: 'gradiente', cor: base.fill, gradiente: base.gradient }
    }
  }
  if (cena.backgroundAssetId) return { tipo: 'imagem', cor, assetId: cena.backgroundAssetId, fit: cena.backgroundFit, ret: { x: 0, y: 0, ...tela } }
  if (cena.backgroundGradient) return { tipo: 'gradiente', cor, gradiente: cena.backgroundGradient }
  return { tipo: 'cor', cor }
}

/** Retângulo ocupado pela imagem com object-fit "cover" (centralizada) — pode passar da caixa. */
export function retanguloCover(caixa: Retangulo, natural: Tamanho): Retangulo {
  const k = Math.max(caixa.width / natural.width, caixa.height / natural.height)
  const width = natural.width * k
  const height = natural.height * k
  return { x: caixa.x + (caixa.width - width) / 2, y: caixa.y + (caixa.height - height) / 2, width, height }
}
