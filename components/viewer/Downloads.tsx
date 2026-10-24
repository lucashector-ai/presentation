'use client'
/**
 * Downloads na apresentação: o editor marca camadas (imagem, SVG, vídeo, 3D, Lottie) como "disponível para
 * download" e liga `documento.downloads.ativo`. Aqui: um botão discreto na barra de controles abre o painel com
 * os arquivos; com `paginaFinal`, o painel abre sozinho ao chegar na última tela. Puxa o arquivo como blob para
 * o nome ficar certo mesmo com a mídia em outra origem (R2).
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, X } from 'lucide-react'
import type { DocumentoProjeto } from '@/lib/scene/schema'
import type { AssetsResolvidos } from '@/components/renderer/SceneRenderer'

interface Item { id: string; nome: string; url: string; tipo: string; tela: number }

const ROTULO: Record<string, string> = { image: 'Imagem', svg: 'Vetor', video: 'Vídeo', model3d: 'Modelo 3D', lottie: 'Animação' }

/** Camadas marcadas para download, com a URL resolvida. Puro. */
export function itensDeDownload(documento: DocumentoProjeto, assets: AssetsResolvidos): Item[] {
  const itens: Item[] = []
  documento.scenes.forEach((cena, i) => {
    for (const l of cena.layers) {
      if (!l.download || !('assetId' in l) || !l.assetId) continue
      const a = assets[l.assetId]
      if (!a?.url) continue
      itens.push({ id: l.id, nome: l.name || `${ROTULO[l.type] ?? 'Arquivo'} · tela ${i + 1}`, url: a.url, tipo: ROTULO[l.type] ?? l.type, tela: i })
    }
  })
  return itens
}

const extensao = (url: string) => { const m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url); return m ? `.${m[1]!.toLowerCase()}` : '' }

export async function baixar(item: Item) {
  const nome = /\.[a-z0-9]{2,5}$/i.test(item.nome) ? item.nome : item.nome + extensao(item.url)
  try {
    const r = await fetch(item.url)
    const blob = await r.blob()
    const u = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: u, download: nome })
    document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(u), 10_000)
  } catch {
    window.open(item.url, '_blank', 'noopener')
  }
}

export function Downloads({ documento, assets, indice, total }: { documento: DocumentoProjeto; assets: AssetsResolvidos; indice: number; total: number }) {
  const [aberto, setAberto] = useState(false)
  const [visto, setVisto] = useState(false)
  const cfg = documento.downloads
  const itens = cfg?.ativo ? itensDeDownload(documento, assets) : []
  const ultima = indice === total - 1
  useEffect(() => { if (cfg?.ativo && cfg.paginaFinal && ultima && itens.length && !visto) { setAberto(true); setVisto(true) } }, [cfg?.ativo, cfg?.paginaFinal, ultima, itens.length, visto])
  if (!itens.length) return null
  const nestaTela = itens.filter((i) => i.tela === indice).length
  return (
    <>
      <button aria-label={`Baixar arquivos (${itens.length})`} title="Arquivos para download" onClick={(e) => { e.stopPropagation(); setAberto(true) }} className={`relative rounded-full p-2 hover:bg-white/15 ${ultima && cfg?.paginaFinal ? 'bg-white/15' : ''}`}>
        <Download className="h-4 w-4" />
        {nestaTela > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#D7F25C]" aria-hidden />}
      </button>
      {aberto && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-label="Arquivos para download" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setAberto(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[#171717] p-5 text-[#FAFAF9] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">Arquivos desta apresentação</h2>
              <button aria-label="Fechar" onClick={() => setAberto(false)} className="rounded-full p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
            <ul className="max-h-[60vh] divide-y divide-white/10 overflow-y-auto">
              {itens.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><div className="truncate text-[13px]">{i.nome}</div><div className="text-[11px] text-white/55">{i.tipo} · tela {i.tela + 1}</div></div>
                  <button onClick={() => void baixar(i)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#FAFAF9] px-3 py-1.5 text-[12px] font-medium text-[#171717] hover:bg-white"><Download className="h-3.5 w-3.5" />Baixar</button>
                </li>
              ))}
            </ul>
            {itens.length > 1 && <button onClick={() => { for (const i of itens) void baixar(i) }} className="mt-3 w-full rounded-full border border-white/20 py-2 text-[12px] hover:bg-white/10">Baixar todos ({itens.length})</button>}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
