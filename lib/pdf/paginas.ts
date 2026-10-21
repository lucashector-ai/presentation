/**
 * "Importar PDF como apresentação": cada página vira uma tela com a imagem da página (renderizada no navegador
 * em alta resolução e enviada como mídia) e, opcionalmente, o texto da página em camadas de texto invisíveis,
 * posicionadas sobre as palavras: dá para selecionar e copiar no visualizador, buscar, ler com leitor de tela e,
 * no editor, tornar visível e editar. Puro (sem DOM): recebe as medidas da página e os blocos de texto.
 */
import { FORMATOS, novaCena, parseCamada, SCHEMA_VERSION, type Camada, type Cena, type DocumentoProjeto, type ModoProjeto } from '@/lib/scene/schema'
import type { BlocoPosicionado } from './texto'

/** Cor das camadas de texto sobre a página: totalmente transparente (o texto existe, mas quem se vê é a imagem). */
export const COR_TEXTO_INVISIVEL = '#00000000'
/** Camadas por tela: 1 imagem + até 200 blocos de texto (o schema aceita 400). */
export const MAX_BLOCOS_TEXTO = 200

/** Tamanho da tela para uma página: o lado maior com 1.920 px (Story: largura de 1.080), na proporção da página. */
export function tamanhoDaTela(larguraPt: number, alturaPt: number, modo: ModoProjeto): { width: number; height: number } {
  const prop = Math.max(0.05, Math.min(20, larguraPt / Math.max(1, alturaPt)))
  const lim = (n: number) => Math.max(16, Math.min(8192, Math.round(n)))
  if (modo === 'story') return { width: FORMATOS.story.width, height: lim(FORMATOS.story.width / prop) }
  return prop >= 1 ? { width: 1920, height: lim(1920 / prop) } : { width: lim(1920 * prop), height: 1920 }
}

/** Lado maior da imagem renderizada: 2× a tela (telas de alta densidade) no modo real; 1× no demo (localStorage). */
export const ladoDaImagem = (tela: { width: number; height: number }, densidade: 1 | 2) => Math.max(tela.width, tela.height) * densidade

export interface PaginaImportada {
  numero: number
  assetId: string
  larguraPt: number
  alturaPt: number
  /** Blocos de texto da página (vazio = página escaneada ou texto desligado). */
  blocos: BlocoPosicionado[]
}

const tituloDe = (p: PaginaImportada) => {
  const maior = [...p.blocos].sort((a, b) => b.tamanho - a.tamanho || a.y - b.y)[0]
  const t = maior?.texto.split('\n')[0]?.trim() ?? ''
  return (t.length >= 3 ? t : `Página ${p.numero}`).slice(0, 120)
}

export function cenaDaPagina(p: PaginaImportada, indice: number, modo: ModoProjeto, opcoes: { textoSelecionavel: boolean }): Cena {
  const size = tamanhoDaTela(p.larguraPt, p.alturaPt, modo)
  const k = size.width / Math.max(1, p.larguraPt)
  const camadas: Camada[] = [parseCamada({ id: 'pagina', name: `Página ${p.numero}`, type: 'image', assetId: p.assetId, x: 0, y: 0, width: size.width, height: size.height, fit: 'fill' })]
  if (opcoes.textoSelecionavel) {
    p.blocos.slice(0, MAX_BLOCOS_TEXTO).forEach((b, i) => {
      const fontSize = Math.max(6, Math.min(800, b.tamanho * k))
      camadas.push(parseCamada({
        id: `texto-${i + 1}`,
        name: 'Texto da página',
        type: 'text',
        text: b.texto.slice(0, 5000),
        x: Math.round(b.x * k),
        y: Math.round(b.y * k),
        width: Math.max(1, Math.round(b.largura * k)),
        height: Math.max(1, Math.round(b.altura * k)),
        fontSize: Math.round(fontSize * 10) / 10,
        // métricas próximas das fontes mais comuns em PDF (Helvetica/Arial): a seleção cai perto das palavras
        fontFamily: 'Arial',
        fontWeight: 400,
        lineHeight: Math.round(b.entrelinha * 100) / 100,
        color: COR_TEXTO_INVISIVEL,
        z: i + 1,
      }))
    })
  }
  return novaCena({
    id: `pagina-${String(indice + 1).padStart(3, '0')}`,
    title: tituloDe(p),
    size,
    background: '#FFFFFF',
    layers: camadas,
    ...(modo === 'explorar' ? { map: { x: (indice % 4) * (size.width + 360), y: Math.floor(indice / 4) * (Math.max(size.height, 1080) + 360) } } : {}),
  })
}

/** Documento com uma tela por página, na ordem do PDF (transição suave entre páginas no modo Slides). */
export function documentoDePaginas(paginas: PaginaImportada[], modo: ModoProjeto, opcoes: { textoSelecionavel: boolean }): DocumentoProjeto {
  const scenes = paginas.map((p, i) => {
    const c = cenaDaPagina(p, i, modo, opcoes)
    return modo === 'slides' && i > 0 ? { ...c, transition: { type: 'fade' as const, duration: 400, easing: 'easeInOut' as const } } : c
  })
  return { schemaVersion: SCHEMA_VERSION, mode: modo, scenes }
}

/** Camada de texto invisível vinda de uma página de PDF (o visualizador deixa selecionar). */
export const ehTextoInvisivel = (c: { type: string; color?: string; background?: string }) => c.type === 'text' && /^#[0-9a-f]{6}00$/i.test(c.color ?? '') && !c.background
