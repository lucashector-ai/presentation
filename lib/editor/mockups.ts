/**
 * Mockups (Blocos): moldura de aparelho ou de formato (celular, tablet, notebook, navegador, post e story) feita
 * de formas + um frame "Tela" com recorte onde a pessoa solta a foto. Tudo em múltiplos de 8; o frame externo
 * guarda `mockup` para a seção do inspetor trocar o modelo e a cor da moldura. Puro: só calcula camadas.
 */
import { parseCamada, type Camada, type CamadaFrame } from '@/lib/scene/schema'

export interface MockupMeta { modelo: string; cor: string }

export const MODELOS_MOCKUP: { id: string; nome: string; largura: number; altura: number }[] = [
  { id: 'celular', nome: 'Celular', largura: 360, altura: 736 },
  { id: 'tablet', nome: 'Tablet', largura: 640, altura: 864 },
  { id: 'notebook', nome: 'Notebook', largura: 1120, altura: 704 },
  { id: 'navegador', nome: 'Janela do navegador', largura: 1120, altura: 720 },
  { id: 'post', nome: 'Post quadrado', largura: 560, altura: 560 },
  { id: 'story', nome: 'Story 9:16', largura: 400, altura: 712 },
]

const g8 = (v: number) => Math.round(v / 8) * 8

/** Gera o mockup com o canto superior esquerdo em (x, y), na largura pedida (altura pela proporção do modelo). */
export function gerarMockup(modeloId: string, pos: { x: number; y: number; largura: number }, meta: Partial<MockupMeta>, prefixo: string): Camada[] {
  const m = MODELOS_MOCKUP.find((x) => x.id === modeloId) ?? MODELOS_MOCKUP[0]!
  const cor = meta.cor ?? '#171717'
  const w = g8(pos.largura)
  const h = g8((w * m.altura) / m.largura)
  const x = g8(pos.x)
  const y = g8(pos.y)
  const saida: Camada[] = []
  let n = 0
  const id = (t: string) => `${prefixo}-${t}-${++n}`
  const raizId = `${prefixo}-mockup`
  const add = (dados: Record<string, unknown>) => { saida.push(parseCamada({ z: saida.length, ...dados })); return saida[saida.length - 1]! }
  const frame = (dados: Record<string, unknown>) => add({ type: 'frame', fill: undefined, ...dados }) as CamadaFrame
  const retangulo = (dados: Record<string, unknown>) => add({ type: 'shape', shape: 'rect', ...dados })

  // frame externo: moldura e tela são filhos; o próprio frame é o que a pessoa move e redimensiona
  frame({ id: raizId, name: `Mockup · ${m.nome}`, x, y, width: w, height: h, clip: false, mockup: { modelo: m.id, cor } })
  const tela = (r: { x: number; y: number; width: number; height: number }, radius: number) => frame({ id: id('tela'), name: 'Tela (solte a foto aqui)', parentId: raizId, ...r, radius, clip: true, fill: '#E8E6E1' })

  if (m.id === 'celular' || m.id === 'tablet') {
    const borda = m.id === 'celular' ? 16 : 24
    const raio = m.id === 'celular' ? 56 : 40
    retangulo({ id: id('corpo'), name: 'Corpo', parentId: raizId, x, y, width: w, height: h, fill: cor, radius: raio })
    tela({ x: x + borda, y: y + borda, width: w - borda * 2, height: h - borda * 2 }, raio - borda)
    if (m.id === 'celular') retangulo({ id: id('ilha'), name: 'Ilha dinâmica', parentId: raizId, x: x + g8(w * 0.34), y: y + borda + 16, width: g8(w * 0.32), height: 32, fill: cor, radius: 16 })
  } else if (m.id === 'notebook') {
    const base = 40
    retangulo({ id: id('tampa'), name: 'Tampa', parentId: raizId, x: x + 64, y, width: w - 128, height: h - base, fill: cor, radius: 24 })
    tela({ x: x + 80, y: y + 16, width: w - 160, height: h - base - 32 }, 12)
    retangulo({ id: id('base'), name: 'Base', parentId: raizId, x, y: y + h - base, width: w, height: base, fill: cor, radius: 16 })
    retangulo({ id: id('entalhe'), name: 'Entalhe', parentId: raizId, x: x + g8(w / 2 - 64), y: y + h - base, width: 128, height: 8, fill: '#FFFFFF33', radius: 4 })
  } else if (m.id === 'navegador') {
    const barra = 48
    retangulo({ id: id('janela'), name: 'Janela', parentId: raizId, x, y, width: w, height: h, fill: cor, radius: 16 })
    const cores = ['#FF5F57', '#FEBC2E', '#28C840']
    cores.forEach((c, i) => add({ type: 'shape', shape: 'ellipse', id: id('botao'), name: 'Botão', parentId: raizId, x: x + 16 + i * 24, y: y + 16, width: 16, height: 16, fill: c }))
    retangulo({ id: id('endereco'), name: 'Endereço', parentId: raizId, x: x + 112, y: y + 12, width: w - 224, height: 24, fill: '#FFFFFF1F', radius: 12 })
    tela({ x: x + 8, y: y + barra, width: w - 16, height: h - barra - 8 }, 8)
  } else {
    // post e story: a moldura é só um cartão fino; a tela ocupa quase tudo
    retangulo({ id: id('cartao'), name: 'Cartão', parentId: raizId, x, y, width: w, height: h, fill: cor, radius: m.id === 'story' ? 32 : 16 })
    tela({ x: x + 8, y: y + 8, width: w - 16, height: h - 16 }, m.id === 'story' ? 24 : 8)
  }
  return saida
}

/**
 * Feed do Instagram para apresentar posts a um cliente: celular (tilt 3D com o mouse) com barra de perfil,
 * destaques e uma grade 3×3 de "Post" (frames com recorte) que entram em cascata. Cada post pode receber uma
 * imagem e uma interação (ir para a tela do post). `nome` e `arroba` vão nos textos do perfil.
 */
export function gerarFeedInstagram(pos: { x: number; y: number; largura: number }, op: { nome?: string; arroba?: string; cor?: string; posts?: number }, prefixo: string): Camada[] {
  const base = gerarMockup('celular', pos, { cor: op.cor ?? '#171717' }, prefixo)
  const raiz = base[0]! as CamadaFrame
  const tela = base.find((l) => l.type === 'frame' && l.name?.startsWith('Tela')) as CamadaFrame
  const saida = [...base]
  let n = base.length
  const id = (t: string) => `${prefixo}-${t}-${++n}`
  const add = (dados: Record<string, unknown>) => { saida.push(parseCamada({ z: saida.length, parentId: tela.id, ...dados })); return saida[saida.length - 1]! }
  const W = tela.width
  const esc = W / 328 // medidas desenhadas para um celular de 328 px de tela
  const px = (v: number) => Math.round(v * esc)
  const x0 = tela.x
  let y = tela.y + px(56)
  const texto = (dados: Record<string, unknown>) => add({ type: 'text', fontFamily: 'Geist', color: '#171717', ...dados })
  // fundo branco do app + nome no topo
  add({ type: 'shape', shape: 'rect', id: id('fundo'), name: 'Fundo do app', x: tela.x, y: tela.y, width: W, height: tela.height, fill: '#FFFFFF' })
  texto({ id: id('arroba'), name: 'Arroba', text: op.arroba ?? '@suamarca', x: x0 + px(16), y: y - px(36), width: W - px(32), height: px(24), fontSize: px(16), fontWeight: 600 })
  // perfil: avatar + contadores
  add({ type: 'shape', shape: 'ellipse', id: id('avatar'), name: 'Avatar', x: x0 + px(16), y, width: px(72), height: px(72), fill: '#E4572E' })
  const contadores: [string, string][] = [['128', 'posts'], ['12,4 mil', 'seguidores'], ['310', 'seguindo']]
  contadores.forEach(([v, r], i) => {
    const cx = x0 + px(104) + i * px(72)
    texto({ id: id('num'), name: `Número ${r}`, text: v, x: cx, y: y + px(14), width: px(72), height: px(20), fontSize: px(15), fontWeight: 700, align: 'center' })
    texto({ id: id('rot'), name: `Rótulo ${r}`, text: r, x: cx, y: y + px(36), width: px(72), height: px(18), fontSize: px(11), color: '#737373', align: 'center' })
  })
  y += px(84)
  texto({ id: id('nome'), name: 'Nome', text: op.nome ?? 'Sua marca', x: x0 + px(16), y, width: W - px(32), height: px(20), fontSize: px(14), fontWeight: 600 })
  texto({ id: id('bio'), name: 'Bio', text: 'Posts feitos para a sua marca • toque em um post para ver', x: x0 + px(16), y: y + px(22), width: W - px(32), height: px(36), fontSize: px(12), color: '#525252', lineHeight: 1.3 })
  y += px(68)
  // destaques
  for (let i = 0; i < 4; i++) add({ type: 'shape', shape: 'ellipse', id: id('destaque'), name: `Destaque ${i + 1}`, x: x0 + px(16) + i * px(72), y, width: px(56), height: px(56), fill: '#F2F1EF', stroke: '#D4D4D4', strokeWidth: 1 })
  y += px(72)
  // abas + grade
  add({ type: 'shape', shape: 'rect', id: id('aba'), name: 'Aba ativa', x: x0, y, width: Math.round(W / 3), height: 2, fill: '#171717' })
  y += px(10)
  const gap = Math.max(2, px(2))
  const lado = Math.floor((W - gap * 2) / 3)
  const total = Math.min(12, Math.max(3, op.posts ?? 9))
  for (let i = 0; i < total; i++) {
    const col = i % 3, lin = Math.floor(i / 3)
    saida.push(parseCamada({ z: saida.length, type: 'frame', id: id('post'), name: `Post ${i + 1}`, parentId: tela.id, x: x0 + col * (lado + gap), y: y + lin * (lado + gap), width: lado, height: lado, clip: true, fill: ['#F2F1EF', '#E8E6E1', '#DDD9D2'][(i + lin) % 3], enterAnimation: { type: 'fadeIn', duration: 500, delay: 120 * i, easing: 'easeOut' } }))
  }
  // o celular inclina com o mouse
  saida[0] = { ...raiz, interactiveEffects: { tilt: { angle: 8, scale: 1.02, perspective: 1000, smooth: 0.5 } } } as Camada
  return saida
}

