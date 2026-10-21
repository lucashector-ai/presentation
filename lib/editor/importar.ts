'use client'
/**
 * Leva o conteúdo colado/solto para dentro da tela atual.
 * Cópia normal do Figma (⌘C) vira camadas editáveis (texto, formas, vetores; ver colarFigma.ts).
 * Figma "Copiar como SVG" e Illustrator viram camadas SVG vetoriais (cores editáveis); PNG/JPG viram imagem;
 * GLB/GLTF do Blender vira 3D; JSON do After Effects (Bodymovin) vira Lottie; links do YouTube/Vimeo/Figma
 * viram incorporação; texto vira caixa de texto; camadas copiadas da Mostra são coladas com IDs novos.
 */
import DOMPurify from 'dompurify'
import type { Editor } from './useEditor'
import { interpretar, type ConteudoColado } from '@/lib/importar/clipboard'
import { dimensoesSvg, normalizarSvg, sanitizarSvg } from '@/lib/importar/svg'
import { MAX_SVG_INLINE } from '@/lib/scene/schema'
import { enquadrarNaCena } from '@/lib/scene/transform'
import { dados, type AssetDemo, type ProgressoUpload } from '@/lib/dados'
import { colarDoFigma } from './colarFigma'

export type Avisar = (texto: string, tipo?: 'info' | 'sucesso' | 'erro') => void

export function sanitizarSvgNavegador(markup: string): string {
  return normalizarSvg(sanitizarSvg(markup, DOMPurify))
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
export function inserirSvg(editor: Editor, markupBruto: string, opcoes: OpcoesImportacao, nome = 'vetor') {
  const markup = sanitizarSvgNavegador(markupBruto)
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
  for (const f of arquivos) {
    try {
      const a = await dados.enviarArquivo(f, (p) => opcoes.aoProgredir?.(f.name, p), { sanitizarSvg: sanitizarSvgNavegador, projetoId: editor.projetoId })
      prontos.push(a)
      if (a.erro) opcoes.avisar(a.erro, 'info')
      const ponto = opcoes.ponto ? { x: opcoes.ponto.x + deslocamento, y: opcoes.ponto.y + deslocamento } : undefined
      editor.acoes.adicionarAsset(a, ponto)
      deslocamento += 32
    } catch (e) {
      opcoes.avisar(e instanceof Error ? e.message : `Não foi possível importar ${f.name}.`, 'erro')
    }
  }
  if (prontos.length) {
    const tipos = new Set(prontos.map((p) => p.tipo))
    const rotulo = tipos.has('model3d') ? 'modelo 3D' : tipos.has('svg') ? 'vetor' : tipos.has('lottie') ? 'animação' : tipos.has('video') ? 'vídeo' : 'imagem'
    opcoes.avisar(prontos.length === 1 ? `${rotulo[0]!.toUpperCase()}${rotulo.slice(1)} adicionado à tela.` : `${prontos.length} arquivos adicionados à tela.`, 'sucesso')
  }
  return prontos
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
