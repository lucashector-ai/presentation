'use client'
/**
 * Leva o conteúdo colado/solto para dentro da tela atual.
 * Cópia normal do Figma (⌘C) vira camadas editáveis (texto, formas, vetores; ver colarFigma.ts).
 * Figma "Copiar como SVG" e Illustrator viram camadas SVG vetoriais (cores editáveis); PNG/JPG viram imagem;
 * GLB/GLTF do Blender vira 3D; JSON do After Effects (Bodymovin) vira Lottie; links do YouTube/Vimeo/Figma
 * viram incorporação; texto vira caixa de texto; camadas copiadas da Mostra são coladas com IDs novos.
 */
import { comprimirColado, iniciarEnvio, progressoEnvio, terminarEnvio } from './enviosEmCurso'
import DOMPurify from 'dompurify'
import type { Editor } from './useEditor'
import { interpretar, type ConteudoColado } from '@/lib/importar/clipboard'
import { dimensoesSvg, normalizarSvg, sanitizarSvg } from '@/lib/importar/svg'
import { MAX_SVG_INLINE, type Camada } from '@/lib/scene/schema'
import { telaDoMockup } from './mockups'
import { aplicarFotoFeed, lugarDaCamada, lugarNoPonto, raizDoFeed, type LugarFoto } from './feedFotos'
import { enquadrarNaCena } from '@/lib/scene/transform'
import { dados, type AssetDemo, type ProgressoUpload } from '@/lib/dados'
import { colarDoFigma } from './colarFigma'
import { carregarCatalogo } from '@/lib/fontes/catalogo'
import { embutirFontesNoSvg } from '@/lib/fontes/svg'

export type Avisar = (texto: string, tipo?: 'info' | 'sucesso' | 'erro') => void

export function sanitizarSvgNavegador(markup: string): string {
  return normalizarSvg(sanitizarSvg(markup, DOMPurify))
}

/** Textos do SVG com fontes do Google: nomes do catálogo e fontes recortadas embutidas (lib/fontes/svg.ts). */
async function comFontesEmbutidas(markup: string): Promise<string> {
  if (!/<text\b/i.test(markup)) return markup
  try {
    return await embutirFontesNoSvg(markup, await carregarCatalogo())
  } catch {
    return markup
  }
}

export interface OpcoesImportacao {
  /** Ponto (coordenadas da tela) onde o item foi solto. */
  ponto?: { x: number; y: number }
  avisar: Avisar
  aoProgredir?: (nome: string, p: ProgressoUpload) => void
}

function retanguloPara(editor: Editor, tam: { width: number; height: number }, ponto?: { x: number; y: number }, fracao = 0.6) {
  const c = editor.cena!
  const maxW = c.size.width * fracao
  const maxH = c.size.height * fracao
  const s = Math.min(1, maxW / tam.width, maxH / tam.height)
  const w = tam.width * s
  const h = tam.height * s
  if (ponto) return { x: ponto.x - w / 2, y: ponto.y - h / 2, width: w, height: h }
  const r = enquadrarNaCena({ width: w, height: h }, c.size, 0)
  return { x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, width: w, height: h }
}

/** Cria a camada SVG a partir de markup (já validado como SVG). */
export async function inserirSvg(editor: Editor, markupBruto: string, opcoes: OpcoesImportacao, nome = 'vetor') {
  const markup = await comFontesEmbutidas(sanitizarSvgNavegador(markupBruto))
  if (!/<svg/i.test(markup)) return opcoes.avisar('Este SVG ficou vazio depois da limpeza de segurança.', 'erro')
  const tam = dimensoesSvg(markup)
  const rect = retanguloPara(editor, tam, opcoes.ponto)
  if (markup.length > MAX_SVG_INLINE) {
    // vetores muito grandes viram arquivo (asset) em vez de markup inline
    const arquivo = new File([markup], `${nome}.svg`, { type: 'image/svg+xml' })
    return dados.enviarArquivo(arquivo, (p) => opcoes.aoProgredir?.(arquivo.name, p), { sanitizarSvg: (t) => t, projetoId: editor.projetoId }).then((a) => editor.acoes.criarCamada({ type: 'svg', assetId: a.id, name: nome }, rect))
  }
  return editor.acoes.criarCamada({ type: 'svg', markup, name: nome }, rect)
}

export async function importarArquivos(editor: Editor, arquivos: File[], opcoes: OpcoesImportacao): Promise<AssetDemo[]> {
  const prontos: AssetDemo[] = []
  let deslocamento = 0
  let naSelecao = false
  for (const arquivo of arquivos) {
    try {
      // SVG com textos: as fontes do Google vão embutidas no arquivo (o <img> do SVG não carrega fontes de fora)
      const f = (arquivo.type === 'image/svg+xml' || /\.svg$/i.test(arquivo.name)) && arquivo.size < 2_000_000
        ? await arquivo.text().then(async (t) => { const m = /<text\b/i.test(t) ? await comFontesEmbutidas(sanitizarSvgNavegador(t)) : t; return m === t ? arquivo : new File([m], arquivo.name, { type: 'image/svg+xml' }) })
        : arquivo
      const ponto = opcoes.ponto ? { x: opcoes.ponto.x + deslocamento, y: opcoes.ponto.y + deslocamento } : undefined
      deslocamento += 32
      // imagem: aparece na hora (prévia local) enquanto sobe; print colado vai comprimido
      const imagem = /^image\/(png|jpeg|webp|gif|avif)$/.test(f.type) ? await comprimirColado(f) : f
      // colar com uma caixa, frame, mockup ou imagem selecionados: a imagem entra neles (não vira camada solta)
      // soltar em cima de um post, destaque ou foto do perfil de um feed: a imagem entra nele
      const soImagem = arquivos.length === 1 && /^image\/(png|jpeg|webp|gif|avif)$/.test(imagem.type)
      const alvo = !soImagem ? null : opcoes.ponto ? alvoNoPonto(editor, opcoes.ponto) : alvoDaImagem(editor)
      const previa = /^image\/(png|jpeg|webp|gif|avif)$/.test(imagem.type) ? await iniciarPrevia(editor, imagem, ponto, alvo?.caixa) : null
      let a: AssetDemo
      try {
        a = await dados.enviarArquivo(imagem, (p) => { opcoes.aoProgredir?.(imagem.name, p); if (previa) progressoEnvio(previa.id, p.progresso) }, { sanitizarSvg: sanitizarSvgNavegador, projetoId: editor.projetoId })
      } finally {
        if (previa) terminarEnvio(previa.id)
      }
      prontos.push(a)
      if (a.erro) opcoes.avisar(a.erro, 'info')
      if (alvo) { alvo.aplicar(a.id); naSelecao = true }
      else editor.acoes.adicionarAsset(a, previa ? previa.centro : ponto)
    } catch (e) {
      opcoes.avisar(e instanceof Error ? e.message : `Não foi possível importar ${arquivo.name}.`, 'erro')
    }
  }
  if (prontos.length) {
    const tipos = new Set(prontos.map((p) => p.tipo))
    const rotulo = tipos.has('model3d') ? 'modelo 3D' : tipos.has('svg') ? 'vetor' : tipos.has('lottie') ? 'animação' : tipos.has('video') ? 'vídeo' : 'imagem'
    const feminino = rotulo === 'imagem' || rotulo === 'animação'
    opcoes.avisar(naSelecao ? (opcoes.ponto ? 'Imagem colocada no feed.' : 'Imagem colocada na seleção.') : prontos.length === 1 ? `${rotulo[0]!.toUpperCase()}${rotulo.slice(1)} ${feminino ? 'adicionada' : 'adicionado'} à tela.` : `${prontos.length} arquivos adicionados à tela.`, 'sucesso')
  }
  return prontos
}

type Caixa = { x: number; y: number; width: number; height: number }

/**
 * Onde a imagem colada entra quando há uma seleção: imagem → troca o arquivo; mockup → dentro da tela do
 * aparelho (troca a imagem que já estiver lá); forma ou frame → preenchimento com imagem (cobrir).
 */
function alvoDaImagem(editor: Editor): { caixa: Caixa; aplicar: (assetId: string) => void } | null {
  const sel = editor.camadasSelecionadas
  const camadas = editor.cena?.layers ?? []
  if (sel.length !== 1) return null
  const l = sel[0]!
  const { acoes } = editor
  const caixa = (c: Caixa) => ({ x: c.x, y: c.y, width: c.width, height: c.height })
  const lugar = lugarDaCamada(l)
  const feed = lugar && raizDoFeed(l, camadas)
  if (lugar && feed) return { caixa: caixa(l), aplicar: (assetId) => aplicarFotoNoFeed(editor, feed.id, lugar, assetId) }
  if (l.type === 'image') return { caixa: caixa(l), aplicar: (assetId) => acoes.atualizarCamadas([l.id], { assetId } as Partial<Camada>) }
  if (l.type === 'frame' && l.mockup) {
    const tela = telaDoMockup(l.id, camadas)
    if (!tela) return null
    const atual = camadas.find((c) => c.parentId === tela.id && c.type === 'image')
    if (atual) return { caixa: caixa(tela), aplicar: (assetId) => acoes.atualizarCamadas([atual.id], { assetId, fit: 'cover' } as Partial<Camada>) }
    return { caixa: caixa(tela), aplicar: (assetId) => acoes.criarCamada({ type: 'image', assetId, fit: 'cover', parentId: tela.id, name: 'Imagem' }, caixa(tela)) }
  }
  const preenchivel = l.type === 'frame' || (l.type === 'shape' && !l.isMask && !l.vetor && l.shape !== 'line' && l.shape !== 'arrow')
  if (preenchivel) return { caixa: caixa(l), aplicar: (assetId) => acoes.atualizarCamadas([l.id], (c) => ({ ...c, fillImage: { assetId, fit: 'cover' }, gradient: undefined }) as Camada) }
  return null
}

/** Põe a foto num lugar do feed (post + destaque dele, perfil + cabeçalho do post…) num único passo do histórico. */
export function aplicarFotoNoFeed(editor: Editor, raizId: string, lugar: LugarFoto, assetId: string | null) {
  const novas = new Map(aplicarFotoFeed(raizId, editor.cena?.layers ?? [], lugar, assetId).map((c) => [c.id, c]))
  if (novas.size) editor.acoes.atualizarCamadas([...novas.keys()], (l) => novas.get(l.id) ?? l)
}

/** Alvo de uma imagem solta num ponto: um lugar de foto de feed embaixo do cursor (senão, camada solta). */
export function alvoNoPonto(editor: Editor, ponto: { x: number; y: number }): { caixa: Caixa; aplicar: (assetId: string) => void } | null {
  const camadas = editor.cena?.layers ?? []
  const achado = lugarNoPonto(camadas, ponto)
  if (!achado) return null
  const { camada: c } = achado
  return { caixa: { x: c.x, y: c.y, width: c.width, height: c.height }, aplicar: (assetId) => aplicarFotoNoFeed(editor, achado.raiz.id, achado.lugar, assetId) }
}

/** Prévia local da imagem no lugar onde a camada vai entrar (mesmo enquadramento de adicionarAsset), ou sobre o alvo. */
async function iniciarPrevia(editor: Editor, arquivo: File, ponto?: { x: number; y: number }, sobre?: Caixa) {
  const c = editor.cena
  if (!c) return null
  try {
    const bmp = await createImageBitmap(arquivo)
    const tam = { width: bmp.width, height: bmp.height }
    bmp.close()
    const r = enquadrarNaCena(tam, c.size, Math.min(c.size.width, c.size.height) * 0.15)
    const rect = sobre ?? (ponto ? { ...r, x: ponto.x - r.width / 2, y: ponto.y - r.height / 2 } : r)
    const id = `envio-${Math.random().toString(36).slice(2, 9)}`
    iniciarEnvio({ id, url: URL.createObjectURL(arquivo), cenaId: c.id, ...rect, progresso: 0 })
    return { id, centro: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } }
  } catch {
    return null
  }
}

async function baixarComoArquivo(url: string): Promise<File> {
  const r = await fetch(url, { mode: 'cors' })
  if (!r.ok) throw new Error(String(r.status))
  const blob = await r.blob()
  const nome = url.startsWith('data:') ? `colado.${blob.type.split('/')[1] ?? 'png'}` : decodeURIComponent(new URL(url).pathname.split('/').pop() || 'imagem')
  return new File([blob], nome, { type: blob.type })
}

/** Processa um paste/drop completo. Devolve true se algo foi importado. */
export async function importarConteudo(editor: Editor, conteudo: ConteudoColado, opcoes: OpcoesImportacao): Promise<boolean> {
  const item = interpretar(conteudo)
  switch (item.tipo) {
    case 'vazio':
      return false
    case 'aviso':
      opcoes.avisar(item.mensagem, 'info')
      return false
    case 'camadas':
      editor.acoes.colarCamadas(item.camadas)
      return true
    case 'arquivos':
      return (await importarArquivos(editor, item.arquivos, opcoes)).length > 0
    case 'figma':
      try {
        return await colarDoFigma(editor, item.mensagem, item.arquivos, opcoes)
      } catch {
        opcoes.avisar('Não consegui ler esta cópia do Figma. No Figma, use Copiar como > Copiar como SVG (ou PNG, ⇧⌘C) e cole de novo.', 'info')
        return false
      }
    case 'svg': {
      await inserirSvg(editor, item.markup, opcoes, item.origem === 'figma' ? 'figma' : item.origem === 'illustrator' ? 'illustrator' : 'vetor')
      opcoes.avisar(item.origem === 'figma' ? 'Vetor do Figma colado. Troque as cores no painel Design.' : item.origem === 'illustrator' ? 'Arte do Illustrator colada como vetor.' : 'SVG colado como vetor.', 'sucesso')
      return true
    }
    case 'imagemUrl':
      try {
        const f = await baixarComoArquivo(item.url)
        return (await importarArquivos(editor, [f], opcoes)).length > 0
      } catch {
        opcoes.avisar('Não foi possível baixar essa imagem (o site bloqueia). Salve o arquivo e arraste para cá.', 'erro')
        return false
      }
    case 'embed': {
      const c = editor.cena!
      const w = c.size.width * 0.6
      editor.acoes.criarCamada({ type: 'embed', url: item.url, ariaLabel: 'Conteúdo incorporado' }, { x: (c.size.width - w) / 2, y: (c.size.height - (w * 9) / 16) / 2, width: w, height: (w * 9) / 16 })
      opcoes.avisar('Link incorporado. Ele funciona na apresentação.', 'sucesso')
      return true
    }
    case 'texto': {
      const c = editor.cena!
      const linhas = item.texto.split('\n').length
      const fs = Math.round(c.size.width / (item.texto.length > 120 ? 48 : 26))
      const w = Math.min(c.size.width * 0.7, Math.max(300, item.texto.length * fs * 0.5))
      const pos = opcoes.ponto ?? { x: c.size.width / 2, y: c.size.height / 2 }
      editor.acoes.criarCamada({ type: 'text', text: item.texto, fontSize: fs, color: '#171717' }, { x: pos.x - w / 2, y: pos.y - (linhas * fs * 1.3) / 2, width: w, height: Math.max(fs * 1.3, linhas * fs * 1.3 * Math.ceil((item.texto.length * fs * 0.5) / w / Math.max(1, linhas))) })
      return true
    }
  }
}
