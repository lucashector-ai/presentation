'use client'
/** Envia uma imagem do computador (vira mídia do espaço) e devolve o id do asset. Mini (ícone) ou largo (botão com texto). */
import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { dados, mensagemDeErro } from '@/lib/dados'
import { sanitizarSvgNavegador } from '@/lib/editor/importar'
import { useToast } from '@/components/ui/toast'
import { BotaoMini } from './campos'

export function EnviarImagem({ aoEnviada, largo = false }: { aoEnviada: (assetId: string) => void; largo?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const { mostrar } = useToast()
  const enviar = async (f: File | undefined) => {
    if (!f) return
    setEnviando(true)
    try { const a = await dados.enviarArquivo(f, () => undefined, { sanitizarSvg: sanitizarSvgNavegador }); aoEnviada(a.id) } catch (e) { mostrar(mensagemDeErro(e, 'Não foi possível enviar a imagem.'), 'erro') } finally { setEnviando(false); if (entrada.current) entrada.current.value = '' }
  }
  const icone = enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />
  return (
    <>
      {largo ? (
        <button type="button" disabled={enviando} onClick={() => entrada.current?.click()} className="flex h-6 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-borda text-[11px] font-medium text-texto2 transition-colors hover:border-acento hover:bg-acentoSuave hover:text-acento disabled:opacity-60">
          {icone}
          {enviando ? 'Enviando…' : 'Enviar imagem do computador'}
        </button>
      ) : (
        <BotaoMini rotulo="Adicionar imagem do computador" onClick={() => entrada.current?.click()}>{icone}</BotaoMini>
      )}
      <input ref={entrada} type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.svg" className="hidden" aria-label="Arquivo de imagem" onChange={(e) => void enviar(e.target.files?.[0])} />
    </>
  )
}
