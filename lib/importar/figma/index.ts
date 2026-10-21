/**
 * Colar do Figma com ⌘C normal: HTML da área de transferência → camadas da Mostra.
 * Ver decodificar.ts (formato fig-kiwi), converter.ts (mapeamento) e desenho.ts (SVG).
 */
import { converterMensagem, type OpcoesConversao, type ResultadoConversao } from './converter'
import { decodificarFigma, ehHtmlFigma } from './decodificar'

export { ehHtmlFigma, decodificarFigma, extrairBufferFigma, decodificarArquivoKiwi } from './decodificar'
export { converterMensagem, gradienteCss, pesoDoEstilo, type CamadaConvertida, type OpcoesConversao, type ResultadoConversao } from './converter'

/** Decodifica e converte. Lança erro se o HTML não for decodificável (o chamador mostra o aviso antigo). */
export function figmaParaCamadas(html: string, opcoes: OpcoesConversao): ResultadoConversao {
  const { mensagem } = decodificarFigma(html)
  return converterMensagem(mensagem, opcoes)
}

/** Versão que nunca lança: null quando não é Figma ou não deu para ler. */
export function tentarFigmaParaCamadas(html: string, opcoes: OpcoesConversao): ResultadoConversao | null {
  if (!ehHtmlFigma(html)) return null
  try {
    return figmaParaCamadas(html, opcoes)
  } catch {
    return null
  }
}
