/**
 * Sombra realista (inspirada no plugin Beautiful Shadows): em vez de uma sombra única e dura, várias camadas
 * suaves empilhadas — curtas e nítidas perto da camada, longas e difusas longe —, como a luz de verdade.
 *
 * Modelo: a luz fica num ponto (−1…1) em relação ao centro da camada; a sombra cai do lado oposto, mais longa
 * quanto mais baixa (afastada do centro) a luz. A elevação é quanto a camada "flutua": define o comprimento da
 * camada mais distante; as demais dobram de tamanho a cada passo (1, 2, 4, 8…), o que dá a transição suave.
 * A intensidade é a opacidade total sob a camada (dividida entre as camadas); a suavidade controla o desfoque.
 * Pura: o inspetor gera a lista e grava em `effects.shadows` (marcadas com `realistic: true`).
 */
import type { Efeitos, Sombra, SombraRealista } from './schema'
import { MAX_SOMBRAS, SombraRealistaSchema } from './schema'
import { EFEITOS_BASE, sombrasDe } from './efeitos'

export const REALISTA_PADRAO: SombraRealista = SombraRealistaSchema.parse({})

const r2 = (v: number) => Math.round(v * 100) / 100
const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const hex2 = (a: number) => Math.round(lim(a, 0, 1) * 255).toString(16).padStart(2, '0').toUpperCase()

/** Cor #RRGGBB (de qualquer hex aceito) com alfa 0–1. */
function comAlfa(cor: string, alfa: number): string {
  let h = cor.replace('#', '')
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('')
  return `#${h.slice(0, 6).toUpperCase()}${hex2(alfa)}`
}

/** Camadas de sombra geradas pelos ajustes (de cima para baixo: a mais próxima primeiro). */
export function gerarSombrasRealistas(p: Partial<SombraRealista> = {}): Sombra[] {
  const a = { ...REALISTA_PADRAO, ...p }
  const n = lim(Math.round(a.layers), 1, 10)
  const E = lim(a.elevation, 0, 200)
  // direção: oposta à luz; luz no centro = sombra embaixo da camada (só desfoque, sem deslocamento lateral)
  const dx = -lim(a.light.x, -1, 1)
  const dy = -lim(a.light.y, -1, 1)
  // opacidade de cada camada para que o empilhamento chegue perto da intensidade total pedida
  const total = lim(a.intensity, 0, 1) * 0.9
  const alfa = 1 - Math.pow(1 - total, 1 / n)
  const suave = lim(a.softness, 0, 1)
  const sombras: Sombra[] = []
  for (let i = 1; i <= n; i++) {
    // 1, 2, 4… até a elevação (a última camada tem o comprimento total)
    const d = E * Math.pow(2, i - n)
    const blur = d * (1 + suave * 2.2)
    const spread = -d * 0.18 * (1 - suave)
    // camadas mais longas ficam um pouco mais claras (a luz rebatida apaga a ponta da sombra)
    const a_i = alfa * (1.15 - 0.3 * ((i - 1) / Math.max(1, n - 1)))
    sombras.push({
      x: r2(lim(dx * d, -200, 200)),
      y: r2(lim(dy * d + d * 0.12, -200, 200)),
      blur: r2(lim(blur, 0, 300)),
      spread: r2(lim(spread, -100, 100)),
      color: comAlfa(a.color, a_i),
      realistic: true,
    })
  }
  return sombras
}

/** Grava os ajustes e substitui as camadas geradas antes (mantém as sombras manuais e a posição na lista). */
export function comSombraRealista(e: Efeitos | undefined, ajustes: SombraRealista | undefined): Efeitos {
  const base = { ...EFEITOS_BASE, ...e }
  const atuais = sombrasDe(e)
  const inicio = atuais.findIndex((s) => s.realistic)
  const manuais = atuais.filter((s) => !s.realistic)
  const { shadow: _antiga, ...resto } = base
  if (!ajustes) return { ...resto, realistic: undefined, shadows: manuais }
  const geradas = gerarSombrasRealistas(ajustes).map((s) => (ajustes.hidden ? { ...s, hidden: true } : s))
  const pos = inicio < 0 ? 0 : Math.min(inicio, manuais.length)
  const lista = [...manuais.slice(0, pos), ...geradas, ...manuais.slice(pos)].slice(0, MAX_SOMBRAS)
  return { ...resto, realistic: ajustes, shadows: lista }
}

/** Predefinições rápidas (elevação de cartão, flutuando, alto). */
export const PREDEFINICOES_REALISTA: { id: string; rotulo: string; ajustes: Partial<SombraRealista> }[] = [
  { id: 'baixa', rotulo: 'Baixa', ajustes: { elevation: 8, intensity: 0.35, softness: 0.5, layers: 4 } },
  { id: 'media', rotulo: 'Média', ajustes: { elevation: 24, intensity: 0.45, softness: 0.6, layers: 6 } },
  { id: 'alta', rotulo: 'Alta', ajustes: { elevation: 64, intensity: 0.5, softness: 0.7, layers: 7 } },
  { id: 'flutuando', rotulo: 'Flutuando', ajustes: { elevation: 120, intensity: 0.4, softness: 0.85, layers: 8 } },
]
