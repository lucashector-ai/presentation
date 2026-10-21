/**
 * Monta o PDF que vai para a IA a partir das imagens das páginas escaneadas (jsPDF, uma imagem JPEG por página,
 * no tamanho original da página em pontos). O PDF resultante só tem pixels: nada de texto, scripts, anexos,
 * formulários ou metadados do arquivo original. Funciona no navegador e no Node (testes).
 */
import type { jsPDF as JsPdf } from 'jspdf'

export interface ImagemPagina {
  /** JPEG da página. */
  jpeg: Uint8Array
  /** Tamanho da página no PDF original, em pontos. */
  larguraPt: number
  alturaPt: number
}

export function montarPdfDeImagens(JsPDF: typeof JsPdf, paginas: ImagemPagina[]): Uint8Array {
  if (!paginas.length) throw new Error('Nenhuma página para montar')
  const tam = (p: ImagemPagina): [number, number] => [Math.max(1, p.larguraPt), Math.max(1, p.alturaPt)]
  const primeira = paginas[0]!
  const doc = new JsPDF({ unit: 'pt', format: tam(primeira), orientation: primeira.larguraPt > primeira.alturaPt ? 'landscape' : 'portrait', compress: true })
  doc.setProperties({ title: '', subject: '', author: '', keywords: '', creator: 'Mostra' })
  paginas.forEach((p, i) => {
    if (i > 0) doc.addPage(tam(p), p.larguraPt > p.alturaPt ? 'landscape' : 'portrait')
    doc.addImage(p.jpeg, 'JPEG', 0, 0, p.larguraPt, p.alturaPt, undefined, 'NONE')
  })
  return new Uint8Array(doc.output('arraybuffer'))
}
