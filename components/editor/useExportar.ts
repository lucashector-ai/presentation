'use client'
/** Exportar PNG/JPG (tela ou seleção, 1×–3×) e PDF da apresentação — usado pelo menu do editor e pelo inspetor. */
import { useCallback, useMemo, useState } from 'react'
import type { Editor } from '@/lib/editor/useEditor'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'
import { cenaDaSelecao, nomeArquivo, type FormatoImagem } from '@/lib/exportar/medidas'
import { useDemo } from '@/lib/demo/useDemo'
import { useToast } from '@/components/ui/toast'

const pad = (n: number) => String(n).padStart(2, '0')

export function useExportar(editor: Editor, nomeProjeto?: string) {
  const lista = useDemo((e) => e.assets)
  const assets: AssetsResolvidos = useMemo(() => Object.fromEntries(lista.map((a) => [a.id, { url: a.url, thumbUrl: a.thumbUrl, posterUrl: a.posterUrl }])), [lista])
  const { mostrar } = useToast()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const { cena, indiceCena, camadasSelecionadas, estado } = editor

  const rodar = useCallback(async (rotulo: string, fn: () => Promise<string>) => {
    setOcupado(rotulo)
    try {
      mostrar(await fn(), 'sucesso')
    } catch (e) {
      console.error(e)
      mostrar(e instanceof Error && e.message.length < 120 ? e.message : 'Não foi possível exportar. Tente de novo.', 'erro')
    } finally {
      setOcupado(null)
    }
  }, [mostrar])

  const exportarTela = useCallback((formato: FormatoImagem, escala: number) => rodar('tela', async () => {
    if (!cena) throw new Error('Nenhuma tela para exportar.')
    const r = await import('@/lib/exportar/rasterizar')
    const blob = await r.cenaParaBlob(cena, assets, { formato, escala })
    r.baixarBlob(blob, nomeArquivo([nomeProjeto, `${pad(indiceCena + 1)} ${cena.title}`], escala, formato))
    return `Tela exportada em ${formato.toUpperCase()} ${escala}×.`
  }), [rodar, cena, assets, nomeProjeto, indiceCena])

  const exportarSelecao = useCallback((formato: FormatoImagem, escala: number) => rodar('selecao', async () => {
    const sub = cena ? cenaDaSelecao(cena, camadasSelecionadas.map((l) => l.id)) : null
    if (!sub) throw new Error('Selecione uma camada visível para exportar.')
    const r = await import('@/lib/exportar/rasterizar')
    const blob = await r.cenaParaBlob(sub, assets, { formato, escala })
    const unica = camadasSelecionadas.length === 1 ? camadasSelecionadas[0] : undefined
    r.baixarBlob(blob, nomeArquivo([unica ? unica.name || unica.id : `${camadasSelecionadas.length} camadas`], escala, formato))
    return `${unica ? 'Camada exportada' : 'Seleção exportada'} em ${formato.toUpperCase()} ${escala}×.`
  }), [rodar, cena, camadasSelecionadas, assets])

  const exportarPdf = useCallback(() => rodar('pdf', async () => {
    const r = await import('@/lib/exportar/rasterizar')
    const doc = estado.documento
    const blob = await r.documentoParaPdf(doc, assets)
    r.baixarBlob(blob, nomeArquivo([nomeProjeto || 'Apresentação'], 1, 'pdf'))
    return `PDF com ${doc.scenes.length} ${doc.scenes.length === 1 ? 'página' : 'páginas'} exportado.`
  }), [rodar, estado.documento, assets, nomeProjeto])

  /** ⇧⌘C: copia a seleção (ou a tela) como PNG para a área de transferência. */
  const copiarPng = useCallback(() => rodar('copiar', async () => {
    if (!cena) throw new Error('Nenhuma tela para copiar.')
    const alvo = camadasSelecionadas.length ? cenaDaSelecao(cena, camadasSelecionadas.map((l) => l.id)) : cena
    if (!alvo) throw new Error('Selecione uma camada visível.')
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('Este navegador não copia imagens. Use Exportar.')
    // o Safari exige o ClipboardItem criado ainda no gesto (antes de qualquer await), com a promessa da imagem
    const png = import('@/lib/exportar/rasterizar').then((r) => r.cenaParaBlob(alvo, assets, { formato: 'png', escala: 2 }))
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    return camadasSelecionadas.length ? 'Seleção copiada como PNG.' : 'Tela copiada como PNG.'
  }), [rodar, cena, camadasSelecionadas, assets])

  return { ocupado, exportarTela, exportarSelecao, exportarPdf, copiarPng, temSelecao: camadasSelecionadas.length > 0 }
}
