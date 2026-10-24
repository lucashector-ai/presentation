/**
 * Mockups (Blocos): moldura realista de aparelho ou de formato (celular, tablet, notebook, navegador, post e
 * story) + um frame "Tela" com recorte onde a pessoa solta a foto. A moldura é uma camada `svg` (desenhos em
 * lib/editor/mockupsSvg.ts: metal com gradiente, botões, bezel, ilha dinâmica…) com sombra; por cima vão a
 * tela, o reflexo do vidro e os detalhes (ilha, notch, interface). Textos (endereço, nome, legenda) são camadas
 * de texto editáveis. O frame externo fica em múltiplos de 8, guarda `mockup` para a seção do inspetor, e todos
 * os filhos têm restrição "escala": redimensionar o frame escala o mockup inteiro. Puro: só calcula camadas.
 */
import { parseCamada, type Camada, type CamadaFrame, type Gradiente, type Interacao } from '@/lib/scene/schema'
import { comDescendentes, descendentes } from '@/lib/scene/arvore'
import { aplicarRestricao } from '@/lib/scene/restricoes'
import {
  CARTAO_POST, CELULAR, GRADIENTES_SUAVES, NAVEGADOR, NOTEBOOK, PERFIL, STORY, TABLET,
  svgCartaoPost, svgCelular, svgIlha, svgNavegador, svgNotch, svgNotebook, svgPerfil, svgReflexo, svgStory, svgTablet,
  temaInsta, temaJanela, temaMoldura,
} from './mockupsSvg'

export interface MockupMeta { modelo: string; cor: string }
/** Imagem disponível para preencher a tela e os posts (id do asset + proporção, quando conhecida). */
export interface ImagemMockup { id: string; width?: number | null; height?: number | null }

export const CORES_MOLDURA: { id: string; nome: string }[] = [
  { id: '#2C2C2E', nome: 'Preto' },
  { id: '#8E8A82', nome: 'Titânio natural' },
  { id: '#D6D6DA', nome: 'Prata' },
  { id: '#EDEAE4', nome: 'Branco' },
]
export const COR_MOLDURA_PADRAO = CORES_MOLDURA[1]!.id

export const MODELOS_MOCKUP: { id: string; nome: string; largura: number; altura: number }[] = [
  { id: 'celular', nome: 'Celular', largura: CELULAR.w, altura: CELULAR.h },
  { id: 'tablet', nome: 'Tablet', largura: TABLET.w, altura: TABLET.h },
  { id: 'notebook', nome: 'Notebook', largura: NOTEBOOK.w, altura: NOTEBOOK.h },
  { id: 'navegador', nome: 'Janela do navegador', largura: NAVEGADOR.w, altura: NAVEGADOR.h },
  { id: 'post', nome: 'Post do Instagram', largura: CARTAO_POST.w, altura: CARTAO_POST.cabecalho + CARTAO_POST.w + CARTAO_POST.rodape },
  { id: 'story', nome: 'Story 9:16', largura: STORY.w, altura: STORY.h },
]

/** Modelo do frame externo do feed (não aparece no menu de modelos). */
export const MODELO_FEED = 'feed-instagram'

const g8 = (v: number) => Math.round(v / 8) * 8
const ESCALA = { h: 'scale', v: 'scale' } as const
const FONTE = 'Geist'

/** Sombra de contato + sombra suave de um aparelho sobre a mesa. */
const SOMBRA_APARELHO = [
  { x: 0, y: 28, blur: 64, spread: 0, color: '#00000042' },
  { x: 0, y: 3, blur: 6, spread: 0, color: '#0000002E' },
]
const SOMBRA_CARTAO = [
  { x: 0, y: 20, blur: 48, spread: 0, color: '#0000002B' },
  { x: 0, y: 1, blur: 3, spread: 0, color: '#0000001F' },
]

/** Fundo da tela quando não há imagem: gradiente suave em vez de cinza. */
const FUNDO_TELA: Gradiente = { type: 'linear', angle: 155, stops: [{ color: '#F6F7F5', pos: 0 }, { color: '#B5D8C2', pos: 58 }, { color: '#D9F99D', pos: 100 }] }

const gradienteSuave = (i: number, angle = 145): Gradiente => {
  const [a, b] = GRADIENTES_SUAVES[i % GRADIENTES_SUAVES.length]!
  return { type: 'linear', angle, stops: [{ color: a, pos: 0 }, { color: b, pos: 100 }] }
}

type Retangulo = { x: number; y: number; width: number; height: number }

/** Acumula camadas já validadas com z sequencial, ids com prefixo e restrição de escala. */
function montador(prefixo: string) {
  const saida: Camada[] = []
  let n = 0
  const id = (t: string) => `${prefixo}-${t}-${++n}`
  const add = (dados: Record<string, unknown>) => {
    saida.push(parseCamada({ z: saida.length, constraints: ESCALA, ...dados }))
    return saida[saida.length - 1]!
  }
  /** Anexa camadas geradas por outro montador (mantendo a ordem relativa). */
  const anexar = (outras: readonly Camada[]) => { for (const c of outras) saida.push({ ...c, z: saida.length } as Camada) }
  return { saida, id, add, anexar }
}

/** Escolhe a imagem mais adequada à orientação pedida (sem repetir as já usadas). */
function escolherImagem(imagens: readonly ImagemMockup[] | undefined, orientacao: 'retrato' | 'paisagem' | 'qualquer', usadas: Set<string>): ImagemMockup | undefined {
  const livres = (imagens ?? []).filter((i) => !usadas.has(i.id))
  const retrato = (i: ImagemMockup) => !!i.width && !!i.height && i.height > i.width
  const preferida = orientacao === 'qualquer' ? livres[0] : livres.find((i) => (orientacao === 'retrato') === retrato(i)) ?? livres[0]
  if (preferida) usadas.add(preferida.id)
  return preferida
}

/** Gera o mockup com o canto superior esquerdo em (x, y), na largura pedida (altura pela proporção do modelo). */
export function gerarMockup(modeloId: string, pos: { x: number; y: number; largura: number }, meta: Partial<MockupMeta>, prefixo: string, imagens?: readonly ImagemMockup[]): Camada[] {
  const m = MODELOS_MOCKUP.find((x) => x.id === modeloId) ?? MODELOS_MOCKUP[0]!
  const cor = meta.cor ?? COR_MOLDURA_PADRAO
  const tema = temaMoldura(cor)
  const w = Math.max(64, g8(pos.largura))
  const h = Math.max(64, g8((w * m.altura) / m.largura))
  const x = g8(pos.x)
  const y = g8(pos.y)
  // escalas do desenho nativo para o frame (a altura é arredondada à grade, então os eixos escalam separados)
  const sx = w / m.largura
  const sy = h / m.altura
  const px = (v: number) => Math.round(v * sx)
  const py = (v: number) => Math.round(v * sy)
  const fs = (v: number) => Math.max(6, Math.round(v * sx * 10) / 10)
  const { saida, id, add } = montador(prefixo)
  const raizId = `${prefixo}-mockup`
  const usadas = new Set<string>()

  add({ type: 'frame', id: raizId, name: `Mockup · ${m.nome}`, x, y, width: w, height: h, clip: false, constraints: undefined, mockup: { modelo: m.id, cor } })
  const svg = (nome: string, r: Retangulo, markup: string, extra: Record<string, unknown> = {}) => add({ type: 'svg', id: id('svg'), name: nome, parentId: raizId, ...r, markup, fit: 'fill', locked: true, ...extra })
  const texto = (nome: string, text: string, r: Retangulo, extra: Record<string, unknown> = {}) => add({ type: 'text', id: id('texto'), name: nome, parentId: raizId, ...r, text, fontFamily: FONTE, ...extra })
  const tela = (r: Retangulo, radius: number, orientacao: 'retrato' | 'paisagem' | 'qualquer', extra: Record<string, unknown> = {}) => {
    const img = escolherImagem(imagens, orientacao, usadas)
    const f = add({ type: 'frame', id: id('tela'), name: 'Tela (solte a foto aqui)', parentId: raizId, ...r, radius, clip: true, fill: '#DCE3DA', gradient: FUNDO_TELA, ...extra }) as CamadaFrame
    if (img) add({ type: 'image', id: id('imagem'), name: 'Imagem da tela', parentId: f.id, assetId: img.id, fit: 'cover', ...r })
    return f
  }
  const todo = { x, y, width: w, height: h }

  if (m.id === 'celular') {
    const { corpoX, raio, aro, bezel, ilha } = CELULAR
    const inset = aro + bezel
    svg('Corpo', todo, svgCelular(tema), { effects: { shadows: SOMBRA_APARELHO } })
    const rTela = { x: x + px(corpoX + inset), y: y + py(inset), width: px(CELULAR.corpoW - inset * 2), height: py(CELULAR.h - inset * 2) }
    tela(rTela, Math.round((raio - inset) * sx), 'retrato')
    svg('Reflexo do vidro', rTela, svgReflexo(CELULAR.corpoW - inset * 2, CELULAR.h - inset * 2, raio - inset))
    svg('Ilha dinâmica', { x: x + px(CELULAR.w / 2 - ilha.w / 2), y: y + py(ilha.y), width: px(ilha.w), height: py(ilha.h) }, svgIlha())
  } else if (m.id === 'tablet') {
    const { corpoY, corpoW, raio, aro, bezel } = TABLET
    const inset = aro + bezel
    svg('Corpo', todo, svgTablet(tema), { effects: { shadows: SOMBRA_APARELHO } })
    const rTela = { x: x + px(inset), y: y + py(corpoY + inset), width: px(corpoW - inset * 2), height: py(TABLET.h - corpoY - inset * 2) }
    tela(rTela, Math.round((raio - inset) * sx), 'qualquer')
    svg('Reflexo do vidro', rTela, svgReflexo(corpoW - inset * 2, TABLET.h - corpoY - inset * 2, raio - inset))
  } else if (m.id === 'notebook') {
    const { tampaX, tampaW, tampaH, aro, bezel, notch } = NOTEBOOK
    const inset = aro + bezel
    svg('Corpo', todo, svgNotebook(tema), { effects: { shadows: [{ x: 0, y: 36, blur: 72, spread: 0, color: '#0000003D' }, { x: 0, y: 4, blur: 10, spread: 0, color: '#00000029' }] } })
    tela({ x: x + px(tampaX + inset), y: y + py(inset), width: px(tampaW - inset * 2), height: py(tampaH - inset - bezel - 4) }, Math.round(4 * sx), 'paisagem')
    svg('Notch', { x: x + px(NOTEBOOK.w / 2 - notch.w / 2), y: y + py(aro), width: px(notch.w), height: py(notch.h) }, svgNotch())
  } else if (m.id === 'navegador') {
    const j = temaJanela(tema.escura)
    const topo = NAVEGADOR.abas + NAVEGADOR.barra
    svg('Janela', todo, svgNavegador(j), { effects: { shadows: [{ x: 0, y: 24, blur: 56, spread: 0, color: '#00000038' }, { x: 0, y: 2, blur: 4, spread: 0, color: '#0000001F' }] } })
    const r = Math.round(NAVEGADOR.raio * sx)
    tela({ x, y: y + py(topo), width: w, height: h - py(topo) }, 0, 'paisagem', { radii: [0, 0, r, r] })
    texto('Título da aba', 'Sua marca — Início', { x: x + px(130), y: y + py(16), width: px(160), height: py(20) }, { fontSize: fs(13), fontWeight: 500, color: j.texto })
    texto('Endereço', 'suamarca.com.br', { x: x + px(144), y: y + py(NAVEGADOR.abas + 15), width: px(400), height: py(18) }, { fontSize: fs(13), fontWeight: 400, color: j.texto2 })
  } else if (m.id === 'post') {
    const t = temaInsta(tema.escura)
    const { cabecalho, raio } = CARTAO_POST
    svg('Cartão', todo, svgCartaoPost(CARTAO_POST.w, CARTAO_POST.w, t, raio), { effects: { shadows: SOMBRA_CARTAO } })
    tela({ x, y: y + py(cabecalho), width: w, height: py(CARTAO_POST.w) }, 0, 'qualquer')
    textosDoPost(texto, { x, y, px, py, fs }, { nome: 'suamarca', local: 'São Paulo, Brasil', curtidas: '1.284 curtidas', legenda: 'Nova coleção no ar: peças feitas à mão, em poucas unidades. #suamarca', yRodape: cabecalho + CARTAO_POST.w, larguraLegenda: CARTAO_POST.w - 32 }, t)
  } else {
    const r = Math.round(STORY.raio * sx)
    tela(todo, r, 'retrato', { effects: { shadows: SOMBRA_CARTAO } })
    svg('Interface do story', todo, svgStory())
    texto('Nome', 'suamarca', { x: x + px(56), y: y + py(34), width: px(110), height: py(20) }, { fontSize: fs(13), fontWeight: 600, color: '#FFFFFF' })
    texto('Tempo', '2 h', { x: x + px(168), y: y + py(34), width: px(40), height: py(20) }, { fontSize: fs(13), fontWeight: 400, color: '#FFFFFFB3' })
    texto('Inicial', 'S', { x: x + px(22), y: y + py(34), width: px(20), height: py(20) }, { fontSize: fs(11), fontWeight: 700, color: '#D9F99D', align: 'center', valign: 'middle' })
    texto('Resposta', 'Enviar mensagem', { x: x + px(28), y: y + py(STORY.h - 60 + 12), width: px(220), height: py(20) }, { fontSize: fs(13), fontWeight: 400, color: '#FFFFFFD9' })
  }
  return saida
}

type Medidas = { x: number; y: number; px: (v: number) => number; py: (v: number) => number; fs: (v: number) => number }
type Texto = (nome: string, text: string, r: Retangulo, extra?: Record<string, unknown>) => Camada

/** Nome, local, inicial do avatar, curtidas e legenda de um cartão de post (nativo: cabeçalho 56, rodapé a partir de `yRodape`). */
function textosDoPost(texto: Texto, m: Medidas, d: { nome: string; local: string; curtidas: string; legenda: string; yRodape: number; larguraLegenda: number }, t: { texto: string; texto2: string }) {
  const { x, y, px, py, fs } = m
  texto('Nome do perfil', d.nome, { x: x + px(64), y: y + py(12), width: px(240), height: py(20) }, { fontSize: fs(14), fontWeight: 600, color: t.texto })
  texto('Local', d.local, { x: x + px(64), y: y + py(31), width: px(240), height: py(16) }, { fontSize: fs(11), fontWeight: 400, color: t.texto2 })
  texto('Inicial do post', d.nome.charAt(0).toUpperCase(), { x: x + px(24), y: y + py(18), width: px(20), height: py(20) }, { fontSize: fs(12), fontWeight: 700, color: '#D9F99D', align: 'center', valign: 'middle' })
  texto('Curtidas', d.curtidas, { x: x + px(16), y: y + py(d.yRodape + 42), width: px(d.larguraLegenda), height: py(18) }, { fontSize: fs(13), fontWeight: 600, color: t.texto })
  texto('Legenda', d.legenda, { x: x + px(16), y: y + py(d.yRodape + 62), width: px(d.larguraLegenda), height: py(34) }, { fontSize: fs(12.5), fontWeight: 400, color: t.texto, lineHeight: 1.3 })
}

export interface OpcoesFeed { nome?: string; arroba?: string; cor?: string; posts?: number; imagens?: readonly ImagemMockup[] }

/** Medidas nativas da composição do feed: cartão 480 + vão 120 + celular 360 = 960 de largura, pela altura do celular. */
export const FEED = { w: 960, cartao: 480, celularX: 600, celularW: CELULAR.w, h: CELULAR.h } as const
/** Quantos posts cabem na grade 3×3 (e no limite de 8 interações por post, ver `interacoesDoPost`). */
export const POSTS_FEED = 9

/**
 * Feed do Instagram para apresentar posts a um cliente. Composição em um frame externo (`mockup.modelo`
 * = 'feed-instagram'): à esquerda o post em destaque grande (cartão com cabeçalho, foto 4:5, ações, curtidas
 * e legenda editáveis); à direita o celular realista com o perfil (avatar, @, contadores, bio, destaques) e a
 * grade 3×3. Cada post recebe uma imagem (ou um gradiente suave) e, ao ser clicado na apresentação, mostra a
 * sua foto no destaque: as fotos do destaque ficam empilhadas (a 1ª sempre visível embaixo, as outras ocultas);
 * clicar no post i revela a foto i e esconde as que estão acima dela na pilha — a foto visível mais alta é
 * sempre a do último post clicado, com no máximo 8 ações por post. Os posts entram em cascata; o celular
 * inclina com o mouse.
 */
export function gerarFeedInstagram(pos: { x: number; y: number; largura: number }, op: OpcoesFeed, prefixo: string): Camada[] {
  const cor = op.cor ?? COR_MOLDURA_PADRAO
  // o app fica claro em qualquer cor de moldura (a cor só muda o metal do celular)
  const t = temaInsta(false)
  const nome = op.nome ?? 'Sua marca'
  const arroba = op.arroba ?? '@suamarca'
  const usuario = arroba.replace(/^@/, '')
  const total = Math.min(POSTS_FEED, Math.max(3, op.posts ?? POSTS_FEED))
  const w = Math.max(240, g8(pos.largura))
  const x = g8(pos.x)
  const y = g8(pos.y)
  const esc = w / FEED.w
  const px = (v: number) => Math.round(v * esc)
  const fs = (v: number) => Math.max(6, Math.round(v * esc * 10) / 10)
  const raizId = `${prefixo}-feed`
  const { saida, id, add, anexar } = montador(prefixo)

  // celular primeiro: a altura dele define a altura da composição
  const celular = gerarMockup('celular', { x: x + px(FEED.celularX), y, largura: px(FEED.celularW) }, { cor }, `${prefixo}-cel`)
  const celRaiz = celular[0]! as CamadaFrame
  const celTela = celular.find((l) => l.type === 'frame' && l.name?.startsWith('Tela')) as CamadaFrame
  const h = celRaiz.height
  const ph = (v: number) => Math.round((v * h) / FEED.h)

  add({ type: 'frame', id: raizId, name: 'Feed do Instagram', x, y, width: w, height: h, clip: false, constraints: undefined, mockup: { modelo: MODELO_FEED, cor } })
  const texto: Texto = (nomeCamada, text, r, extra = {}) => add({ type: 'text', id: id('texto'), name: nomeCamada, parentId: raizId, ...r, text, fontFamily: FONTE, ...extra })

  // ----- post em destaque (cartão à esquerda) -----
  const cartaoW = px(FEED.cartao)
  const cabecalho = ph(CARTAO_POST.cabecalho)
  const fotoH = Math.round(cartaoW * 1.25)
  const cartao = add({ type: 'frame', id: id('cartao'), name: 'Post em destaque', parentId: raizId, x, y, width: cartaoW, height: h, radius: px(20), clip: true, fill: t.fundo, effects: { shadows: SOMBRA_CARTAO }, enterAnimation: { type: 'slideUp', duration: 700, easing: 'easeOut' } })
  add({ type: 'svg', id: id('svg'), name: 'Interface do post', parentId: cartao.id, x, y, width: cartaoW, height: h, markup: svgCartaoPost(FEED.cartao, Math.round((fotoH * FEED.cartao) / cartaoW), t, 20, Math.round(((h - cabecalho - fotoH) * FEED.cartao) / cartaoW)), fit: 'fill', locked: true })
  const rFoto = { x, y: y + cabecalho, width: cartaoW, height: fotoH }
  const foto = add({ type: 'frame', id: id('foto'), name: 'Foto em destaque', parentId: cartao.id, ...rFoto, clip: true, fill: t.separador }) as CamadaFrame
  const imagens = op.imagens ?? []
  const destaques: Camada[] = []
  for (let i = 0; i < total; i++) {
    const img = imagens[i]
    const comum = { id: id('destaque'), name: `Destaque ${i + 1}`, parentId: foto.id, ...rFoto, hidden: i > 0, enterAnimation: { type: 'fadeIn', duration: 350, easing: 'easeOut' } }
    destaques.push(img ? add({ type: 'image', assetId: img.id, fit: 'cover', ...comum }) : add({ type: 'shape', shape: 'rect', fill: GRADIENTES_SUAVES[i % GRADIENTES_SUAVES.length]![0], gradient: gradienteSuave(i), ...comum }))
  }
  const medidasCartao: Medidas = { x, y, px, py: ph, fs }
  textosDoPost((n, tx, r, extra) => texto(n, tx, r, { ...extra, parentId: cartao.id }), medidasCartao, { nome: usuario, local: 'São Paulo, Brasil', curtidas: '1.284 curtidas', legenda: `Nova coleção no ar: peças feitas à mão, em poucas unidades. #${usuario}`, yRodape: Math.round(((cabecalho + fotoH) * FEED.h) / h), larguraLegenda: FEED.cartao - 32 }, t)

  // ----- celular com o perfil -----
  // sem o reflexo do vidro: ele ficaria por cima da grade e pegaria os cliques nos posts
  anexar(celular.filter((c) => c.name !== 'Reflexo do vidro').map((c) => (c.id === celRaiz.id ? { ...c, parentId: raizId, constraints: ESCALA, enterAnimation: { type: 'slideUp', duration: 700, delay: 120, easing: 'easeOut' }, interactiveEffects: { tilt: { angle: 8, scale: 1.02, perspective: 1000, smooth: 0.5 } } } : c) as Camada))
  const telaId = celTela.id
  const tx = celTela.x
  const ty = celTela.y
  const sp = (v: number) => Math.round((v * celTela.width) / PERFIL.w)
  const sv = (v: number) => Math.round((v * celTela.height) / PERFIL.h)
  const fp = (v: number) => Math.max(6, Math.round(((v * celTela.width) / PERFIL.w) * 10) / 10)
  // a tela vira o fundo do app (sem gradiente) e recebe a interface
  const telaIdx = saida.findIndex((c) => c.id === telaId)
  saida[telaIdx] = { ...(saida[telaIdx] as CamadaFrame), name: 'Tela do celular', fill: t.fundo, gradient: undefined }
  add({ type: 'svg', id: id('svg'), name: 'Interface do Instagram', parentId: telaId, x: tx, y: ty, width: celTela.width, height: celTela.height, markup: svgPerfil(t), fit: 'fill', locked: true })
  const tp: Texto = (nomeCamada, text, r, extra = {}) => texto(nomeCamada, text, r, { ...extra, parentId: telaId })
  const na = (nx: number, ny: number, nw: number, nh: number): Retangulo => ({ x: tx + sp(nx), y: ty + sv(ny), width: sp(nw), height: sv(nh) })
  tp('Hora', '9:41', na(26, 15, 50, 20), { fontSize: fp(15), fontWeight: 600, color: t.texto })
  tp('Arroba', arroba, na(16, 52, 200, 24), { fontSize: fp(17), fontWeight: 700, color: t.texto })
  const { avatar } = PERFIL
  tp('Inicial do perfil', nome.charAt(0).toUpperCase(), na(avatar.cx - 20, avatar.cy - 16, 40, 32), { fontSize: fp(26), fontWeight: 700, color: '#D9F99D', align: 'center', valign: 'middle' })
  const contadores: [string, string][] = [['128', 'posts'], ['12,4 mil', 'seguidores'], ['310', 'seguindo']]
  contadores.forEach(([v, r], i) => {
    tp(`Número ${r}`, v, na(108 + i * 72, 108, 68, 22), { fontSize: fp(16), fontWeight: 700, color: t.texto, align: 'center' })
    tp(`Rótulo ${r}`, r, na(108 + i * 72, 132, 68, 16), { fontSize: fp(12), fontWeight: 400, color: t.texto2, align: 'center' })
  })
  tp('Nome', nome, na(16, 176, 292, 18), { fontSize: fp(14), fontWeight: 600, color: t.texto })
  tp('Bio', 'Peças feitas à mão, em poucas unidades. Toque em um post para ver de perto.', na(16, 196, 292, 34), { fontSize: fp(12), fontWeight: 400, color: t.texto, lineHeight: 1.3 })
  const { botoes, destaques: d } = PERFIL
  tp('Botão seguir', 'Seguir', na(botoes.x1, botoes.y, botoes.w, botoes.h), { fontSize: fp(13), fontWeight: 600, color: '#FFFFFF', align: 'center', valign: 'middle' })
  tp('Botão mensagem', 'Mensagem', na(botoes.x2, botoes.y, botoes.w, botoes.h), { fontSize: fp(13), fontWeight: 600, color: t.texto, align: 'center', valign: 'middle' })
  ;['Coleção', 'Bastidores', 'Novidades', 'Loja'].forEach((rotulo, i) => tp(`Rótulo do destaque ${i + 1}`, rotulo, na(d.x0 + i * d.passo - 36, d.y + d.d / 2 + 6, 72, 14), { fontSize: fp(11), fontWeight: 400, color: t.texto, align: 'center' }))

  // grade 3×3: frames com recorte, imagem ou gradiente, entrada em cascata e clique → destaque
  const gap = Math.max(1, sp(PERFIL.grade.gap))
  const lado = Math.floor((celTela.width - gap * 2) / 3)
  const gx = tx + Math.floor((celTela.width - (lado * 3 + gap * 2)) / 2)
  const gy = ty + sv(PERFIL.grade.y)
  for (let i = 0; i < total; i++) {
    const col = i % 3
    const lin = Math.floor(i / 3)
    const r = { x: gx + col * (lado + gap), y: gy + lin * (lado + gap), width: lado, height: lado }
    const img = imagens[i]
    const post = add({ type: 'frame', id: id('post'), name: `Post ${i + 1}`, parentId: telaId, ...r, clip: true, fill: GRADIENTES_SUAVES[i % GRADIENTES_SUAVES.length]![1], gradient: img ? undefined : gradienteSuave(i), ariaLabel: `Ver post ${i + 1}`, enterAnimation: { type: 'scaleIn', duration: 500, delay: 360 + 70 * i, easing: 'easeOut' }, interactions: interacoesDoPost(i, destaques.map((c) => c.id)) })
    if (img) add({ type: 'image', id: id('imagem'), name: `Imagem do post ${i + 1}`, parentId: post.id, assetId: img.id, fit: 'cover', ...r })
  }
  return saida
}

/**
 * Interações do post `i`: revela a foto `i` do destaque e esconde as que estão acima dela na pilha (a 1ª foto
 * fica sempre visível embaixo, por isso o post 1 só esconde as outras). Com 9 posts, no máximo 8 ações.
 */
export function interacoesDoPost(i: number, destaques: readonly string[]): Interacao[] {
  const acoes: Interacao[] = []
  if (i > 0) acoes.push({ trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'toggleLayer', targetLayerId: destaques[i]!, mode: 'show' } })
  for (let k = i + 1; k < destaques.length; k++) acoes.push({ trigger: 'click', conditions: { once: false, threshold: 0.5 }, do: { action: 'toggleLayer', targetLayerId: destaques[k]!, mode: 'hide' } })
  return acoes
}

/** O frame "Tela" de um mockup (filho direto da raiz). */
export function telaDoMockup(raizId: string, camadas: readonly Camada[]): CamadaFrame | undefined {
  return camadas.find((l): l is CamadaFrame => l.parentId === raizId && l.type === 'frame' && !!l.name?.startsWith('Tela'))
}

export interface Regeneracao {
  /** Filhos diretos da tela antiga: primeiro saem dela (para não serem removidos junto). */
  soltar: string[]
  remover: string[]
  raiz: Partial<CamadaFrame>
  inserir: Camada[]
  /** Tudo que estava na tela, reposicionado para a tela nova (filhos diretos trocam de pai). */
  conteudo: { id: string; patch: Partial<Camada> }[]
}

/**
 * Troca o modelo e/ou a cor de um mockup existente mantendo o que a pessoa pôs na tela: a moldura antiga sai,
 * a nova entra com os mesmos (x, y, largura) e o conteúdo da tela é escalado da tela antiga para a nova.
 * Puro; quem aplica (SecaoMockup) segue a ordem soltar → remover → raiz → inserir → conteúdo.
 */
export function regenerarMoldura(raiz: CamadaFrame, camadas: readonly Camada[], meta: MockupMeta, prefixo: string): Regeneracao {
  const telaAntiga = telaDoMockup(raiz.id, camadas)
  const dentro = telaAntiga ? descendentes(telaAntiga.id, camadas) : []
  const diretos = new Set(dentro.filter((c) => c.parentId === telaAntiga!.id).map((c) => c.id))
  const geradas = gerarMockup(meta.modelo, { x: raiz.x, y: raiz.y, largura: raiz.width }, meta, prefixo)
  const [externo, ...filhas] = geradas
  const inserir = filhas.map((c) => (c.parentId === externo!.id ? { ...c, parentId: raiz.id } : { ...c })) as Camada[]
  const telaNova = inserir.find((l): l is CamadaFrame => l.type === 'frame' && !!l.name?.startsWith('Tela'))
  const manter = new Set(dentro.map((c) => c.id))
  const remover = comDescendentes([raiz.id], camadas).filter((id) => id !== raiz.id && !manter.has(id))
  // z é global e plano: a moldura nova vai para o topo e o conteúdo da tela, por cima dela, na ordem em que estava
  const topo = Math.max(0, ...camadas.map((c) => c.z)) + 1
  inserir.forEach((c, i) => { c.z = topo + i })
  const ordem = [...dentro].sort((a, b) => a.z - b.z).map((c) => c.id)
  const conteudo = dentro.map((c) => {
    const r = telaAntiga && telaNova ? aplicarRestricao(c, telaAntiga, telaNova, ESCALA) : c
    const patch: Partial<Camada> = { x: Math.round(r.x), y: Math.round(r.y), width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)), z: topo + inserir.length + ordem.indexOf(c.id) }
    if (diretos.has(c.id) && telaNova) patch.parentId = telaNova.id
    return { id: c.id, patch }
  })
  return { soltar: [...diretos], remover, raiz: { mockup: meta, width: externo!.width, height: externo!.height }, inserir, conteudo }
}

/** Coloca camadas recém-geradas acima de tudo que já existe na tela (z é global e plano). */
export function acimaDe<T extends Camada>(novas: readonly T[], existentes: readonly Camada[]): T[] {
  const topo = existentes.length ? Math.max(...existentes.map((c) => c.z)) + 1 : 0
  return novas.map((c, i) => ({ ...c, z: topo + i }))
}

/** Campos rápidos do feed (seção Mockup): cada um aponta para os textos que mostram aquele valor. */
export const CAMPOS_FEED = [
  { id: 'nome', rotulo: 'Nome' },
  { id: 'arroba', rotulo: '@' },
  { id: 'posts', rotulo: 'Posts' },
  { id: 'seguidores', rotulo: 'Seguidores' },
  { id: 'seguindo', rotulo: 'Seguindo' },
  { id: 'curtidas', rotulo: 'Curtidas' },
  { id: 'legenda', rotulo: 'Legenda' },
] as const
export type CampoFeed = (typeof CAMPOS_FEED)[number]['id']

const TEXTOS_DO_CAMPO: Record<CampoFeed, string> = {
  nome: 'Nome', arroba: 'Arroba', posts: 'Número posts', seguidores: 'Número seguidores', seguindo: 'Número seguindo', curtidas: 'Curtidas', legenda: 'Legenda',
}

const textoDoFeed = (raizId: string, camadas: readonly Camada[], nome: string) =>
  descendentes(raizId, camadas).find((c): c is Extract<Camada, { type: 'text' }> => c.type === 'text' && c.name === nome)

/** Valor atual de um campo rápido do feed (lido do texto correspondente). */
export function valorCampoFeed(raizId: string, camadas: readonly Camada[], campo: CampoFeed): string {
  return textoDoFeed(raizId, camadas, TEXTOS_DO_CAMPO[campo])?.text ?? ''
}

/** Edita um campo rápido do feed: o texto principal e os que dependem dele (o @ também vai para o nome do post e as iniciais). */
export function editarCampoFeed(raizId: string, camadas: readonly Camada[], campo: CampoFeed, valor: string): { id: string; text: string }[] {
  const mudar: { id: string; text: string }[] = []
  const em = (nome: string, text: string) => { const c = textoDoFeed(raizId, camadas, nome); if (c && c.text !== text) mudar.push({ id: c.id, text }) }
  const limpo = valor.trim()
  if (campo === 'arroba') {
    const usuario = limpo.replace(/^@+/, '') || 'suamarca'
    em('Arroba', `@${usuario}`)
    em('Nome do perfil', usuario)
    em('Inicial do post', usuario.charAt(0).toUpperCase())
  } else if (campo === 'nome') {
    em('Nome', limpo || 'Sua marca')
    em('Inicial do perfil', (limpo || 'S').charAt(0).toUpperCase())
  } else em(TEXTOS_DO_CAMPO[campo], valor)
  return mudar
}
