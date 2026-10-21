'use client'
/**
 * Importar um PDF como apresentação (Novo projeto → Traga seu material): cada página é renderizada no navegador
 * (pdf.js, carregado só agora) e enviada como imagem pelo fluxo normal de mídias (`dados.enviarArquivo`: rota
 * POST /api/assets/upload no modo real, armazenamento local no demo); o texto da página vira camadas de texto
 * invisíveis e selecionáveis (opcional). O PDF em si não é enviado a lugar nenhum.
 */
import { dados } from '@/lib/dados'
import { blocosPosicionados } from '@/lib/pdf/texto'
import type { PaginaImportada } from '@/lib/pdf/paginas'
import { PLANOS, type PlanoId } from '@/lib/planos'

export interface ProgressoImportacao { pagina: number; total: number }

export interface ResultadoImportacaoPdf {
  paginas: PaginaImportada[]
  /** Páginas do PDF que ficaram de fora pelo limite do plano. */
  deFora: number
  totalPdf: number
}

export async function importarPaginasPdf(arquivo: File, opcoes: { planoId: PlanoId; textoSelecionavel: boolean; aoProgredir?: (p: ProgressoImportacao) => void }): Promise<ResultadoImportacaoPdf> {
  const pdf = await import('@/lib/pdf/navegador')
  const d = await pdf.abrirPdf(arquivo)
  try {
    const limite = PLANOS[opcoes.planoId].limites.paginasPdfImportar
    const total = Math.min(d.paginas, limite)
    const texto = opcoes.textoSelecionavel ? await pdf.lerTextoPdf(d, { maxPaginas: total }) : null
    // alta resolução: o lado maior com 2× o da tela (1.920 px) no modo real; no demo 1× (as mídias ficam no navegador)
    const ladoMax = 1920 * (dados.modo === 'demo' ? 1 : 2)
    const base = arquivo.name.replace(/\.pdf$/i, '').slice(0, 60) || 'pdf'
    const paginas: PaginaImportada[] = []
    for (let n = 1; n <= total; n++) {
      opcoes.aoProgredir?.({ pagina: n, total })
      const r = await pdf.renderizarPagina(d, n, { ladoMax, tipo: 'image/webp', qualidade: 0.92 })
      const ext = r.blob.type === 'image/webp' ? 'webp' : 'jpg'
      const asset = await dados.enviarArquivo(new File([r.blob], `${base} · página ${n}.${ext}`, { type: r.blob.type }), () => undefined)
      paginas.push({ numero: n, assetId: asset.id, larguraPt: r.larguraPt, alturaPt: r.alturaPt, blocos: texto ? blocosPosicionados(texto.paginasPdf[n - 1]?.itens ?? []) : [] })
    }
    return { paginas, deFora: d.paginas - total, totalPdf: d.paginas }
  } finally {
    await d.fechar().catch(() => {})
  }
}
