/**
 * Roteiro (outline) de uma apresentação e o motor de layout que o transforma em telas.
 * Usado pelo "Criar com IA" (a IA produz o roteiro; o layout é determinístico e sempre válido)
 * e pelos templates do novo projeto. Puro: sem rede, sem DOM.
 */
import { z } from 'zod'
import { FORMATOS, SCHEMA_VERSION, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import { parseDocumento } from '@/lib/scene/migrar'
import { PALETA } from '@/lib/design-tokens'

export const TIPOS_TELA = ['capa', 'conceito', 'secao', 'lista', 'numeros', 'citacao', 'paleta', 'tipografia', 'imagem', 'comparacao', 'encerramento'] as const
export type TipoTela = (typeof TIPOS_TELA)[number]

export const TelaRoteiroSchema = z.object({
  tipo: z.enum(TIPOS_TELA),
  titulo: z.string().trim().min(1).max(120),
  texto: z.string().trim().max(600).default(''),
  /** Bullets, números ("38%|mais passageiros") ou cores ("Terracota|#B4532A"), conforme o tipo. */
  itens: z.array(z.string().trim().max(160)).max(6).default([]),
  notas: z.string().trim().max(1200).default(''),
})
export type TelaRoteiro = z.infer<typeof TelaRoteiroSchema>

export const ESTILOS = ['editorial', 'ousado', 'minimal'] as const
export type Estilo = (typeof ESTILOS)[number]

export const RoteiroSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  telas: z.array(TelaRoteiroSchema).min(1).max(100),
})
export type Roteiro = z.infer<typeof RoteiroSchema>

/** Temas prontos (pares da paleta + fontes). */
export const TEMAS = [
  { id: 'argila', nome: 'Argila', base: 'argila', alterna: 'carvao', acento: '#B4532A', fonteTitulo: 'Geist', fonteTexto: 'Geist' },
  { id: 'mare', nome: 'Maré', base: 'creme', alterna: 'mare', acento: '#E4572E', fonteTitulo: 'Geist', fonteTexto: 'Geist' },
  { id: 'grafite', nome: 'Grafite', base: 'grafite', alterna: 'lima', acento: '#D7F25C', fonteTitulo: 'Space Grotesk', fonteTexto: 'Geist' },
  { id: 'ameixa', nome: 'Ameixa', base: 'pessego', alterna: 'ameixa', acento: '#5965F2', fonteTitulo: 'Fraunces', fonteTexto: 'Geist' },
  { id: 'salvia', nome: 'Sálvia', base: 'salvia', alterna: 'musgo', acento: '#F2C14E', fonteTitulo: 'Instrument Serif', fonteTexto: 'Geist' },
  { id: 'nevoa', nome: 'Névoa', base: 'nevoa', alterna: 'violeta', acento: '#5965F2', fonteTitulo: 'Geist', fonteTexto: 'Geist' },
] as const
export type TemaId = (typeof TEMAS)[number]['id']

const par = (id: string) => PALETA.find((p) => p.id === id) ?? PALETA[0]

export const OPCOES_IMAGENS = ['formas', 'placeholders', 'nenhuma'] as const
export type OpcaoImagens = (typeof OPCOES_IMAGENS)[number]
export const DENSIDADES = ['minimo', 'medio', 'detalhado'] as const
export type Densidade = (typeof DENSIDADES)[number]

interface Opcoes {
  modo: ModoProjeto
  tema: TemaId
  estilo: Estilo
  /** formas: decoração geométrica; placeholders: espaços para imagens suas; nenhuma: só tipografia. */
  imagens?: OpcaoImagens
  /** Quanto texto de apoio entra em cada tela. */
  densidade?: Densidade
}

/** Aplica imagens/densidade ao roteiro antes do layout. */
function prepararRoteiro(roteiro: Roteiro, imagens: OpcaoImagens, densidade: Densidade): Roteiro {
  return {
    ...roteiro,
    telas: roteiro.telas.map((t) => {
      let tela = t
      if (imagens === 'nenhuma' && tela.tipo === 'imagem') tela = { ...tela, tipo: 'conceito' }
      if (densidade === 'minimo' && tela.tipo !== 'capa' && tela.tipo !== 'citacao') tela = { ...tela, texto: tela.tipo === 'encerramento' ? tela.texto : '', itens: tela.itens.slice(0, 3) }
      if (densidade === 'medio') tela = { ...tela, texto: tela.texto.length > 240 ? `${tela.texto.slice(0, 239).trimEnd()}…` : tela.texto, itens: tela.itens.slice(0, 5) }
      return tela
    }),
  }
}

let seq = 0
const uid = (p: string) => `${p}-${(++seq).toString(36)}`

/** Gera o documento completo a partir do roteiro. Sempre válido pelo schema. */
export function montarDocumento(roteiroOriginal: Roteiro, opcoes: Opcoes): DocumentoProjeto {
  seq = 0
  const imagens = opcoes.imagens ?? 'formas'
  const roteiro = prepararRoteiro(roteiroOriginal, imagens, opcoes.densidade ?? 'detalhado')
  const tema = TEMAS.find((t) => t.id === opcoes.tema) ?? TEMAS[0]
  const story = opcoes.modo === 'story'
  const size = story ? FORMATOS.story : FORMATOS.slides169
  const claro = par(tema.base)
  const escuro = par(tema.alterna)
  const telas = roteiro.telas.map((t, i) => {
    // alterna fundo claro/escuro em telas de "respiro" (conceito, seção, citação, encerramento)
    const invertida = ['conceito', 'secao', 'citacao', 'encerramento'].includes(t.tipo) && opcoes.estilo !== 'minimal'
    const fundo = invertida ? escuro.fundo : claro.fundo
    const tinta = invertida ? escuro.tinta : claro.tinta
    const id = `tela-${String(i + 1).padStart(2, '0')}`
    const layers = layout(t, { size, fundo, tinta, acento: tema.acento, fonteTitulo: tema.fonteTitulo, fonteTexto: tema.fonteTexto, estilo: opcoes.estilo, decorar: opcoes.estilo !== 'minimal' && imagens === 'formas', placeholders: imagens === 'placeholders', story, numero: i + 1, total: roteiro.telas.length, tituloProjeto: roteiro.titulo })
    const colunas = Math.ceil(Math.sqrt(roteiro.telas.length))
    return {
      id,
      title: t.titulo.slice(0, 60),
      size,
      background: fundo,
      notes: t.notas,
      transition: { type: i === 0 ? 'fade' : opcoes.estilo === 'ousado' ? 'slide' : 'fade', duration: 600, easing: 'easeInOut' },
      ...(opcoes.modo === 'explorar' ? { map: { x: (i % colunas) * (size.width + 360), y: Math.floor(i / colunas) * (size.height + 360) } } : {}),
      layers,
    }
  })
  // modo explorar: a capa ganha um menu de hotspots para as outras telas
  if (opcoes.modo === 'explorar' && telas.length > 1) {
    const capa = telas[0]!
    const destinos = telas.slice(1, 7)
    destinos.forEach((d, k) => {
      capa.layers.push({ id: uid('menu'), type: 'text', text: `${String(k + 2).padStart(2, '0')}  ${d.title}`, x: size.width * 0.62, y: size.height * 0.2 + k * 90, width: size.width * 0.32, height: 70, fontFamily: tema.fonteTexto, fontSize: 34, fontWeight: 500, color: claro.tinta, ariaLabel: `Ir para ${d.title}`, interactions: [{ trigger: 'click', do: { action: 'goToScene', targetSceneId: d.id }, transition: { type: 'scale', duration: 700 } }] } as never)
    })
    for (const d of destinos) d.layers.push({ id: uid('voltar'), type: 'text', text: '← Início', x: 100, y: size.height - 120, width: 240, height: 50, fontFamily: tema.fonteTexto, fontSize: 28, color: d.background === escuro.fundo ? escuro.tinta : claro.tinta, ariaLabel: 'Voltar ao início', interactions: [{ trigger: 'click', do: { action: 'goToScene', targetSceneId: capa.id } }] } as never)
  }
  return parseDocumento({ schemaVersion: SCHEMA_VERSION, mode: opcoes.modo, theme: { palette: tema.base, fontTitle: tema.fonteTitulo, fontBody: tema.fonteTexto }, scenes: telas })
}

interface Ctx {
  size: { width: number; height: number }
  fundo: string
  tinta: string
  acento: string
  fonteTitulo: string
  fonteTexto: string
  estilo: Estilo
  decorar: boolean
  placeholders: boolean
  story: boolean
  numero: number
  total: number
  tituloProjeto: string
}

function layout(t: TelaRoteiro, c: Ctx): unknown[] {
  const W = c.size.width
  const H = c.size.height
  const m = c.story ? 90 : 120
  const L: unknown[] = []
  const mono = { fontFamily: 'Geist Mono', fontSize: c.story ? 26 : 22, letterSpacing: 2, transform: 'uppercase', color: c.tinta, opacity: 0.6 }
  const linhas = (txt: string, tamanho: number, largura: number) => Math.max(1, Math.ceil(txt.length / Math.max(6, largura / (tamanho * 0.55))))
  /** Maior tamanho da lista que cabe em `max` linhas (ou o menor). */
  const caber = (txt: string, largura: number, tamanhos: number[], max: number) => tamanhos.find((n) => linhas(txt, n, largura) <= max) ?? tamanhos[tamanhos.length - 1]!
  const titulo = (txt: string, y: number, tamanho: number, extra: Record<string, unknown> = {}) => {
    const largura = typeof extra.width === 'number' ? extra.width : W - m * 2
    return { id: uid('titulo'), name: c.numero === 1 ? 'titulo' : undefined, type: 'text', text: txt, x: m, y, width: largura, height: tamanho * 1.05 * linhas(txt, tamanho, largura), fontFamily: c.fonteTitulo, fontSize: tamanho, fontWeight: 500, letterSpacing: -tamanho * 0.04, lineHeight: 1.02, color: c.tinta, enterAnimation: { type: c.estilo === 'ousado' ? 'slideUp' : 'fadeIn', duration: 700, easing: c.estilo === 'ousado' ? 'spring' : 'easeOut' }, ...extra }
  }
  const corpo = (txt: string, y: number, w = W - m * 2, tamanho = c.story ? 40 : 34) => ({ id: uid('texto'), type: 'text', text: txt, x: m, y, width: w, height: tamanho * 1.45 * Math.max(1, Math.ceil((txt.length * tamanho * 0.5) / w)), fontFamily: c.fonteTexto, fontSize: tamanho, fontWeight: 400, lineHeight: 1.45, color: c.tinta, opacity: 0.85, enterAnimation: { type: 'fadeIn', duration: 600, delay: 200 } })
  const rotulo = (txt: string) => ({ id: uid('rotulo'), type: 'text', text: txt, x: m, y: m * 0.8, width: W - m * 2, height: 40, ...mono })
  const forma = (shape: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) => ({ id: uid('forma'), name: c.numero === 1 ? 'forma' : undefined, type: 'shape', shape, x, y, width: w, height: h, fill: c.acento, enterAnimation: { type: 'scaleIn', duration: 800, delay: 150, easing: 'spring' }, ...extra })

  const numeroTela = `${String(c.numero).padStart(2, '0')} — ${t.titulo}`
  switch (t.tipo) {
    case 'capa': {
      L.push(rotulo(c.tituloProjeto === t.titulo ? 'Apresentação' : c.tituloProjeto))
      if (c.placeholders) L.push(c.story ? forma('rect', m, H * 0.1, W - m * 2, H * 0.36, { fill: c.tinta, opacity: 0.08, radius: 12, ariaLabel: 'Espaço para imagem' }) : forma('rect', W * 0.62, m, W * 0.38 - m, H - m * 2, { fill: c.tinta, opacity: 0.08, radius: 12, ariaLabel: 'Espaço para imagem' }))
      else if (c.decorar) L.push(c.story ? forma('ellipse', W * 0.25, H * 0.12, W * 0.5, W * 0.5) : forma(c.estilo === 'ousado' ? 'ellipse' : 'rect', W * 0.68, H * 0.14, W * 0.22, c.estilo === 'ousado' ? W * 0.22 : H * 0.72, { pattern: c.estilo === 'editorial' ? 'stripes' : 'none' }))
      // maior corpo que cabe em até 2 linhas; o título fica ancorado acima da linha de apoio
      const largura = c.story ? W - m * 2 : W * 0.58
      const tam = (c.story ? [170, 140, 110, 90] : [260, 200, 150, 120, 96]).find((n) => linhas(t.titulo, n, largura) <= 2) ?? (c.story ? 80 : 84)
      const yTexto = c.story ? H * 0.8 : H * 0.78
      const altura = tam * 1.05 * linhas(t.titulo, tam, largura)
      L.push(titulo(t.titulo, Math.max(m * 1.6, (t.texto ? yTexto - 40 : H * 0.86) - altura), tam, { width: largura }))
      if (t.texto) L.push(corpo(t.texto, yTexto, c.story ? W - m * 2 : W * 0.5, c.story ? 42 : 44))
      break
    }
    case 'conceito':
    case 'secao': {
      L.push(rotulo(numeroTela))
      const largura = c.story ? W - m * 2 : W * 0.72
      const tam = caber(t.titulo, largura, c.story ? [120, 96, 80] : t.tipo === 'secao' ? [200, 150, 120, 96] : [140, 110, 90], 3)
      const tt = titulo(t.titulo, H * 0.3, tam, { width: largura })
      L.push(tt)
      if (t.texto) L.push(corpo(t.texto, Math.max(c.story ? H * 0.62 : H * 0.7, tt.y + tt.height + 48), c.story ? W - m * 2 : W * 0.55))
      if (c.decorar) L.push(forma('ellipse', c.story ? W * 0.6 : W * 0.78, c.story ? H * 0.08 : H * 0.12, c.story ? W * 0.3 : W * 0.14, c.story ? W * 0.3 : W * 0.14, { effects: { blur: 0, backdropBlur: 0, blend: 'normal', shadow: { x: 0, y: 0, blur: 120, spread: 0, color: `${c.acento}88` } } }))
      break
    }
    case 'lista': {
      L.push(rotulo(numeroTela))
      L.push(titulo(t.titulo, m * 1.6, c.story ? 96 : 96, { width: c.story ? W - m * 2 : W * 0.45 }))
      const itens = t.itens.length ? t.itens : t.texto.split(/[.;]\s+/).filter(Boolean).slice(0, 4)
      const x0 = c.story ? m : W * 0.52
      const y0 = c.story ? H * 0.4 : m * 1.8
      const passo = c.story ? 210 : Math.min(190, (H - y0 - m) / Math.max(1, itens.length))
      itens.forEach((it, k) => {
        L.push({ id: uid('num'), type: 'text', text: String(k + 1).padStart(2, '0'), x: x0, y: y0 + k * passo, width: 80, height: 40, ...mono, opacity: 1, color: c.acento === c.fundo ? c.tinta : c.acento })
        L.push({ ...corpo(it, y0 + k * passo - 6, (c.story ? W - m * 2 : W * 0.4) - 100, c.story ? 40 : 36), x: x0 + 100, enterAnimation: { type: 'slideUp', duration: 500, delay: 150 + k * 120 } })
        L.push({ id: uid('linha'), type: 'shape', shape: 'line', x: x0, y: y0 + k * passo + passo - 30, width: (c.story ? W - m * 2 : W * 0.4), height: 2, fill: c.tinta, stroke: c.tinta, strokeWidth: 1, opacity: 0.15 })
      })
      break
    }
    case 'numeros': {
      L.push(rotulo(numeroTela))
      L.push(titulo(t.titulo, m * 1.6, c.story ? 90 : 90, { width: W - m * 2 }))
      const itens = (t.itens.length ? t.itens : ['—|sem dados']).slice(0, c.story ? 3 : 3)
      const col = c.story ? 1 : itens.length
      const w = (W - m * 2 - (col - 1) * 60) / col
      itens.forEach((it, k) => {
        const [valor, legenda] = it.split('|')
        const x = c.story ? m : m + k * (w + 60)
        const y = c.story ? H * 0.32 + k * 380 : H * 0.45
        L.push({ id: uid('valor'), type: 'text', text: (valor ?? '').trim(), x, y, width: w, height: 200, fontFamily: c.fonteTitulo, fontSize: c.story ? 160 : 180, fontWeight: 500, letterSpacing: -8, lineHeight: 1, color: c.tinta, enterAnimation: { type: 'slideUp', duration: 700, delay: k * 150, easing: 'spring' } })
        L.push({ ...corpo((legenda ?? '').trim(), y + 210, w, 32), x })
      })
      break
    }
    case 'citacao': {
      L.push({ id: uid('aspas'), type: 'text', text: '“', x: m - 10, y: c.story ? H * 0.18 : H * 0.08, width: 300, height: 300, fontFamily: 'Instrument Serif', fontSize: 380, color: c.acento, lineHeight: 1 })
      L.push(titulo(t.titulo, c.story ? H * 0.32 : H * 0.3, c.story ? 96 : 110, { fontFamily: 'Instrument Serif', italic: true, letterSpacing: -2, width: c.story ? W - m * 2 : W * 0.75 }))
      if (t.texto) L.push({ ...rotulo(t.texto), y: c.story ? H * 0.8 : H * 0.8 })
      break
    }
    case 'paleta': {
      const cores = (t.itens.length ? t.itens : ['Primária|' + c.acento, 'Fundo|' + c.fundo, 'Tinta|' + c.tinta]).slice(0, 5).map((s) => { const [n, h] = s.split('|'); return { nome: (n ?? '').trim(), hex: /^#[0-9a-f]{6}$/i.test((h ?? '').trim()) ? (h ?? '').trim() : c.acento } })
      const larg = c.story ? W : W / cores.length
      const alt = c.story ? H / cores.length : H
      cores.forEach((cor, k) => {
        L.push({ id: uid('cor'), type: 'shape', shape: 'rect', x: c.story ? 0 : k * larg, y: c.story ? k * alt : 0, width: larg, height: alt, fill: cor.hex, enterAnimation: { type: 'slideUp', duration: 600, delay: k * 100 } })
        L.push({ id: uid('nomecor'), type: 'text', text: `${cor.nome}\n${cor.hex.toUpperCase()}`, x: (c.story ? 0 : k * larg) + 48, y: (c.story ? k * alt : 0) + alt - 140, width: larg - 96, height: 100, fontFamily: 'Geist Mono', fontSize: 24, lineHeight: 1.6, color: luminancia(cor.hex) > 0.5 ? '#171717' : '#FAFAF9' })
      })
      L.push({ ...rotulo(numeroTela), color: luminancia(cores[0]!.hex) > 0.5 ? '#171717' : '#FAFAF9', opacity: 0.8 })
      break
    }
    case 'tipografia': {
      L.push(rotulo(numeroTela))
      L.push({ id: uid('aa'), type: 'text', text: 'Aa', x: m, y: H * 0.18, width: W * 0.4, height: H * 0.55, fontFamily: c.fonteTitulo, fontSize: c.story ? 360 : 440, fontWeight: 500, letterSpacing: -18, lineHeight: 1, color: c.tinta })
      L.push({ ...corpo(`${c.fonteTitulo} — títulos\n${c.fonteTexto} — textos\n\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789`, c.story ? H * 0.6 : H * 0.28, c.story ? W - m * 2 : W * 0.4, 36), x: c.story ? m : W * 0.52 })
      break
    }
    case 'imagem': {
      L.push(rotulo(numeroTela))
      L.push(forma('rect', c.story ? m : W * 0.46, c.story ? H * 0.12 : m, c.story ? W - m * 2 : W * 0.54 - m, c.story ? H * 0.5 : H - m * 2, { fill: c.acento, pattern: 'stripes', radius: 8, ariaLabel: 'Espaço para imagem' }))
      L.push({ id: uid('legenda'), type: 'text', text: 'arraste sua imagem aqui', x: c.story ? m + 30 : W * 0.46 + 30, y: c.story ? H * 0.12 + H * 0.5 - 60 : H - m - 60, width: 500, height: 34, ...mono, color: '#FAFAF9', opacity: 0.9, transform: 'none' })
      const largura = c.story ? W - m * 2 : W * 0.36
      const tam = caber(t.titulo, largura, c.story ? [90, 72, 60] : [100, 80, 64], 3)
      const tt = titulo(t.titulo, c.story ? H * 0.66 : Math.min(H * 0.36, H * 0.6 - tam * 1.05 * linhas(t.titulo, tam, largura)), tam, { width: largura })
      L.push(tt)
      if (t.texto) L.push(corpo(t.texto, Math.max(c.story ? H * 0.82 : H * 0.62, tt.y + tt.height + 40), c.story ? W - m * 2 : W * 0.34, c.story ? 36 : 32))
      break
    }
    case 'comparacao': {
      L.push(rotulo(numeroTela))
      L.push(titulo(t.titulo, m * 1.6, 96, { width: W - m * 2 }))
      const [a, b] = [t.itens.filter((_, k) => k % 2 === 0), t.itens.filter((_, k) => k % 2 === 1)]
      const w = c.story ? W - m * 2 : (W - m * 2 - 60) / 2
      ;[a, b].forEach((col, k) => {
        const x = c.story ? m : m + k * (w + 60)
        const y = c.story ? H * 0.32 + k * H * 0.32 : H * 0.42
        L.push({ id: uid('caixa'), type: 'shape', shape: 'rect', x, y, width: w, height: c.story ? H * 0.28 : H * 0.46, fill: k === 0 ? c.tinta : c.acento, opacity: k === 0 ? 0.06 : 1, radius: 16 })
        L.push({ ...corpo(col.join('\n') || '—', y + 40, w - 80, 32), x: x + 40, color: k === 0 ? c.tinta : luminancia(c.acento) > 0.5 ? '#171717' : '#FAFAF9', opacity: 1 })
      })
      break
    }
    case 'encerramento': {
      L.push(titulo(t.titulo, c.story ? H * 0.4 : H * 0.36, c.story ? 140 : 200, { align: 'center', x: m, width: W - m * 2 }))
      if (t.texto) L.push({ ...corpo(t.texto, c.story ? H * 0.62 : H * 0.66, W - m * 2, 34), align: 'center' })
      if (c.decorar) L.push(forma('ellipse', W / 2 - 40, c.story ? H * 0.28 : H * 0.18, 80, 80))
      break
    }
  }
  return L.map((l, i) => ({ ...(l as object), z: i }))
}

export function luminancia(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** Roteiros dos templates do "Novo projeto". */
export const TEMPLATES: { id: string; nome: string; descricao: string; tema: TemaId; estilo: Estilo; modo: ModoProjeto; roteiro: Roteiro }[] = [
  {
    id: 'identidade', nome: 'Identidade visual', descricao: 'Conceito, paleta, tipografia e aplicações.', tema: 'argila', estilo: 'editorial', modo: 'slides',
    roteiro: { titulo: 'Identidade visual', telas: [
      { tipo: 'capa', titulo: 'Nome da marca', texto: 'Identidade visual — proposta 01', itens: [], notas: 'Apresente o nome e o tom da proposta.' },
      { tipo: 'conceito', titulo: 'O conceito em uma frase.', texto: 'Explique de onde vem a ideia e como ela guia todas as decisões.', itens: [], notas: '' },
      { tipo: 'paleta', titulo: 'Paleta', texto: '', itens: ['Terracota|#B4532A', 'Argila|#EEE7DB', 'Sálvia|#A7B29A', 'Carvão|#2B1D16'], notas: '' },
      { tipo: 'tipografia', titulo: 'Tipografia', texto: '', itens: [], notas: '' },
      { tipo: 'imagem', titulo: 'Aplicações', texto: 'Papelaria, embalagem, sinalização e digital.', itens: [], notas: '' },
      { tipo: 'encerramento', titulo: 'Obrigado.', texto: 'contato@estudio.com', itens: [], notas: '' },
    ] },
  },
  {
    id: 'pitch', nome: 'Pitch / proposta comercial', descricao: 'Problema, solução, números e próximos passos.', tema: 'grafite', estilo: 'ousado', modo: 'slides',
    roteiro: { titulo: 'Proposta', telas: [
      { tipo: 'capa', titulo: 'Proposta para o cliente', texto: 'Outubro 2026', itens: [], notas: '' },
      { tipo: 'conceito', titulo: 'O problema', texto: 'O que está travando o resultado hoje.', itens: [], notas: '' },
      { tipo: 'lista', titulo: 'Nossa abordagem', texto: '', itens: ['Diagnóstico em duas semanas', 'Conceito e protótipo', 'Lançamento com métricas'], notas: '' },
      { tipo: 'numeros', titulo: 'Resultados esperados', texto: '', itens: ['+38%|engajamento', '2×|conversão', '6 sem.|até o lançamento'], notas: '' },
      { tipo: 'comparacao', titulo: 'Investimento', texto: '', itens: ['Essencial', 'Completo', 'Identidade + site', 'Identidade + site + campanha'], notas: '' },
      { tipo: 'encerramento', titulo: 'Vamos começar?', texto: 'Próximo passo: reunião de kick-off.', itens: [], notas: '' },
    ] },
  },
  {
    id: 'portfolio', nome: 'Portfólio', descricao: 'Apresente cases com navegação livre.', tema: 'nevoa', estilo: 'minimal', modo: 'explorar',
    roteiro: { titulo: 'Portfólio', telas: [
      { tipo: 'capa', titulo: 'Seu nome', texto: 'Direção de arte e identidade visual', itens: [], notas: '' },
      { tipo: 'imagem', titulo: 'Case 01', texto: 'Cliente, desafio e resultado.', itens: [], notas: '' },
      { tipo: 'imagem', titulo: 'Case 02', texto: 'Cliente, desafio e resultado.', itens: [], notas: '' },
      { tipo: 'imagem', titulo: 'Case 03', texto: 'Cliente, desafio e resultado.', itens: [], notas: '' },
      { tipo: 'conceito', titulo: 'Sobre', texto: 'Quem é você e como trabalha.', itens: [], notas: '' },
    ] },
  },
  {
    id: 'campanha', nome: 'Campanha (Story)', descricao: 'Narrativa vertical guiada pelo scroll.', tema: 'mare', estilo: 'ousado', modo: 'story',
    roteiro: { titulo: 'Campanha', telas: [
      { tipo: 'capa', titulo: 'Nome da campanha', texto: 'Verão 2027', itens: [], notas: '' },
      { tipo: 'conceito', titulo: 'A ideia', texto: 'O que a campanha quer fazer as pessoas sentirem.', itens: [], notas: '' },
      { tipo: 'imagem', titulo: 'Key visual', texto: '', itens: [], notas: '' },
      { tipo: 'encerramento', titulo: 'Lançamento 21.12', texto: '', itens: [], notas: '' },
    ] },
  },
]
