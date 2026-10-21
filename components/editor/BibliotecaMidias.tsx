'use client'
import { useCallback, useRef, useState } from 'react'
import { Film, Image as ImageIcon, Trash2, Upload, X } from 'lucide-react'
import { enviarArquivo, excluirAsset, projetosQueUsam, type ProgressoUpload } from '@/lib/demo/store'
import type { AssetDemo } from '@/lib/demo/tipos'
import { formatarBytes } from '@/lib/planos'
import { MIMES_ACEITOS } from '@/lib/api/contratos'
import { Botao, BotaoIcone, Modal, cx } from '@/components/ui'
import { useToast } from '@/components/ui/toast'

interface ItemLote { nome: string; progresso: ProgressoUpload }

export function BibliotecaMidias({ assets, aoEscolher, aoCriarCenas, aoFechar }: { assets: AssetDemo[]; aoEscolher: (a: AssetDemo) => void; aoCriarCenas: (a: AssetDemo[]) => void; aoFechar: () => void }) {
  const [lote, setLote] = useState<ItemLote[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [excluindo, setExcluindo] = useState<AssetDemo | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const { mostrar } = useToast()

  const enviar = useCallback(
    async (arquivos: FileList | File[]) => {
      const lista = Array.from(arquivos)
      if (!lista.length) return
      setLote(lista.map((f) => ({ nome: f.name, progresso: { fase: 'validating', progresso: 0 } })))
      const prontos: AssetDemo[] = []
      await Promise.all(
        lista.map(async (f, i) => {
          try {
            const a = await enviarArquivo(f, (p) => setLote((l) => l.map((it, j) => (j === i ? { ...it, progresso: p } : it))))
            prontos.push(a)
          } catch {
            /* já refletido no item como failed */
          }
        })
      )
      const falhas = lista.length - prontos.length
      if (prontos.length) {
        mostrar(`${prontos.length} arquivo(s) prontos${falhas ? `, ${falhas} com erro` : ''}.`, falhas ? 'info' : 'sucesso', { rotulo: `Criar ${prontos.length} cena(s)`, aoClicar: () => aoCriarCenas(prontos) })
      } else mostrar('Nenhum arquivo foi enviado.', 'erro')
    },
    [aoCriarCenas, mostrar]
  )

  const emAndamento = lote.filter((i) => !['ready', 'failed'].includes(i.progresso.fase)).length
  const concluidos = lote.length - emAndamento

  return (
    <section aria-label="Biblioteca de mídias" className="flex h-full flex-col border-t bg-superficie">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-texto2">Biblioteca · {assets.length}</span>
          {lote.length > 0 && <span className="text-xs text-texto2" role="status">{emAndamento ? `Enviando ${concluidos + 1} de ${lote.length} arquivos…` : `${lote.length} arquivo(s) processados`}</span>}
        </div>
        <div className="flex items-center gap-1">
          <input ref={entrada} type="file" multiple accept={MIMES_ACEITOS.join(',')} className="hidden" onChange={(e) => { if (e.target.files) void enviar(e.target.files); e.target.value = '' }} />
          <Botao tamanho="sm" variante="secundario" icone={<Upload className="h-3.5 w-3.5" />} onClick={() => entrada.current?.click()}>Enviar arquivos</Botao>
          <BotaoIcone rotulo="Fechar biblioteca" onClick={aoFechar}><X className="h-4 w-4" /></BotaoIcone>
        </div>
      </div>
      <div
        className={cx('rolagem-fina flex-1 overflow-x-auto px-3 pb-3', arrastando && 'bg-destaque/20')}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); void enviar(e.dataTransfer.files) }}
      >
        {assets.length === 0 && lote.length === 0 ? (
          <button onClick={() => entrada.current?.click()} className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed text-sm text-texto2 hover:bg-superficie2">
            <Upload className="mb-2 h-5 w-5" /> Arraste imagens ou vídeos aqui (PNG, JPG, WebP, GIF, MP4, WebM)
          </button>
        ) : (
          <ul className="flex h-full items-stretch gap-2">
            {lote.filter((i) => i.progresso.fase !== 'ready').map((i, n) => (
              <li key={`lote-${n}`} className="flex w-32 shrink-0 flex-col justify-between rounded-xl border p-2 text-[11px]">
                <span className="truncate" title={i.nome}>{i.nome}</span>
                {i.progresso.fase === 'failed' ? (
                  <span className="text-perigo">{i.progresso.mensagem ?? 'Não foi possível carregar este arquivo.'}</span>
                ) : (
                  <>
                    <span className="text-texto2">{{ validating: 'Validando…', uploading: 'Enviando…', processing: 'Processando…', ready: 'Pronto', failed: '' }[i.progresso.fase]}</span>
                    <span className="h-1 w-full overflow-hidden rounded bg-superficie2"><span className="block h-full bg-acao transition-all" style={{ width: `${i.progresso.progresso}%` }} /></span>
                  </>
                )}
              </li>
            ))}
            {assets.map((a) => (
              <li key={a.id} className="group relative w-32 shrink-0">
                <button onClick={() => aoEscolher(a)} className="flex h-full w-full flex-col overflow-hidden rounded-xl border text-left hover:border-texto/50" title={`Adicionar ${a.nome} à cena`}>
                  <span className="flex h-20 w-full items-center justify-center bg-superficie2">
                    {a.thumbUrl ? <img src={a.thumbUrl} alt="" className="h-full w-full object-cover" /> : a.tipo === 'video' ? <Film className="h-6 w-6 text-texto2" /> : <ImageIcon className="h-6 w-6 text-texto2" />}
                  </span>
                  <span className="truncate px-2 pt-1 text-[11px]">{a.nome}</span>
                  <span className="px-2 pb-1.5 text-[10px] text-texto2">{a.width && a.height ? `${a.width}×${a.height} · ` : ''}{formatarBytes(a.bytes)}</span>
                </button>
                <BotaoIcone rotulo={`Excluir ${a.nome}`} className="absolute right-1 top-1 hidden h-7 w-7 bg-superficie/90 group-hover:inline-flex group-focus-within:inline-flex" onClick={() => setExcluindo(a)}><Trash2 className="h-3.5 w-3.5" /></BotaoIcone>
              </li>
            ))}
          </ul>
        )}
      </div>
      {excluindo && (
        <Modal aberto aoFechar={() => setExcluindo(null)} titulo="Excluir mídia?" largura="sm" descricao={excluindo.nome}
          rodape={<>
            <Botao variante="secundario" onClick={() => setExcluindo(null)}>Cancelar</Botao>
            <Botao variante="perigo" onClick={() => { excluirAsset(excluindo.id, true); setExcluindo(null); mostrar('Mídia excluída.') }}>Excluir mesmo assim</Botao>
          </>}>
          {(() => {
            const uso = projetosQueUsam(excluindo.id)
            return uso.length ? <p className="text-sm text-perigo">Esta mídia é usada em: {uso.map((p) => p.nome).join(', ')}. As cenas mostrarão “mídia indisponível”.</p> : <p className="text-sm text-texto2">Nenhum projeto usa esta mídia.</p>
          })()}
        </Modal>
      )}
    </section>
  )
}
