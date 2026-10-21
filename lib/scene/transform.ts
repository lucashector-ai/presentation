/**
 * Matemática de encaixe e transformações. Sem dependência de DOM: testável e usada
 * igualmente pelo editor (canvas) e pelo visualizador (escala proporcional).
 */
import type { Camada, Cena } from './schema'

export interface Tamanho {
  width: number
  height: number
}
export interface Retangulo {
  x: number
  y: number
  width: number
  height: number
}
export interface Ponto {
  x: number
  y: number
}

export interface Encaixe {
  /** Fator aplicado às coordenadas de referência da cena. */
  scale: number
  /** Deslocamento (px do viewport) para centralizar a cena. */
  offsetX: number
  offsetY: number
  /** Tamanho renderizado da cena. */
  width: number
  height: number
}

/**
 * Encaixa a cena dentro do viewport mantendo proporção (contain) e respeitando margem de segurança.
 */
export function calcularEncaixe(cena: Tamanho, viewport: Tamanho, margem = 0): Encaixe {
  const larguraUtil = Math.max(1, viewport.width - margem * 2)
  const alturaUtil = Math.max(1, viewport.height - margem * 2)
  const scale = Math.min(larguraUtil / cena.width, alturaUtil / cena.height)
  const width = cena.width * scale
  const height = cena.height * scale
  return {
    scale,
    width,
    height,
    offsetX: (viewport.width - width) / 2,
    offsetY: (viewport.height - height) / 2,
  }
}

/** Converte um ponto do viewport (ex.: evento de ponteiro) para coordenadas da cena. */
export function paraCena(p: Ponto, e: Encaixe): Ponto {
  return { x: (p.x - e.offsetX) / e.scale, y: (p.y - e.offsetY) / e.scale }
}

/** Converte um retângulo da cena para pixels do viewport. */
export function paraViewport(r: Retangulo, e: Encaixe): Retangulo {
  return {
    x: e.offsetX + r.x * e.scale,
    y: e.offsetY + r.y * e.scale,
    width: r.width * e.scale,
    height: r.height * e.scale,
  }
}

export function arredondar(v: number, casas = 0): number {
  const f = 10 ** casas
  return Math.round(v * f) / f
}

export function snap(valor: number, passo: number, ativo = true): number {
  if (!ativo || passo <= 0) return valor
  return Math.round(valor / passo) * passo
}

export const TAMANHO_MINIMO = 8

export type Alca = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Redimensiona um retângulo pela alça arrastada. dx/dy em coordenadas da cena.
 * `proporcional` mantém a razão de aspecto (Shift no editor).
 */
export function redimensionar(r: Retangulo, alca: Alca, dx: number, dy: number, proporcional = false): Retangulo {
  let { x, y, width, height } = r
  const razao = r.width / r.height

  if (alca.includes('e')) width = r.width + dx
  if (alca.includes('w')) {
    width = r.width - dx
    x = r.x + dx
  }
  if (alca.includes('s')) height = r.height + dy
  if (alca.includes('n')) {
    height = r.height - dy
    y = r.y + dy
  }

  if (proporcional) {
    const horizontal = alca === 'e' || alca === 'w'
    const vertical = alca === 'n' || alca === 's'
    if (horizontal) height = width / razao
    else if (vertical) width = height * razao
    else {
      // cantos: domina a maior variação relativa
      if (Math.abs(dx) >= Math.abs(dy)) height = width / razao
      else width = height * razao
    }
    if (alca.includes('n')) y = r.y + r.height - height
    if (alca.includes('w')) x = r.x + r.width - width
  }

  if (width < TAMANHO_MINIMO) {
    if (alca.includes('w')) x = r.x + r.width - TAMANHO_MINIMO
    width = TAMANHO_MINIMO
  }
  if (height < TAMANHO_MINIMO) {
    if (alca.includes('n')) y = r.y + r.height - TAMANHO_MINIMO
    height = TAMANHO_MINIMO
  }
  return { x, y, width, height }
}

export type Alinhamento = 'esquerda' | 'centroH' | 'direita' | 'topo' | 'centroV' | 'base'

/** Alinha camadas em relação à cena (uma camada) ou à caixa que as envolve (várias). */
export function alinhar<T extends Retangulo>(camadas: T[], cena: Tamanho, modo: Alinhamento): T[] {
  if (camadas.length === 0) return camadas
  const caixa = camadas.length === 1 ? { x: 0, y: 0, width: cena.width, height: cena.height } : envolvente(camadas)
  return camadas.map((c) => {
    switch (modo) {
      case 'esquerda':
        return { ...c, x: caixa.x }
      case 'direita':
        return { ...c, x: caixa.x + caixa.width - c.width }
      case 'centroH':
        return { ...c, x: caixa.x + (caixa.width - c.width) / 2 }
      case 'topo':
        return { ...c, y: caixa.y }
      case 'base':
        return { ...c, y: caixa.y + caixa.height - c.height }
      case 'centroV':
        return { ...c, y: caixa.y + (caixa.height - c.height) / 2 }
    }
  })
}

export function envolvente(rs: Retangulo[]): Retangulo {
  const x1 = Math.min(...rs.map((r) => r.x))
  const y1 = Math.min(...rs.map((r) => r.y))
  const x2 = Math.max(...rs.map((r) => r.x + r.width))
  const y2 = Math.max(...rs.map((r) => r.y + r.height))
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
}

export function contemPonto(r: Retangulo, p: Ponto): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

/** Camada mais acima (maior z, depois última na lista) que contém o ponto; ignora ocultas e travadas se pedido. */
export function camadaNoPonto(cena: Cena, p: Ponto, opcoes: { ignorarTravadas?: boolean } = {}): Camada | undefined {
  const candidatas = cena.layers
    .filter((c) => !c.hidden && !(opcoes.ignorarTravadas && c.locked) && contemPonto(c, p))
    .sort((a, b) => b.z - a.z)
  return candidatas[0]
}

/** Retângulo para encaixar uma mídia (w×h) dentro de uma cena com margem, centralizado. */
export function enquadrarNaCena(midia: Tamanho, cena: Tamanho, margem = 0): Retangulo {
  const e = calcularEncaixe(midia, cena, margem)
  return { x: e.offsetX, y: e.offsetY, width: e.width, height: e.height }
}
