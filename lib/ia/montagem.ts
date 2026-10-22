/**
 * Motor de montagem do design system: transforma uma tela desenhada (componente + variante + conteúdo,
 * escolhidos pela IA ou pelo gerador local) e um tema em camadas do schema de cena.
 * Grade de 12 colunas (slides 16:9) ou 6 colunas (story 9:16), escala tipográfica com ajuste de tamanho
 * por medição aproximada do texto, cores por superfície (claro/escuro/acento) com contraste checado,
 * motivo decorativo do tema (com o mesmo nome em todas as telas, para a transição morph) e rodapé.
 * Os ids das camadas carregam o papel ("titulo-", "texto-", "item-", "valor-"…), usado pelas ações de IA
 * do editor (lib/ia/tela.ts). Puro: sem rede, sem DOM.
 */
import { calcularLayout } from '@/lib/editor/autolayout'
import type { Camada as CamadaCena } from '@/lib/scene/schema'
import { COMPONENTES, alfa, contraste, coresIndicador, legivel, luminanciaRelativa, misturar, regrasDe, superficie, type Alinhamento, type Decoracao, type Fundo, type Superficie, type TemaVisual, type TipoTela } from './designSystem'
import { formatarComo, formatarPct, valorDe } from './numeros'

export type Estilo = 'editorial' | 'ousado' | 'minimal'

/** Uma tela pronta para montar: o que o design decidiu. */
export interface TelaDesenhada {
  tipo: TipoTela
  /** Id da variante do catálogo ("capa.classica"…). */
  variante: string
  fundo: Fundo
  alinhamento: Alinhamento
  /** Rótulo curto acima do título (kicker). */
  rotulo: string
  titulo: string
  /** Final do título que ganha a cor de destaque (precisa ser um trecho final exato do título). */
  enfase: string
  texto: string
  itens: string[]
  /** Índice do item em destaque (-1 = nenhum). */
  destaque: number
  /** Descrição da imagem sugerida para os espaços de imagem. */
  imagem: string
  decoracao: Decoracao
  notas: string
  /**
   * Superfície base do estilo em que a tela foi desenhada. Ao trocar para um estilo de base oposta (claro ↔
   * escuro), "claro" e "escuro" trocam de lugar: o ritmo de respiro continua o mesmo e o estilo novo aparece inteiro.
   */
  baseTema?: 'claro' | 'escuro'
  /** Energia em que a tela foi desenhada: desenhada em "minimal" (sem decoração) ganha a decoração do estilo novo. */
  estiloDesenho?: Estilo
}

export interface ContextoMontagem {
  tema: TemaVisual
  estilo: Estilo
  story: boolean
  /** 1 = primeira tela. */
  numero: number
  total: number
  tituloProjeto: string
  marca: string
  /** Formas/motivos do tema (opção "Imagens: formas"). */
  motivos: boolean
  /** Espaços para imagens do usuário na capa (opção "Imagens: placeholders"). */
  placeholders: boolean
  /** Ordem desta tela entre as seções (para o número da seção). */
  indiceSecao: number
  /** Capa do modo Explorar: o lado direito fica para o menu. */
  reservarDireita: boolean
  uid: (papel: string) => string
  /** Logo da marca (capa, encerramento e, se pedido, o rodapé). Aplicado aqui, sem IA. */
  logo?: LogoMontagem | null
  /** Próxima foto da pessoa para um espaço de imagem (null = acabou; fica o espaço listrado). */
  foto?: () => FotoMontagem | null
}

export interface LogoMontagem {
  assetId: string
  /** Tamanho do arquivo (só a proporção importa). */
  largura: number
  altura: number
  /** Cor média dos pixels do logo: decide se ele vira silhueta branca/preta sobre o fundo. */
  cor: string
  /** Também discreto no rodapé das telas de conteúdo. */
  rodape: boolean
}
export interface FotoMontagem { assetId: string; legenda: string }

type Camada = Record<string, unknown> & { id: string; x: number; y: number; width: number; height: number }

export interface TelaMontada {
  layers: Camada[]
  background: string
  backgroundGradient?: { type: 'linear'; angle: number; stops: { color: string; pos: number }[] }
}

// ---------------------------------------------------------------- medição de texto

/** Largura média de um caractere em em, por fonte (estimativa conservadora para quebrar linha). */
const LARGURA_MEDIA: Record<string, number> = {
  Geist: 0.56, 'Geist Mono': 0.61, Inter: 0.58, 'Space Grotesk': 0.58, 'IBM Plex Sans': 0.57, Fraunces: 0.57,
  'Instrument Serif': 0.46, 'DM Serif Display': 0.54, 'Playfair Display': 0.55, 'Archivo Black': 0.74, Georgia: 0.58, 'system-ui': 0.58,
  'Cormorant Garamond': 0.48, Syne: 0.64, Fredoka: 0.57, 'Source Serif 4': 0.55, Unbounded: 0.76, 'Bebas Neue': 0.4, Manrope: 0.59,
}

/** Largura relativa de cada caractere (maiúsculas, números e letras largas ocupam mais que a média). */
const pesoCaractere = (c: string) => (/[mwMW@%]/.test(c) ? 1.4 : /[A-ZÀ-Ý0-9$#&]/.test(c) ? 1.2 : /[iljtfr.,:;'’!|()\-]/.test(c) ? 0.62 : 1)
const larguraPalavra = (p: string, maiusculas: boolean) => [...p].reduce((s, c) => s + (maiusculas && /\p{Ll}/u.test(c) ? 1.2 : pesoCaractere(c)), 0)

/** Quantas linhas o texto ocupa numa caixa de `largura` px (quebra gulosa por palavra, largura por caractere). */
export function contarLinhas(texto: string, fonte: string, tamanho: number, largura: number, opcoes: { maiusculas?: boolean; espacamento?: number; peso?: number } = {}): number {
  const negrito = (opcoes.peso ?? 400) >= 700 ? 1.08 : (opcoes.peso ?? 400) >= 600 ? 1.04 : 1
  const porCaractere = Math.max(1, tamanho * (LARGURA_MEDIA[fonte] ?? 0.56) * negrito + (opcoes.espacamento ?? 0))
  const max = Math.max(1, (largura * 0.96) / porCaractere)
  const mono = fonte === 'Geist Mono'
  const espaco = mono ? 1 : 0.5
  let total = 0
  for (const paragrafo of texto.split('\n')) {
    let atual = 0
    let linhas = 1
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const n = mono ? palavra.length : larguraPalavra(palavra, !!opcoes.maiusculas)
      if (atual === 0) atual = n
      else if (atual + espaco + n <= max) atual += espaco + n
      else { linhas++; atual = n }
      while (atual > max) { linhas++; atual -= max }
    }
    total += linhas
  }
  return Math.max(1, total)
}

/** Maior tamanho da lista em que o texto cabe em `maxLinhas` (ou o menor). */
export function caber(texto: string, fonte: string, largura: number, tamanhos: number[], maxLinhas: number, opcoes: { maiusculas?: boolean; tracking?: number; peso?: number; alturaMax?: number; lh?: number } = {}): { tamanho: number; linhas: number } {
  // mede com o espaçamento arredondado como ele é gravado na camada (o limiar de uma linha a mais não muda)
  const medir = (t: number) => contarLinhas(texto, fonte, t, largura, { maiusculas: opcoes.maiusculas, espacamento: Math.round(-(opcoes.tracking ?? 0) * t * 10) / 10, peso: opcoes.peso })
  for (const t of tamanhos) {
    const linhas = medir(t)
    if (linhas <= maxLinhas && (!opcoes.alturaMax || t * (opcoes.lh ?? 1.04) * linhas <= opcoes.alturaMax)) return { tamanho: t, linhas }
  }
  const t = tamanhos[tamanhos.length - 1]!
  return { tamanho: t, linhas: medir(t) }
}

/** Divide "título" + "ênfase" (trecho final exato) em duas partes; null se a ênfase não for um final do título. */
export function dividirEnfase(titulo: string, enfase: string): [string, string] | null {
  const t = titulo.trim()
  const e = enfase.trim().replace(/[.!?]+$/, '')
  if (!e || e.length >= t.length) return null
  const semPonto = t.replace(/[.!?]+$/, '')
  if (!semPonto.toLowerCase().endsWith(e.toLowerCase())) return null
  const corte = semPonto.length - e.length
  const a = t.slice(0, corte).trimEnd()
  const b = t.slice(corte).trim()
  if (!a || !b || a.split(/\s+/).length < 1 || b.length > t.length * 0.7) return null
  return [a, b]
}

/** Primeiro número de um texto ("R$ 4,2 bi" → 4.2; "1.200" → 1200; "38%" → 38). */
export function numeroDe(s: string): number | null {
  const m = s.replace(/\s/g, '').match(/-?\d[\d.,]*/)
  if (!m) return null
  let n = m[0]
  if (n.includes(',')) n = n.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{3}(?!\d)/.test(n)) n = n.replace(/\./g, '')
  const v = Number.parseFloat(n)
  return Number.isFinite(v) ? v : null
}

const partes = (item: string) => item.split('|').map((p) => p.trim())
const semAcentoT = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const iniciais = (nome: string) => nome.split(/[\s,]+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '•'

// ---------------------------------------------------------------- montagem

/**
 * Montagem interna: `escala` encolhe textos, vãos e avatares quando o conteúdo não cabe na área (a tela é montada
 * de novo, menor, em vez de transbordar); `fotos` guarda as fotos já tiradas da fila para a nova tentativa usar as mesmas.
 */
interface Interno { escala: number; fotos: (FotoMontagem | null)[] }

export function montarTela(d: TelaDesenhada, c: ContextoMontagem, interno: Interno = { escala: 1, fotos: [] }): TelaMontada {
  const E = interno.escala
  /** Medida na escala da tentativa (só o que é grande o bastante para pesar). */
  const esc = (n: number) => (n > 24 ? Math.round(n * E) : n)
  let iFoto = 0
  const proximaFoto = (): FotoMontagem | null => {
    if (iFoto < interno.fotos.length) return interno.fotos[iFoto++] ?? null
    const f = c.foto?.() ?? null
    interno.fotos.push(f)
    iFoto++
    return f
  }
  const t = c.tema
  const R = regrasDe(t)
  // estilos sem telas de acento (luxo, acadêmico, vidro…) trocam o acento cheio pela superfície oposta
  const relativo: Fundo = d.baseTema && d.baseTema !== t.base && d.fundo !== 'acento' ? (d.fundo === 'claro' ? 'escuro' : 'claro') : d.fundo
  const fundoPedido: Fundo = R.semAcento && relativo === 'acento' ? (t.base === 'claro' ? 'escuro' : 'claro') : relativo
  const fundo: Fundo = d.variante === 'imagem.cheia' ? 'escuro' : fundoPedido
  const s = superficie(t, fundo)
  const st = c.story
  const W = st ? 1080 : 1920
  const H = st ? 1920 : 1080
  // margens do estilo: o luxo respira mais, o brutalista e o suíço encostam mais nas bordas
  const M = Math.round((st ? 88 : 128) * R.margem)
  const MT = Math.round((st ? 150 : 100) * (1 + (R.margem - 1) * 0.6))
  const MB = Math.round((st ? 130 : 92) * (1 + (R.margem - 1) * 0.6))
  const GUT = st ? 28 : 36
  const COLS = st ? 6 : 12
  const cw = (W - M * 2 - (COLS - 1) * GUT) / COLS
  const xc = (i: number) => M + i * (cw + GUT)
  const wc = (n: number) => n * cw + (n - 1) * GUT
  const L: Camada[] = []
  const F = t.fontes
  const raioCartao = Math.min(t.raio, 36)
  // tela desenhada em "minimal" (sem decoração) montada agora numa energia com decoração: ganha a decoração do estilo
  const decoracao = d.decoracao === 'nenhuma' && d.estiloDesenho === 'minimal' && c.estilo !== 'minimal' ? (c.estilo === 'ousado' ? 'marcante' : 'sutil') : d.decoracao
  const decorar = c.motivos && c.estilo !== 'minimal' && decoracao !== 'nenhuma' && t.motivo !== 'nenhum'
  const marcante = decoracao === 'marcante' || c.estilo === 'ousado'
  const centro = d.alinhamento === 'centro'
  const forte = s.destaque
  const sobreDestaque = legivel(forte, [s.fundo, s.tinta, '#FFFFFF', '#141414'], 4.5)
  /** Verde e vermelho de indicador (do tema ou da marca), legíveis sobre este fundo. */
  const { positivo, negativo } = coresIndicador(t, s.fundo)

  // ---------- animações (o ritmo do estilo alonga ou encurta as entradas) ----------
  const ritmo = R.ritmo === 'calmo' ? 1.35 : R.ritmo === 'energico' ? 0.8 : 1
  const dur = (ms: number) => Math.round(ms * ritmo)
  const animTitulo = (delay = 0) =>
    c.estilo === 'ousado' || R.ritmo === 'energico' ? { type: 'slideUp', duration: dur(700), delay, easing: 'spring' } : c.estilo === 'minimal' ? { type: 'fadeIn', duration: dur(500), delay, easing: 'easeOut' } : { type: 'fadeIn', duration: dur(800), delay, easing: 'easeOut' }
  const animTexto = (delay = 200) => ({ type: 'fadeIn', duration: dur(600), delay, easing: 'easeOut' })
  const animItem = (k: number) => ({ type: c.estilo === 'minimal' || R.ritmo === 'calmo' ? 'fadeIn' : 'slideUp', duration: dur(550), delay: Math.min(4000, 250 + k * Math.round(110 * ritmo)), easing: 'easeOut' })
  const animForma = (delay = 100) => ({ type: c.estilo === 'ousado' || R.ritmo === 'energico' ? 'pop' : 'scaleIn', duration: dur(800), delay, easing: 'spring' })

  // ---------- primitivas ----------
  interface OpTexto {
    x: number; y: number; w: number
    fonte?: 'titulo' | 'texto' | 'mono'
    tamanhos: number[]
    max?: number
    peso?: number
    cor?: string
    lh?: number
    tracking?: number
    upper?: boolean
    italic?: boolean
    align?: 'left' | 'center' | 'right'
    opacity?: number
    anim?: Record<string, unknown> | null
    extra?: Record<string, unknown>
    /** Altura mínima da caixa. */
    hMin?: number
    /** Altura máxima do texto: escolhe o maior tamanho que caiba nela. */
    hMax?: number
    /** Os tamanhos já vêm na escala do estilo (não escalar de novo). */
    escalado?: boolean
    /** Frame de auto layout que contém o texto (a posição vem do layout). */
    pai?: string
    /** Largura "preencher" dentro do frame (senão fixa). */
    fill?: boolean
    /** Caixa exata das linhas (sem a folga de baixo): partes de um título empilhadas sem vão. */
    justo?: boolean
  }
  const familia = (f: OpTexto['fonte']) => (f === 'titulo' ? F.titulo : f === 'mono' ? 'Geist Mono' : F.texto)
  /** Escala dos títulos do estilo (startup bold maior, acadêmico menor). */
  const escalar = (tam: number[]) => (R.escalaTitulo === 1 ? tam : tam.map((n) => Math.max(12, Math.round(n * R.escalaTitulo))))
  const PAPEIS_ESCALADOS = new Set(['titulo', 'enfase', 'valor'])
  /** Mede o título como ele vai ser montado (escala e caixa alta do estilo). */
  const caberTitulo = (txt: string, larg: number, tam: number[], max: number, op: { tracking?: number; peso?: number; alturaMax?: number } = {}) =>
    caber(txt, F.titulo, larg, escalar(tam), max, { tracking: op.tracking ?? F.tracking, peso: op.peso ?? F.pesoTitulo, alturaMax: op.alturaMax, maiusculas: R.caixaAlta })
  /**
   * Caixa de texto com altura que abraça o conteúdo (sizingH "hug": o editor mede de novo no DOM ao abrir e o
   * auto layout empurra o resto). Dentro de um frame (`pai`), a posição vem do layout; a largura é fixa ou "preencher".
   */
  const texto = (papel: string, txt: string, o0: OpTexto) => {
    const titulo = o0.fonte === 'titulo'
    const o: OpTexto = titulo
      ? { ...o0, tamanhos: !o0.escalado && PAPEIS_ESCALADOS.has(papel) ? escalar(o0.tamanhos) : o0.tamanhos, upper: o0.upper ?? (R.caixaAlta && !o0.italic) }
      : o0
    const fonte = familia(o.fonte)
    const tracking = o.tracking ?? (o.fonte === 'titulo' ? F.tracking : o.fonte === 'mono' ? -0.12 : 0)
    const lh = o.lh ?? (o.fonte === 'titulo' ? (/Serif|Fraunces|Playfair|Cormorant/.test(fonte) ? 1.06 : 1.02) : o.fonte === 'mono' ? 1.3 : 1.42)
    const peso = o.peso ?? (o.fonte === 'titulo' ? F.pesoTitulo : o.fonte === 'mono' ? 500 : 400)
    const { tamanho, linhas } = caber(txt, fonte, o.w, o.tamanhos.map(esc), o.max ?? 3, { maiusculas: o.upper, tracking, peso, alturaMax: o.hMax, lh })
    const h = Math.max(o.hMin ?? 0, Math.ceil(tamanho * lh * linhas + (o.justo ? 0 : tamanho * 0.12)))
    const l: Camada = {
      id: c.uid(papel), type: 'text', text: txt, x: Math.round(o.x), y: Math.round(o.y), width: Math.max(1, Math.round(o.w)), height: h,
      fontFamily: fonte, fontSize: tamanho, fontWeight: peso,
      lineHeight: lh, letterSpacing: Math.round(-tracking * tamanho * 10) / 10, color: o.cor ?? s.tinta,
      sizingH: 'hug', ...(o.pai ? { parentId: o.pai, ...(o.fill ? { sizingW: 'fill' } : {}) } : {}),
      ...(o.upper ? { transform: 'uppercase' } : {}), ...(o.italic ? { italic: true } : {}), ...(o.align && o.align !== 'left' ? { align: o.align } : {}),
      ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
      ...(o.anim === null ? {} : { enterAnimation: o.anim ?? animTexto() }),
      ...o.extra,
    }
    L.push(l)
    return { l, h, tamanho, linhas, fim: l.y + h }
  }
  const forma = (papel: string, shape: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) => {
    const l: Camada = { id: c.uid(papel), type: 'shape', shape, x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), fill: forte, ...extra }
    L.push(l)
    return l
  }
  const linha = (x: number, y: number, w: number, h = 2, cor = s.linha, extra: Record<string, unknown> = {}) => forma('fio', 'rect', x, y, w, h, { fill: cor, ...extra })

  // ---------- auto layout ----------
  type Alin = 'start' | 'center' | 'end'
  interface OpFrame {
    dir?: 'vertical' | 'horizontal' | 'wrap'
    gap?: number
    rowGap?: number
    gapAuto?: boolean
    pad?: number | { top: number; right: number; bottom: number; left: number }
    alX?: Alin
    alY?: Alin
    /** Dimensionamento por eixo (padrão: largura fixa, altura abraça o conteúdo). */
    w?: 'fixed' | 'hug' | 'fill'
    h?: 'fixed' | 'hug' | 'fill'
    pai?: string | null
    extra?: Record<string, unknown>
  }
  /**
   * Frame com auto layout (o mesmo do editor): os filhos se empilham com gap e padding e a altura abraça o
   * conteúdo. Nada se sobrepõe e tudo continua editável como auto layout (reordenar, gap e padding no painel).
   * Sem nome: a transição morph casa camadas pelo nome, e frames iguais em telas diferentes não devem casar.
   */
  const frame = (papel: string, x: number, y: number, w: number, h: number, o: OpFrame = {}): Camada => {
    const p0 = typeof o.pad === 'number' ? { top: o.pad, right: o.pad, bottom: o.pad, left: o.pad } : (o.pad ?? { top: 0, right: 0, bottom: 0, left: 0 })
    const pad = { top: esc(p0.top), right: esc(p0.right), bottom: esc(p0.bottom), left: esc(p0.left) }
    const l: Camada = {
      id: c.uid(papel), type: 'frame', x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)),
      sizingW: o.w ?? 'fixed', sizingH: o.h ?? 'hug',
      layout: { direction: o.dir ?? 'vertical', gap: esc(Math.round(o.gap ?? 0)), gapAuto: !!o.gapAuto, ...(o.rowGap !== undefined ? { rowGap: esc(Math.round(o.rowGap)) } : {}), padding: pad, alignX: o.alX ?? 'start', alignY: o.alY ?? 'start' },
      ...(o.pai ? { parentId: o.pai } : {}),
      ...o.extra,
    }
    L.push(l)
    return l
  }
  type Layout = { direction: string; gap: number; rowGap?: number; gapAuto: boolean; padding: { top: number; right: number; bottom: number; left: number } }
  const layoutDe = (f: Camada) => f.layout as Layout
  /** Resolve o auto layout do que já foi montado (posição e tamanho finais de cada camada). */
  const resolver = () => calcularLayout(L.map((l, i) => ({ ...l, z: i })) as unknown as CamadaCena[]) as unknown as Camada[]
  /** Caixa final de um frame (depois do auto layout). */
  const caixaDe = (f: Camada) => resolver().find((l) => l.id === f.id) ?? f
  const altura = (f: Camada) => caixaDe(f).height
  const fimDe = (f: Camada) => { const b = caixaDe(f); return b.y + b.height }
  /** Coloca um frame (os filhos seguem pelo auto layout). */
  const colocar = (f: Camada, x: number, y: number) => { f.x = Math.round(x); f.y = Math.round(y) }
  const filhos = (f: Camada) => L.filter((l) => l.parentId === f.id && !l.absolute)
  /** Abre o gap de um frame para ocupar a altura disponível (até `maxGap`), como uma lista que respira na tela. */
  const espalhar = (f: Camada, disp: number, maxGap: number) => {
    const n = filhos(f).length
    const lay = layoutDe(f)
    const sobra = disp - altura(f)
    if (sobra <= 0) return
    if (lay.direction === 'wrap') {
      const linhas = new Set(resolver().filter((l) => l.parentId === f.id).map((l) => l.y)).size
      if (linhas > 1) lay.rowGap = Math.round(Math.min(maxGap, (lay.rowGap ?? lay.gap) + sobra / (linhas - 1)))
    } else if (n > 1) lay.gap = Math.round(Math.min(maxGap, lay.gap + sobra / (n - 1)))
  }
  /** Iguala a altura de frames irmãos (cartões de uma grade) pela maior, depois do auto layout. */
  const igualar = (fs: Camada[], min = 0) => {
    if (!fs.length) return 0
    const r = resolver()
    const hMax = Math.max(min, ...fs.map((f) => r.find((l) => l.id === f.id)?.height ?? f.height))
    for (const f of fs) { f.sizingH = 'fixed'; f.height = Math.round(hMax) }
    return hMax
  }
  /** Grade de auto layout (wrap): `cols` células de largura igual por linha, cada linha abraça a mais alta. */
  const gradeAL = (papel: string, x: number, y: number, w: number, cols: number, gap: number, rowGap = gap, alX: Alin = 'start') => {
    const g = frame(papel, x, y, w, 1, { dir: 'wrap', gap, rowGap, alX })
    return { g, cw: Math.floor((w - (cols - 1) * gap) / cols) }
  }
  /** Posiciona um frame na área de conteúdo: um pouco acima do centro, como na grade de um editorial. */
  const assentar = (f: Camada, y0: number, fim = fimConteudo, k = 0.42) => { const h = altura(f); colocar(f, f.x, y0 + Math.max(0, (fim - y0 - h) * k)); return h }

  /** Tamanhos da lista cuja linha (com a folga da caixa) cabe em `alt` px; nenhum = o menor. */
  const ateAltura = (lista: number[], alt: number, lh = 1.42) => { const ok = lista.filter((t) => Math.ceil(t * lh + t * 0.12) <= alt); return ok.length ? ok : [Math.max(12, Math.floor(alt / (lh + 0.12)))] }
  const rotuloCor = s.tipo === 'acento' ? s.tinta : contraste(forte, s.fundo) >= 3 ? forte : s.suave
  /** Rótulo acima do título, no jeito do estilo: mono, pílula de cor, fio + mono ou itálico na fonte do título. */
  const kicker = (txt0: string, x: number, y: number, w: number, align: 'left' | 'center' | 'right' = 'left', pai?: string) => {
    const txt = txt0.trim()
    if (!txt) return null
    const tam = st ? 24 : 20
    if (R.rotulo === 'pilula') {
      const fundoP = s.tipo === 'acento' ? s.tinta : forte
      const pad = st ? 12 : 10
      const larg = Math.min(w, Math.round(txt.length * tam * 0.66 + tam * 0.6 + pad * 2.4))
      const xp = align === 'center' ? x + (w - larg) / 2 : align === 'right' ? x + w - larg : x
      return texto('rotulo', txt, { x: xp, y, w: larg, fonte: 'mono', tamanhos: [tam], max: 1, upper: true, tracking: -0.12, align: 'center', cor: legivel(fundoP, [s.fundo, '#FFFFFF', '#141414'], 4.5), anim: animTexto(0), hMin: Math.round(tam * 1.3 + pad * 2 + 2), pai, extra: { background: fundoP, padding: pad, radius: 999 } })
    }
    if (R.rotulo === 'italico') return texto('rotulo', txt, { x, y, w, fonte: 'titulo', tamanhos: [st ? 38 : 32], max: 1, italic: true, upper: false, peso: 400, tracking: 0, cor: rotuloCor, align, anim: animTexto(0), pai, fill: !!pai })
    if (R.rotulo === 'fio') {
      // fio + rótulo numa coluna própria (o fio acima, 14 px de vão)
      const lw = st ? 64 : 56
      const g = frame('grupo-rotulo', x, y, w, 1, { gap: 14, alX: align === 'center' ? 'center' : align === 'right' ? 'end' : 'start', pai, w: pai ? 'fill' : 'fixed' })
      linha(x, y, lw, 3, s.tipo === 'acento' ? s.tinta : forte, { parentId: g.id, enterAnimation: { type: 'reveal', duration: dur(600), delay: 0, easing: 'easeOut' } })
      const r = texto('rotulo', txt, { x, y: y + 17, w, fonte: 'mono', tamanhos: [tam], max: 1, upper: true, tracking: -0.14, cor: rotuloCor, align, anim: animTexto(0), pai: g.id, fill: true })
      return { ...r, fim: y + 17 + r.h }
    }
    return texto('rotulo', txt, { x, y, w, fonte: 'mono', tamanhos: [tam], max: 1, upper: true, tracking: -0.14, cor: rotuloCor, align, anim: animTexto(0), pai, fill: !!pai })
  }

  /**
   * Título com o trecho final em destaque. O texto do schema não tem trechos com cor própria, então as duas partes
   * vão empilhadas num frame de auto layout com gap 0 (caixas justas, uma embaixo da outra, sem sobrepor), ou
   * num texto só quando não há ênfase. Dentro de `pai`, o título ocupa a largura do frame.
   */
  const tituloEnfase = (txt: string, o0: Omit<OpTexto, 'tamanhos'> & { tamanhos: number[] }) => {
    const o = { ...o0, tamanhos: escalar(o0.tamanhos), escalado: true }
    const partesEnfase = c.estilo !== 'minimal' ? dividirEnfase(txt, d.enfase) : null
    if (!partesEnfase) return texto('titulo', txt, { fonte: 'titulo', anim: animTitulo(), fill: !!o.pai, ...o })
    const fonte = familia('titulo')
    const max = o.max ?? 3
    const linhasEm = (n: number) => caber(partesEnfase[0], fonte, o.w, [n], max, { tracking: F.tracking, peso: F.pesoTitulo, maiusculas: R.caixaAlta }).linhas + caber(partesEnfase[1], fonte, o.w, [n], max, { tracking: F.tracking, peso: F.pesoTitulo, maiusculas: R.caixaAlta }).linhas
    const tam = o.tamanhos.find((n) => linhasEm(n) <= max && (!o.hMax || n * 1.04 * linhasEm(n) <= o.hMax)) ?? o.tamanhos[o.tamanhos.length - 1]!
    const al = o.align === 'center' ? 'center' : o.align === 'right' ? 'end' : 'start'
    const g = frame('grupo-titulo', o.x, o.y, o.w, 1, { gap: 0, alX: al, pai: o.pai, w: o.pai ? 'fill' : 'fixed' })
    // o nome (morph da capa) fica só na primeira parte
    const semNome = { ...o.extra }
    delete semNome.name
    const a = texto('titulo', partesEnfase[0], { fonte: 'titulo', anim: animTitulo(), ...o, tamanhos: [tam], max: 9, pai: g.id, fill: true, justo: true })
    const corB = s.tipo === 'acento' ? s.tinta : contraste(forte, s.fundo) >= 2.4 ? forte : s.tinta
    const b = texto('enfase', partesEnfase[1], { fonte: 'titulo', anim: animTitulo(150), ...o, extra: semNome, tamanhos: [tam], max: 9, cor: corB, italic: F.italicoCitacao && s.tipo !== 'acento' && !R.caixaAlta ? true : o.italic, pai: g.id, fill: true })
    return { l: g, h: a.h + b.h, tamanho: tam, linhas: a.linhas + b.linhas, fim: o.y + a.h + b.h }
  }

  /** Bloco de título: rótulo + título (com ênfase) + texto de apoio numa coluna de auto layout. */
  interface OpBloco {
    x: number; y: number; w: number
    rotulo?: string | null
    tamanhos: number[]
    max?: number
    hMax?: number
    align?: 'left' | 'center'
    texto?: { w?: number; tamanhos: number[]; max?: number; cor?: string } | null
    gapRotulo?: number
    gapTexto?: number
    pai?: string
    extraTitulo?: Record<string, unknown>
    /** Fio entre o título e o texto (seção minimal). */
    fio?: boolean
    /** Título como texto simples (sem ênfase). */
    simples?: boolean
    italico?: boolean
    tracking?: number
    lh?: number
  }
  const bloco = (o: OpBloco): Camada => {
    const al = o.align ?? 'left'
    const alX: Alin = al === 'center' ? 'center' : 'start'
    const b = frame('bloco', o.x, o.y, o.w, 1, { gap: o.gapTexto ?? (st ? 32 : 26), alX, pai: o.pai })
    const temRotulo = !!o.rotulo?.trim()
    const cab = temRotulo ? frame('cabecalho', o.x, o.y, o.w, 1, { gap: o.gapRotulo ?? (st ? 22 : 18), alX, pai: b.id, w: 'fill' }) : b
    if (temRotulo) kicker(o.rotulo!, o.x, o.y, o.w, al, cab.id)
    if (o.simples) texto('titulo', d.titulo, { x: o.x, y: o.y, w: o.w, fonte: 'titulo', tamanhos: o.tamanhos, max: o.max ?? 3, hMax: o.hMax, align: al, anim: animTitulo(), pai: cab.id, fill: true, italic: o.italico, tracking: o.tracking, lh: o.lh, extra: o.extraTitulo })
    else tituloEnfase(d.titulo, { x: o.x, y: o.y, w: o.w, tamanhos: o.tamanhos, max: o.max ?? 3, hMax: o.hMax, align: al, pai: cab.id, extra: o.extraTitulo })
    if (o.fio) linha(o.x, o.y, o.w, 2, s.linha, { parentId: b.id, sizingW: 'fill', enterAnimation: { type: 'reveal', duration: dur(900), delay: 200, easing: 'easeOut' } })
    if (o.texto && d.texto) {
      const tw = Math.min(o.texto.w ?? o.w, o.w)
      texto('texto', d.texto, { x: o.x, y: o.y, w: tw, tamanhos: o.texto.tamanhos, max: o.texto.max ?? 3, cor: o.texto.cor ?? s.suave, align: al, pai: b.id, fill: tw >= o.w })
    }
    return b
  }

  /**
   * Espaço para imagem: frame listrado (fixo) com a descrição sugerida no pé, ou a foto da pessoa. Dentro de um
   * frame de auto layout (`pai`), entra no fluxo com o tamanho dado.
   */
  const espacoImagem = (x: number, y: number, w: number, h: number, descricao: string, raio = 0, pai?: string) => {
    // fotos da pessoa (enviadas antes de gerar) ocupam os espaços de imagem na ordem das telas, sem custo de IA
    const foto = proximaFoto()
    const caixaImg = { x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) }
    if (foto) {
      const l: Camada = { id: c.uid('foto'), type: 'image', assetId: foto.assetId, fit: 'cover', radius: raio, ...caixaImg, ...(pai ? { parentId: pai } : {}), ariaLabel: (foto.legenda || descricao || 'Foto').slice(0, 200), enterAnimation: { type: 'fadeIn', duration: dur(700), delay: 100, easing: 'easeOut' } }
      L.push(l)
      return l
    }
    const base = s.tipo === 'escuro' ? misturar(s.fundo, s.tinta, 0.1) : misturar(s.fundo, s.tinta, 0.13)
    const pad = st ? 36 : 32
    const f = frame('imagem', x, y, w, h, { h: 'fixed', alY: 'end', pad: { top: pad, right: pad, bottom: Math.max(16, (st ? 84 : 72) - (st ? 44 : 36)), left: pad }, pai, extra: { radius: raio, clip: true, ariaLabel: `Espaço para imagem${descricao ? `: ${descricao}` : ''}`, enterAnimation: { type: 'fadeIn', duration: 700, delay: 100, easing: 'easeOut' } } })
    // as listras ficam atrás, fora do fluxo (absolutas), do tamanho do espaço
    forma('listras', 'rect', x, y, w, h, { parentId: f.id, absolute: true, fill: base, pattern: 'stripes', radius: raio, enterAnimation: { type: 'fadeIn', duration: 700, delay: 100, easing: 'easeOut' } })
    const leg = `▢  ${descricao.trim() || 'arraste sua imagem aqui'}`
    texto('legenda', leg.slice(0, 90), { x: x + pad, y: y + h - (st ? 84 : 72), w: Math.max(120, w - pad * 2), fonte: 'mono', tamanhos: [st ? 22 : 18, 16], max: 2, cor: legivel(base, [s.suave, s.tinta], 3), anim: null, pai: f.id, fill: true })
    return f
  }

  // ---------- motivo do tema ----------
  const formaMotivo = t.raio === 0 ? 'rect' : t.raio >= 40 || t.id === 'argila' || t.id === 'ipe' ? 'ellipse' : 'semicircle'
  const corMotivo = s.tipo === 'acento' ? legivel(s.fundo, [t.acento2, s.tinta], 1.6) : s.tipo === 'escuro' ? legivel(s.fundo, [t.acento, t.acento2], 2) : legivel(s.fundo, [t.acento, t.acento2], 1.8)
  /** Segunda e terceira cores dos motivos com várias formas (bolhas, confete, sol). */
  const cor2 = legivel(s.fundo, [corMotivo === t.acento2 ? t.acento : t.acento2, s.tinta], 1.4)
  const cor3 = legivel(s.fundo, [misturar(t.acento, '#FFD23F', 0.6), misturar(t.acento2, '#FFD23F', 0.5), s.tinta], 1.3)
  /** Motivo grande numa área livre (capa, seção, ideia central). `nome: 'motivo'` casa as telas na transição morph. */
  const motivo = (x: number, y: number, w: number, h: number, intensidade: 'pequeno' | 'grande' = 'grande') => {
    if (!decorar) return
    const lado = Math.min(w, h)
    switch (t.motivo) {
      case 'formas': {
        const shape = formaMotivo
        const alt = shape === 'semicircle' ? lado / 2 : lado
        forma('motivo', shape, x + (w - lado) / 2, y + (h - alt) / 2, lado, alt, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
        if (marcante && intensidade === 'grande') {
          const k = lado * 0.34
          forma('forma', 'triangle', x + (w - lado) / 2 - k * 0.3, y + (h + alt) / 2 - k * 0.9, k, k, { fill: legivel(s.fundo, [t.acento2, s.tinta], 1.5), rotation: -12, enterAnimation: animForma(300) })
        }
        break
      }
      case 'linhas': {
        const n = intensidade === 'grande' ? 5 : 3
        for (let k = 0; k < n; k++) forma(k === 0 ? 'motivo' : 'fio', 'rect', x, y + (k * h) / n, w * (1 - k * 0.12), 2, { ...(k === 0 ? { name: 'motivo' } : {}), fill: k === 0 ? corMotivo : s.linha, enterAnimation: { type: 'reveal', duration: 700, delay: 100 + k * 80, easing: 'easeOut' } })
        break
      }
      case 'grade': {
        // grade de pontos na cor de destaque e um bloco sólido por cima, deslocado
        const passo = intensidade === 'grande' ? (st ? 54 : 48) : 36
        const cols = Math.max(2, Math.floor(w / passo))
        const lin = Math.max(2, Math.floor(h / passo))
        const ponto = intensidade === 'grande' ? 8 : 6
        for (let i = 0; i < Math.min(lin, 14); i++) for (let j = 0; j < Math.min(cols, 14); j++) {
          if ((i + j) % 2 === 1 && intensidade !== 'grande') continue
          forma('ponto', 'ellipse', x + j * passo, y + i * passo, ponto, ponto, { fill: corMotivo, opacity: 0.55, enterAnimation: { type: 'fadeIn', duration: 500, delay: Math.min(1800, 60 + (i + j) * 30), easing: 'easeOut' } })
        }
        const bloco = lado * 0.52
        forma('motivo', t.raio >= 18 ? 'ellipse' : 'rect', x + w - bloco - passo * 0.5, y + h - bloco - passo * 0.5, bloco, bloco, { name: 'motivo', fill: corMotivo, radius: Math.min(t.raio, 24), enterAnimation: animForma(300) })
        break
      }
      case 'brilho':
        forma('motivo', 'ellipse', x, y, w, h, { name: 'motivo', fill: corMotivo, opacity: s.tipo === 'escuro' ? 0.5 : 0.3, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: 1200, delay: 0, easing: 'easeOut' } })
        break
      case 'vidro': {
        // duas luzes coloridas desfocadas, sobrepostas (o "vidro" dos cartões aparece sobre elas)
        forma('motivo', 'ellipse', x, y, w * 0.78, h * 0.78, { name: 'motivo', fill: corMotivo, opacity: s.tipo === 'escuro' ? 0.6 : 0.4, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: dur(1200), delay: 0, easing: 'easeOut' } })
        forma('forma', 'ellipse', x + w * 0.32, y + h * 0.3, w * 0.68, h * 0.68, { fill: cor2, opacity: s.tipo === 'escuro' ? 0.55 : 0.35, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: dur(1400), delay: 200, easing: 'easeOut' } })
        break
      }
      case 'manchas': {
        // formas orgânicas: elipses giradas e sobrepostas, sem contorno
        const a = lado
        forma('motivo', 'ellipse', x + (w - a) / 2, y + (h - a * 0.82) / 2, a, a * 0.82, { name: 'motivo', fill: corMotivo, rotation: -18, enterAnimation: animForma() })
        forma('forma', 'ellipse', x + (w - a) / 2 + a * 0.46, y + (h - a * 0.82) / 2 + a * 0.44, a * 0.56, a * 0.44, { fill: cor2, rotation: 24, enterAnimation: animForma(240) })
        if (intensidade === 'grande') forma('forma', 'ellipse', x + (w - a) / 2 - a * 0.06, y + (h - a * 0.82) / 2 - a * 0.04, a * 0.3, a * 0.24, { fill: misturar(corMotivo, s.fundo, 0.45), rotation: 30, enterAnimation: animForma(380) })
        break
      }
      case 'bolhas': {
        const a = lado
        forma('motivo', 'ellipse', x + (w - a) / 2 + a * 0.1, y + (h - a) / 2 + a * 0.08, a * 0.66, a * 0.66, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
        forma('forma', 'ellipse', x + (w - a) / 2 + a * 0.6, y + (h - a) / 2 + a * 0.52, a * 0.38, a * 0.38, { fill: cor2, enterAnimation: animForma(200) })
        forma('forma', 'ellipse', x + (w - a) / 2, y + (h - a) / 2 + a * 0.7, a * 0.18, a * 0.18, { fill: cor3, enterAnimation: animForma(320) })
        forma('forma', 'star', x + (w - a) / 2 + a * 0.66, y + (h - a) / 2, a * 0.26, a * 0.26, { fill: cor3, count: 5, ratio: 0.48, rotation: 12, enterAnimation: animForma(420) })
        break
      }
      case 'confete': {
        // Memphis: triângulo, anel, pontos, zigue-zague e um bloco, espalhados na área
        const a = lado
        const x0 = x + (w - a) / 2
        const y0 = y + (h - a) / 2
        forma('motivo', 'ellipse', x0 + a * 0.12, y0 + a * 0.1, a * 0.46, a * 0.46, { name: 'motivo', fill: alfa(corMotivo, 0), stroke: corMotivo, strokeWidth: Math.max(8, a * 0.045), enterAnimation: animForma() })
        forma('forma', 'triangle', x0 + a * 0.56, y0 + a * 0.04, a * 0.3, a * 0.27, { fill: cor2, rotation: 14, enterAnimation: animForma(160) })
        forma('forma', 'rect', x0 + a * 0.5, y0 + a * 0.5, a * 0.42, a * 0.3, { fill: cor3, pattern: 'dots', rotation: -6, enterAnimation: animForma(260) })
        const zw = a * 0.56
        const zh = a * 0.14
        const nos = Array.from({ length: 7 }, (_, k) => ({ x: (k * zw) / 6, y: k % 2 ? zh : 0, tipo: 'canto' as const }))
        forma('forma', 'path', x0 + a * 0.02, y0 + a * 0.76, zw, zh, { fill: alfa(s.tinta, 0), stroke: s.tipo === 'escuro' ? s.tinta : misturar(s.tinta, corMotivo, 0.2), strokeWidth: Math.max(6, a * 0.03), vetor: { w: zw, h: zh, caminhos: [{ nos, fechado: false, semPreenchimento: true }], fillRule: 'nonzero' }, enterAnimation: animForma(360) })
        forma('forma', 'ellipse', x0 + a * 0.84, y0 + a * 0.84, a * 0.1, a * 0.1, { fill: corMotivo, enterAnimation: animForma(440) })
        break
      }
      case 'sol': {
        // retrô: sol de faixas concêntricas assentado na base da área
        const a = Math.min(w, h * 2)
        const base = y + (h + a / 2) / 2
        const cores = [corMotivo, cor3, cor2]
        ;[1, 0.74, 0.48].forEach((k, i) => forma(i === 0 ? 'motivo' : 'forma', 'semicircle', x + (w - a * k) / 2, base - (a * k) / 2, a * k, (a * k) / 2, { ...(i === 0 ? { name: 'motivo' } : {}), fill: cores[i]!, enterAnimation: { type: 'slideUp', duration: dur(800), delay: 100 + i * 140, easing: 'spring' } }))
        if (intensidade === 'grande') linha(x + (w - a) / 2, base + a * 0.04, a, Math.max(6, a * 0.02), cor2, { enterAnimation: { type: 'reveal', duration: dur(700), delay: 500, easing: 'easeOut' } })
        break
      }
      case 'moldura':
        // luxo: moldura fina em volta da tela (a mesma em todas as telas: morph sem movimento) e um losango
        moldura()
        if (intensidade === 'grande') forma('forma', 'rect', x + w / 2 - 14, y + h / 2 - 14, 28, 28, { fill: alfa(corMotivo, 0), stroke: corMotivo, strokeWidth: 2, rotation: 45, enterAnimation: animForma(300) })
        break
      case 'blocos': {
        // blocos chapados: um cheio e um contorno deslocado (startup, brutalista)
        const a = lado
        const x0 = x + (w - a) / 2
        const y0 = y + (h - a) / 2
        forma('motivo', 'rect', x0 + a * 0.08, y0 + a * 0.08, a * 0.84, a * 0.7, { name: 'motivo', fill: corMotivo, radius: Math.min(t.raio, 28), enterAnimation: animForma() })
        forma('forma', 'rect', x0, y0 + a * 0.3, a * 0.84, a * 0.7, { fill: alfa(s.fundo, 0), stroke: s.tipo === 'acento' ? s.tinta : misturar(s.tinta, s.fundo, 0.1), strokeWidth: Math.max(3, R.borda), radius: Math.min(t.raio, 28), enterAnimation: animForma(200) })
        if (intensidade === 'grande') forma('forma', 'ellipse', x0 + a * 0.72, y0, a * 0.24, a * 0.24, { fill: cor2, enterAnimation: animForma(320) })
        break
      }
    }
  }
  /** Moldura fina em volta da tela (luxo). */
  function moldura() {
    const ins = st ? 36 : 40
    forma('motivo', 'rect', ins, ins, W - ins * 2, H - ins * 2, { name: 'motivo', fill: alfa(s.fundo, 0), stroke: alfa(corMotivo, 0.75), strokeWidth: 2, enterAnimation: { type: 'fadeIn', duration: dur(1200), delay: 0, easing: 'easeOut' } })
  }
  /** Marca discreta do motivo no canto das telas de conteúdo. */
  const motivoCanto = () => {
    if (!decorar) return
    const tam = st ? 84 : 72
    const xc0 = W - M - tam
    const yc0 = MT - 8
    switch (t.motivo) {
      case 'linhas': return void forma('motivo', 'rect', W - M - tam, MT + 6, tam, 6, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
      case 'brilho': return void forma('motivo', 'ellipse', W - (st ? 420 : 560), -(st ? 260 : 300), st ? 640 : 820, st ? 640 : 820, { name: 'motivo', fill: corMotivo, opacity: s.tipo === 'escuro' ? 0.32 : 0.16, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: 1200, delay: 0, easing: 'easeOut' } })
      case 'vidro':
        // a malha de luzes já está no fundo; no canto, só um ponto de luz
        if (R.fundo === 'malha') return void forma('motivo', 'ellipse', xc0 + tam * 0.4, yc0 + 4, tam * 0.5, tam * 0.5, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
        return void forma('motivo', 'ellipse', W - (st ? 420 : 560), -(st ? 260 : 300), st ? 640 : 820, st ? 640 : 820, { name: 'motivo', fill: corMotivo, opacity: s.tipo === 'escuro' ? 0.4 : 0.22, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: 1200, delay: 0, easing: 'easeOut' } })
      case 'grade': {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) forma('ponto', 'ellipse', W - M - 6 - j * 22, MT + 2 + i * 22, 6, 6, { fill: corMotivo, opacity: 0.6, enterAnimation: { type: 'fadeIn', duration: 400, delay: 80 + (i + j) * 40, easing: 'easeOut' } })
        return void forma('motivo', 'rect', W - M - 6 - 3 * 22 - 34, MT + 2, 20, 20, { name: 'motivo', fill: corMotivo, radius: Math.min(t.raio, 6), enterAnimation: animForma() })
      }
      case 'manchas':
        forma('motivo', 'ellipse', xc0, yc0, tam, tam * 0.8, { name: 'motivo', fill: corMotivo, rotation: -18, enterAnimation: animForma() })
        return void forma('forma', 'ellipse', xc0 + tam * 0.5, yc0 + tam * 0.45, tam * 0.5, tam * 0.4, { fill: cor2, rotation: 24, enterAnimation: animForma(200) })
      case 'bolhas':
        forma('motivo', 'ellipse', xc0 + tam * 0.3, yc0, tam * 0.7, tam * 0.7, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
        forma('forma', 'ellipse', xc0, yc0 + tam * 0.45, tam * 0.36, tam * 0.36, { fill: cor2, enterAnimation: animForma(160) })
        return void forma('forma', 'star', xc0 - tam * 0.42, yc0 - 4, tam * 0.34, tam * 0.34, { fill: cor3, count: 5, ratio: 0.48, enterAnimation: animForma(260) })
      case 'confete':
        forma('motivo', 'triangle', xc0 + tam * 0.4, yc0, tam * 0.6, tam * 0.54, { name: 'motivo', fill: cor2, rotation: 14, enterAnimation: animForma() })
        forma('forma', 'ellipse', xc0 - tam * 0.12, yc0 + tam * 0.2, tam * 0.46, tam * 0.46, { fill: alfa(corMotivo, 0), stroke: corMotivo, strokeWidth: 7, enterAnimation: animForma(140) })
        return void forma('forma', 'ellipse', xc0 + tam * 0.2, yc0 + tam * 0.72, tam * 0.16, tam * 0.16, { fill: cor3, enterAnimation: animForma(240) })
      case 'sol':
        ;[1, 0.66, 0.34].forEach((k, i) => forma(i === 0 ? 'motivo' : 'forma', 'semicircle', xc0 + (tam * (1 - k)) / 2, yc0 + tam * 0.5 - (tam * k) / 2 + tam * 0.1, tam * k, (tam * k) / 2, { ...(i === 0 ? { name: 'motivo' } : {}), fill: [corMotivo, cor3, cor2][i]!, enterAnimation: animForma(i * 120) }))
        return
      case 'moldura': return void moldura()
      case 'blocos':
        forma('motivo', 'rect', xc0 + tam * 0.25, yc0, tam * 0.75, tam * 0.5, { name: 'motivo', fill: corMotivo, radius: Math.min(t.raio, 10), enterAnimation: animForma() })
        return void forma('forma', 'rect', xc0, yc0 + tam * 0.2, tam * 0.75, tam * 0.5, { fill: alfa(s.fundo, 0), stroke: s.tipo === 'acento' ? s.tinta : misturar(s.tinta, s.fundo, 0.1), strokeWidth: Math.max(2, R.borda * 0.75), radius: Math.min(t.raio, 10), enterAnimation: animForma(140) })
      case 'nenhum': return
      default: {
        const alt = formaMotivo === 'semicircle' ? tam / 2 : tam
        forma('motivo', formaMotivo, W - M - tam, MT - 8, tam, alt, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
      }
    }
  }
  /** Luzes desfocadas atrás de tudo (estilos com fundo "malha", como o vidro). */
  const malha = () => {
    if (R.fundo !== 'malha' || !c.motivos) return
    const k = st ? 0.9 : 1
    forma('luz', 'ellipse', -W * 0.12, H * (st ? 0.05 : 0.18), W * 0.62 * k, W * 0.62 * k, { fill: corMotivo, opacity: s.tipo === 'escuro' ? 0.38 : 0.22, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: dur(1400), delay: 0, easing: 'easeOut' } })
    forma('luz', 'ellipse', W * 0.55, -H * 0.12, W * 0.55 * k, W * 0.55 * k, { fill: cor2, opacity: s.tipo === 'escuro' ? 0.34 : 0.2, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: dur(1600), delay: 100, easing: 'easeOut' } })
  }
  malha()

  // ---------- cartões e logo, no jeito do estilo ----------
  /** Preenchimento, contorno e efeitos de um cartão/caixa: cheio, contorno, vidro ou sombra dura deslocada. */
  const cartao = (dest: boolean, base: string = s.cartao): Record<string, unknown> => {
    const tintaBorda = s.tipo === 'acento' ? s.tinta : misturar(s.tinta, s.fundo, 0.08)
    switch (R.cartao) {
      case 'contorno':
        return dest ? { fill: forte } : { fill: alfa(s.fundo, 0), stroke: s.tipo === 'escuro' ? misturar(s.linha, s.tinta, 0.4) : misturar(s.linha, s.tinta, 0.5), strokeWidth: R.borda }
      case 'sombra': {
        const corSombra = t.motivo === 'confete' ? legivel(s.fundo, [t.acento2, s.tinta], 1.6) : tintaBorda
        return { fill: dest ? forte : s.tipo === 'escuro' ? misturar(s.fundo, s.tinta, 0.08) : misturar(s.fundo, '#FFFFFF', 0.7), stroke: tintaBorda, strokeWidth: R.borda, effects: { shadows: [{ x: R.borda * 3, y: R.borda * 3, blur: 0, spread: 0, color: corSombra }], blur: 0, backdropBlur: 0, blend: 'normal' } }
      }
      case 'vidro':
        return { fill: dest ? alfa(forte, 0.88) : alfa(s.tinta, s.tipo === 'escuro' ? 0.07 : 0.05), stroke: alfa(s.tinta, dest ? 0.4 : 0.2), strokeWidth: R.borda, effects: { blur: 0, backdropBlur: 24, blend: 'normal' } }
      default:
        return { fill: dest ? forte : base }
    }
  }
  /**
   * Logo da marca numa caixa (contém o arquivo, sem distorcer). Se a cor média do logo some no fundo, ele vira
   * silhueta: branca no fundo escuro, preta no claro. Nada disso usa IA.
   */
  const logo = (x: number, y: number, maxW: number, maxH: number, align: 'left' | 'center' | 'right' = 'left', papel = 'logo') => {
    const lg = c.logo
    if (!lg || lg.largura <= 0 || lg.altura <= 0) return null
    const prop = lg.largura / lg.altura
    let h = maxH
    let w = h * prop
    if (w > maxW) { w = maxW; h = w / prop }
    const xl = align === 'center' ? x + (maxW - w) / 2 : align === 'right' ? x + maxW - w : x
    const apaga = contraste(lg.cor, s.fundo) < 2
    const escuroAtras = luminanciaRelativa(s.fundo) < 0.3
    const l: Camada = {
      id: c.uid(papel), type: 'image', assetId: lg.assetId, fit: 'contain', name: papel === 'logo' ? 'logo' : 'logo-rodape',
      x: Math.round(xl), y: Math.round(y + (maxH - h) / 2), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), ariaLabel: c.marca ? `Logo ${c.marca}` : 'Logo',
      ...(apaga ? { adjust: { brightness: 0, contrast: 1, saturate: 1, grayscale: 0, ...(escuroAtras ? { invert: 1 } : {}) } } : {}),
      enterAnimation: animTexto(0),
    }
    L.push(l)
    return l
  }

  // ---------- cabeçalho e rodapé das telas de conteúdo ----------
  const temRodape = !['capa', 'secao', 'conceito', 'encerramento', 'cta', 'paleta', 'tipografia'].includes(d.tipo) && !['imagem.cheia', 'imagem.lateral', 'citacao.grande'].includes(d.variante)
  const fimConteudo = temRodape ? H - MB - (st ? 56 : 40) : H - MB
  /** Rótulo + título + texto num bloco de auto layout. Devolve onde o conteúdo pode começar. */
  const cabecalho = (o: { w?: number; x?: number; tamanhos?: number[]; max?: number; semTexto?: boolean; textoW?: number; y?: number } = {}) => {
    const x = o.x ?? M
    const w = o.w ?? (centro ? W - M * 2 : st ? W - M * 2 : wc(9))
    const b = bloco({
      x, y: o.y ?? MT, w, rotulo: d.rotulo, tamanhos: o.tamanhos ?? [88, 80, 72, 64, 56], max: o.max ?? (st ? 3 : 2), align: centro ? 'center' : 'left',
      texto: o.semTexto ? null : { w: o.textoW ?? (st ? w : wc(8)), tamanhos: st ? [38, 34] : [32, 29], max: 3 }, gapTexto: st ? 28 : 22,
    })
    return fimDe(b) + (st ? 72 : 56)
  }
  const rodape = () => {
    const tam = st ? 22 : 16
    const esquerda = (c.marca || c.tituloProjeto).slice(0, 48)
    const y = H - MB + (st ? 40 : 34)
    if (R.rodape === 'nenhum') return
    if (R.rodape === 'fio') linha(M, y - (st ? 22 : 18), W - M * 2, 1.5, s.linha, { name: 'fio-rodape' })
    // logo discreto no rodapé (quando pedido) no lugar do nome
    const logoRodape = c.logo?.rodape ? logo(M, y - 6, st ? 220 : 180, st ? 40 : 30, 'left', 'logo-rodape') : null
    if (!logoRodape && esquerda) texto('rodape', esquerda, { x: M, y, w: W / 2, fonte: 'mono', tamanhos: [tam], max: 1, cor: s.suave, opacity: 0.8, anim: null, extra: { name: 'rodape' } })
    texto('pagina', `${String(c.numero).padStart(2, '0')} / ${String(c.total).padStart(2, '0')}`, { x: W - M - 200, y, w: 200, fonte: 'mono', tamanhos: [tam], max: 1, cor: s.suave, opacity: 0.8, align: 'right', anim: null, extra: { name: 'pagina' } })
  }

  const itens = d.itens.filter((i) => i.trim())
  const ehDestaque = (k: number) => d.destaque === k
  /** Avatar redondo com as iniciais centradas (frame com auto layout). */
  const avatar = (pai: string | undefined, x: number, y: number, dia: number, fill: string, corIniciais: string, nome: string, anim: Record<string, unknown>) => {
    const a = frame('avatar', x, y, dia, dia, { h: 'fixed', alX: 'center', alY: 'center', pai, extra: { fill, radius: Math.round(dia / 2), enterAnimation: anim } })
    texto('iniciais', iniciais(nome), { x, y, w: dia, fonte: 'titulo', tamanhos: [Math.max(16, Math.round(dia * 0.36))], max: 1, align: 'center', cor: corIniciais, anim: null, pai: a.id, lh: 1.1 })
    return a
  }
  /** Aspas grandes da citação: caixa da altura do sinal (não da linha inteira), para não invadir a frase. */
  const aspas = (pai: string, tam: number) => texto('aspas', '“', { x: 0, y: 0, w: Math.round(tam * 0.9), fonte: 'titulo', tamanhos: [tam], max: 1, lh: 0.62, cor: forte, peso: 400, anim: animForma(0), pai, justo: true })

  switch (d.variante) {
    // ================================================================ capa
    case 'capa.classica':
    case 'capa.tipografica':
    default: {
      if (d.tipo !== 'capa' && d.variante !== 'capa.classica' && d.variante !== 'capa.tipografica') {
        // variante desconhecida: cai no layout da ideia central
        return montarTela({ ...d, variante: 'conceito.frase' }, c, interno)
      }
      const tipografica = d.variante === 'capa.tipografica'
      const direita = !tipografica && !c.reservarDireita
      const imagemDireita = direita && c.placeholders
      // no story com imagem em cima, o rótulo desce para o bloco do título (não fica sobre a imagem)
      const rotuloNoBloco = st && imagemDireita
      const rotuloCapa = d.rotulo || c.marca || 'Apresentação'
      if (!rotuloNoBloco) kicker(rotuloCapa, M, MT, st ? W - M * 2 - (c.logo ? 360 : 0) : W * 0.5)
      if (imagemDireita) espacoImagem(st ? 0 : W * 0.6, 0, st ? W : W * 0.4, st ? H * 0.42 : H, d.imagem)
      else if (direita) motivo(st ? W * 0.18 : W * 0.63, st ? H * 0.12 : H * 0.12, st ? W * 0.64 : W * 0.3, st ? W * 0.64 : H * 0.76)
      if (tipografica && decorar) linha(M, MT + 52, W - M * 2, 3, corMotivo, { name: 'motivo' })
      const larg = st ? W - M * 2 : tipografica || c.reservarDireita ? (c.reservarDireita ? W * 0.5 : W - M * 2) : imagemDireita ? W * 0.6 - M - 72 : W * 0.55
      const tam = tipografica ? (st ? [170, 150, 130, 110, 96] : [250, 220, 190, 160, 136, 116]) : st ? [168, 148, 128, 112, 96] : [176, 152, 132, 116, 100, 88]
      const topo = rotuloNoBloco ? H * 0.42 + 72 : MT + (tipografica && !st ? 110 : 90)
      const fimBloco = st ? H - MB - 40 : H - MB - 30
      // orçamento de altura: título + apoio cabem entre o topo e o pé
      const hMax = fimBloco - topo - (d.texto ? (st ? 190 : 150) : 0) - (rotuloNoBloco ? 60 : 0)
      const b = bloco({
        x: M, y: topo, w: larg, rotulo: rotuloNoBloco ? rotuloCapa : null, tamanhos: tam, max: 3, hMax, extraTitulo: c.numero === 1 ? { name: 'titulo' } : {},
        texto: { w: st ? W - M * 2 : Math.min(larg, W * 0.5), tamanhos: st ? [42, 38, 34] : [38, 34, 30], max: 2 }, gapTexto: tipografica ? 48 : 36,
      })
      if (!(tipografica && !st)) colocar(b, M, Math.max(topo, fimBloco - altura(b)))
      break
    }
    case 'capa.centrada': {
      const larg = st ? W - M * 2 : W * 0.8
      const x = (W - larg) / 2
      const tam = st ? [130, 112, 96, 84] : [168, 144, 124, 108, 92]
      const b = bloco({
        x, y: 0, w: larg, rotulo: d.rotulo || c.marca || 'Apresentação', tamanhos: tam, max: 3, align: 'center', gapRotulo: 36, gapTexto: 40, extraTitulo: c.numero === 1 ? { name: 'titulo' } : {},
        texto: { w: st ? larg : W * 0.56, tamanhos: st ? [40, 36] : [36, 32, 28], max: 2 },
      })
      const h = altura(b)
      const y = Math.max(MT + (c.logo ? 110 : 60), (H - h) / 2)
      colocar(b, x, y)
      if (decorar) {
        linha(W / 2 - 40, y - 36, 80, 6, corMotivo, { name: 'motivo', radius: 3 })
        if (t.motivo === 'formas') {
          const k = st ? 260 : 300
          forma('forma', formaMotivo, -k * 0.35, H - k * 0.75, k, formaMotivo === 'semicircle' ? k / 2 : k, { fill: corMotivo, opacity: 0.9, enterAnimation: animForma(200) })
          forma('forma', 'ellipse', W - k * 0.55, -k * 0.4, k * 0.8, k * 0.8, { fill: legivel(s.fundo, [t.acento2, s.tinta], 1.5), enterAnimation: animForma(320) })
        }
      }
      break
    }
    case 'capa.dividida': {
      const painelW = st ? W : W * 0.46
      const painelH = st ? H * 0.46 : H
      if (c.placeholders || d.imagem) espacoImagem(0, 0, painelW, painelH, d.imagem)
      else {
        forma('painel', 'rect', 0, 0, painelW, painelH, { fill: s.tipo === 'acento' ? t.escuro.fundo : t.acento, enterAnimation: { type: 'reveal', duration: 900, delay: 0, easing: 'easeOut' } })
        if (decorar) {
          const lado = Math.min(painelW, painelH) * 0.56
          forma('motivo', formaMotivo, (painelW - lado) / 2, (painelH - (formaMotivo === 'semicircle' ? lado / 2 : lado)) / 2, lado, formaMotivo === 'semicircle' ? lado / 2 : lado, { name: 'motivo', fill: legivel(t.acento, [t.acento2, t.sobreAcento], 1.5), enterAnimation: animForma(250) })
        }
      }
      const x = st ? M : W * 0.52
      const larg = st ? W - M * 2 : W * 0.48 - M
      const b = bloco({
        x, y: 0, w: larg, rotulo: d.rotulo || c.marca || 'Apresentação', tamanhos: st ? [120, 104, 92, 80] : [120, 104, 92, 80, 70], max: 4, gapRotulo: 28, gapTexto: 36, extraTitulo: c.numero === 1 ? { name: 'titulo' } : {},
        texto: { tamanhos: st ? [38, 34] : [32, 28], max: 3 },
      })
      const topo = st ? painelH + 90 : MT + (c.logo ? 110 : 40)
      colocar(b, x, st ? topo : Math.max(topo, (H - altura(b)) / 2))
      break
    }

    // ================================================================ agenda
    case 'agenda.lista':
    case 'agenda.colunas': {
      const colunas = d.variante === 'agenda.colunas' && !st && itens.length <= 4
      if (colunas) {
        const y0 = cabecalho()
        const n = Math.max(1, itens.length)
        const { g, cw } = gradeAL('grade', M, y0, W - M * 2, n, GUT)
        itens.forEach((it, k) => {
          const [nome = '', desc = ''] = partes(it)
          const cel = frame('celula', 0, 0, cw, 1, { gap: 18, pai: g.id })
          texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: cw, fonte: 'titulo', tamanhos: [96], max: 1, cor: forte, anim: animItem(k), pai: cel.id, fill: true })
          linha(0, 0, cw, 2, s.linha, { parentId: cel.id, sizingW: 'fill' })
          const grupo = frame('grupo', 0, 0, cw, 1, { gap: 12, pai: cel.id, w: 'fill' })
          texto('item', nome, { x: 0, y: 0, w: cw - 12, fonte: 'titulo', tamanhos: [40, 36, 32], max: 3, anim: animItem(k), pai: grupo.id })
          if (desc) texto('texto', desc, { x: 0, y: 0, w: cw - 12, tamanhos: [26, 24], max: 3, cor: s.suave, anim: animItem(k), pai: grupo.id })
        })
        assentar(g, y0, fimConteudo, 0.2)
      } else {
        const esquerdaW = st ? W - M * 2 : wc(5)
        const b = bloco({ x: M, y: MT, w: esquerdaW, rotulo: d.rotulo, tamanhos: st ? [96, 84, 72] : [96, 84, 72, 64], max: 3, gapTexto: 24, texto: { tamanhos: st ? [36, 32] : [28, 26], max: 4 } })
        const x0 = st ? M : xc(6)
        const larg = st ? W - M * 2 : wc(6)
        const y0 = st ? fimDe(b) + 96 : MT + 96
        const lista = frame('lista', x0, y0, larg, 1, { gap: st ? 28 : 24 })
        const recuo = st ? 130 : 120
        itens.forEach((it, j) => {
          const [nome = '', desc = ''] = partes(it)
          const lin = frame('linha', 0, 0, larg, 1, { dir: 'horizontal', pai: lista.id, w: 'fill' })
          texto('indice', String(j + 1).padStart(2, '0'), { x: 0, y: 0, w: recuo, fonte: 'titulo', tamanhos: [st ? 64 : 56], max: 1, cor: forte, anim: animItem(j), pai: lin.id })
          const col = frame('grupo', 0, 0, larg - recuo, 1, { gap: 6, pad: { top: 6, right: 0, bottom: 0, left: 0 }, pai: lin.id, w: 'fill' })
          texto('item', nome, { x: 0, y: 0, w: larg - recuo, fonte: 'titulo', tamanhos: st ? [48, 44, 40] : [46, 42, 38], max: 2, anim: animItem(j), pai: col.id, fill: true })
          if (desc) texto('texto', desc, { x: 0, y: 0, w: larg - recuo, tamanhos: st ? [30, 28] : [24, 22], max: 2, cor: s.suave, anim: animItem(j), pai: col.id, fill: true })
          if (j < itens.length - 1) linha(0, 0, larg, 2, s.linha, { parentId: lista.id, sizingW: 'fill' })
        })
        espalhar(lista, fimConteudo - y0, st ? 72 : 56)
      }
      break
    }

    // ================================================================ seção
    case 'secao.numero': {
      const num = String(Math.max(1, c.indiceSecao)).padStart(2, '0')
      const tamNum = st ? 300 : 380
      const n = texto('indice', num, { x: M - tamNum * 0.04, y: st ? H * 0.2 : (H - tamNum) / 2 - 20, w: st ? W - M * 2 : tamNum * 1.45, fonte: 'titulo', tamanhos: [tamNum], max: 1, cor: forte, lh: 1, anim: animForma(0) })
      const x = st ? M : M + tamNum * 1.45 + 24
      const larg = st ? W - M * 2 : W - x - M
      const b = bloco({ x, y: 0, w: larg, rotulo: d.rotulo, tamanhos: st ? [110, 96, 84, 72] : [120, 104, 88, 76], max: 3, gapRotulo: 22, gapTexto: 32, texto: { w: Math.min(larg, wc(6)), tamanhos: st ? [38, 34] : [32, 28], max: 3 } })
      colocar(b, x, st ? n.fim + 40 : Math.max(MT, (H - altura(b)) / 2))
      break
    }
    case 'secao.faixa':
    case 'secao.minimal': {
      const minimal = d.variante === 'secao.minimal'
      const larg = minimal ? W - M * 2 : st ? W - M * 2 : wc(10)
      const x = centro ? (W - larg) / 2 : M
      const al = centro ? 'center' : 'left'
      const tam = st ? [120, 104, 90, 78] : minimal ? [120, 104, 88, 76] : [150, 128, 110, 96]
      const b = bloco({
        x, y: 0, w: larg, rotulo: d.rotulo || `Parte ${String(Math.max(1, c.indiceSecao)).padStart(2, '0')}`, tamanhos: tam, max: 3, align: al, gapRotulo: 24, gapTexto: minimal ? 44 : 40, fio: minimal,
        texto: { w: Math.min(larg, st ? larg : wc(7)), tamanhos: st ? [38, 34] : [32, 28], max: 3 },
      })
      colocar(b, x, Math.max(MT, (H - altura(b)) / 2))
      if (!minimal) motivo(st ? W * 0.55 : W * 0.78, st ? H * 0.06 : H * 0.08, st ? W * 0.4 : W * 0.18, st ? W * 0.4 : W * 0.18, 'pequeno')
      break
    }

    // ================================================================ ideia central
    case 'conceito.frase':
    case 'conceito.enfase': {
      const enf = d.variante === 'conceito.enfase' || centro
      const larg = st ? W - M * 2 : enf ? W * 0.8 : W * 0.76
      const x = enf ? (W - larg) / 2 : M
      const al = enf ? 'center' : 'left'
      const tam = st ? [124, 108, 94, 82, 72] : [112, 100, 88, 76, 66, 58]
      if (!enf) motivo(st ? W * 0.62 : W * 0.8, st ? H * 0.05 : MT - 10, st ? W * 0.28 : W * 0.12, st ? W * 0.28 : W * 0.12, 'pequeno')
      const b = bloco({ x, y: 0, w: larg, rotulo: d.rotulo, tamanhos: tam, max: 4, align: al, gapRotulo: 24, gapTexto: st ? 56 : 48, texto: { w: st ? larg : W * 0.56, tamanhos: st ? [44, 40, 36] : [34, 30], max: 4 } })
      const h = altura(b)
      const y = enf ? (H - h) / 2 : st ? H * 0.3 - 64 : Math.min(H * 0.3 - 64, (H - h) / 2 - 60)
      colocar(b, x, Math.max(MT, y))
      break
    }
    case 'conceito.lateral': {
      if (st) return montarTela({ ...d, variante: 'conceito.frase' }, c, interno)
      const esquerdaW = wc(7)
      const b = bloco({ x: M, y: 0, w: esquerdaW, rotulo: d.rotulo, tamanhos: [100, 88, 76, 66, 58], max: 5, gapRotulo: 22 })
      const hB = altura(b)
      const yB = Math.max(MT, (H - hB) / 2 - 20)
      colocar(b, M, yB)
      const xd = xc(8)
      // fio vertical (preenche a altura) + texto, lado a lado
      const lado = frame('lateral', xd, yB, W - M - xd, 1, { dir: 'horizontal', gap: 45 })
      linha(0, 0, 3, 1, forte, { parentId: lado.id, sizingH: 'fill', enterAnimation: { type: 'reveal', duration: 800, delay: 200, easing: 'easeOut' } })
      if (d.texto) texto('texto', d.texto, { x: 0, y: 0, w: W - M - xd - 48, tamanhos: [34, 30, 28], max: 8, cor: s.suave, pai: lado.id })
      else lado.sizingH = 'fixed'
      if (!d.texto) lado.height = Math.max(120, hB)
      break
    }

    // ================================================================ lista
    case 'lista.numerada': {
      const listaNum = (x0: number, y0: number, larg: number, recuo: number, tamNum: number, tamTexto: number[], maxGap: number) => {
        const lista = frame('lista', x0, y0, larg, 1, { gap: st ? 28 : 24 })
        itens.forEach((it, k) => {
          const lin = frame('linha', 0, 0, larg, 1, { dir: 'horizontal', pai: lista.id, w: 'fill' })
          const marca = frame('grupo', 0, 0, recuo, 1, { pad: { top: 8, right: 0, bottom: 0, left: 0 }, pai: lin.id })
          texto('num', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: recuo - 16, fonte: 'mono', tamanhos: [tamNum], max: 1, cor: forte, anim: animItem(k), pai: marca.id })
          texto('texto', it, { x: 0, y: 0, w: larg - recuo, tamanhos: tamTexto, max: 3, anim: animItem(k), pai: lin.id, fill: true })
          if (k < itens.length - 1) linha(0, 0, larg, 2, s.linha, { parentId: lista.id, sizingW: 'fill' })
        })
        espalhar(lista, fimConteudo - y0, maxGap)
        return lista
      }
      if (st) {
        listaNum(M, cabecalho(), W - M * 2, 100, 26, [42, 38, 34], 64)
        break
      }
      bloco({ x: M, y: MT, w: wc(5), rotulo: d.rotulo, tamanhos: [88, 76, 66, 58, 52], max: 4, gapTexto: 28, texto: { tamanhos: [28, 26], max: 5 } })
      // começa abaixo da marca do motivo no canto
      listaNum(xc(6), MT + 96, wc(6), 96, 22, [40, 36, 32, 28], 56)
      break
    }
    case 'lista.colunas': {
      const y0 = cabecalho()
      const colsL = st ? 1 : itens.length === 4 ? 2 : Math.min(3, itens.length)
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, Math.max(1, colsL), GUT, st ? 44 : 52)
      // poucos pontos curtos ganham corpo de subtítulo
      const curtos = itens.length <= 3 && itens.every((x) => x.length <= 48)
      itens.forEach((it, k) => {
        const lado = st ? 22 : curtos ? 24 : 18
        const cel = frame('celula', 0, 0, cw, 1, { dir: 'horizontal', gap: 22, pai: g.id })
        const marca = frame('grupo', 0, 0, lado, 1, { w: 'hug', pad: { top: curtos ? 22 : 14, right: 0, bottom: 0, left: 0 }, pai: cel.id })
        forma('marcador', formaMotivo === 'rect' ? 'rect' : 'ellipse', 0, 0, lado, lado, { fill: forte, enterAnimation: animItem(k), parentId: marca.id })
        texto('item', it, { x: 0, y: 0, w: cw - lado - 22, fonte: curtos ? 'titulo' : 'texto', tamanhos: st ? [42, 38, 34] : curtos ? [54, 48, 42, 38] : [40, 36, 32], max: 4, anim: animItem(k), pai: cel.id, fill: true })
      })
      if (st) espalhar(g, fimConteudo - y0, 120)
      assentar(g, y0)
      break
    }

    // ================================================================ cartões
    case 'cartoes.grade':
    case 'cartoes.linhas': {
      const abertos = d.variante === 'cartoes.linhas'
      const y0 = cabecalho()
      const colsC = st ? 1 : itens.length === 4 ? 4 : Math.min(3, itens.length <= 4 ? itens.length : Math.ceil(itens.length / 2))
      const linhasC = Math.ceil(itens.length / Math.max(1, colsC))
      const gapC = st ? 28 : GUT
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, Math.max(1, colsC), gapC)
      const pad = abertos ? 0 : st ? 44 : 40
      const tamTit = st ? [52, 46, 42] : itens.length > 3 ? [42, 38, 34] : [52, 46, 40, 36]
      const tamDesc = st ? [34, 31, 28] : itens.length > 3 ? [27, 25, 23] : [30, 27, 25]
      const cartoes: Camada[] = []
      itens.forEach((it, k) => {
        const [tit = '', desc = ''] = partes(it)
        const dest = ehDestaque(k)
        const corT = dest && !abertos ? sobreDestaque : s.tinta
        const corS = dest && !abertos ? alfa(sobreDestaque, 0.82) : s.suave
        const iw = cw - pad * 2
        const card = frame('cartao', 0, 0, cw, 1, { gap: abertos ? 18 : st ? 56 : 48, pad, pai: g.id, extra: abertos ? { enterAnimation: animItem(k) } : { ...cartao(dest), radius: raioCartao, enterAnimation: animItem(k) } })
        cartoes.push(card)
        if (abertos) {
          const topo = frame('grupo', 0, 0, cw, 1, { gap: 31, pai: card.id, w: 'fill' })
          forma('fio', 'rect', 0, 0, st ? 120 : Math.min(cw, 140), 5, { fill: forte, enterAnimation: animItem(k), parentId: topo.id })
          texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: 80, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, cor: forte, anim: animItem(k), pai: topo.id })
        } else texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: 80, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, cor: dest ? corT : forte, anim: animItem(k), pai: card.id })
        // título e descrição juntos: nos cartões com fundo, assentam no pé (alinhados entre os cartões)
        const corpo = frame('grupo', 0, 0, iw, 1, { gap: 16, pai: card.id, w: 'fill' })
        texto('item', tit, { x: 0, y: 0, w: iw, fonte: 'titulo', tamanhos: tamTit, max: 2, cor: corT, anim: animItem(k), pai: corpo.id, fill: true })
        if (desc) texto('texto', desc, { x: 0, y: 0, w: iw, tamanhos: tamDesc, max: st ? 3 : 5, cor: corS, anim: animItem(k), pai: corpo.id, fill: true })
      })
      if (!abertos) {
        // cartões da mesma altura: o alvo do estilo, sem passar da área (o conteúdo manda se for maior)
        const alvo = Math.min(esc(st ? 300 : 440), (fimConteudo - y0 - (linhasC - 1) * gapC) / Math.max(1, linhasC))
        igualar(cartoes, alvo)
        for (const card of cartoes) layoutDe(card).gapAuto = true
      }
      assentar(g, y0)
      break
    }

    // ================================================================ processo
    case 'processo.passos':
    case 'processo.circulos': {
      const circulos = d.variante === 'processo.circulos' && !st
      const y0 = cabecalho()
      if (st) {
        // fio vertical atrás dos marcadores (posicionado depois do layout)
        const fio = linha(M + 36, y0, 3, 10, s.linha)
        const lista = frame('lista', M, y0, W - M * 2, 1, { gap: 40, pad: { top: 0, right: 0, bottom: 0, left: 8 } })
        const marcas: Camada[] = []
        itens.forEach((it, k) => {
          const [tit = '', desc = ''] = partes(it)
          const lin = frame('linha', 0, 0, W - M * 2 - 8, 1, { dir: 'horizontal', gap: 42, pai: lista.id, w: 'fill' })
          const m = frame('marcador', 0, 0, 60, 60, { h: 'fixed', alX: 'center', alY: 'center', pai: lin.id, extra: { fill: forte, radius: 30, enterAnimation: animItem(k) } })
          marcas.push(m)
          texto('indice', String(k + 1), { x: 0, y: 0, w: 60, fonte: 'mono', tamanhos: [24], max: 1, cor: sobreDestaque, align: 'center', anim: animItem(k), pai: m.id })
          const col = frame('grupo', 0, 0, W - M * 2 - 110, 1, { gap: 10, pai: lin.id, w: 'fill' })
          texto('item', tit, { x: 0, y: 0, w: W - M * 2 - 110, fonte: 'titulo', tamanhos: [48, 44, 40], max: 2, anim: animItem(k), pai: col.id, fill: true })
          if (desc) texto('texto', desc, { x: 0, y: 0, w: W - M * 2 - 110, tamanhos: [32, 30], max: 3, cor: s.suave, anim: animItem(k), pai: col.id, fill: true })
        })
        espalhar(lista, fimConteudo - y0, 120)
        const r = resolver()
        const ys = marcas.map((m) => r.find((l) => l.id === m.id)!).map((b) => b.y + b.height / 2)
        fio.y = Math.round(ys[0] ?? y0)
        fio.height = Math.max(1, Math.round((ys[ys.length - 1] ?? y0) - (ys[0] ?? y0)))
        fio.x = Math.round((r.find((l) => l.id === marcas[0]?.id)?.x ?? M + 8) + 28)
        break
      }
      const n = Math.max(1, itens.length)
      const gap = 48
      const colW = Math.floor((W - M * 2 - (n - 1) * gap) / n)
      const dia = Math.round(Math.min(200, colW * 0.62))
      // fios atrás (decoração): posicionados depois do layout
      const fioCirculos = circulos ? linha(M, y0, W - M * 2, 2, s.linha, { enterAnimation: { type: 'reveal', duration: 900, delay: 150, easing: 'easeOut' } }) : null
      const fiosPassos = circulos ? [] : itens.slice(0, -1).map((_, k) => linha(M, y0, colW + gap - 170, 2, s.linha, { enterAnimation: { type: 'reveal', duration: 700, delay: 200 + k * 120, easing: 'easeOut' } }))
      const fila = frame('etapas', M, y0, W - M * 2, 1, { dir: 'horizontal', gap })
      itens.forEach((it, k) => {
        const [tit = '', desc = ''] = partes(it)
        const col = frame('etapa', 0, 0, colW, 1, { gap: 14, alX: circulos ? 'center' : 'start', pai: fila.id })
        const cabeca = frame('grupo', 0, 0, colW, 1, { w: 'fill', alX: circulos ? 'center' : 'start', pad: { top: 0, right: 0, bottom: circulos ? 26 : 36, left: 0 }, pai: col.id })
        if (circulos) {
          const cheio = ehDestaque(k) || d.destaque < 0
          const m = frame('marcador', 0, 0, dia, dia, { h: 'fixed', alX: 'center', alY: 'center', pai: cabeca.id, extra: { fill: cheio ? forte : s.cartao, radius: Math.round(dia / 2), enterAnimation: animItem(k) } })
          texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: dia, fonte: 'titulo', tamanhos: [72, 60, 48], max: 1, cor: cheio ? sobreDestaque : forte, align: 'center', anim: animItem(k), pai: m.id, lh: 1 })
        } else texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: 160, fonte: 'titulo', tamanhos: [88], max: 1, cor: forte, lh: 1, anim: animItem(k), pai: cabeca.id })
        texto('item', tit, { x: 0, y: 0, w: colW, fonte: 'titulo', tamanhos: n > 4 ? [36, 32] : [48, 42, 38], max: 2, align: circulos ? 'center' : 'left', anim: animItem(k), pai: col.id, fill: true })
        if (desc) texto('texto', desc, { x: 0, y: 0, w: colW, tamanhos: n > 4 ? [26, 24] : [30, 27], max: 4, cor: s.suave, align: circulos ? 'center' : 'left', anim: animItem(k), pai: col.id, fill: true })
      })
      assentar(fila, y0)
      const r = resolver()
      const yP = r.find((l) => l.id === fila.id)!.y
      if (fioCirculos) fioCirculos.y = Math.round(yP + dia / 2)
      fiosPassos.forEach((f, k) => { f.x = Math.round(M + k * (colW + gap) + 150); f.y = Math.round(yP + 52) })
      break
    }

    // ================================================================ métricas
    case 'numeros.grandes':
    case 'numeros.cartoes': {
      const cartoes = d.variante === 'numeros.cartoes'
      const y0 = cabecalho()
      const lista = itens.length ? itens : ['—|sem dados']
      const n = lista.length
      const cols = st ? 1 : Math.max(1, Math.min(4, n <= 4 ? n : Math.ceil(n / 2)))
      const gapN = st ? 24 : cartoes ? GUT : 64
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, cols, gapN, st ? 24 : cartoes ? GUT : 48)
      const pad = cartoes ? (n >= 4 && !st ? 36 : 44) : 0
      const celulas: Camada[] = []
      // todos os números no mesmo corpo (o maior em que o mais largo cabe numa linha)
      const listaTam = st ? [200, 170, 140, 120, 100, 84] : n <= 2 ? [220, 190, 160, 136, 116, 96] : n === 3 ? [176, 152, 132, 112, 96, 84, 72] : [136, 116, 100, 86, 74, 64, 56, 50, 44]
      const tamNumeros = Math.min(...lista.map((it) => caberTitulo(partes(it)[0] ?? '', cw - pad * 2, listaTam, 1).tamanho))
      lista.forEach((it, k) => {
        const [valor = '', ...resto] = partes(it)
        const legenda = resto.join(' ')
        const dest = ehDestaque(k)
        const cel = frame(cartoes ? 'cartao' : 'celula', 0, 0, cw, 1, { gap: st ? 18 : 24, pad, pai: g.id, extra: cartoes ? { ...cartao(dest), radius: raioCartao, enterAnimation: animItem(k) } : {} })
        celulas.push(cel)
        const corV = cartoes ? (dest ? sobreDestaque : s.tinta) : dest ? forte : s.tinta
        texto('valor', valor, { x: 0, y: 0, w: cw - pad * 2, fonte: 'titulo', tamanhos: [tamNumeros], escalado: true, max: 1, cor: corV, lh: 1, anim: { type: 'slideUp', duration: 700, delay: 150 + k * 140, easing: 'spring' }, pai: cel.id, fill: true })
        texto('texto', legenda, { x: 0, y: 0, w: cw - pad * 2, tamanhos: st ? [38, 34] : [33, 30, 27], max: 3, cor: cartoes && dest ? alfa(sobreDestaque, 0.85) : s.suave, anim: animItem(k), pai: cel.id, fill: true })
      })
      if (cartoes) igualar(celulas, 0)
      if (st) espalhar(g, fimConteudo - y0, 96)
      assentar(g, y0, fimConteudo, 0.35)
      if (!cartoes && !st) {
        // fios entre as colunas de uma mesma linha
        const r = resolver()
        const caixas = celulas.map((cel) => r.find((l) => l.id === cel.id)!)
        caixas.forEach((b, k) => { if (k > 0 && caixas[k - 1]!.y === b.y) linha(b.x - gapN / 2, b.y + 10, 2, Math.max(20, b.height - 20), s.linha) })
      }
      break
    }

    // ================================================================ gráfico
    case 'grafico.barras':
    case 'grafico.colunas': {
      const dados = itens.map((it) => { const [v = '', ...r] = partes(it); return { valor: v, rotulo: r.join(' '), n: valorDe(v) } })
      if (dados.filter((x) => x.n !== null).length < 2) return montarTela({ ...d, tipo: 'numeros', variante: 'numeros.grandes', itens: itens.slice(0, 4) }, c, interno)
      const max = Math.max(...dados.map((x) => Math.abs(x.n ?? 0)), 1)
      const destaque = d.destaque >= 0 && d.destaque < dados.length ? d.destaque : dados.reduce((m, x, k) => ((x.n ?? 0) > (dados[m]!.n ?? 0) ? k : m), 0)
      const corBarra = misturar(s.fundo, s.tinta, s.tipo === 'escuro' ? 0.28 : 0.2)
      const colunas = d.variante === 'grafico.colunas' && !st
      const y0 = cabecalho()
      if (colunas) {
        const base = fimConteudo - 60
        const n = dados.length
        const gap = Math.min(64, (W - M * 2) / n / 3)
        const colW = (W - M * 2 - (n - 1) * gap) / n
        const altMax = base - y0 - 70
        linha(M, base, W - M * 2, 2, s.linha)
        dados.forEach((x, k) => {
          const hb = Math.max(8, (Math.abs(x.n ?? 0) / max) * altMax)
          const xk = M + k * (colW + gap)
          forma('barra', 'rect', xk, base - hb, colW, hb, { fill: k === destaque ? forte : corBarra, radii: [Math.min(raioCartao, 16), Math.min(raioCartao, 16), 0, 0], radius: Math.min(raioCartao, 16), enterAnimation: { type: 'slideUp', duration: 700, delay: 200 + k * 110, easing: 'easeOut' } })
          texto('texto', x.valor, { x: xk, y: base - hb - 56, w: colW, fonte: 'titulo', tamanhos: [40, 34, 28], max: 1, align: 'center', cor: k === destaque ? forte : s.tinta, anim: animItem(k) })
          texto('item', x.rotulo, { x: xk, y: base + 16, w: colW, tamanhos: [24, 22, 20], max: 2, cor: s.suave, align: 'center', anim: animItem(k) })
        })
      } else {
        const n = dados.length
        const passo = Math.min(st ? 200 : 120, (fimConteudo - y0) / n)
        const rotW = st ? W - M * 2 : wc(3)
        const xb = st ? M : xc(3)
        const larguraMax = (st ? W - M * 2 : W - M - xb) - 170
        const hb = Math.min(st ? 52 : 46, passo * 0.5)
        const yB = y0 + Math.max(0, (fimConteudo - y0 - n * passo) * 0.42)
        dados.forEach((x, k) => {
          const yk = yB + k * passo
          texto('item', x.rotulo, { x: M, y: st ? yk : yk + (hb - 30) / 2, w: rotW - 24, tamanhos: st ? [32, 28] : [28, 25, 22], max: st ? 1 : 2, cor: s.tinta, anim: animItem(k) })
          const yb = st ? yk + 50 : yk
          const wb = Math.max(10, (Math.abs(x.n ?? 0) / max) * larguraMax)
          forma('barra', 'rect', xb, yb, wb, hb, { fill: k === destaque ? forte : corBarra, radius: Math.min(raioCartao, hb / 2), enterAnimation: { type: 'reveal', duration: 800, delay: 200 + k * 110, easing: 'easeOut' } })
          texto('texto', x.valor, { x: xb + wb + 20, y: yb + (hb - 40) / 2, w: 160, fonte: 'titulo', tamanhos: [34, 30, 26], max: 1, cor: k === destaque ? forte : s.tinta, anim: animItem(k) })
        })
      }
      break
    }

    // ================================================================ gráfico de linha (evolução no tempo)
    case 'grafico.linha': {
      const dados = itens.map((it) => { const [v = '', ...r] = partes(it); return { valor: v, rotulo: r.join(' '), n: valorDe(v) } }).filter((x): x is { valor: string; rotulo: string; n: number } => x.n !== null)
      if (dados.length < 2) return montarTela({ ...d, variante: 'grafico.barras' }, c, interno)
      const y0 = cabecalho()
      const ns = dados.map((x) => x.n)
      const max = Math.max(...ns)
      const min = Math.min(...ns)
      // linha: a base pode não ser zero (a variação é o que importa); a escala fica abaixo do menor valor
      const piso = min >= 0 ? Math.max(0, min - (max - min || Math.abs(max) || 1) * 0.9) : min - (max - min) * 0.2
      const x0 = M
      const x1 = W - M
      const n = dados.length
      const passo = (x1 - x0) / n
      const yTopo = y0 + (st ? 90 : 84)
      // embaixo do eixo: rótulos (até 2 linhas) e, numa faixa própria, a variação entre períodos
      const yBase = fimConteudo - (st ? 170 : 140)
      const px = (k: number) => x0 + passo * (k + 0.5)
      const py = (v: number) => yBase - ((v - piso) / Math.max(1e-9, max - piso)) * (yBase - yTopo)
      for (let g = 0; g <= 2; g++) linha(x0, yTopo + ((yBase - yTopo) * g) / 2, x1 - x0, 1.5, alfa(s.linha, 0.9))
      linha(x0, yBase, x1 - x0, 2.5, s.linha)
      const larg = x1 - x0
      const alt = yBase - yTopo
      const nos = dados.map((x, k) => ({ x: px(k) - x0, y: py(x.n) - yTopo, tipo: 'canto' as const }))
      // área sob a linha (fechada até a base) e a linha (aberta), como caminhos vetoriais editáveis
      forma('area', 'path', x0, yTopo, larg, alt, { fill: alfa(forte, s.tipo === 'escuro' ? 0.18 : 0.1), vetor: { w: larg, h: alt, fillRule: 'nonzero', caminhos: [{ nos: [...nos, { x: nos[nos.length - 1]!.x, y: alt, tipo: 'canto' }, { x: nos[0]!.x, y: alt, tipo: 'canto' }], fechado: true }] }, enterAnimation: { type: 'fadeIn', duration: dur(900), delay: 300, easing: 'easeOut' } })
      forma('linha', 'path', x0, yTopo, larg, alt, { fill: alfa(forte, 0), stroke: forte, strokeWidth: st ? 7 : 6, vetor: { w: larg, h: alt, fillRule: 'nonzero', caminhos: [{ nos, fechado: false, semPreenchimento: true }] }, enterAnimation: { type: 'reveal', duration: dur(1100), delay: 200, easing: 'easeOut' } })
      const destaque = d.destaque >= 0 && d.destaque < n ? d.destaque : n - 1
      let fimRotulos = yBase + 22
      dados.forEach((x, k) => {
        const dot = k === destaque ? 34 : 24
        forma('marcador', 'ellipse', px(k) - dot / 2, py(x.n) - dot / 2, dot, dot, { fill: forte, stroke: s.fundo, strokeWidth: 5, enterAnimation: animItem(k) })
        const wv = Math.min(passo - 12, st ? 300 : 320)
        texto('texto', x.valor, { x: px(k) - wv / 2, y: py(x.n) - (st ? 78 : 70), w: wv, fonte: 'titulo', tamanhos: st ? [44, 38, 32] : n > 5 ? [32, 28, 24] : [44, 38, 32], max: 1, align: 'center', cor: k === destaque ? forte : s.tinta, anim: animItem(k) })
        fimRotulos = Math.max(fimRotulos, texto('item', x.rotulo, { x: px(k) - (passo - 12) / 2, y: yBase + 22, w: passo - 12, tamanhos: st ? [30, 26, 22] : [26, 24, 22], max: 2, align: 'center', cor: s.suave, anim: animItem(k) }).fim)
      })
      dados.forEach((x, k) => {
        if (k > 0 && dados[k - 1]!.n !== 0) {
          // variação entre períodos (calculada aqui, igual aos números da tela)
          const v = (x.n / dados[k - 1]!.n - 1) * 100
          const cor = v >= 0 ? positivo : negativo
          const wd = Math.min(st ? 150 : 130, passo - 8)
          texto('dado', formatarPct(v, true), { x: px(k) - passo / 2 - wd / 2, y: fimRotulos + 10, w: wd, fonte: 'mono', tamanhos: [st ? 22 : 18], max: 1, align: 'center', cor, anim: animTexto(500 + k * 120), hMin: Math.round((st ? 22 : 18) * 1.3 + 14), extra: { background: alfa(cor, 0.12), padding: 6, radius: 999 } })
        }
      })
      break
    }

    // ================================================================ participação no total (barras proporcionais + %)
    case 'grafico.participacao': {
      const dados = itens.map((it) => { const [v = '', ...r] = partes(it); return { valor: v, rotulo: r.join(' '), n: valorDe(v) } }).filter((x): x is { valor: string; rotulo: string; n: number } => x.n !== null && x.n >= 0)
      if (dados.length < 2) return montarTela({ ...d, variante: 'grafico.barras' }, c, interno)
      const y0 = cabecalho()
      const soma = dados.reduce((a, x) => a + x.n, 0) || 1
      const max = Math.max(...dados.map((x) => x.n), 1)
      const destaque = d.destaque >= 0 && d.destaque < dados.length ? d.destaque : dados.reduce((m, x, k) => (x.n > dados[m]!.n ? k : m), 0)
      const corBarra = misturar(s.fundo, s.tinta, s.tipo === 'escuro' ? 0.28 : 0.18)
      const n = dados.length
      const rotW = st ? W - M * 2 : wc(3)
      const xb = st ? M : xc(3)
      const colValor = st ? 0 : 340
      const larguraMax = (st ? W - M * 2 - 220 : W - M - xb - colValor - 24)
      const passo = Math.min(st ? 190 : 118, (fimConteudo - y0 - 70) / n)
      const hb = Math.min(st ? 48 : 44, passo * 0.48)
      const yB = y0 + Math.max(0, (fimConteudo - y0 - 70 - n * passo) * 0.35)
      dados.forEach((x, k) => {
        const yk = yB + k * passo
        const dest = k === destaque
        texto('item', x.rotulo, { x: M, y: st ? yk : yk + (hb - 34) / 2, w: rotW - 24, tamanhos: st ? [32, 28] : [30, 27, 24], max: st ? 1 : 2, peso: dest ? 600 : 400, cor: s.tinta, anim: animItem(k) })
        const yb = st ? yk + 50 : yk
        const wb = Math.max(10, (x.n / max) * larguraMax)
        forma('barra', 'rect', xb, yb, wb, hb, { fill: dest ? forte : corBarra, radius: Math.min(raioCartao, hb / 2), enterAnimation: { type: 'reveal', duration: dur(800), delay: 200 + k * 110, easing: 'easeOut' } })
        const xv = st ? xb + wb + 16 : xb + wb + 24
        texto('texto', x.valor, { x: xv, y: yb + (hb - 40) / 2, w: st ? 200 : 190, fonte: 'titulo', tamanhos: [34, 30, 26], max: 1, cor: dest ? forte : s.tinta, anim: animItem(k) })
        texto('dado', formatarPct((x.n / soma) * 100), { x: xv + (st ? 0 : 190), y: st ? yb + hb + 6 : yb + (hb - 30) / 2, w: 130, fonte: 'mono', tamanhos: [st ? 24 : 22], max: 1, cor: s.suave, anim: animItem(k) })
      })
      // total conferido: a soma das partes, no mesmo formato dos valores
      const yT = yB + n * passo + 8
      linha(M, yT, W - M * 2, 2, s.linha)
      texto('dado', `Total ${formatarComo(soma, dados[destaque]!.valor)} · 100%`, { x: M, y: yT + 18, w: W - M * 2, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, cor: s.suave, align: st ? 'left' : 'right', anim: animTexto(600) })
      break
    }

    // ================================================================ comparativo: meta × realizado
    case 'comparativo.meta':
    case 'comparativo.crescimento': {
      const pares = itens.map((it) => { const [r = '', ...v] = partes(it); const valor = v.join(' '); return { rotulo: r, valor, n: valorDe(valor) } }).filter((x): x is { rotulo: string; valor: string; n: number } => x.n !== null)
      if (pares.length < 2) return montarTela({ ...d, tipo: 'numeros', variante: 'numeros.grandes', itens: itens.map((it) => partes(it).reverse().join('|')) }, c, interno)
      const [ref, atual] = [pares[0]!, pares[1]!]
      const meta = d.variante === 'comparativo.meta'
      const y0 = cabecalho({ semTexto: true })
      const maxV = Math.max(Math.abs(ref.n), Math.abs(atual.n), 1)
      const painelX = st ? M : xc(8)
      const painelW = st ? W - M * 2 : wc(4)
      const graficoW = st ? W - M * 2 : wc(7)
      const graficoH = st ? 620 : fimConteudo - y0 - 40
      // painel à direita: o número que resume (calculado) e a leitura
      const painel = frame('painel', painelX, y0, painelW, 1, { gap: st ? 20 : 18 })
      const diff = atual.n - ref.n
      if (meta) {
        const ating = (atual.n / ref.n) * 100
        texto('dado', formatarPct(ating), { x: 0, y: 0, w: painelW, fonte: 'titulo', tamanhos: st ? [190, 160, 140] : [170, 150, 130, 110], max: 1, lh: 1, cor: forte, anim: { type: 'slideUp', duration: dur(700), delay: 200, easing: 'spring' }, pai: painel.id, fill: true })
        texto('dado', 'da meta atingida', { x: 0, y: 0, w: painelW, tamanhos: st ? [36] : [32, 28], max: 2, cor: s.suave, pai: painel.id, fill: true })
        linha(0, 0, painelW, 2, s.linha, { parentId: painel.id, sizingW: 'fill' })
        texto('dado', diff < 0 ? `Gap de ${formatarComo(-diff, ref.valor)}` : `${formatarComo(diff, ref.valor)} acima da meta`, { x: 0, y: 0, w: painelW, fonte: 'titulo', tamanhos: st ? [48, 42] : [44, 40, 36], max: 2, cor: diff < 0 ? negativo : positivo, pai: painel.id, fill: true })
      } else {
        const varPct = ref.n !== 0 ? (atual.n / Math.abs(ref.n) - (ref.n < 0 ? -1 : 1)) * 100 : 0
        const cor = varPct >= 0 ? positivo : negativo
        const linhaV = frame('grupo', 0, 0, painelW, 1, { dir: 'horizontal', gap: 18, alY: 'center', pai: painel.id, w: 'fill' })
        forma('seta', 'arrow', 0, 0, st ? 80 : 72, st ? 80 : 72, { fill: cor, rotation: varPct >= 0 ? -45 : 45, parentId: linhaV.id, enterAnimation: animForma(300) })
        texto('dado', formatarPct(varPct, true), { x: 0, y: 0, w: painelW - 100, fonte: 'titulo', tamanhos: st ? [170, 150, 130] : [150, 130, 112, 96], max: 1, lh: 1, cor, anim: { type: 'slideUp', duration: dur(700), delay: 200, easing: 'spring' }, pai: linhaV.id, fill: true })
        const semQualificador = (r: string) => r.replace(/\s*[·(–—-]\s*(estimad|calculad|projet)\w*\)?\s*$/i, '')
        texto('dado', `de ${semQualificador(ref.rotulo)} para ${semQualificador(atual.rotulo)}`, { x: 0, y: 0, w: painelW, tamanhos: st ? [34] : [30, 27], max: 2, cor: s.suave, pai: painel.id, fill: true })
        linha(0, 0, painelW, 2, s.linha, { parentId: painel.id, sizingW: 'fill' })
        texto('dado', `${diff >= 0 ? '+' : '−'}${formatarComo(Math.abs(diff), atual.valor)} no período`, { x: 0, y: 0, w: painelW, fonte: 'titulo', tamanhos: st ? [44, 40] : [40, 36, 32], max: 2, cor: s.tinta, pai: painel.id, fill: true })
      }
      if (d.texto) texto('texto', d.texto, { x: 0, y: 0, w: painelW, tamanhos: st ? [32, 30, 28] : [28, 26, 24], max: 6, cor: s.suave, pai: painel.id, fill: true })
      if (meta) {
        // colunas com base zero: meta (contorno) e realizado (cheio); o gap fica marcado entre o topo do realizado e a meta
        const colW = st ? 240 : 230
        const gap = st ? 120 : 150
        const xA = M + (st ? 60 : 40)
        const base = y0 + graficoH - 64
        const topo = y0 + 80
        const h = (v: number) => Math.max(8, (Math.abs(v) / maxV) * (base - topo))
        linha(M, base, graficoW, 2.5, s.linha)
        ;[ref, atual].forEach((x, k) => {
          const xk = xA + k * (colW + gap)
          const hk = h(x.n)
          forma('barra', 'rect', xk, base - hk, colW, hk, k === 0 ? { fill: alfa(forte, s.tipo === 'escuro' ? 0.16 : 0.1), stroke: forte, strokeWidth: 3, dash: 10, radius: Math.min(raioCartao, 14), enterAnimation: { type: 'slideUp', duration: dur(700), delay: 200, easing: 'easeOut' } } : { fill: forte, radius: Math.min(raioCartao, 14), enterAnimation: { type: 'slideUp', duration: dur(700), delay: 350, easing: 'easeOut' } })
          texto('texto', x.valor, { x: xk - 8, y: base - h(Math.max(ref.n, atual.n)) - 64, w: colW + 16, fonte: 'titulo', tamanhos: [48, 42, 36, 32], max: 1, align: 'center', cor: k === 0 ? s.tinta : forte, anim: animItem(k) })
          texto('item', x.rotulo, { x: xk - gap / 2 + 8, y: base + 18, w: colW + gap - 16, tamanhos: st ? [30, 26] : [28, 25], max: 2, align: 'center', cor: s.suave, anim: animItem(k) })
        })
        if (atual.n < ref.n) {
          const xk = xA + colW + gap
          const yMeta = base - h(ref.n)
          const yReal = base - h(atual.n)
          // linha da meta atravessando as duas colunas e o trecho que falta no realizado
          linha(xA - 20, yMeta, colW * 2 + gap + 40, 2, alfa(forte, 0.6), { dash: 8 })
          forma('gap', 'rect', xk, yMeta, colW, Math.max(4, yReal - yMeta), { fill: alfa(negativo, 0.14), stroke: negativo, strokeWidth: 2, dash: 6, radius: 6, enterAnimation: animForma(600) })
          texto('dado', `gap ${formatarComo(ref.n - atual.n, ref.valor)}`, { x: xk + colW + 20, y: yMeta + (yReal - yMeta) / 2 - 18, w: st ? W - M - (xk + colW + 20) : 240, fonte: 'mono', tamanhos: [st ? 24 : 22], max: 2, cor: negativo, anim: animTexto(700) })
        }
      } else {
        // barras horizontais grandes, base zero: anterior (apagada) e atual (cheia)
        const wValor = st ? 260 : 220
        const larguraMax = graficoW - wValor - 24 - 8
        const hb = st ? 110 : 120
        const lista = frame('barras', M, y0, graficoW, 1, { gap: st ? 44 : 52 })
        ;[ref, atual].forEach((x, k) => {
          const grupo = frame('grupo', 0, 0, graficoW, 1, { gap: 14, pai: lista.id, w: 'fill' })
          texto('item', x.rotulo, { x: 0, y: 0, w: graficoW, fonte: 'mono', tamanhos: [st ? 26 : 22], max: 1, upper: true, cor: s.suave, anim: animItem(k), pai: grupo.id, fill: true })
          const fila = frame('grupo', 0, 0, graficoW, hb, { dir: 'horizontal', gap: 24, alY: 'center', h: 'fixed', pai: grupo.id, w: 'fill' })
          forma('barra', 'rect', 0, 0, Math.max(12, (Math.abs(x.n) / maxV) * larguraMax), hb, { fill: k === 1 ? forte : misturar(s.fundo, s.tinta, s.tipo === 'escuro' ? 0.3 : 0.16), radius: Math.min(raioCartao, 16), parentId: fila.id, enterAnimation: { type: 'reveal', duration: dur(900), delay: 200 + k * 200, easing: 'easeOut' } })
          texto('texto', x.valor, { x: 0, y: 0, w: wValor, fonte: 'titulo', tamanhos: [52, 46, 40, 34], max: 1, cor: k === 1 ? forte : s.tinta, anim: animItem(k), pai: fila.id })
        })
        assentar(lista, y0, y0 + graficoH, 0.4)
      }
      if (!st) colocar(painel, painelX, Math.max(y0, y0 + (graficoH - altura(painel)) * 0.4))
      else colocar(painel, M, y0 + graficoH + 90)
      break
    }

    // ================================================================ funil
    case 'funil.barras':
    case 'funil.degraus': {
      const etapas = itens.map((it) => { const [r = '', ...v] = partes(it); const valor = v.join(' '); return { rotulo: r, valor, n: valorDe(valor) } }).filter((x): x is { rotulo: string; valor: string; n: number } => x.n !== null && x.n >= 0)
      if (etapas.length < 2) return montarTela({ ...d, tipo: 'lista', variante: 'lista.numerada' }, c, interno)
      const centrado = d.variante === 'funil.barras'
      const y0 = cabecalho()
      const n = etapas.length
      const topoN = Math.max(1, etapas[0]!.n)
      // taxa de passagem de cada etapa (da anterior para ela) e a maior perda
      const taxas = etapas.map((x, k) => (k === 0 || etapas[k - 1]!.n === 0 ? null : (x.n / etapas[k - 1]!.n) * 100))
      const perda = taxas.reduce<number>((m, tx, k) => (tx !== null && (m < 0 || tx < taxas[m]!) ? k : m), -1)
      const rotW = st ? 0 : wc(3)
      const areaX = st ? M : xc(3)
      const areaW = st ? W - M * 2 - 230 : wc(6)
      const taxaX = st ? W - M - 210 : xc(9)
      const taxaW = st ? 210 : wc(3)
      const disp = fimConteudo - y0 - (st ? 40 : 60)
      const passo = Math.min(st ? 170 : 104, disp / n)
      const hb = Math.round(Math.min(st ? 84 : 76, passo * 0.74))
      const yB = y0 + Math.max(0, (disp - n * passo) * 0.3)
      etapas.forEach((x, k) => {
        const yk = yB + k * passo
        // largura exatamente proporcional ao volume (só um mínimo visível); o número sai da barra quando não cabe nela
        const wb = Math.max(8, (x.n / topoN) * areaW)
        const xb = centrado ? areaX + (areaW - wb) / 2 : areaX
        const fill = forte
        forma('barra', 'rect', xb, yk, wb, hb, { fill, radius: Math.min(raioCartao, 12, hb / 2, wb / 2), enterAnimation: { type: 'reveal', duration: dur(700), delay: 150 + k * 120, easing: 'easeOut' } })
        const tamV = ateAltura(st ? [40, 34, 30, 26] : [36, 32, 28, 24, 20], hb, 1.1)
        const cabeNaBarra = wb >= x.valor.length * tamV[0]! * 0.62 + 28
        const wFora = Math.min(220, (centrado ? (areaW - wb) / 2 : areaW - wb) - 14)
        texto('texto', x.valor, { x: cabeNaBarra ? xb : xb + wb + 14, y: yk + (hb - Math.ceil(tamV[0]! * 1.22)) / 2, w: cabeNaBarra ? wb : Math.max(60, wFora), fonte: 'titulo', tamanhos: tamV, max: 1, lh: 1.1, align: cabeNaBarra ? 'center' : 'left', cor: cabeNaBarra ? legivel(fill, [sobreDestaque, '#FFFFFF', '#141414'], 4.5) : s.tinta, anim: animItem(k) })
        if (st) texto('item', x.rotulo, { x: M, y: yk + hb + 6, w: areaW, tamanhos: [26, 24], max: 1, cor: s.tinta, anim: animItem(k) })
        else {
          // rótulo numa linha quando o passo é curto, com o corpo que cabe no passo
          const umaLinha = passo < 92
          const tamR = ateAltura([30, 27, 24, 22, 20, 18, 16], umaLinha ? passo - 2 : (passo - 2) / 2)
          texto('item', x.rotulo, { x: M, y: yk + hb / 2 - Math.ceil(tamR[0]! * 1.54) / 2, w: rotW - 28, tamanhos: tamR, max: umaLinha ? 1 : 2, align: centrado ? 'right' : 'left', cor: s.tinta, anim: animItem(k) })
        }
        const tx = taxas[k] ?? null
        if (tx !== null) {
          const ehPerda = k === perda
          // selo da maior perda: o corpo e o respiro cabem no passo entre as etapas (não encosta na taxa seguinte)
          const padSelo = passo < 64 ? 3 : 8
          const tamTaxa = ateAltura([st ? 24 : 22, 20, 18, 16, 14], passo - 4 - (ehPerda ? padSelo * 2 : 0), 1.3)
          const hSelo = Math.min(passo - 4, Math.round(tamTaxa[0]! * 1.3 + padSelo * 2 + 2))
          texto('dado', `↓ ${formatarPct(tx)}${ehPerda ? '  maior perda' : ''}`, { x: taxaX, y: yk - passo / 2 + hb / 2 - hSelo / 2, w: taxaW, fonte: 'mono', tamanhos: tamTaxa, max: 1, lh: 1.3, cor: ehPerda ? negativo : s.suave, anim: animTexto(400 + k * 120), ...(ehPerda ? { hMin: hSelo, extra: { background: alfa(negativo, 0.12), padding: padSelo, radius: 999 } } : {}) })
        }
      })
      texto('dado', 'Passagem entre etapas', { x: taxaX, y: yB - (st ? 40 : 34), w: taxaW, fonte: 'mono', tamanhos: [st ? 20 : 17], max: 1, upper: true, cor: s.suave, anim: animTexto(300) })
      const ult = etapas[n - 1]!
      texto('dado', `Conversão total ${formatarPct((ult.n / topoN) * 100)}`, { x: taxaX, y: yB + (n - 1) * passo + hb + (st ? 50 : 22), w: taxaW, fonte: 'mono', tamanhos: [st ? 24 : 22], max: 2, cor: forte, peso: 600, anim: animTexto(900) })
      break
    }

    // ================================================================ tabela e ranking
    case 'tabela.ranking':
    case 'tabela.simples': {
      const linhasT = itens.map((it) => partes(it))
      if (linhasT.length < 2) return montarTela({ ...d, tipo: 'lista', variante: 'lista.numerada' }, c, interno)
      const ranking = d.variante === 'tabela.ranking'
      const [cab0, ...corpo0] = linhasT
      const nCols = Math.max(cab0!.length, ...corpo0.map((l) => l.length))
      const cab = Array.from({ length: nCols }, (_, k) => cab0![k] ?? '')
      const corpo = corpo0.map((l) => Array.from({ length: nCols }, (_, k) => l[k] ?? ''))
      const numerica = cab.map((_, k) => corpo.every((l) => !l[k] || valorDe(l[k]!) !== null) && corpo.some((l) => l[k]))
      const colPos = ranking && /^(pos|#|rank|n[ºo°]|lugar|coloca)/i.test(semAcentoT(cab[0]!)) ? 0 : -1
      // coluna de valor com barra proporcional: a primeira numérica com moeda (ou a de maiores números)
      const candidatas = cab.map((_, k) => k).filter((k) => numerica[k] && k !== colPos)
      const colValor = ranking ? (candidatas.find((k) => corpo.some((l) => /R\$|US\$|€/.test(l[k]!))) ?? candidatas[0] ?? -1) : -1
      const maxValor = colValor >= 0 ? Math.max(1, ...corpo.map((l) => Math.abs(valorDe(l[colValor]!) ?? 0))) : 1
      const y0 = cabecalho()
      const largT = W - M * 2
      const padX = st ? 20 : 28
      const disp = fimConteudo - y0
      const hLinha = Math.round(Math.max(st ? 70 : 58, Math.min(st ? 110 : 92, disp / (corpo.length + 1.1))))
      // a posição tem largura fixa (o marcador); as outras colunas dividem o resto pelo tamanho do conteúdo
      const wPos = colPos >= 0 ? Math.max(st ? 100 : 120, Math.round(hLinha * 0.56) + 24) : 0
      const pesos = cab.map((h, k) => (k === colPos ? 0 : Math.max(4, h.length * 0.8, ...corpo.map((l) => l[k]!.length)) * (numerica[k] ? 1 : 1.25)))
      const somaP = pesos.reduce((a, b) => a + b, 0) || 1
      const gapCel = st ? 16 : 24
      const larguras = pesos.map((p, k) => (k === colPos ? wPos : Math.floor(((largT - padX * 2 - wPos - gapCel * (nCols - 1)) * p) / somaP)))
      const tamCel = hLinha >= 84 ? [32, 29, 26] : [28, 26, 24, 22]
      const tabela = frame('tabela', M, y0, largT, 1, { gap: 0 })
      const celula = (lin: string[], k: number, cabecalhoT: boolean, iLin: number, pai: string) => {
        const w = larguras[k]!
        const v = lin[k] ?? ''
        const alinhar = numerica[k] ? 'right' : 'left'
        if (cabecalhoT) return texto('dado', v, { x: 0, y: 0, w, fonte: 'mono', tamanhos: [st ? 20 : 18], max: 1, upper: true, cor: s.suave, align: k === colPos ? 'center' : alinhar, anim: animTexto(150), pai })
        if (k === colPos) {
          const top = iLin < 3
          const caixa = frame('grupo', 0, 0, w, 1, { alX: 'center', pai })
          const dia = Math.round(hLinha * 0.56)
          const m0 = frame('marcador', 0, 0, dia, dia, { h: 'fixed', alX: 'center', alY: 'center', pai: caixa.id, extra: { fill: top ? (iLin === 0 ? forte : alfa(forte, iLin === 1 ? 0.75 : 0.55)) : alfa(s.fundo, 0), ...(top ? {} : { stroke: s.linha, strokeWidth: 2 }), radius: Math.round(dia / 2), enterAnimation: animItem(iLin) } })
          texto('dado', v, { x: 0, y: 0, w: dia, fonte: 'mono', tamanhos: [Math.max(16, Math.round(dia * 0.42))], max: 1, align: 'center', cor: top ? legivel(iLin === 0 ? forte : misturar(s.fundo, forte, iLin === 1 ? 0.75 : 0.55), ['#FFFFFF', '#141414', s.fundo], 4.5) : s.suave, peso: 600, anim: null, pai: m0.id, lh: 1.1 })
          return
        }
        if (k === colValor) {
          const col = frame('grupo', 0, 0, w, 1, { gap: 8, alX: 'end', pai })
          texto('dado', v, { x: 0, y: 0, w, tamanhos: tamCel, max: 1, align: 'right', cor: s.tinta, peso: ranking && iLin < 3 ? 600 : 400, anim: animItem(iLin), pai: col.id, extra: { tabularNums: true } })
          forma('barra', 'rect', 0, 0, Math.max(6, ((Math.abs(valorDe(v) ?? 0)) / maxValor) * w * 0.9), 6, { fill: iLin === 0 ? forte : alfa(forte, 0.45), radius: 3, parentId: col.id, enterAnimation: { type: 'reveal', duration: dur(700), delay: 300 + iLin * 90, easing: 'easeOut' } })
          return
        }
        texto('dado', v, { x: 0, y: 0, w, tamanhos: tamCel, max: 2, align: alinhar, cor: k === 0 || (k === 1 && colPos === 0) ? s.tinta : s.suave, peso: ranking && iLin < 3 && !numerica[k] ? 600 : 400, anim: animItem(iLin), pai, extra: numerica[k] ? { tabularNums: true } : {} })
      }
      const linhaTabela = (lin: string[], iLin: number, cabecalhoT: boolean) => {
        const zebra = !ranking && !cabecalhoT && iLin % 2 === 1
        const f = frame(cabecalhoT ? 'cabecalho' : 'linha', 0, 0, largT, cabecalhoT ? Math.round(hLinha * 0.7) : hLinha, { dir: 'horizontal', gap: gapCel, h: 'fixed', alY: 'center', pad: { top: 0, right: padX, bottom: 0, left: padX }, pai: tabela.id, w: 'fill', extra: zebra ? { fill: s.cartao, radius: Math.min(raioCartao, 10) } : {} })
        lin.forEach((_, k) => celula(lin, k, cabecalhoT, iLin, f.id))
        return f
      }
      linhaTabela(cab, -1, true)
      linha(0, 0, largT, 2, s.tinta, { parentId: tabela.id, sizingW: 'fill', opacity: 0.5 })
      corpo.forEach((lin, i) => {
        linhaTabela(lin, i, false)
        if (ranking && i < corpo.length - 1) linha(0, 0, largT, 1.5, s.linha, { parentId: tabela.id, sizingW: 'fill' })
      })
      assentar(tabela, y0, fimConteudo, 0.3)
      break
    }

    // ================================================================ painel de indicadores (KPIs) e metas
    case 'kpis.painel':
    case 'kpis.metas': {
      const metas = d.variante === 'kpis.metas'
      const y0 = cabecalho()
      const lista = itens.length ? itens : ['—|sem dados']
      const n = lista.length
      const cols = st ? (n >= 4 ? 2 : 1) : n <= 4 ? n : 3
      const gapK = st ? 24 : GUT
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, cols, gapK, gapK)
      const pad = st ? 36 : n >= 4 ? 34 : 42
      const iw = cw - pad * 2
      const cartoesK: Camada[] = []
      const tamValor = st ? (cols === 2 ? [96, 84, 72, 60, 48, 40] : [140, 120, 100, 84, 72]) : n <= 2 ? [150, 130, 110, 96, 80] : n === 3 ? [120, 104, 92, 80, 68] : [96, 84, 72, 62, 52, 44]
      // todos os valores do painel no mesmo corpo (o maior em que o mais largo cabe numa linha)
      const tamComum = Math.min(...lista.map((it) => caberTitulo(partes(it)[0] ?? '', iw, tamValor, 1).tamanho))
      lista.forEach((it, k) => {
        const [valor = '', indicador = '', ...resto] = partes(it)
        const apoio = resto.join(' ').trim()
        const dest = ehDestaque(k)
        const card = frame('cartao', 0, 0, cw, 1, { gap: st ? 16 : 18, pad, pai: g.id, extra: { ...cartao(dest), radius: raioCartao, enterAnimation: animItem(k) } })
        cartoesK.push(card)
        const corT = dest ? sobreDestaque : s.tinta
        const corS = dest ? alfa(sobreDestaque, 0.82) : s.suave
        const fundoCard = dest ? forte : R.cartao === 'contorno' ? s.fundo : s.cartao
        const ind = coresIndicador(t, fundoCard)
        if (metas) texto('dado', 'Meta', { x: 0, y: 0, w: 120, fonte: 'mono', tamanhos: [st ? 20 : 17], max: 1, upper: true, align: 'center', cor: dest ? fundoCard : sobreDestaque, anim: animTexto(0), pai: card.id, hMin: st ? 40 : 34, extra: { background: dest ? sobreDestaque : forte, padding: 6, radius: 999 } })
        texto('valor', valor, { x: 0, y: 0, w: iw, fonte: 'titulo', tamanhos: [tamComum], escalado: true, max: 1, lh: 1, cor: dest ? corT : metas ? forte : s.tinta, anim: { type: 'slideUp', duration: dur(700), delay: 150 + k * 120, easing: 'spring' }, pai: card.id, fill: true })
        texto('texto', indicador, { x: 0, y: 0, w: iw, tamanhos: st ? [32, 28] : n >= 4 ? [26, 24, 22] : [30, 27, 24], max: 3, cor: corS, anim: animItem(k), pai: card.id, fill: true })
        // apoio: série (mini-gráfico), variação (selo), ponto de partida de uma meta (barra de progresso) ou frase curta
        const serie = apoio.split(/\s*;\s*/).map((x) => valorDe(x)).filter((x): x is number => x !== null)
        const vValor = valorDe(valor)
        const deX = /^(?:de|atual|hoje|partida)\s*:?\s*(.+)$/i.exec(apoio)
        const variacao = /^([+\-−]\s*\d[\d.,]*\s*(?:%|p\.?p\.?))(.*)$/i.exec(apoio)
        const hMini = st ? 60 : 52
        if (serie.length >= 2 && apoio.includes(';')) {
          const mn = Math.min(...serie)
          const mx = Math.max(...serie)
          const nos = serie.map((v, j) => ({ x: (j / (serie.length - 1)) * iw, y: hMini - 4 - ((v - mn) / Math.max(1e-9, mx - mn)) * (hMini - 8), tipo: 'canto' as const }))
          forma('mini', 'path', 0, 0, iw, hMini, { fill: alfa(forte, 0), stroke: dest ? sobreDestaque : forte, strokeWidth: 4, parentId: card.id, vetor: { w: iw, h: hMini, fillRule: 'nonzero', caminhos: [{ nos, fechado: false, semPreenchimento: true }] }, enterAnimation: { type: 'reveal', duration: dur(900), delay: 400 + k * 120, easing: 'easeOut' } })
        } else if (variacao) {
          const num = valorDe(variacao[1]!) ?? 0
          const cor = dest ? sobreDestaque : num >= 0 ? ind.positivo : ind.negativo
          texto('dado', `${num >= 0 ? '▲' : '▼'} ${variacao[1]!.replace(/\s+/g, '')}${variacao[2]!.trimEnd()}`, { x: 0, y: 0, w: iw, fonte: 'mono', tamanhos: [st ? 22 : 19], max: 2, cor, anim: animTexto(400), pai: card.id, fill: true })
        } else if (deX && vValor !== null && valorDe(deX[1]!) !== null && vValor !== 0) {
          // progresso do ponto de partida até a meta (projeção: a meta ainda não foi alcançada)
          const atualV = valorDe(deX[1]!)!
          const frac = Math.max(0, Math.min(1, atualV / vValor))
          const trilho = frame('trilho', 0, 0, iw, 10, { h: 'fixed', pai: card.id, w: 'fill', extra: { fill: dest ? alfa(sobreDestaque, 0.25) : alfa(s.tinta, 0.1), radius: 5 } })
          forma('barra', 'rect', 0, 0, Math.max(6, frac * iw), 10, { fill: dest ? sobreDestaque : forte, radius: 5, parentId: trilho.id, enterAnimation: { type: 'reveal', duration: dur(900), delay: 400 + k * 120, easing: 'easeOut' } })
          texto('dado', `Hoje ${deX[1]!.trim()} · ${formatarPct(frac * 100)} da meta`, { x: 0, y: 0, w: iw, fonte: 'mono', tamanhos: [st ? 20 : 18, 16], max: 2, cor: corS, anim: animTexto(500), pai: card.id, fill: true })
        } else if (!apoio && /%\s*$/.test(valor) && vValor !== null && vValor >= 0 && vValor <= 100) {
          // percentual sem apoio: mini-barra da fração
          const trilho = frame('trilho', 0, 0, iw, 10, { h: 'fixed', pai: card.id, w: 'fill', extra: { fill: dest ? alfa(sobreDestaque, 0.25) : alfa(s.tinta, 0.1), radius: 5 } })
          forma('barra', 'rect', 0, 0, Math.max(6, (vValor / 100) * iw), 10, { fill: dest ? sobreDestaque : forte, radius: 5, parentId: trilho.id, enterAnimation: { type: 'reveal', duration: dur(900), delay: 400 + k * 120, easing: 'easeOut' } })
        } else if (apoio) {
          texto('dado', apoio, { x: 0, y: 0, w: iw, fonte: 'mono', tamanhos: [st ? 20 : 18, 16], max: 3, cor: corS, anim: animTexto(500), pai: card.id, fill: true })
        }
      })
      const linhasK = Math.ceil(n / Math.max(1, cols))
      igualar(cartoesK, Math.min(esc(st ? 260 : 300), (fimConteudo - y0 - (linhasK - 1) * gapK) / Math.max(1, linhasK)))
      if (st) espalhar(g, fimConteudo - y0, 60)
      assentar(g, y0, fimConteudo, 0.35)
      break
    }

    // ================================================================ roadmap (plano de ação)
    case 'roadmap.colunas':
    case 'roadmap.linhas': {
      const passos = itens.map((it) => { const [titulo = '', desc = '', resp = '', prazo = ''] = partes(it); return { titulo, desc, resp, prazo } })
      const y0 = cabecalho()
      const n = Math.max(1, passos.length)
      if (d.variante === 'roadmap.colunas' && !st) {
        const gapR = GUT
        const colW = Math.floor((W - M * 2 - (n - 1) * gapR) / n)
        const dia = 64
        const fio = linha(M + dia / 2, y0, W - M * 2 - dia, 3, s.linha, { enterAnimation: { type: 'reveal', duration: dur(1000), delay: 100, easing: 'easeOut' } })
        const fila = frame('etapas', M, y0, W - M * 2, 1, { dir: 'horizontal', gap: gapR })
        const raias: Camada[] = []
        const marcas: Camada[] = []
        passos.forEach((p, k) => {
          const col = frame('etapa', 0, 0, colW, 1, { gap: 22, pai: fila.id })
          const m0 = frame('marcador', 0, 0, dia, dia, { h: 'fixed', alX: 'center', alY: 'center', pai: col.id, extra: { fill: k === 0 || ehDestaque(k) ? forte : s.fundo, stroke: forte, strokeWidth: 3, radius: dia / 2, enterAnimation: animItem(k) } })
          marcas.push(m0)
          texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: dia, fonte: 'mono', tamanhos: [24], max: 1, align: 'center', cor: k === 0 || ehDestaque(k) ? sobreDestaque : forte, peso: 600, anim: null, pai: m0.id, lh: 1.1 })
          const raia = frame('cartao', 0, 0, colW, 1, { gap: 16, pad: 32, pai: col.id, w: 'fill', extra: { ...cartao(false), radius: raioCartao, enterAnimation: animItem(k) } })
          raias.push(raia)
          texto('item', p.titulo, { x: 0, y: 0, w: colW - 64, fonte: 'titulo', tamanhos: n > 4 ? [32, 28, 26] : [36, 32, 28], max: 4, anim: animItem(k), pai: raia.id, fill: true })
          if (p.desc) texto('texto', p.desc, { x: 0, y: 0, w: colW - 64, tamanhos: n > 4 ? [22, 20] : [25, 23, 21], max: 4, cor: s.suave, anim: animItem(k), pai: raia.id, fill: true })
          if (p.resp || p.prazo) {
            const pe = frame('grupo', 0, 0, colW - 64, 1, { gap: 8, pai: raia.id, w: 'fill' })
            linha(0, 0, colW - 64, 1.5, s.linha, { parentId: pe.id, sizingW: 'fill' })
            if (p.resp) {
              texto('dado', 'Responsável', { x: 0, y: 0, w: colW - 64, fonte: 'mono', tamanhos: [16], max: 1, upper: true, cor: s.suave, anim: null, pai: pe.id, fill: true })
              texto('dado', p.resp, { x: 0, y: 0, w: colW - 64, tamanhos: [26, 24, 22], max: 2, peso: 600, cor: s.tinta, anim: animItem(k), pai: pe.id, fill: true })
            }
            if (p.prazo) texto('dado', p.prazo, { x: 0, y: 0, w: colW - 64, fonte: 'mono', tamanhos: [20, 18], max: 1, cor: forte, anim: animItem(k), pai: pe.id, fill: true })
          }
        })
        for (const r0 of raias) layoutDe(r0).gapAuto = true
        igualar(raias, 0)
        assentar(fila, y0, fimConteudo, 0.3)
        const r = resolver()
        const m0 = r.find((l) => l.id === marcas[0]?.id)
        if (m0) fio.y = Math.round(m0.y + dia / 2 - 1.5)
      } else {
        const lista = frame('lista', M, y0, W - M * 2, 1, { gap: st ? 26 : 20 })
        const wResp = st ? 0 : 380
        passos.forEach((p, k) => {
          const lin = frame('linha', 0, 0, W - M * 2, 1, { dir: st ? 'vertical' : 'horizontal', gap: st ? 10 : 32, alY: 'center', pai: lista.id, w: 'fill' })
          texto('indice', String(k + 1).padStart(2, '0'), { x: 0, y: 0, w: st ? 120 : 110, fonte: 'titulo', tamanhos: [st ? 56 : 60], max: 1, lh: 1, cor: forte, anim: animItem(k), pai: lin.id })
          const col = frame('grupo', 0, 0, W - M * 2 - 110 - wResp - 64, 1, { gap: 6, pai: lin.id, w: 'fill' })
          texto('item', p.titulo, { x: 0, y: 0, w: W - M * 2 - 110 - wResp - 64, fonte: 'titulo', tamanhos: st ? [42, 38, 34] : [38, 34, 30], max: 2, anim: animItem(k), pai: col.id, fill: true })
          if (p.desc) texto('texto', p.desc, { x: 0, y: 0, w: W - M * 2 - 110 - wResp - 64, tamanhos: st ? [28, 26] : [24, 22], max: 2, cor: s.suave, anim: animItem(k), pai: col.id, fill: true })
          if (p.resp || p.prazo) texto('dado', [p.resp, p.prazo].filter(Boolean).join(' · '), { x: 0, y: 0, w: st ? W - M * 2 : wResp, fonte: 'mono', tamanhos: [st ? 22 : 20, 18], max: 2, upper: true, align: st ? 'left' : 'right', cor: s.suave, anim: animItem(k), pai: lin.id, hMin: Math.round((st ? 22 : 20) * 1.3 + 22), extra: { background: alfa(forte, 0.08), padding: 10, radius: 999 } })
          if (k < passos.length - 1) linha(0, 0, W - M * 2, 1.5, s.linha, { parentId: lista.id, sizingW: 'fill' })
        })
        espalhar(lista, fimConteudo - y0, st ? 60 : 44)
      }
      break
    }

    // ================================================================ pontos de atenção (alertas discretos)
    case 'alertas.cartoes': {
      const y0 = cabecalho()
      const n = Math.max(1, itens.length)
      const cols = st ? 1 : n === 4 ? 2 : Math.min(3, n)
      const gapA = st ? 22 : GUT
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, cols, gapA, gapA)
      const pad = st ? 32 : 34
      const icone = st ? 48 : 44
      const cartoesA: Camada[] = []
      itens.forEach((it, k) => {
        const [tit = '', desc = ''] = partes(it)
        const card = frame('cartao', 0, 0, cw, 1, { dir: 'horizontal', gap: 24, pad, pai: g.id, extra: { fill: s.tipo === 'escuro' ? alfa(s.tinta, 0.05) : alfa(s.fundo, 0), stroke: s.tipo === 'escuro' ? alfa(s.tinta, 0.2) : misturar(s.linha, s.tinta, 0.2), strokeWidth: 1.5, radius: raioCartao, enterAnimation: animItem(k) } })
        cartoesA.push(card)
        const sinal = frame('marcador', 0, 0, icone, icone, { h: 'fixed', alX: 'center', alY: 'center', pai: card.id, extra: { fill: alfa(negativo, 0.12), radius: icone / 2, enterAnimation: animItem(k) } })
        texto('indice', '!', { x: 0, y: 0, w: icone, fonte: 'titulo', tamanhos: [Math.round(icone * 0.55)], max: 1, align: 'center', cor: negativo, peso: 700, anim: null, pai: sinal.id, lh: 1.05 })
        const col = frame('grupo', 0, 0, cw - pad * 2 - icone - 24, 1, { gap: 10, pai: card.id, w: 'fill' })
        texto('item', tit, { x: 0, y: 0, w: cw - pad * 2 - icone - 24, fonte: 'titulo', tamanhos: st ? [38, 34, 30] : cols >= 3 ? [32, 29, 26] : [36, 32, 28], max: 3, anim: animItem(k), pai: col.id, fill: true })
        if (desc) texto('texto', desc, { x: 0, y: 0, w: cw - pad * 2 - icone - 24, tamanhos: st ? [28, 26] : [25, 23, 21], max: 3, cor: s.suave, anim: animItem(k), pai: col.id, fill: true })
      })
      igualar(cartoesA, 0)
      if (st) espalhar(g, fimConteudo - y0, 60)
      assentar(g, y0, fimConteudo, 0.35)
      break
    }

    // ================================================================ comparação
    case 'comparacao.colunas':
    case 'comparacao.antesDepois': {
      const antes = d.variante === 'comparacao.antesDepois'
      const y0 = cabecalho()
      const cabA = itens[0] ?? 'Hoje'
      const cabB = itens[1] ?? 'Depois'
      const [a, b] = [itens.slice(2).filter((_, k) => k % 2 === 0), itens.slice(2).filter((_, k) => k % 2 === 1)]
      const tamSeta = st ? 64 : 72
      const seta = antes ? (st ? 90 : 120) : 0
      const w = st ? W - M * 2 : Math.floor((W - M * 2 - (antes ? seta : GUT)) / 2)
      const destaqueA = d.destaque === 0
      const fila = frame('comparacao', M, y0, W - M * 2, 1, { dir: st ? 'vertical' : 'horizontal', gap: antes ? (seta - tamSeta) / 2 : st ? 40 : GUT, alX: st ? 'center' : 'start', alY: 'center' })
      const caixas: Camada[] = []
      const pad = st ? 48 : 52
      ;[{ cab: cabA, linhas: a }, { cab: cabB, linhas: b }].forEach((col, k) => {
        const dest = antes ? k === 1 : destaqueA ? k === 0 : k === 1
        const fill = dest ? forte : antes ? s.fundo : s.cartao
        const cx = frame('caixa', 0, 0, w, 1, { gap: 24, pad, pai: fila.id, extra: { ...(antes && !dest ? { fill, stroke: s.linha, strokeWidth: 2 } : cartao(dest, fill)), radius: raioCartao, enterAnimation: animItem(k) } })
        caixas.push(cx)
        const corT = dest ? sobreDestaque : antes ? s.suave : s.tinta
        texto('cab', col.cab, { x: 0, y: 0, w: w - pad * 2, fonte: 'titulo', tamanhos: [52, 46, 40], max: 2, cor: corT, anim: animItem(k), pai: cx.id, fill: true })
        linha(0, 0, w - pad * 2, 2, dest ? alfa(sobreDestaque, 0.3) : s.linha, { parentId: cx.id, sizingW: 'fill' })
        texto('texto', col.linhas.join('\n') || '—', { x: 0, y: 0, w: w - pad * 2, tamanhos: st ? [38, 34, 30] : [34, 31, 28], max: 8, lh: 1.7, cor: dest ? sobreDestaque : antes ? s.suave : s.tinta, anim: animItem(k + 1), pai: cx.id, fill: true })
        if (antes && k === 0) forma('seta', 'arrow', 0, 0, tamSeta, tamSeta, { fill: forte, rotation: st ? 90 : 0, enterAnimation: animForma(400), parentId: fila.id })
      })
      igualar(caixas, esc(st ? 300 : 400))
      assentar(fila, y0)
      break
    }

    // ================================================================ linha do tempo
    case 'linhaTempo.horizontal':
    case 'linhaTempo.vertical': {
      const y0 = cabecalho()
      const marcos = itens.map((it) => { const [data = '', ...r] = partes(it); return { data, marco: r.join(' ') } })
      const n = Math.max(1, marcos.length)
      if (d.variante === 'linhaTempo.horizontal' && !st) {
        const passo = Math.floor((W - M * 2) / n)
        const tams = n > 4 ? [38, 34, 30] : [50, 44, 38]
        // mesmo corpo em todas as datas: os pontos ficam numa linha só
        const tamData = Math.min(...marcos.map((x) => caberTitulo(x.data || '—', passo - 28, tams, 1).tamanho))
        const fio = linha(M, y0, W - M * 2, 3, s.linha, { enterAnimation: { type: 'reveal', duration: 1000, delay: 100, easing: 'easeOut' } })
        const fila = frame('marcos', M, y0, W - M * 2, 1, { dir: 'horizontal' })
        const pontos: Camada[] = []
        marcos.forEach((x, k) => {
          const dest = ehDestaque(k)
          const dot = dest ? 40 : 26
          const col = frame('marco', 0, 0, passo, 1, { gap: 20, pai: fila.id })
          texto('item', x.data, { x: 0, y: 0, w: passo - 28, fonte: 'titulo', tamanhos: [tamData], escalado: true, max: 1, cor: dest ? forte : s.tinta, anim: animItem(k), pai: col.id })
          const ponto = frame('grupo', 0, 0, passo, 40, { h: 'fixed', alY: 'center', pai: col.id, w: 'fill' })
          pontos.push(ponto)
          forma('marcador', 'ellipse', 0, 0, dot, dot, { fill: forte, enterAnimation: animItem(k), parentId: ponto.id })
          texto('texto', x.marco, { x: 0, y: 0, w: passo - 36, tamanhos: n > 4 ? [28, 26, 24] : [33, 30, 27], max: 4, cor: s.suave, anim: animItem(k), pai: col.id })
        })
        assentar(fila, y0, fimConteudo, 0.3)
        const p0 = resolver().find((l) => l.id === pontos[0]?.id)
        if (p0) fio.y = Math.round(p0.y + p0.height / 2 - 1)
      } else {
        const fio = linha(M + 12, y0, 3, 10, s.linha, { enterAnimation: { type: 'reveal', duration: 1000, delay: 100, easing: 'easeOut' } })
        const lista = frame('lista', M, y0, W - M * 2, 1, { gap: 32 })
        const pontos: Camada[] = []
        // slides: ponto · data (até a coluna 4) · descrição (da coluna 5 ao fim); story: ponto · data sobre a descrição
        const xMarco = xc(4)
        const gapL = st ? 30 : 24
        const wData = st ? W - M * 2 - 26 - 6 - gapL : Math.round(xMarco - (M + 26 + 6 + gapL) - gapL)
        marcos.forEach((x, k) => {
          const dest = ehDestaque(k)
          const lin = frame('linha', 0, 0, W - M * 2, 1, { dir: 'horizontal', gap: gapL, pai: lista.id, w: 'fill' })
          const ponto = frame('grupo', 0, 0, 32, 1, { w: 'hug', pad: { top: 6, right: 6, bottom: 0, left: 0 }, pai: lin.id })
          pontos.push(ponto)
          forma('marcador', 'ellipse', 0, 0, 26, 26, { fill: forte, enterAnimation: animItem(k), parentId: ponto.id })
          if (st) {
            const col = frame('grupo', 0, 0, wData, 1, { gap: 8, pai: lin.id, w: 'fill' })
            texto('item', x.data, { x: 0, y: 0, w: wData, fonte: 'mono', tamanhos: [26], max: 1, cor: forte, upper: true, anim: animItem(k), pai: col.id, fill: true })
            texto('texto', x.marco, { x: 0, y: 0, w: wData, tamanhos: [40, 36, 32], max: 2, cor: s.tinta, anim: animItem(k), pai: col.id, fill: true })
          } else {
            texto('item', x.data, { x: 0, y: 0, w: wData, fonte: 'titulo', tamanhos: [36, 32, 28], max: 1, cor: dest ? forte : s.tinta, anim: animItem(k), pai: lin.id })
            texto('texto', x.marco, { x: 0, y: 0, w: W - M - xMarco, tamanhos: [32, 29, 26], max: 2, cor: s.suave, anim: animItem(k), pai: lin.id, fill: true })
          }
        })
        espalhar(lista, fimConteudo - y0, st ? 96 : 72)
        const r = resolver()
        const cs = pontos.map((p) => r.find((l) => l.id === p.id)!).map((b) => ({ x: b.x + 13, y: b.y + 6 + 13 }))
        fio.x = Math.round((cs[0]?.x ?? M + 13) - 1.5)
        fio.y = Math.round(cs[0]?.y ?? y0)
        fio.height = Math.max(1, Math.round((cs[cs.length - 1]?.y ?? y0) - (cs[0]?.y ?? y0)))
      }
      break
    }

    // ================================================================ citação
    case 'citacao.grande': {
      const larg = st ? W - M * 2 : W * 0.78
      const tam = st ? [84, 74, 64, 56, 50] : [96, 84, 74, 64, 56, 50]
      const col = frame('citacao', M, 0, larg, 1, { gap: 48 })
      const frase = frame('grupo', M, 0, larg, 1, { gap: 8, pai: col.id, w: 'fill' })
      aspas(frase.id, st ? 300 : 340)
      texto('titulo', d.titulo, { x: 0, y: 0, w: larg, fonte: 'titulo', tamanhos: tam, max: 6, italic: F.italicoCitacao, tracking: F.tracking * 0.6, lh: 1.08, anim: animTitulo(), pai: frase.id, fill: true })
      if (d.texto) {
        const autor = frame('grupo', 0, 0, larg, 1, { dir: 'horizontal', gap: 24, alY: 'center', pai: col.id, w: 'fill' })
        linha(0, 0, 56, 3, forte, { parentId: autor.id })
        texto('autor', d.texto, { x: 0, y: 0, w: larg - 80, fonte: 'mono', tamanhos: [st ? 26 : 22], max: 2, upper: true, tracking: -0.1, cor: s.suave, pai: autor.id, fill: true })
      }
      const h = altura(col)
      colocar(col, M, st ? Math.max(H * 0.12, (H - h) / 2) : Math.max(MT - 20, (H - h) / 2))
      break
    }
    case 'citacao.depoimento': {
      if (d.rotulo) kicker(d.rotulo, M, MT, W - M * 2)
      const y0 = d.rotulo ? MT + (R.rotulo === 'fio' ? 96 : 80) : MT + 40
      const cx = st ? M : M + wc(1) + GUT
      const cwid = st ? W - M * 2 : wc(10)
      const ch = fimConteudo - y0
      const pad = st ? 64 : 88
      const card = frame('cartao', cx, y0, cwid, ch, { h: 'fixed', gap: 56, pad, alY: 'center', extra: { ...cartao(false), radius: raioCartao, enterAnimation: animForma(0) } })
      const frase = frame('grupo', 0, 0, cwid - pad * 2, 1, { gap: 12, pai: card.id, w: 'fill' })
      aspas(frase.id, 180)
      texto('titulo', d.titulo, { x: 0, y: 0, w: cwid - pad * 2, fonte: 'titulo', tamanhos: st ? [64, 56, 50, 44] : [64, 56, 50, 44, 40], max: st ? 8 : 4, italic: F.italicoCitacao, tracking: F.tracking * 0.5, lh: 1.12, anim: animTitulo(), pai: frase.id, fill: true })
      if (d.texto) {
        const autor = frame('grupo', 0, 0, cwid - pad * 2, 1, { dir: 'horizontal', gap: 28, alY: 'center', pai: card.id, w: 'fill' })
        avatar(autor.id, 0, 0, 80, forte, sobreDestaque, d.texto, animForma(300))
        texto('autor', d.texto, { x: 0, y: 0, w: cwid - pad * 2 - 108, tamanhos: st ? [30, 26] : [28, 25], max: 2, peso: 600, cor: s.tinta, pai: autor.id, fill: true })
      }
      break
    }

    // ================================================================ imagem
    case 'imagem.lateral': {
      const imgW = st ? W : W * 0.5
      const imgH = st ? H * 0.5 : H
      espacoImagem(st ? 0 : W - imgW, 0, imgW, imgH, d.imagem)
      const larg = st ? W - M * 2 : W - imgW - M - 72
      const b = bloco({ x: M, y: 0, w: larg, rotulo: d.rotulo, tamanhos: st ? [88, 76, 66, 58] : [96, 84, 72, 64, 56], max: 4, gapRotulo: 22, gapTexto: 32, texto: { tamanhos: st ? [36, 32] : [30, 27], max: 6 } })
      colocar(b, M, st ? imgH + 80 : Math.max(MT, (H - altura(b)) / 2))
      break
    }
    case 'imagem.cheia': {
      espacoImagem(0, 0, W, H, d.imagem)
      forma('veu', 'rect', 0, H * 0.4, W, H * 0.6, { fill: s.fundo, gradient: { type: 'linear', angle: 180, stops: [{ color: alfa(s.fundo, 0), pos: 0 }, { color: alfa(s.fundo, 0.92), pos: 100 }] } })
      const larg = st ? W - M * 2 : W * 0.7
      const b = bloco({ x: M, y: 0, w: larg, rotulo: d.rotulo, tamanhos: [120, 104, 90, 78], max: 3, gapTexto: 28, texto: { w: st ? larg : W * 0.5, tamanhos: st ? [36, 32] : [30, 27], max: 3 } })
      colocar(b, M, Math.max(MT, H - MB - altura(b)))
      break
    }
    case 'imagem.moldura': {
      const col = frame('coluna', M, MT, W - M * 2, 1, { gap: 28 })
      const b = bloco({ x: M, y: MT, w: st ? W - M * 2 : wc(8), rotulo: d.rotulo, tamanhos: st ? [72, 64, 56] : [64, 56, 50], max: 2, simples: true, pai: col.id })
      layoutDe(b).padding.bottom = 16
      const yI = MT + altura(b) + 28
      const hI = Math.max(200, fimConteudo - yI - (d.texto ? (st ? 170 : 90) : 0))
      espacoImagem(M, yI, W - M * 2, hI, d.imagem, raioCartao, col.id)
      if (d.texto) texto('texto', d.texto, { x: M, y: 0, w: st ? W - M * 2 : wc(8), tamanhos: st ? [32, 28] : [26, 24], max: 2, cor: s.suave, pai: col.id })
      break
    }

    // ================================================================ galeria
    case 'galeria.grade':
    case 'galeria.mosaico': {
      const y0 = cabecalho()
      const lista = itens.length ? itens : ['Imagem', 'Imagem', 'Imagem']
      const legenda = st ? 110 : 100
      const mosaico = d.variante === 'galeria.mosaico' && !st && lista.length >= 3
      const areaH = fimConteudo - y0
      const celula = (pai: string, w: number, hImg: number, tit: string, desc: string, k: number, comLegenda: boolean) => {
        const cel = frame('celula', 0, 0, w, 1, { gap: 18, pai })
        espacoImagem(0, 0, w, hImg, comLegenda ? '' : tit, Math.min(raioCartao, 20), cel.id)
        if (comLegenda) {
          const leg = frame('grupo', 0, 0, w, 1, { gap: 2, pai: cel.id, w: 'fill' })
          texto('item', tit, { x: 0, y: 0, w, tamanhos: st ? [30, 26] : [26, 24], max: 1, peso: 600, anim: animItem(k), pai: leg.id, fill: true })
          if (desc) texto('texto', desc, { x: 0, y: 0, w, tamanhos: st ? [24, 22] : [21, 19], max: 1, cor: s.suave, anim: animItem(k), pai: leg.id, fill: true })
        }
        return cel
      }
      if (mosaico) {
        const menores = Math.min(lista.length, 4) - 1
        const hMenor = Math.floor((areaH - (menores - 1) * GUT) / Math.max(1, menores))
        const fila = frame('galeria', M, y0, W - M * 2, 1, { dir: 'horizontal', gap: GUT })
        const [tit0 = '', desc0 = ''] = partes(lista[0]!)
        celula(fila.id, Math.round(wc(7)), areaH - legenda, tit0, desc0, 0, true)
        const lado = frame('grupo', 0, 0, Math.round(wc(5)), 1, { gap: GUT, pai: fila.id })
        lista.slice(1, menores + 1).forEach((it) => {
          const [tit = ''] = partes(it)
          espacoImagem(0, 0, Math.round(wc(5)), hMenor, tit, Math.min(raioCartao, 20), lado.id)
        })
      } else {
        const cols = st ? 2 : lista.length === 4 ? 4 : Math.min(3, Math.max(1, lista.length))
        const linhasG = Math.ceil(lista.length / cols)
        const { g, cw } = gradeAL('galeria', M, y0, W - M * 2, cols, GUT)
        const hCel = Math.floor((areaH - (linhasG - 1) * GUT) / linhasG)
        lista.forEach((it, k) => {
          const [tit = '', desc = ''] = partes(it)
          celula(g.id, cw, Math.max(120, hCel - legenda), tit, desc, k, true)
        })
      }
      break
    }

    // ================================================================ equipe
    case 'equipe.grade':
    case 'equipe.lista': {
      const y0 = cabecalho()
      const pessoas = itens.map((it) => { const [nome = '', ...r] = partes(it); return { nome, papel: r.join(' · ') } })
      if (d.variante === 'equipe.lista' || (st && pessoas.length > 4)) {
        const av = esc(st ? 96 : 72)
        const lista = frame('lista', M, y0, W - M * 2, 1, { gap: 22 })
        const wNome = st ? W - M * 2 - av - 32 : wc(5)
        pessoas.forEach((p, k) => {
          const lin = frame('linha', 0, 0, W - M * 2, 1, { dir: 'horizontal', gap: 32, alY: 'center', pai: lista.id, w: 'fill' })
          avatar(lin.id, 0, 0, av, k % 2 ? s.cartao : forte, k % 2 ? forte : sobreDestaque, p.nome, animItem(k))
          if (st) {
            const col = frame('grupo', 0, 0, wNome, 1, { gap: 6, pai: lin.id, w: 'fill' })
            texto('item', p.nome, { x: 0, y: 0, w: wNome, fonte: 'titulo', tamanhos: [44, 40], max: 1, anim: animItem(k), pai: col.id, fill: true })
            texto('texto', p.papel, { x: 0, y: 0, w: wNome, tamanhos: [30, 28], max: 1, cor: s.suave, anim: animItem(k), pai: col.id, fill: true })
          } else {
            texto('item', p.nome, { x: 0, y: 0, w: wNome, fonte: 'titulo', tamanhos: [38, 34, 30], max: 1, anim: animItem(k), pai: lin.id })
            texto('texto', p.papel, { x: 0, y: 0, w: wc(6), tamanhos: [28, 25], max: 1, cor: s.suave, anim: animItem(k), pai: lin.id, fill: true })
          }
          if (k < pessoas.length - 1) linha(0, 0, W - M * 2, 2, s.linha, { parentId: lista.id, sizingW: 'fill' })
        })
        espalhar(lista, fimConteudo - y0, st ? 64 : 40)
        break
      }
      const colsE = st ? 2 : pessoas.length <= 4 ? Math.max(1, pessoas.length) : 3
      const linhasE = Math.ceil(pessoas.length / colsE)
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, colsE, GUT, st ? 48 : 56)
      const hCel = (fimConteudo - y0 - (linhasE - 1) * (st ? 48 : 56)) / Math.max(1, linhasE)
      const dia = Math.round(Math.max(64, Math.min(cw * 0.62, hCel - 150, st ? 300 : 230)))
      pessoas.forEach((p, k) => {
        const cel = frame('celula', 0, 0, cw, 1, { gap: 26, alX: 'center', pai: g.id })
        const fundoAv = k % 2 ? s.cartao : misturar(s.fundo, forte, 0.85)
        avatar(cel.id, 0, 0, dia, fundoAv, k % 2 ? forte : legivel(fundoAv, [sobreDestaque, s.tinta, s.fundo], 3), p.nome, animItem(k))
        const nomes = frame('grupo', 0, 0, cw, 1, { gap: 8, alX: 'center', pai: cel.id, w: 'fill' })
        texto('item', p.nome, { x: 0, y: 0, w: cw, fonte: 'titulo', tamanhos: st ? [42, 38, 34] : [40, 36, 32], max: 2, align: 'center', anim: animItem(k), pai: nomes.id, fill: true })
        if (p.papel) texto('texto', p.papel, { x: 0, y: 0, w: cw, tamanhos: st ? [30, 27] : [27, 25], max: 2, cor: s.suave, align: 'center', anim: animItem(k), pai: nomes.id, fill: true })
      })
      assentar(g, y0)
      break
    }

    // ================================================================ preços
    case 'precos.colunas': {
      const y0 = cabecalho({ semTexto: false })
      const planos = itens.map((it) => { const [nome = '', preco = '', ...r] = partes(it); return { nome, preco, beneficios: r.join(';').split(/;\s*/).map((b) => b.trim()).filter(Boolean).slice(0, 5) } })
      const destaque = d.destaque >= 0 && d.destaque < planos.length ? d.destaque : planos.length >= 3 ? 1 : planos.length - 1
      const cols = st ? 1 : Math.max(1, Math.min(4, planos.length <= 4 ? planos.length : Math.ceil(planos.length / 2)))
      const { g, cw } = gradeAL('grade', M, y0, W - M * 2, cols, st ? 28 : GUT)
      const pad = 44
      const iw = cw - pad * 2
      const cartoes: Camada[] = []
      planos.forEach((p, k) => {
        const dest = k === destaque && planos.length > 1
        const corT = dest ? sobreDestaque : s.tinta
        const card = frame('cartao', 0, 0, cw, 1, { dir: st ? 'horizontal' : 'vertical', gap: st ? 32 : 20, pad, pai: g.id, extra: { ...cartao(dest), radius: raioCartao, enterAnimation: animItem(k) } })
        cartoes.push(card)
        const wTopo = st ? Math.round(iw * 0.5 - 16) : iw
        const topo = frame('grupo', 0, 0, wTopo, 1, { gap: st ? 12 : 20, pai: card.id, w: 'fill' })
        const cab = frame('grupo', 0, 0, wTopo, 1, { dir: 'horizontal', gap: 16, alY: 'center', pai: topo.id, w: 'fill' })
        texto('item', p.nome, { x: 0, y: 0, w: wTopo - (dest ? 216 : 0), fonte: 'titulo', tamanhos: st ? [44, 40] : [38, 34, 30], max: 1, cor: corT, anim: animItem(k), pai: cab.id, fill: true })
        if (dest) texto('selo', 'Recomendado', { x: 0, y: 0, w: 200, fonte: 'mono', tamanhos: [st ? 20 : 17], max: 1, upper: true, align: 'right', cor: corT, anim: null, pai: cab.id })
        texto('preco', p.preco || '—', { x: 0, y: 0, w: wTopo, fonte: 'titulo', tamanhos: st ? [72, 64, 56] : planos.length > 3 ? [56, 48, 42] : [68, 60, 52, 46], max: 1, cor: corT, lh: 1.05, anim: animItem(k), pai: topo.id, fill: true })
        if (p.beneficios.length) {
          if (!st) linha(0, 0, iw, 2, dest ? alfa(sobreDestaque, 0.3) : s.linha, { parentId: card.id, sizingW: 'fill' })
          texto('beneficios', p.beneficios.map((b) => `+  ${b}`).join('\n'), { x: 0, y: 0, w: st ? Math.round(iw * 0.5 - 16) : iw, tamanhos: st ? [28, 26, 24] : [26, 24, 22], max: 6, lh: 1.65, cor: dest ? alfa(sobreDestaque, 0.9) : s.suave, anim: animItem(k + 1), pai: card.id, fill: !st })
        }
      })
      if (!st) igualar(cartoes, 0)
      if (st) espalhar(g, fimConteudo - y0, 48)
      assentar(g, y0)
      break
    }

    // ================================================================ paleta e tipografia
    case 'paleta.faixas': {
      const cores = (itens.length ? itens : [`Principal|${t.acento}`, `Fundo|${t.claro.fundo}`, `Tinta|${t.claro.tinta}`]).slice(0, 5).map((it) => { const [nome = '', hex = ''] = partes(it); return { nome, hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : t.acento } })
      const larg = st ? W : Math.ceil(W / cores.length)
      const alt = st ? Math.ceil(H / cores.length) : H
      const faixas = cores.map((cor, k) => {
        const f = frame('cor', st ? 0 : k * larg, st ? k * alt : 0, larg, alt, { h: 'fixed', alY: 'end', pad: { top: 48, right: 48, bottom: st ? 44 : 64, left: 48 }, extra: { fill: cor.hex, enterAnimation: { type: 'slideUp', duration: 650, delay: k * 100, easing: 'easeOut' } } })
        texto('nomecor', `${cor.nome}\n${cor.hex}`, { x: 0, y: 0, w: larg - 96, fonte: 'mono', tamanhos: [st ? 26 : 24], max: 3, lh: 1.6, cor: legivel(cor.hex, ['#141414', '#FAFAF9'], 4.5), anim: animItem(k), pai: f.id, fill: true })
        return f
      })
      const cor0 = cores[0]!.hex
      // o rótulo fica no alto da primeira faixa, fora do fluxo (absoluto)
      texto('rotulo', `${String(c.numero).padStart(2, '0')} · ${d.titulo}`, { x: 48, y: st ? 56 : 48, w: (st ? W : larg) - 96, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, upper: true, cor: legivel(cor0, ['#141414', '#FAFAF9'], 4.5), anim: null, extra: { parentId: faixas[0]!.id, absolute: true } })
      break
    }
    case 'tipografia.amostra': {
      const b = bloco({ x: M, y: MT, w: st ? W - M * 2 : wc(6), rotulo: d.rotulo || 'Tipografia', tamanhos: st ? [72, 64] : [64, 56], max: 2, simples: true, gapRotulo: 20 })
      const fimB = fimDe(b)
      const aa = texto('aa', 'Aa', { x: M - 10, y: Math.max(st ? H * 0.22 : H * 0.28, fimB + 32), w: st ? W - M * 2 : W * 0.42, fonte: 'titulo', tamanhos: [st ? 380 : 460], max: 1, lh: 1, cor: forte, anim: animForma(150) })
      const xA = st ? M : W * 0.52
      const wA = st ? W - M * 2 : W * 0.48 - M
      const col = frame('amostras', xA, st ? Math.max(H * 0.52, aa.fim + 40) : Math.max(H * 0.32, fimB + 48), wA, 1, { gap: 48 })
      const amostra = `${F.titulo} — títulos\n${F.texto} — textos\n\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 — !?&@`
      texto('amostra', amostra, { x: 0, y: 0, w: wA, tamanhos: st ? [34, 30] : [34, 30], max: 8, cor: s.tinta, pai: col.id, fill: true })
      if (d.texto) texto('texto', d.texto, { x: 0, y: 0, w: wA, tamanhos: [26, 24], max: 3, cor: s.suave, pai: col.id, fill: true })
      break
    }

    // ================================================================ chamada e encerramento
    case 'cta.botao':
    case 'cta.faixa': {
      const faixa = d.variante === 'cta.faixa' || centro
      const larg = st ? W - M * 2 : faixa ? W * 0.76 : W * 0.62
      const x = faixa ? (W - larg) / 2 : M
      const al = faixa ? 'center' : 'left'
      const [botao = '', ...contatos] = itens
      const tam = st ? [110, 96, 84, 72] : [128, 110, 96, 84, 72]
      if (!faixa) motivo(st ? W * 0.6 : W * 0.72, st ? H * 0.06 : H * 0.56, st ? W * 0.32 : W * 0.2, st ? W * 0.32 : W * 0.2, 'pequeno')
      const col = frame('chamada', x, 0, larg, 1, { gap: 52, alX: faixa ? 'center' : 'start' })
      bloco({ x, y: 0, w: larg, rotulo: d.rotulo, tamanhos: tam, max: 3, align: al, gapRotulo: 24, gapTexto: 36, pai: col.id, texto: { w: st ? larg : W * 0.56, tamanhos: st ? [36, 32] : [32, 28], max: 3 } })
      if (botao) {
        const tamB = st ? 34 : 30
        const wB = Math.min(larg, Math.round(botao.length * tamB * 0.58 + tamB * 2.6 + 40))
        const fundoB = s.tipo === 'acento' ? s.tinta : forte
        texto('item', `${botao}  →`, { x: 0, y: 0, w: wB, tamanhos: [tamB], max: 1, peso: 600, cor: legivel(fundoB, [s.fundo, sobreDestaque, '#FFFFFF', '#141414'], 4.5), align: 'center', anim: animForma(400), extra: { background: fundoB, padding: Math.round(tamB * 0.7), radius: 999 }, hMin: Math.round(tamB * 2.8), pai: col.id })
      }
      const cts = contatos.slice(0, 2)
      if (cts.length) {
        const wct = st ? larg : 520
        const fila = frame('contatos', 0, 0, larg, 1, { dir: st ? 'vertical' : 'horizontal', gap: st ? 28 : 40, alX: faixa ? 'center' : 'start', pai: col.id, w: 'fill' })
        cts.forEach((ct, j) => {
          const [rot = '', valor = ''] = partes(ct)
          texto('contato', valor ? `${rot}\n${valor}` : rot, { x: 0, y: 0, w: wct, tamanhos: st ? [30, 26] : [26, 24], max: 2, lh: 1.5, cor: s.suave, align: faixa && !st ? 'center' : al, anim: animTexto(500 + j * 100), pai: fila.id })
        })
      }
      colocar(col, x, Math.max(MT, (H - altura(col)) / 2))
      break
    }
    case 'encerramento.centrado':
    case 'encerramento.contato': {
      const contato = d.variante === 'encerramento.contato' && !st
      const topoLivre = MT + (c.logo ? 110 : 0)
      if (contato) {
        const linhas = itens.length ? itens : d.texto ? [d.texto] : []
        const b = bloco({ x: M, y: 0, w: wc(7), rotulo: d.rotulo, tamanhos: [168, 144, 124, 104, 88], max: 3, gapTexto: 40, texto: itens.length ? { w: wc(6), tamanhos: [30, 27], max: 2 } : null })
        colocar(b, M, Math.max(topoLivre, (H - altura(b)) / 2))
        if (linhas.length) {
          const xd = xc(8)
          const lado = frame('contatos', xd, 0, W - M - xd, 1, { dir: 'horizontal', gap: 41 })
          linha(0, 0, 3, 1, forte, { parentId: lado.id, sizingH: 'fill' })
          const lista = frame('grupo', 0, 0, wc(4) - 44, 1, { gap: 36, pai: lado.id, w: 'fill' })
          linhas.slice(0, 3).forEach((ct, j) => {
            const [rot = '', valor = ''] = partes(ct)
            texto('contato', valor ? `${rot}\n${valor}` : rot, { x: 0, y: 0, w: W - M - xd - 44, tamanhos: [30, 27, 24], max: 3, lh: 1.5, cor: s.tinta, anim: animItem(j), pai: lista.id, fill: true })
          })
          colocar(lado, xd, Math.max(topoLivre, (H - altura(lado)) / 2))
        }
        break
      }
      const larg = W - M * 2
      const tam = st ? [150, 128, 110, 96, 84] : [200, 170, 144, 124, 104, 92]
      // cabe o título, o motivo acima e o texto/contatos abaixo
      const hMax = H - MT * 2 - (decorar ? 160 : 40) - (d.texto ? 110 : 0) - itens.length * 52
      const col = frame('encerramento', M, 0, larg, 1, { gap: 28, alX: 'center' })
      bloco({ x: M, y: 0, w: larg, rotulo: null, tamanhos: tam, max: 3, hMax, align: 'center', gapTexto: 40, pai: col.id, texto: { tamanhos: st ? [38, 34] : [34, 30], max: 2 } })
      if (itens.length) {
        const cts = frame('contatos', 0, 0, larg, 1, { gap: 22, alX: 'center', pai: col.id, w: 'fill' })
        itens.slice(0, 3).forEach((ct, j) => {
          const [rot = '', valor = ''] = partes(ct)
          texto('contato', valor ? `${rot}  ${valor}` : rot, { x: 0, y: 0, w: larg, fonte: 'mono', tamanhos: [st ? 26 : 22], max: 1, cor: s.suave, align: 'center', anim: animItem(j), pai: cts.id, fill: true })
        })
      }
      const h = altura(col)
      const yT = Math.max(topoLivre + (decorar ? 140 : 0), (H - h) / 2 - (d.texto || itens.length ? 30 : 0))
      colocar(col, M, yT)
      if (decorar) {
        const lado = st ? 120 : 96
        const alt = formaMotivo === 'semicircle' ? lado / 2 : lado
        if (t.motivo === 'formas') forma('motivo', formaMotivo, W / 2 - lado / 2, yT - alt - 56, lado, alt, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
        else if (t.motivo === 'brilho') motivo(W / 2 - (st ? 400 : 520), H / 2 - (st ? 400 : 420), st ? 800 : 1040, st ? 800 : 840, 'pequeno')
        else linha(W / 2 - 40, yT - 64, 80, 6, corMotivo, { name: 'motivo', radius: 3 })
      }
      break
    }
  }

  if (temRodape) {
    // grade suíça e acadêmico: fio cheio acima do cabeçalho
    if (R.fioCabecalho) linha(M, MT - (st ? 40 : 34), W - M * 2, 3, s.tinta, { name: 'fio-topo', enterAnimation: { type: 'reveal', duration: dur(800), delay: 0, easing: 'easeOut' } })
    motivoCanto()
    rodape()
  }
  // logo da marca na capa e no encerramento (canto superior; centrado na capa centrada)
  if (c.logo && (d.tipo === 'capa' || d.tipo === 'encerramento')) {
    const hl = st ? 84 : d.variante === 'capa.tipografica' ? 44 : 72
    const wl = st ? 320 : 340
    if (d.tipo === 'encerramento') logo(M, MT - 10, wl * 0.8, hl * 0.85)
    else if (d.variante === 'capa.centrada') logo((W - wl) / 2, MT - 10, wl, hl, 'center')
    else logo(W - M - wl, MT - 10, wl, hl, 'right')
  }
  // auto layout resolvido: posição e tamanho finais (o editor continua o layout ao editar)
  const final = resolver()
  // conteúdo maior que a área (textos longos, muitos itens): monta de novo, menor, em vez de transbordar
  const limite = temRodape ? fimConteudo + 6 : H - Math.round(MB * 0.4)
  const transborda = d.variante !== 'paleta.faixas' && final.some((l) => (l.type === 'text' || l.type === 'frame') && !/^(rodape|pagina|imagem|logo)/.test(l.id) && (l.y + l.height > limite || l.x + l.width > W + 2))
  if (transborda && E > 0.5) return montarTela(d, c, { escala: E * 0.88, fotos: interno.fotos })
  // garante que nada saia muito da tela (o schema aceita, mas a prévia corta)
  for (const l of final) {
    if (l.type === 'text') l.height = Math.max(1, Math.min(l.height, H * 1.2))
  }
  const gradiente = s.tipo !== 'acento' && (s as Superficie).gradiente ? (s as Superficie).gradiente : undefined
  return {
    layers: final.map((l, i) => ({ ...l, z: i })),
    background: s.fundo,
    ...(gradiente ? { backgroundGradient: { type: 'linear' as const, angle: gradiente.angle, stops: gradiente.stops } } : {}),
  }
}

/** Ainda cabe no layout? (usado pela normalização para cortar o excesso sem quebrar a tela). */
export const limitesDe = (tipo: TipoTela) => COMPONENTES[tipo].limites
