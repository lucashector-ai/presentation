/**
 * Marca no "Criar com IA", tudo sem IA (grátis): paleta extraída do logo (pixels lidos no navegador e agrupados
 * aqui), 3–4 paletas sugeridas a partir dela, paletas prontas quando não há logo nem cores, e as cores citadas no
 * pedido ("azul-marinho e dourado", "#1F3B4D"). Puro: sem rede, sem DOM (o canvas fica em components/app/criar).
 */
import { RE_HEX, contraste, luminanciaRelativa, paraHex } from './designSystem'

export interface PaletaSugerida { id: string; nome: string; cores: string[] }

// ---------------------------------------------------------------- cor em HSL (para agrupar e variar)

const rgb = (hex: string): [number, number, number] => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) || 0) as [number, number, number]

export function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}

export function deHsl(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360
  if (s === 0) return paraHex(l * 255, l * 255, l * 255)
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const canal = (t0: number) => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return paraHex(canal(hh + 1 / 3) * 255, canal(hh) * 255, canal(hh - 1 / 3) * 255)
}

/** Distância perceptual simples entre duas cores (RGB ponderado). */
export function distancia(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}

// ---------------------------------------------------------------- paleta do logo

export interface CoresDoLogo {
  /** Cores marcantes do logo, da mais presente para a menos (sem brancos/pretos quase puros, salvo se só houver eles). */
  cores: string[]
  /** Cor média dos pixels visíveis (decide se o logo precisa virar silhueta sobre um fundo). */
  media: string
  /** O logo é praticamente monocromático (preto, branco ou cinza). */
  neutro: boolean
}

/**
 * Agrupa os pixels de um logo (RGBA, como `ImageData.data`) em cores dominantes: ignora pixels transparentes,
 * quantiza em 4 bits por canal, junta tons próximos e ordena por presença (cores saturadas pesam mais).
 */
export function coresDoLogo(dados: ArrayLike<number>, maximo = 5): CoresDoLogo {
  const baldes = new Map<number, { n: number; r: number; g: number; b: number }>()
  let soma = [0, 0, 0]
  let total = 0
  for (let i = 0; i + 3 < dados.length; i += 4) {
    const a = dados[i + 3]!
    if (a < 128) continue
    const r = dados[i]!
    const g = dados[i + 1]!
    const b = dados[i + 2]!
    soma = [soma[0]! + r, soma[1]! + g, soma[2]! + b]
    total++
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const x = baldes.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }
    x.n++
    x.r += r
    x.g += g
    x.b += b
    baldes.set(k, x)
  }
  if (!total) return { cores: [], media: '#808080', neutro: true }
  const media = paraHex(soma[0]! / total, soma[1]! / total, soma[2]! / total)
  const candidatas = [...baldes.values()]
    .map((x) => ({ cor: paraHex(x.r / x.n, x.g / x.n, x.b / x.n), n: x.n }))
    .map((x) => {
      const { s, l } = hsl(x.cor)
      const quaseNeutra = s < 0.12 || l > 0.94 || l < 0.06
      return { ...x, peso: x.n * (quaseNeutra ? 0.35 : 1 + s), quaseNeutra }
    })
    .sort((a, b) => b.peso - a.peso)
  const escolhidas: { cor: string; peso: number; quaseNeutra: boolean }[] = []
  for (const c of candidatas) {
    if (c.n < total * 0.004) continue
    const parecida = escolhidas.find((e) => distancia(e.cor, c.cor) < 90)
    if (parecida) { parecida.peso += c.peso; continue }
    escolhidas.push({ cor: c.cor, peso: c.peso, quaseNeutra: c.quaseNeutra })
  }
  escolhidas.sort((a, b) => b.peso - a.peso)
  const coloridas = escolhidas.filter((e) => !e.quaseNeutra)
  const lista = (coloridas.length ? [...coloridas, ...escolhidas.filter((e) => e.quaseNeutra && luminanciaRelativa(e.cor) < 0.2)] : escolhidas).map((e) => e.cor)
  return { cores: lista.slice(0, maximo), media, neutro: !coloridas.length }
}

/**
 * 3–4 paletas a partir das cores do logo (ou de qualquer cor principal): as do próprio logo, a principal com um
 * neutro escuro, uma complementar e uma monocromática. A 1ª cor de cada paleta é o acento (ver aplicarMarca).
 */
export function paletasDoLogo(cores: string[]): PaletaSugerida[] {
  const validas = cores.filter((c) => RE_HEX.test(c)).map((c) => c.toUpperCase())
  if (!validas.length) return []
  const principal = validas[0]!
  const { h, s, l } = hsl(principal)
  const sat = Math.max(0.35, s)
  const escuro = deHsl(h, Math.min(0.45, sat), 0.12)
  const saida: PaletaSugerida[] = []
  if (validas.length > 1) saida.push({ id: 'logo', nome: 'Do logo', cores: validas.slice(0, 4) })
  saida.push({ id: 'logo-escuro', nome: 'Principal + escuro', cores: [principal, escuro, deHsl(h + 30, Math.min(0.7, sat), Math.min(0.72, Math.max(0.55, l + 0.15)))] })
  saida.push({ id: 'logo-complementar', nome: 'Complementar', cores: [principal, deHsl(h + 180, Math.min(0.75, sat), 0.5), deHsl(h, Math.min(0.3, sat), 0.14)] })
  saida.push({ id: 'logo-mono', nome: 'Tons da principal', cores: [principal, deHsl(h, sat, Math.max(0.1, l - 0.32)), deHsl(h, Math.min(0.6, sat), Math.min(0.85, l + 0.3))] })
  // sem logo colorido (preto/branco): a 1ª sugestão vira o neutro com um acento seguro
  return saida.slice(0, 4).map((p) => ({ ...p, cores: [...new Set(p.cores.map((c) => c.toUpperCase()))] }))
}

/** Paletas prontas quando a pessoa não tem logo nem cita cores (combinadas com qualquer estilo). */
export const PALETAS_PRONTAS: readonly PaletaSugerida[] = [
  { id: 'oceano', nome: 'Oceano', cores: ['#1F6FEB', '#0B1F3A', '#4FD1C5'] },
  { id: 'terracota', nome: 'Terracota', cores: ['#C2552D', '#2B1D16', '#E8B04A'] },
  { id: 'floresta', nome: 'Floresta', cores: ['#2F7D4F', '#13261A', '#E3B23C'] },
  { id: 'berinjela', nome: 'Berinjela', cores: ['#7B3FA0', '#1E1033', '#F28C6B'] },
  { id: 'coral', nome: 'Coral', cores: ['#F2545B', '#1D2433', '#FFC857'] },
  { id: 'grafite-lima', nome: 'Grafite e lima', cores: ['#B6E62E', '#151515', '#5965F2'] },
  { id: 'marinho-ouro', nome: 'Marinho e ouro', cores: ['#C9A45C', '#0E1B33', '#7A8BA8'] },
  { id: 'rosa-chiclete', nome: 'Rosa chiclete', cores: ['#FF4F9A', '#24113B', '#2EC4B6'] },
]

// ---------------------------------------------------------------- cores citadas no pedido

const NOMES_CORES: [RegExp, string][] = [
  [/azul[- ]marinho|marinho|navy/, '#1B2A4A'],
  [/azul[- ]claro|azul[- ]bebê|celeste/, '#5DA9E9'],
  [/azul royal|azul[- ]royal/, '#2F4BDB'],
  [/turquesa|ciano|teal|verde[- ]água/, '#14A3A0'],
  [/azul/, '#2F6BFF'],
  [/verde[- ]limão|lima/, '#B6E62E'],
  [/verde[- ]musgo|musgo|oliva/, '#5E7F45'],
  [/verde[- ]escuro|verde[- ]floresta/, '#1F5134'],
  [/verde/, '#2F9E5B'],
  [/vermelho|carmim|escarlate/, '#D7263D'],
  [/vinho|bordô|bordo/, '#7A1F2B'],
  [/laranja|tangerina/, '#F07C1E'],
  [/terracota|tijolo/, '#C2552D'],
  [/amarelo|mostarda/, '#F2C14E'],
  [/dourado|ouro/, '#C9A45C'],
  [/prata|prateado/, '#A8AEB8'],
  [/rosa[- ]choque|pink|magenta/, '#E5147D'],
  [/rosa/, '#F28CB1'],
  [/lil[aá]s|lavanda/, '#A78BFA'],
  [/roxo|violeta|púrpura|purpura/, '#6E3BFF'],
  [/marrom|caf[eé]|chocolate/, '#6B4226'],
  [/bege|areia|creme/, '#E8DCC4'],
  [/preto|negro/, '#111111'],
  [/cinza|grafite/, '#4A4A4A'],
]

/**
 * Cores citadas num texto livre: códigos #RRGGBB (ou #RGB) e nomes de cor em português ("azul-marinho e dourado").
 * Serve para não perguntar o que a pessoa já disse e para sugerir as cores no passo da marca.
 */
export function coresDoTexto(texto: string): string[] {
  const t = texto.toLowerCase()
  const saida: string[] = []
  for (const m of t.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/g)) {
    const h = m[1]!
    saida.push(`#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h}`.toUpperCase())
  }
  // só nomes que aparecem perto de palavras de cor ("cores", "paleta", "tons") ou de preposições de cor ("em azul")
  const falaDeCor = /\b(cor|cores|paleta|tons?|colorid[oa]s?|identidade)\b/.test(t)
  let resto = t
  for (const [re, hex] of NOMES_CORES) {
    const m = resto.match(new RegExp(`\\b(?:${re.source})\\b`))
    if (!m) continue
    const antes = resto.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0)
    if (falaDeCor || /\b(em|de|tons? de|e)\s+$/.test(antes)) saida.push(hex)
    resto = resto.replace(m[0], ' ')
  }
  return [...new Set(saida)].slice(0, 4)
}

/** Ordena as cores para a marca: a mais saturada e com contraste vira a principal; uma bem escura (se houver) vem depois. */
export function ordenarCoresDaMarca(cores: string[]): string[] {
  const validas = [...new Set(cores.filter((c) => RE_HEX.test(c)).map((c) => c.toUpperCase()))]
  if (validas.length < 2) return validas
  const nota = (c: string) => hsl(c).s * 2 + Math.min(contraste(c, '#FFFFFF'), contraste(c, '#000000')) / 10 - (luminanciaRelativa(c) < 0.03 || luminanciaRelativa(c) > 0.9 ? 1 : 0)
  const [principal, ...resto] = [...validas].sort((a, b) => nota(b) - nota(a))
  return [principal!, ...resto]
}

/** Uma cor "parecida" a ser trocada no seletor sem perder o tom (para os 3 botões de variação no passo da marca). */
export const variarCor = (hex: string, passo: number) => {
  const { h, s, l } = hsl(hex)
  return passo === 0 ? hex.toUpperCase() : deHsl(h, s, Math.max(0.08, Math.min(0.9, l + passo * 0.12)))
}
