/**
 * Enquadramento do <model-viewer> com sangria: o elemento fica (1 + 2·sangria) vezes maior que a caixa da
 * camada, com a câmera no mesmo lugar e um campo de visão proporcionalmente maior. O modelo aparece do mesmo
 * tamanho e na mesma posição, e a sombra pode passar da caixa sem ser cortada.
 */
/** Fração do tamanho da caixa acrescentada em cada lado. */
export const SANGRIA = 0.2
/** Campo de visão máximo/mínimo padrão do model-viewer (graus). */
const FOV_MAX_PADRAO = 30
const FOV_MIN_PADRAO = 12
const RAIO_AUTO = 105 // "auto" do model-viewer = 105% da distância ideal

const rad = (g: number) => (g * Math.PI) / 180
const graus = (r: number) => (r * 180) / Math.PI
/** Ângulo que mostra `k` vezes mais (mesma câmera, tela k vezes maior). */
const ampliarFov = (g: number, k: number) => graus(2 * Math.atan(k * Math.tan(rad(g) / 2)))
const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

export interface EnquadramentoSangria {
  fieldOfView: string
  minFieldOfView: string
  maxFieldOfView: string
  cameraOrbit: string
  maxCameraOrbit: string
}

/**
 * Atributos do model-viewer para um elemento (1 + 2·sangria) vezes maior que mostram o modelo exatamente
 * do mesmo tamanho e no mesmo lugar. Devolve null se a órbita não puder ser convertida (ex.: calc()).
 */
export function enquadramentoComSangria(orbita: string, fieldOfView: number, sangria = SANGRIA): EnquadramentoSangria | null {
  const k = 1 + 2 * sangria
  const termos = orbita.trim().split(/\s+/).filter(Boolean)
  if (termos.length > 3 || termos.some((t) => t.includes('('))) return null
  const [theta = 'auto', phi = 'auto', raio = 'auto'] = termos
  // o model-viewer limita o campo de visão ao máximo padrão (30°); a distância usa o valor pedido
  const fovVisivel = Math.min(fieldOfView, FOV_MAX_PADRAO)
  const fovNovo = ampliarFov(fovVisivel, k)
  // a distância ideal é raio/sen(fov/2): compensa para a câmera ficar no mesmo lugar
  const r = Math.sin(rad(fovNovo) / 2) / Math.sin(rad(fieldOfView) / 2)
  let raioNovo: string
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(raio)
  if (raio === 'auto') raioNovo = `${fmt(RAIO_AUTO * r)}%`
  else if (pct) raioNovo = `${fmt(Number(pct[1]) * r)}%`
  else if (/^\d+(?:\.\d+)?(m|cm|mm)$/.test(raio)) raioNovo = raio
  else return null
  return {
    fieldOfView: `${fmt(fovNovo)}deg`,
    maxFieldOfView: `${fmt(fovNovo)}deg`,
    minFieldOfView: `${fmt(ampliarFov(FOV_MIN_PADRAO, k))}deg`,
    cameraOrbit: `${theta} ${phi} ${raioNovo}`,
    // o máximo padrão é 105% da distância ideal; a base do % do máximo já é esse valor
    maxCameraOrbit: `auto auto ${fmt(100 * r)}%`,
  }
}
