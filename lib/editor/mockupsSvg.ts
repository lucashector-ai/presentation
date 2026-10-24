/**
 * Desenhos SVG das molduras dos mockups (lib/editor/mockups.ts): aparelhos com acabamento metálico, janela de
 * navegador, cartão de post, interface do story e do perfil do Instagram. Cada função devolve um markup
 * autocontido (gradientes em <defs>, sem fontes nem referências externas) no sistema de coordenadas "nativo"
 * do modelo; a camada `svg` que o recebe usa `fit: 'fill'`, então tudo escala junto com o frame externo.
 * Puro: só monta strings.
 */

// ---------- cor ----------

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const n = parseInt(v.padEnd(6, '0'), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const paraHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')

/** Mistura `cor` com `alvo` na proporção `t` (0 = cor, 1 = alvo). */
export function misturar(cor: string, alvo: string, t: number): string {
  const a = hexParaRgb(cor)
  const b = hexParaRgb(alvo)
  return `#${paraHex(a[0] + (b[0] - a[0]) * t)}${paraHex(a[1] + (b[1] - a[1]) * t)}${paraHex(a[2] + (b[2] - a[2]) * t)}`
}

/** Luminância relativa aproximada (0 escuro … 1 claro). */
export function luminancia(cor: string): number {
  const [r, g, b] = hexParaRgb(cor).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export interface TemaMoldura {
  cor: string
  /** Faces iluminadas do metal. */
  claro: string
  brilho: string
  /** Faces na sombra. */
  escuro: string
  /** Moldura escura o bastante para a interface (navegador, post, story) ficar em modo escuro. */
  escura: boolean
}

export function temaMoldura(cor: string): TemaMoldura {
  const lum = luminancia(cor)
  const escuraMetal = lum < 0.2
  return {
    cor,
    claro: misturar(cor, '#FFFFFF', escuraMetal ? 0.28 : 0.5),
    brilho: misturar(cor, '#FFFFFF', escuraMetal ? 0.55 : 0.85),
    escuro: misturar(cor, '#000000', escuraMetal ? 0.45 : 0.32),
    escura: lum < 0.1,
  }
}

const svg = (w: number, h: number, corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${corpo}</svg>`

/** Gradiente metálico diagonal (claro → cor → escuro → cor → claro) e o vertical dos botões. */
function defsMetal(t: TemaMoldura, id = 'm'): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.claro}"/><stop offset=".28" stop-color="${t.cor}"/><stop offset=".55" stop-color="${t.escuro}"/><stop offset=".82" stop-color="${t.cor}"/><stop offset="1" stop-color="${t.claro}"/></linearGradient>` +
    `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.escuro}"/><stop offset=".5" stop-color="${t.claro}"/><stop offset="1" stop-color="${t.escuro}"/></linearGradient>` +
    `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.brilho}"/><stop offset=".5" stop-color="${t.cor}"/><stop offset="1" stop-color="${t.escuro}"/></linearGradient>`
}

const BEZEL = '#0B0B0D'

// ---------- celular (iPhone) ----------

/** Geometria nativa do celular: corpo, aro, bezel e tela. Compartilhada entre o desenho e o gerador de camadas. */
export const CELULAR = { w: 360, h: 752, corpoX: 4, corpoW: 352, raio: 56, aro: 5, bezel: 9, ilha: { w: 100, h: 30, y: 24 } } as const

export function svgCelular(t: TemaMoldura): string {
  const { w, h, corpoX: cx, corpoW: cw, raio, aro, bezel } = CELULAR
  const inset = aro + bezel
  const botao = (x: number, y: number, alt: number) => `<rect x="${x}" y="${y}" width="3.5" height="${alt}" rx="1.4" fill="url(#mb)"/>`
  return svg(w, h, `<defs>${defsMetal(t)}</defs>` +
    // botões laterais (ação, volume e lateral) saem do corpo
    botao(0.5, 152, 28) + botao(0.5, 212, 58) + botao(0.5, 284, 58) + botao(w - 4, 236, 96) +
    // corpo em titânio com aresta brilhante
    `<rect x="${cx}" y="0" width="${cw}" height="${h}" rx="${raio}" fill="url(#m)"/>` +
    `<rect x="${cx + 0.75}" y="0.75" width="${cw - 1.5}" height="${h - 1.5}" rx="${raio - 0.75}" fill="none" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="1"/>` +
    // costura escura entre o aro e o vidro + bezel preto
    `<rect x="${cx + aro}" y="${aro}" width="${cw - aro * 2}" height="${h - aro * 2}" rx="${raio - aro}" fill="${BEZEL}"/>` +
    `<rect x="${cx + aro + 0.5}" y="${aro + 0.5}" width="${cw - aro * 2 - 1}" height="${h - aro * 2 - 1}" rx="${raio - aro - 0.5}" fill="none" stroke="#000000" stroke-opacity=".7" stroke-width="1"/>` +
    // área da tela (fica embaixo do frame "Tela"; aparece só se a tela ficar transparente)
    `<rect x="${cx + inset}" y="${inset}" width="${cw - inset * 2}" height="${h - inset * 2}" rx="${raio - inset}" fill="#101418"/>`)
}

/** Ilha dinâmica com a lente da câmera. */
export function svgIlha(): string {
  const { w, h } = CELULAR.ilha
  return svg(w, h, `<rect width="${w}" height="${h}" rx="${h / 2}" fill="#000"/><circle cx="${w - 18}" cy="${h / 2}" r="5.2" fill="#0A1120"/><circle cx="${w - 18}" cy="${h / 2}" r="2.6" fill="#1B2E57"/><circle cx="${w - 19.6}" cy="${h / 2 - 1.6}" r=".9" fill="#FFFFFF" fill-opacity=".5"/>`)
}

/** Reflexo diagonal do vidro, bem sutil (vai por cima da tela). */
export function svgReflexo(w: number, h: number, raio: number): string {
  return svg(w, h, `<defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".14"/><stop offset=".42" stop-color="#FFFFFF" stop-opacity=".03"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient></defs><rect width="${w}" height="${h}" rx="${raio}" fill="url(#r)"/>`)
}

// ---------- tablet (iPad) ----------

export const TABLET = { w: 592, h: 824, corpoW: 589, corpoY: 3, raio: 44, aro: 5, bezel: 20 } as const

export function svgTablet(t: TemaMoldura): string {
  const { w, h, corpoW: cw, corpoY: cy, raio, aro, bezel } = TABLET
  const ch = h - cy
  const inset = aro + bezel
  return svg(w, h, `<defs>${defsMetal(t)}</defs>` +
    // botão superior e volume na lateral direita
    `<rect x="508" y="0" width="44" height="3.5" rx="1.4" fill="url(#mv)"/><rect x="${cw - 0.5}" y="64" width="3.5" height="40" rx="1.4" fill="url(#mb)"/><rect x="${cw - 0.5}" y="114" width="3.5" height="40" rx="1.4" fill="url(#mb)"/>` +
    `<rect x="0" y="${cy}" width="${cw}" height="${ch}" rx="${raio}" fill="url(#m)"/>` +
    `<rect x=".75" y="${cy + 0.75}" width="${cw - 1.5}" height="${ch - 1.5}" rx="${raio - 0.75}" fill="none" stroke="#FFFFFF" stroke-opacity=".4" stroke-width="1"/>` +
    `<rect x="${aro}" y="${cy + aro}" width="${cw - aro * 2}" height="${ch - aro * 2}" rx="${raio - aro}" fill="${BEZEL}"/>` +
    `<rect x="${aro + 0.5}" y="${cy + aro + 0.5}" width="${cw - aro * 2 - 1}" height="${ch - aro * 2 - 1}" rx="${raio - aro - 0.5}" fill="none" stroke="#000000" stroke-opacity=".7" stroke-width="1"/>` +
    // câmera frontal no bezel superior
    `<circle cx="${cw / 2}" cy="${cy + aro + bezel / 2}" r="3.6" fill="#141A24"/><circle cx="${cw / 2}" cy="${cy + aro + bezel / 2}" r="1.6" fill="#243B6B"/>` +
    `<rect x="${inset}" y="${cy + inset}" width="${cw - inset * 2}" height="${ch - inset * 2}" rx="${raio - inset}" fill="#101418"/>`)
}

// ---------- notebook (MacBook) ----------

export const NOTEBOOK = { w: 1120, h: 704, tampaX: 60, tampaW: 1000, tampaH: 636, aro: 6, bezel: 14, baseY: 636, notch: { w: 160, h: 22 } } as const

export function svgNotebook(t: TemaMoldura): string {
  const { w, h, tampaX: tx, tampaW: tw, tampaH: th, aro, bezel, baseY } = NOTEBOOK
  const inset = aro + bezel
  // teclado sugerido: 4 fileiras de teclas achatadas pela perspectiva
  let teclas = ''
  for (let fila = 0; fila < 4; fila++) {
    const y = baseY + 10 + fila * 8
    const n = fila === 3 ? 10 : 30
    const larg = fila === 3 ? 48 : 15.5
    const total = n * (larg + 2) - 2
    const x0 = w / 2 - total / 2
    for (let i = 0; i < n; i++) {
      const extra = fila === 3 && i === 4 ? 1 : 0 // barra de espaço mais larga
      teclas += `<rect x="${(x0 + i * (larg + 2)).toFixed(1)}" y="${y}" width="${larg + extra * 40}" height="6" rx="1.2" fill="${t.escuro}" fill-opacity=".55"/>`
      if (extra) { i += 1 }
    }
  }
  return svg(w, h, `<defs>${defsMetal(t)}` +
    `<linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.brilho}"/><stop offset=".18" stop-color="${t.claro}"/><stop offset="1" stop-color="${t.cor}"/></linearGradient>` +
    `<linearGradient id="frente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.escuro}"/><stop offset="1" stop-color="${misturar(t.escuro, '#000000', 0.4)}"/></linearGradient></defs>` +
    // base: tampo visto de cima em perspectiva curta + face frontal
    `<path d="M20 ${baseY + 4} H${w - 20} L${w} ${h - 10} Q${w} ${h - 4} ${w - 6} ${h - 4} H6 Q0 ${h - 4} 0 ${h - 10} Z" fill="url(#base)"/>` +
    `<path d="M0 ${h - 10} Q0 ${h - 4} 6 ${h - 4} H${w - 6} Q${w} ${h - 4} ${w} ${h - 10} V${h - 6} Q${w} ${h} ${w - 6} ${h} H6 Q0 ${h} 0 ${h - 6} Z" fill="url(#frente)"/>` +
    // entalhe para abrir
    `<path d="M${w / 2 - 70} ${h - 4} H${w / 2 + 70} Q${w / 2 + 66} ${h} ${w / 2 + 60} ${h} H${w / 2 - 60} Q${w / 2 - 66} ${h} ${w / 2 - 70} ${h - 4} Z" fill="#000000" fill-opacity=".35"/>` +
    teclas +
    // trackpad
    `<rect x="${w / 2 - 80}" y="${baseY + 46}" width="160" height="16" rx="3" fill="${t.claro}" fill-opacity=".55" stroke="${t.escuro}" stroke-opacity=".5" stroke-width=".8"/>` +
    // dobradiça escura atrás da tampa
    `<rect x="${tx + 4}" y="${baseY - 2}" width="${tw - 8}" height="8" rx="2" fill="${misturar(t.escuro, '#000000', 0.5)}"/>` +
    // tampa fina em alumínio com bezel preto
    `<path d="M${tx} ${22} Q${tx} 0 ${tx + 22} 0 H${tx + tw - 22} Q${tx + tw} 0 ${tx + tw} 22 V${th - 8} Q${tx + tw} ${th} ${tx + tw - 8} ${th} H${tx + 8} Q${tx} ${th} ${tx} ${th - 8} Z" fill="url(#m)"/>` +
    `<path d="M${tx + 0.75} ${22} Q${tx + 0.75} .75 ${tx + 22} .75 H${tx + tw - 22} Q${tx + tw - 0.75} .75 ${tx + tw - 0.75} 22" fill="none" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="1"/>` +
    `<rect x="${tx + aro}" y="${aro}" width="${tw - aro * 2}" height="${th - aro - 4}" rx="16" fill="${BEZEL}"/>` +
    `<rect x="${tx + inset}" y="${inset}" width="${tw - inset * 2}" height="${th - inset - bezel - 4}" rx="4" fill="#101418"/>`)
}

/** Notch do MacBook (fica por cima da tela, colado ao bezel). */
export function svgNotch(): string {
  const { w, h } = NOTEBOOK.notch
  return svg(w, h, `<path d="M0 0 H${w} V${h - 8} Q${w} ${h} ${w - 8} ${h} H8 Q0 ${h} 0 ${h - 8} Z" fill="${BEZEL}"/><circle cx="${w / 2}" cy="${h / 2}" r="3.2" fill="#141A24"/><circle cx="${w / 2}" cy="${h / 2}" r="1.4" fill="#243B6B"/>`)
}

// ---------- navegador ----------

export const NAVEGADOR = { w: 1120, h: 720, abas: 44, barra: 48, raio: 16 } as const

export interface TemaJanela { fundo: string; faixa: string; barra: string; pilula: string; aba: string; texto: string; texto2: string; borda: string }

export function temaJanela(escura: boolean): TemaJanela {
  return escura
    ? { fundo: '#1E1E21', faixa: '#202023', barra: '#2C2C30', pilula: '#1E1E21', aba: '#2C2C30', texto: '#E6E6EA', texto2: '#A1A1AA', borda: '#FFFFFF1F' }
    : { fundo: '#FFFFFF', faixa: '#E4E5E8', barra: '#F6F6F8', pilula: '#E9EAEE', aba: '#F6F6F8', texto: '#1F2328', texto2: '#6E7781', borda: '#0000001F' }
}

export function svgNavegador(j: TemaJanela): string {
  const { w, h, abas, barra, raio } = NAVEGADOR
  const topo = abas + barra
  const icone = (d: string, x: number, y: number, cor = j.texto2) => `<path d="${d}" transform="translate(${x} ${y})" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
  return svg(w, h, `<defs><linearGradient id="fav" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9F99D"/><stop offset="1" stop-color="#6FA38A"/></linearGradient><linearGradient id="av" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A3642"/><stop offset="1" stop-color="#101820"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" rx="${raio}" fill="${j.fundo}"/>` +
    // faixa das abas e barra de ferramentas
    `<path d="M0 ${raio} Q0 0 ${raio} 0 H${w - raio} Q${w} 0 ${w} ${raio} V${abas} H0 Z" fill="${j.faixa}"/>` +
    `<rect x="0" y="${abas}" width="${w}" height="${barra}" fill="${j.barra}"/>` +
    `<rect x="0" y="${topo - 0.5}" width="${w}" height="1" fill="${j.borda}"/>` +
    // semáforo
    `<circle cx="22" cy="22" r="6" fill="#FF5F57"/><circle cx="42" cy="22" r="6" fill="#FEBC2E"/><circle cx="62" cy="22" r="6" fill="#28C840"/>` +
    // aba ativa com as curvas do Chrome
    `<path d="M84 ${abas} Q92 ${abas} 94 ${abas - 8} V18 Q94 8 104 8 H318 Q328 8 328 18 V${abas - 8} Q330 ${abas} 338 ${abas} Z" fill="${j.aba}"/>` +
    `<circle cx="116" cy="26" r="7" fill="url(#fav)"/>` +
    icone('M0 0 L8 8 M8 0 L0 8', 302, 22) +
    icone('M6 0 V12 M0 6 H12', 352, 20) +
    // voltar, avançar, recarregar
    icone('M8 0 L0 8 L8 16', 18, 60) + icone('M0 0 L8 8 L0 16', 48, 60) +
    icone('M14 8 A7 7 0 1 1 11.9 3 M12 0 V4 H8', 74, 60) +
    // endereço com cadeado
    `<rect x="108" y="${abas + 8}" width="${w - 216}" height="32" rx="16" fill="${j.pilula}"/>` +
    `<rect x="124" y="${abas + 15}" width="10" height="9" rx="2" fill="none" stroke="${j.texto2}" stroke-width="1.5"/><path d="M126 ${abas + 15} V${abas + 13} a3 3 0 0 1 6 0 V${abas + 15}" fill="none" stroke="${j.texto2}" stroke-width="1.5"/>` +
    // compartilhar, nova aba, perfil, menu
    icone('M6 10 V0 M2 4 L6 0 L10 4 M0 7 V14 H12 V7', w - 108, 61) +
    `<circle cx="${w - 60}" cy="68" r="12" fill="url(#av)"/><path d="M${w - 66} 73 Q${w - 60} 66 ${w - 54} 73" fill="none" stroke="#D9F99D" stroke-width="1.6" stroke-linecap="round"/><circle cx="${w - 60}" cy="63" r="2.5" fill="#D9F99D"/>` +
    `<circle cx="${w - 24}" cy="62" r="1.6" fill="${j.texto2}"/><circle cx="${w - 24}" cy="68" r="1.6" fill="${j.texto2}"/><circle cx="${w - 24}" cy="74" r="1.6" fill="${j.texto2}"/>` +
    // borda da janela
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${raio - 0.5}" fill="none" stroke="${j.borda}" stroke-width="1"/>`)
}

// ---------- Instagram: ícones e cartões ----------

export interface TemaInsta { fundo: string; texto: string; texto2: string; borda: string; separador: string }
export function temaInsta(escuro: boolean): TemaInsta {
  return escuro
    ? { fundo: '#000000', texto: '#F5F5F5', texto2: '#A8A8A8', borda: '#262626', separador: '#262626' }
    : { fundo: '#FFFFFF', texto: '#0A0A0A', texto2: '#737373', borda: '#DBDBDB', separador: '#EFEFEF' }
}

const GRAD_INSTA = '<linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#F9CE34"/><stop offset=".5" stop-color="#EE2A7B"/><stop offset="1" stop-color="#6228D7"/></linearGradient>'
const GRAD_AVATAR = '<linearGradient id="avt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E3B49"/><stop offset="1" stop-color="#0E141B"/></linearGradient>'

/** Ícones de 24 px do Instagram (traço), posicionados pelo canto superior esquerdo. */
const ICONES = {
  coracao: 'M12 20.5s-7.5-4.6-9.6-9.3A5.3 5.3 0 0 1 12 6.2a5.3 5.3 0 0 1 9.6 5C19.5 15.9 12 20.5 12 20.5z',
  comentario: 'M21 12a9 9 0 0 1-13.2 7.9L3 21l1.1-4.8A9 9 0 1 1 21 12z',
  enviar: 'M21.5 2.5 10.6 13.4 M21.5 2.5 14.5 21.5 10.6 13.4 2.5 9.5z',
  salvar: 'M5.5 3.5h13v17l-6.5-4.6-6.5 4.6z',
  mais: 'M12 4v16M4 12h16',
  menu: 'M3 6h18M3 12h18M3 18h18',
  novo: 'M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM12 8v8M8 12h8',
  grade: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  reels: 'M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM3 8.5h18M8 3l3 5.5M13 3l3 5.5M10.5 12l4 2.5-4 2.5z',
  marcado: 'M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-8-4.5zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  fechar: 'M6 6l12 12M18 6 6 18',
} as const

export function icone(nome: keyof typeof ICONES, x: number, y: number, cor: string, escala = 1, espessura = 1.8): string {
  return `<path d="${ICONES[nome]}" transform="translate(${x} ${y}) scale(${escala})" fill="none" stroke="${cor}" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function reticencias(x: number, y: number, cor: string, r = 1.6, passo = 6): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${cor}"/><circle cx="${x + passo}" cy="${y}" r="${r}" fill="${cor}"/><circle cx="${x + passo * 2}" cy="${y}" r="${r}" fill="${cor}"/>`
}

/** Avatar com anel de story (gradiente do Instagram) e miolo escuro; `d` é o diâmetro externo. */
function avatar(cx: number, cy: number, d: number, anel = true): string {
  const r = d / 2
  return (anel ? `<circle cx="${cx}" cy="${cy}" r="${r - 1.25}" fill="none" stroke="url(#ig)" stroke-width="2.5"/>` : '') +
    `<circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="url(#avt)"/>`
}

/** Fundo redondo dos destaques do perfil: gradiente suave em tons da marca com aro cinza. */
function destaque(cx: number, cy: number, d: number, cores: [string, string], borda: string, n: number): string {
  const r = d / 2
  return `<defs><linearGradient id="d${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cores[0]}"/><stop offset="1" stop-color="${cores[1]}"/></linearGradient></defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="${borda}" stroke-width="1"/><circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="url(#d${n})"/>`
}

export const CARTAO_POST = { w: 560, cabecalho: 56, rodape: 120, raio: 16 } as const

/**
 * Cartão de um post (feed): cabeçalho com avatar, reticências; rodapé com coração, comentário, enviar e salvar.
 * `fotoH` é a altura da área da foto; a altura total é cabeçalho + foto + rodapé. O nome, as curtidas e a
 * legenda são camadas de texto por cima (editáveis).
 */
export function svgCartaoPost(w: number, fotoH: number, t: TemaInsta, raio: number = CARTAO_POST.raio, rodape: number = CARTAO_POST.rodape): string {
  const { cabecalho } = CARTAO_POST
  const h = cabecalho + fotoH + rodape
  const yIcones = cabecalho + fotoH + 12
  return svg(w, h, `<defs>${GRAD_INSTA}${GRAD_AVATAR}</defs>` +
    `<rect width="${w}" height="${h}" rx="${raio}" fill="${t.fundo}"/>` +
    avatar(34, cabecalho / 2, 40) +
    reticencias(w - 36, cabecalho / 2, t.texto) +
    icone('coracao', 16, yIcones, t.texto) + icone('comentario', 56, yIcones, t.texto) + icone('enviar', 96, yIcones, t.texto) + icone('salvar', w - 40, yIcones, t.texto) +
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${raio - 0.5}" fill="none" stroke="${t.borda}" stroke-width="1"/>`)
}

export const STORY = { w: 400, h: 712, raio: 24 } as const

/** Interface do story por cima da foto: barra de progresso, avatar, fechar, resposta e reações. */
export function svgStory(): string {
  const { w, h, raio } = STORY
  const seg = (w - 24 - 8) / 3
  return svg(w, h, `<defs>${GRAD_INSTA}${GRAD_AVATAR}<linearGradient id="topo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient><clipPath id="c"><rect width="${w}" height="${h}" rx="${raio}"/></clipPath></defs>` +
    `<g clip-path="url(#c)"><rect width="${w}" height="150" fill="url(#topo)"/><rect y="${h - 200}" width="${w}" height="200" fill="url(#base)"/></g>` +
    [0, 1, 2].map((i) => `<rect x="${12 + i * (seg + 4)}" y="12" width="${seg}" height="2.5" rx="1.25" fill="#FFFFFF" fill-opacity="${i === 0 ? 1 : 0.4}"/>`).join('') +
    avatar(32, 44, 36, false) +
    reticencias(w - 70, 44, '#FFFFFF') + icone('fechar', w - 36, 32, '#FFFFFF', 1, 2) +
    `<rect x="12" y="${h - 60}" width="${w - 108}" height="44" rx="22" fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="1.2"/>` +
    icone('coracao', w - 84, h - 50, '#FFFFFF') + icone('enviar', w - 44, h - 50, '#FFFFFF'))
}

export const PERFIL = { w: 324, h: 724, avatar: { cx: 56, cy: 130, d: 80 }, botoes: { y: 236, h: 30, w: 146, x1: 16, x2: 170 }, destaques: { y: 308, d: 60, x0: 46, passo: 80 }, abas: { y: 364, h: 40 }, grade: { y: 404, gap: 1 } } as const

/** Cores suaves (tons da marca de exemplo) para destaques e posts sem imagem. */
export const GRADIENTES_SUAVES: [string, string][] = [
  ['#D9F99D', '#B5D8C2'], ['#2A3642', '#101820'], ['#F6F7F5', '#DCE3DA'], ['#B5D8C2', '#7F93A6'],
  ['#5B6670', '#17202B'], ['#DCE3DA', '#B5D8C2'], ['#F0F7D9', '#D9F99D'], ['#7F93A6', '#2A3642'], ['#B5D8C2', '#F6F7F5'],
]

/**
 * Interface do perfil do Instagram na tela do celular (324×724): barra de status, ícones do topo, avatar com
 * anel, botões, destaques, abas com a aba da grade ativa. Textos (hora, @, números, nome, bio, rótulos) são
 * camadas de texto por cima.
 */
export function svgPerfil(t: TemaInsta): string {
  const { w, h, avatar: av, botoes, destaques, abas } = PERFIL
  const d = destaques
  return svg(w, h, `<defs>${GRAD_INSTA}${GRAD_AVATAR}</defs>` +
    // status: sinal, wi-fi e bateria
    `<g fill="${t.texto}"><rect x="${w - 72}" y="24" width="3" height="4" rx=".8"/><rect x="${w - 67.5}" y="22" width="3" height="6" rx=".8"/><rect x="${w - 63}" y="20" width="3" height="8" rx=".8"/><rect x="${w - 58.5}" y="18" width="3" height="10" rx=".8"/></g>` +
    `<path d="M${w - 52} 22.5a8 8 0 0 1 11 0M${w - 49.5} 25a4.5 4.5 0 0 1 6 0M${w - 46.5} 27.6l0 0" fill="none" stroke="${t.texto}" stroke-width="1.6" stroke-linecap="round"/><circle cx="${w - 46.5}" cy="27.4" r="1.1" fill="${t.texto}"/>` +
    `<rect x="${w - 36}" y="19" width="22" height="11" rx="3" fill="none" stroke="${t.texto}" stroke-opacity=".45" stroke-width="1"/><rect x="${w - 34.5}" y="20.5" width="18" height="8" rx="1.8" fill="${t.texto}"/><rect x="${w - 13}" y="22.5" width="1.6" height="4" rx=".8" fill="${t.texto}" fill-opacity=".45"/>` +
    // topo: novo post e menu
    icone('novo', w - 72, 52, t.texto) + icone('menu', w - 36, 52, t.texto) +
    // avatar com anel
    avatar(av.cx, av.cy, av.d) +
    `<circle cx="${av.cx + 28}" cy="${av.cy + 28}" r="10" fill="#0095F6" stroke="${t.fundo}" stroke-width="2"/><path d="M${av.cx + 28} ${av.cy + 23.5}v9M${av.cx + 23.5} ${av.cy + 28}h9" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>` +
    // botões Seguir / Mensagem (rótulos são textos)
    `<rect x="${botoes.x1}" y="${botoes.y}" width="${botoes.w}" height="${botoes.h}" rx="8" fill="#0095F6"/><rect x="${botoes.x2}" y="${botoes.y}" width="${botoes.w}" height="${botoes.h}" rx="8" fill="${t.separador}"/>` +
    // destaques
    [0, 1, 2, 3].map((i) => destaque(d.x0 + i * d.passo, d.y, d.d, GRADIENTES_SUAVES[(i * 2 + 1) % GRADIENTES_SUAVES.length]!, t.borda, i)).join('') +
    // abas: grade (ativa), reels, marcados
    `<rect x="0" y="${abas.y}" width="${w}" height="1" fill="${t.separador}"/>` +
    icone('grade', w / 6 - 12, abas.y + 8, t.texto) + icone('reels', w / 2 - 12, abas.y + 8, t.texto2) + icone('marcado', (w * 5) / 6 - 12, abas.y + 8, t.texto2) +
    `<rect x="0" y="${abas.y + abas.h - 1.5}" width="${w / 3}" height="1.5" fill="${t.texto}"/>`)
}
