/**
 * Motor de montagem do design system: transforma uma tela desenhada (componente + variante + conteúdo,
 * escolhidos pela IA ou pelo gerador local) e um tema em camadas do schema de cena.
 * Grade de 12 colunas (slides 16:9) ou 6 colunas (story 9:16), escala tipográfica com ajuste de tamanho
 * por medição aproximada do texto, cores por superfície (claro/escuro/acento) com contraste checado,
 * motivo decorativo do tema (com o mesmo nome em todas as telas, para a transição morph) e rodapé.
 * Os ids das camadas carregam o papel ("titulo-", "texto-", "item-", "valor-"…), usado pelas ações de IA
 * do editor (lib/ia/tela.ts). Puro: sem rede, sem DOM.
 */
import { COMPONENTES, alfa, contraste, legivel, misturar, superficie, type Alinhamento, type Decoracao, type Fundo, type Superficie, type TemaVisual, type TipoTela } from './designSystem'

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
}

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
  const medir = (t: number) => contarLinhas(texto, fonte, t, largura, { maiusculas: opcoes.maiusculas, espacamento: -(opcoes.tracking ?? 0) * t, peso: opcoes.peso })
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
const iniciais = (nome: string) => nome.split(/[\s,]+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '•'

// ---------------------------------------------------------------- montagem

export function montarTela(d: TelaDesenhada, c: ContextoMontagem): TelaMontada {
  const t = c.tema
  const fundo: Fundo = d.variante === 'imagem.cheia' ? 'escuro' : d.fundo
  const s = superficie(t, fundo)
  const st = c.story
  const W = st ? 1080 : 1920
  const H = st ? 1920 : 1080
  const M = st ? 88 : 128
  const MT = st ? 150 : 100
  const MB = st ? 130 : 92
  const GUT = st ? 28 : 36
  const COLS = st ? 6 : 12
  const cw = (W - M * 2 - (COLS - 1) * GUT) / COLS
  const xc = (i: number) => M + i * (cw + GUT)
  const wc = (n: number) => n * cw + (n - 1) * GUT
  const L: Camada[] = []
  const F = t.fontes
  const raioCartao = Math.min(t.raio, 36)
  const decorar = c.motivos && c.estilo !== 'minimal' && d.decoracao !== 'nenhuma' && t.motivo !== 'nenhum'
  const marcante = d.decoracao === 'marcante' || c.estilo === 'ousado'
  const centro = d.alinhamento === 'centro'
  const forte = s.destaque
  const sobreDestaque = legivel(forte, [s.fundo, s.tinta, '#FFFFFF', '#141414'], 4.5)

  // ---------- animações ----------
  const animTitulo = (delay = 0) =>
    c.estilo === 'ousado' ? { type: 'slideUp', duration: 700, delay, easing: 'spring' } : c.estilo === 'minimal' ? { type: 'fadeIn', duration: 500, delay, easing: 'easeOut' } : { type: 'fadeIn', duration: 800, delay, easing: 'easeOut' }
  const animTexto = (delay = 200) => ({ type: 'fadeIn', duration: 600, delay, easing: 'easeOut' })
  const animItem = (k: number) => ({ type: c.estilo === 'minimal' ? 'fadeIn' : 'slideUp', duration: 550, delay: Math.min(4000, 250 + k * 110), easing: 'easeOut' })
  const animForma = (delay = 100) => ({ type: c.estilo === 'ousado' ? 'pop' : 'scaleIn', duration: 800, delay, easing: 'spring' })

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
  }
  const familia = (f: OpTexto['fonte']) => (f === 'titulo' ? F.titulo : f === 'mono' ? 'Geist Mono' : F.texto)
  const texto = (papel: string, txt: string, o: OpTexto) => {
    const fonte = familia(o.fonte)
    const tracking = o.tracking ?? (o.fonte === 'titulo' ? F.tracking : o.fonte === 'mono' ? -0.12 : 0)
    const lh = o.lh ?? (o.fonte === 'titulo' ? (/Serif|Fraunces|Playfair/.test(fonte) ? 1.06 : 1.02) : o.fonte === 'mono' ? 1.3 : 1.42)
    const peso = o.peso ?? (o.fonte === 'titulo' ? F.pesoTitulo : o.fonte === 'mono' ? 500 : 400)
    const { tamanho, linhas } = caber(txt, fonte, o.w, o.tamanhos, o.max ?? 3, { maiusculas: o.upper, tracking, peso, alturaMax: o.hMax, lh })
    const h = Math.max(o.hMin ?? 0, Math.ceil(tamanho * lh * linhas + tamanho * 0.12))
    const l: Camada = {
      id: c.uid(papel), type: 'text', text: txt, x: Math.round(o.x), y: Math.round(o.y), width: Math.round(o.w), height: h,
      fontFamily: fonte, fontSize: tamanho, fontWeight: peso,
      lineHeight: lh, letterSpacing: Math.round(-tracking * tamanho * 10) / 10, color: o.cor ?? s.tinta,
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

  const rotuloCor = s.tipo === 'acento' ? s.tinta : contraste(forte, s.fundo) >= 3 ? forte : s.suave
  const kicker = (txt: string, x: number, y: number, w: number, align: 'left' | 'center' | 'right' = 'left') =>
    txt.trim() ? texto('rotulo', txt.trim(), { x, y, w, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, upper: true, tracking: -0.14, cor: rotuloCor, align, anim: animTexto(0) }) : null

  /** Título com o trecho final em destaque (duas camadas empilhadas) ou numa só. */
  const tituloEnfase = (txt: string, o: Omit<OpTexto, 'tamanhos'> & { tamanhos: number[] }) => {
    const partesEnfase = c.estilo !== 'minimal' ? dividirEnfase(txt, d.enfase) : null
    if (!partesEnfase) return texto('titulo', txt, { fonte: 'titulo', anim: animTitulo(), ...o })
    const fonte = familia('titulo')
    const max = o.max ?? 3
    const linhasEm = (n: number) => caber(partesEnfase[0], fonte, o.w, [n], max, { tracking: F.tracking, peso: F.pesoTitulo }).linhas + caber(partesEnfase[1], fonte, o.w, [n], max, { tracking: F.tracking, peso: F.pesoTitulo }).linhas
    const tam = o.tamanhos.find((n) => linhasEm(n) <= max && (!o.hMax || n * 1.04 * linhasEm(n) <= o.hMax)) ?? o.tamanhos[o.tamanhos.length - 1]!
    // a primeira parte assenta no pé da caixa: a sobra da estimativa de linhas fica acima, não entre as duas partes
    const a = texto('titulo', partesEnfase[0], { fonte: 'titulo', anim: animTitulo(), ...o, tamanhos: [tam], max: 9, extra: { ...o.extra, valign: 'bottom' } })
    const corB = s.tipo === 'acento' ? s.tinta : contraste(forte, s.fundo) >= 2.4 ? forte : s.tinta
    const b = texto('enfase', partesEnfase[1], { fonte: 'titulo', anim: animTitulo(150), ...o, y: a.fim - Math.round(tam * 0.1), tamanhos: [tam], max: 9, cor: corB, italic: F.italicoCitacao && s.tipo !== 'acento' ? true : o.italic })
    return { ...a, h: b.fim - a.l.y, fim: b.fim }
  }

  /** Espaço para imagem: retângulo listrado com a descrição sugerida. */
  const espacoImagem = (x: number, y: number, w: number, h: number, descricao: string, raio = 0) => {
    const base = s.tipo === 'escuro' ? misturar(s.fundo, s.tinta, 0.1) : misturar(s.fundo, s.tinta, 0.13)
    forma('imagem', 'rect', x, y, w, h, { fill: base, pattern: 'stripes', radius: raio, ariaLabel: `Espaço para imagem${descricao ? `: ${descricao}` : ''}`, enterAnimation: { type: 'fadeIn', duration: 700, delay: 100, easing: 'easeOut' } })
    const leg = `▢  ${descricao.trim() || 'arraste sua imagem aqui'}`
    texto('legenda', leg.slice(0, 90), { x: x + 32, y: y + h - (st ? 84 : 72), w: Math.max(200, w - 64), fonte: 'mono', tamanhos: [st ? 22 : 18, 16], max: 2, cor: legivel(base, [s.suave, s.tinta], 3), anim: null })
  }

  // ---------- motivo do tema ----------
  const formaMotivo = t.raio === 0 ? 'rect' : t.raio >= 40 || t.id === 'argila' || t.id === 'ipe' ? 'ellipse' : 'semicircle'
  const corMotivo = s.tipo === 'acento' ? legivel(s.fundo, [t.acento2, s.tinta], 1.6) : s.tipo === 'escuro' ? legivel(s.fundo, [t.acento, t.acento2], 2) : legivel(s.fundo, [t.acento, t.acento2], 1.8)
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
    }
  }
  /** Marca discreta do motivo no canto das telas de conteúdo. */
  const motivoCanto = () => {
    if (!decorar) return
    const tam = st ? 84 : 72
    if (t.motivo === 'linhas') return void forma('motivo', 'rect', W - M - tam, MT + 6, tam, 6, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
    if (t.motivo === 'brilho') return void forma('motivo', 'ellipse', W - (st ? 420 : 560), -(st ? 260 : 300), st ? 640 : 820, st ? 640 : 820, { name: 'motivo', fill: corMotivo, opacity: s.tipo === 'escuro' ? 0.32 : 0.16, effects: { blur: 100, backdropBlur: 0, blend: 'normal' }, enterAnimation: { type: 'fadeIn', duration: 1200, delay: 0, easing: 'easeOut' } })
    if (t.motivo === 'grade') {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) forma('ponto', 'ellipse', W - M - 6 - j * 22, MT + 2 + i * 22, 6, 6, { fill: corMotivo, opacity: 0.6, enterAnimation: { type: 'fadeIn', duration: 400, delay: 80 + (i + j) * 40, easing: 'easeOut' } })
      return void forma('motivo', 'rect', W - M - 6 - 3 * 22 - 34, MT + 2, 20, 20, { name: 'motivo', fill: corMotivo, radius: Math.min(t.raio, 6), enterAnimation: animForma() })
    }
    const alt = formaMotivo === 'semicircle' ? tam / 2 : tam
    forma('motivo', formaMotivo, W - M - tam, MT - 8, tam, alt, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
  }

  // ---------- cabeçalho e rodapé das telas de conteúdo ----------
  /** Rótulo + título + texto. Devolve onde o conteúdo pode começar. */
  const cabecalho = (o: { w?: number; x?: number; tamanhos?: number[]; max?: number; semTexto?: boolean; textoW?: number; y?: number } = {}) => {
    const x = o.x ?? M
    const w = o.w ?? (centro ? W - M * 2 : st ? W - M * 2 : wc(9))
    const al = centro ? 'center' : 'left'
    let y = o.y ?? MT
    const k = kicker(d.rotulo, x, y, w, al)
    if (k) y = k.fim + (st ? 22 : 18)
    const tt = tituloEnfase(d.titulo, { x, y, w, tamanhos: o.tamanhos ?? (st ? [88, 80, 72, 64, 56] : [88, 80, 72, 64, 56]), max: o.max ?? (st ? 3 : 2), align: al })
    y = tt.fim
    if (d.texto && !o.semTexto) {
      const tx = texto('texto', d.texto, { x: centro ? x + (w - (o.textoW ?? (st ? w : wc(8)))) / 2 : x, y: y + (st ? 28 : 22), w: o.textoW ?? (st ? w : wc(8)), tamanhos: st ? [38, 34] : [32, 29], max: 3, cor: s.suave, align: al })
      y = tx.fim
    }
    return y + (st ? 72 : 56)
  }
  const temRodape = !['capa', 'secao', 'conceito', 'encerramento', 'cta', 'paleta', 'tipografia'].includes(d.tipo) && !['imagem.cheia', 'imagem.lateral', 'citacao.grande'].includes(d.variante)
  const fimConteudo = temRodape ? H - MB - (st ? 56 : 40) : H - MB
  const rodape = () => {
    const tam = st ? 22 : 16
    const esquerda = (c.marca || c.tituloProjeto).slice(0, 48)
    const y = H - MB + (st ? 40 : 34)
    if (esquerda) texto('rodape', esquerda, { x: M, y, w: W / 2, fonte: 'mono', tamanhos: [tam], max: 1, cor: s.suave, opacity: 0.8, anim: null, extra: { name: 'rodape' } })
    texto('pagina', `${String(c.numero).padStart(2, '0')} / ${String(c.total).padStart(2, '0')}`, { x: W - M - 200, y, w: 200, fonte: 'mono', tamanhos: [tam], max: 1, cor: s.suave, opacity: 0.8, align: 'right', anim: null, extra: { name: 'pagina' } })
  }

  /** Grade de n células numa área: colunas por linha conforme a quantidade. */
  const grade = (n: number, x: number, y: number, w: number, h: number, maxCols = st ? 1 : 4, gap = st ? 28 : GUT) => {
    const cols = Math.max(1, Math.min(maxCols, n <= 4 ? n : Math.ceil(n / 2)))
    const linhas = Math.ceil(n / cols)
    const cwid = (w - (cols - 1) * gap) / cols
    const chei = (h - (linhas - 1) * gap) / linhas
    return Array.from({ length: n }, (_, k) => ({ x: x + (k % cols) * (cwid + gap), y: y + Math.floor(k / cols) * (chei + gap), w: cwid, h: chei }))
  }

  const itens = d.itens.filter((i) => i.trim())
  const ehDestaque = (k: number) => d.destaque === k
  /** Posição de um bloco de altura `h` na área de conteúdo: um pouco acima do centro, como na grade de um editorial. */
  const noMeio = (y0: number, h: number) => y0 + Math.max(0, (fimConteudo - y0 - h) * 0.42)
  /** Altura que um texto vai ocupar (sem criar a camada). */
  const medir = (txt: string, fonte: OpTexto['fonte'], w: number, tamanhos: number[], max: number, lh?: number) => {
    const f = familia(fonte)
    const r = caber(txt, f, w, tamanhos, max, { tracking: fonte === 'titulo' ? F.tracking : 0 })
    return Math.ceil(r.tamanho * (lh ?? (fonte === 'titulo' ? 1.04 : 1.42)) * r.linhas + r.tamanho * 0.12)
  }

  switch (d.variante) {
    // ================================================================ capa
    case 'capa.classica':
    case 'capa.tipografica':
    default: {
      if (d.tipo !== 'capa' && d.variante !== 'capa.classica' && d.variante !== 'capa.tipografica') {
        // variante desconhecida: cai no layout da ideia central
        return montarTela({ ...d, variante: 'conceito.frase' }, c)
      }
      const tipografica = d.variante === 'capa.tipografica'
      const direita = !tipografica && !c.reservarDireita
      kicker(d.rotulo || c.marca || 'Apresentação', M, MT, st ? W - M * 2 : W * 0.5)
      if (direita && c.placeholders) espacoImagem(st ? 0 : W * 0.6, 0, st ? W : W * 0.4, st ? H * 0.42 : H, d.imagem)
      else if (direita) motivo(st ? W * 0.18 : W * 0.63, st ? H * 0.12 : H * 0.12, st ? W * 0.64 : W * 0.3, st ? W * 0.64 : H * 0.76)
      if (tipografica && decorar) linha(M, MT + 52, W - M * 2, 3, corMotivo, { name: 'motivo' })
      const larg = st ? W - M * 2 : tipografica || c.reservarDireita ? (c.reservarDireita ? W * 0.5 : W - M * 2) : W * 0.55
      const tam = tipografica ? (st ? [170, 150, 130, 110, 96] : [250, 220, 190, 160, 136, 116]) : st ? [168, 148, 128, 112, 96] : [176, 152, 132, 116, 100, 88]
      const yTexto = st ? H * 0.8 : H * 0.76
      const fonte = familia('titulo')
      // orçamento de altura: o título não pode invadir a linha de apoio
      const hMax = (d.texto ? yTexto - 44 : H * 0.86) - (MT + (tipografica && !st ? 110 : 90))
      const prev = caber(d.titulo, fonte, larg, tam, 3, { tracking: F.tracking, peso: F.pesoTitulo, alturaMax: hMax })
      const altura = Math.min(hMax, prev.tamanho * 1.04 * (prev.linhas + (dividirEnfase(d.titulo, d.enfase) ? 1 : 0)))
      const yTitulo = tipografica && !st ? MT + 110 : Math.max(MT + 90, (d.texto ? yTexto - 44 : H * 0.84) - altura)
      const tt = tituloEnfase(d.titulo, { x: M, y: yTitulo, w: larg, tamanhos: tam, max: 3, hMax, extra: c.numero === 1 ? { name: 'titulo' } : {} })
      if (d.texto) texto('texto', d.texto, { x: M, y: tipografica && !st ? Math.max(tt.fim + 48, H * 0.74) : Math.max(yTexto, tt.fim + 32), w: st ? W - M * 2 : Math.min(larg, W * 0.5), tamanhos: st ? [42, 38, 34] : [38, 34, 30], max: 2, cor: s.suave })
      break
    }
    case 'capa.centrada': {
      const larg = st ? W - M * 2 : W * 0.8
      const x = (W - larg) / 2
      const fonte = familia('titulo')
      const tam = st ? [130, 112, 96, 84] : [168, 144, 124, 108, 92]
      const prev = caber(d.titulo, fonte, larg, tam, 3, { tracking: F.tracking })
      const hTitulo = prev.tamanho * 1.04 * (prev.linhas + (dividirEnfase(d.titulo, d.enfase) ? 1 : 0))
      const bloco = 40 + 40 + hTitulo + (d.texto ? 120 : 0)
      let y = (H - bloco) / 2
      if (decorar) {
        linha(W / 2 - 40, y - 36, 80, 6, corMotivo, { name: 'motivo', radius: 3 })
        if (t.motivo === 'formas') {
          const k = st ? 260 : 300
          forma('forma', formaMotivo, -k * 0.35, H - k * 0.75, k, formaMotivo === 'semicircle' ? k / 2 : k, { fill: corMotivo, opacity: 0.9, enterAnimation: animForma(200) })
          forma('forma', 'ellipse', W - k * 0.55, -k * 0.4, k * 0.8, k * 0.8, { fill: legivel(s.fundo, [t.acento2, s.tinta], 1.5), enterAnimation: animForma(320) })
        }
      }
      const k = kicker(d.rotulo || c.marca || 'Apresentação', x, y, larg, 'center')
      if (k) y = k.fim + 36
      const tt = tituloEnfase(d.titulo, { x, y, w: larg, tamanhos: tam, max: 3, align: 'center', extra: c.numero === 1 ? { name: 'titulo' } : {} })
      if (d.texto) texto('texto', d.texto, { x: (W - (st ? larg : W * 0.56)) / 2, y: tt.fim + 40, w: st ? larg : W * 0.56, tamanhos: st ? [40, 36] : [36, 32, 28], max: 2, cor: s.suave, align: 'center' })
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
      let y = st ? painelH + 90 : H * 0.3
      const k = kicker(d.rotulo || c.marca || 'Apresentação', x, y, larg)
      if (k) y = k.fim + 28
      const tt = tituloEnfase(d.titulo, { x, y, w: larg, tamanhos: st ? [120, 104, 92, 80] : [120, 104, 92, 80, 70], max: 4, extra: c.numero === 1 ? { name: 'titulo' } : {} })
      if (d.texto) texto('texto', d.texto, { x, y: tt.fim + 36, w: larg, tamanhos: st ? [38, 34] : [32, 28], max: 3, cor: s.suave })
      break
    }

    // ================================================================ agenda
    case 'agenda.lista':
    case 'agenda.colunas': {
      const colunas = d.variante === 'agenda.colunas' && !st && itens.length <= 4
      if (colunas) {
        const y0 = cabecalho()
        const cel = grade(itens.length, M, y0, W - M * 2, fimConteudo - y0, 4)
        itens.forEach((it, k) => {
          const [nome = '', desc = ''] = partes(it)
          const p = cel[k]!
          const n = texto('indice', String(k + 1).padStart(2, '0'), { x: p.x, y: p.y, w: p.w, fonte: 'titulo', tamanhos: [96], max: 1, cor: forte, anim: animItem(k) })
          linha(p.x, n.fim + 16, p.w, 2, s.linha)
          const it1 = texto('item', nome, { x: p.x, y: n.fim + 40, w: p.w - 12, fonte: 'titulo', tamanhos: [40, 36, 32], max: 3, anim: animItem(k) })
          if (desc) texto('texto', desc, { x: p.x, y: it1.fim + 12, w: p.w - 12, tamanhos: [26, 24], max: 3, cor: s.suave, anim: animItem(k) })
        })
      } else {
        const esquerdaW = st ? W - M * 2 : wc(5)
        let y = MT
        const k = kicker(d.rotulo, M, y, esquerdaW)
        if (k) y = k.fim + 18
        const tt = tituloEnfase(d.titulo, { x: M, y, w: esquerdaW, tamanhos: st ? [96, 84, 72] : [96, 84, 72, 64], max: 3 })
        if (d.texto) texto('texto', d.texto, { x: M, y: tt.fim + 24, w: esquerdaW, tamanhos: st ? [36, 32] : [28, 26], max: 4, cor: s.suave })
        const x0 = st ? M : xc(6)
        const larg = st ? W - M * 2 : wc(6)
        const y0 = st ? tt.fim + 200 : MT + 96
        const passo = (fimConteudo - y0) / Math.max(1, itens.length)
        itens.forEach((it, j) => {
          const [nome = '', desc = ''] = partes(it)
          const y1 = y0 + j * passo
          texto('indice', String(j + 1).padStart(2, '0'), { x: x0, y: y1, w: 120, fonte: 'titulo', tamanhos: [st ? 64 : 56], max: 1, cor: forte, anim: animItem(j) })
          const n = texto('item', nome, { x: x0 + (st ? 130 : 120), y: y1 + 6, w: larg - 120, fonte: 'titulo', tamanhos: st ? [48, 44, 40] : [46, 42, 38], max: 2, anim: animItem(j) })
          if (desc) texto('texto', desc, { x: x0 + (st ? 130 : 120), y: n.fim + 6, w: larg - 120, tamanhos: st ? [30, 28] : [24, 22], max: 2, cor: s.suave, anim: animItem(j) })
          if (j < itens.length - 1) linha(x0, y1 + passo - 14, larg, 2, s.linha)
        })
      }
      break
    }

    // ================================================================ seção
    case 'secao.numero': {
      const num = String(Math.max(1, c.indiceSecao)).padStart(2, '0')
      const tamNum = st ? 300 : 380
      const n = texto('indice', num, { x: M - tamNum * 0.04, y: st ? H * 0.2 : (H - tamNum) / 2 - 20, w: st ? W - M * 2 : tamNum * 1.3, fonte: 'titulo', tamanhos: [tamNum], max: 1, cor: forte, lh: 1, anim: animForma(0) })
      const x = st ? M : M + tamNum * 1.3 + 40
      const larg = st ? W - M * 2 : W - x - M
      let y = st ? n.fim + 40 : H * 0.36
      const k = kicker(d.rotulo, x, y, larg)
      if (k) y = k.fim + 22
      const tt = tituloEnfase(d.titulo, { x, y, w: larg, tamanhos: st ? [110, 96, 84, 72] : [120, 104, 88, 76], max: 3 })
      if (d.texto) texto('texto', d.texto, { x, y: tt.fim + 32, w: Math.min(larg, wc(6)), tamanhos: st ? [38, 34] : [32, 28], max: 3, cor: s.suave })
      break
    }
    case 'secao.faixa':
    case 'secao.minimal': {
      const minimal = d.variante === 'secao.minimal'
      const larg = st ? W - M * 2 : wc(10)
      const x = centro ? (W - larg) / 2 : M
      const al = centro ? 'center' : 'left'
      const fonte = familia('titulo')
      const tam = st ? [120, 104, 90, 78] : minimal ? [120, 104, 88, 76] : [150, 128, 110, 96]
      const prev = caber(d.titulo, fonte, larg, tam, 3, { tracking: F.tracking })
      let y = (H - prev.tamanho * 1.04 * prev.linhas) / 2 - 40
      const k = kicker(d.rotulo || `Parte ${String(Math.max(1, c.indiceSecao)).padStart(2, '0')}`, x, y - 64, larg, al)
      if (k) y = Math.max(y, k.fim + 24)
      const tt = tituloEnfase(d.titulo, { x, y, w: larg, tamanhos: tam, max: 3, align: al })
      if (minimal) linha(M, tt.fim + 48, W - M * 2, 2, s.linha, { enterAnimation: { type: 'reveal', duration: 900, delay: 200, easing: 'easeOut' } })
      else motivo(st ? W * 0.55 : W * 0.78, st ? H * 0.06 : H * 0.08, st ? W * 0.4 : W * 0.18, st ? W * 0.4 : W * 0.18, 'pequeno')
      if (d.texto) texto('texto', d.texto, { x: centro ? (W - Math.min(larg, wc(7))) / 2 : x, y: tt.fim + (minimal ? 84 : 40), w: Math.min(larg, st ? larg : wc(7)), tamanhos: st ? [38, 34] : [32, 28], max: 3, cor: s.suave, align: al })
      break
    }

    // ================================================================ ideia central
    case 'conceito.frase':
    case 'conceito.enfase': {
      const enf = d.variante === 'conceito.enfase' || centro
      const larg = st ? W - M * 2 : enf ? W * 0.8 : W * 0.76
      const x = enf ? (W - larg) / 2 : M
      const al = enf ? 'center' : 'left'
      const fonte = familia('titulo')
      const tam = st ? [124, 108, 94, 82, 72] : [112, 100, 88, 76, 66, 58]
      const prev = caber(d.titulo, fonte, larg, tam, 4, { tracking: F.tracking })
      const hT = prev.tamanho * 1.04 * (prev.linhas + (dividirEnfase(d.titulo, d.enfase) ? 1 : 0))
      let y = enf ? (H - hT - (d.texto ? 130 : 0)) / 2 : st ? H * 0.3 : Math.min(H * 0.3, (H - hT) / 2 - 60)
      if (!enf) motivo(st ? W * 0.62 : W * 0.8, st ? H * 0.05 : MT - 10, st ? W * 0.28 : W * 0.12, st ? W * 0.28 : W * 0.12, 'pequeno')
      const k = kicker(d.rotulo, x, y - 64, larg, al)
      if (!k && !enf) y = Math.max(y, MT)
      const tt = tituloEnfase(d.titulo, { x, y, w: larg, tamanhos: tam, max: 4, align: al })
      if (d.texto) texto('texto', d.texto, { x: enf ? (W - (st ? larg : W * 0.56)) / 2 : x, y: tt.fim + (st ? 56 : 48), w: st ? larg : W * 0.56, tamanhos: st ? [44, 40, 36] : [34, 30], max: 4, cor: s.suave, align: al })
      break
    }
    case 'conceito.lateral': {
      if (st) return montarTela({ ...d, variante: 'conceito.frase' }, c)
      const esquerdaW = wc(7)
      let y = MT
      const k = kicker(d.rotulo, M, y, esquerdaW)
      if (k) y = k.fim + 22
      const fonte = familia('titulo')
      const prev = caber(d.titulo, fonte, esquerdaW, [100, 88, 76, 66, 58], 5, { tracking: F.tracking })
      const hT = prev.tamanho * 1.04 * prev.linhas
      const yT = Math.max(y, (H - hT) / 2 - 20)
      const tt = tituloEnfase(d.titulo, { x: M, y: yT, w: esquerdaW, tamanhos: [100, 88, 76, 66, 58], max: 5 })
      const xd = xc(8)
      linha(xd, yT + 8, 3, Math.max(120, tt.fim - yT - 8), forte, { enterAnimation: { type: 'reveal', duration: 800, delay: 200, easing: 'easeOut' } })
      if (d.texto) texto('texto', d.texto, { x: xd + 48, y: yT, w: wc(4) - 48, tamanhos: [34, 30, 28], max: 8, cor: s.suave })
      break
    }

    // ================================================================ lista
    case 'lista.numerada': {
      if (st) {
        const y0 = cabecalho()
        const passo = Math.min(240, (fimConteudo - y0) / Math.max(1, itens.length))
        itens.forEach((it, k) => {
          texto('num', String(k + 1).padStart(2, '0'), { x: M, y: y0 + k * passo + 8, w: 90, fonte: 'mono', tamanhos: [26], max: 1, cor: forte, anim: animItem(k) })
          texto('texto', it, { x: M + 100, y: y0 + k * passo, w: W - M * 2 - 100, tamanhos: [42, 38, 34], max: 3, anim: animItem(k) })
          linha(M, y0 + (k + 1) * passo - 24, W - M * 2, 2, s.linha)
        })
        break
      }
      let y = MT
      const esquerdaW = wc(5)
      const k0 = kicker(d.rotulo, M, y, esquerdaW)
      if (k0) y = k0.fim + 18
      const tt = tituloEnfase(d.titulo, { x: M, y, w: esquerdaW, tamanhos: [88, 76, 66, 58, 52], max: 4 })
      if (d.texto) texto('texto', d.texto, { x: M, y: tt.fim + 28, w: esquerdaW, tamanhos: [28, 26], max: 5, cor: s.suave })
      const x0 = xc(6)
      const larg = wc(6)
      // começa abaixo da marca do motivo no canto
      const y0 = MT + 96
      const passo = Math.min(200, (fimConteudo - y0) / Math.max(1, itens.length))
      itens.forEach((it, k) => {
        const yk = y0 + k * passo
        texto('num', String(k + 1).padStart(2, '0'), { x: x0, y: yk + 8, w: 80, fonte: 'mono', tamanhos: [22], max: 1, cor: forte, anim: animItem(k) })
        texto('texto', it, { x: x0 + 96, y: yk, w: larg - 96, tamanhos: [40, 36, 32, 28], max: passo > 150 ? 3 : 2, anim: animItem(k) })
        linha(x0, yk + passo - 26, larg, 2, s.linha)
      })
      break
    }
    case 'lista.colunas': {
      const y0 = cabecalho()
      const colsL = st ? 1 : itens.length === 4 ? 2 : Math.min(3, itens.length)
      const linhasL = Math.ceil(itens.length / colsL)
      const hL = Math.min(fimConteudo - y0, linhasL * (st ? 200 : 190))
      const cel = grade(itens.length, M, noMeio(y0, hL), W - M * 2, hL, colsL)
      // poucos pontos curtos ganham corpo de subtítulo
      const curtos = itens.length <= 3 && itens.every((x) => x.length <= 48)
      itens.forEach((it, k) => {
        const p = cel[k]!
        const lado = st ? 22 : curtos ? 24 : 18
        forma('marcador', formaMotivo === 'rect' ? 'rect' : 'ellipse', p.x, p.y + (curtos ? 22 : 14), lado, lado, { fill: forte, enterAnimation: animItem(k) })
        texto('item', it, { x: p.x + lado + 22, y: p.y, w: p.w - lado - 30, fonte: curtos ? 'titulo' : 'texto', tamanhos: st ? [42, 38, 34] : curtos ? [54, 48, 42, 38] : [40, 36, 32], max: 4, anim: animItem(k) })
      })
      break
    }

    // ================================================================ cartões
    case 'cartoes.grade':
    case 'cartoes.linhas': {
      const abertos = d.variante === 'cartoes.linhas'
      const y0 = cabecalho()
      const colsC = st ? 1 : itens.length === 4 ? 4 : Math.min(3, itens.length <= 4 ? itens.length : Math.ceil(itens.length / 2))
      const linhasC = Math.ceil(itens.length / colsC)
      const hC = Math.min(fimConteudo - y0, linhasC * (abertos ? (st ? 250 : 340) : st ? 300 : 440) + (linhasC - 1) * GUT)
      const cel = grade(itens.length, M, noMeio(y0, hC), W - M * 2, hC, colsC)
      itens.forEach((it, k) => {
        const [tit = '', desc = ''] = partes(it)
        const p = cel[k]!
        const dest = ehDestaque(k)
        const pad = abertos ? 0 : st ? 44 : 40
        const corT = dest && !abertos ? sobreDestaque : s.tinta
        const corS = dest && !abertos ? alfa(sobreDestaque, 0.82) : s.suave
        if (abertos) forma('fio', 'rect', p.x, p.y, st ? 120 : Math.min(p.w, 140), 5, { fill: forte, enterAnimation: animItem(k) })
        else forma('cartao', 'rect', p.x, p.y, p.w, p.h, { fill: dest ? forte : s.cartao, radius: raioCartao, enterAnimation: animItem(k) })
        const yi = p.y + (abertos ? 36 : pad)
        texto('indice', String(k + 1).padStart(2, '0'), { x: p.x + pad, y: yi, w: 80, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, cor: dest && !abertos ? corT : forte, anim: animItem(k) })
        const tamTit = st ? [52, 46, 42] : itens.length > 3 ? [42, 38, 34] : [52, 46, 40, 36]
        const tamDesc = st ? [34, 31, 28] : itens.length > 3 ? [27, 25, 23] : [30, 27, 25]
        // nos cartões com fundo, título e descrição ficam no pé do cartão (alinhados entre os cartões); o número, no topo
        const hTit = Math.max(...itens.map((x) => medir(partes(x)[0] ?? '', 'titulo', p.w - pad * 2, tamTit, 2)))
        const hDesc = Math.max(0, ...itens.map((x) => (partes(x)[1] ? medir(partes(x)[1]!, 'texto', p.w - pad * 2, tamDesc, st ? 3 : 5) + 16 : 0)))
        const yTit = abertos ? yi + (st ? 56 : 48) : Math.max(yi + (st ? 56 : 48), p.y + p.h - pad - hDesc - hTit)
        const h1 = texto('item', tit, { x: p.x + pad, y: yTit, w: p.w - pad * 2, fonte: 'titulo', tamanhos: tamTit, max: 2, cor: corT, anim: animItem(k) })
        if (desc) texto('texto', desc, { x: p.x + pad, y: h1.fim + 16, w: p.w - pad * 2, tamanhos: tamDesc, max: st ? 3 : 5, cor: corS, anim: animItem(k) })
      })
      break
    }

    // ================================================================ processo
    case 'processo.passos':
    case 'processo.circulos': {
      const circulos = d.variante === 'processo.circulos' && !st
      const y0 = cabecalho()
      if (st) {
        const passo = (fimConteudo - y0) / Math.max(1, itens.length)
        linha(M + 36, y0 + 20, 3, passo * (itens.length - 1) + 10, s.linha)
        itens.forEach((it, k) => {
          const [tit = '', desc = ''] = partes(it)
          const yk = y0 + k * passo
          forma('marcador', 'ellipse', M + 8, yk + 4, 60, 60, { fill: forte, enterAnimation: animItem(k) })
          texto('indice', String(k + 1), { x: M + 8, y: yk + 14, w: 60, fonte: 'mono', tamanhos: [24], max: 1, cor: sobreDestaque, align: 'center', anim: animItem(k) })
          const h1 = texto('item', tit, { x: M + 110, y: yk, w: W - M * 2 - 110, fonte: 'titulo', tamanhos: [48, 44, 40], max: 2, anim: animItem(k) })
          if (desc) texto('texto', desc, { x: M + 110, y: h1.fim + 10, w: W - M * 2 - 110, tamanhos: [32, 30], max: 3, cor: s.suave, anim: animItem(k) })
        })
        break
      }
      const n = Math.max(1, itens.length)
      const gap = 48
      const colW = (W - M * 2 - (n - 1) * gap) / n
      const dia = Math.min(200, colW * 0.62)
      const hDescs = Math.max(0, ...itens.map((it) => (partes(it)[1] ? medir(partes(it)[1]!, 'texto', colW, n > 4 ? [26, 24] : [30, 27], 4) + 14 : 0)))
      const hBloco = (circulos ? dia + 40 : 140) + 90 + hDescs
      const yP = noMeio(y0, hBloco)
      const yLinha = circulos ? yP + dia / 2 : yP + 52
      if (circulos) linha(M, yLinha, W - M * 2, 2, s.linha, { enterAnimation: { type: 'reveal', duration: 900, delay: 150, easing: 'easeOut' } })
      itens.forEach((it, k) => {
        const [tit = '', desc = ''] = partes(it)
        const x = M + k * (colW + gap)
        // passos: um fio entre o número desta etapa e a próxima
        if (!circulos && k < n - 1) linha(x + 150, yLinha, colW + gap - 170, 2, s.linha, { enterAnimation: { type: 'reveal', duration: 700, delay: 200 + k * 120, easing: 'easeOut' } })
        let yt: number
        if (circulos) {
          const xc0 = x + (colW - dia) / 2
          forma('marcador', 'ellipse', xc0, yP, dia, dia, { fill: ehDestaque(k) || d.destaque < 0 ? forte : s.cartao, enterAnimation: animItem(k) })
          texto('indice', String(k + 1).padStart(2, '0'), { x: xc0, y: yP + dia / 2 - 44, w: dia, fonte: 'titulo', tamanhos: [72], max: 1, cor: ehDestaque(k) || d.destaque < 0 ? sobreDestaque : forte, align: 'center', anim: animItem(k) })
          yt = yP + dia + 40
        } else {
          texto('indice', String(k + 1).padStart(2, '0'), { x, y: yP, w: 160, fonte: 'titulo', tamanhos: [88], max: 1, cor: forte, lh: 1, anim: animItem(k) })
          yt = yP + 140
        }
        const h1 = texto('item', tit, { x, y: yt, w: colW, fonte: 'titulo', tamanhos: n > 4 ? [36, 32] : [48, 42, 38], max: 2, align: circulos ? 'center' : 'left', anim: animItem(k) })
        if (desc) texto('texto', desc, { x, y: h1.fim + 14, w: colW, tamanhos: n > 4 ? [26, 24] : [30, 27], max: 4, cor: s.suave, align: circulos ? 'center' : 'left', anim: animItem(k) })
      })
      break
    }

    // ================================================================ métricas
    case 'numeros.grandes':
    case 'numeros.cartoes': {
      const cartoes = d.variante === 'numeros.cartoes'
      const y0 = cabecalho()
      const lista = itens.length ? itens : ['—|sem dados']
      const n = lista.length
      const hArea = Math.min(fimConteudo - y0, cartoes ? 460 : 420)
      const yArea = y0 + Math.max(0, (fimConteudo - y0 - hArea) * 0.35)
      const cel = st ? lista.map((_, k) => ({ x: M, y: y0 + (k * (fimConteudo - y0)) / n, w: W - M * 2, h: (fimConteudo - y0) / n - 24 })) : grade(n, M, yArea, W - M * 2, hArea, 4, cartoes ? GUT : 64)
      lista.forEach((it, k) => {
        const [valor = '', ...resto] = partes(it)
        const legenda = resto.join(' ')
        const p = cel[k]!
        const dest = ehDestaque(k)
        const pad = cartoes ? 44 : 0
        if (cartoes) forma('cartao', 'rect', p.x, p.y, p.w, p.h, { fill: dest ? forte : s.cartao, radius: raioCartao, enterAnimation: animItem(k) })
        else if (k > 0 && !st) linha(p.x - 32, p.y + 10, 2, p.h - 20, s.linha)
        const corV = cartoes ? (dest ? sobreDestaque : s.tinta) : dest ? forte : s.tinta
        const v = texto('valor', valor, { x: p.x + pad, y: p.y + (cartoes ? pad : 0), w: p.w - pad * 2, fonte: 'titulo', tamanhos: st ? [200, 170, 140, 120] : n <= 2 ? [220, 190, 160, 136, 116] : n === 3 ? [176, 152, 132, 112, 96, 84] : [136, 116, 100, 86, 74], max: 1, cor: corV, lh: 1, anim: { type: 'slideUp', duration: 700, delay: 150 + k * 140, easing: 'spring' } })
        texto('texto', legenda, { x: p.x + pad, y: v.fim + (st ? 18 : 24), w: p.w - pad * 2, tamanhos: st ? [38, 34] : [33, 30, 27], max: 3, cor: cartoes && dest ? alfa(sobreDestaque, 0.85) : s.suave, anim: animItem(k) })
      })
      break
    }

    // ================================================================ gráfico
    case 'grafico.barras':
    case 'grafico.colunas': {
      const dados = itens.map((it) => { const [v = '', ...r] = partes(it); return { valor: v, rotulo: r.join(' '), n: numeroDe(v) } })
      if (dados.filter((x) => x.n !== null).length < 2) return montarTela({ ...d, tipo: 'numeros', variante: 'numeros.grandes', itens: itens.slice(0, 4) }, c)
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
        const yB = noMeio(y0, n * passo)
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

    // ================================================================ comparação
    case 'comparacao.colunas':
    case 'comparacao.antesDepois': {
      const antes = d.variante === 'comparacao.antesDepois'
      const y0 = cabecalho()
      const cabA = itens[0] ?? 'Hoje'
      const cabB = itens[1] ?? 'Depois'
      const [a, b] = [itens.slice(2).filter((_, k) => k % 2 === 0), itens.slice(2).filter((_, k) => k % 2 === 1)]
      const seta = antes ? (st ? 90 : 120) : 0
      const w = st ? W - M * 2 : (W - M * 2 - (antes ? seta : GUT)) / 2
      const linhasMax = Math.max(1, a.length, b.length)
      const necessario = (st ? 48 : 52) * 2 + 120 + linhasMax * (st ? 36 : 32) * 1.7 + 40
      const hCaixa = Math.min(st ? (fimConteudo - y0 - (antes ? seta : 40)) / 2 : fimConteudo - y0, Math.max(st ? 300 : 400, necessario))
      const yC = noMeio(y0, st ? hCaixa * 2 + (antes ? seta : 40) : hCaixa)
      const destaqueA = d.destaque === 0
      ;[{ cab: cabA, linhas: a }, { cab: cabB, linhas: b }].forEach((col, k) => {
        const x = st ? M : M + k * (w + (antes ? seta : GUT))
        const y = st ? yC + k * (hCaixa + (antes ? seta : 40)) : yC
        const dest = antes ? k === 1 : destaqueA ? k === 0 : k === 1
        const fill = dest ? forte : antes ? s.fundo : s.cartao
        forma('caixa', 'rect', x, y, w, hCaixa, { fill, radius: raioCartao, ...(antes && !dest ? { stroke: s.linha, strokeWidth: 2 } : {}), enterAnimation: animItem(k) })
        const corT = dest ? sobreDestaque : antes ? s.suave : s.tinta
        const pad = st ? 48 : 52
        const h1 = texto('cab', col.cab, { x: x + pad, y: y + pad, w: w - pad * 2, fonte: 'titulo', tamanhos: st ? [52, 46, 40] : [52, 46, 40], max: 2, cor: corT, anim: animItem(k) })
        linha(x + pad, h1.fim + 22, w - pad * 2, 2, dest ? alfa(sobreDestaque, 0.3) : s.linha)
        texto('texto', col.linhas.join('\n') || '—', { x: x + pad, y: h1.fim + 52, w: w - pad * 2, tamanhos: st ? [38, 34, 30] : [34, 31, 28], max: 8, lh: 1.7, cor: dest ? sobreDestaque : antes ? s.suave : s.tinta, anim: animItem(k + 1) })
      })
      if (antes) {
        const tam = st ? 64 : 72
        forma('seta', 'arrow', st ? W / 2 - tam / 2 : M + w + (seta - tam) / 2, st ? yC + hCaixa + (seta - tam) / 2 : yC + hCaixa / 2 - tam / 2, tam, tam, { fill: forte, rotation: st ? 90 : 0, enterAnimation: animForma(400) })
      }
      break
    }

    // ================================================================ linha do tempo
    case 'linhaTempo.horizontal':
    case 'linhaTempo.vertical': {
      const y0 = cabecalho()
      const marcos = itens.map((it) => { const [data = '', ...r] = partes(it); return { data, marco: r.join(' ') } })
      const n = Math.max(1, marcos.length)
      if (d.variante === 'linhaTempo.horizontal' && !st) {
        const yL = y0 + (fimConteudo - y0) * 0.36
        const passo = (W - M * 2) / n
        linha(M, yL, W - M * 2, 3, s.linha, { enterAnimation: { type: 'reveal', duration: 1000, delay: 100, easing: 'easeOut' } })
        marcos.forEach((x, k) => {
          const xk = M + k * passo
          const dest = ehDestaque(k)
          const dot = dest ? 40 : 26
          forma('marcador', 'ellipse', xk, yL - dot / 2 + 1, dot, dot, { fill: forte, enterAnimation: animItem(k) })
          texto('item', x.data, { x: xk, y: yL - (n > 4 ? 88 : 104), w: passo - 28, fonte: 'titulo', tamanhos: n > 4 ? [38, 34, 30] : [50, 44, 38], max: 1, cor: dest ? forte : s.tinta, anim: animItem(k) })
          texto('texto', x.marco, { x: xk, y: yL + 48, w: passo - 36, tamanhos: n > 4 ? [28, 26, 24] : [33, 30, 27], max: 4, cor: s.suave, anim: animItem(k) })
        })
      } else {
        const passo = (fimConteudo - y0) / n
        const xL = M + 12
        linha(xL, y0 + 14, 3, passo * (n - 1) + 4, s.linha, { enterAnimation: { type: 'reveal', duration: 1000, delay: 100, easing: 'easeOut' } })
        marcos.forEach((x, k) => {
          const yk = y0 + k * passo
          const dest = ehDestaque(k)
          forma('marcador', 'ellipse', xL - 11, yk + 4, 26, 26, { fill: forte, enterAnimation: animItem(k) })
          const dt = texto('item', x.data, { x: xL + 56, y: yk - 4, w: st ? W - M * 2 - 70 : wc(3), fonte: st ? 'mono' : 'titulo', tamanhos: st ? [26] : [36, 32, 28], max: 1, cor: dest || st ? forte : s.tinta, upper: st, anim: animItem(k) })
          texto('texto', x.marco, { x: st ? xL + 56 : xc(4), y: st ? dt.fim + 8 : yk - 2, w: st ? W - M * 2 - 70 : wc(8), tamanhos: st ? [40, 36, 32] : [32, 29, 26], max: 2, cor: st ? s.tinta : s.suave, anim: animItem(k) })
        })
      }
      break
    }

    // ================================================================ citação
    case 'citacao.grande': {
      const larg = st ? W - M * 2 : W * 0.78
      texto('aspas', '“', { x: M - 12, y: st ? H * 0.12 : MT - 20, w: 360, fonte: 'titulo', tamanhos: [st ? 300 : 340], max: 1, lh: 1, cor: forte, peso: 400, anim: animForma(0) })
      const fonte = familia('titulo')
      const tam = st ? [84, 74, 64, 56, 50] : [96, 84, 74, 64, 56, 50]
      const prev = caber(d.titulo, fonte, larg, tam, 6, { tracking: F.tracking * 0.6 })
      const yQ = st ? H * 0.32 : Math.max(MT + 200, (H - prev.tamanho * 1.08 * prev.linhas) / 2)
      const q = texto('titulo', d.titulo, { x: M, y: yQ, w: larg, fonte: 'titulo', tamanhos: tam, max: 6, italic: F.italicoCitacao, tracking: F.tracking * 0.6, lh: 1.08, anim: animTitulo() })
      if (d.texto) {
        linha(M, q.fim + 56, 56, 3, forte)
        texto('autor', d.texto, { x: M + 80, y: q.fim + 42, w: larg - 80, fonte: 'mono', tamanhos: [st ? 26 : 22], max: 2, upper: true, tracking: -0.1, cor: s.suave })
      }
      break
    }
    case 'citacao.depoimento': {
      const y0 = d.rotulo ? (kicker(d.rotulo, M, MT, W - M * 2)?.fim ?? MT) + 48 : MT + 40
      const cx = st ? M : M + wc(1) + GUT
      const cwid = st ? W - M * 2 : wc(10)
      const ch = fimConteudo - y0
      forma('cartao', 'rect', cx, y0, cwid, ch, { fill: s.cartao, radius: raioCartao, enterAnimation: animForma(0) })
      const pad = st ? 64 : 88
      texto('aspas', '“', { x: cx + pad - 8, y: y0 + pad - 40, w: 200, fonte: 'titulo', tamanhos: [180], max: 1, lh: 1, cor: forte, peso: 400, anim: null })
      const q = texto('titulo', d.titulo, { x: cx + pad, y: y0 + pad + 110, w: cwid - pad * 2, fonte: 'titulo', tamanhos: st ? [64, 56, 50, 44] : [64, 56, 50, 44, 40], max: st ? 8 : 4, italic: F.italicoCitacao, tracking: F.tracking * 0.5, lh: 1.12, anim: animTitulo() })
      if (d.texto) {
        const yA = Math.min(y0 + ch - pad - 80, q.fim + 64)
        forma('avatar', 'ellipse', cx + pad, yA, 80, 80, { fill: forte, enterAnimation: animForma(300) })
        texto('iniciais', iniciais(d.texto), { x: cx + pad, y: yA + 20, w: 80, fonte: 'titulo', tamanhos: [32], max: 1, align: 'center', cor: sobreDestaque, anim: null })
        texto('autor', d.texto, { x: cx + pad + 108, y: yA + 22, w: cwid - pad * 2 - 108, tamanhos: st ? [30, 26] : [28, 25], max: 2, peso: 600, cor: s.tinta })
      }
      break
    }

    // ================================================================ imagem
    case 'imagem.lateral': {
      const imgW = st ? W : W * 0.5
      const imgH = st ? H * 0.5 : H
      espacoImagem(st ? 0 : W - imgW, 0, imgW, imgH, d.imagem)
      const larg = st ? W - M * 2 : W - imgW - M - 72
      let y = st ? imgH + 80 : MT
      const k = kicker(d.rotulo, M, y, larg)
      if (k) y = k.fim + 22
      const fonte = familia('titulo')
      const prev = caber(d.titulo, fonte, larg, [96, 84, 72, 64, 56], 4, { tracking: F.tracking })
      if (!st) y = Math.max(y, (H - prev.tamanho * 1.04 * prev.linhas - (d.texto ? 200 : 0)) / 2)
      const tt = tituloEnfase(d.titulo, { x: M, y, w: larg, tamanhos: st ? [88, 76, 66, 58] : [96, 84, 72, 64, 56], max: 4 })
      if (d.texto) texto('texto', d.texto, { x: M, y: tt.fim + 32, w: larg, tamanhos: st ? [36, 32] : [30, 27], max: 6, cor: s.suave })
      break
    }
    case 'imagem.cheia': {
      espacoImagem(0, 0, W, H, d.imagem)
      forma('veu', 'rect', 0, H * 0.4, W, H * 0.6, { fill: s.fundo, gradient: { type: 'linear', angle: 180, stops: [{ color: alfa(s.fundo, 0), pos: 0 }, { color: alfa(s.fundo, 0.92), pos: 100 }] } })
      const larg = st ? W - M * 2 : W * 0.7
      const fonte = familia('titulo')
      const prev = caber(d.titulo, fonte, larg, [120, 104, 90, 78], 3, { tracking: F.tracking })
      const hT = prev.tamanho * 1.04 * prev.linhas
      const yT = H - MB - hT - (d.texto ? (st ? 180 : 130) : 0)
      kicker(d.rotulo, M, yT - 60, larg)
      const tt = tituloEnfase(d.titulo, { x: M, y: yT, w: larg, tamanhos: [120, 104, 90, 78], max: 3 })
      if (d.texto) texto('texto', d.texto, { x: M, y: tt.fim + 28, w: st ? larg : W * 0.5, tamanhos: st ? [36, 32] : [30, 27], max: 3, cor: s.suave })
      break
    }
    case 'imagem.moldura': {
      let y = MT
      const k = kicker(d.rotulo, M, y, W - M * 2)
      if (k) y = k.fim + 18
      const tt = texto('titulo', d.titulo, { x: M, y, w: st ? W - M * 2 : wc(8), fonte: 'titulo', tamanhos: st ? [72, 64, 56] : [64, 56, 50], max: 2, anim: animTitulo() })
      const yI = tt.fim + 44
      const hI = fimConteudo - yI - (d.texto ? (st ? 170 : 90) : 0)
      espacoImagem(M, yI, W - M * 2, hI, d.imagem, raioCartao)
      if (d.texto) texto('texto', d.texto, { x: M, y: yI + hI + 28, w: st ? W - M * 2 : wc(8), tamanhos: st ? [32, 28] : [26, 24], max: 2, cor: s.suave })
      break
    }

    // ================================================================ galeria
    case 'galeria.grade':
    case 'galeria.mosaico': {
      const y0 = cabecalho()
      const lista = itens.length ? itens : ['Imagem', 'Imagem', 'Imagem']
      const legenda = st ? 96 : 84
      const mosaico = d.variante === 'galeria.mosaico' && !st && lista.length >= 3
      const area = { x: M, y: y0, w: W - M * 2, h: fimConteudo - y0 }
      const menores = Math.min(lista.length, 4) - 1
      const hMenor = (area.h - (menores - 1) * GUT) / Math.max(1, menores)
      const cel = mosaico
        ? [{ x: area.x, y: area.y, w: wc(7), h: area.h }, ...Array.from({ length: menores }, (_, k) => ({ x: xc(7), y: area.y + k * (hMenor + GUT), w: wc(5), h: hMenor }))]
        : grade(lista.length, area.x, area.y, area.w, area.h, st ? 2 : lista.length === 4 ? 4 : 3)
      lista.slice(0, cel.length).forEach((it, k) => {
        const [tit = '', desc = ''] = partes(it)
        const p = cel[k]!
        const comLegenda = !mosaico || k === 0
        const hImg = comLegenda ? p.h - legenda : p.h
        espacoImagem(p.x, p.y, p.w, hImg, mosaico && k > 0 ? tit : '', Math.min(raioCartao, 20))
        if (comLegenda) {
          const t1 = texto('item', tit, { x: p.x, y: p.y + hImg + 18, w: p.w, tamanhos: st ? [30, 26] : [26, 24], max: 1, peso: 600, anim: animItem(k) })
          if (desc) texto('texto', desc, { x: p.x, y: t1.fim + 2, w: p.w, tamanhos: st ? [24, 22] : [21, 19], max: 1, cor: s.suave, anim: animItem(k) })
        }
      })
      break
    }

    // ================================================================ equipe
    case 'equipe.grade':
    case 'equipe.lista': {
      const y0 = cabecalho()
      const pessoas = itens.map((it) => { const [nome = '', ...r] = partes(it); return { nome, papel: r.join(' · ') } })
      if (d.variante === 'equipe.lista' || (st && pessoas.length > 4)) {
        const passo = Math.min(st ? 220 : 130, (fimConteudo - y0) / Math.max(1, pessoas.length))
        pessoas.forEach((p, k) => {
          const yk = y0 + k * passo
          const av = st ? 96 : 72
          forma('avatar', 'ellipse', M, yk, av, av, { fill: k % 2 ? s.cartao : forte, enterAnimation: animItem(k) })
          texto('iniciais', iniciais(p.nome), { x: M, y: yk + av / 2 - (st ? 22 : 17), w: av, fonte: 'titulo', tamanhos: [st ? 36 : 28], max: 1, align: 'center', cor: k % 2 ? forte : sobreDestaque, anim: null })
          texto('item', p.nome, { x: M + av + 32, y: yk + (st ? 8 : 4), w: st ? W - M * 2 - av - 32 : wc(5), fonte: 'titulo', tamanhos: st ? [44, 40] : [38, 34, 30], max: 1, anim: animItem(k) })
          texto('texto', p.papel, { x: st ? M + av + 32 : xc(6), y: st ? yk + 64 : yk + 10, w: st ? W - M * 2 - av - 32 : wc(6), tamanhos: st ? [30, 28] : [28, 25], max: 1, cor: s.suave, anim: animItem(k) })
          if (k < pessoas.length - 1) linha(M, yk + passo - 22, W - M * 2, 2, s.linha)
        })
        break
      }
      const colsE = st ? 2 : pessoas.length <= 4 ? Math.max(1, pessoas.length) : 3
      const hE = Math.min(fimConteudo - y0, Math.ceil(pessoas.length / colsE) * (st ? 480 : 420))
      const cel = grade(pessoas.length, M, noMeio(y0, hE), W - M * 2, hE, colsE)
      pessoas.forEach((p, k) => {
        const c0 = cel[k]!
        const dia = Math.max(64, Math.min(c0.w * 0.62, c0.h - 150, st ? 300 : 230))
        const xa = c0.x + (c0.w - dia) / 2
        forma('avatar', 'ellipse', xa, c0.y, dia, dia, { fill: k % 2 ? s.cartao : misturar(s.fundo, forte, 0.85), enterAnimation: animItem(k) })
        texto('iniciais', iniciais(p.nome), { x: xa, y: c0.y + dia / 2 - dia * 0.2, w: dia, fonte: 'titulo', tamanhos: [Math.round(dia * 0.32)], max: 1, align: 'center', cor: k % 2 ? forte : legivel(misturar(s.fundo, forte, 0.85), [sobreDestaque, s.tinta, s.fundo], 3), anim: null })
        const n1 = texto('item', p.nome, { x: c0.x, y: c0.y + dia + 26, w: c0.w, fonte: 'titulo', tamanhos: st ? [42, 38, 34] : [40, 36, 32], max: 2, align: 'center', anim: animItem(k) })
        if (p.papel) texto('texto', p.papel, { x: c0.x, y: n1.fim + 8, w: c0.w, tamanhos: st ? [30, 27] : [27, 25], max: 2, cor: s.suave, align: 'center', anim: animItem(k) })
      })
      break
    }

    // ================================================================ preços
    case 'precos.colunas': {
      const y0 = cabecalho({ semTexto: false })
      const planos = itens.map((it) => { const [nome = '', preco = '', ...r] = partes(it); return { nome, preco, beneficios: r.join(';').split(/;\s*/).map((b) => b.trim()).filter(Boolean).slice(0, 5) } })
      const destaque = d.destaque >= 0 && d.destaque < planos.length ? d.destaque : planos.length >= 3 ? 1 : planos.length - 1
      const cel = st ? planos.map((_, k) => ({ x: M, y: y0 + (k * (fimConteudo - y0)) / planos.length, w: W - M * 2, h: (fimConteudo - y0) / planos.length - 28 })) : grade(planos.length, M, noMeio(y0, Math.min(fimConteudo - y0, 560)), W - M * 2, Math.min(fimConteudo - y0, 560), 4)
      planos.forEach((p, k) => {
        const c0 = cel[k]!
        const dest = k === destaque && planos.length > 1
        const corT = dest ? sobreDestaque : s.tinta
        const pad = st ? 44 : 44
        forma('cartao', 'rect', c0.x, c0.y, c0.w, c0.h, { fill: dest ? forte : s.cartao, radius: raioCartao, enterAnimation: animItem(k) })
        if (dest) texto('selo', 'Recomendado', { x: c0.x + c0.w - pad - 200, y: c0.y + pad - 4, w: 200, fonte: 'mono', tamanhos: [st ? 20 : 17], max: 1, upper: true, align: 'right', cor: corT, anim: null })
        const n1 = texto('item', p.nome, { x: c0.x + pad, y: c0.y + pad, w: c0.w - pad * 2 - (dest ? 200 : 0), fonte: 'titulo', tamanhos: st ? [44, 40] : [38, 34, 30], max: 1, cor: corT, anim: animItem(k) })
        const pr = texto('preco', p.preco || '—', { x: c0.x + pad, y: n1.fim + (st ? 12 : 20), w: c0.w - pad * 2, fonte: 'titulo', tamanhos: st ? [72, 64, 56] : planos.length > 3 ? [56, 48, 42] : [68, 60, 52, 46], max: 1, cor: corT, lh: 1.05, anim: animItem(k) })
        if (p.beneficios.length) {
          if (!st) linha(c0.x + pad, pr.fim + 28, c0.w - pad * 2, 2, dest ? alfa(sobreDestaque, 0.3) : s.linha)
          texto('beneficios', p.beneficios.map((b) => `+  ${b}`).join('\n'), { x: st ? c0.x + c0.w * 0.5 : c0.x + pad, y: st ? c0.y + pad : pr.fim + 56, w: st ? c0.w * 0.5 - pad : c0.w - pad * 2, tamanhos: st ? [28, 26, 24] : [26, 24, 22], max: 6, lh: 1.65, cor: dest ? alfa(sobreDestaque, 0.9) : s.suave, anim: animItem(k + 1) })
        }
      })
      break
    }

    // ================================================================ paleta e tipografia
    case 'paleta.faixas': {
      const cores = (itens.length ? itens : [`Principal|${t.acento}`, `Fundo|${t.claro.fundo}`, `Tinta|${t.claro.tinta}`]).slice(0, 5).map((it) => { const [nome = '', hex = ''] = partes(it); return { nome, hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : t.acento } })
      const larg = st ? W : W / cores.length
      const alt = st ? H / cores.length : H
      cores.forEach((cor, k) => {
        forma('cor', 'rect', st ? 0 : k * larg, st ? k * alt : 0, larg + 1, alt + 1, { fill: cor.hex, enterAnimation: { type: 'slideUp', duration: 650, delay: k * 100, easing: 'easeOut' } })
        texto('nomecor', `${cor.nome}\n${cor.hex}`, { x: (st ? 0 : k * larg) + 48, y: (st ? k * alt : 0) + alt - (st ? 130 : 150), w: larg - 96, fonte: 'mono', tamanhos: [st ? 26 : 24], max: 3, lh: 1.6, cor: legivel(cor.hex, ['#141414', '#FAFAF9'], 4.5), anim: animItem(k) })
      })
      const cor0 = cores[0]!.hex
      texto('rotulo', `${String(c.numero).padStart(2, '0')} · ${d.titulo}`, { x: 48, y: st ? 56 : 48, w: (st ? W : larg) - 96, fonte: 'mono', tamanhos: [st ? 24 : 20], max: 1, upper: true, cor: legivel(cor0, ['#141414', '#FAFAF9'], 4.5), anim: null })
      break
    }
    case 'tipografia.amostra': {
      let y = MT
      const k = kicker(d.rotulo || 'Tipografia', M, y, W - M * 2)
      if (k) y = k.fim + 20
      texto('titulo', d.titulo, { x: M, y, w: st ? W - M * 2 : wc(6), fonte: 'titulo', tamanhos: st ? [72, 64] : [64, 56], max: 2, anim: animTitulo() })
      texto('aa', 'Aa', { x: M - 10, y: st ? H * 0.22 : H * 0.28, w: st ? W - M * 2 : W * 0.42, fonte: 'titulo', tamanhos: [st ? 380 : 460], max: 1, lh: 1, cor: forte, anim: animForma(150) })
      const amostra = `${F.titulo} — títulos\n${F.texto} — textos\n\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 — !?&@`
      texto('amostra', amostra, { x: st ? M : W * 0.52, y: st ? H * 0.52 : H * 0.32, w: st ? W - M * 2 : W * 0.48 - M, tamanhos: st ? [34, 30] : [34, 30], max: 8, cor: s.tinta })
      if (d.texto) texto('texto', d.texto, { x: st ? M : W * 0.52, y: st ? H * 0.8 : H * 0.76, w: st ? W - M * 2 : W * 0.48 - M, tamanhos: [26, 24], max: 3, cor: s.suave })
      break
    }

    // ================================================================ chamada e encerramento
    case 'cta.botao':
    case 'cta.faixa': {
      const faixa = d.variante === 'cta.faixa' || centro
      const larg = st ? W - M * 2 : faixa ? W * 0.76 : W * 0.66
      const x = faixa ? (W - larg) / 2 : M
      const al = faixa ? 'center' : 'left'
      const [botao = '', ...contatos] = itens
      const fonte = familia('titulo')
      const tam = st ? [110, 96, 84, 72] : [128, 110, 96, 84, 72]
      const prev = caber(d.titulo, fonte, larg, tam, 3, { tracking: F.tracking })
      const hT = prev.tamanho * 1.04 * (prev.linhas + (dividirEnfase(d.titulo, d.enfase) ? 1 : 0))
      let y = (H - hT - (d.texto ? 120 : 0) - (botao ? 160 : 0)) / 2
      if (!faixa) motivo(st ? W * 0.6 : W * 0.72, st ? H * 0.06 : H * 0.56, st ? W * 0.32 : W * 0.2, st ? W * 0.32 : W * 0.2, 'pequeno')
      const k = kicker(d.rotulo, x, y - 64, larg, al)
      if (!k) y = Math.max(MT, y)
      const tt = tituloEnfase(d.titulo, { x, y, w: larg, tamanhos: tam, max: 3, align: al })
      let fim = tt.fim
      if (d.texto) fim = texto('texto', d.texto, { x: faixa ? (W - (st ? larg : W * 0.56)) / 2 : x, y: fim + 36, w: st ? larg : W * 0.56, tamanhos: st ? [36, 32] : [32, 28], max: 3, cor: s.suave, align: al }).fim
      if (botao) {
        const tamB = st ? 34 : 30
        const wB = Math.min(larg, Math.round(botao.length * tamB * 0.58 + tamB * 2.6 + 40))
        const fundoB = s.tipo === 'acento' ? s.tinta : forte
        texto('item', `${botao}  →`, { x: faixa ? (W - wB) / 2 : x, y: fim + 56, w: wB, tamanhos: [tamB], max: 1, peso: 600, cor: legivel(fundoB, [s.fundo, sobreDestaque, '#FFFFFF', '#141414'], 4.5), align: 'center', anim: animForma(400), extra: { background: fundoB, padding: Math.round(tamB * 0.7), radius: 999 }, hMin: Math.round(tamB * 2.8) })
        fim = fim + 56 + tamB * 2.8
      }
      contatos.slice(0, 2).forEach((ct, j) => {
        const [rot = '', valor = ''] = partes(ct)
        const wct = st ? larg : 520
        const xct = faixa ? (st ? x : W / 2 - (contatos.length > 1 ? wct + 20 : wct / 2) + j * (wct + 40)) : x + j * (wct + 40)
        texto('contato', valor ? `${rot}\n${valor}` : rot, { x: xct, y: fim + 48 + (st ? j * 120 : 0), w: wct, tamanhos: st ? [30, 26] : [26, 24], max: 2, lh: 1.5, cor: s.suave, align: faixa && !st ? 'center' : al, anim: animTexto(500) })
      })
      break
    }
    case 'encerramento.centrado':
    case 'encerramento.contato': {
      const contato = d.variante === 'encerramento.contato' && !st
      if (contato) {
        const tt = tituloEnfase(d.titulo, { x: M, y: H * 0.34, w: wc(7), tamanhos: [168, 144, 124, 104, 88], max: 3 })
        kicker(d.rotulo, M, H * 0.34 - 64, wc(7))
        const linhas = itens.length ? itens : d.texto ? [d.texto] : []
        let y = H * 0.36
        linha(xc(8), y, 3, Math.max(160, linhas.length * 120), forte)
        linhas.slice(0, 3).forEach((ct, j) => {
          const [rot = '', valor = ''] = partes(ct)
          const b = texto('contato', valor ? `${rot}\n${valor}` : rot, { x: xc(8) + 44, y, w: wc(4) - 44, tamanhos: [30, 27, 24], max: 3, lh: 1.5, cor: s.tinta, anim: animItem(j) })
          y = b.fim + 36
        })
        if (itens.length && d.texto) texto('texto', d.texto, { x: M, y: tt.fim + 40, w: wc(6), tamanhos: [30, 27], max: 2, cor: s.suave })
        break
      }
      const larg = W - M * 2
      const fonte = familia('titulo')
      const tam = st ? [150, 128, 110, 96, 84] : [200, 170, 144, 124, 104, 92]
      // cabe o título, o motivo acima e o texto/contatos abaixo
      const hMax = H - MT * 2 - (decorar ? 160 : 40) - (d.texto ? 110 : 0) - itens.length * 52
      const prev = caber(d.titulo, fonte, larg, tam, 3, { tracking: F.tracking, peso: F.pesoTitulo, alturaMax: hMax })
      const hT = Math.min(hMax, prev.tamanho * 1.04 * (prev.linhas + (dividirEnfase(d.titulo, d.enfase) ? 1 : 0)))
      const yT = Math.max(MT + (decorar ? 140 : 0), (H - hT) / 2 - (d.texto || itens.length ? 60 : 0))
      if (decorar) {
        const lado = st ? 120 : 96
        const alt = formaMotivo === 'semicircle' ? lado / 2 : lado
        if (t.motivo === 'formas') forma('motivo', formaMotivo, W / 2 - lado / 2, yT - alt - 56, lado, alt, { name: 'motivo', fill: corMotivo, enterAnimation: animForma() })
        else if (t.motivo === 'brilho') motivo(W / 2 - (st ? 400 : 520), H / 2 - (st ? 400 : 420), st ? 800 : 1040, st ? 800 : 840, 'pequeno')
        else linha(W / 2 - 40, yT - 64, 80, 6, corMotivo, { name: 'motivo', radius: 3 })
      }
      const tt = tituloEnfase(d.titulo, { x: M, y: yT, w: larg, tamanhos: tam, max: 3, hMax, align: 'center' })
      let fim = tt.fim
      if (d.texto) fim = texto('texto', d.texto, { x: M, y: fim + 40, w: larg, tamanhos: st ? [38, 34] : [34, 30], max: 2, cor: s.suave, align: 'center' }).fim
      itens.slice(0, 3).forEach((ct, j) => {
        const [rot = '', valor = ''] = partes(ct)
        texto('contato', valor ? `${rot}  ${valor}` : rot, { x: M, y: fim + 28 + j * 52, w: larg, fonte: 'mono', tamanhos: [st ? 26 : 22], max: 1, cor: s.suave, align: 'center', anim: animItem(j) })
      })
      break
    }
  }

  if (temRodape) {
    motivoCanto()
    rodape()
  }
  // garante que nada saia muito da tela (o schema aceita, mas a prévia corta)
  for (const l of L) {
    if (l.type === 'text') l.height = Math.max(1, Math.min(l.height, H * 1.2))
  }
  const gradiente = s.tipo !== 'acento' && (s as Superficie).gradiente ? (s as Superficie).gradiente : undefined
  return {
    layers: L.map((l, i) => ({ ...l, z: i })),
    background: s.fundo,
    ...(gradiente ? { backgroundGradient: { type: 'linear' as const, angle: gradiente.angle, stops: gradiente.stops } } : {}),
  }
}

/** Ainda cabe no layout? (usado pela normalização para cortar o excesso sem quebrar a tela). */
export const limitesDe = (tipo: TipoTela) => COMPONENTES[tipo].limites
