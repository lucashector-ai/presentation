'use client'
/**
 * Insere no editor o que veio da cópia normal do Figma (⌘C): converte, sanitiza os SVGs, envia as imagens
 * que vierem com bytes e cola tudo como UM passo de desfazer, já selecionado.
 */
import type { Editor } from './useEditor'
import { clonarCamadas } from './useEditor'
import type { OpcoesImportacao } from './importar'
import { sanitizarSvgNavegador } from './importar'
import { converterMensagem, type CamadaConvertida } from '@/lib/importar/figma/converter'
import type { MensagemFigma } from '@/lib/importar/figma/tipos'
import { MAX_SVG_INLINE, parseCamada, type Camada } from '@/lib/scene/schema'
import { dados } from '@/lib/dados'
import { carregarCatalogo, mapearFonte, type Catalogo } from '@/lib/fontes/catalogo'

const MAX_CAMADAS_CENA = 400

export const AVISO_IMAGENS_FIGMA = 'As imagens do Figma não vêm na cópia: deixei marcadores listrados no lugar. Arraste os arquivos para cá ou, no Figma, use Exportar (PNG/JPG) e solte sobre o marcador.'

async function enviar(bytes: Uint8Array | Blob, nome: string, tipo: string, opcoes: OpcoesImportacao, projetoId?: string): Promise<string> {
  const arquivo = bytes instanceof Blob ? new File([bytes], nome, { type: tipo }) : new File([bytes as BlobPart], nome, { type: tipo })
  const a = await dados.enviarArquivo(arquivo, (p) => opcoes.aoProgredir?.(arquivo.name, p), { sanitizarSvg: (t) => t, projetoId })
  return a.id
}

export async function colarDoFigma(editor: Editor, mensagem: MensagemFigma, arquivos: File[], opcoes: OpcoesImportacao): Promise<boolean> {
  const cena = editor.cena
  if (!cena) return false
  const limite = Math.max(0, MAX_CAMADAS_CENA - cena.layers.length)
  // fontes do Figma → catálogo do Google Fonts (nome exato, outra caixa ou nome PostScript); sem o catálogo, cola igual
  const catalogo = await carregarCatalogo().catch(() => null)
  let r = converterMensagem(mensagem, { cena: cena.size, ponto: opcoes.ponto })
  if (r.camadas.length > limite) r = converterMensagem(mensagem, { cena: cena.size, ponto: opcoes.ponto, compacto: true })
  if (catalogo) r = { ...r, ...mapearFontesFigma(r.camadas, r.fontesAusentes, catalogo) }
  if (!r.camadas.length) {
    opcoes.avisar('A cópia do Figma não tem camadas visíveis para colar.', 'info')
    return false
  }
  if (r.camadas.length > limite) {
    opcoes.avisar(`Essa seleção do Figma vira ${r.camadas.length} camadas e a tela só comporta mais ${limite}. Copie menos camadas por vez.`, 'erro')
    return false
  }

  // um PNG que veio junto na área de transferência vale para o único marcador de imagem
  let faltando = r.camadas.filter((c) => c.imagemFaltando).length
  const png = arquivos.find((f) => f.type.startsWith('image/'))
  const marcadores = r.camadas.filter((c) => c.imagemFaltando)
  if (png && marcadores.length === 1) {
    try {
      const c = marcadores[0]!
      const { shape, fill: _f, pattern: _p, ...resto } = c.camada
      c.camada = { ...resto, type: 'image', assetId: await enviar(png, png.name || 'figma.png', png.type, opcoes, editor.projetoId), fit: 'cover', mask: shape === 'ellipse' ? 'ellipse' : 'none' }
      c.imagemFaltando = false
      faltando = 0
    } catch {
      /* fica o marcador */
    }
  }

  const prontas: Camada[] = []
  let falhas = 0
  for (const item of r.camadas as CamadaConvertida[]) {
    try {
      const c = { ...item.camada }
      if (item.imagem) c.assetId = await enviar(item.imagem.bytes, `${String(c.name ?? 'figma').slice(0, 40) || 'figma'}.${item.imagem.mime.split('/')[1]}`, item.imagem.mime, opcoes, editor.projetoId)
      if (c.type === 'svg' && typeof c.markup === 'string') {
        const markup = sanitizarSvgNavegador(c.markup)
        if (!/<svg/i.test(markup)) throw new Error('svg vazio')
        if (markup.length > MAX_SVG_INLINE) {
          delete c.markup
          c.assetId = await enviar(new Blob([markup], { type: 'image/svg+xml' }), `${String(c.name ?? 'figma').slice(0, 40) || 'figma'}.svg`, 'image/svg+xml', opcoes, editor.projetoId)
        } else c.markup = markup
      }
      prontas.push(parseCamada(c))
    } catch {
      falhas += 1
    }
  }
  if (!prontas.length) {
    opcoes.avisar('Não consegui converter as camadas desta cópia do Figma.', 'erro')
    return false
  }
  const atual = editor.cena ?? cena
  editor.acoes.inserirCamadas(clonarCamadas(prontas, atual.layers, 0))

  opcoes.avisar(prontas.length === 1 ? 'Camada do Figma colada.' : `${prontas.length} camadas do Figma coladas.`, 'sucesso')
  if (faltando) opcoes.avisar(AVISO_IMAGENS_FIGMA, 'info')
  const detalhes = [
    r.fontesAusentes.length ? `Fonte${r.fontesAusentes.length > 1 ? 's' : ''} ${r.fontesAusentes.slice(0, 3).join(', ')} não ${r.fontesAusentes.length > 1 ? 'estão' : 'está'} no Google Fonts: aparece se estiver instalada neste computador; senão usa Geist. Troque no seletor de fonte ou envie o arquivo da fonte.` : '',
    ...r.avisos.slice(0, 2),
    falhas ? `${falhas} camada${falhas > 1 ? 's' : ''} não ${falhas > 1 ? 'puderam' : 'pôde'} ser convertida${falhas > 1 ? 's' : ''}.` : '',
  ].filter(Boolean)
  if (detalhes.length) opcoes.avisar(detalhes.join(' '), 'info')
  return true
}

/** Troca o nome de fonte de cada texto pelo do catálogo; ausentes = só as que não estão nele. */
export function mapearFontesFigma(camadas: CamadaConvertida[], ausentes: string[], cat: Catalogo): { camadas: CamadaConvertida[]; fontesAusentes: string[] } {
  const novas = camadas.map((c) => {
    if (c.camada.type !== 'text' || typeof c.camada.fontFamily !== 'string') return c
    const m = mapearFonte(cat, c.camada.fontFamily)
    return m && m.familia !== c.camada.fontFamily ? { ...c, camada: { ...c.camada, fontFamily: m.familia } } : c
  })
  return { camadas: novas, fontesAusentes: ausentes.filter((n) => !mapearFonte(cat, n)) }
}
